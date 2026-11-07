"use client";

import { useMemo } from "react";
import { liveFrame } from "@/lib/live";
import { useDialStore } from "@/lib/store";

/**
 * Bottom edge: play button, a bare sparkline of the storm (what really happened vs the model's
 * what-if) that doubles as the scrubber, and a storm switcher. No axes, no boxes.
 */

const W = 1000;
const H = 56;

function path(values: ArrayLike<number | null>, n: number, y: (v: number) => number) {
  let d = "";
  let pen = false;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v === null || v === undefined || !Number.isFinite(v)) {
      pen = false;
      continue;
    }
    const x = (i / Math.max(1, n - 1)) * W;
    d += `${pen ? "L" : "M"}${x.toFixed(1)} ${y(v).toFixed(1)} `;
    pen = true;
  }
  return d;
}

export default function StormBar() {
  const bundle = useDialStore((s) => s.bundle);
  const trace = useDialStore((s) => s.activeTrace);
  const params = useDialStore((s) => s.params);
  const cursor = useDialStore((s) => s.cursor);
  const playing = useDialStore((s) => s.playing);
  const storms = useDialStore((s) => s.storms);
  const activeId = useDialStore((s) => s.activeStormId);
  const stormStatus = useDialStore((s) => s.stormStatus);
  const { togglePlay, seek, pause, selectStorm } = useDialStore.getState();

  const f = liveFrame(bundle, trace, params, cursor);
  const n = bundle?.window.n_times ?? 1;
  const idx = storms.findIndex((s) => s.id === activeId);
  const storm = idx >= 0 ? storms[idx] : null;

  const lines = useMemo(() => {
    if (!bundle || !trace) return null;
    const obs = bundle.window.series.sym_h_observed;
    let lo = -60;
    let hi = 20;
    for (let i = 0; i < trace.length; i++) lo = Math.min(lo, trace[i]);
    for (const v of obs) if (v !== null) lo = Math.min(lo, v);
    const y = (v: number) => 4 + ((hi - v) / (hi - lo)) * (H - 8);
    return { obs: path(obs, n, y), what: path(trace, n, y), zero: y(0) };
  }, [bundle, trace, n]);

  const go = (d: number) => {
    if (!storms.length) return;
    const next = storms[(idx + d + storms.length) % storms.length];
    void selectStorm(next.id);
  };
  const playX = (cursor / Math.max(1, n - 1)) * 100;

  return (
    <section aria-label="Timeline" className="pointer-events-auto flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!bundle}
          aria-label={playing ? "Pause" : "Play"}
          className="grid h-14 w-14 place-items-center rounded-full bg-stone-100 text-ink shadow-[0_0_40px_rgba(255,180,120,0.25)] transition hover:scale-105 disabled:opacity-40"
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor" />
              <rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 2.5v11l9.5-5.5z" fill="currentColor" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => seek(0)}
          disabled={!bundle}
          aria-label="Restart"
          className="grid h-9 w-9 place-items-center rounded-full text-stone-400 transition hover:bg-white/5 hover:text-stone-100 disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="relative min-w-0 flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-14 w-full overflow-visible" role="img" aria-label="Storm strength over time: observed and what-if">
          {lines && (
            <>
              <line x1="0" x2={W} y1={lines.zero} y2={lines.zero} stroke="rgba(231,229,228,0.12)" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
              <path d={lines.obs} fill="none" stroke="rgba(231,229,228,0.45)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <path d={lines.what} fill="none" stroke={f.tier.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        <div className="pointer-events-none absolute inset-y-0 w-px bg-stone-100/70" style={{ left: `${playX}%` }} aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={n - 1}
          step={0.25}
          value={cursor}
          disabled={!bundle}
          onChange={(e) => {
            pause();
            seek(Number(e.target.value));
          }}
          aria-label="Scrub playback time"
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-stone-500">
          <span>
            <span className="mr-1 inline-block h-px w-3 bg-stone-400 align-middle" /> what happened
          </span>
          <span>
            <span className="mr-1 inline-block h-0.5 w-3 align-middle" style={{ backgroundColor: f.tier.color }} /> your storm
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-1.5 md:items-end">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go(-1)} aria-label="Previous storm" className="grid h-7 w-7 place-items-center rounded-full text-stone-400 hover:bg-white/5 hover:text-stone-100">
            ‹
          </button>
          <div className="min-w-[170px] text-center">
            <div className="font-serif text-lg leading-tight text-stone-100">{storm?.name ?? "—"}</div>
            {stormStatus === "error" && <div className="text-[11px] text-crimson-400">Could not load this storm.</div>}
          </div>
          <button type="button" onClick={() => go(1)} aria-label="Next storm" className="grid h-7 w-7 place-items-center rounded-full text-stone-400 hover:bg-white/5 hover:text-stone-100">
            ›
          </button>
        </div>
        <div className="flex gap-1.5 self-center">
          {storms.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => void selectStorm(s.id)}
              aria-pressed={s.id === activeId}
              aria-label={`${s.name}${s.holdout ? " (hold-out)" : ""}`}
              className={`h-1.5 rounded-full transition-all ${s.id === activeId ? "w-5 bg-stone-100" : "w-1.5 bg-stone-600 hover:bg-stone-400"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
