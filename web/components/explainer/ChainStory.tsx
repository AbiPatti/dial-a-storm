"use client";

import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { formatDate } from "@/lib/live";
import { useDialStore, type SceneObject } from "@/lib/store";
import { ScrollerContext, useScrollVar } from "./scroll";

/**
 * "How a storm reaches Earth" as Apple-style scrollytelling: a diagram stays pinned while the five
 * steps scroll past; the step nearest the middle of the screen is active and lights up its part of
 * the diagram. The step text (and its live numbers for the loaded storm) is unchanged from the
 * original card layout.
 */

const fmt = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(d));

/** Button that jumps to the simulator and flies the camera to an object. */
export function ShowMe({ object, children }: { object: SceneObject; children: ReactNode }) {
  return (
    <button
      type="button"
      className="x-showme"
      onClick={() => {
        const s = useDialStore.getState();
        s.setTab("simulator");
        s.select(object);
        s.focusOn(object);
      }}
    >
      {children}
      <span aria-hidden="true">→</span>
    </button>
  );
}

interface Step {
  k: string;
  title: string;
  label: string;
  body: ReactNode;
  stat?: ReactNode;
  object?: SceneObject;
  cta?: string;
}

function useSteps(): Step[] {
  const storms = useDialStore((s) => s.storms);
  const activeId = useDialStore((s) => s.activeStormId);
  const st = storms.find((s) => s.id === activeId) ?? null;
  const name = st?.name ?? "this storm";
  return [
    {
      k: "01",
      title: "The Sun erupts",
      label: "Eruption",
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
      label: "Shock",
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
      label: "Reconnection",
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
      label: "Ring current",
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
      label: "Aurora",
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
}

/**
 * Schematic of the chain (not to scale): Sun, CME, solar wind, magnetopause, ring current and
 * aurora. `data-step` lights the parts that belong to the active step (CSS in globals.css).
 */
function ChainDiagram({ step }: { step: number }) {
  return (
    <svg viewBox="0 0 480 300" className="x-diagram" data-step={step + 1} role="img" aria-label="Diagram of the Sun-to-Earth chain">
      <defs>
        <radialGradient id="x-sun" cx="45%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#fff1d6" />
          <stop offset="45%" stopColor="#ffb38a" />
          <stop offset="100%" stopColor="#ff6b2c" />
        </radialGradient>
        <radialGradient id="x-sun-glow" r="50%">
          <stop offset="0%" stopColor="#ff8a4c" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ff8a4c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="x-earth" cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#9cc8ff" />
          <stop offset="60%" stopColor="#2a5ea8" />
          <stop offset="100%" stopColor="#0d2246" />
        </radialGradient>
      </defs>

      {/* 01 Sun + CME */}
      <g className="d-sun">
        <circle cx="62" cy="150" r="92" fill="url(#x-sun-glow)" />
        <circle cx="62" cy="150" r="44" fill="url(#x-sun)" />
      </g>
      <g className="d-cme">
        <circle cx="126" cy="150" r="20" />
      </g>

      {/* 02 Solar wind */}
      <g className="d-wind">
        {[96, 123, 150, 177, 204].map((y) => (
          <line key={y} x1="140" y1={y} x2="318" y2={y} />
        ))}
      </g>

      {/* 03 Southward field + reconnection at the nose */}
      <g className="d-bz">
        {[196, 252].map((x) => (
          <g key={x} transform={`translate(${x} 128)`}>
            <line x1="0" y1="0" x2="0" y2="30" />
            <path d="M-5 24 L0 32 L5 24" />
          </g>
        ))}
        <text x="224" y="176" textAnchor="middle">
          Bz south
        </text>
      </g>
      <circle className="d-flash" cx="356" cy="150" r="9" />

      {/* Magnetopause (the shield) */}
      <path className="d-mp" d="M 472 46 Q 250 150 472 254" />

      {/* 04 Ring current */}
      <ellipse className="d-ring" cx="402" cy="150" rx="46" ry="13" />

      {/* Earth */}
      <circle cx="402" cy="150" r="24" fill="url(#x-earth)" />

      {/* 05 Aurora */}
      <g className="d-aurora">
        <path d="M 389 131 Q 402 120 415 131" />
        <path d="M 389 169 Q 402 180 415 169" />
      </g>

      {/* Labels */}
      <g className="d-labels">
        <text x="62" y="222" data-for="1">
          Sun
        </text>
        <text x="229" y="232" data-for="2">
          Solar wind
        </text>
        <text x="402" y="40" data-for="3">
          Magnetopause
        </text>
        <text x="452" y="154" data-for="4">
          Earth
        </text>
      </g>
    </svg>
  );
}

export default function ChainStory() {
  const steps = useSteps();
  const [active, setActive] = useState(0);
  const scroller = useContext(ScrollerContext);
  const track = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  useScrollVar(track, "track");

  // The step crossing the middle band of the screen is the active one.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { root: scroller?.current ?? null, rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    items.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [scroller, steps.length]);

  const cur = steps[active];
  return (
    <div ref={track} className="x-chain">
      {/* Pinned visual */}
      <div className="x-chain-stage" aria-hidden="true">
        <div className="x-chain-stage-inner">
          <div className="flex items-baseline gap-4">
            <span key={cur.k} className="x-chain-num">
              {cur.k}
            </span>
            <span className="x-chain-label">{cur.label}</span>
          </div>
          <ChainDiagram step={active} />
          <div className="x-chain-progress">
            {steps.map((s, i) => (
              <span key={s.k} data-on={i <= active || undefined} />
            ))}
          </div>
        </div>
      </div>

      {/* Steps */}
      <ol className="x-chain-steps">
        {steps.map((s, i) => (
          <li
            key={s.k}
            ref={(el) => {
              items.current[i] = el;
            }}
            data-index={i}
            data-active={i === active || undefined}
            className="x-chain-step"
          >
            <span className="font-mono text-[11px] text-ember-300">{s.k}</span>
            <h3 className="mt-2 font-serif text-3xl leading-tight text-stone-100 md:text-4xl">{s.title}</h3>
            <div className="prose-dial mt-4">{s.body}</div>
            {s.stat && <p className="x-chain-stat">{s.stat}</p>}
            {s.object && s.cta && <ShowMe object={s.object}>{s.cta}</ShowMe>}
          </li>
        ))}
      </ol>
    </div>
  );
}
