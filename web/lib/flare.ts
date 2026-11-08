/**
 * Solar eruption timeline for the 3D scene. A pure function of the playback cursor, so scrubbing
 * and replaying always agree, and nothing is stored between frames.
 *
 * Each storm's shock arrival (lib/phases.ts) is when its CME reaches Earth. We play the launch
 * `LEAD_HOURS` earlier, compressed: the flare erupts on the Sun at launch (p = 0), a bright front
 * travels the Sun-Earth line, and it reaches the bow shock exactly when the data's speed jumps
 * (p = 1). Real transits take 1 to 3 days; the lead is capped so the replay shows it in ~3 s.
 *
 * The eruption only appears when the scenario actually produces a storm (SYM-H below -50 nT),
 * and its strength follows the what-if peak, so a gentler Sun launches a weaker CME.
 */
import { magnetopauseSceneRadius } from "./glsl";
import type { StormBundle } from "./store";

/** Longest visual transit, in hours of storm time. */
const LEAD_HOURS = 20;
/** Shortest transit worth drawing. */
const MIN_LEAD_HOURS = 1;

export interface Eruption {
  /** 0 at launch, 1 when the front reaches Earth's bow shock. */
  p: number;
  /** Scenario strength 0.35..1 from the what-if SYM-H peak. */
  strength: number;
  /** Bright X-ray-like flash on the Sun: spikes at launch, decays within the first ~20 %. */
  flash: number;
  /** Loops and jet growth 0..1 (reaches 1 at p = 0.35). */
  rise: number;
  /** Loops and jet visibility: full early, gone once the CME has left the corona. */
  linger: number;
  /** Front visibility: fades in after launch and out as it meets the bow shock. */
  front: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Cursor index at which the CME is launched and at which it arrives, or null if there is no transit to show. */
export function eruptionWindow(bundle: StormBundle): { launch: number; arrive: number } | null {
  const perHour = 60 / bundle.window.cadence_minutes;
  const arrive = bundle.events.shockIndex ?? bundle.stormSpan[0];
  const lead = Math.min(arrive, LEAD_HOURS * perHour);
  if (lead < MIN_LEAD_HOURS * perHour) return null;
  return { launch: arrive - lead, arrive };
}

export function eruptionAt(bundle: StormBundle | null, cursor: number, peakNt: number | null): Eruption | null {
  if (!bundle || peakNt === null || peakNt > -50) return null;
  const w = eruptionWindow(bundle);
  if (!w) return null;
  const p = (cursor - w.launch) / (w.arrive - w.launch);
  if (p < 0 || p > 1) return null;
  const strength = Math.min(1, Math.max(0.35, 0.35 + (-peakNt - 50) / 450));
  const sinceSpike = Math.max(0, p - 0.025);
  return {
    p,
    strength,
    flash: smooth(0, 0.025, p) * Math.exp(-sinceSpike * 12),
    rise: clamp01(p / 0.35),
    linger: 1 - smooth(0.25, 0.7, p),
    front: smooth(0, 0.06, p) * (1 - smooth(0.9, 1, p)),
  };
}

/** World x of the CME's leading edge: from the solar surface to just upstream of the bow shock. */
export function frontLeadX(p: number, sunSurfaceX: number, bowX: number): number {
  return sunSurfaceX + (bowX - sunSurfaceX) * p;
}

/** Bow shock x in scene units: the same 1.4 x nose-radius rule the particle shader uses. */
export function bowShockX(standoffRe: number): number {
  return -1.4 * magnetopauseSceneRadius(standoffRe, 1);
}
