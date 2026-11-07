"""Ingest the raw NASA OMNI 5-minute CSV into a validated, cached Parquet file.

Steps
1. Parse and rename columns to short canonical names.
2. Verify the 5-minute cadence: sorted, unique timestamps; reindex onto a complete regular grid
   and report how many rows were missing.
3. Replace OMNI fill values and physically impossible readings with NaN.
4. Impute short gaps causally: forward fill with a 30-minute (6-sample) staleness limit. At time t
   the filled value and the decision to fill both depend only on data at or before t, which is how
   an operational real-time system would treat a dropout. Longer dropouts stay NaN after 30 min.
   The response variable SYM-H is never imputed.
5. Validate physical relationships against OMNI's own derived columns:
   * Pdyn = 1.6726e-6 n v^2 vs OMNI flow pressure (OMNI uses 2e-6 n v^2 to include ~4% alphas,
     so the expected ratio OMNI / ours is 2 / 1.6726 = 1.196).
   * Signed Ey = -v Bz 1e-3 vs OMNI electric field; rectified Ey = v Bs 1e-3.
6. Write `data/cache/omni_5min.parquet` and a JSON validation report.

Run: python -m src.load
"""

from __future__ import annotations

import json
import logging
import time

import numpy as np
import pandas as pd

from . import config
from .physics import coupling, dynamic_pressure

log = logging.getLogger("dial_a_storm.load")

COLUMN_MAP = {
    "datetime_utc": "time",
    "bt_nT": "bt",
    "bz_gsm_nT": "bz",
    "by_gsm_nT": "by",
    "speed_km_s": "speed",
    "density_cm3": "density",
    "temp_K": "temp",
    "pressure_nPa": "pressure_omni",
    "efield_mV_m": "efield_omni",
    "ae_nT": "ae",
    "al_nT": "al",
    "sym_h_nT": "sym_h",
    "pcn": "pcn",
    "proton_flux_10mev": "proton_flux",
}

# Solar-wind drivers that may be imputed and used as model inputs.
IMPUTED_COLUMNS = ["bt", "bz", "by", "speed", "density"]

# Physical validity bounds (inclusive). Anything outside, including OMNI fill values such as
# 9999.99 / 99999.9, becomes NaN.
BOUNDS: dict[str, tuple[float, float]] = {
    "bt": (0.0, 200.0),
    "bz": (-200.0, 200.0),
    "by": (-200.0, 200.0),
    "speed": (150.0, 3000.0),
    "density": (0.01, 300.0),
    "temp": (1e3, 1e8),
    "pressure_omni": (0.0, 500.0),
    "efield_omni": (-200.0, 200.0),
    "ae": (0.0, 5000.0),
    "al": (-5000.0, 500.0),
    "sym_h": (-1500.0, 500.0),
    "pcn": (-20.0, 40.0),
    "proton_flux": (0.0, 1e6),
}


def read_raw(path=config.RAW_CSV) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"OMNI CSV not found at {path}. Set OMNI_CSV to override.")
    df = pd.read_csv(path, na_values=["", " ", "NaN"], low_memory=False)
    missing = set(COLUMN_MAP) - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing expected columns: {sorted(missing)}")
    df = df.rename(columns=COLUMN_MAP)[list(COLUMN_MAP.values())]
    df["time"] = pd.to_datetime(df["time"], format="%Y-%m-%d %H:%M", utc=False)
    return df


