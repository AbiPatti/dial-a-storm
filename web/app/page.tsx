"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import ControlDeck from "@/components/deck/ControlDeck";
import { LiveComparisonChart } from "@/components/deck/ComparisonChart";
import MetricsBanner from "@/components/deck/MetricsBanner";
import HonestTestSection from "@/components/ui/HonestTestSection";
import { formatDate } from "@/lib/live";
import { useDialStore } from "@/lib/store";
import { usePlayback } from "@/lib/usePlayback";

// WebGL must never render on the server.
const SpaceCanvas = dynamic(() => import("@/components/scene/SpaceCanvas"), { ssr: false });

function SourceBadge() {
  const manifest = useDialStore((s) => s.manifest);
  if (!manifest) return null;
  const fixture = manifest.source === "FIXTURE";
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${fixture ? "bg-alert-500 text-void" : "bg-aurora-500/20 text-aurora-300"}`}
      title={manifest.model.description}
    >
      {fixture ? "FIXTURE DATA" : "PIPELINE"}
    </span>
  );
}

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
      body: `For each storm, ${points} what-if scenarios (Bz-south × speed × density) are run offline through the full feature pipeline. The browser blends the 8 nearest scenarios by trilinear interpolation on every slider move, with no ML at runtime. Any scenario whose peak coupling exceeds the training maximum (${manifest?.coupling.train_max_mV_m.toFixed(1) ?? "—"} mV/m) is flagged.`,
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 pb-4 pt-24 lg:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-plasma-300">How it works</p>
      <h2 className="mt-2 text-3xl font-semibold text-white md:text-4xl">Teaching a machine to see a magnetosphere</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <article key={s.k} className="glass p-5">
            <div className="font-mono text-xs text-plasma-300">{s.k}</div>
            <h3 className="mt-1 text-lg font-semibold text-white">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{s.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Page() {
  const init = useDialStore((s) => s.init);
  const status = useDialStore((s) => s.status);
  const error = useDialStore((s) => s.error);
  const manifest = useDialStore((s) => s.manifest);
  usePlayback();

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <>
      <SpaceCanvas />
      <main className="relative z-10">
        <section className="pointer-events-none relative flex min-h-[100svh] flex-col gap-4 p-4 lg:p-6">
          <header className="flex flex-col gap-3 xl:flex-row xl:items-start">
            <div className="pointer-events-auto shrink-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  Dial<span className="text-plasma-400">-a-</span>Storm
                </h1>
                <SourceBadge />
              </div>
              <p className="mt-0.5 max-w-xs text-xs text-slate-400">
                Rewind a real geomagnetic storm, turn up the solar wind, and watch Earth&apos;s magnetic field respond.
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <MetricsBanner />
            </div>
          </header>

          <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="order-2 flex flex-col justify-end lg:order-1">
              <div className="glass pointer-events-auto p-3">
                <LiveComparisonChart height={210} />
              </div>
            </div>
            <div className="order-1 flex flex-col justify-end lg:order-2">
              <ControlDeck />
            </div>
          </div>

          {status === "error" && (
            <div role="alert" className="glass pointer-events-auto absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 p-5 text-sm">
              <div className="font-semibold text-rose-300">Could not load storm data</div>
              <p className="mt-1 break-words text-slate-300">{error}</p>
              <p className="mt-2 text-slate-400">
                Expected static files under <code className="font-mono">web/public/data/</code>. Regenerate them with{" "}
                <code className="font-mono">python -m src.pipeline</code> (or <code className="font-mono">python -m src.make_fixtures</code>) from{" "}
                <code className="font-mono">data/</code>.
              </p>
            </div>
          )}
          {status === "loading" && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-xs tracking-widest text-slate-400">
              LOADING OMNI ARCHIVE…
            </div>
          )}
        </section>

        {/* Dark backdrop so narrative text stays readable over the bright scene. */}
        <div className="bg-gradient-to-b from-void/0 via-void/90 to-void">
          <HowItWorks />
          <HonestTestSection />
        </div>

        <footer className="mx-auto max-w-6xl px-4 pb-12 pt-4 text-xs text-slate-500 lg:px-6">
          <div className="border-t border-white/10 pt-6">
            <p>{manifest?.data.citation ?? "NASA/GSFC OMNI 5-min data via OMNIWeb/CDAWeb."}</p>
            <p className="mt-1">
              Artifacts: {manifest ? `${manifest.source} · ${manifest.model.kind} · generated ${formatDate(manifest.generated_at)}` : "—"} ·
              Sheridan Datathon 2026 · NASA Track, Problem 2.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
