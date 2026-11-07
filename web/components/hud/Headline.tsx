"use client";

import { formatUtc, liveFrame, type LiveFrame } from "@/lib/live";
import { useDialStore } from "@/lib/store";

/**
 * The one piece of text that explains the scene. It rewrites itself from the live state, so during
 * a replay it narrates the storm (quiet -> shield opens -> aurora -> superstorm) with no captions.
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
      sub: f.standoffRe < 6.6 ? `The shield is crushed inside satellite orbit. Aurora ${where}.` : `The ring around Earth blazes. Aurora ${where}.`,
    };
  }
  if (f.symH <= -100) return { lead: "A severe", accent: "storm.", sub: `Energy floods the ring around Earth. Aurora ${where}.` };
  if (f.symH <= -40) return { lead: "Northern", accent: "lights.", sub: `The ring around Earth is filling up. Aurora ${where}.` };
  if (f.coupling > 1.5) return { lead: "The shield", accent: "opens.", sub: "The wind's magnetism points south, links up with Earth's, and energy pours in." };
  return { lead: "A quiet", accent: "day.", sub: "The solar wind slides harmlessly around Earth's magnetic shield." };
}

export default function Headline() {
  const bundle = useDialStore((s) => s.bundle);
  const trace = useDialStore((s) => s.activeTrace);
  const params = useDialStore((s) => s.params);
  const cursor = useDialStore((s) => s.cursor);
  const inRange = useDialStore((s) => s.inRange);
  const storms = useDialStore((s) => s.storms);
  const activeId = useDialStore((s) => s.activeStormId);

  const f = liveFrame(bundle, trace, params, cursor);
  const { lead, accent, sub } = story(f);
  const name = storms.find((s) => s.id === activeId)?.name;
  const value = f.ready ? `${f.symH < 0 ? "−" : ""}${Math.abs(f.symH).toFixed(0)}` : "—";

  return (
    <section aria-label="What is happening" aria-live="polite" className="pointer-events-none max-w-xl">
      <p className="micro">
        {f.ready ? formatUtc(f.timeMs, true) : "—"}
        {name ? ` · ${name}` : ""}
      </p>
      <h2 className="mt-2 font-serif text-6xl leading-[0.95] tracking-tight text-stone-100 md:text-7xl">
        {lead} <em className="italic" style={{ color: f.tier.color }}>{accent}</em>
      </h2>
      <p className="mt-3 max-w-md text-[15px] leading-snug text-stone-300">{sub}</p>

      <div className="mt-5 flex items-end gap-4">
        <div data-testid="hero-value" className="font-mono text-4xl font-medium tabular-nums leading-none" style={{ color: f.tier.color }}>
          {value}
          <span className="ml-1.5 text-sm text-stone-500">nT</span>
        </div>
        <div className="pb-0.5">
          <div className="micro">storm strength</div>
          <div className="text-xs text-stone-300" aria-label={`Current NOAA tier ${f.tier.display}`}>
            ≈{f.tier.display} · {f.tier.label}
          </div>
        </div>
      </div>

      {bundle && !inRange && (
        <p role="alert" className="mt-3 inline-flex items-center gap-2 rounded-full border border-ember-400/40 px-3 py-1 text-[11px] text-ember-300">
          <span className="h-1.5 w-1.5 rounded-full bg-ember-400" aria-hidden="true" />
          BEYOND TRAINING DATA · the model is extrapolating
        </p>
      )}
    </section>
  );
}