def to_regular_grid(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Sort, de-duplicate and reindex onto a complete 5-minute grid."""
    n_raw = len(df)
    df = df.sort_values("time")
    dupes = int(df["time"].duplicated().sum())
    df = df.drop_duplicates("time", keep="first").set_index("time")
    step = pd.Timedelta(minutes=config.CADENCE_MIN)
    off_grid = int(((df.index - df.index[0]) % step != pd.Timedelta(0)).sum())
    if off_grid:
        raise ValueError(f"{off_grid} timestamps are not on the {config.CADENCE_MIN}-min grid")
    full = pd.date_range(df.index[0], df.index[-1], freq=f"{config.CADENCE_MIN}min", name="time")
    inserted = len(full) - len(df)
    df = df.reindex(full)
    diffs = np.diff(df.index.asi8)
    assert np.all(diffs == step.value), "index is not regular after reindex"
    return df, {
        "rows_raw": n_raw,
        "duplicates_dropped": dupes,
        "rows_inserted_to_regularise": int(inserted),
        "rows_final": len(df),
        "start": str(df.index[0]),
        "end": str(df.index[-1]),
    }


def apply_bounds(df: pd.DataFrame) -> dict[str, int]:
    removed = {}
    for col, (lo, hi) in BOUNDS.items():
        bad = df[col].notna() & ~df[col].between(lo, hi)
        removed[col] = int(bad.sum())
        df.loc[bad, col] = np.nan
    return removed


def causal_fill_short_gaps(s: pd.Series, max_samples: int) -> tuple[pd.Series, pd.Series]:
    """Forward fill with a staleness limit. Returns (filled, was_imputed_mask).

    Uses only values from the past: `ffill(limit=k)` copies the last valid observation into at
    most k subsequent missing slots. Never back-fills.
    """
    filled = s.ffill(limit=max_samples)
    imputed = s.isna() & filled.notna()
    return filled, imputed


def impute(df: pd.DataFrame) -> dict[str, int]:
    k = config.MAX_IMPUTE_GAP_MIN // config.CADENCE_MIN
    any_imputed = pd.Series(False, index=df.index)
    counts = {}
    for col in IMPUTED_COLUMNS:
        df[col], mask = causal_fill_short_gaps(df[col], k)
        counts[col] = int(mask.sum())
        any_imputed |= mask
    df["sw_imputed"] = any_imputed.astype(np.int8)
    return counts


def validate_physics(df: pd.DataFrame, strict: bool = True) -> dict:
    """Cross-check our physics conventions against OMNI's derived columns."""
    p_ours = dynamic_pressure(df["density"], df["speed"])
    ok_p = p_ours.notna() & df["pressure_omni"].notna() & (p_ours > 0.05)
    ratio = (df.loc[ok_p, "pressure_omni"] / p_ours[ok_p]).median()
    corr_p = np.corrcoef(df.loc[ok_p, "pressure_omni"], p_ours[ok_p])[0, 1]

    e_signed = -df["speed"] * df["bz"] * 1e-3
    ok_e = e_signed.notna() & df["efield_omni"].notna()
    e_err = (df.loc[ok_e, "efield_omni"] - e_signed[ok_e]).abs()
    corr_e = np.corrcoef(df.loc[ok_e, "efield_omni"], e_signed[ok_e])[0, 1]

    ey = coupling(df["speed"], df["bz"])
    rect_ok = bool((ey.dropna() >= 0).all())

    b_perp = np.sqrt(df["by"] ** 2 + df["bz"] ** 2)
    ok_b = b_perp.notna() & df["bt"].notna()
    bt_violation = float((df.loc[ok_b, "bt"] + 0.5 < b_perp[ok_b]).mean())

    report = {
        "pdyn_ratio_omni_over_ours_median": round(float(ratio), 4),
        "pdyn_ratio_expected": round(2.0 / 1.6726, 4),
        "pdyn_correlation": round(float(corr_p), 5),
        "efield_signed_median_abs_err_mV_m": round(float(e_err.median()), 4),
        "efield_signed_p99_abs_err_mV_m": round(float(e_err.quantile(0.99)), 4),
        "efield_correlation": round(float(corr_e), 5),
        "ey_rectified_nonnegative": rect_ok,
        "bt_below_transverse_fraction": round(bt_violation, 6),
    }
    checks = {
        "pdyn ratio within 5% of 1.196": abs(ratio - 2.0 / 1.6726) / (2.0 / 1.6726) < 0.05,
        "pdyn correlation > 0.99": corr_p > 0.99,
        "efield correlation > 0.99": corr_e > 0.99,
        "efield median error < 0.05 mV/m": e_err.median() < 0.05,
        "rectified Ey >= 0": rect_ok,
        "Bt >= |B_perp| for > 99% of rows": bt_violation < 0.01,
    }
    report["checks"] = {k: bool(v) for k, v in checks.items()}
    failed = [k for k, v in checks.items() if not v]
    if failed:
        msg = f"physics validation failed: {failed}"
        if strict:
            raise ValueError(msg)
        log.warning(msg)
    return report


def coverage(df: pd.DataFrame) -> dict[str, float]:
    return {c: round(float(df[c].notna().mean()), 4) for c in COLUMN_MAP.values() if c != "time"}


def run(strict: bool = True) -> pd.DataFrame:
    config.ensure_dirs()
    t0 = time.time()
    raw = read_raw()
    df, grid_report = to_regular_grid(raw)
    bounds_report = apply_bounds(df)
    impute_report = impute(df)
    physics_report = validate_physics(df, strict=strict)
    df = df.astype({c: np.float32 for c in df.columns if c != "sw_imputed"})
    df.to_parquet(config.OMNI_PARQUET, engine="pyarrow", compression="zstd")
    report = {
        "source_csv": config.RAW_CSV.name,
        "grid": grid_report,
        "out_of_bounds_set_nan": bounds_report,
        "imputed_samples": impute_report,
        "imputation": f"causal forward fill, limit {config.MAX_IMPUTE_GAP_MIN} min",
        "coverage_after_imputation": coverage(df),
        "physics": physics_report,
        "seconds": round(time.time() - t0, 1),
    }
    config.VALIDATION_REPORT.write_text(json.dumps(report, indent=2))
    log.info("wrote %s (%d rows) in %.1fs", config.OMNI_PARQUET, len(df), report["seconds"])
    log.info("physics checks: %s", physics_report["checks"])
    return df


def load_cached() -> pd.DataFrame:
    """Load the cached Parquet, building it first if needed."""
    if not config.OMNI_PARQUET.exists():
        return run()
    return pd.read_parquet(config.OMNI_PARQUET)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    run()
