"use client";

import { useState } from "react";
import HoldoutSection from "@/components/ui/HoldoutSection";
import { formatDate } from "@/lib/live";
import { useDialStore } from "@/lib/store";
import { CloseIcon } from "./icons";

/** Level-3 side sheet: model validation, method and data provenance. The scene stays live. */

function HowItWorks() {
  const manifest = useDialStore((s) => s.manifest);
  const g = manifest?.grid;
  const points = g ? g.bz_south_mult.length * g.speed_mult.length * g.density_mult.length : 288;
  const steps = [
    {
      k: "01",
      title: "Read the solar wind, never the answer",
      body: `16 years of NASA OMNI 5-minute data. Inputs are only upstream drivers: southward Bz, speed, density, pressure, By, Bt. Every feature at time t uses observations at or before t: lags from 15 min to 12 h, and coupling integrals of v·Bs over 1–24 h. SYM-H, AE, AL, PCN and proton flux are banned from the feature space and the test suite enforces it.`,
    },
    {
      k: "02",
      title: "A backbone that can extrapolate",
      body: `A Ridge regression on the integrated coupling sums gives a linear response that keeps deepening as the driver grows. XGBoost then learns only the residual: saturation, pressure and IMF-orientation effects. Trained on ${manifest?.splits.train?.start_year ?? 2010}–${manifest?.splits.train?.end_year ?? 2019}, tuned on ${manifest?.splits.val?.start_year ?? 2020}–${manifest?.splits.val?.end_year ?? 2022}, tested on ${manifest?.splits.test?.start_year ?? 2023}–${manifest?.splits.test?.end_year ?? 2026}.`,
    },
    {
      k: "03",
      title: "Precompute, then interpolate at 60 FPS",
      body: `For each storm, ${points} what-if scenarios (Bz-south × speed × density) are run offline through the full feature pipeline. The browser blends the 8 nearest scenarios by trilinear interpolation on every dial move, with no ML at runtime. Any scenario whose peak coupling exceeds the training maximum (${manifest?.coupling.train_max_mV_m.toFixed(1) ?? "—"} mV/m) is flagged.`,
    },
    {
      k: "04",
      title: "What the scene shows",
      body: `Earth's colour and the auroral oval follow the predicted SYM-H. The magnetopause and the solar-wind flow follow the Shue et al. (1998) stand-off for the dialled Bz and dynamic pressure, and markers on the geostationary ring turn red where that orbit lies outside the magnetopause. Ghost shapes show the same quantities for the observed storm.`,
    },
  ];
  return (
    <section aria-label="How it works">
      <p className="eyebrow !text-plasma-300">How it works</p>
      <h2 className="mt-1.5 text-xl font-semibold text-white">Teaching a machine to see a magnetosphere</h2>
      <ol className="mt-4 space-y-2">
        {steps.map((s) => (
          <li key={s.k} className="rounded-xl bg-white/[0.035] p-3.5">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] text-plasma-300">{s.k}</span>
              <h3 className="text-[14px] font-semibold text-white">{s.title}</h3>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-300">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const TABS = [
  { id: "holdout", label: "Hold-out test" },
  { id: "how", label: "How it works" },
] as const;

export default function ModelDrawer() {
  const open = useDialStore((s) => s.panel === "model");
  const manifest = useDialStore((s) => s.manifest);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("holdout");
  if (!open) return null;
  const close = () => useDialStore.getState().openPanel(null);

  return (
    <aside
      role="dialog"
      aria-label="Model and validation"
      className="glass glass-solid sheet-in pointer-events-auto fixed inset-y-3 right-3 z-30 flex w-[min(calc(100vw-24px),560px)] flex-col overflow-hidden !rounded-2xl"
    >
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <div role="tablist" aria-label="Model sections" className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-2.5 py-1 text-[12.5px] transition-colors ${tab === t.id ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn ml-auto" aria-label="Close model panel" data-tip="Close  Esc" data-tip-pos="left" onClick={close}>
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {tab === "holdout" ? <HoldoutSection /> : <HowItWorks />}
        <footer className="mt-8 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-slate-500">
          <p>{manifest?.data.citation ?? "NASA/GSFC OMNI 5-min data via OMNIWeb/CDAWeb."}</p>
          <p className="mt-1">
            Artifacts: {manifest ? `${manifest.source} · ${manifest.model.kind} · generated ${formatDate(manifest.generated_at)}` : "—"} · Sheridan
            Datathon 2026 · NASA Track, Problem 2.
          </p>
        </footer>
      </div>
    </aside>
  );
}
