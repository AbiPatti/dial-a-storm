/**
 * Storm phases for the playback narration, derived from each storm's own data (nothing is
 * hard-coded per storm):
 *
 * - Shock arrival: the largest 1-hour rise in solar-wind speed (>= 60 km/s) before the observed
 *   SYM-H minimum. Interplanetary shocks ahead of CMEs show up as exactly this kind of jump.
 * - Main phase: from the shock (or the start of the SYM-H < -50 nT interval) to the minimum of
 *   the trace being shown, while the ring current builds.
 * - Recovery: after that minimum, while the trace is still below -50 nT.
 *
 * The phase is evaluated on the trace the user is looking at (the what-if), so dialling the storm
 * up or down moves the peak and the end of recovery.
 */
import type { StormBundle } from "./store";

export type PhaseId = "before" | "shock" | "main" | "peak" | "recovery" | "after";

export interface StormEvents {
  /** Fractional sample index of the shock, or null if no clear jump. */
  shockIndex: number | null;
  /** Speed jump across the shock, km/s (observed, before dial scaling). */
  shockJumpKmS: number | null;
}

export interface Phase {
  id: PhaseId;
  label: string;
  detail: string;
}

/** Samples per hour at the window cadence. */
function perHour(bundle: StormBundle): number {
  return Math.max(1, Math.round(60 / bundle.window.cadence_minutes));
}

export function detectEvents(bundle: StormBundle): StormEvents {
  const v = bundle.window.series.speed;
  const h = perHour(bundle);
  const end = Math.min(v.length - 1, Math.floor(bundle.peakIndex));
  let best = 0;
  let at = -1;
  for (let i = h; i <= end; i++) {
    const a = v[i - h];
    const b = v[i];
    if (a === null || b === null) continue;
    const jump = b - a;
    if (jump > best) {
      best = jump;
      at = i;
    }
  }
  if (at < 0 || best < 60) return { shockIndex: null, shockJumpKmS: null };
  // Place the shock at the steepest single step inside the winning hour.
  let steep = at;
  let steepJump = -Infinity;
  for (let i = at - h + 1; i <= at; i++) {
    const a = v[i - 1];
    const b = v[i];
    if (a === null || b === null) continue;
    if (b - a > steepJump) {
      steepJump = b - a;
      steep = i;
    }
  }
  return { shockIndex: steep, shockJumpKmS: best };
}

function hours(bundle: StormBundle, samples: number): string {
  const h = samples / perHour(bundle);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  return `${h < 10 ? h.toFixed(1) : h.toFixed(0)} h`;
}

export function phaseAt(bundle: StormBundle, events: StormEvents, trace: ArrayLike<number>, peakIndex: number, cursor: number): Phase {
  const h = perHour(bundle);
  const start = events.shockIndex ?? bundle.stormSpan[0];
  const peakValue = trace[Math.round(peakIndex)];
  const stormy = peakValue <= -50;

  if (!stormy) {
    return { id: "after", label: "No storm", detail: "At these settings SYM-H never drops below −50 nT." };
  }
  if (events.shockIndex !== null && Math.abs(cursor - events.shockIndex) <= h * 0.75) {
    const jump = events.shockJumpKmS !== null ? ` Wind speed jumps by ${events.shockJumpKmS.toFixed(0)} km/s.` : "";
    return { id: "shock", label: "Shock arrives", detail: `The CME's shock front hits the magnetosphere.${jump}` };
  }
  if (cursor < start) {
    return { id: "before", label: "Before the storm", detail: `${hours(bundle, start - cursor)} until the ${events.shockIndex !== null ? "shock arrives" : "storm begins"}.` };
  }
  if (Math.abs(cursor - peakIndex) <= h * 0.5) {
    return { id: "peak", label: "Storm peak", detail: "The ring current is at its strongest." };
  }
  if (cursor < peakIndex) {
    return { id: "main", label: "Main phase", detail: `The ring current builds up. ${hours(bundle, peakIndex - cursor)} to the peak.` };
  }
  // Recovery ends when the trace climbs back above -50 nT.
  let endIdx = trace.length - 1;
  for (let i = Math.ceil(peakIndex); i < trace.length; i++) {
    if (trace[i] > -50) {
      endIdx = i;
      break;
    }
  }
  if (cursor < endIdx) {
    return { id: "recovery", label: "Recovery", detail: `The ring current decays. ${hours(bundle, endIdx - cursor)} until SYM-H is back above −50 nT.` };
  }
  return { id: "after", label: "Back to quiet", detail: "SYM-H is back above −50 nT." };
}
