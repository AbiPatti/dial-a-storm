"""Causality and contamination guarantees for the Dial-a-Storm feature pipeline.

These tests run on synthetic data (no CSV needed) and assert that:
* perturbing any driver at times > t leaves every feature at times <= t bit-identical;
* lag and rolling features reference exactly the intended past samples;
* the Burton-OBM ring-current feature matches the published model and forgets its start state;
* Earth-response columns (SYM-H, AE, AL, PCN, proton flux) cannot influence the features;
* short-gap imputation is causal and bounded at 30 minutes;
* scenario scaling is point-wise and obeys the physics conventions;
* the temporal splits are disjoint and the Gannon holdout is outside train/val.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from dial_a_storm import config
from dial_a_storm.features import (
    BANNED_COLUMNS,
    DRIVER_COLUMNS,
    FEATURE_COLUMNS,
    LAG_MINUTES,
    LAG_VARS,
    RIDGE_FEATURES,
    ROLL_HOURS,
    build_features,
    southward_duration_hours,
)
from dial_a_storm.load import causal_fill_short_gaps
from dial_a_storm.physics import coupling, dynamic_pressure, ring_current, scale_drivers, southward_bz

N_DAYS = 4


@pytest.fixture(scope="module")
def frame() -> pd.DataFrame:
    rng = np.random.default_rng(7)
    idx = pd.date_range("2015-03-15", periods=N_DAYS * 288, freq="5min")
    n = len(idx)
    bz = 4 * np.sin(np.arange(n) / 40.0) + rng.normal(0, 3, n)
    by = rng.normal(0, 4, n)
    bt = np.sqrt(bz**2 + by**2 + rng.uniform(1, 9, n))
    df = pd.DataFrame(
        {
            "bz": bz,
            "by": by,
            "bt": bt,
            "speed": 450 + 100 * np.sin(np.arange(n) / 300.0) + rng.normal(0, 10, n),
            "density": np.abs(5 + rng.normal(0, 2, n)) + 0.1,
            # Earth responses: present in the frame, must be ignored.
            "sym_h": rng.normal(-30, 20, n),
            "ae": rng.uniform(0, 1000, n),
            "al": -rng.uniform(0, 1000, n),
            "pcn": rng.normal(1, 1, n),
            "proton_flux": rng.uniform(0, 10, n),
        },
        index=idx,
    )
    # A few short gaps.
    df.iloc[500:503, :5] = np.nan
    return df


def assert_frames_identical(a: pd.DataFrame, b: pd.DataFrame) -> None:
    pd.testing.assert_frame_equal(a, b, check_exact=True)


# --------------------------------------------------------------------------------------- leakage


@pytest.mark.parametrize("cut_frac", [0.25, 0.5, 0.8])
def test_future_perturbation_does_not_change_past_features(frame, cut_frac):
    base = build_features(frame)
    cut = frame.index[int(len(frame) * cut_frac)]
    perturbed = frame.copy()
    future = perturbed.index > cut
    rng = np.random.default_rng(1)
    for col in DRIVER_COLUMNS:
        perturbed.loc[future, col] = rng.normal(0, 50, future.sum()) + 500
    after = build_features(perturbed)
    past = base.index <= cut
    assert_frames_identical(base.loc[past], after.loc[past])
    # Sanity: the perturbation is visible after the cut, so the test has power.
    assert not base.loc[~past].equals(after.loc[~past])


def test_single_spike_only_affects_present_and_future(frame):
    base = build_features(frame)
    t_spike = pd.Timestamp("2015-03-16 12:00")
    spiked = frame.copy()
    spiked.loc[t_spike, "bz"] = -80.0
    after = build_features(spiked)
    diff_rows = (base != after) & ~(base.isna() & after.isna())
    changed = diff_rows.any(axis=1)
    assert changed.any()
    assert changed[changed].index.min() >= t_spike


def test_lag_features_reference_exact_past_samples(frame):
    feats = build_features(frame)
    bs = southward_bz(frame["bz"])
    pdyn = dynamic_pressure(frame["density"], frame["speed"])
    source = {"bs": bs, "speed": frame["speed"], "density": frame["density"], "pdyn": pdyn, "by": frame["by"], "bt": frame["bt"]}
    for t in feats.index[100::97]:
        for v in LAG_VARS:
            for m in LAG_MINUTES:
                past_t = t - pd.Timedelta(minutes=m)
                got = feats.at[t, f"{v}_lag{m}m"]
                if past_t < frame.index[0]:
                    assert np.isnan(got)
                    continue
                want = np.float32(source[v].loc[past_t])
                assert (np.isnan(got) and np.isnan(want)) or got == pytest.approx(want, rel=1e-5), (t, v, m)


def test_rolling_integrals_use_trailing_window_only(frame):
    feats = build_features(frame)
    c = coupling(frame["speed"], frame["bz"])
    for t in feats.index[400::131]:
        for h in ROLL_HOURS:
            lo = t - pd.Timedelta(hours=h)
            window = c[(c.index > lo) & (c.index <= t)]
            if window.notna().sum() < (h * 12) // 2:
                continue
            want = window.mean() * h
            assert feats.at[t, f"coupling_int_{h}h"] == pytest.approx(want, rel=1e-4, abs=1e-5), (t, h)


def test_ring_current_matches_burton_obm_reference(frame):
    """Independent re-implementation of O'Brien & McPherron (2000), exact exponential step."""
    import math

    e = coupling(frame["speed"], frame["bz"]).to_numpy(float)
    dt = config.CADENCE_MIN / 60.0
    state, want = 0.0, []
    for x in e:
        x = 0.0 if np.isnan(x) else x
        q = -4.4 * (x - 0.49) if x > 0.49 else 0.0
        tau = 2.4 * math.exp(9.74 / (4.69 + x))
        state = state * math.exp(-dt / tau) + q * tau * (1 - math.exp(-dt / tau))
        want.append(state)
    np.testing.assert_allclose(ring_current(e, dt), want, rtol=1e-12, atol=1e-12)
    feats = build_features(frame)
    got = feats["ring_current"].dropna()
    ref = pd.Series(want, index=frame.index).loc[got.index]
    np.testing.assert_allclose(got.to_numpy(), ref.to_numpy(np.float32), rtol=1e-5, atol=1e-4)


