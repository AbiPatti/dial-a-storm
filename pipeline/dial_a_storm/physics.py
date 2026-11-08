"""Solar-wind physics conventions used everywhere in the pipeline.

Units: B in nT, v in km/s, n in cm^-3, P in nPa, E in mV/m.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

PROTON_MASS_FACTOR = 1.6726e-6  # m_p * 1e6 cm^-3 * (1e3 m/s)^2 -> nPa

# Burton / O'Brien & McPherron (2000) ring-current model:
#   dDst*/dt = Q(VBs) - Dst*/tau
#   Q   = -4.4 (VBs - 0.49) nT/h for VBs > 0.49 mV/m, else 0
#   tau = 2.4 exp(9.74 / (4.69 + VBs)) h       (strong driving -> faster decay)
#   Dst = Dst* + 7.26 sqrt(Pdyn) - 11
OBM_Q_GAIN = -4.4
OBM_E_CUT = 0.49
OBM_TAU_A, OBM_TAU_B, OBM_TAU_C = 2.4, 9.74, 4.69
OBM_PRESSURE_B, OBM_PRESSURE_C = 7.26, -11.0


def southward_bz(bz: np.ndarray | pd.Series) -> np.ndarray | pd.Series:
    """Bs = max(-Bz, 0). NaN stays NaN."""
    return np.maximum(-bz, 0.0)


def dynamic_pressure(density: np.ndarray | pd.Series, speed: np.ndarray | pd.Series):
    """Pdyn = 1.6726e-6 * n * v^2 (nPa). Protons only, no alpha correction."""
    return PROTON_MASS_FACTOR * density * speed**2


def coupling(speed: np.ndarray | pd.Series, bz: np.ndarray | pd.Series):
    """c = Ey = v * Bs * 1e-3 (mV/m), the rectified dawn-dusk electric field."""
    return speed * southward_bz(bz) * 1e-3


def ring_current(coupling_mv_m: np.ndarray, dt_h: float) -> np.ndarray:
    """Burton-OBM ring-current state Dst* (nT), integrated forward in time from Dst* = 0.

    Causal by construction: the state at sample k depends only on samples 0..k. Uses the exact
    exponential update for one step of constant driving. A missing sample (NaN) counts as no
    driving, so the state decays at the quiet-time rate instead of being filled from later data.
    """
    e_arr = np.asarray(coupling_mv_m, dtype=float)
    out = np.empty(e_arr.size)
    state = 0.0
    for k in range(e_arr.size):
        e = e_arr[k]
        if e != e:  # NaN
            e = 0.0
        q = OBM_Q_GAIN * (e - OBM_E_CUT) if e > OBM_E_CUT else 0.0
        tau = OBM_TAU_A * math.exp(OBM_TAU_B / (OBM_TAU_C + e))
        decay = math.exp(-dt_h / tau)
        state = state * decay + q * tau * (1.0 - decay)
        out[k] = state
    return out


def burton_dst(ring_nT, sqrt_pdyn):
    """Full Burton-OBM Dst estimate (nT): ring-current state plus the magnetopause-current term."""
    return ring_nT + OBM_PRESSURE_B * sqrt_pdyn + OBM_PRESSURE_C


def scale_drivers(
    sw: pd.DataFrame,
    bz_mult: float = 1.0,
    speed_mult: float = 1.0,
    density_mult: float = 1.0,
) -> pd.DataFrame:
    """Apply a what-if scenario to a driver frame with columns bz, by, bt, speed, density.

    * The Bz multiplier scales only southward (negative) Bz; northward Bz is untouched.
    * Bt is recomputed so the vector magnitude stays consistent:
      Bt_new = sqrt(max(0, Bt^2 - Bz^2 + Bz_new^2)).
    * Speed and density are scaled directly; By is unchanged.

    Point-wise in time, so it cannot introduce any temporal leakage.
    """
    if bz_mult <= 0 or speed_mult <= 0 or density_mult <= 0:
        raise ValueError("multipliers must be positive")
    out = sw.copy()
    bz = sw["bz"].to_numpy(dtype=float)
    bt = sw["bt"].to_numpy(dtype=float)
    bz_new = np.where(bz < 0, bz * bz_mult, bz)
    bt_new = np.sqrt(np.maximum(0.0, bt**2 - bz**2 + bz_new**2))
    out["bz"] = bz_new
    out["bt"] = bt_new
    out["speed"] = sw["speed"].to_numpy(dtype=float) * speed_mult
    out["density"] = sw["density"].to_numpy(dtype=float) * density_mult
    return out
