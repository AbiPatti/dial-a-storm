"use client";

import { useId } from "react";
import { formatDate, formatUtc } from "@/lib/live";
import { tierById } from "@/lib/severity";
import { useDialStore } from "@/lib/store";
import type { Params, StormRecord } from "@/lib/types";

interface SliderProps {
  label: string;
  sub: string;
  value: number;
  axis: number[];
  onChange: (v: number) => void;
  readout: string;
  accent: string;
}

function DriverSlider({ label, sub, value, axis, onChange, readout, accent }: SliderProps) {
  const id = useId();
  const min = axis[0];
  const max = axis[axis.length - 1];
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-100">
          {label}
          <span className="ml-1.5 text-[11px] font-normal text-slate-400">{sub}</span>
        </label>
        <span className="font-mono text-sm tabular-nums" style={{ color: accent }}>
          ×{value.toFixed(2)}
        </span>
      </div>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={0.01}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="dial-range w-full"
          style={{ ["--accent" as string]: accent, ["--fill" as string]: `${pct(value)}%` }}
          aria-valuetext={`${value.toFixed(2)} times; ${readout}`}
        />
        <div className="pointer-events-none relative mt-0.5 h-3" aria-hidden="true">
          {axis.map((a) => (
            <span key={a} className="absolute top-0 -translate-x-1/2 font-mono text-[9px] text-slate-500" style={{ left: `${pct(a)}%` }}>
              {a === 1 ? "1" : a}
            </span>
          ))}
        </div>
      </div>
      <div className="font-mono text-[11px] text-slate-400">{readout}</div>
    </div>
  );
}

function StormButton({ storm, active, onSelect }: { storm: StormRecord; active: boolean; onSelect: () => void }) {
  const tier = tierById(storm.g_tier);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition ${
        active ? "border-plasma-400/70 bg-plasma-400/10" : "border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/5"
      }`}
    >
      <span className="w-4 font-mono text-[10px] text-slate-500">{storm.rank}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-slate-100">{storm.name}</span>
        <span className="block font-mono text-[10px] text-slate-400">
          {formatDate(storm.peak_time)} · {storm.split}
          {storm.holdout && <span className="ml-1.5 rounded bg-rose-500/20 px-1 text-rose-300">HOLD-OUT</span>}
        </span>
      </span>
      <span className="font-mono text-xs tabular-nums" style={{ color: tier.color }}>
        {storm.peak_sym_h.toFixed(0)}
      </span>
    </button>
  );
}

const fmt = (v: number | null, d = 0) => (v === null || !Number.isFinite(v) ? "—" : v.toFixed(d));

export default function ControlDeck() {
  const storms = useDialStore((s) => s.storms);
  const activeId = useDialStore((s) => s.activeStormId);
  const stormStatus = useDialStore((s) => s.stormStatus);
  const bundle = useDialStore((s) => s.bundle);
  const params = useDialStore((s) => s.params);
  const playing = useDialStore((s) => s.playing);
  const cursor = useDialStore((s) => s.cursor);
  const playbackSeconds = useDialStore((s) => s.playbackSeconds);
  const { selectStorm, setParam, resetParams, simulate, togglePlay, seek, pause, setPlaybackSeconds } = useDialStore.getState();

  const storm = storms.find((s) => s.id === activeId) ?? null;
  const axes = bundle?.grid.axes ?? { bz: [0.5, 3], speed: [0.8, 1.5], density: [0.5, 3] };
  const n = bundle?.window.n_times ?? 1;
  const isDefault = params.bz === 1 && params.speed === 1 && params.density === 1;

  const set = (k: keyof Params) => (v: number) => setParam(k, v);

  return (
    <aside className="glass pointer-events-auto flex max-h-[calc(100svh-2rem)] flex-col gap-4 overflow-y-auto p-4" aria-label="Storm controls">
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">1 · Pick a historic storm</h2>
        <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {storms.map((s) => (
            <StormButton key={s.id} storm={s} active={s.id === activeId} onSelect={() => selectStorm(s.id)} />
          ))}
        </div>
        {stormStatus === "loading" && <p className="mt-2 text-xs text-slate-400">Loading scenario grid…</p>}
        {stormStatus === "error" && <p className="mt-2 text-xs text-rose-300">Could not load this storm.</p>}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">2 · Dial the solar wind</h2>
          <button
            type="button"
            onClick={resetParams}
            disabled={isDefault}
            className="rounded px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/10 disabled:opacity-40"
          >
            Reset
          </button>
        </div>
        <DriverSlider
          label="Southward Bz"
          sub="scales Bz < 0 only"
          value={params.bz}
          axis={axes.bz}
          onChange={set("bz")}
          accent="#f472b6"
          readout={`storm min Bz ${fmt(storm?.min_bz_nT != null ? Math.min(storm.min_bz_nT, 0) * params.bz : null, 1)} nT`}
        />
        <DriverSlider
          label="Wind speed"
          sub="v"
          value={params.speed}
          axis={axes.speed}
          onChange={set("speed")}
          accent="#fdba74"
          readout={`storm max ${fmt(storm?.max_speed_km_s != null ? storm.max_speed_km_s * params.speed : null)} km/s`}
        />
        <DriverSlider
          label="Proton density"
          sub="n"
          value={params.density}
          axis={axes.density}
          onChange={set("density")}
          accent="#7dd3fc"
          readout={`storm peak Pdyn ${fmt(storm?.max_pdyn_nPa != null ? storm.max_pdyn_nPa * params.density * params.speed ** 2 : null, 1)} nPa`}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">3 · Replay the magnetosphere</h2>
        <button
          type="button"
          onClick={simulate}
          disabled={!bundle}
          className="w-full rounded-lg bg-gradient-to-r from-plasma-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold tracking-wide text-white shadow-[0_0_24px_rgba(56,189,248,0.35)] transition hover:brightness-110 disabled:opacity-40"
        >
          ▶ Simulate
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!bundle}
            aria-label={playing ? "Pause" : "Play"}
            className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 disabled:opacity-40"
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button
            type="button"
            onClick={() => seek(0)}
            disabled={!bundle}
            aria-label="Restart"
            className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 disabled:opacity-40"
          >
            ⟲
          </button>
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
            className="dial-range flex-1"
            style={{ ["--accent" as string]: "#e2e8f0", ["--fill" as string]: `${(cursor / Math.max(1, n - 1)) * 100}%` }}
            aria-label="Scrub playback time"
            aria-valuetext={bundle ? formatUtc(bundle.t0Ms + cursor * bundle.window.cadence_minutes * 60_000) : undefined}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-mono">{bundle ? formatUtc(bundle.t0Ms + cursor * bundle.window.cadence_minutes * 60_000) : "—"}</span>
          <label className="flex items-center gap-1.5">
            replay
            <select
              value={playbackSeconds}
              onChange={(e) => setPlaybackSeconds(Number(e.target.value))}
              className="rounded border border-white/10 bg-void/80 px-1 py-0.5 text-slate-200"
            >
              <option value={12}>12 s</option>
              <option value={24}>24 s</option>
              <option value={48}>48 s</option>
            </select>
          </label>
        </div>
      </section>
    </aside>
  );
}
