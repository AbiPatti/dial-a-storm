"use client";

import { LANDMARKS, verdict } from "@/lib/impacts";
import { tierFor } from "@/lib/severity";

/**
 * A 0 to -1100 nT ruler with the storms history remembers. The live value slides along it, a tick
 * marks this scenario's peak, and one sentence says how far that peak is from Carrington.
 */

const MAX = 1100;
const pct = (v: number) => Math.min(100, Math.max(0, (-v / MAX) * 100));

export default function HistoryRuler({ live, peak, color, observedPeak }: { live: number; peak: number | null; color: string; observedPeak: number | null }) {
  const carrington = LANDMARKS[2];
  const peakColor = peak !== null ? tierFor(peak).color : color;
  return (
    <div data-testid="history-ruler" className="mt-5 w-full max-w-md">
      <div className="relative h-9">
        {/* track */}
        <div className="absolute inset-x-0 top-4 h-px bg-stone-100/15" />
        {/* Carrington estimate band: runs off the end of the ruler */}
        <div
          className="absolute top-[13px] h-[7px] rounded-l-full"
          style={{ left: `${pct(carrington.value)}%`, right: 0, background: "linear-gradient(90deg, rgba(255,95,162,0.35), rgba(255,95,162,0.08))" }}
        />
        {/* filled depth */}
        <div className="absolute left-0 top-[15.5px] h-[2px] rounded-full transition-[width] duration-150" style={{ width: `${pct(live)}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}` }} />
        {LANDMARKS.slice(0, 2).map((l) => (
          <div key={l.id} className="absolute top-2.5 h-3 w-px bg-stone-300/60" style={{ left: `${pct(l.value)}%` }} />
        ))}
        {observedPeak !== null && observedPeak > -480 && (
          <div className="absolute top-3 h-2 w-px bg-stone-400/50" style={{ left: `${pct(observedPeak)}%` }} title="This storm, as it happened" />
        )}
        {peak !== null && (
          <div className="absolute top-1.5 h-5 w-[2px] -translate-x-1/2 rounded-full" style={{ left: `${pct(peak)}%`, backgroundColor: peakColor, opacity: 0.7 }} title="Peak of your storm" />
        )}
        <div
          className="absolute top-4 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-ink transition-[left] duration-150"
          style={{ left: `${pct(live)}%`, borderColor: color, boxShadow: `0 0 10px ${color}` }}
        />
        {/* labels */}
        <span className="absolute left-0 top-6 font-mono text-[9px] text-stone-500">0</span>
        {LANDMARKS.map((l) => (
          <span
            key={l.id}
            className={`absolute top-6 whitespace-nowrap font-mono text-[9px] ${l.to ? "text-[#ff8cc0]" : "-translate-x-1/2 text-stone-400"}`}
            style={{ left: `${pct(l.value)}%` }}
            title={l.note}
          >
            {l.label}
            {l.to ? " · est." : ""}
          </span>
        ))}
      </div>
      {peak !== null && (
        <p data-testid="history-verdict" className="mt-2 text-[13px] leading-snug text-stone-300">
          Your storm peaks at <span className="font-mono tabular-nums" style={{ color: peakColor }}>{`${peak < 0 ? "−" : ""}${Math.abs(peak).toFixed(0)} nT`}</span>. {verdict(peak)}
        </p>
      )}
    </div>
  );
}
