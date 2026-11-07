"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { formatUtc, monthDay } from "@/lib/live";
import { sampleNullable } from "@/lib/interpolate";
import { THRESHOLDS } from "@/lib/severity";
import { useDialStore } from "@/lib/store";

export interface ChartSeries {
  id: string;
  label: string;
  values: ArrayLike<number | null>;
  color: string;
  width?: number;
  dash?: string;
  opacity?: number;
  /** Draw the full line dimmed and the part left of the cursor at full strength. */
  revealToCursor?: boolean;
}

export interface ComparisonChartProps {
  t0Ms: number;
  cadenceMinutes: number;
  n: number;
  series: ChartSeries[];
  ariaLabel: string;
  cursor?: number | null;
  onScrub?: (index: number) => void;
  stormSpan?: [number, number] | null;
  height?: number;
  yDomain?: [number, number];
  showLegend?: boolean;
  /** Draw the UTC time above the playback needle (off when the host shows the time itself). */
  cursorLabel?: boolean;
  margins?: typeof M;
  /** Vertical event markers (e.g. shock arrival, peak) at fractional sample indices. */
  markers?: { index: number; label: string; color: string }[];
}

export const M = { top: 14, right: 58, bottom: 24, left: 46 };
/** Margins for the compact dock chart (tier lines without right-hand labels). */
export const COMPACT_M = { top: 6, right: 12, bottom: 20, left: 40 };
const HOUR_MS = 3_600_000;
const DEFAULT_M = M;

function useElementWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Nice y-domain: floor the minimum to 50 nT (100 nT below -400) and keep at least [-100, 25]. */
export function niceDomain(min: number, max: number): [number, number] {
  const lo0 = Math.min(min, -100);
  const step = lo0 < -400 ? 100 : 50;
  const lo = Math.floor((lo0 - 0.06 * Math.abs(lo0)) / step) * step;
  const hi = Math.max(25, Math.ceil((max + 10) / 25) * 25);
  return [lo, hi];
}

