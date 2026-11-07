/**
 * Instantaneous "what-if" state at the playback cursor: the interpolated SYM-H plus the scaled
 * solar-wind drivers, using the same physics conventions as pipeline/dial_a_storm/physics.py.
 */
import { sampleNullable, sampleTrace } from "./interpolate";
import { auroraLatitude, magnetopauseStandoffRe, severity01, tierFor, type Tier } from "./severity";
import type { StormBundle } from "./store";
import type { Params } from "./types";

export interface LiveFrame {
  ready: boolean;
  index: number;
  timeMs: number;
  symH: number;
  observed: number | null;
  tier: Tier;
  auroraLat: number;
  severity: number;
  speed: number;
  density: number;
  bz: number;
  bs: number;
  pdyn: number;
  coupling: number;
  standoffRe: number;
  filled: boolean;
}

const NOMINAL = { speed: 400, density: 5, bz: 0 };

export function dynamicPressure(n: number, v: number): number {
  return 1.6726e-6 * n * v * v;
}

export function liveFrame(bundle: StormBundle | null, trace: Float32Array | null, params: Params, cursor: number): LiveFrame {
  if (!bundle || !trace) {
    const pdyn = dynamicPressure(NOMINAL.density, NOMINAL.speed);
    return {
      ready: false,
      index: 0,
      timeMs: 0,
      symH: 0,
      observed: null,
      tier: tierFor(0),
      auroraLat: auroraLatitude(0),
      severity: 0,
      speed: NOMINAL.speed,
      density: NOMINAL.density,
      bz: 0,
      bs: 0,
      pdyn,
      coupling: 0,
      standoffRe: magnetopauseStandoffRe(0, pdyn),
      filled: false,
    };
  }
  const w = bundle.window;
  const s = w.series;
  const symH = sampleTrace(trace, cursor);
  const bz0 = sampleNullable(s.bz, cursor) ?? NOMINAL.bz;
  const v0 = sampleNullable(s.speed, cursor) ?? NOMINAL.speed;
  const n0 = sampleNullable(s.density, cursor) ?? NOMINAL.density;
  const bz = bz0 < 0 ? bz0 * params.bz : bz0;
  const speed = v0 * params.speed;
  const density = n0 * params.density;
  const bs = Math.max(-bz, 0);
  const pdyn = dynamicPressure(density, speed);
  const i = Math.round(Math.min(w.n_times - 1, Math.max(0, cursor)));
  return {
    ready: true,
    index: cursor,
    timeMs: bundle.t0Ms + cursor * w.cadence_minutes * 60_000,
    symH,
    observed: sampleNullable(s.sym_h_observed, cursor),
    tier: tierFor(symH),
    auroraLat: auroraLatitude(symH),
    severity: severity01(symH),
    speed,
    density,
    bz,
    bs,
    pdyn,
    coupling: speed * bs * 1e-3,
    standoffRe: magnetopauseStandoffRe(bz, pdyn),
    filled: w.sw_filled[i] === 1,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatUtc(ms: number, withYear = false): string {
  const d = new Date(ms);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return `${base}${withYear ? ` ${d.getUTCFullYear()}` : ""} ${hh}:${mm} UTC`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function monthDay(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
