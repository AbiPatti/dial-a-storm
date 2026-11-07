"""Central configuration: paths, split boundaries, grid axes, and schema version.

Every constant that appears in an exported artifact is defined here once, so the Python writers,
`docs/CONTRACTS.md` and `web/lib/types.ts` have a single place to agree with.
"""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd

SCHEMA_VERSION = 1

DATA_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = DATA_DIR.parent
RAW_CSV = Path(
    os.environ.get("OMNI_CSV", REPO_ROOT / "nasa_omni_solar_wind_storms_5min_2010-2026.csv")
)
CACHE_DIR = DATA_DIR / "cache"
MODEL_DIR = CACHE_DIR / "models"
OMNI_PARQUET = CACHE_DIR / "omni_5min.parquet"
FEATURES_PARQUET = CACHE_DIR / "features_15min.parquet"
VALIDATION_REPORT = CACHE_DIR / "load_report.json"
STORMS_CACHE = CACHE_DIR / "storms.json"
WEB_DATA_DIR = Path(os.environ.get("WEB_DATA_DIR", REPO_ROOT / "web" / "public" / "data"))

# Native OMNI cadence and model cadence.
CADENCE_MIN = 5
MODEL_CADENCE_MIN = 15
SAMPLES_PER_HOUR = 60 // CADENCE_MIN

# Short-gap imputation limit (causal forward fill only).
MAX_IMPUTE_GAP_MIN = 30

# Temporal splits (inclusive calendar years).
SPLITS: dict[str, tuple[int, int]] = {
    "train": (2010, 2019),
    "val": (2020, 2022),
    "test": (2023, 2026),
}

# Out-of-sample benchmark: 10-11 May 2024 Gannon superstorm.
HOLDOUT_ID = "storm_20240510"
HOLDOUT_NAME = "Gannon Superstorm"
HOLDOUT_START = pd.Timestamp("2024-05-10 00:00")
HOLDOUT_END = pd.Timestamp("2024-05-13 23:55")

# Storm detection.
STORM_THRESHOLD_NT = -50.0
STORM_MERGE_GAP_H = 3.0
STORM_MIN_DURATION_H = 1.0
STORM_WINDOW_PAD_H = 24
TOP_N_STORMS = 8

# History needed before a window so every rolling (24 h) and lag (12 h) feature is defined.
FEATURE_HISTORY_H = 36

# Scenario grid axes (multipliers).
BZ_SOUTH_MULT = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0]
SPEED_MULT = [0.8, 0.9, 1.0, 1.1, 1.25, 1.5]
DENSITY_MULT = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0]

# NOAA G-scale approximation on SYM-H (UI mapping, also written to the manifest).
G_SCALE = [
    {"tier": "G0", "label": "Quiet", "upper_nT": None, "lower_nT": -50.0},
    {"tier": "G1-G2", "label": "Moderate", "upper_nT": -50.0, "lower_nT": -100.0},
    {"tier": "G3-G4", "label": "Strong / Severe", "upper_nT": -100.0, "lower_nT": -250.0},
    {"tier": "G5", "label": "Extreme Superstorm", "upper_nT": -250.0, "lower_nT": None},
]

# Well-known events, keyed by the UTC date of the SYM-H minimum.
KNOWN_STORM_NAMES = {
    "2015-03-17": "St. Patrick's Day Storm",
    "2015-06-23": "Summer Solstice Storm",
    "2017-09-08": "September 2017 Storm",
    "2018-08-26": "August 2018 Stealth-CME Storm",
    "2023-04-24": "April 2023 Severe Storm",
    "2024-05-11": "Gannon Superstorm",
    "2024-10-10": "October 2024 Superstorm",
    "2024-10-11": "October 2024 Superstorm",
}


def split_of(ts: pd.Timestamp) -> str:
    """Return the split name for a timestamp."""
    for name, (y0, y1) in SPLITS.items():
        if y0 <= ts.year <= y1:
            return name
    raise ValueError(f"timestamp {ts} is outside every split")


def ensure_dirs(out_dir: Path | None = None) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    target = out_dir or WEB_DATA_DIR
    (target / "storm_windows").mkdir(parents=True, exist_ok=True)
    (target / "scenario_grid").mkdir(parents=True, exist_ok=True)
