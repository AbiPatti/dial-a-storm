"use client";

import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useState } from "react";
import AuroraRing from "./AuroraRing";
import Earth from "./Earth";
import SolarWindParticles from "./SolarWindParticles";
import Sun from "./Sun";

/**
 * Full-screen WebGL 2 scene. Three.js r170 ships a WebGL 2-only renderer; `onCreated` verifies the
 * context anyway and surfaces a readable message if it is missing.
 *
 * Layout (scene units, Earth radius = 1 R_E = 1.5): Sun at x = -30, Earth at the origin. The
 * camera sits above the ecliptic on the night side, framed so the Sun lands at ~15% of the screen
 * width and Earth at ~65%, left of the control deck, with the ovals and dayside crescent visible.
 */
export default function SpaceCanvas() {
  const [glError, setGlError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-0 bg-void" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        flat
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", stencil: false }}
        camera={{ position: [6, 3.2, 9.5], fov: 50, near: 0.1, far: 600 }}
        onCreated={({ gl }) => {
          if (!gl.capabilities.isWebGL2) setGlError("WebGL 2 is not available in this browser.");
        }}
      >
        <color attach="background" args={["#03050c"]} />
        <Stars radius={220} depth={80} count={6000} factor={4} saturation={0.15} fade speed={0.4} />
        <Sun />
        <SolarWindParticles count={20_000} />
        <Earth>
          <AuroraRing />
        </Earth>
        <OrbitControls
          target={[-2.8, 0.4, 1.1]}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          // Zoom is off so the mouse wheel keeps scrolling the narrative sections below.
          enableZoom={false}
          rotateSpeed={0.5}
        />
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.9} luminanceSmoothing={0.25} radius={0.7} />
        </EffectComposer>
      </Canvas>
      {glError && (
        <div className="absolute inset-0 grid place-items-center text-sm text-slate-300">{glError}</div>
      )}
    </div>
  );
}
