"use client";

import type { ReactNode } from "react";
import HoldoutSection from "@/components/ui/HoldoutSection";
import { formatDate } from "@/lib/live";
import { tierById } from "@/lib/severity";
import { useDialStore, type SceneObject } from "@/lib/store";

/**
 * Long-form explainer tab: the physics chain from Sun to aurora, how the model works, the honest
 * hold-out test, the storm catalogue and the limits of the data. Every number on this page comes
 * from manifest.json / storms.json, so it stays correct when the pipeline is re-run.
 */

const fmt = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(d));

function Section({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="border-t border-white/[0.06] py-14 first:border-t-0">
      <p className="micro !text-ember-300">{eyebrow}</p>
      <h2 id={id ? `${id}-title` : undefined} className="mt-3 max-w-3xl font-serif text-4xl leading-[1.05] tracking-tight text-stone-100 md:text-5xl">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Button that jumps to the simulator and flies the camera to an object. */
function ShowMe({ object, children }: { object: SceneObject; children: ReactNode }) {
  return (
    <button
      type="button"
      className="chip mt-3 !border-ember-400/30 !text-ember-300"
      onClick={() => {
        const s = useDialStore.getState();
        s.setTab("simulator");
        s.select(object);
        s.focusOn(object);
      }}
    >
      {children} →
    </button>
  );
}

function Chain() {
  const storms = useDialStore((s) => s.storms);
  const activeId = useDialStore((s) => s.activeStormId);
  const st = storms.find((s) => s.id === activeId) ?? null;
  const name = st?.name ?? "this storm";
  const steps: { k: string; title: string; body: ReactNode; stat?: ReactNode; object?: SceneObject; cta?: string }[] = [
    {
      k: "01",
      title: "The Sun erupts",
      body: (
        <>
          <p>
            A solar flare is a burst of light from a sunspot region. The storm itself comes from what usually follows it: a{" "}
            <b>coronal mass ejection</b> (CME), a billion-tonne cloud of magnetised plasma thrown into space.
          </p>
          <p>
            The dataset starts at Earth, not at the Sun. It records the CME only when it arrives, one to three days later. It holds no flare
            (X-ray) measurements.
          </p>
        </>
      ),
    },
    {
      k: "02",
      title: "The solar wind hits",
      body: (
        <>
          <p>
            A fast CME drives a <b>shock</b> ahead of it. At Earth, wind speed jumps in minutes and the dense, fast plasma squeezes Earth&apos;s
            magnetic bubble (the <b>magnetopause</b>) closer to the planet.
          </p>
          <p>Dynamic pressure, Pdyn = 1.6726×10⁻⁶ · n · v² nPa, sets how hard it squeezes.</p>
        </>
      ),
      stat: st && (
        <>
          {name}: up to <b>{fmt(st.max_speed_km_s)} km/s</b> and <b>{fmt(st.max_pdyn_nPa, 1)} nPa</b>
        </>
      ),
      object: "magnetopause",
      cta: "Watch the shield compress",
    },
    {
      k: "03",
      title: "The field turns south",
      body: (
        <>
          <p>
            Pressure alone makes a bump, not a storm. The key is the direction of the CME&apos;s own magnetic field. When its <b>Bz</b> points
            south, opposite to Earth&apos;s field, the two link up (<b>magnetic reconnection</b>) and the solar wind&apos;s energy gets in.
          </p>
          <p>
            The coupling v·Bs (speed × southward field) is the standard measure of that driving. Northward field gives zero coupling: in the
            simulator, no reconnection flash and no particles captured into the polar cusps.
          </p>
        </>
      ),
      stat: st && (
        <>
          {name}: Bz down to <b>{fmt(st.min_bz_nT, 1)} nT</b>, coupling up to <b>{fmt(st.peak_coupling_mV_m, 1)} mV/m</b>
        </>
      ),
      object: "sun",
      cta: "See the solar-wind drivers",
    },
    {
      k: "04",
      title: "The ring current fills",
      body: (
        <>
          <p>
            Energised particles are pushed into a <b>ring current</b> circling Earth a few Earth radii out. Its magnetic field opposes
            Earth&apos;s, so ground magnetometers see the field weaken. <b>SYM-H</b> measures that dip in nanotesla. The more negative the
            dip, the bigger the storm.
          </p>
          <p>
            Storms have a shape. A short positive bump at the shock, a <b>main phase</b> lasting hours while the ring current builds, and a{" "}
            <b>recovery</b> lasting a day or more as it drains. The simulator&apos;s timeline labels each phase as it plays.
          </p>
        </>
      ),
      stat: st && (
        <>
          {name}: SYM-H reached <b>{fmt(st.peak_sym_h)} nT</b> on {formatDate(st.peak_time)}
        </>
      ),
      object: "earth",
      cta: "Watch Earth's response",
    },
    {
      k: "05",
      title: "What people see",
      body: (
        <>
          <p>
            The auroral oval slides toward the equator as the storm deepens; the simulator uses lat ≈ 65° − 0.05·|SYM-H|, floored at 38°. In
            the strongest storms the magnetopause is pushed inside geostationary orbit (6.6 Earth radii), leaving satellites there exposed to
            the raw solar wind.
          </p>
        </>
      ),
      object: "aurora",
      cta: "See how far south the aurora reaches",
    },
  ];
  return (
    <ol className="grid gap-4 md:grid-cols-2">
      {steps.map((s) => (
        <li key={s.k} className="glass p-5 md:[&:last-child]:col-span-2">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] text-ember-300">{s.k}</span>
            <h3 className="font-serif text-2xl text-stone-100">{s.title}</h3>
          </div>
          <div className="prose-dial mt-3">{s.body}</div>
          {s.stat && <p className="mt-3 rounded-lg bg-white/[0.04] px-3 py-2 font-mono text-[12px] text-stone-300">{s.stat}</p>}
          {s.object && s.cta && <ShowMe object={s.object}>{s.cta}</ShowMe>}
        </li>
      ))}
    </ol>
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
      body: `NASA OMNI 5-minute data, modelled at 15-minute steps. Inputs are only upstream drivers: southward Bz, speed, density, pressure, By, Bt. Every feature at time t uses observations at or before t: lags from 15 min to 12 h, coupling integrals of v·Bs over 1–24 h, and the Burton–O'Brien–McPherron ring-current state, which builds up with v·Bs and decays at the physical rate. SYM-H, AE, AL, PCN and proton flux are banned from the feature space, and the test suite enforces it.`,
    },
    {
      k: "02",
      title: "A backbone that can extrapolate",
      body: `A Ridge regression on the physics ring-current state gives a response that deepens as the driver grows and recovers when it stops, so the predicted peak lands on time. XGBoost then learns only the residual: pressure, IMF-orientation and timing effects. Trained on ${sp?.train?.start_year ?? "—"}–${sp?.train?.end_year ?? "—"}, tuned on ${sp?.val?.start_year ?? "—"}–${sp?.val?.end_year ?? "—"}, tested on ${sp?.test?.start_year ?? "—"}–${sp?.test?.end_year ?? "—"}.`,
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
        {steps.map((s) => (
          <li key={s.k} className="glass p-5">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] text-ember-300">{s.k}</span>
              <h3 className="font-serif text-2xl text-stone-100">{s.title}</h3>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-stone-300">{s.body}</p>
          </li>
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
      {notes.map((n) => (
        <article key={n.title} className="glass p-5">
          <h3 className="font-serif text-xl text-stone-100">{n.title}</h3>
          <div className="prose-dial mt-2">{n.body}</div>
        </article>
      ))}
    </div>
  );
}

export default function ExplainerTab() {
  const manifest = useDialStore((s) => s.manifest);
  return (
    <div id="explainer-panel" role="tabpanel" aria-labelledby="tab-explainer" className="fixed inset-0 z-20 overflow-y-auto bg-ink">
      <div className="mx-auto max-w-5xl px-5 pb-16 pt-24 md:px-8">
        <Section eyebrow="Explainer" title={<>How a storm on the Sun <em className="italic text-ember-300">reaches Earth.</em></>}>
          <p className="max-w-2xl text-[17px] leading-relaxed text-stone-300">
            Every storm in this app is real, measured by NASA&apos;s OMNI solar-wind archive from 2010 to 2026. Here is what happens, step by step,
            and how a machine-learning model learns to predict Earth&apos;s response. The numbers below are for the storm you have loaded.
          </p>
          <div className="mt-8">
            <Chain />
          </div>
        </Section>

        <Section id="method" eyebrow="How it works" title="Teaching a machine to see a magnetosphere">
          <Method />
        </Section>

        {/* HoldoutSection carries its own eyebrow and heading. */}
        <div className="border-t border-white/[0.06] py-14">
          <div className="glass p-5 md:p-7">
            <HoldoutSection />
          </div>
        </div>

        <Section id="catalogue" eyebrow="The data" title="Eight storms, 2010–2026">
          <Catalogue />
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
  );
}
