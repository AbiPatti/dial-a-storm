"use client";

import { useCallback, useRef } from "react";
import { onIntensityCurve, useDialStore } from "@/lib/store";

/**
 * The simulator's one control: a knob that turns up the Sun. It drives southward Bz, speed and
 * density together (store.setIntensity). "Fine-tune" opens the full solar-wind panel (three
 * sliders, Max, Reset, Simulate) as a popover.
 *
 * The BEYOND TRAINING DATA flag must never be hidden (docs/ENGINEERING.md rule 7), so a compact
 * version stays under the knob even while the fine-tune panel is closed.
 */

const K_MIN = 0.5;
const K_MAX = 3;
const SWEEP = 270; // degrees of travel
const START = -135; // degrees from 12 o'clock
const R = 78;
const C = 100;

const toAngle = (k: number) => START + ((k - K_MIN) / (K_MAX - K_MIN)) * SWEEP;
const polar = (deg: number, r = R) => {
  const a = ((deg - 90) * Math.PI) / 180;
  // Rounded so server and client render identical attributes (no hydration mismatch).
  const round = (v: number) => Math.round(v * 100) / 100;
  return [round(C + r * Math.cos(a)), round(C + r * Math.sin(a))] as const;
};
function arc(from: number, to: number, r = R) {
  const [x0, y0] = polar(from, r);
  const [x1, y1] = polar(to, r);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/** mint -> amber -> crimson along the dial. */
function dialColor(k: number) {
  const t = (k - K_MIN) / (K_MAX - K_MIN);
  if (t < 0.2) return "#7dffc8";
  if (t < 0.45) return "#fcd34d";
  if (t < 0.7) return "#fb923c";
  return "#fb3b5b";
}

export default function StormDial() {
  const params = useDialStore((s) => s.params);
  const bundle = useDialStore((s) => s.bundle);
  const inRange = useDialStore((s) => s.inRange);
  const peakCoupling = useDialStore((s) => s.peakCoupling);
  const tuneOpen = useDialStore((s) => s.panel === "tune");
  const svgRef = useRef<SVGSVGElement>(null);
  const k = Math.min(K_MAX, Math.max(K_MIN, params.bz));
  const color = dialColor(k);
  const isDefault = params.bz === 1 && params.speed === 1 && params.density === 1;
  const custom = !onIntensityCurve(params);
  const trainMax = bundle?.grid.trainMaxCoupling ?? 0;

  const fromPointer = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const dx = clientX - (box.left + box.width / 2);
    const dy = clientY - (box.top + box.height / 2);
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90; // 0 at 12 o'clock
    if (deg > 180) deg -= 360;
    deg = Math.max(START, Math.min(START + SWEEP, deg));
    const next = K_MIN + ((deg - START) / SWEEP) * (K_MAX - K_MIN);
    useDialStore.getState().setIntensity(Math.round(next * 20) / 20);
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.25 : 0.05;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = k + step;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = k - step;
    if (e.key === "Home") next = K_MIN;
    if (e.key === "End") next = K_MAX;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    useDialStore.getState().setIntensity(Math.min(K_MAX, Math.max(K_MIN, Math.round(next * 100) / 100)));
  };

  const [kx, ky] = polar(toAngle(k));
  const [ox, oy] = polar(toAngle(1), R + 12);
  const word = custom ? "fine-tuned" : Math.abs(k - 1) < 0.03 ? "as it happened" : k < 1 ? "a gentler Sun" : "a stronger Sun";

  return (
    <section aria-label="Storm dial" className="pointer-events-auto flex w-[180px] flex-col items-center rounded-2xl border border-white/[0.06] bg-ink/55 px-2 pb-3 pt-1 backdrop-blur-md sm:w-[220px]">
      <svg
        ref={svgRef}
        viewBox="0 0 200 200"
        className="h-28 w-28 cursor-grab touch-none select-none outline-none focus-visible:drop-shadow-[0_0_8px_rgba(255,179,138,0.6)] active:cursor-grabbing sm:h-44 sm:w-44 md:h-48 md:w-48"
        role="slider"
        tabIndex={0}
        aria-label="Storm intensity"
        aria-valuemin={K_MIN}
        aria-valuemax={K_MAX}
        aria-valuenow={Number(k.toFixed(2))}
        aria-valuetext={`${k.toFixed(2)} times the real storm${custom ? ", fine-tuned" : ""}`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          fromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons) fromPointer(e.clientX, e.clientY);
        }}
      >
        <defs>
          <filter id="dialGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <radialGradient id="dialFace">
            <stop offset="0%" stopColor="rgba(12,10,14,0.85)" />
            <stop offset="100%" stopColor="rgba(12,10,14,0.35)" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={R - 6} fill="url(#dialFace)" />
        {Array.from({ length: 28 }, (_, i) => {
          const deg = START + (i / 27) * SWEEP;
          const [x0, y0] = polar(deg, R + 6);
          const [x1, y1] = polar(deg, R + (i % 3 === 0 ? 11 : 8));
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="rgba(231,229,228,0.18)" strokeWidth="1" />;
        })}
        <path d={arc(START, START + SWEEP)} stroke="rgba(231,229,228,0.1)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d={arc(START, toAngle(k))} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.5" filter="url(#dialGlow)" />
        <path d={arc(START, toAngle(k))} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* "as it happened" marker at ×1 */}
        <circle cx={ox} cy={oy} r="2" fill="#e7e5e4" opacity="0.7" />
        <circle cx={kx} cy={ky} r="7" fill="#0c0a0e" stroke={color} strokeWidth="2.5" />
        <text x={C} y={C + 4} textAnchor="middle" className="fill-stone-100 font-serif" fontSize="44">
          ×{k.toFixed(1)}
        </text>
        <text x={C} y={C + 26} textAnchor="middle" className="fill-stone-400 font-mono" fontSize="8.5" letterSpacing="1.5">
          {word.toUpperCase()}
        </text>
      </svg>
      <p className="micro -mt-2">Turn up the Sun</p>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-stone-400">
        <button
          type="button"
          onClick={() => useDialStore.getState().openPanel(tuneOpen ? null : "tune")}
          aria-expanded={tuneOpen}
          aria-haspopup="dialog"
          className="underline-offset-4 hover:text-stone-200 hover:underline"
        >
          {tuneOpen ? "Close fine-tune" : "Fine-tune"}
        </button>
        <button
          type="button"
          onClick={() => useDialStore.getState().resetParams()}
          disabled={isDefault}
          aria-label="Reset dial"
          className="underline-offset-4 hover:text-stone-200 hover:underline disabled:opacity-30 disabled:hover:no-underline"
        >
          Reset
        </button>
      </div>

      {bundle && !inRange && !tuneOpen && (
        <p role="alert" data-testid="dial-advisory" className="mt-2 text-center text-[10.5px] leading-snug text-alert-300">
          <span className="font-mono text-[9.5px] font-bold tracking-wider">BEYOND TRAINING DATA</span>
          <br />
          coupling {peakCoupling.toFixed(1)} mV/m vs {trainMax.toFixed(1)} max (2010–2019)
        </p>
      )}
    </section>
  );
}
