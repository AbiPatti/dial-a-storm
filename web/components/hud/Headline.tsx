"use client";

import { GEO_RE } from "@/lib/glsl";
import { formatUtc, liveFrame, type LiveFrame } from "@/lib/live";
import { phaseAt } from "@/lib/phases";
import { useDialStore } from "@/lib/store";
import HistoryRuler from "./HistoryRuler";

/**
 * The one piece of text that explains the scene. It rewrites itself from the live state, so during
 * a replay it narrates the storm (quiet -> shield opens -> aurora -> superstorm) with no captions,
 * and names the storm phase (shock, main phase, peak, recovery) from lib/phases.ts.
 */

function auroraPlace(lat: number): string {
  if (lat >= 63) return "near the Arctic Circle";
  if (lat >= 58) return "over Alaska and Norway";
  if (lat >= 53) return "over Scotland and Canada";
  if (lat >= 48) return "over London and the northern US";
  if (lat >= 43) return "over Paris and the central US";
  return "as far south as Spain and Texas";
}

function story(f: LiveFrame): { lead: string; accent: string; sub: string } {
  if (!f.ready) return { lead: "Waking", accent: "the Sun…", sub: "Loading 16 years of solar wind." };
  const where = auroraPlace(f.auroraLat);
  if (f.symH <= -250) {
    return {
      lead: "A",
      accent: "superstorm.",
      sub:
        f.standoffRe < GEO_RE
          ? `The shield is pushed inside geostationary orbit. Aurora ${where}.`
          : `The ring current blazes around Earth. Aurora ${where}.`,
    };
  }
  if (f.symH <= -100) return { lead: "A severe", accent: "storm.", sub: `Energy floods the ring current around Earth. Aurora ${where}.` };
  if (f.symH <= -40) return { lead: "Northern", accent: "lights.", sub: `The ring current is filling up. Aurora ${where}.` };
  if (f.coupling > 1.5) {
    return { lead: "The shield", accent: "opens.", sub: "The wind's magnetic field points south, links up with Earth's, and energy pours in." };
  }
  if (f.bz > 0) return { lead: "A quiet", accent: "day.", sub: "The wind's field points north, so the shield stays closed and the wind slides around it." };
  return { lead: "A quiet", accent: "day.", sub: "The solar wind slides harmlessly around Earth's magnetic shield." };
}

export default function Headline() {
  const bundle = useDialStore((s) => s.bundle);
  const trace = useDialStore((s) => s.activeTrace);
  const tracePeak = useDialStore((s) => s.tracePeak);
  const params = useDialStore((s) => s.params);
  const cursor = useDialStore((s) => s.cursor);
  const storms = useDialStore((s) => s.storms);
  const activeId = useDialStore((s) => s.activeStormId);

  const f = liveFrame(bundle, trace, params, cursor);
  const { lead, accent, sub } = story(f);
  const name = storms.find((s) => s.id === activeId)?.name;
  const value = f.ready ? `${f.symH < 0 ? "−" : ""}${Math.abs(f.symH).toFixed(0)}` : "—";
  const phase = bundle && trace && tracePeak ? phaseAt(bundle, bundle.events, trace, tracePeak.index, cursor) : null;

  return (
    <section aria-label="What is happening" className="pointer-events-none -ml-3 max-w-md rounded-2xl bg-ink/60 p-3 backdrop-blur-[3px] sm:-ml-4 sm:p-4">
      <p className="micro">
        {f.ready ? formatUtc(f.timeMs, true) : "—"}
        {name ? ` · ${name}` : ""}
      </p>
      {/* Narration changes several times a second during playback, so only the phase is announced. */}
      <h2 className="mt-2 font-serif text-4xl leading-[0.95] tracking-tight text-stone-100 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-5xl md:text-6xl">
        {lead} <em className="italic" style={{ color: f.tier.color }}>{accent}</em>
      </h2>
      <p className="mt-3 hidden max-w-sm text-[15px] leading-snug sm:block text-stone-300 drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">{sub}</p>

      {phase && (
        <p aria-live="polite" className="mt-3 text-[12px] text-stone-400">
          <span className="micro !text-ember-300">{phase.label}</span>
          <span className="ml-2 hidden sm:inline">{phase.detail}</span>
        </p>
      )}

      <div className="mt-4 flex items-end gap-4">
        <div data-testid="hero-value" className="font-mono text-4xl font-medium tabular-nums leading-none" style={{ color: f.tier.color }}>
          {value}
          <span className="ml-1.5 text-sm text-stone-500">nT</span>
        </div>
        <div className="pb-0.5">
          <div className="micro">SYM-H · what-if</div>
          <div className="text-xs text-stone-300" aria-label={`Approximate storm tier ${f.tier.display}`}>
            ≈{f.tier.display} · {f.tier.label}
          </div>
        </div>
      </div>

      {/* Hidden on phones, where the timeline and knob need the room. */}
      {f.ready && (
        <div className="hidden sm:block">
          <HistoryRuler live={f.symH} peak={tracePeak?.value ?? null} color={f.tier.color} observedPeak={bundle?.observedMin ?? null} />
        </div>
      )}
    </section>
  );
}
