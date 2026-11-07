/**
 * Trilinear interpolation over the precomputed (Bz-south x speed x density) scenario grid.
 *
 * Grid layout (docs/CONTRACTS.md): traces[((ib * NV + iv) * NN + in) * T + t], integer nT.
 * Axes are strictly ascending but non-uniform, so each slider value is located by binary search
 * and converted to a fractional weight within its bracketing interval. Values outside the axis
 * range are clamped to the boundary (the grid never extrapolates).
 *
 * For a query (b, v, n) with brackets [b0,b1], [v0,v1], [n0,n1] and weights
 * tb = (b - b0)/(b1 - b0) (same for tv, tn), every time sample is
 *   y(t) = sum over corners c in {0,1}^3 of w_c * Y_c(t),
 *   w_c  = (cb ? tb : 1 - tb) * (cv ? tv : 1 - tv) * (cn ? tn : 1 - tn),
 * and the weights sum to 1. At a grid node the result equals the stored trace exactly.
 *
 * Cost: 8 x T multiply-adds (~4.6k for a 579-sample window), well inside one 60 FPS frame.
 */
import type { Params, PreparedGrid, ScenarioGrid } from "./types";

export interface AxisPosition {
  i0: number;
  i1: number;
  t: number;
}

export function locateOnAxis(axis: readonly number[], x: number): AxisPosition {
  const last = axis.length - 1;
  if (!(x > axis[0])) return { i0: 0, i1: 0, t: 0 };
  if (x >= axis[last]) return { i0: last, i1: last, t: 0 };
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (axis[mid] <= x) lo = mid;
    else hi = mid;
  }
  return { i0: lo, i1: hi, t: (x - axis[lo]) / (axis[hi] - axis[lo]) };
}

export function prepareGrid(grid: ScenarioGrid): PreparedGrid {
  return {
    id: grid.id,
    n: grid.n_times,
    axes: { bz: grid.axes.bz_south_mult, speed: grid.axes.speed_mult, density: grid.axes.density_mult },
    data: Float32Array.from(grid.traces),
    inRange: grid.in_range,
    peakCoupling: grid.peak_coupling_mV_m,
    baselinePeakCoupling: grid.baseline_peak_coupling_mV_m,
    trainMaxCoupling: grid.train_max_coupling_mV_m,
    min: grid.min_value,
    max: grid.max_value,
  };
}

export function clampToAxis(axis: readonly number[], x: number): number {
  return Math.min(axis[axis.length - 1], Math.max(axis[0], x));
}

/** Interpolated SYM-H trace (nT) for slider multipliers `p`. Writes into `out` when provided. */
export function trilinearTrace(g: PreparedGrid, p: Params, out?: Float32Array): Float32Array {
  const T = g.n;
  const NV = g.axes.speed.length;
  const NN = g.axes.density.length;
  const b = locateOnAxis(g.axes.bz, p.bz);
  const v = locateOnAxis(g.axes.speed, p.speed);
  const n = locateOnAxis(g.axes.density, p.density);
  const result = out && out.length === T ? out : new Float32Array(T);
  result.fill(0);

  const bi = [b.i0, b.i1];
  const bw = [1 - b.t, b.t];
  const vi = [v.i0, v.i1];
  const vw = [1 - v.t, v.t];
  const ni = [n.i0, n.i1];
  const nw = [1 - n.t, n.t];
  const data = g.data;

  for (let cb = 0; cb < 2; cb++) {
    const wb = bw[cb];
    if (wb === 0) continue;
    for (let cv = 0; cv < 2; cv++) {
      const wbv = wb * vw[cv];
      if (wbv === 0) continue;
      for (let cn = 0; cn < 2; cn++) {
        const w = wbv * nw[cn];
        if (w === 0) continue;
        const base = ((bi[cb] * NV + vi[cv]) * NN + ni[cn]) * T;
        for (let t = 0; t < T; t++) result[t] += w * data[base + t];
      }
    }
  }
  return result;
}

/** Peak coupling for a scenario. Exact: only Bz < 0 is scaled, so c scales by bz * speed. */
export function scenarioPeakCoupling(g: PreparedGrid, p: Params): number {
  return g.baselinePeakCoupling * p.bz * p.speed;
}

/** True when the scenario's peak coupling stays within the 2010–2019 training maximum. */
export function scenarioInRange(g: PreparedGrid, p: Params): boolean {
  return scenarioPeakCoupling(g, p) <= g.trainMaxCoupling * (1 + 1e-9);
}

/** Linear sample of a trace at a fractional index. */
export function sampleTrace(trace: ArrayLike<number>, cursor: number): number {
  const n = trace.length;
  if (n === 0) return NaN;
  const x = Math.min(n - 1, Math.max(0, cursor));
  const i0 = Math.floor(x);
  const i1 = Math.min(n - 1, i0 + 1);
  const t = x - i0;
  return trace[i0] * (1 - t) + trace[i1] * t;
}

/** Linear sample of a nullable series; returns null when either neighbour is missing. */
export function sampleNullable(series: ArrayLike<number | null>, cursor: number): number | null {
  const n = series.length;
  if (n === 0) return null;
  const x = Math.min(n - 1, Math.max(0, cursor));
  const i0 = Math.floor(x);
  const i1 = Math.min(n - 1, i0 + 1);
  const a = series[i0];
  const b = series[i1];
  if (a === null || b === null) return a ?? b ?? null;
  const t = x - i0;
  return a * (1 - t) + b * t;
}

export function traceMinimum(trace: ArrayLike<number>): { value: number; index: number } {
  let value = Infinity;
  let index = 0;
  for (let i = 0; i < trace.length; i++) {
    if (trace[i] < value) {
      value = trace[i];
      index = i;
    }
  }
  return { value, index };
}
