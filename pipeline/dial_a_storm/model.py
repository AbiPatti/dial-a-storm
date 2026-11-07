"""Two-stage hybrid surrogate for SYM-H: Ridge backbone + XGBoost on the Ridge residuals.

Why hybrid: tree ensembles predict piecewise-constant values bounded by the training targets, so a
pure XGBoost model trained on 2010-2019 (deepest storm about -234 nT) cannot predict a -497 nT
storm. The Ridge backbone is linear in the integrated coupling sums, so a stronger driver gives a
proportionally deeper prediction. XGBoost then models the bounded, non-linear residual structure
(pressure effects, IMF orientation, saturation).

Splits: train 2010-2019, validate 2020-2022 (Ridge alpha selection, XGBoost early stopping), test
2023-2026. The Gannon storm window lies inside the test years and is reported separately.

Outputs
* pipeline/data/cache/models/{ridge.json, xgb_residual.json, xgb_only.json, meta.json}
* <out_dir>/manifest.json

Run: python -m dial_a_storm.model
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.preprocessing import StandardScaler

from . import config
from .features import BANNED_COLUMNS, FEATURE_COLUMNS, RIDGE_FEATURES
from .features import load_cached as load_features
from .physics import coupling

log = logging.getLogger("dial_a_storm.model")

RIDGE_ALPHAS = [0.01, 0.1, 1.0, 10.0, 100.0, 1000.0]
XGB_PARAMS = {
    "n_estimators": 3000,
    "learning_rate": 0.03,
    "max_depth": 7,
    "min_child_weight": 10,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_lambda": 1.0,
    "tree_method": "hist",
    "eval_metric": "rmse",
    "early_stopping_rounds": 100,
    "random_state": 42,
    "n_jobs": -1,
}
MODEL_NAMES = ("hybrid", "ridge", "xgb_only")


def linear(X: pd.DataFrame, coef: np.ndarray, intercept: float) -> np.ndarray:
    """Ridge prediction; NaN where any Ridge feature is missing (no warnings from NaN matmul)."""
    arr = X[RIDGE_FEATURES].to_numpy(dtype=float)
    ok = np.isfinite(arr).all(axis=1)
    out = np.full(len(arr), np.nan)
    # Row-wise sum instead of BLAS matmul: Accelerate on Apple silicon raises spurious FP warnings.
    out[ok] = (arr[ok] * coef).sum(axis=1) + intercept
    return out


class HybridModel:
    """Loaded hybrid model. `predict` returns component predictions for a feature frame."""

    def __init__(self, coef: np.ndarray, intercept: float, resid: xgb.XGBRegressor, xgb_only: xgb.XGBRegressor | None):
        self.coef = np.asarray(coef, dtype=float)
        self.intercept = float(intercept)
        self.resid = resid
        self.xgb_only = xgb_only

    def ridge(self, X: pd.DataFrame) -> np.ndarray:
        return linear(X, self.coef, self.intercept)

    def predict(self, X: pd.DataFrame, with_xgb_only: bool = False) -> dict[str, np.ndarray]:
        X = X[FEATURE_COLUMNS]
        r = self.ridge(X)
        out = {"ridge": r, "hybrid": r + self.resid.predict(X)}
        if with_xgb_only and self.xgb_only is not None:
            out["xgb_only"] = self.xgb_only.predict(X).astype(float)
        return out

    @classmethod
    def load(cls, model_dir: Path = config.MODEL_DIR) -> "HybridModel":
        ridge = json.loads((model_dir / "ridge.json").read_text())
        if ridge["features"] != RIDGE_FEATURES:
            raise ValueError("ridge.json feature order does not match RIDGE_FEATURES")
        resid = xgb.XGBRegressor()
        resid.load_model(model_dir / "xgb_residual.json")
        only = None
        if (model_dir / "xgb_only.json").exists():
            only = xgb.XGBRegressor()
            only.load_model(model_dir / "xgb_only.json")
        return cls(np.array(ridge["coef"]), ridge["intercept"], resid, only)


def metrics(y: np.ndarray, yhat: np.ndarray) -> dict:
    ok = np.isfinite(y) & np.isfinite(yhat)
    y, yhat = y[ok], yhat[ok]
    if y.size == 0:
        return {"n": 0}
    storm = y < config.STORM_THRESHOLD_NT
    out = {
        "n": int(y.size),
        "rmse": round(float(np.sqrt(np.mean((y - yhat) ** 2))), 3),
        "mae": round(float(mean_absolute_error(y, yhat)), 3),
        "r2": round(float(r2_score(y, yhat)), 4),
        "bias": round(float(np.mean(yhat - y)), 3),
        "storm_n": int(storm.sum()),
        "storm_rmse": round(float(np.sqrt(np.mean((y[storm] - yhat[storm]) ** 2))), 3) if storm.any() else None,
    }
    return out


def fit_ridge(train: pd.DataFrame, val: pd.DataFrame) -> tuple[np.ndarray, float, float, dict]:
    def rows(f):
        ok = f[RIDGE_FEATURES].notna().all(axis=1) & f["sym_h"].notna()
        return f.loc[ok, RIDGE_FEATURES].to_numpy(float), f.loc[ok, "sym_h"].to_numpy(float)

    Xtr, ytr = rows(train)
    Xva, yva = rows(val)
    scaler = StandardScaler().fit(Xtr)
    Ztr, Zva = scaler.transform(Xtr), scaler.transform(Xva)
    scores = {}
    best = None
    for a in RIDGE_ALPHAS:
        m = Ridge(alpha=a).fit(Ztr, ytr)
        rmse = float(np.sqrt(np.mean((m.predict(Zva) - yva) ** 2)))
        scores[str(a)] = round(rmse, 4)
        if best is None or rmse < best[0]:
            best = (rmse, a, m)
    _, alpha, m = best
    coef = m.coef_ / scaler.scale_
    intercept = float(m.intercept_ - np.sum(m.coef_ * scaler.mean_ / scaler.scale_))
    log.info("ridge alpha=%s val RMSE by alpha %s", alpha, scores)
    return coef, intercept, alpha, scores


def fit_xgb(Xtr, ytr, Xva, yva) -> xgb.XGBRegressor:
    model = xgb.XGBRegressor(**XGB_PARAMS)
    model.fit(Xtr, ytr, eval_set=[(Xva, yva)], verbose=False)
    log.info("xgboost best_iteration=%s best_score=%.3f", model.best_iteration, model.best_score)
    return model


def holdout_bounds() -> tuple[pd.Timestamp, pd.Timestamp]:
    """Gannon evaluation window: the storm's +/-24 h display window when known."""
    if config.STORMS_CACHE.exists():
        for s in json.loads(config.STORMS_CACHE.read_text())["storms"]:
            if s["holdout"]:
                return (pd.Timestamp(s["window_start"]).tz_localize(None), pd.Timestamp(s["window_end"]).tz_localize(None))
    return config.HOLDOUT_START, config.HOLDOUT_END


