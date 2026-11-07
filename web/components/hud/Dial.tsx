"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useDialStore } from "@/lib/store";
import type { Params } from "@/lib/types";

/**
 * The app's one control: a dial that turns up the Sun. It drives southward Bz, speed and density
 * together (store.setIntensity). "Fine-tune" opens the three individual sliders.
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

function FineSlider({ label, k, value, axis, onChange }: { label: string; k: keyof Params; value: number; axis: number[]; onChange: (k: keyof Params, v: number) => void }) {
  const id = useId();
  return (
    <div>
      <div className="flex justify-between text-xs">
        <label htmlFor={id} className="text-stone-300">
          {label}
        </label>
        <span className="font-mono tabular-nums text-stone-400">×{value.toFixed(2)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={axis[0]}
        max={axis[axis.length - 1]}
        step={0.01}
        value={value}
        onChange={(e) => onChange(k, Number(e.target.value))}
        className="dial-range w-full"
        style={{ ["--accent" as string]: "#e7e5e4", ["--fill" as string]: `${((value - axis[0]) / (axis[axis.length - 1] - axis[0])) * 100}%` }}
      />
    </div>
  );
}

export default function Dial() {
  const params = useDialStore((s) => s.params);
  const bundle = useDialStore((s) => s.bundle);
  const svgRef = useRef<SVGSVGElement>(null);
  const [fine, setFine] = useState(false);
  const k = Math.min(K_MAX, Math.max(K_MIN, params.bz));
  const color = dialColor(k);
  const axes = bundle?.grid.axes ?? { bz: [0.5, 3], speed: [0.8, 1.5], density: [0.5, 3] };
  const isDefault = params.bz === 1 && params.speed === 1 && params.density === 1;

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
    useDialStore.getState().setIntensity(Math.min(K_MAX, Math.max(K_MIN, Math.round(next * 100) / 100)));
  };

  const [kx, ky] = polar(toAngle(k));
  const [ox, oy] = polar(toAngle(1), R + 12);
  const word = Math.abs(k - 1) < 0.03 ? "as it happened" : k < 1 ? "a gentler Sun" : "a stronger Sun";

  return (
    <section aria-label="Storm dial" className="pointer-events-auto flex flex-col items-center">
      <svg
        ref={svgRef}
        viewBox="0 0 200 200"
        className="h-48 w-48 cursor-grab touch-none select-none outline-none active:cursor-grabbing md:h-56 md:w-56"
        role="slider"
        tabIndex={0}
        aria-label="Storm intensity"
        aria-valuemin={K_MIN}
        aria-valuemax={K_MAX}
        aria-valuenow={Number(k.toFixed(2))}
        aria-valuetext={`${k.toFixed(2)} times the real storm`}
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
        </defs>
        {/* ticks */}
        {Array.from({ length: 28 }, (_, i) => {
          const deg = START + (i / 27) * SWEEP;
          const [x0, y0] = polar(deg, R + 6);
          const [x1, y1] = polar(deg, R + (i % 3 === 0 ? 11 : 8));
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="rgba(231,229,228,0.18)" strokeWidth="1" />;
        })}
        <path d={arc(START, START + SWEEP)} stroke="rgba(231,229,228,0.1)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d={arc(START, toAngle(k))} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.5" filter="url(#dialGlow)" />
        <path d={arc(START, toAngle(k))} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* "real" marker at x1 */}
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

      <div className="mt-3 flex items-center gap-3 text-[11px] text-stone-400">
        <button type="button" onClick={() => setFine((v) => !v)} aria-expanded={fine} className="underline-offset-4 hover:text-stone-200 hover:underline">
          {fine ? "close" : "fine-tune"}
        </button>
        <button
          type="button"
          onClick={() => useDialStore.getState().resetParams()}
          disabled={isDefault}
          className="underline-offset-4 hover:text-stone-200 hover:underline disabled:opacity-30 disabled:hover:no-underline"
        >
          Reset
        </button>
      </div>

      {fine && (
        <div className="mt-3 w-56 space-y-3 rounded-xl border border-white/10 bg-ink/80 p-3 backdrop-blur-md">
          <FineSlider label="Southward Bz" k="bz" value={params.bz} axis={axes.bz} onChange={(key, v) => useDialStore.getState().setParam(key, v)} />
          <FineSlider label="Wind speed" k="speed" value={params.speed} axis={axes.speed} onChange={(key, v) => useDialStore.getState().setParam(key, v)} />
          <FineSlider label="Proton density" k="density" value={params.density} axis={axes.density} onChange={(key, v) => useDialStore.getState().setParam(key, v)} />
        </div>
      )}
    </section>
  );
}
