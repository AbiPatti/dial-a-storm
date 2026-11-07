"""Generate the FIXTURE artifacts shipped in web/public/data/ so the app runs before the ML pipeline.

The fixtures follow the exact schema of the real export (docs/CONTRACTS.md) and use real OMNI
observations: real storms, real observed SYM-H, real drivers. Only the predictor differs. Instead of
the trained hybrid it uses the physics-based Burton / O'Brien & McPherron (2000) ring-current
model driven by the same scaled solar wind:

    dDst*/dt = Q(VBs) - Dst*/tau
    Q   = -4.4 (VBs - 0.49) nT/h  for VBs > 0.49 mV/m, else 0
    tau = 2.4 exp(9.74 / (4.69 + VBs)) h
    Dst = Dst* + 7.26 sqrt(Pdyn) - 11

The model is integrated causally at 5-minute steps with the exact exponential update, starting
from Dst* = 0 at the beginning of each 36 h lead-in. Every file is labelled "source": "FIXTURE".
Running `python -m src.pipeline` overwrites them with the ML artifacts.

Run: python -m src.make_fixtures
"""

from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from . import config
from .export_grid import export_all
from .features import model_grid_mask
from .load import load_cached
from .model import metrics, train_max_coupling
from .physics import coupling, dynamic_pressure
from .storms import build_records, storms_document, write_json

log = logging.getLogger("dial_a_storm.fixtures")
DT_H = config.CADENCE_MIN / 60.0


def burton(speed: np.ndarray, bz: np.ndarray, density: np.ndarray) -> np.ndarray:
    """Integrate the Burton-OBM model on gap-free 5-min arrays. Returns Dst (nT)."""
    vbs = np.asarray(coupling(speed, bz), dtype=float)
    sqrt_p = np.sqrt(np.asarray(dynamic_pressure(density, speed), dtype=float))
    out = np.empty(vbs.size)
    dst_star = 0.0
    for k in range(vbs.size):
        e = vbs[k]
        q = -4.4 * (e - 0.49) if e > 0.49 else 0.0
        tau = 2.4 * math.exp(9.74 / (4.69 + e))
        decay = math.exp(-DT_H / tau)
        dst_star = dst_star * decay + q * tau * (1.0 - decay)
        out[k] = dst_star + 7.26 * sqrt_p[k] - 11.0
    return out


def burton_predictor(drivers: pd.DataFrame, idx: pd.DatetimeIndex, baseline: bool) -> dict[str, np.ndarray]:
    dst = burton(drivers["speed"].to_numpy(float), drivers["bz"].to_numpy(float), drivers["density"].to_numpy(float))
    return {"primary": pd.Series(dst, index=drivers.index).loc[idx].to_numpy()}


def full_series_burton(df: pd.DataFrame) -> pd.Series:
    """Burton over the whole record for split metrics. Gaps: causal forward fill (as in the replay)."""
    d = df[["speed", "bz", "density"]].astype(float).ffill().fillna({"speed": 400.0, "bz": 0.0, "density": 5.0})
    return pd.Series(burton(d["speed"].to_numpy(), d["bz"].to_numpy(), d["density"].to_numpy()), index=df.index)


def peak(s: pd.Series) -> tuple[float | None, str | None]:
    s = s.dropna()
    if s.empty:
        return None, None
    return round(float(s.min()), 1), s.idxmin().strftime("%Y-%m-%dT%H:%M:%SZ")


def run(out_dir: Path | None = None) -> None:
    out_dir = out_dir or config.WEB_DATA_DIR
    config.ensure_dirs(out_dir)
    df = load_cached()
    records = build_records(df)
    write_json(out_dir / "storms.json", storms_document(records, "FIXTURE"))

    cmax = train_max_coupling()
    pred = full_series_burton(df)
    grid = model_grid_mask(df.index)
    y = df.loc[grid, "sym_h"].astype(float)
    p = pred.loc[grid]
    years = y.index.year
    hold = next(r for r in records if r["holdout"])
    h0, h1 = pd.Timestamp(hold["window_start"][:-1]), pd.Timestamp(hold["window_end"][:-1])
    in_hold = (y.index >= h0) & (y.index <= h1)
    report = {}
    for name, (a, b) in config.SPLITS.items():
        m = (years >= a) & (years <= b)
        report[name] = {"burton": metrics(y[m].to_numpy(), p[m].to_numpy())}
    tm = (years >= config.SPLITS["test"][0]) & ~in_hold
    report["test_excl_holdout"] = {"burton": metrics(y[tm].to_numpy(), p[tm].to_numpy())}
    obs_peak, obs_time = peak(y[in_hold])
    b_peak, b_time = peak(p[in_hold])

    manifest = {
        "schema_version": config.SCHEMA_VERSION,
        "source": "FIXTURE",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model": {
            "kind": "burton_fixture",
            "description": "FIXTURE stand-in: Burton / O'Brien-McPherron (2000) physics model on real OMNI drivers. Run the Python pipeline to replace it with the Ridge + XGBoost hybrid.",
            "cadence_minutes": config.MODEL_CADENCE_MIN,
            "target": "sym_h",
            "features": ["coupling", "sqrt_pdyn"],
            "banned_inputs": ["ae", "al", "pcn", "proton_flux", "sym_h"],
            "ridge": None,
            "xgb": None,
            "train_seconds": 0.0,
        },
        "splits": {
            name: {"start_year": a, "end_year": b, "rows": int(((years >= a) & (years <= b)).sum())}
            for name, (a, b) in config.SPLITS.items()
        },
        "metrics": report,
        "holdout": {
            "id": hold["id"],
            "name": hold["name"],
            "window_start": hold["window_start"],
            "window_end": hold["window_end"],
            "observed_peak_nT": obs_peak,
            "observed_peak_time": obs_time,
            "predicted_peak_nT": {"burton": b_peak},
            "predicted_peak_time": {"burton": b_time},
            "metrics": {"burton": metrics(y[in_hold].to_numpy(), p[in_hold].to_numpy())},
        },
        "coupling": cmax,
        "grid": {
            "bz_south_mult": config.BZ_SOUTH_MULT,
            "speed_mult": config.SPEED_MULT,
            "density_mult": config.DENSITY_MULT,
        },
        "g_scale": config.G_SCALE,
        "files": {
            "storms": "storms.json",
            "storm_windows": "storm_windows/{id}.json",
            "scenario_grid": "scenario_grid/{id}.json",
        },
        "data": {
            "source_csv": config.RAW_CSV.name,
            "rows_5min": int(len(df)),
            "imputation": f"causal forward fill, limit {config.MAX_IMPUTE_GAP_MIN} min",
            "citation": "NASA/GSFC OMNI 5-min data via OMNIWeb/CDAWeb (King & Papitashvili 2005, JGR 110, A02104).",
        },
    }
    write_json(out_dir / "manifest.json", manifest)
    export_all(out_dir, burton_predictor, cmax["train_max_mV_m"], "FIXTURE", "burton_fixture", df=df, storms=records)
    log.info("FIXTURE artifacts written to %s", out_dir)
    log.info("Burton on Gannon: observed %s nT, predicted %s nT", obs_peak, b_peak)
    log.info("Burton metrics: %s", json.dumps({k: v["burton"].get("rmse") for k, v in report.items()}))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    run()
