"use client";

import { useRef, type ReactNode, type RefObject } from "react";
import HoldoutSection from "@/components/ui/HoldoutSection";
import { formatDate } from "@/lib/live";
import { prefersReducedMotion } from "@/lib/motion";
import { tierById } from "@/lib/severity";
import { useDialStore } from "@/lib/store";
import ChainStory from "./ChainStory";
import { Reveal, ScrollerContext, useInView, useScrollVar } from "./scroll";

/**
 * Long-form explainer tab: the physics chain from Sun to aurora, how the model works, the honest
 * hold-out test, the storm catalogue and the limits of the data. Every number on this page comes
 * from manifest.json / storms.json, so it stays correct when the pipeline is re-run.
 *
 * Motion follows Apple's product pages: native scrolling drives a pinned hero, a pinned
 * scrollytelling diagram, a video that grows into place and count-up figures; everything else
 * fades up as it enters. See ./scroll.tsx and the `.x-*` rules in globals.css.
 */

const fmt = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(d));

function Section({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="x-section">
      <Reveal>
        <p className="micro !text-ember-300">{eyebrow}</p>
        <h2 id={id ? `${id}-title` : undefined} className="x-section-title font-serif">
          {title}
        </h2>
      </Reveal>
      <div className="mt-8 md:mt-10">{children}</div>
    </section>
  );
}

/** Pinned opening: the headline recedes into the glow as the introduction rises in. */
function Hero() {
  const ref = useRef<HTMLElement>(null);
  useScrollVar(ref, "track");
  return (
    <section ref={ref} className="x-hero" aria-labelledby="explainer-title">
      <div className="x-hero-stage">
        <div className="x-hero-glow" aria-hidden="true" />
        <div className="x-hero-copy">
          <p className="micro x-hero-eyebrow !text-ember-300">Explainer</p>
          <h2 id="explainer-title" className="x-hero-title font-serif">
            How a storm on the Sun <em className="italic text-ember-300">reaches Earth.</em>
          </h2>
          <p className="x-hero-intro">
            Every storm in this app is real, measured by NASA&apos;s OMNI solar-wind archive from 2010 to 2026. Here is what happens, step by step,
            and how a machine-learning model learns to predict Earth&apos;s response. The numbers below are for the storm you have loaded.
          </p>
        </div>
        <div className="x-hero-hint" aria-hidden="true">
          Scroll
          <span />
        </div>
      </div>
    </section>
  );
}

/** A number that counts up from zero the first time it scrolls into view. */
function CountUp({ value, decimals = 0, suffix = "" }: { value: number | null; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const final = value === null ? "—" : `${value.toFixed(decimals)}${suffix}`;
  useInView(
    ref,
    (el) => {
      if (value === null || prefersReducedMotion()) return;
      const t0 = performance.now();
      const ms = 1400;
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        const e = 1 - Math.pow(1 - k, 4);
        el.textContent = `${(value * e).toFixed(decimals)}${suffix}`;
        if (k < 1) requestAnimationFrame(step);
      };
      el.textContent = `${(0).toFixed(decimals)}${suffix}`;
      requestAnimationFrame(step);
    },
    0.4,
  );
  return (
    <span ref={ref} aria-label={final}>
      {final}
    </span>
  );
}

/** Three headline figures, all read from the data. */
function Figures() {
  const manifest = useDialStore((s) => s.manifest);
  const storms = useDialStore((s) => s.storms);
  const g = manifest?.grid;
  const points = g ? g.bz_south_mult.length * g.speed_mult.length * g.density_mult.length : null;
  const h = manifest?.holdout;
  const key = manifest?.model.kind === "hybrid_ridge_xgb" ? "hybrid" : "burton";
  const predicted = h?.predicted_peak_nT[key] ?? null;
  const ratio = predicted !== null && h?.observed_peak_nT ? (predicted / h.observed_peak_nT) * 100 : null;
  const who = key === "hybrid" ? "the hybrid model, which never saw it" : "the physics stand-in";
  const items = [
    { value: storms.length || null, label: "of the strongest geomagnetic storms of 2010–2026, replayed from real measurements" },
    { value: points, label: "what-if scenarios precomputed for every storm, blended live as you turn the dials" },
    { value: ratio, suffix: "%", label: `of the ${h?.name ?? "Gannon storm"}'s depth predicted by ${who}` },
  ];
  return (
    <section className="x-figures" aria-label="Key figures">
      {items.map((it, i) => (
        <Reveal key={i} delay={i * 120} className="x-figure">
          <div className="x-figure-value font-serif">
            <CountUp value={it.value} suffix={it.suffix} />
          </div>
          <p className="x-figure-label">{it.label}</p>
        </Reveal>
      ))}
    </section>
  );
}

