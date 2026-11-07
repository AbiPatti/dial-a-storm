"use client";

import { useEffect, useMemo, useState } from "react";
import ComparisonChart, { type ChartSeries } from "@/components/deck/ComparisonChart";
import { loadStormWindow } from "@/lib/data";
import { formatUtc } from "@/lib/live";
import { tierFor } from "@/lib/severity";
import { useDialStore } from "@/lib/store";
import { MODEL_LABELS, type Manifest, type Metric, type StormWindow } from "@/lib/types";

const MODEL_COLORS: Record<string, string> = {
  hybrid: "#38bdf8",
  burton: "#38bdf8",
  ridge: "#a78bfa",
  xgb_only: "#fbbf24",
};

const SPLIT_LABELS: Record<string, string> = {
  val: "Validation 2020–2022",
  test: "Test 2023–2026",
  test_excl_holdout: "Test excl. Gannon",
};

function primaryKey(m: Manifest): string {
  return m.model.kind === "hybrid_ridge_xgb" ? "hybrid" : "burton";
}

function hoursBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  return (Date.parse(a) - Date.parse(b)) / 3_600_000;
}

function PeakCard({ label, value, observed, color, time, obsTime }: { label: string; value: number | null; observed: number | null; color: string; time?: string | null; obsTime?: string | null }) {
  const pct = value !== null && observed ? (value / observed) * 100 : null;
  const lag = hoursBetween(time, obsTime);
  const tier = tierFor(value ?? 0);
  return (
    <div className="rounded-xl bg-white/[0.035] p-3">
      <div className="text-[11px] leading-tight text-slate-400">{label}</div>
      <div className="mt-1 font-mono text-2xl tabular-nums" style={{ color }}>
        {value === null ? "—" : value.toFixed(0)}
        <span className="ml-1 text-sm text-slate-400">nT</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] text-slate-400">
        <span style={{ color: tier.color }}>{tier.display}</span>
        {pct !== null && <span>{pct.toFixed(0)}% of observed depth</span>}
        {lag !== null && Math.abs(lag) > 0.01 && <span>peak {lag > 0 ? "+" : ""}{lag.toFixed(1)} h</span>}
      </div>
    </div>
  );
}

