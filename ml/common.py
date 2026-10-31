"""Shared by the trainer, the FHE server and the seller helper: feature layout and paths.

Category ids match web/src/lib/categories.ts: 0 Utilities, 1 Groceries/Food, 2 Medical,
3 Transport/Fuel, 4 Shopping, 5 Other.
"""

from __future__ import annotations

import datetime as dt
import os
from pathlib import Path

import numpy as np

NUM_CATEGORIES = 6
CATEGORY_LABELS = ["Utilities", "Groceries/Food", "Medical", "Transport/Fuel", "Shopping", "Other"]

ARTIFACTS = Path(os.environ.get("ML_ARTIFACTS", Path(__file__).parent / "artifacts"))
ANOMALY_DIR = ARTIFACTS / "anomaly"
FORECAST_DIR = ARTIFACTS / "forecast"
MODEL_CARD = ARTIFACTS / "model-card.json"

# Six monthly totals end at the month of the newest bill; the forecast reads the last three.
WINDOW_MONTHS = 6
FORECAST_LAGS = 3
SCORE_BUCKETS = 5


def anomaly_features(amount_cents: float, category: int, date_days: int) -> np.ndarray:
    """One bill as the anomaly model sees it: log amount, category one-hot, weekday and day of month."""
    day = dt.date(1970, 1, 1) + dt.timedelta(days=int(date_days))
    one_hot = np.zeros(NUM_CATEGORIES)
    one_hot[min(max(int(category), 0), NUM_CATEGORIES - 1)] = 1.0
    return np.concatenate(
        [[np.log1p(amount_cents / 100.0)], one_hot, [day.weekday() / 6.0, (day.day - 1) / 30.0]]
    ).astype(np.float32)


def forecast_features(last_three_thousands: list[float], next_month_of_year: int) -> np.ndarray:
    """Three previous monthly totals (in thousands of rupees) plus the target month as a point on a circle."""
    angle = 2 * np.pi * (next_month_of_year - 1) / 12
    return np.array([*last_three_thousands, np.sin(angle), np.cos(angle)], dtype=np.float32)


def month_index(date_days: int) -> int:
    """Months since January 1970 (January 1970 is 0)."""
    day = dt.date(1970, 1, 1) + dt.timedelta(days=int(date_days))
    return (day.year - 1970) * 12 + (day.month - 1)