def train_max_coupling() -> dict:
    """Peak instantaneous coupling (5-min cadence) over the training years."""
    from .load import load_cached

    df = load_cached()
    y0, y1 = config.SPLITS["train"]
    tr = df[(df.index.year >= y0) & (df.index.year <= y1)]
    c = coupling(tr["speed"].astype(float), tr["bz"].astype(float))
    return {
        "train_max_mV_m": round(float(np.nanmax(c)), 3),
        "train_p999_mV_m": round(float(np.nanquantile(c, 0.999)), 3),
        "train_max_time": tr.index[int(np.nanargmax(c.to_numpy()))].strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def peak(series: pd.Series) -> tuple[float | None, str | None]:
    s = series.dropna()
    if s.empty:
        return None, None
    t = s.idxmin()
    return round(float(s.min()), 1), t.strftime("%Y-%m-%dT%H:%M:%SZ")


def train(out_dir: Path | None = None) -> dict:
    out_dir = out_dir or config.WEB_DATA_DIR
    config.ensure_dirs(out_dir)
    t_start = time.time()
    feats = load_features()
    assert not (set(FEATURE_COLUMNS) & BANNED_COLUMNS), "banned response column in feature list"

    train_f = feats[feats["split"] == "train"]
    val_f = feats[feats["split"] == "val"]
    test_f = feats[feats["split"] == "test"]
    h0, h1 = holdout_bounds()
    for name, part in (("train", train_f), ("val", val_f)):
        if ((part.index >= h0) & (part.index <= h1)).any():
            raise RuntimeError(f"holdout window leaked into {name} split")

    # Stage 1: Ridge backbone.
    coef, intercept, alpha, alpha_scores = fit_ridge(train_f, val_f)

    def ridge_pred(f):
        return linear(f, coef, intercept)

    # Stage 2: XGBoost on Ridge residuals.
    def resid_rows(f):
        r = ridge_pred(f)
        ok = np.isfinite(r) & f["sym_h"].notna().to_numpy()
        return f.loc[ok, FEATURE_COLUMNS], f.loc[ok, "sym_h"].to_numpy(float) - r[ok]

    Xtr, rtr = resid_rows(train_f)
    Xva, rva = resid_rows(val_f)
    log.info("fitting XGBoost residual model on %d rows (%d val)", len(Xtr), len(Xva))
    resid_model = fit_xgb(Xtr, rtr, Xva, rva)

    # Comparison: pure XGBoost on the raw target (to document the extrapolation ceiling).
    def raw_rows(f):
        ok = f["sym_h"].notna()
        return f.loc[ok, FEATURE_COLUMNS], f.loc[ok, "sym_h"].to_numpy(float)

    log.info("fitting pure XGBoost comparison model")
    only_model = fit_xgb(*raw_rows(train_f), *raw_rows(val_f))

    config.MODEL_DIR.mkdir(parents=True, exist_ok=True)
    (config.MODEL_DIR / "ridge.json").write_text(
        json.dumps({"features": RIDGE_FEATURES, "coef": coef.tolist(), "intercept": intercept, "alpha": alpha}, indent=2)
    )
    resid_model.save_model(config.MODEL_DIR / "xgb_residual.json")
    only_model.save_model(config.MODEL_DIR / "xgb_only.json")
    cmax = train_max_coupling()
    (config.MODEL_DIR / "meta.json").write_text(json.dumps({"coupling": cmax}, indent=2))

    model = HybridModel(coef, intercept, resid_model, only_model)

    def evaluate(f: pd.DataFrame) -> tuple[dict, pd.DataFrame]:
        preds = model.predict(f, with_xgb_only=True)
        ridge_ok = np.isfinite(preds["ridge"])
        y = f["sym_h"].to_numpy(float)
        res = {}
        frame = pd.DataFrame({"y": y}, index=f.index)
        for name in MODEL_NAMES:
            p = np.where(ridge_ok, preds[name], np.nan)  # common rows for a fair comparison
            res[name] = metrics(y, p)
            frame[name] = p
        return res, frame

    hold_mask = (test_f.index >= h0) & (test_f.index <= h1)
    report = {}
    for name, part in (("train", train_f), ("val", val_f), ("test", test_f), ("test_excl_holdout", test_f[~hold_mask])):
        report[name], _ = evaluate(part)
    hold_metrics, hold_frame = evaluate(test_f[hold_mask])
    obs_peak, obs_time = peak(hold_frame["y"])
    pred_peaks = {n: peak(hold_frame[n]) for n in MODEL_NAMES}

    for split in ("val", "test", "test_excl_holdout"):
        for n in MODEL_NAMES:
            m = report[split][n]
            log.info("%-18s %-8s RMSE %6.2f  MAE %6.2f  R2 %.3f  storm-RMSE %s", split, n, m["rmse"], m["mae"], m["r2"], m["storm_rmse"])
    log.info("Gannon observed peak %s nT; predicted %s", obs_peak, {n: p[0] for n, p in pred_peaks.items()})

    load_report = json.loads(config.VALIDATION_REPORT.read_text()) if config.VALIDATION_REPORT.exists() else {}
    rows_5min = load_report.get("grid", {}).get("rows_final", None)

    manifest = {
        "schema_version": config.SCHEMA_VERSION,
        "source": "PIPELINE",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model": {
            "kind": "hybrid_ridge_xgb",
            "description": "Ridge on integrated coupling sums + sqrt(Pdyn), plus XGBoost on the Ridge residuals.",
            "cadence_minutes": config.MODEL_CADENCE_MIN,
            "target": "sym_h",
            "features": FEATURE_COLUMNS,
            "banned_inputs": sorted(BANNED_COLUMNS),
            "ridge": {
                "features": RIDGE_FEATURES,
                "coefficients": {f: round(float(c), 6) for f, c in zip(RIDGE_FEATURES, coef)},
                "intercept": round(intercept, 6),
                "alpha": alpha,
                "val_rmse_by_alpha": alpha_scores,
            },
            "xgb": {
                "best_iteration": int(resid_model.best_iteration),
                "params": {k: v for k, v in XGB_PARAMS.items() if k not in ("n_jobs",)},
            },
            "train_seconds": round(time.time() - t_start, 1),
        },
        "splits": {
            name: {"start_year": y0, "end_year": y1, "rows": int((feats["split"] == name).sum())}
            for name, (y0, y1) in config.SPLITS.items()
        },
        "metrics": report,
        "holdout": {
            "id": config.HOLDOUT_ID,
            "name": config.HOLDOUT_NAME,
            "window_start": h0.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "window_end": h1.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "observed_peak_nT": obs_peak,
            "observed_peak_time": obs_time,
            "predicted_peak_nT": {n: pred_peaks[n][0] for n in MODEL_NAMES},
            "predicted_peak_time": {n: pred_peaks[n][1] for n in MODEL_NAMES},
            "metrics": hold_metrics,
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
            "rows_5min": rows_5min,
            "imputation": f"causal forward fill, limit {config.MAX_IMPUTE_GAP_MIN} min",
            "citation": "NASA/GSFC OMNI 5-min data via OMNIWeb/CDAWeb (King & Papitashvili 2005, JGR 110, A02104).",
        },
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, allow_nan=False))
    log.info("wrote %s", out_dir / "manifest.json")
    return manifest


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    train()
