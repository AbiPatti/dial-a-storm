"""Causal feature engineering on a 15-minute subsample.

Every feature at time t is a function of solar-wind drivers at times <= t only:

* `build_features` first projects the input onto DRIVER_COLUMNS (bz, by, bt, speed, density).
  Earth-response columns (SYM-H, AE, AL, PCN, proton flux) are dropped before any arithmetic, so
  they cannot leak in, whatever the caller passes.
* Rolling coupling integrals use trailing windows on the native 5-minute grid
  (`rolling(w)` is right-aligned in pandas: the window is (t - w, t]).
* Lags use `shift(k)` with k > 0 on the 15-minute subsample. Every lag is a multiple of 15 min, so
  the value at t - lag is itself a 15-minute sample and the shift is exact.
* The continuous southward duration is a running count that resets on the first non-southward
  sample, computed with a forward cumulative max (past only).

Units: coupling c = v * Bs * 1e-3 in mV/m; integrals in mV/m * h; durations in hours.

Run: python -m src.features   (writes data/cache/features_15min.parquet)
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from . import config
from .physics import coupling, dynamic_pressure, southward_bz

log = logging.getLogger("dial_a_storm.features")

DRIVER_COLUMNS: tuple[str, ...] = ("bz", "by", "bt", "speed", "density")
BANNED_COLUMNS: frozenset[str] = frozenset({"sym_h", "ae", "al", "pcn", "proton_flux"})

LAG_VARS: tuple[str, ...] = ("bs", "speed", "density", "pdyn", "by", "bt")
LAG_MINUTES: tuple[int, ...] = (15, 30, 45, 60, 120, 240, 360, 720)
ROLL_HOURS: tuple[int, ...] = (1, 3, 6, 12, 24)
SOUTHWARD_CAP_H = 12.0

ROLL_FEATURES = [f"coupling_int_{h}h" for h in ROLL_HOURS]
LAG_FEATURES = [f"{v}_lag{m}m" for v in LAG_VARS for m in LAG_MINUTES]
INSTANT_FEATURES = list(LAG_VARS) + ["coupling", "sqrt_pdyn", "southward_hours"]
FEATURE_COLUMNS: list[str] = INSTANT_FEATURES + ROLL_FEATURES + LAG_FEATURES

# Ridge backbone: integrated coupling sums (linear in c, so they extrapolate) plus the Burton
# pressure-correction term sqrt(Pdyn).
RIDGE_FEATURES: list[str] = ROLL_FEATURES + ["sqrt_pdyn"]

MAX_LOOKBACK_H = max(max(ROLL_HOURS), max(LAG_MINUTES) / 60)


def _assert_regular(index: pd.DatetimeIndex, minutes: int) -> None:
    if not isinstance(index, pd.DatetimeIndex):
        raise TypeError("driver frame must have a DatetimeIndex")
    if len(index) < 2:
        return
    step = pd.Timedelta(minutes=minutes).value
    if not np.all(np.diff(index.asi8) == step):
        raise ValueError(f"driver index must be a regular {minutes}-minute grid")


def southward_duration_hours(bz: np.ndarray, cadence_min: int = config.CADENCE_MIN) -> np.ndarray:
    """Consecutive time with Bz < 0 up to and including each sample, capped at 12 h.

    NaN Bz is treated as not southward and resets the run.
    """
    south = np.asarray(bz, dtype=float) < 0
    idx = np.arange(south.size)
    last_reset = np.maximum.accumulate(np.where(south, -1, idx))
    run_samples = np.where(south, idx - last_reset, 0)
    return np.minimum(run_samples * cadence_min / 60.0, SOUTHWARD_CAP_H)


def model_grid_mask(index: pd.DatetimeIndex) -> np.ndarray:
    return (index.minute % config.MODEL_CADENCE_MIN == 0) & (index.second == 0)


def build_features(sw: pd.DataFrame, subsample: bool = True) -> pd.DataFrame:
    """Build the causal feature matrix from a regular 5-minute driver frame.

    Parameters
    ----------
    sw : DataFrame indexed by a regular 5-min DatetimeIndex. Must contain DRIVER_COLUMNS; any
         other column (including banned responses) is ignored.
    subsample : if True, return rows on the 15-minute model grid only.
    """
    missing = [c for c in DRIVER_COLUMNS if c not in sw.columns]
    if missing:
        raise KeyError(f"driver frame missing columns {missing}")
    sw = sw.loc[:, list(DRIVER_COLUMNS)].astype(float)  # hard projection: responses never enter
    _assert_regular(sw.index, config.CADENCE_MIN)

    bz = sw["bz"]
    base = pd.DataFrame(index=sw.index)
    base["bs"] = southward_bz(bz)
    base["speed"] = sw["speed"]
    base["density"] = sw["density"]
    base["pdyn"] = dynamic_pressure(sw["density"], sw["speed"])
    base["by"] = sw["by"]
    base["bt"] = sw["bt"]
    base["coupling"] = coupling(sw["speed"], bz)
    base["sqrt_pdyn"] = np.sqrt(base["pdyn"])
    base["southward_hours"] = southward_duration_hours(bz.to_numpy())

    sph = config.SAMPLES_PER_HOUR
    for h in ROLL_HOURS:
        w = h * sph
        # Trailing mean x hours = time integral; tolerates up to 50% missing samples in the window.
        base[f"coupling_int_{h}h"] = base["coupling"].rolling(w, min_periods=w // 2).mean() * h

    if subsample:
        frame = base.loc[model_grid_mask(base.index)]
        _assert_regular(frame.index, config.MODEL_CADENCE_MIN)
        step_min = config.MODEL_CADENCE_MIN
    else:
        frame = base
        step_min = config.CADENCE_MIN

    lagged = {}
    for v in LAG_VARS:
        col = frame[v]
        for m in LAG_MINUTES:
            k = m // step_min
            assert k > 0 and k * step_min == m, "lags must be positive multiples of the cadence"
            lagged[f"{v}_lag{m}m"] = col.shift(k)
    out = pd.concat([frame, pd.DataFrame(lagged, index=frame.index)], axis=1)
    return out[FEATURE_COLUMNS].astype(np.float32)


def run() -> pd.DataFrame:
    from .load import load_cached

    df = load_cached()
    feats = build_features(df)
    feats["sym_h"] = df.loc[feats.index, "sym_h"].astype(np.float32)
    feats["sw_imputed"] = df.loc[feats.index, "sw_imputed"].astype(np.int8)
    years = feats.index.year
    split = np.full(len(feats), "", dtype=object)
    for name, (y0, y1) in config.SPLITS.items():
        split[(years >= y0) & (years <= y1)] = name
    feats["split"] = pd.Categorical(split, categories=list(config.SPLITS))
    feats.to_parquet(config.FEATURES_PARQUET, engine="pyarrow", compression="zstd")
    log.info("wrote %s: %d rows x %d features", config.FEATURES_PARQUET, len(feats), len(FEATURE_COLUMNS))
    return feats


def load_cached() -> pd.DataFrame:
    if not config.FEATURES_PARQUET.exists():
        return run()
    return pd.read_parquet(config.FEATURES_PARQUET)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    run()
