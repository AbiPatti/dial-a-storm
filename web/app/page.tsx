"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import Dial from "@/components/hud/Dial";
import Headline from "@/components/hud/Headline";
import Impacts from "@/components/hud/Impacts";
import StormBar from "@/components/hud/StormBar";
import HoldoutSection from "@/components/ui/HoldoutSection";
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
    <span className={`micro ${fixture ? "!text-ember-300" : "!text-mint-300"}`} title={manifest.model.description}>
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
        <section className="pointer-events-none relative flex min-h-[100svh] flex-col p-5 md:p-8">
          <header className="pointer-events-auto flex items-baseline gap-3">
            <h1 className="font-serif text-2xl tracking-tight text-stone-100">
              Dial<span className="italic text-ember-400">-a-</span>Storm
            </h1>
            <SourceBadge />
          </header>

          <div className="flex flex-1 flex-col justify-end gap-8 pt-[38svh] md:flex-row md:items-end md:justify-between md:pt-0">
            <Headline />
            <Dial />
          </div>

          <div className="mt-8">
            <StormBar />
          </div>

          {status === "ready" && (
            <div className="mt-8 md:absolute md:right-8 md:top-8 md:mt-0">
              <Impacts />
            </div>
          )}

          {status === "error" && (
            <div role="alert" className="glass pointer-events-auto absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 p-5 text-sm">
              <div className="font-semibold text-rose-300">Could not load storm data</div>
              <p className="mt-1 break-words text-slate-300">{error}</p>
              <p className="mt-2 text-slate-400">
                Expected static files under <code className="font-mono">web/public/data/</code>. Regenerate them with{" "}
                <code className="font-mono">python -m dial_a_storm.pipeline</code> (or <code className="font-mono">python -m dial_a_storm.make_fixtures</code>) from{" "}
                <code className="font-mono">pipeline/</code>.
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
          <HoldoutSection />
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
