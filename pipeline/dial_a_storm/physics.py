"""Solar-wind physics conventions used everywhere in the pipeline.

Units: B in nT, v in km/s, n in cm^-3, P in nPa, E in mV/m.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

PROTON_MASS_FACTOR = 1.6726e-6  # m_p * 1e6 cm^-3 * (1e3 m/s)^2 -> nPa


def southward_bz(bz: np.ndarray | pd.Series) -> np.ndarray | pd.Series:
    """Bs = max(-Bz, 0). NaN stays NaN."""
    return np.maximum(-bz, 0.0)


def dynamic_pressure(density: np.ndarray | pd.Series, speed: np.ndarray | pd.Series):
    """Pdyn = 1.6726e-6 * n * v^2 (nPa). Protons only, no alpha correction."""
    return PROTON_MASS_FACTOR * density * speed**2


def coupling(speed: np.ndarray | pd.Series, bz: np.ndarray | pd.Series):
    """c = Ey = v * Bs * 1e-3 (mV/m), the rectified dawn-dusk electric field."""
    return speed * southward_bz(bz) * 1e-3


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