def test_ring_current_forgets_a_truncated_start(frame):
    """The export starts the integration 36 h before each window. The gap to the full-history state
    shrinks at least as fast as the slowest (quiet-time) decay, tau(0) = 2.4 exp(9.74 / 4.69) h."""
    full = build_features(frame)["ring_current"]
    start = frame.index[200]
    late = build_features(frame.loc[start:])["ring_current"]
    tau_max = 2.4 * np.exp(9.74 / 4.69)
    t0 = late.dropna().index[0]
    gap0 = abs(full[t0] - late[t0]) + 1e-3
    t1 = t0 + pd.Timedelta(hours=config.FEATURE_HISTORY_H)
    gap1 = abs(full[t1] - late[t1])
    assert gap1 <= gap0 * np.exp(-config.FEATURE_HISTORY_H / tau_max) * 1.01 + 1e-3


def test_southward_duration_is_causal_and_capped():
    bz = np.array([1, -1, -1, -1, 2, -1, np.nan, -1] + [-1] * 200, dtype=float)
    hours = southward_duration_hours(bz)
    assert hours[:8].tolist() == pytest.approx([0, 5 / 60, 10 / 60, 15 / 60, 0, 5 / 60, 0, 5 / 60])
    assert hours.max() == 12.0
    # Changing the future never changes the past.
    bz2 = bz.copy()
    bz2[50:] = 3.0
    assert np.array_equal(southward_duration_hours(bz2)[:50], hours[:50])


def test_features_on_model_grid_only(frame):
    feats = build_features(frame)
    assert (feats.index.minute % config.MODEL_CADENCE_MIN == 0).all()
    assert list(feats.columns) == FEATURE_COLUMNS


def test_irregular_index_rejected(frame):
    with pytest.raises(ValueError):
        build_features(frame.drop(frame.index[10]))


# --------------------------------------------------------------------------- response contamination


