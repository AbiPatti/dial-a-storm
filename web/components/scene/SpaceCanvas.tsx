"use client";

import { Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useState } from "react";
import { useDialStore } from "@/lib/store";
import AuroraRing from "./AuroraRing";
import CameraRig from "./CameraRig";
import Earth from "./Earth";
import FieldLines from "./FieldLines";
import ImfLines from "./ImfLines";
import Magnetopause from "./Magnetopause";
import ReconnectionFlash from "./ReconnectionFlash";
import RingCurrent from "./RingCurrent";
import SceneLabels from "./SceneLabels";
import SelectionHalo from "./SelectionHalo";
import SolarEruption from "./SolarEruption";
import SolarWindParticles from "./SolarWindParticles";
import Sun from "./Sun";

/**
 * Full-screen WebGL 2 scene and the primary interface of the app. Three.js r170 ships a WebGL
 * 2-only renderer; `onCreated` verifies the context anyway and surfaces a readable message.
 *
 * Layout (scene units, Earth radius = 1 R_E = 1.5): Sun at x = -30, Earth at the origin, the
 * magnetopause shell and geostationary ring around Earth. Every object is selectable (click),
 * focusable (double-click) and labelled with its live value.
 *
 * `active` pauses the render loop while another tab covers the scene, so the GPU idles.
 */
export default function SpaceCanvas({ active = true }: { active?: boolean }) {
  const [glError, setGlError] = useState<string | null>(null);
  // While the landing page covers the scene, render once (warms shaders) and then idle.
  const covered = useDialStore((s) => s.landing === "landing");

  return (
    <div className="fixed inset-0 z-0 bg-ink" role="region" aria-label="3D scene: Sun, solar wind, Earth and magnetosphere">
      <Canvas
        dpr={[1, 1.5]}
        // Idle behind the landing page (render on demand) and stop entirely behind the Explainer tab.
        frameloop={!active ? "never" : covered ? "demand" : "always"}
        flat
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", stencil: false }}
        camera={{ position: [26, 15, 44], fov: 45, near: 0.1, far: 600 }}
        onCreated={({ gl }) => {
          if (!gl.capabilities.isWebGL2) setGlError("WebGL 2 is not available in this browser.");
        }}
      >
        <color attach="background" args={["#08060a"]} />
        <Stars radius={220} depth={80} count={6000} factor={4} saturation={0.15} fade speed={0.4} />
        <Sun />
        <SolarEruption />
        <SolarWindParticles count={12_000} />
        <ImfLines />
        <Magnetopause />
        <ReconnectionFlash />
        <Earth>
          <AuroraRing />
          <FieldLines />
          <RingCurrent />
        </Earth>
        <SelectionHalo />
        <SceneLabels />
        <CameraRig />
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.9} luminanceSmoothing={0.25} radius={0.7} />
        </EffectComposer>
      </Canvas>
      {/* Vignette and film grain from the homescreen design. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(8,6,10,0.75)_100%)]" />
      <div className="grain pointer-events-none absolute inset-0" />
      {glError && <div className="absolute inset-0 grid place-items-center text-sm text-slate-300">{glError}</div>}
    </div>
  );
}
