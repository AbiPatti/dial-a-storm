"use client";

import localFont from "next/font/local";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import { tierFor } from "@/lib/severity";
import { useDialStore } from "@/lib/store";
import type { Params } from "@/lib/types";
import { ChevronIcon } from "./icons";

/**
 * "Dial the solar wind": the instrument that rescales the observed drivers.
 *
 * Layout is a single surface divided by hairlines (header, readout, dials, advisory, action)
 * rather than nested cards. Numbers use a self-hosted monospace with tabular figures; units are
 * set smaller and dimmer than their values. Styles live under `.dp-*` in app/globals.css.
 */

// JetBrains Mono (SIL Open Font License), self-hosted; used for the panel's measurements only.
const mono = localFont({ src: "../../app/fonts/JetBrainsMono-Variable.woff2", weight: "400 600", variable: "--dp-mono", display: "swap" });

/** Typographic minus for negative readings. */
const signed = (v: number) => (v < 0 ? `−${Math.abs(v).toFixed(0)}` : v.toFixed(0));

/** Eases a displayed number toward its target; the first value appears immediately. */
function useTweened(target: number | null, ms = 320): number | null {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (target === null || from === null || from === target || prefersReducedMotion()) {
      current.current = target;
      setShown(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const v = k === 1 ? target : from + (target - from) * (1 - Math.pow(1 - k, 3));
      current.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

interface DialProps {
  label: string;
  caption: string;
  hint: string;
  value: number;
  axis: number[];
  onChange: (v: number) => void;
}

/**
 * One driver dial. The fill runs from the 1x (historic) mark to the thumb, so the direction and
 * size of the change read at a glance. Ticks mark the grid nodes the model was evaluated at.
 */
function Dial({ label, caption, hint, value, axis, onChange }: DialProps) {
  const id = useId();
  const min = axis[0];
  const max = axis[axis.length - 1];
  const frac = (v: number) => (v - min) / (max - min);
  const changed = Math.abs(value - 1) > 1e-9;
  const style = {
    ["--lo" as string]: frac(Math.min(value, 1)),
    ["--hi" as string]: frac(Math.max(value, 1)),
  } as CSSProperties;
  return (
    <div className="dp-dial" data-changed={changed || undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="dp-dial-label" title={hint}>
          {label}
          <span className="dp-dial-caption">{caption}</span>
        </label>
        <output htmlFor={id} className="dp-mult">
          <span className="dp-mult-x">×</span>
          {value.toFixed(2)}
        </output>
      </div>
      <div className="dp-track-wrap">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={0.01}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="dp-range"
          style={style}
          aria-valuetext={`${value.toFixed(2)} times the observed value`}
        />
        <div className="dp-ticks" aria-hidden="true">
          {axis.map((a) => (
            <span key={a} className={a === 1 ? "dp-tick dp-tick-ref" : "dp-tick"} style={{ left: `${frac(a) * 100}%` }} />
          ))}
          <span className="dp-scale-ref" style={{ left: `${frac(1) * 100}%` }}>
            1×
          </span>
        </div>
        <div className="dp-scale" aria-hidden="true">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
}

function PlayGlyph() {
  return (
    <svg width="8" height="9" viewBox="0 0 9 10" aria-hidden="true">
      <path d="M1 1.2v7.6c0 .4.45.65.8.43l6.1-3.8a.5.5 0 0 0 0-.86L1.8.77A.5.5 0 0 0 1 1.2z" fill="currentColor" />
    </svg>
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
  const body = useRef<HTMLDivElement>(null);

  // Collapse by default on small screens so the scene stays visible.
  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setOpen(false);
  }, []);
  // Collapsed controls leave the tab order and the accessibility tree.
  useEffect(() => {
    body.current?.toggleAttribute("inert", !open);
  }, [open]);

  const axes = bundle?.grid.axes ?? { bz: [0.5, 3], speed: [0.8, 1.5], density: [0.5, 3] };
  const isDefault = params.bz === 1 && params.speed === 1 && params.density === 1;
  const set = (k: keyof Params) => (v: number) => setParam(k, v);
  const peak = tracePeak?.value ?? null;
  const shown = useTweened(peak === null ? null : Math.round(peak));
  const peakTier = tierFor(peak ?? 0);
  const observed = bundle?.observedMin ?? null;
  const trainMax = bundle?.grid.trainMaxCoupling ?? manifest?.coupling.train_max_mV_m ?? 0;
  // Four of the 2023–2026 storms drove the magnetosphere harder than anything in 2010–2019, so
  // they are flagged even with every dial at ×1. Say so, so the flag does not read as a bug.
  const baselinePeak = bundle?.grid.baselinePeakCoupling ?? 0;
  const baselineBeyond = baselinePeak > trainMax;
  const extrapolationNote =
    manifest?.model.kind === "burton_fixture"
      ? "Read this replay as a physics extrapolation."
      : "The prediction is a linear extrapolation of the Ridge backbone, not an interpolation of anything the model has seen.";
  const maxOut = () => {
    setParam("bz", axes.bz[axes.bz.length - 1]);
    setParam("speed", axes.speed[axes.speed.length - 1]);
    setParam("density", axes.density[axes.density.length - 1]);
  };

  // Depth gauge: |what-if| and |observed| on one scale (SYM-H is negative in a storm).
  const depth = peak === null ? 0 : Math.max(0, -peak);
  const obsDepth = observed === null ? 0 : Math.max(0, -observed);
  const scale = Math.max(depth, obsDepth, 100) * 1.08;
  const ratio = obsDepth > 0 && peak !== null ? depth / obsDepth : null;

  return (
    <section aria-label="Solar wind dials" className={`dp-panel pointer-events-auto w-full sm:w-[316px] ${mono.variable}`}>
      {/* Header: the title doubles as the collapse control; actions sit in one quiet group. */}
      <header className="dp-header">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={bodyId} className="dp-title">
          Dial the solar wind
          <span className="dp-chevron">
            <ChevronIcon open={open} />
          </span>
        </button>
        <div className="dp-actions">
          <button type="button" className="dp-action" onClick={maxOut} disabled={!bundle} title="Every dial to the top of its grid">
            Max
          </button>
          <span className="dp-actions-sep" aria-hidden="true" />
          <button type="button" className="dp-action" onClick={resetParams} disabled={isDefault} title="Back to the observed solar wind (R)">
            Reset
          </button>
        </div>
      </header>

      {/* Central readout: the simulated peak against the observed one. */}
      <div className="dp-readout">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="dp-eyebrow">Peak what-if</div>
            <div className="dp-value" style={{ color: peak === null ? "rgb(100 116 139)" : peakTier.color }} data-testid="peak-whatif">
              {shown === null ? "—" : signed(shown)}
              <span className="dp-unit">nT</span>
            </div>
          </div>
          <div className="pb-[5px] text-right">
            <div className="dp-eyebrow">Observed</div>
            <div className="dp-observed">
              {observed === null ? "—" : signed(observed)}
              <span className="dp-unit">nT</span>
            </div>
          </div>
        </div>

        <div className="dp-gauge" aria-hidden="true">
          <span className="dp-gauge-fill" style={{ width: `${(depth / scale) * 100}%`, background: peakTier.color }} />
          {observed !== null && <span className="dp-gauge-obs" style={{ left: `${(obsDepth / scale) * 100}%` }} />}
        </div>
        <div className="dp-gauge-caption">
          <span>
            <span className="dp-tier" style={{ color: peakTier.color }}>
              {peakTier.display}
            </span>{" "}
            {peakTier.label}
          </span>
          {ratio !== null && (
            <span className="dp-num" title="Depth of the what-if peak relative to the observed peak">
              {(ratio * 100).toFixed(0)}%<span className="dp-unit">of observed</span>
            </span>
          )}
        </div>
      </div>

      {/* Dials, with an animated collapse (grid-rows 0fr -> 1fr). */}
      <div className="dp-collapse" data-open={open || undefined}>
        <div ref={body} id={bodyId} className="dp-collapse-inner">
          <div className="dp-dials">
            <Dial
              label="Southward Bz"
              caption="southward field only"
              hint="Scales the southward (Bz < 0) magnetic field only"
              value={params.bz}
              axis={axes.bz}
              onChange={set("bz")}
            />
            <Dial label="Wind speed" caption="bulk flow" hint="Scales the solar-wind speed" value={params.speed} axis={axes.speed} onChange={set("speed")} />
            <Dial
              label="Proton density"
              caption="particles / cm³"
              hint="Scales the solar-wind proton density"
              value={params.density}
              axis={axes.density}
              onChange={set("density")}
            />
          </div>
        </div>
      </div>

      {/* Advisory: shown whenever triggered, collapsed or not. */}
      {bundle && !inRange && (
        <div role="alert" className="dp-advisory">
          <div className="flex items-center justify-between gap-3">
            <span className="dp-advisory-status">
              <span className="dp-advisory-dot" aria-hidden="true" />
              BEYOND TRAINING DATA
            </span>
            <span className="dp-num dp-advisory-reading" aria-hidden="true">
              {peakCoupling.toFixed(1)}
              <span className="dp-advisory-limit"> / {trainMax.toFixed(1)}</span>
              <span className="dp-unit">mV/m</span>
            </span>
          </div>
          <p className="dp-advisory-body">
            {baselineBeyond ? (
              <>
                This storm, as it happened, already peaked at {baselinePeak.toFixed(1)} mV/m, above the strongest 2010–2019 training sample ({trainMax.toFixed(1)}{" "}
                mV/m). Even ×1 is outside the training data.{" "}
              </>
            ) : (
              <>Peak coupling {peakCoupling.toFixed(1)} mV/m exceeds the 2010–2019 maximum of {trainMax.toFixed(1)} mV/m. </>
            )}
            <span className="hidden sm:inline">{extrapolationNote}</span>
          </p>
        </div>
      )}

      {open && (
        <div className="dp-footer">
          <button type="button" onClick={simulate} disabled={!bundle} className="dp-simulate">
            <span className="dp-simulate-icon">
              <PlayGlyph />
            </span>
            Simulate from the start
          </button>
        </div>
      )}
    </section>
  );
}