/** The narrated video grows from an inset card to full width as it scrolls into view. */
function Video() {
  const ref = useRef<HTMLDivElement>(null);
  useScrollVar(ref, "through");
  return (
    <section id="video" aria-labelledby="video-title" className="x-section">
      <Reveal>
        <p className="micro !text-ember-300">Watch</p>
        <h2 id="video-title" className="x-section-title font-serif">
          The science in 30 seconds
        </h2>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-stone-300">
          A narrated walk-through of the physics behind the simulation: from the solar wind to the magnetosphere, the ring current and the
          aurora.
        </p>
      </Reveal>
      <div ref={ref} className="x-video">
        <div className="x-video-frame">
          <video
            src="/video/dial-a-storm-science.mp4"
            controls
            playsInline
            preload="metadata"
            aria-label="Narrated video: the science of the Dial-a-Storm simulation"
            className="block aspect-video w-full bg-black"
          />
        </div>
      </div>
    </section>
  );
}

function Method() {
  const manifest = useDialStore((s) => s.manifest);
  const g = manifest?.grid;
  const points = g ? g.bz_south_mult.length * g.speed_mult.length * g.density_mult.length : null;
  const sp = manifest?.splits;
  const fixture = manifest?.model.kind === "burton_fixture";
  const steps = [
    {
      k: "01",
      title: "Read the solar wind, never the answer",
      body: `NASA OMNI 5-minute data, modelled at 15-minute steps. Inputs are only upstream drivers: southward Bz, speed, density, pressure, By, Bt. Every feature at time t uses observations at or before t: lags from 15 min to 12 h, and coupling integrals of v·Bs over 1–24 h. SYM-H, AE, AL, PCN and proton flux are banned from the feature space, and the test suite enforces it.`,
    },
    {
      k: "02",
      title: "A backbone that can extrapolate",
      body: `A Ridge regression on the integrated coupling sums gives a linear response that keeps deepening as the driver grows. XGBoost then learns only the residual: saturation, pressure and IMF-orientation effects. Trained on ${sp?.train?.start_year ?? "—"}–${sp?.train?.end_year ?? "—"}, tuned on ${sp?.val?.start_year ?? "—"}–${sp?.val?.end_year ?? "—"}, tested on ${sp?.test?.start_year ?? "—"}–${sp?.test?.end_year ?? "—"}.`,
    },
    {
      k: "03",
      title: "Precompute, then interpolate at 60 FPS",
      body: `For each storm, ${points ?? "—"} what-if scenarios (southward Bz × speed × density) are run offline through the full feature pipeline. The browser blends the 8 nearest scenarios by trilinear interpolation on every dial move, with no ML running at runtime. Any scenario whose peak coupling exceeds the training maximum (${fmt(manifest?.coupling.train_max_mV_m, 1)} mV/m) is flagged BEYOND TRAINING DATA.`,
    },
    {
      k: "04",
      title: "What the scene shows",
      body: `Earth's glow, the ring current and the auroral oval follow the predicted SYM-H. The magnetopause, field lines and particle flow follow the Shue et al. (1998) stand-off for the dialled Bz and dynamic pressure, with a simplified fixed flaring. Reconnection (the nose flash and particles captured into the cusps) follows the coupling v·Bs. Ghost outlines show the observed storm.`,
    },
  ];
  return (
    <>
      {fixture && (
        <p className="mb-5 rounded-lg border border-alert-500/40 bg-alert-500/10 px-4 py-3 text-sm text-alert-300">
          <span className="mr-2 rounded bg-alert-500 px-1.5 py-0.5 font-mono text-[11px] font-bold text-void">FIXTURE</span>
          The data currently loaded uses the Burton–O&apos;Brien–McPherron physics model as a stand-in. Run the Python pipeline to replace it with the
          ML model described here.
        </p>
      )}
      <ol className="grid gap-4 md:grid-cols-2">
        {steps.map((s, i) => (
          <Reveal as="li" key={s.k} delay={i * 90} className="glass p-5">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] text-ember-300">{s.k}</span>
              <h3 className="font-serif text-2xl text-stone-100">{s.title}</h3>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-stone-300">{s.body}</p>
          </Reveal>
        ))}
      </ol>
    </>
  );
}

