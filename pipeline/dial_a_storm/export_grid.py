"""Precompute the what-if scenario grid for the top storms and export static JSON for the web app.

For each storm and each (Bz-south, speed, density) multiplier triple on the grid:
1. Take the 5-minute drivers from 36 h before the display window to its end (the lead-in makes
   every 24 h rolling sum and 12 h lag well defined at the first displayed sample).
2. Apply the scenario with `physics.scale_drivers` (southward-only Bz scaling, Bt recomputed).
3. Rebuild the causal features with `features.build_features` and predict SYM-H with the hybrid.
4. Flag `in_range = false` when the scenario's peak coupling inside the window exceeds the
   2010-2019 training maximum. Because only negative Bz is scaled, Bs scales exactly with the Bz
   multiplier, so peak coupling = bz_mult * speed_mult * baseline peak.

Dropouts longer than 30 min survive `load.py` as NaN. For the replay only, they are forward
filled from the last valid sample (still causal) and flagged in `sw_filled`; if the lead-in
starts inside a gap, nominal quiet solar wind is used until the first observation.

Outputs
* <out>/storm_windows/{id}.json : observed series, drivers, baseline predictions
* <out>/scenario_grid/{id}.json : flat trace tensor [bz][speed][density][time], integer nT

Run: python -m dial_a_storm.export_grid
"""

from __future__ import annotations

import json
import logging
from itertools import product
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd

from . import config
from .features import DRIVER_COLUMNS, build_features
from .load import load_cached
from .physics import coupling, dynamic_pressure, scale_drivers
from .storms import iso, load_storms, write_json

log = logging.getLogger("dial_a_storm.export")

NOMINAL_SW = {"bz": 0.0, "by": 0.0, "bt": 5.0, "speed": 400.0, "density": 5.0}
AXES = {
    "bz_south_mult": config.BZ_SOUTH_MULT,
    "speed_mult": config.SPEED_MULT,
    "density_mult": config.DENSITY_MULT,
}

# predictor(drivers_5min, window_index, baseline) -> {"primary": array, optional "ridge", "xgb_only"}.
# "primary" is the shipped predictor (the hybrid in the real pipeline, Burton-OBM in fixtures).
Predictor = Callable[[pd.DataFrame, pd.DatetimeIndex, bool], dict[str, np.ndarray]]


def _ts(s: str) -> pd.Timestamp:
    return pd.Timestamp(s).tz_localize(None) if pd.Timestamp(s).tzinfo else pd.Timestamp(s)


def prepare_span(df: pd.DataFrame, storm: dict) -> tuple[pd.DataFrame, pd.DatetimeIndex, pd.DataFrame, np.ndarray]:
    """Return (filled 5-min drivers incl. lead-in, 15-min window index, observed window rows, filled mask)."""
    w0, w1 = _ts(storm["window_start"]), _ts(storm["window_end"])
    h0 = w0 - pd.Timedelta(hours=config.FEATURE_HISTORY_H)
    span = df.loc[h0:w1]
    raw = span[list(DRIVER_COLUMNS)].astype(float)
    filled = raw.ffill()  # causal: only ever copies the past forward
    for col, val in NOMINAL_SW.items():
        filled[col] = filled[col].fillna(val)
    was_filled = raw.isna().any(axis=1).to_numpy()
    idx = pd.date_range(w0, w1, freq=f"{config.MODEL_CADENCE_MIN}min")
    obs = span.loc[idx]
    filled_mask = pd.Series(was_filled, index=span.index).loc[idx].to_numpy()
    return filled, idx, obs, filled_mask


def _rounded(a: np.ndarray, nd: int) -> list:
    return [None if not np.isfinite(v) else round(float(v), nd) for v in a]


