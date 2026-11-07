"use client";

import { formatUtc, liveFrame } from "@/lib/live";
import { tierFor } from "@/lib/severity";
import { useDialStore } from "@/lib/store";

function Stat({ label, value, unit, color, hint }: { label: string; value: string; unit?: string; color?: string; hint?: string }) {
  return (
    <div className="min-w-0" title={hint}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-0.5 font-mono text-lg leading-tight tabular-nums" style={{ color }}>
        {value}
        {unit && <span className="ml-1 text-xs text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

const fmt = (v: number | null, digits = 0) => (v === null || !Number.isFinite(v) ? "—" : v.toFixed(digits));

export default function MetricsBanner() {
  const bundle = useDialStore((s) => s.bundle);
  const trace = useDialStore((s) => s.activeTrace);
  const params = useDialStore((s) => s.params);
  const cursor = useDialStore((s) => s.cursor);
  const inRange = useDialStore((s) => s.inRange);
  const peakCoupling = useDialStore((s) => s.peakCoupling);
  const tracePeak = useDialStore((s) => s.tracePeak);
  const manifest = useDialStore((s) => s.manifest);

  const f = liveFrame(bundle, trace, params, cursor);
  const peakTier = tierFor(tracePeak?.value ?? 0);
  const trainMax = bundle?.grid.trainMaxCoupling ?? manifest?.coupling.train_max_mV_m ?? 0;
  const extrapolationNote =
    manifest?.model.kind === "burton_fixture"
      ? "No 2010–2019 training sample was driven this hard; read this replay as a physics extrapolation."
      : "The prediction is a linear extrapolation of the Ridge backbone, not an interpolation of anything the model has seen.";
  const drop = f.ready && f.observed !== null ? f.symH - f.observed : null;

  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      <div className="glass flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3" aria-live="polite">
        <div className="flex items-center gap-3">
          <span
            className="grid h-11 w-14 place-items-center rounded-lg font-mono text-sm font-semibold text-void"
            style={{ backgroundColor: f.tier.color, boxShadow: `0 0 22px ${f.tier.color}66` }}
            aria-label={`Current NOAA tier ${f.tier.display}`}
          >
            {f.tier.display}
          </span>
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">NOAA tier (approx.)</div>
            <div className="text-sm font-medium" style={{ color: f.tier.color }}>
              {f.tier.label}
            </div>
          </div>
        </div>
        <Stat label="What-if SYM-H" value={fmt(f.ready ? f.symH : null)} unit="nT" color={f.tier.color} />
        <Stat label="Observed" value={fmt(f.observed)} unit="nT" color="#cbd5e1" />
        <Stat
          label="Δ vs history"
          value={drop === null ? "—" : `${drop > 0 ? "+" : ""}${drop.toFixed(0)}`}
          unit="nT"
          color={drop !== null && drop < 0 ? "#fb7185" : "#86efac"}
          hint="What-if minus observed SYM-H at the playhead; negative means a deeper storm."
        />
        <Stat
          label="Peak what-if"
          value={fmt(tracePeak?.value ?? null)}
          unit={`nT · ${peakTier.display}`}
          color={peakTier.color}
        />
        <Stat label="Aurora down to" value={`${f.auroraLat.toFixed(1)}°`} unit="lat" color="#86efac" hint="Equatorward auroral boundary ≈ 65° − 0.05·|SYM-H|, clamped at 38°." />
        <Stat label="vBs coupling" value={fmt(f.coupling, 1)} unit="mV/m" color="#fdba74" />
        <div className="ml-auto text-right font-mono text-[11px] text-slate-400">
          {f.ready ? formatUtc(f.timeMs, true) : "—"}
          {f.filled && <div className="text-alert-300">solar-wind gap: last value held</div>}
        </div>
      </div>

      {bundle && !inRange && (
        <div role="alert" className="glass animate-pulseAmber flex flex-wrap items-center gap-x-3 gap-y-1 border-alert-500/70 bg-alert-500/15 px-4 py-2.5 text-alert-300">
          <span className="rounded bg-alert-500 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-void">BEYOND TRAINING DATA</span>
          <span className="text-sm">
            Peak coupling {peakCoupling.toFixed(1)} mV/m exceeds the 2010–2019 maximum of {trainMax.toFixed(1)} mV/m.{" "}
            {extrapolationNote}
          </span>
        </div>
      )}
    </div>
  );
}
