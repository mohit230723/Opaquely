"""The seller-side helper: runs on the seller's own machine and holds the Concrete ML private keys.

The Opaquely page (same machine) posts the seller's own bills here after decrypting them with the seller's
wallet. The helper encrypts each bill's features, sends only ciphertexts to the FHE server, decrypts the
results locally, and returns aggregate insights. The browser then re-encrypts those insights with FHEVM and
stores them on-chain, where buyers are granted them like the other totals.

    GET  /health
    POST /insights   {"bills": [{"amountCents": 123400, "category": 1, "dateDays": 20300}, ...]}
"""

from __future__ import annotations

import json
import os
import tempfile
import time
import urllib.request

import numpy as np
from concrete.ml.deployment import FHEModelClient
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from common import (
    ANOMALY_DIR,
    FORECAST_DIR,
    FORECAST_LAGS,
    SCORE_BUCKETS,
    WINDOW_MONTHS,
    anomaly_features,
    forecast_features,
    month_index,
)

SERVER_URL = os.environ.get("FHE_SERVER_URL", "http://127.0.0.1:8000")
WEB_ORIGINS = os.environ.get("WEB_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app = FastAPI(title="Opaquely seller helper")
# Only the local web app may call the helper: it answers with the seller's own (decrypted) insights.
app.add_middleware(CORSMiddleware, allow_origins=WEB_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"])


class Bill(BaseModel):
    amountCents: int = Field(gt=0)
    category: int = Field(ge=0, le=5)
    dateDays: int = Field(ge=0)


class InsightsRequest(BaseModel):
    bills: list[Bill] = Field(min_length=1, max_length=50)


def post_bytes(url: str, body: bytes) -> bytes:
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/octet-stream"})
    with urllib.request.urlopen(req, timeout=120) as res:
        return res.read()


class EncryptedModel:
    """One model's client: private keys stay in this process; the server only ever gets the evaluation keys."""

    def __init__(self, name: str, path) -> None:
        self.name = name
        self.client = FHEModelClient(str(path), key_dir=tempfile.mkdtemp(prefix=f"opaquely-{name}-"))
        self.client.generate_private_and_evaluation_keys()
        self.key_id: str | None = None
        self.bytes_sent = 0
        self.bytes_received = 0

    def register(self) -> None:
        keys = self.client.get_serialized_evaluation_keys()
        self.bytes_sent += len(keys)
        self.key_id = json.loads(post_bytes(f"{SERVER_URL}/keys/{self.name}", keys))["keyId"]

    def run(self, features: np.ndarray) -> tuple[np.ndarray, bytes]:
        if self.key_id is None:
            self.register()
        encrypted = self.client.quantize_encrypt_serialize(features.reshape(1, -1))
        self.bytes_sent += len(encrypted)
        result = post_bytes(f"{SERVER_URL}/run/{self.name}?key_id={self.key_id}", encrypted)
        self.bytes_received += len(result)
        return np.asarray(self.client.deserialize_decrypt_dequantize(result)), encrypted


MODELS: dict[str, EncryptedModel] = {}


def model(name: str) -> EncryptedModel:
    if name not in MODELS:
        MODELS[name] = EncryptedModel(name, ANOMALY_DIR if name == "anomaly" else FORECAST_DIR)
    return MODELS[name]


def anomaly_probability(raw: np.ndarray) -> float:
    """The classifier's output after decryption, as P(anomalous), whatever shape the client returns."""
    flat = raw.reshape(-1)
    p = float(flat[1]) if flat.size >= 2 else float(flat[0])
    if p < 0 or p > 1:  # a logit, not a probability
        p = float(1 / (1 + np.exp(-p)))
    return p


@app.get("/health")
def health() -> dict:
    try:
        with urllib.request.urlopen(f"{SERVER_URL}/health", timeout=5) as res:
            server_ok = res.status == 200
    except OSError:
        server_ok = False
    return {"ok": True, "server": server_ok}


@app.post("/insights")
def insights(body: InsightsRequest) -> dict:
    t0 = time.perf_counter()
    try:
        anomaly = model("anomaly")
        forecaster = model("forecast")
        scores, preview = [], ""
        for bill in body.bills:
            raw, encrypted = anomaly.run(anomaly_features(bill.amountCents, bill.category, bill.dateDays))
            scores.append(anomaly_probability(raw))
            preview = preview or encrypted[:48].hex()

        # Six monthly totals ending at the newest bill's month (computed here, on the seller's machine).
        months = [month_index(b.dateDays) for b in body.bills]
        start = max(months) - (WINDOW_MONTHS - 1)
        totals = [0] * WINDOW_MONTHS
        for b, m in zip(body.bills, months):
            if m >= start:
                totals[m - start] += b.amountCents
        next_month_of_year = (max(months) + 1) % 12 + 1
        lags = [t / 100_000 for t in totals[-FORECAST_LAGS:]]  # cents -> thousands of rupees
        raw_forecast, _ = forecaster.run(forecast_features(lags, next_month_of_year))
        forecast_cents = max(0, round(float(raw_forecast.reshape(-1)[0]) * 100_000))
    except OSError as e:
        raise HTTPException(502, f"FHE server unreachable at {SERVER_URL}: {e}") from e

    buckets = [0] * SCORE_BUCKETS
    for s in scores:
        buckets[min(int(s * SCORE_BUCKETS), SCORE_BUCKETS - 1)] += 1

    return {
        # monthStart is months since January 1970 plus one, so 0 can mean "none" on-chain.
        "monthStart": start + 1,
        "monthTotalsCents": [str(t) for t in totals],
        "forecastCents": str(forecast_cents),
        "mlAnomalyCount": sum(1 for s in scores if s >= 0.5),
        "scoreBuckets": buckets,
        # For the seller's own screen only; never stored on-chain.
        "scores": scores,
        "trace": {
            "bills": len(body.bills),
            "bytesSent": anomaly.bytes_sent + forecaster.bytes_sent,
            "bytesReceived": anomaly.bytes_received + forecaster.bytes_received,
            "seconds": round(time.perf_counter() - t0, 2),
            "ciphertextPreview": preview,
        },
    }
