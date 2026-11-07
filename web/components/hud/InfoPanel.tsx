"use client";

import type { ReactNode } from "react";
import { GEO_RE } from "@/lib/glsl";
import { liveFrame, type LiveFrame } from "@/lib/live";
import { auroraLatitude, tierFor } from "@/lib/severity";
import { useDialStore, type SceneObject } from "@/lib/store";
import { DEFAULT_PARAMS, type Params, type StormRecord } from "@/lib/types";
import { CloseIcon, TargetIcon } from "./icons";

/**
 * Level-2 information: a compact floating card for the selected scene object. The essentials come
 * first; derivations and caveats sit behind a disclosure (level 3). Values follow the playhead.
 */

const fmt = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(d));
const signed = (v: number, d = 0) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`;

function Hero({ value, unit, color, caption }: { value: string; unit: string; color?: string; caption: ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[30px] leading-none tabular-nums" style={{ color }}>
        {value}
        <span className="ml-1.5 text-[12px] text-slate-500">{unit}</span>
      </div>
      <div className="mt-1.5 text-[11.5px] text-slate-400">{caption}</div>
    </div>
  );
}

function Row({ label, value, unit, color, note }: { label: string; value: string; unit?: string; color?: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1" title={note}>
      <dt className="text-[12px] text-slate-400">{label}</dt>
      <dd className="font-mono text-[12.5px] tabular-nums text-slate-100" style={{ color }}>
        {value}
        {unit && <span className="ml-1 text-[10.5px] text-slate-500">{unit}</span>}
      </dd>
    </div>
  );
}

function More({ children }: { children: ReactNode }) {
  return (
    <details className="group mt-2 border-t border-white/[0.06] pt-2">
      <summary className="cursor-pointer list-none text-[11.5px] text-slate-400 hover:text-slate-200 [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">How this is computed ›</span>
        <span className="hidden group-open:inline">Hide details</span>
      </summary>
      <div className="mt-2 space-y-2 text-[11.5px] leading-relaxed text-slate-400">{children}</div>
    </details>
  );
}

function EarthBody({ f, peak, observedMin }: { f: LiveFrame; peak: number | null; observedMin: number | null }) {
  const delta = f.observed !== null ? f.symH - f.observed : null;
  const peakTier = tierFor(peak ?? 0);
  return (
    <>
      <Hero
        value={fmt(f.symH)}
        unit="nT"
        color={f.tier.color}
        caption={
          <>
            What-if SYM-H now ·{" "}
            <span style={{ color: f.tier.color }}>
              {f.tier.display} {f.tier.label}
            </span>
          </>
        }
      />
      <dl className="mt-3 divide-y divide-white/[0.04]">
        <Row label="Observed now" value={fmt(f.observed)} unit="nT" />
        <Row
          label="Δ vs history"
          value={delta === null ? "—" : signed(delta)}
          unit="nT"
          color={delta !== null && delta < -1 ? "#fb7185" : delta !== null && delta > 1 ? "#86efac" : undefined}
          note="What-if minus observed SYM-H at the playhead; negative means a deeper storm."
        />
        <Row label="Peak what-if" value={fmt(peak)} unit={`nT · ${peakTier.display}`} color={peakTier.color} />
        <Row label="Observed peak" value={fmt(observedMin)} unit="nT" />
      </dl>
      <More>
        <p>
          SYM-H is the 1-minute disturbance of Earth&apos;s horizontal magnetic field at low latitudes, driven by the storm-time ring current. More
          negative means a stronger storm.
        </p>
        <p>
          The what-if value is the ML surrogate (Ridge backbone + XGBoost residual), precomputed on a grid of scaled solar-wind inputs and
          interpolated in the browser. G-tiers are an approximate SYM-H mapping, not NOAA products.
        </p>
        {f.filled && <p className="text-alert-300">Solar-wind data has a gap here; the last valid value is held.</p>}
      </More>
    </>
  );
}

function SunBody({ f, params, storm, trainMax, peakCoupling }: { f: LiveFrame; params: Params; storm: StormRecord | null; trainMax: number; peakCoupling: number }) {
  const mult = (k: keyof Params) => (params[k] !== 1 ? ` ×${params[k].toFixed(2)}` : "");
  return (
    <>
      <Hero value={fmt(f.speed)} unit="km/s" caption={<>Solar-wind speed at Earth{mult("speed") && <span className="text-plasma-300">{mult("speed")}</span>}</>} />
      <dl className="mt-3 divide-y divide-white/[0.04]">
        <Row label={`IMF Bz${mult("bz")}`} value={fmt(f.bz, 1)} unit="nT" color={f.bz < 0 ? "#f9a8d4" : undefined} note="Southward (negative) Bz opens the magnetosphere to the solar wind." />
        <Row label={`Proton density${mult("density")}`} value={fmt(f.density, 1)} unit="cm⁻³" />
        <Row label="Dynamic pressure" value={fmt(f.pdyn, 1)} unit="nPa" />
        <Row label="Coupling v·Bs" value={fmt(f.coupling, 1)} unit="mV/m" color="#fdba74" note="Rate at which solar-wind energy enters the magnetosphere." />
      </dl>
      <More>
        <p>
          Values are NASA OMNI 5-minute data, already time-shifted to Earth&apos;s bow shock, multiplied by the dials. The Sun in the scene marks the
          source; distances are not to scale.
        </p>
        {storm && (
          <dl>
            <Row label="Storm max speed" value={fmt(storm.max_speed_km_s != null ? storm.max_speed_km_s * params.speed : null)} unit="km/s" />
            <Row label="Storm min Bz" value={fmt(storm.min_bz_nT != null ? Math.min(storm.min_bz_nT, 0) * params.bz : null, 1)} unit="nT" />
            <Row
              label="Storm peak Pdyn"
              value={fmt(storm.max_pdyn_nPa != null ? storm.max_pdyn_nPa * params.density * params.speed ** 2 : null, 1)}
              unit="nPa"
            />
            <Row label="Peak coupling" value={fmt(peakCoupling, 1)} unit={`/ ${trainMax.toFixed(1)} train max`} />
          </dl>
        )}
        <p>Pdyn = 1.6726×10⁻⁶ · n · v² nPa; coupling = v · Bs × 10⁻³ mV/m with Bs = max(−Bz, 0).</p>
      </More>
    </>
  );
}

function MagnetopauseBody({ f, hist, dialled }: { f: LiveFrame; hist: LiveFrame; dialled: boolean }) {
  const inside = f.standoffRe < GEO_RE;
  return (
    <>
      <Hero
        value={fmt(f.standoffRe, 1)}
        unit="Rₑ"
        color={inside ? "#fb923c" : undefined}
        caption={<>Sub-solar stand-off distance (Earth radii){dialled && <> · historic {fmt(hist.standoffRe, 1)} Rₑ</>}</>}
      />
      <div
        className={`mt-3 rounded-[10px] px-2.5 py-2 text-[11.5px] leading-snug ${inside ? "bg-orange-500/10 text-orange-200" : "bg-white/[0.04] text-slate-300"}`}
        role="status"
      >
        {inside
          ? "Inside geostationary orbit: dayside GEO satellites sit in the solar wind (red markers)."
          : `Geostationary orbit (${GEO_RE} Rₑ) is shielded.`}
      </div>
      <dl className="mt-2 divide-y divide-white/[0.04]">
        <Row label="Dynamic pressure" value={fmt(f.pdyn, 1)} unit="nPa" />
        <Row label="IMF Bz" value={fmt(f.bz, 1)} unit="nT" />
        {dialled && <Row label="Δ vs historic" value={signed(f.standoffRe - hist.standoffRe, 1)} unit="Rₑ" />}
      </dl>
      <More>
        <p>Shue et al. (1998): r₀ = (10.22 + 1.29 tanh(0.184 (Bz + 8.14))) · Pdyn^(−1/6.6), with flaring (2 / (1 + cos θ))^0.6.</p>
        <p>
          The faint wire shell (when a dial is moved) is the boundary for the observed drivers. Radial distances in the scene are compressed so the
          shell stays on screen; the stand-off and the GEO ring use the same scale.
        </p>
      </More>
    </>
  );
}

function AuroraBody({ f }: { f: LiveFrame }) {
  const obsLat = f.observed === null ? null : auroraLatitude(f.observed);
  const diff = obsLat === null ? null : f.auroraLat - obsLat;
  return (
    <>
      <Hero value={`${fmt(f.auroraLat, 1)}°`} unit="lat" color="#86efac" caption="Equatorward edge of the auroral oval (what-if)" />
      <dl className="mt-3 divide-y divide-white/[0.04]">
        <Row label="With observed SYM-H" value={obsLat === null ? "—" : `${obsLat.toFixed(1)}°`} note="Drawn as the thin white line on the globe." />
        <Row label="Shift" value={diff === null ? "—" : `${signed(diff, 1)}°`} color={diff !== null && diff < -0.05 ? "#86efac" : undefined} />
      </dl>
      <More>
        <p>Lat ≈ 65° − 0.05 · |SYM-H|, clamped at 38°. A rough communication aid for where aurora could be seen overhead, not a NOAA forecast.</p>
        <p>The oval sits further poleward on the dayside, brightens with storm depth and reddens in the strongest storms.</p>
      </More>
    </>
  );
}

const TITLES: Record<SceneObject, { title: string; sub: string }> = {
  earth: { title: "Earth", sub: "Storm response · SYM-H" },
  sun: { title: "Solar wind", sub: "Drivers arriving at Earth" },
  magnetopause: { title: "Magnetopause", sub: "Earth's magnetic shield" },
  aurora: { title: "Aurora", sub: "Auroral oval boundary" },
};

export default function InfoPanel() {
  const selected = useDialStore((s) => s.selected);
  const bundle = useDialStore((s) => s.bundle);
  const trace = useDialStore((s) => s.activeTrace);
  const params = useDialStore((s) => s.params);
  const cursor = useDialStore((s) => s.cursor);
  const tracePeak = useDialStore((s) => s.tracePeak);
  const storms = useDialStore((s) => s.storms);
  const activeId = useDialStore((s) => s.activeStormId);
  const peakCoupling = useDialStore((s) => s.peakCoupling);
  const manifest = useDialStore((s) => s.manifest);
  if (!selected) return null;

  const f = liveFrame(bundle, trace, params, cursor);
  const hist = liveFrame(bundle, trace, DEFAULT_PARAMS, cursor);
  const dialled = params.bz !== 1 || params.speed !== 1 || params.density !== 1;
  const storm = storms.find((s) => s.id === activeId) ?? null;
  const trainMax = bundle?.grid.trainMaxCoupling ?? manifest?.coupling.train_max_mV_m ?? 0;
  const t = TITLES[selected];
  const { select, focusOn } = useDialStore.getState();

  return (
    <aside key={selected} aria-label={`${t.title} details`} className="glass panel-in pointer-events-auto w-[min(calc(100vw-24px),300px)] p-3.5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-semibold text-white">{t.title}</h2>
          <p className="text-[11px] text-slate-500">{t.sub}</p>
        </div>
        <div className="-mr-1.5 -mt-1 flex">
          <button type="button" className="icon-btn" aria-label={`Fly to ${t.title}`} data-tip="Fly to" onClick={() => focusOn(selected)}>
            <TargetIcon />
          </button>
          <button type="button" className="icon-btn" aria-label="Close details" data-tip="Close  Esc" data-tip-pos="left" onClick={() => select(null)}>
            <CloseIcon />
          </button>
        </div>
      </div>
      {!f.ready ? (
        <p className="text-[12px] text-slate-500">Loading storm…</p>
      ) : selected === "earth" ? (
        <EarthBody f={f} peak={tracePeak?.value ?? null} observedMin={bundle?.observedMin ?? null} />
      ) : selected === "sun" ? (
        <SunBody f={f} params={params} storm={storm} trainMax={trainMax} peakCoupling={peakCoupling} />
      ) : selected === "magnetopause" ? (
        <MagnetopauseBody f={f} hist={hist} dialled={dialled} />
      ) : (
        <AuroraBody f={f} />
      )}
    </aside>
  );
}
