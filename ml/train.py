"""Train, compile and export the two Concrete ML models, and write the public model card.

  anomaly   LogisticRegression on one bill (log amount, category, weekday, day of month) -> P(anomalous)
  forecast  LinearRegression on the last three monthly totals + the target month -> next month's total

The training data is synthetic (generated below), so the model card is safe to publish: it holds no real
bill. Run once; the server and the helper load the exported client.zip/server.zip from ARTIFACTS.

    python train.py              # always retrain
    python train.py --if-missing # skip when the artifacts already exist (the Docker entrypoint)
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import shutil
import sys
import time

import numpy as np
from concrete.ml.deployment import FHEModelDev
from concrete.ml.sklearn import LinearRegression, LogisticRegression
from sklearn.metrics import confusion_matrix, mean_absolute_error, precision_recall_fscore_support, r2_score
from sklearn.model_selection import train_test_split

from common import (
    ANOMALY_DIR,
    ARTIFACTS,
    CATEGORY_LABELS,
    FORECAST_DIR,
    MODEL_CARD,
    NUM_CATEGORIES,
    anomaly_features,
    forecast_features,
)

RNG = np.random.default_rng(7)

# Typical bill per category in rupees (median) and spread, loosely modelled on Indian household bills.
CATEGORY_MEDIAN = [1800, 900, 1400, 650, 2200, 800]
CATEGORY_SIGMA = [0.35, 0.55, 0.6, 0.5, 0.7, 0.6]
CATEGORY_WEIGHT = [0.14, 0.32, 0.1, 0.18, 0.16, 0.10]
ANOMALY_RATE = 0.08


def synthetic_bills(n: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """n bills over 2024-2026 as (features, labels, amounts in rupees). About 8% are anomalous."""
    start = (dt.date(2024, 1, 1) - dt.date(1970, 1, 1)).days
    categories = RNG.choice(NUM_CATEGORIES, size=n, p=CATEGORY_WEIGHT)
    days = start + RNG.integers(0, 365 * 3, size=n)
    amounts = np.array(
        [RNG.lognormal(np.log(CATEGORY_MEDIAN[c]), CATEGORY_SIGMA[c]) for c in categories]
    )
    labels = (RNG.random(n) < ANOMALY_RATE).astype(np.int64)
    # An anomaly is a bill far above what its category usually costs (a duplicate charge, an inflated invoice).
    amounts = np.where(labels == 1, amounts * RNG.uniform(3.5, 10, size=n), amounts)
    X = np.stack([anomaly_features(a * 100, c, d) for a, c, d in zip(amounts, categories, days)])
    return X, labels, amounts


def synthetic_months(households: int, months: int) -> tuple[np.ndarray, np.ndarray, list[dict]]:
    """Monthly spend series (thousands of rupees) with trend, festival-season bumps and noise."""
    X, y, backtest = [], [], []
    for h in range(households):
        base = RNG.uniform(12, 60)
        trend = RNG.uniform(-0.15, 0.35)
        series = []
        for m in range(months):
            month_of_year = m % 12 + 1
            season = 1 + 0.18 * np.sin(2 * np.pi * (month_of_year - 10) / 12)  # peaks around Oct-Nov
            series.append(max(1.0, base * season + trend * m + RNG.normal(0, base * 0.06)))
        for m in range(3, months):
            X.append(forecast_features(series[m - 3 : m], m % 12 + 1))
            y.append(series[m])
            if h == 0:
                backtest.append({"month": m, "actual": series[m]})
    return np.stack(X), np.array(y, dtype=np.float32), backtest


def histogram(values: np.ndarray, edges: np.ndarray) -> list[int]:
    return np.histogram(values, bins=edges)[0].astype(int).tolist()


def export(model, path) -> None:
    if path.exists():
        shutil.rmtree(path)
    FHEModelDev(path_dir=str(path), model=model).save()


def train_anomaly(card: dict) -> None:
    X, y, amounts = synthetic_bills(6000)
    X_train, X_test, y_train, y_test, _, amt_test = train_test_split(
        X, y, amounts, test_size=0.25, random_state=1, stratify=y
    )
    model = LogisticRegression(n_bits=8, class_weight="balanced", max_iter=2000)
    model.fit(X_train, y_train)
    model.compile(X_train)

    clear_pred = model.predict(X_test)
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, clear_pred, average="binary")
    tn, fp, fn, tp = confusion_matrix(y_test, clear_pred).ravel().tolist()

    # Same predictions under real FHE on a sample: the "it really runs encrypted" number.
    sample = X_test[:40]
    t0 = time.perf_counter()
    fhe_pred = model.predict(sample, fhe="execute")
    fhe_ms = (time.perf_counter() - t0) * 1000 / len(sample)
    agreement = float(np.mean(fhe_pred == model.predict(sample)))

    proba = model.predict_proba(X_test)[:, 1]
    edges = np.linspace(np.log1p(100), np.log1p(60000), 21)
    log_amt = np.log1p(amt_test)
    per_category = []
    for c in range(NUM_CATEGORIES):
        mask = X_test[:, 1 + c] == 1
        per_category.append(
            {
                "category": CATEGORY_LABELS[c],
                "bills": int(mask.sum()),
                "anomalies": int(y_test[mask].sum()),
                "flagged": int(clear_pred[mask].sum()),
            }
        )

    card["anomaly"] = {
        "model": "LogisticRegression",
        "nBits": 8,
        "features": ["log amount", "category (one-hot, 6)", "weekday", "day of month"],
        "trainSize": int(len(X_train)),
        "testSize": int(len(X_test)),
        "accuracy": float(np.mean(clear_pred == y_test)),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "confusion": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
        "fhe": {"samples": int(len(sample)), "agreement": agreement, "msPerBill": fhe_ms},
        # Training distribution: bill amounts (log scale) for normal vs anomalous bills.
        "amountHistogram": {
            "edgesRupees": np.expm1(edges).round().tolist(),
            "normal": histogram(log_amt[y_test == 0], edges),
            "anomalous": histogram(log_amt[y_test == 1], edges),
        },
        "scoreHistogram": {
            "edges": np.linspace(0, 1, 11).round(2).tolist(),
            "normal": histogram(proba[y_test == 0], np.linspace(0, 1, 11)),
            "anomalous": histogram(proba[y_test == 1], np.linspace(0, 1, 11)),
        },
        "perCategory": per_category,
    }
    export(model, ANOMALY_DIR)


def train_forecast(card: dict) -> None:
    X, y, backtest = synthetic_months(households=400, months=36)
    split = int(len(X) * 0.8)
    model = LinearRegression(n_bits=8)
    model.fit(X[:split], y[:split])
    model.compile(X[:split])

    pred = model.predict(X[split:]).ravel()
    sample = X[split : split + 10]
    fhe = model.predict(sample, fhe="execute").ravel()
    clear = model.predict(sample).ravel()

    # Backtest of one synthetic household: what the model would have predicted each month vs what happened.
    household = X[: len(backtest)]
    predicted = model.predict(household).ravel()
    for row, p in zip(backtest, predicted):
        row["actual"] = round(float(row["actual"]) * 1000)
        row["predicted"] = round(float(p) * 1000)

    card["forecast"] = {
        "model": "LinearRegression",
        "nBits": 8,
        "features": ["last 3 monthly totals", "target month (sin, cos)"],
        "trainSize": split,
        "testSize": int(len(X) - split),
        "maeRupees": float(mean_absolute_error(y[split:], pred) * 1000),
        "r2": float(r2_score(y[split:], pred)),
        "fhe": {"samples": int(len(sample)), "maxAbsDiffRupees": float(np.max(np.abs(fhe - clear)) * 1000)},
        "backtest": backtest,
    }
    export(model, FORECAST_DIR)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--if-missing", action="store_true")
    parser.add_argument("--card-copy", help="also write the model card here (the web app's public folder)")
    args = parser.parse_args()

    if args.if_missing and MODEL_CARD.exists() and (ANOMALY_DIR / "server.zip").exists():
        print("artifacts present, skipping training")
    else:
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        card: dict = {"generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "data": "synthetic"}
        print("training anomaly model ...", flush=True)
        train_anomaly(card)
        print("training forecast model ...", flush=True)
        train_forecast(card)
        MODEL_CARD.write_text(json.dumps(card, indent=2))
        print(f"wrote {MODEL_CARD}")

    if args.card_copy:
        shutil.copyfile(MODEL_CARD, args.card_copy)
        print(f"copied model card to {args.card_copy}")


if __name__ == "__main__":
    sys.exit(main())
