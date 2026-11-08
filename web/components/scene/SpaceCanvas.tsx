"use client";

import { Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useState } from "react";
import { useDialStore } from "@/lib/store";
import AuroraRing from "./AuroraRing";
import CameraRig from "./CameraRig";
import Earth from "./Earth";
import Magnetopause from "./Magnetopause";
import SceneLabels from "./SceneLabels";
import SelectionHalo from "./SelectionHalo";
import SolarWindParticles from "./SolarWindParticles";
import Sun from "./Sun";

/**
 * Full-screen WebGL 2 scene and the primary interface of the app. Three.js r170 ships a WebGL
 * 2-only renderer; `onCreated` verifies the context anyway and surfaces a readable message.
 *
 * Layout (scene units, Earth radius = 1 R_E = 1.5): Sun at x = -30, Earth at the origin, the
 * magnetopause shell and geostationary ring around Earth. Every object is selectable (click),
 * focusable (double-click) and labelled with its live value.
 */
export default function SpaceCanvas() {
  const [glError, setGlError] = useState<string | null>(null);
  // While the landing page covers the scene, render once (warms shaders) and then idle.
  const covered = useDialStore((s) => s.landing === "landing");

  return (
    <div className="fixed inset-0 z-0 bg-void" role="region" aria-label="3D scene: Sun, solar wind, Earth and magnetosphere">
      <Canvas
        dpr={[1, 1.5]}
        frameloop={covered ? "demand" : "always"}
        flat
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", stencil: false }}
        camera={{ position: [26, 15, 44], fov: 45, near: 0.1, far: 600 }}
        onCreated={({ gl }) => {
          if (!gl.capabilities.isWebGL2) setGlError("WebGL 2 is not available in this browser.");
        }}
      >
        <color attach="background" args={["#03050c"]} />
        <Stars radius={220} depth={80} count={6000} factor={4} saturation={0.15} fade speed={0.4} />
        <Sun />
        <SolarWindParticles count={20_000} />
        <Magnetopause />
        <Earth>
          <AuroraRing />
        </Earth>
        <SelectionHalo />
        <SceneLabels />
        <CameraRig />
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.9} luminanceSmoothing={0.25} radius={0.7} />
        </EffectComposer>
      </Canvas>
      {glError && <div className="absolute inset-0 grid place-items-center text-sm text-slate-300">{glError}</div>}
    </div>
  );
}
