"use client";

import { auroraCities, CITIES, LEVEL_COLORS, levelFor, SYSTEMS, type ImpactLevel, type ImpactSystem } from "@/lib/impacts";
import { liveFrame } from "@/lib/live";
import { useDialStore } from "@/lib/store";

/**
 * "What it would do to us": the storm translated from nT into systems people rely on. Every row
 * follows the live replay, and a hollow segment marks the worst this scenario will reach.
 */

function Meter({ level, peak }: { level: ImpactLevel; peak: ImpactLevel }) {
  return (
    <div className="flex gap-[3px]" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => {
        const on = i <= level;
        const ahead = !on && i <= peak;
        const c = LEVEL_COLORS[Math.max(level, 1)];
        return (
          <span
            key={i}
            className="h-2.5 w-1.5 rounded-[1px] transition-all duration-300"
            style={{
              backgroundColor: on ? c : "rgba(231,229,228,0.08)",
              boxShadow: on ? `0 0 8px ${c}` : ahead ? `inset 0 0 0 1px ${LEVEL_COLORS[peak]}99` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function SystemRow({ system, symH, peakSymH }: { system: ImpactSystem; symH: number; peakSymH: number }) {
  const level = levelFor(system, symH);
  const peak = levelFor(system, peakSymH);
  const stage = system.stages[level];
  const color = LEVEL_COLORS[level];
  return (
    <li data-testid={`impact-${system.id}`} data-level={level} data-peak-level={peak} className="py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="micro">{system.label}</span>
        <Meter level={level} peak={peak} />
      </div>
      <div
        key={level}
        className={`font-serif text-xl leading-tight ${level > 0 ? "animate-impactIn" : ""}`}
        style={{ color: level === 0 ? "#d6d3d1" : color, textShadow: level >= 3 ? `0 0 18px ${color}88` : undefined }}
      >
        {stage.status}
      </div>
      <p className="text-[12px] leading-snug text-stone-300 md:[@media(max-height:960px)]:hidden">{stage.detail}</p>
      {stage.precedent && <p className="mt-0.5 font-mono text-[10px] leading-snug text-stone-500">{stage.precedent}</p>}
    </li>
  );
}

function AuroraRow({ symH }: { symH: number }) {
  const { lit, southmost } = auroraCities(symH);
  return (
    <li data-testid="impact-aurora" className="pb-2 pt-1.5">
      <span className="micro">Aurora overhead</span>
      <div className="font-serif text-xl leading-tight" style={{ color: southmost ? "#86efac" : "#d6d3d1", textShadow: southmost ? "0 0 18px #4ade8066" : undefined }}>
        {southmost ? `As far south as ${southmost}` : "Polar skies only"}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 md:[@media(max-height:800px)]:hidden gap-y-0.5 font-mono text-[10px]">
        {CITIES.map((c, i) => (
          <span
            key={c.name}
            className="transition-colors duration-500"
            style={{ color: lit[i] ? "#86efac" : "rgba(168,162,158,0.35)", textShadow: lit[i] ? "0 0 8px #4ade8099" : undefined }}
          >
            {c.name}
          </span>
        ))}
      </div>
    </li>
  );
}

export default function Impacts() {
  const bundle = useDialStore((s) => s.bundle);
  const trace = useDialStore((s) => s.activeTrace);
  const params = useDialStore((s) => s.params);
  const cursor = useDialStore((s) => s.cursor);
  const tracePeak = useDialStore((s) => s.tracePeak);

  const f = liveFrame(bundle, trace, params, cursor);
  const symH = f.ready ? f.symH : 0;
  const peakSymH = tracePeak?.value ?? symH;

  return (
    <section aria-label="Consequences" className="pointer-events-auto w-full rounded-2xl border border-white/[0.06] bg-ink/55 px-4 py-3 backdrop-blur-md md:w-[290px]">
      <div className="flex items-baseline justify-between">
        <h2 className="micro !text-stone-300">What it does to us</h2>
        <span className="micro !tracking-[0.12em]">live</span>
      </div>
      <ul className="mt-1 divide-y divide-white/[0.06]">
        <AuroraRow symH={symH} />
        {SYSTEMS.map((s) => (
          <SystemRow key={s.id} system={s} symH={symH} peakSymH={peakSymH} />
        ))}
      </ul>
      <p className="mt-0.5 text-[10px] leading-snug text-stone-500 md:[@media(max-height:800px)]:hidden">
        Hollow bars: where this storm is headed. Illustrative thresholds, anchored to real events.
      </p>
    </section>
  );
}