function extent(series: ChartSeries[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of series) {
    for (let i = 0; i < s.values.length; i++) {
      const v = s.values[i];
      if (v === null || !Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return Number.isFinite(lo) ? [lo, hi] : [-100, 25];
}

function linePath(values: ArrayLike<number | null>, x: (i: number) => number, y: (v: number) => number): string {
  let d = "";
  let pen = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || !Number.isFinite(v)) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  }
  return d;
}

function timeTicks(t0Ms: number, spanMs: number, maxTicks: number): number[] {
  const steps = [3, 6, 12, 24, 48, 96];
  const hours = spanMs / HOUR_MS;
  const step = steps.find((s) => hours / s <= maxTicks) ?? 96;
  const stepMs = step * HOUR_MS;
  const first = Math.ceil(t0Ms / stepMs) * stepMs;
  const out: number[] = [];
  for (let t = first; t <= t0Ms + spanMs; t += stepMs) out.push(t);
  return out;
}

function yTicks(lo: number, hi: number): number[] {
  const span = hi - lo;
  const step = span > 1200 ? 400 : span > 600 ? 200 : span > 300 ? 100 : 50;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

export default function ComparisonChart({
  t0Ms,
  cadenceMinutes,
  n,
  series,
  ariaLabel,
  cursor = null,
  onScrub,
  stormSpan = null,
  height = 220,
  yDomain,
  showLegend = true,
  cursorLabel = true,
  margins: M = DEFAULT_M,
  markers = [],
}: ComparisonChartProps) {
  const uid = useId().replace(/:/g, "");
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(720);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const [lo, hi] = useMemo(() => yDomain ?? niceDomain(...extent(series)), [yDomain, series]);
  const plotW = Math.max(10, width - M.left - M.right);
  const plotH = Math.max(10, height - M.top - M.bottom);
  const stepMs = cadenceMinutes * 60_000;
  const spanMs = (n - 1) * stepMs;

  const x = useCallback((i: number) => M.left + (i / Math.max(1, n - 1)) * plotW, [n, plotW]);
  const y = useCallback((v: number) => M.top + ((hi - v) / (hi - lo)) * plotH, [hi, lo, plotH]);

  const paths = useMemo(() => series.map((s) => ({ ...s, d: linePath(s.values, x, y) })), [series, x, y]);
  const xTickTimes = useMemo(() => timeTicks(t0Ms, spanMs, Math.max(2, Math.floor(plotW / 90))), [t0Ms, spanMs, plotW]);
  const yTickValues = useMemo(() => yTicks(lo, hi), [lo, hi]);

  const indexFromEvent = (e: ReactPointerEvent<SVGRectElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const px = e.clientX - rect.left;
    return Math.min(n - 1, Math.max(0, ((px - M.left) / plotW) * (n - 1)));
  };

  const cx = cursor === null ? null : x(cursor);
  const g5Top = y(-250);

  return (
    <div ref={wrapRef} className="w-full select-none">
      {showLegend && (
        <ul className="mb-1.5 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-slate-300">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} opacity={s.opacity ?? 1} />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <svg ref={svgRef} width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
        <defs>
          <clipPath id={`${uid}-plot`}>
            <rect x={M.left} y={M.top} width={plotW} height={plotH} />
          </clipPath>
          {cx !== null && (
            <clipPath id={`${uid}-reveal`}>
              <rect x={M.left} y={0} width={Math.max(0, cx - M.left)} height={height} />
            </clipPath>
          )}
        </defs>

        {/* Storm interval (SYM-H < -50 nT) */}
        {stormSpan && (
          <rect x={x(stormSpan[0])} y={M.top} width={Math.max(0, x(stormSpan[1]) - x(stormSpan[0]))} height={plotH} fill="rgba(148,163,184,0.06)" />
        )}

        {/* G5 band */}
        {g5Top < M.top + plotH && (
          <rect x={M.left} y={Math.max(M.top, g5Top)} width={plotW} height={M.top + plotH - Math.max(M.top, g5Top)} fill="rgba(244,63,94,0.07)" />
        )}

        {/* y grid */}
        {yTickValues.map((v) => (
          <g key={`y${v}`}>
            <line x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} stroke={v === 0 ? "rgba(226,232,240,0.28)" : "rgba(148,163,184,0.10)"} />
            <text x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-slate-400 font-mono text-[10px]">
              {v}
            </text>
          </g>
        ))}
        {M.left > 44 && (
          <text x={12} y={M.top + plotH / 2} transform={`rotate(-90 12 ${M.top + plotH / 2})`} textAnchor="middle" className="fill-slate-500 text-[10px]">
            SYM-H (nT)
          </text>
        )}

        {/* NOAA G-scale thresholds */}
        {THRESHOLDS.map(({ value, tier }) =>
          value > lo && value < hi ? (
            <g key={`t${value}`}>
              <line x1={M.left} x2={M.left + plotW} y1={y(value)} y2={y(value)} stroke={tier.color} strokeOpacity={0.55} strokeDasharray="3 4" />
              {M.right > 40 && (
                <text x={M.left + plotW + 6} y={y(value)} dy="0.32em" className="font-mono text-[10px]" fill={tier.color}>
                  {tier.display}
                </text>
              )}
            </g>
          ) : null,
        )}

        {/* x ticks */}
        {xTickTimes.map((t) => {
          const i = (t - t0Ms) / stepMs;
          const d = new Date(t);
          const midnight = d.getUTCHours() === 0;
          return (
            <g key={`x${t}`}>
              <line x1={x(i)} x2={x(i)} y1={M.top + plotH} y2={M.top + plotH + 4} stroke="rgba(148,163,184,0.5)" />
              <text x={x(i)} y={M.top + plotH + 15} textAnchor="middle" className="fill-slate-400 font-mono text-[10px]">
                {midnight ? monthDay(t) : `${String(d.getUTCHours()).padStart(2, "0")}Z`}
              </text>
            </g>
          );
        })}

        {/* Series */}
        <g clipPath={`url(#${uid}-plot)`}>
          {paths.map((s) =>
            s.revealToCursor && cx !== null ? (
              <g key={s.id}>
                <path d={s.d} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeOpacity={(s.opacity ?? 1) * 0.28} strokeDasharray={s.dash} />
                <path
                  d={s.d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.width ?? 2}
                  strokeOpacity={s.opacity ?? 1}
                  strokeDasharray={s.dash}
                  clipPath={`url(#${uid}-reveal)`}
                  style={{ filter: `drop-shadow(0 0 4px ${s.color})` }}
                />
              </g>
            ) : (
              <path key={s.id} d={s.d} fill="none" stroke={s.color} strokeWidth={s.width ?? 1.5} strokeOpacity={s.opacity ?? 1} strokeDasharray={s.dash} strokeLinejoin="round" />
            ),
          )}
        </g>

        {/* Event markers */}
        {[...markers]
          .sort((a, b) => a.index - b.index)
          .map((m, i, all) => {
            // Stack a label under its neighbour when the two markers are too close to read.
            const close = i > 0 && x(m.index) - x(all[i - 1].index) < 36;
            return (
              <g key={m.label} pointerEvents="none">
                <line x1={x(m.index)} x2={x(m.index)} y1={M.top} y2={M.top + plotH} stroke={m.color} strokeOpacity={0.7} strokeDasharray="2 3" />
                <text x={x(m.index) + 3} y={M.top + (close ? 18 : 8)} className="font-mono text-[9px]" fill={m.color}>
                  {m.label}
                </text>
              </g>
            );
          })}

        {/* Playback needle */}
        {cursor !== null && cx !== null && (
          <g pointerEvents="none">
            <line x1={cx} x2={cx} y1={M.top} y2={M.top + plotH} stroke="rgba(255,255,255,0.75)" strokeWidth={1} />
            {series.map((s) => {
              const v = sampleNullable(s.values, cursor);
              return v === null ? null : <circle key={s.id} cx={cx} cy={y(Math.min(hi, Math.max(lo, v)))} r={3.2} fill={s.color} stroke="#03050c" strokeWidth={1} />;
            })}
            {cursorLabel && (
              <text x={Math.min(Math.max(cx, M.left + 70), M.left + plotW - 70)} y={M.top - 3} textAnchor="middle" className="fill-slate-200 font-mono text-[10px]">
                {formatUtc(t0Ms + cursor * stepMs)}
              </text>
            )}
          </g>
        )}

        {/* Scrub surface */}
        {onScrub && (
          <rect
            x={M.left}
            y={M.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            className="cursor-ew-resize"
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              onScrub(indexFromEvent(e));
            }}
            onPointerMove={(e) => {
              if (dragging.current) onScrub(indexFromEvent(e));
            }}
            onPointerUp={(e) => {
              dragging.current = false;
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => {
              dragging.current = false;
            }}
          />
        )}
      </svg>
    </div>
  );
}

/** Store-connected chart: observed SYM-H (ghost) vs the interpolated what-if trace. */
export function LiveComparisonChart({ height = 210, compact = false }: { height?: number; compact?: boolean }) {
  const bundle = useDialStore((s) => s.bundle);
  const trace = useDialStore((s) => s.activeTrace);
  const tracePeak = useDialStore((s) => s.tracePeak);
  const cursor = useDialStore((s) => s.cursor);
  const inRange = useDialStore((s) => s.inRange);
  const params = useDialStore((s) => s.params);
  const seek = useDialStore((s) => s.seek);
  const pause = useDialStore((s) => s.pause);

  const isBaseline = params.bz === 1 && params.speed === 1 && params.density === 1;

  const series = useMemo<ChartSeries[]>(() => {
    if (!bundle || !trace) return [];
    const out: ChartSeries[] = [
      { id: "observed", label: "Observed SYM-H (history)", values: bundle.window.series.sym_h_observed, color: "#e2e8f0", width: 1.4, opacity: 0.45 },
    ];
    if (!isBaseline) {
      out.push({ id: "model1x", label: "Model at 1×", values: bundle.window.predictions.primary, color: "#94a3b8", width: 1.2, dash: "2 3", opacity: 0.7 });
    }
    out.push({
      id: "whatif",
      label: inRange ? "What-if prediction" : "What-if prediction (extrapolated)",
      values: trace,
      color: inRange ? "#38bdf8" : "#fbbf24",
      width: 2.2,
      revealToCursor: true,
    });
    return out;
  }, [bundle, trace, inRange, isBaseline]);

  // Stable y-domain: changes in 50/100 nT steps, so the axis does not jitter while dragging.
  const yDomain = useMemo<[number, number] | undefined>(() => {
    if (!bundle || !tracePeak) return undefined;
    return niceDomain(Math.min(bundle.observedMin, tracePeak.value), 40);
  }, [bundle, tracePeak]);

  if (!bundle || !trace) {
    return (
      <div className="grid place-items-center text-sm text-slate-500" style={{ height }}>
        Loading storm…
      </div>
    );
  }

  return (
    <ComparisonChart
      t0Ms={bundle.t0Ms}
      cadenceMinutes={bundle.window.cadence_minutes}
      n={bundle.window.n_times}
      series={series}
      cursor={cursor}
      onScrub={(i) => {
        pause();
        seek(i);
      }}
      stormSpan={bundle.stormSpan}
      height={height}
      yDomain={yDomain}
      showLegend={!compact}
      cursorLabel={!compact}
      margins={compact ? COMPACT_M : M}
      markers={[
        ...(bundle.events.shockIndex !== null ? [{ index: bundle.events.shockIndex, label: "shock", color: "#fdba74" }] : []),
        ...(tracePeak ? [{ index: tracePeak.index, label: "peak", color: inRange ? "#38bdf8" : "#fbbf24" }] : []),
      ]}
      ariaLabel={`SYM-H for ${bundle.window.name}: observed versus what-if prediction`}
    />
  );
}