function Catalogue() {
  const storms = useDialStore((s) => s.storms);
  const activeId = useDialStore((s) => s.activeStormId);
  return (
    <div className="glass overflow-x-auto p-2">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="px-3 pb-2 pt-2 text-left text-[12px] text-stone-400">
          The 8 deepest SYM-H storms detected in the dataset (SYM-H &lt; −50 nT, gaps under 3 h merged). Select one to load it in the simulator.
        </caption>
        <thead className="micro">
          <tr>
            <th className="px-3 py-2 font-normal">#</th>
            <th className="px-3 py-2 font-normal">Storm</th>
            <th className="px-3 py-2 font-normal">Peak</th>
            <th className="px-3 py-2 text-right font-normal">SYM-H min</th>
            <th className="px-3 py-2 text-right font-normal">Max speed</th>
            <th className="px-3 py-2 text-right font-normal">Min Bz</th>
            <th className="px-3 py-2 font-normal">Split</th>
          </tr>
        </thead>
        <tbody className="font-mono text-[12.5px] tabular-nums">
          {storms.map((s) => {
            const tier = tierById(s.g_tier);
            return (
              <tr key={s.id} className={`border-t border-white/[0.05] ${s.id === activeId ? "bg-ember-400/[0.06]" : ""}`}>
                <td className="px-3 py-2 text-stone-500">{s.rank}</td>
                <td className="px-3 py-2 font-sans">
                  <button
                    type="button"
                    className="text-left text-stone-100 underline decoration-white/20 underline-offset-4 hover:decoration-ember-300"
                    onClick={() => {
                      const st = useDialStore.getState();
                      void st.selectStorm(s.id);
                      st.setTab("simulator");
                    }}
                  >
                    {s.name}
                  </button>
                  {s.holdout && <span className="ml-2 rounded bg-rose-500/15 px-1 py-px font-mono text-[10px] text-rose-300">HOLD-OUT</span>}
                </td>
                <td className="px-3 py-2 text-stone-400">{formatDate(s.peak_time)}</td>
                <td className="px-3 py-2 text-right" style={{ color: tier.color }}>
                  {fmt(s.peak_sym_h)} nT <span className="text-stone-500">≈{tier.display}</span>
                </td>
                <td className="px-3 py-2 text-right text-stone-300">{fmt(s.max_speed_km_s)} km/s</td>
                <td className="px-3 py-2 text-right text-stone-300">{fmt(s.min_bz_nT, 1)} nT</td>
                <td className="px-3 py-2 font-sans text-[12px] text-stone-400">
                  {s.split === "train" ? "training" : s.split === "val" ? "validation" : "test"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HonestNotes() {
  const manifest = useDialStore((s) => s.manifest);
  const storms = useDialStore((s) => s.storms);
  const sp = manifest?.splits;
  const deepestLater = storms.filter((s) => s.split === "test" && !s.holdout).sort((a, b) => a.peak_sym_h - b.peak_sym_h)[0];
  const notes: { title: string; body: ReactNode }[] = [
    {
      title: `Why the model trains only on ${sp?.train?.start_year ?? 2010}–${sp?.train?.end_year ?? 2019}`,
      body: (
        <>
          <p>
            This is deliberate. The model reads every year in the CSV, but the later years are used only to <b>check</b> it. 2020–2022 picks
            the settings, and 2023–2026, including Gannon, is kept for testing. Training on a storm and then scoring the model on that same
            storm says nothing about how it handles a new one.
          </p>
          <p>
            The cost is that the training years hold no superstorm.
            {deepestLater && (
              <>
                {" "}
                Storms like the {deepestLater.name} ({fmt(deepestLater.peak_sym_h)} nT) appear only in the test years.
              </>
            )}{" "}
            This is why the Ridge backbone, which can extrapolate, matters. It is also why scenarios past the training range are flagged.
          </p>
        </>
      ),
    },
    {
      title: "“G-tiers” here are SYM-H bands, not NOAA ratings",
      body: (
        <p>
          NOAA&apos;s G-scale is based on the 3-hour Kp index, which this dataset does not include. The bands used here (−50 / −100 / −250 nT) are
          a rough guide. They can disagree with NOAA. The October 2024, November 2025 and January 2026 storms passed −250 nT and show as ≈G5
          here, but NOAA rated all three G4 (Severe). Only May 2024 was an official G5.
        </p>
      ),
    },
    {
      title: "5-minute data runs slightly shallower",
      body: (
        <p>
          Papers quote 1-minute SYM-H, so their minima are a few nT deeper than the 5-minute OMNI values here. For example, published Gannon
          values are below −500 nT; OMNI shows −497 nT.
        </p>
      ),
    },
    {
      title: "What the dataset does not contain",
      body: (
        <p>
          It has no solar-flare (X-ray) data. Its &gt;10 MeV proton-flux column stops in March 2020, both in the CSV and in NASA&apos;s own OMNI
          release, so later solar radiation storms (such as the S4 event of 19 January 2026) are not in the data. Proton flux is never a model
          input in any case.
        </p>
      ),
    },
    {
      title: "Limits of a what-if",
      body: (
        <p>
          The dials multiply the observed time series. They cannot create a new CME, change when the shock arrives, or rotate the field.
          Solar-wind gaps longer than 30 minutes are held at the last valid value during replay, and the HUD flags them.
        </p>
      ),
    },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {notes.map((n, i) => (
        <Reveal as="article" key={n.title} delay={(i % 2) * 90} className="glass p-5">
          <h3 className="font-serif text-xl text-stone-100">{n.title}</h3>
          <div className="prose-dial mt-2">{n.body}</div>
        </Reveal>
      ))}
    </div>
  );
}

export default function ExplainerTab() {
  const manifest = useDialStore((s) => s.manifest);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={scroller}
      id="explainer-panel"
      role="tabpanel"
      aria-labelledby="tab-explainer"
      className="x-scroller fixed inset-0 z-20 overflow-y-auto bg-ink"
    >
      <ScrollerContext.Provider value={scroller}>
        <div ref={content}>
          <ProgressBar content={content} />
          <Hero />
          <div className="mx-auto max-w-5xl px-5 md:px-8">
            <ChainStory />
          </div>
          <Figures />
          <div className="mx-auto max-w-5xl px-5 pb-16 md:px-8">
            <Video />

            <Section id="method" eyebrow="How it works" title="Teaching a machine to see a magnetosphere">
              <Method />
            </Section>

            {/* HoldoutSection carries its own eyebrow and heading. */}
            <div className="x-section">
              <Reveal className="glass p-5 md:p-7">
                <HoldoutSection />
              </Reveal>
            </div>

            <Section id="catalogue" eyebrow="The data" title="Eight storms, 2010–2026">
              <Reveal>
                <Catalogue />
              </Reveal>
            </Section>

            <Section id="notes" eyebrow="Honest notes" title="What to keep in mind">
              <HonestNotes />
            </Section>

            <footer className="border-t border-white/[0.06] pt-6 text-[12px] leading-relaxed text-stone-500">
              <p>{manifest?.data.citation ?? "NASA/GSFC OMNI 5-min data via OMNIWeb/CDAWeb."}</p>
              <p className="mt-1">
                Artifacts: {manifest ? `${manifest.source} · ${manifest.model.kind} · generated ${formatDate(manifest.generated_at)}` : "—"} · Sheridan
                Datathon 2026 · NASA Track, Problem 2.
              </p>
            </footer>
          </div>
        </div>
      </ScrollerContext.Provider>
    </div>
  );
}

/** Hairline reading-progress bar: whole-page progress lands in `--sp` on the content wrapper. */
function ProgressBar({ content }: { content: RefObject<HTMLDivElement> }) {
  useScrollVar(content, "track", "--sp");
  return <div className="x-progress" aria-hidden="true" />;
}