def test_no_banned_column_names_in_feature_space():
    for name in FEATURE_COLUMNS + RIDGE_FEATURES:
        root = name.split("_lag")[0]
        assert root not in BANNED_COLUMNS, name
        for banned in BANNED_COLUMNS:
            assert not name.startswith(banned + "_") and name != banned, name
    assert not set(DRIVER_COLUMNS) & BANNED_COLUMNS


def test_banned_responses_cannot_influence_features(frame):
    base = build_features(frame)
    scrambled = frame.copy()
    rng = np.random.default_rng(3)
    for col in BANNED_COLUMNS:
        scrambled[col] = rng.permutation(scrambled[col].to_numpy()) * 100
    assert_frames_identical(base, build_features(scrambled))
    assert_frames_identical(base, build_features(frame.drop(columns=list(BANNED_COLUMNS))))


def test_missing_driver_column_is_an_error(frame):
    with pytest.raises(KeyError):
        build_features(frame.drop(columns=["speed"]))


# ------------------------------------------------------------------------------------ imputation


def test_imputation_is_causal_and_bounded():
    idx = pd.date_range("2020-01-01", periods=40, freq="5min")
    s = pd.Series(np.arange(40, dtype=float), index=idx)
    s.iloc[5:8] = np.nan  # 15-min gap: fully filled from the past
    s.iloc[20:30] = np.nan  # 50-min gap: first 30 min filled, rest stays NaN
    filled, mask = causal_fill_short_gaps(s, max_samples=config.MAX_IMPUTE_GAP_MIN // config.CADENCE_MIN)
    assert filled.iloc[5:8].tolist() == [4.0, 4.0, 4.0]
    assert filled.iloc[20:26].tolist() == [19.0] * 6
    assert filled.iloc[26:30].isna().all()
    assert mask.sum() == 9
    # Values after a gap never flow backwards into it.
    assert (filled.dropna().diff().dropna() >= 0).all()


def test_leading_gap_is_not_back_filled():
    s = pd.Series([np.nan, np.nan, 1.0, 2.0], index=pd.date_range("2020", periods=4, freq="5min"))
    filled, _ = causal_fill_short_gaps(s, 6)
    assert filled.iloc[:2].isna().all()


# ------------------------------------------------------------------------------- scenario physics


def test_scenario_scaling_physics_and_pointwise(frame):
    scen = scale_drivers(frame, bz_mult=2.0, speed_mult=1.5, density_mult=3.0)
    north = frame["bz"] > 0
    south = frame["bz"] < 0
    assert np.array_equal(scen.loc[north, "bz"], frame.loc[north, "bz"])
    np.testing.assert_allclose(scen.loc[south, "bz"], 2.0 * frame.loc[south, "bz"])
    bt_expected = np.sqrt(np.maximum(0, frame["bt"] ** 2 - frame["bz"] ** 2 + scen["bz"] ** 2))
    np.testing.assert_allclose(scen["bt"].dropna(), bt_expected.dropna())
    np.testing.assert_allclose(scen["speed"], 1.5 * frame["speed"])
    np.testing.assert_allclose(scen["density"], 3.0 * frame["density"])
    # Coupling scales by exactly bz_mult * speed_mult (used client-side for in_range).
    c0 = coupling(frame["speed"], frame["bz"])
    c1 = coupling(scen["speed"], scen["bz"])
    np.testing.assert_allclose(c1.dropna(), 3.0 * c0.dropna(), rtol=1e-12)
    # Point-wise: scaling then truncating equals truncating then scaling.
    cut = frame.index[300]
    pd.testing.assert_frame_equal(
        scale_drivers(frame.loc[:cut], 2.0, 1.5, 3.0), scen.loc[:cut]
    )


# ------------------------------------------------------------------------------------- splits


def test_splits_are_disjoint_and_ordered():
    spans = sorted(config.SPLITS.values())
    for (a0, a1), (b0, b1) in zip(spans, spans[1:]):
        assert a1 < b0
    assert config.SPLITS["train"] == (2010, 2019)
    assert config.SPLITS["val"] == (2020, 2022)
    assert config.SPLITS["test"] == (2023, 2026)


def test_gannon_holdout_outside_fit_splits():
    for t in pd.date_range(config.HOLDOUT_START, config.HOLDOUT_END, freq="1h"):
        assert config.split_of(t) == "test"