function MetricsTable({ manifest }: { manifest: Manifest }) {
  const splits = ["val", "test", "test_excl_holdout"].filter((s) => manifest.metrics[s]);
  const models = Object.keys(manifest.metrics[splits[0]] ?? {});
  const cell = (m: Metric | undefined, k: "rmse" | "mae" | "r2" | "storm_rmse") => {
    const v = m?.[k];
    return v === undefined || v === null ? "—" : k === "r2" ? v.toFixed(3) : v.toFixed(1);
  };
  const holdout = manifest.holdout.metrics;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-[12.5px]">
        <caption className="mb-2 text-left text-[11px] uppercase tracking-[0.14em] text-slate-400">
          Out-of-time error (nT) at 15-min cadence · storm-time = observed SYM-H &lt; −50 nT
        </caption>
        <thead className="text-[11px] uppercase tracking-wider text-slate-400">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Split</th>
            <th className="py-1.5 pr-3 font-medium">Model</th>
            <th className="py-1.5 pr-3 text-right font-medium">RMSE</th>
            <th className="py-1.5 pr-3 text-right font-medium">MAE</th>
            <th className="py-1.5 pr-3 text-right font-medium">R²</th>
            <th className="py-1.5 text-right font-medium">Storm-time RMSE</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {[...splits.map((s) => [s, manifest.metrics[s]] as const), ["holdout", holdout] as const].map(([split, byModel]) =>
            models.map((model, i) => (
              <tr key={`${split}-${model}`} className={i === 0 ? "border-t border-white/10" : ""}>
                <td className="py-1.5 pr-3 font-sans text-slate-300">{i === 0 ? (split === "holdout" ? `${manifest.holdout.name} window` : SPLIT_LABELS[split]) : ""}</td>
                <td className="py-1.5 pr-3 font-sans" style={{ color: MODEL_COLORS[model] ?? "#e2e8f0" }}>
                  {MODEL_LABELS[model] ?? model}
                </td>
                <td className="py-1.5 pr-3 text-right">{cell(byModel[model], "rmse")}</td>
                <td className="py-1.5 pr-3 text-right">{cell(byModel[model], "mae")}</td>
                <td className="py-1.5 pr-3 text-right">{cell(byModel[model], "r2")}</td>
                <td className="py-1.5 text-right">{cell(byModel[model], "storm_rmse")}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function HoldoutSection() {
  const manifest = useDialStore((s) => s.manifest);
  const storms = useDialStore((s) => s.storms);
  const [win, setWin] = useState<StormWindow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!manifest) return;
    let alive = true;
    loadStormWindow(manifest.holdout.id)
      .then((w) => alive && setWin(w))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [manifest]);

  const series = useMemo<ChartSeries[]>(() => {
    if (!win || !manifest) return [];
    const key = primaryKey(manifest);
    const out: ChartSeries[] = [
      { id: "observed", label: "Observed SYM-H", values: win.series.sym_h_observed, color: "#f8fafc", width: 2 },
      { id: key, label: MODEL_LABELS[key], values: win.predictions.primary, color: MODEL_COLORS[key], width: 2 },
    ];
    if (win.predictions.ridge) out.push({ id: "ridge", label: MODEL_LABELS.ridge, values: win.predictions.ridge, color: MODEL_COLORS.ridge, width: 1.4, dash: "5 3" });
    if (win.predictions.xgb_only) out.push({ id: "xgb_only", label: MODEL_LABELS.xgb_only, values: win.predictions.xgb_only, color: MODEL_COLORS.xgb_only, width: 1.4, dash: "2 3" });
    return out;
  }, [win, manifest]);

  if (!manifest) return null;
  const h = manifest.holdout;
  const key = primaryKey(manifest);
  const isFixture = manifest.source === "FIXTURE";
  const trainStorms = storms.filter((s) => s.split === "train");
  const deepestTrain = trainStorms.length ? Math.min(...trainStorms.map((s) => s.peak_sym_h)) : null;
  const primaryPeak = h.predicted_peak_nT[key] ?? null;
  const xgbPeak = h.predicted_peak_nT.xgb_only ?? null;
  const ridgePeak = h.predicted_peak_nT.ridge ?? null;
  const t0Ms = win ? Date.parse(win.t0) : 0;
  const stepMs = (win?.cadence_minutes ?? 15) * 60_000;
  const span: [number, number] | null = win ? [(Date.parse(win.storm_start) - t0Ms) / stepMs, (Date.parse(win.storm_end) - t0Ms) / stepMs] : null;

  return (
    <section id="honest-test" aria-label="Hold-out test">
      <p className="micro !text-rose-300">The honest test</p>
      <h2 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-stone-100 md:text-4xl">
        Can it see a storm it has never seen? {h.name}, {h.observed_peak_nT?.toFixed(0)} nT
      </h2>
      <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-stone-300">
        The model was fitted on 2010–2019 and tuned on 2020–2022. The deepest training-era storm in our top 8 reached{" "}
        {deepestTrain !== null ? `${deepestTrain.toFixed(0)} nT` : "—"}. The 10–11 May 2024 storm, the strongest in two
        decades, lies in the untouched 2023–2026 test period: no fitting, early stopping or hyper-parameter choice ever saw it. Its peak
        coupling of {storms.find((s) => s.id === h.id)?.peak_coupling_mV_m?.toFixed(1) ?? "—"} mV/m is beyond the training maximum of{" "}
        {manifest.coupling.train_max_mV_m.toFixed(1)} mV/m, so this is a test of extrapolation.
      </p>

      {isFixture && (
        <div className="mt-4 rounded-lg border border-alert-500/50 bg-alert-500/10 px-3 py-2.5 text-[12.5px] text-alert-300">
          <span className="mr-2 rounded bg-alert-500 px-1.5 py-0.5 font-mono text-[11px] font-bold text-void">FIXTURE</span>
          These numbers come from the Burton–O&apos;Brien–McPherron physics model on real OMNI data, shipped so the app runs before the ML
          pipeline. Run <code className="font-mono">python -m dial_a_storm.pipeline</code> in <code className="font-mono">pipeline/</code> to replace them
          with the Ridge + XGBoost hybrid and its pure-XGBoost comparison.
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <PeakCard label="Observed peak" value={h.observed_peak_nT} observed={null} color="#f8fafc" />
        <PeakCard label={MODEL_LABELS[key]} value={primaryPeak} observed={h.observed_peak_nT} color={MODEL_COLORS[key]} time={h.predicted_peak_time[key]} obsTime={h.observed_peak_time} />
        {ridgePeak !== null && <PeakCard label={MODEL_LABELS.ridge} value={ridgePeak} observed={h.observed_peak_nT} color={MODEL_COLORS.ridge} time={h.predicted_peak_time.ridge} obsTime={h.observed_peak_time} />}
        {xgbPeak !== null && <PeakCard label={MODEL_LABELS.xgb_only} value={xgbPeak} observed={h.observed_peak_nT} color={MODEL_COLORS.xgb_only} time={h.predicted_peak_time.xgb_only} obsTime={h.observed_peak_time} />}
      </div>

      <div className="mt-3 rounded-xl bg-white/[0.025] p-3">
        {win && span ? (
          <ComparisonChart
            t0Ms={t0Ms}
            cadenceMinutes={win.cadence_minutes}
            n={win.n_times}
            series={series}
            stormSpan={span}
            height={240}
            ariaLabel={`Observed versus predicted SYM-H during the ${h.name}`}
          />
        ) : (
          <div className="grid h-[240px] place-items-center text-sm text-slate-400">{error ?? "Loading hold-out window…"}</div>
        )}
        <p className="mt-2 font-mono text-[11px] text-slate-500">
          Window {formatUtc(Date.parse(h.window_start), true)} → {formatUtc(Date.parse(h.window_end), true)} · observed minimum at{" "}
          {h.observed_peak_time ? formatUtc(Date.parse(h.observed_peak_time)) : "—"}
        </p>
      </div>

      <div className="mt-5 space-y-5">
        <div className="space-y-3 text-[13px] leading-relaxed text-slate-300">
          <h3 className="text-[14px] font-semibold text-white">What the result says</h3>
          {xgbPeak !== null && primaryPeak !== null && h.observed_peak_nT !== null ? (
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Pure XGBoost bottoms out at <b className="text-alert-300">{xgbPeak.toFixed(0)} nT</b>. Trees can only return values seen in
                training, so a storm deeper than anything in 2010–2019 is flattened.
              </li>
              <li>
                The hybrid reaches <b className="text-plasma-300">{primaryPeak.toFixed(0)} nT</b>, {((primaryPeak / h.observed_peak_nT) * 100).toFixed(0)}%
                of the observed depth. The linear coupling backbone lets the prediction keep growing with the driver.
              </li>
              <li>
                It still under-predicts by {Math.abs(h.observed_peak_nT - primaryPeak).toFixed(0)} nT. Treat superstorm what-ifs as
                lower bounds, especially when the amber BEYOND TRAINING DATA flag is on.
              </li>
            </ul>
          ) : (
            <p>
              The physics fixture reaches {primaryPeak?.toFixed(0) ?? "—"} nT against an observed {h.observed_peak_nT?.toFixed(0) ?? "—"} nT. The
              ML comparison (hybrid vs. pure XGBoost) appears here after the pipeline runs.
            </p>
          )}
          <h3 className="pt-2 text-[14px] font-semibold text-white">Limitations</h3>
          <ul className="list-disc space-y-1.5 pl-5 text-slate-400">
            <li>Drivers are OMNI data already time-shifted to the bow-shock nose, so this is a nowcast of SYM-H from upstream conditions, not a forecast from L1.</li>
            <li>Only solar-wind inputs are used. SYM-H, AE, AL, PCN and proton flux are excluded so the model cannot copy Earth&apos;s own response.</li>
            <li>What-if scaling multiplies the observed time series. It cannot create new CME structure, change shock timing, or rotate the IMF.</li>
            <li>Solar-wind gaps over 30 min are held at the last valid value during replay and flagged in the HUD.</li>
            <li>G-tiers and the auroral boundary are rough SYM-H mappings for communication. They are not NOAA products.</li>
          </ul>
        </div>
        <details className="rounded-xl bg-white/[0.025] p-3" open>
          <summary className="cursor-pointer text-[13px] font-semibold text-white">Error metrics by split</summary>
          <div className="mt-3">
            <MetricsTable manifest={manifest} />
          </div>
        </details>
      </div>
    </section>
  );
}