def build_documents(
    df: pd.DataFrame,
    storm: dict,
    predict: Predictor,
    train_max_coupling: float,
    source: str,
    model_kind: str,
) -> tuple[dict, dict]:
    filled, idx, obs, filled_mask = prepare_span(df, storm)
    T = len(idx)
    inside = filled.loc[idx[0] : idx[-1]]
    base_peak_c = float(np.nanmax(coupling(inside["speed"], inside["bz"])))

    nb, nv, nn = (len(a) for a in AXES.values())
    traces = np.empty((nb, nv, nn, T), dtype=float)
    peak_c = np.empty((nb, nv, nn))
    baseline: dict[str, np.ndarray] = {}
    for (ib, mb), (iv, mv), (in_, mn) in product(*(enumerate(a) for a in AXES.values())):
        scen = scale_drivers(filled, mb, mv, mn)
        is_base = mb == 1.0 and mv == 1.0 and mn == 1.0
        out = predict(scen, idx, is_base)
        pred = np.asarray(out["primary"], dtype=float)
        if pred.shape != (T,) or not np.all(np.isfinite(pred)):
            raise RuntimeError(f"{storm['id']}: non-finite prediction at ({mb},{mv},{mn})")
        traces[ib, iv, in_] = pred
        sc = scen.loc[idx[0] : idx[-1]]
        peak_c[ib, iv, in_] = float(np.nanmax(coupling(sc["speed"], sc["bz"])))
        if is_base:
            baseline = out
    in_range = peak_c <= train_max_coupling

    traces_int = np.rint(traces).astype(int)
    obs_sym = obs["sym_h"].to_numpy(float)
    y = obs_sym
    base_primary = np.asarray(baseline["primary"], dtype=float)
    ok = np.isfinite(y)
    storm_metrics = {
        "rmse": round(float(np.sqrt(np.mean((y[ok] - base_primary[ok]) ** 2))), 2),
        "observed_peak_nT": round(float(np.nanmin(y)), 1),
        "predicted_peak_nT": round(float(base_primary.min()), 1),
    }

    window = {
        "schema_version": config.SCHEMA_VERSION,
        "source": source,
        "id": storm["id"],
        "name": storm["name"],
        "model_kind": model_kind,
        "cadence_minutes": config.MODEL_CADENCE_MIN,
        "t0": iso(idx[0]),
        "n_times": T,
        "storm_start": storm["start"],
        "storm_end": storm["end"],
        "peak_time": storm["peak_time"],
        "series": {
            "sym_h_observed": _rounded(obs_sym, 1),
            "bz": _rounded(obs["bz"].to_numpy(float), 2),
            "by": _rounded(obs["by"].to_numpy(float), 2),
            "bt": _rounded(obs["bt"].to_numpy(float), 2),
            "speed": _rounded(obs["speed"].to_numpy(float), 1),
            "density": _rounded(obs["density"].to_numpy(float), 2),
            "pdyn": _rounded(dynamic_pressure(obs["density"].to_numpy(float), obs["speed"].to_numpy(float)), 3),
            "coupling": _rounded(coupling(obs["speed"].to_numpy(float), obs["bz"].to_numpy(float)), 3),
        },
        "sw_filled": filled_mask.astype(int).tolist(),
        "predictions": {
            "primary": _rounded(base_primary, 1),
            "ridge": _rounded(np.asarray(baseline["ridge"]), 1) if "ridge" in baseline else None,
            "xgb_only": _rounded(np.asarray(baseline["xgb_only"]), 1) if "xgb_only" in baseline else None,
        },
        "metrics": storm_metrics,
    }
    grid = {
        "schema_version": config.SCHEMA_VERSION,
        "source": source,
        "id": storm["id"],
        "model_kind": model_kind,
        "cadence_minutes": config.MODEL_CADENCE_MIN,
        "t0": iso(idx[0]),
        "n_times": T,
        "axes": AXES,
        "order": ["bz_south_mult", "speed_mult", "density_mult", "time"],
        "units": "nT",
        "traces": traces_int.ravel().tolist(),
        "in_range": in_range.ravel().tolist(),
        "peak_coupling_mV_m": np.round(peak_c, 3).ravel().tolist(),
        "baseline_peak_coupling_mV_m": round(base_peak_c, 3),
        "train_max_coupling_mV_m": round(train_max_coupling, 3),
        "min_value": int(traces_int.min()),
        "max_value": int(traces_int.max()),
    }
    return window, grid


def hybrid_predictor() -> Predictor:
    from .model import HybridModel

    model = HybridModel.load()

    def predict(drivers: pd.DataFrame, idx: pd.DatetimeIndex, baseline: bool) -> dict[str, np.ndarray]:
        X = build_features(drivers).loc[idx]
        out = model.predict(X, with_xgb_only=baseline)
        result = {"primary": out["hybrid"]}
        if baseline:
            result["ridge"] = out["ridge"]
            if "xgb_only" in out:
                result["xgb_only"] = out["xgb_only"]
        return result

    return predict


def export_all(
    out_dir: Path,
    predict: Predictor,
    train_max_coupling: float,
    source: str,
    model_kind: str,
    df: pd.DataFrame | None = None,
    storms: list[dict] | None = None,
) -> None:
    config.ensure_dirs(out_dir)
    df = load_cached() if df is None else df
    storms = load_storms() if storms is None else storms
    for storm in storms:
        window, grid = build_documents(df, storm, predict, train_max_coupling, source, model_kind)
        write_json(out_dir / "storm_windows" / f"{storm['id']}.json", window, compact=True)
        write_json(out_dir / "scenario_grid" / f"{storm['id']}.json", grid, compact=True)
        n_out = len(grid["in_range"]) - sum(grid["in_range"])
        log.info(
            "%s: %d samples, baseline peak %.0f nT (obs %.0f), grid range [%d, %d] nT, %d/%d points beyond training",
            storm["id"], grid["n_times"], window["metrics"]["predicted_peak_nT"], window["metrics"]["observed_peak_nT"],
            grid["min_value"], grid["max_value"], n_out, len(grid["in_range"]),
        )


def run(out_dir: Path | None = None) -> None:
    out_dir = out_dir or config.WEB_DATA_DIR
    meta = json.loads((config.MODEL_DIR / "meta.json").read_text())
    export_all(out_dir, hybrid_predictor(), meta["coupling"]["train_max_mV_m"], "PIPELINE", "hybrid_ridge_xgb")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    run()
