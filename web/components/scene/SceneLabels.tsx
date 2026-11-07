"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import { GEO_RE, SCENE, magnetopauseSceneRadius, standoffToScene } from "@/lib/glsl";
import { liveFrame } from "@/lib/live";
import { useDialStore, type SceneObject } from "@/lib/store";

/**
 * Live labels pinned to the scene objects. Each label is a real button (click selects, double-
 * click flies to the object) and shows the object's current value. Values are written straight to
 * the DOM from useFrame, so playback never triggers a React render.
 */

const POLE = new THREE.Vector3(-Math.sin(SCENE.tilt), Math.cos(SCENE.tilt), 0);
const MP_COS = Math.cos(THREE.MathUtils.degToRad(52));
const MP_SIN = Math.sin(THREE.MathUtils.degToRad(52));

const LABELS: { id: SceneObject; name: string; hint: string }[] = [
  { id: "sun", name: "Solar wind", hint: "Speed of the incoming solar wind" },
  { id: "earth", name: "Earth", hint: "What-if SYM-H: how hard the storm hits" },
  { id: "magnetopause", name: "Magnetopause", hint: "Distance to Earth's magnetic shield" },
  { id: "aurora", name: "Aurora", hint: "Lowest latitude the aurora reaches" },
];

function stop(e: ReactMouseEvent | ReactPointerEvent) {
  e.stopPropagation();
}

function SceneLabel({
  id,
  name,
  hint,
  valueRef,
}: {
  id: SceneObject;
  name: string;
  hint: string;
  valueRef: (el: HTMLSpanElement | null) => void;
}) {
  const selected = useDialStore((s) => s.selected === id);
  const hovered = useDialStore((s) => s.hovered === id);
  const labels = useDialStore((s) => s.labels);
  if (!labels && !selected) return null;
  return (
    <button
      type="button"
      className="scene-label"
      data-active={selected || undefined}
      data-hover={hovered || undefined}
      aria-label={`${name}: select`}
      aria-pressed={selected}
      title={`${hint}. Click for details, double-click to fly there.`}
      onPointerDown={stop}
      onPointerEnter={() => useDialStore.getState().hover(id)}
      onPointerLeave={() => {
        if (useDialStore.getState().hovered === id) useDialStore.getState().hover(null);
      }}
      onClick={(e) => {
        stop(e);
        const s = useDialStore.getState();
        s.select(s.selected === id ? null : id);
      }}
      onDoubleClick={(e) => {
        stop(e);
        const s = useDialStore.getState();
        s.select(id);
        s.focusOn(id);
      }}
    >
      <span className="scene-label-dot" aria-hidden="true" />
      <span className="text-slate-200">{name}</span>
      <span ref={valueRef} className="scene-label-value" />
    </button>
  );
}

export default function SceneLabels() {
  const values = useRef<Partial<Record<SceneObject, HTMLSpanElement | null>>>({});
  const mpGroup = useRef<THREE.Group>(null);
  const r0 = useRef(10);
  const refs = useMemo(
    () =>
      Object.fromEntries(LABELS.map((l) => [l.id, (el: HTMLSpanElement | null) => void (values.current[l.id] = el)])) as Record<
        SceneObject,
        (el: HTMLSpanElement | null) => void
      >,
    [],
  );
  const mpSelected = useDialStore((s) => s.selected === "magnetopause");

  useFrame((_, dt) => {
    const s = useDialStore.getState();
    const f = liveFrame(s.bundle, s.activeTrace, s.params, s.cursor);
    r0.current = THREE.MathUtils.damp(r0.current, f.standoffRe, 3, dt);
    const r = magnetopauseSceneRadius(r0.current, MP_COS);
    mpGroup.current?.position.set(-MP_COS * r, MP_SIN * r, 0);
    if (!f.ready) return;
    const write = (id: SceneObject, text: string, color?: string) => {
      const el = values.current[id];
      if (!el) return;
      if (el.textContent !== text) el.textContent = text;
      if (color && el.style.color !== color) el.style.color = color;
    };
    write("sun", `${f.speed.toFixed(0)} km/s`);
    write("earth", `${f.symH.toFixed(0)} nT`, f.tier.color);
    write("magnetopause", `${f.standoffRe.toFixed(1)} Rₑ`, f.standoffRe < GEO_RE ? "#fb923c" : undefined);
    write("aurora", `${f.auroraLat.toFixed(0)}°`);
  });

  const common = { center: true, zIndexRange: [6, 0] as [number, number] };
  const label = (id: SceneObject) => {
    const l = LABELS.find((x) => x.id === id)!;
    return <SceneLabel id={l.id} name={l.name} hint={l.hint} valueRef={refs[l.id]} />;
  };

  return (
    <>
      <group position={[SCENE.sunPosition[0], SCENE.sunPosition[1] + SCENE.sunRadius * 1.42, 0]}>
        <Html {...common}>{label("sun")}</Html>
      </group>
      <group position={[0, -SCENE.earthRadius * 1.5, 0]}>
        <Html {...common}>{label("earth")}</Html>
      </group>
      <group position={POLE.clone().multiplyScalar(SCENE.earthRadius * 1.35).toArray()}>
        <Html {...common}>{label("aurora")}</Html>
      </group>
      <group ref={mpGroup}>
        <Html {...common}>{label("magnetopause")}</Html>
      </group>
      {mpSelected && (
        <group position={[0, -0.22, standoffToScene(GEO_RE)]}>
          <Html {...common}>
            <span className="pointer-events-none select-none whitespace-nowrap font-mono text-[10px] tracking-wide text-slate-400/80">
              geostationary orbit · 6.6 R<sub>E</sub>
            </span>
          </Html>
        </group>
      )}
    </>
  );
}
