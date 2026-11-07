"use client";

import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import AuroraRing from "./AuroraRing";
import Earth from "./Earth";
import FieldLines from "./FieldLines";
import ImfLines from "./ImfLines";
import Magnetosphere from "./Magnetosphere";
import RingCurrent from "./RingCurrent";
import SolarWindParticles from "./SolarWindParticles";
import Sun from "./Sun";

/**
 * Full-screen WebGL 2 scene, composed side-on like a diagram: the Sun's limb fills the left edge,
 * the wind streams right, and Earth sits right of centre inside its magnetic shield. No labels:
 * the headline does the explaining. Drag to look around; it eases back to the composition.
 */

/** Two compositions: landscape (Sun limb left, Earth right) and portrait (Earth up top, framed tight). */
const FRAMES = {
  wide: { position: new THREE.Vector3(-3.3, -0.9, 14), target: new THREE.Vector3(-3.3, -1.45, 0) },
  tall: { position: new THREE.Vector3(-1.2, -2.6, 24), target: new THREE.Vector3(-1.2, -3.4, 0) },
};
const INTRO_POSITION = new THREE.Vector3(3, 4, 34);

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Slow fly-in on load, then a gentle breathing drift. Any drag hands control to the user. */
function CameraRig({ controls }: { controls: React.RefObject<OrbitControlsImpl> }) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const frame = aspect < 0.9 ? FRAMES.tall : FRAMES.wide;
  const mode = useRef<"intro" | "idle" | "user">("intro");
  const reduced = useRef(false);
  const goal = useRef(new THREE.Vector3());

  useEffect(() => {
    reduced.current = prefersReducedMotion();
    camera.position.copy(reduced.current ? frame.position : INTRO_POSITION);
    controls.current?.target.copy(frame.target);
    controls.current?.update();
    mode.current = reduced.current ? "idle" : "intro";
    const c = controls.current;
    const start = () => {
      mode.current = "user";
    };
    c?.addEventListener("start", start);
    return () => c?.removeEventListener("start", start);
  }, [camera, controls, frame]);

  useFrame((state, dt) => {
    if (mode.current === "user" || reduced.current) return;
    const t = state.clock.elapsedTime;
    goal.current.copy(frame.position);
    if (mode.current === "idle") goal.current.x += Math.sin(t * 0.07) * 0.6;
    if (mode.current === "idle") goal.current.y += Math.sin(t * 0.05) * 0.3;
    camera.position.lerp(goal.current, 1 - Math.exp(-(mode.current === "intro" ? 1.1 : 0.6) * Math.min(dt, 0.05)));
    controls.current?.update();
    if (mode.current === "intro" && camera.position.distanceTo(frame.position) < 0.05) mode.current = "idle";
  });
  return null;
}

export default function SpaceCanvas() {
  const [glError, setGlError] = useState<string | null>(null);
  const controls = useRef<OrbitControlsImpl>(null);

  return (
    <div className="fixed inset-0 z-0 bg-ink" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        flat
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", stencil: false }}
        camera={{ position: FRAMES.wide.position.toArray(), fov: 42, near: 0.1, far: 600 }}
        onCreated={({ gl }) => {
          if (!gl.capabilities.isWebGL2) setGlError("WebGL 2 is not available in this browser.");
        }}
      >
        <color attach="background" args={["#08060a"]} />
        <Stars radius={200} depth={60} count={1800} factor={2} saturation={0} fade speed={0.2} />
        <Sun />
        <SolarWindParticles count={16_000} />
        <ImfLines />
        <Magnetosphere />
        <Earth>
          <AuroraRing />
          <FieldLines />
          <RingCurrent />
        </Earth>
        <OrbitControls
          ref={controls}
          target={FRAMES.wide.target.toArray()}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          enableZoom={false}
          rotateSpeed={0.4}
          minPolarAngle={0.6}
          maxPolarAngle={Math.PI - 0.6}
          minAzimuthAngle={-0.9}
          maxAzimuthAngle={0.9}
        />
        <CameraRig controls={controls} />
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.82} luminanceSmoothing={0.3} radius={0.75} />
        </EffectComposer>
      </Canvas>
      {/* Warm vignette + film grain: keeps it from looking like a default three.js scene. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_62%_48%,transparent_40%,rgba(8,6,10,0.85)_100%)]" />
      {/* Soft dark fade under the bottom-left text: readable over the Sun with no panel. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_100%,rgba(8,6,10,0.92)_0%,rgba(8,6,10,0.6)_30%,transparent_60%)]" />
      <div className="grain pointer-events-none absolute inset-0" />
      {glError && <div className="absolute inset-0 grid place-items-center text-sm text-stone-300">{glError}</div>}
    </div>
  );
}
