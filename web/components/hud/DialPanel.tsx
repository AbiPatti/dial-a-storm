"use client";

import { useEffect, useId, useState } from "react";
import { tierFor } from "@/lib/severity";
import { useDialStore } from "@/lib/store";
import type { Params } from "@/lib/types";
import { ChevronIcon } from "./icons";

interface DialProps {
  label: string;
  hint: string;
  value: number;
  axis: number[];
  onChange: (v: number) => void;
}

/** One driver slider. Tick dots mark the grid nodes the model was actually evaluated at. */
function Dial({ label, hint, value, axis, onChange }: DialProps) {
  const id = useId();
  const min = axis[0];
  const max = axis[axis.length - 1];
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const changed = Math.abs(value - 1) > 1e-9;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[12.5px] text-slate-200" title={hint}>
          {label}
        </label>
        <span className={`font-mono text-[12px] tabular-nums ${changed ? "text-plasma-300" : "text-slate-500"}`}>×{value.toFixed(2)}</span>
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
          className="dial-range relative z-[1] block w-full"
          style={{ ["--accent" as string]: "#7dd3fc", ["--fill" as string]: `${pct(value)}%` }}
          aria-valuetext={`${value.toFixed(2)} times the observed value`}
        />
        <div className="pointer-events-none absolute inset-x-[8px] top-[13px] h-1" aria-hidden="true">
          {axis.map((a) => (
            <span
              key={a}
              className={`absolute h-1 w-px -translate-x-1/2 ${a === 1 ? "bg-slate-300/70" : "bg-slate-500/40"}`}
              style={{ left: `${pct(a)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DialPanel() {
  const bundle = useDialStore((s) => s.bundle);
  const params = useDialStore((s) => s.params);
  const inRange = useDialStore((s) => s.inRange);
  const peakCoupling = useDialStore((s) => s.peakCoupling);
  const tracePeak = useDialStore((s) => s.tracePeak);
  const manifest = useDialStore((s) => s.manifest);
  const { setParam, resetParams, simulate } = useDialStore.getState();
  const [open, setOpen] = useState(true);
  const bodyId = useId();

  // Collapse by default on small screens so the scene stays visible.
  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setOpen(false);
  }, []);

  const axes = bundle?.grid.axes ?? { bz: [0.5, 3], speed: [0.8, 1.5], density: [0.5, 3] };
  const isDefault = params.bz === 1 && params.speed === 1 && params.density === 1;
  const set = (k: keyof Params) => (v: number) => setParam(k, v);
  const peak = tracePeak?.value ?? null;
  const peakTier = tierFor(peak ?? 0);
  const observed = bundle?.observedMin ?? null;
  const trainMax = bundle?.grid.trainMaxCoupling ?? manifest?.coupling.train_max_mV_m ?? 0;
  const extrapolationNote =
    manifest?.model.kind === "burton_fixture"
      ? "No 2010–2019 training sample was driven this hard; read this replay as a physics extrapolation."
      : "The prediction is a linear extrapolation of the Ridge backbone, not an interpolation of anything the model has seen.";
  const maxOut = () => {
    setParam("bz", axes.bz[axes.bz.length - 1]);
    setParam("speed", axes.speed[axes.speed.length - 1]);
    setParam("density", axes.density[axes.density.length - 1]);
  };

  return (
    <section aria-label="Solar wind dials" className="glass pointer-events-auto w-full p-3 sm:w-[300px]">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex items-center gap-1.5 rounded-md text-left"
        >
          <span className="whitespace-nowrap text-[13px] font-medium text-slate-100">Dial the solar wind</span>
          <span className="text-slate-500">
            <ChevronIcon open={open} />
          </span>
        </button>
        <div className="flex gap-1">
          <button type="button" className="chip" onClick={maxOut} disabled={!bundle} title="Every dial to the top of its grid">
            Max
          </button>
          <button type="button" className="chip" onClick={resetParams} disabled={isDefault} title="Back to the observed solar wind (R)">
            Reset
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-3 rounded-[10px] bg-white/[0.035] px-3 py-2">
        <div>
          <div className="text-[10.5px] text-slate-400">Peak what-if</div>
          <div className="font-mono text-[22px] leading-tight tabular-nums" style={{ color: peakTier.color }} data-testid="peak-whatif">
            {peak === null ? "—" : peak.toFixed(0)}
            <span className="ml-1 text-[11px] text-slate-500">nT</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[11px] font-semibold" style={{ color: peakTier.color }}>
            {peakTier.display}
          </div>
          <div className="text-[10.5px] text-slate-500">
            observed <span className="font-mono tabular-nums text-slate-300">{observed === null ? "—" : observed.toFixed(0)}</span> nT
          </div>
        </div>
      </div>

      {open && (
        <div id={bodyId} className="mt-3 space-y-2.5">
          <Dial label="Southward Bz" hint="Scales the southward (Bz < 0) magnetic field only" value={params.bz} axis={axes.bz} onChange={set("bz")} />
          <Dial label="Wind speed" hint="Scales the solar-wind speed" value={params.speed} axis={axes.speed} onChange={set("speed")} />
          <Dial label="Proton density" hint="Scales the solar-wind proton density" value={params.density} axis={axes.density} onChange={set("density")} />
        </div>
      )}

      {bundle && !inRange && (
        <div role="alert" className="mt-3 rounded-[10px] border border-alert-500/50 bg-alert-500/10 px-2.5 py-2 text-[11.5px] leading-snug text-alert-300">
          <div className="font-mono text-[10px] font-bold tracking-wider">BEYOND TRAINING DATA</div>
          <p className="mt-0.5 text-alert-300/90">
            Peak coupling {peakCoupling.toFixed(1)} mV/m exceeds the 2010–2019 maximum of {trainMax.toFixed(1)} mV/m.{" "}
            <span className="hidden sm:inline">{extrapolationNote}</span>
          </p>
        </div>
      )}

      {open && (
        <button
          type="button"
          onClick={simulate}
          disabled={!bundle}
          className="mt-3 w-full rounded-[10px] bg-plasma-300 px-3 py-2 text-[13px] font-semibold text-void transition hover:bg-white disabled:opacity-40"
        >
          Simulate from the start
        </button>
      )}
    </section>
  );
}
