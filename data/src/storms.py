"""Detect geomagnetic storm intervals (SYM-H < -50 nT), rank them, and export `storms.json`.

An interval is a contiguous run of SYM-H below the threshold. Runs separated by less than
`STORM_MERGE_GAP_H` hours are merged, so a brief recovery above -50 nT inside one event does not
split it in two. Intervals shorter than `STORM_MIN_DURATION_H` are dropped. Storms are ranked by
their SYM-H minimum, and each of the top N gets a display window padded by +/- 24 h and aligned to
the 15-minute model grid.

Storm detection uses SYM-H because it defines *which events to replay*. SYM-H never becomes a model
feature.

Run: python -m src.storms
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from . import config
from .load import load_cached
from .physics import coupling, dynamic_pressure

log = logging.getLogger("dial_a_storm.storms")

MODEL_STEP = pd.Timedelta(minutes=config.MODEL_CADENCE_MIN)


def iso(ts: pd.Timestamp) -> str:
    return pd.Timestamp(ts).strftime("%Y-%m-%dT%H:%M:%SZ")


def g_tier(sym_h: float) -> str:
    if sym_h > -50:
        return "G0"
    if sym_h > -100:
        return "G1-G2"
    if sym_h > -250:
        return "G3-G4"
    return "G5"


def detect_intervals(
    sym_h: pd.Series,
    threshold: float = config.STORM_THRESHOLD_NT,
    merge_gap_h: float = config.STORM_MERGE_GAP_H,
    min_duration_h: float = config.STORM_MIN_DURATION_H,
) -> list[tuple[int, int]]:
    """Return (start_idx, end_idx) inclusive positional index pairs of storm intervals."""
    below = (sym_h < threshold).to_numpy()  # NaN compares False
    if not below.any():
        return []
    padded = np.concatenate([[False], below, [False]]).astype(np.int8)
    edges = np.diff(padded)
    starts = np.flatnonzero(edges == 1)
    ends = np.flatnonzero(edges == -1) - 1
    gap = int(round(merge_gap_h * config.SAMPLES_PER_HOUR))
    merged: list[list[int]] = []
    for s, e in zip(starts, ends):
        if merged and s - merged[-1][1] - 1 <= gap:
            merged[-1][1] = int(e)
        else:
            merged.append([int(s), int(e)])
    min_len = int(round(min_duration_h * config.SAMPLES_PER_HOUR))
    return [(s, e) for s, e in merged if e - s + 1 >= min_len]


def storm_name(peak_time: pd.Timestamp, peak: float) -> str:
    known = config.KNOWN_STORM_NAMES.get(peak_time.strftime("%Y-%m-%d"))
    if known:
        return known
    return f"{g_tier(peak)} storm, {peak_time.strftime('%d %b %Y').lstrip('0')}"


def build_records(df: pd.DataFrame, top_n: int = config.TOP_N_STORMS) -> list[dict]:
    sym = df["sym_h"]
    intervals = detect_intervals(sym)
    log.info("detected %d storm intervals below %.0f nT", len(intervals), config.STORM_THRESHOLD_NT)
    idx = df.index
    candidates = []
    for s, e in intervals:
        seg = sym.iloc[s : e + 1]
        candidates.append((float(seg.min()), s, e, seg.idxmin()))
    candidates.sort(key=lambda c: c[0])

    pad = pd.Timedelta(hours=config.STORM_WINDOW_PAD_H)
    data_start, data_end = idx[0], idx[-1]
    records, used_ids = [], set()
    for rank, (peak, s, e, peak_time) in enumerate(candidates[:top_n], start=1):
        start, end = idx[s], idx[e]
        w0 = max((start - pad).floor(MODEL_STEP), data_start.ceil(MODEL_STEP))
        w1 = min((end + pad).ceil(MODEL_STEP), data_end.floor(MODEL_STEP))
        seg = df.loc[start:end]
        c = coupling(seg["speed"], seg["bz"])
        p = dynamic_pressure(seg["density"], seg["speed"])
        sid = f"storm_{start.strftime('%Y%m%d')}"
        suffix = 2
        while sid in used_ids:
            sid = f"storm_{start.strftime('%Y%m%d')}_{suffix}"
            suffix += 1
        used_ids.add(sid)
        holdout = sid == config.HOLDOUT_ID or (
            start <= config.HOLDOUT_END and end >= config.HOLDOUT_START
        )
        records.append(
            {
                "id": sid,
                "rank": rank,
                "name": config.HOLDOUT_NAME if holdout else storm_name(peak_time, peak),
                "start": iso(start),
                "end": iso(end),
                "peak_time": iso(peak_time),
                "peak_sym_h": round(peak, 1),
                "g_tier": g_tier(peak),
                "duration_hours": round((end - start).total_seconds() / 3600 + config.CADENCE_MIN / 60, 2),
                "window_start": iso(w0),
                "window_end": iso(w1),
                "split": config.split_of(peak_time),
                "holdout": bool(holdout),
                "peak_coupling_mV_m": round(float(np.nanmax(c)), 3) if c.notna().any() else None,
                "max_speed_km_s": round(float(seg["speed"].max()), 1) if seg["speed"].notna().any() else None,
                "min_bz_nT": round(float(seg["bz"].min()), 2) if seg["bz"].notna().any() else None,
                "max_pdyn_nPa": round(float(np.nanmax(p)), 2) if p.notna().any() else None,
                "sw_coverage": round(float(seg[["bz", "speed", "density"]].notna().all(axis=1).mean()), 4),
            }
        )
    return records


def storms_document(records: list[dict], source: str = "PIPELINE") -> dict:
    return {
        "schema_version": config.SCHEMA_VERSION,
        "source": source,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "threshold_nT": config.STORM_THRESHOLD_NT,
        "merge_gap_hours": config.STORM_MERGE_GAP_H,
        "window_pad_hours": config.STORM_WINDOW_PAD_H,
        "storms": records,
    }


def write_json(path: Path, obj: dict, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        path.write_text(json.dumps(obj, separators=(",", ":"), allow_nan=False))
    else:
        path.write_text(json.dumps(obj, indent=2, allow_nan=False))


def run(out_dir: Path | None = None, df: pd.DataFrame | None = None, source: str = "PIPELINE") -> list[dict]:
    out_dir = out_dir or config.WEB_DATA_DIR
    config.ensure_dirs(out_dir)
    df = load_cached() if df is None else df
    records = build_records(df)
    doc = storms_document(records, source)
    write_json(config.STORMS_CACHE, doc)
    write_json(out_dir / "storms.json", doc)
    for r in records:
        log.info(
            "#%d %s %-32s peak %7.1f nT at %s (%s)%s",
            r["rank"], r["id"], r["name"], r["peak_sym_h"], r["peak_time"], r["split"],
            "  [HOLDOUT]" if r["holdout"] else "",
        )
    if not any(r["holdout"] for r in records):
        log.warning("holdout storm %s is not among the top %d", config.HOLDOUT_ID, config.TOP_N_STORMS)
    return records


def load_storms() -> list[dict]:
    if not config.STORMS_CACHE.exists():
        return run()
    return json.loads(config.STORMS_CACHE.read_text())["storms"]


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    run()
