/**
 * UI mappings from SYM-H (nT) to an approximate NOAA G-scale tier, an equatorward auroral boundary
 * and a magnetopause stand-off distance. These are communication aids, not forecasts.
 */

export type TierId = "G0" | "G1-G2" | "G3-G4" | "G5";

export interface Tier {
  id: TierId;
  display: string;
  label: string;
  level: 0 | 1 | 2 | 3;
  color: string;
  rgb: [number, number, number];
}

export const TIERS: Tier[] = [
  { id: "G0", display: "G0", label: "Quiet", level: 0, color: "#a7f3d0", rgb: [0.45, 0.95, 0.75] },
  { id: "G1-G2", display: "G1–G2", label: "Moderate", level: 1, color: "#fcd34d", rgb: [1.0, 0.8, 0.3] },
  { id: "G3-G4", display: "G3–G4", label: "Strong / Severe", level: 2, color: "#fb923c", rgb: [1.0, 0.5, 0.2] },
  { id: "G5", display: "G5", label: "Extreme Superstorm", level: 3, color: "#fb3b5b", rgb: [1.0, 0.2, 0.32] },
];

/** Boundaries (nT): > -50 quiet, (-100, -50] moderate, (-250, -100] strong/severe, <= -250 extreme. */
export const THRESHOLDS = [
  { value: -50, tier: TIERS[1] },
  { value: -100, tier: TIERS[2] },
  { value: -250, tier: TIERS[3] },
] as const;

export function tierFor(symH: number): Tier {
  if (!Number.isFinite(symH) || symH > -50) return TIERS[0];
  if (symH > -100) return TIERS[1];
  if (symH > -250) return TIERS[2];
  return TIERS[3];
}

export function tierById(id: string): Tier {
  return TIERS.find((t) => t.id === id) ?? TIERS[0];
}

/**
 * Equatorward auroral boundary: Lat ~ 65 deg - 0.05 * |SYM-H|, clamped at 38 deg.
 * Only the storm-time (negative) part of SYM-H expands the oval; compressions (SYM-H > 0) leave it
 * at 65 deg.
 */
export function auroraLatitude(symH: number): number {
  const depth = Number.isFinite(symH) ? Math.max(0, -symH) : 0;
  return Math.max(38, 65 - 0.05 * depth);
}

/** Continuous 0..1 storm severity used to drive shader intensity (0 at 0 nT, 1 at -500 nT). */
export function severity01(symH: number): number {
  if (!Number.isFinite(symH)) return 0;
  return Math.min(1, Math.max(0, -symH / 500));
}

/** Continuous colour along the tier palette for a SYM-H value (linear blend between tiers). */
export function severityRgb(symH: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0, TIERS[0].rgb],
    [-75, TIERS[1].rgb],
    [-175, TIERS[2].rgb],
    [-300, TIERS[3].rgb],
  ];
  const x = Number.isFinite(symH) ? symH : 0;
  if (x >= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [x1, c1] = stops[i];
    const [x0, c0] = stops[i - 1];
    if (x >= x1) {
      const t = (x - x0) / (x1 - x0);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * Shue et al. (1998) sub-solar magnetopause stand-off distance in Earth radii.
 * r0 = (10.22 + 1.29 tanh(0.184 (Bz + 8.14))) * Pdyn^(-1/6.6)
 */
export function magnetopauseStandoffRe(bz: number, pdyn: number): number {
  const p = Math.max(0.1, Number.isFinite(pdyn) ? pdyn : 2);
  const b = Number.isFinite(bz) ? bz : 0;
  return (10.22 + 1.29 * Math.tanh(0.184 * (b + 8.14))) * Math.pow(p, -1 / 6.6);
}
