"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SCENE, magnetopauseSceneRadius } from "@/lib/glsl";
import { liveFrame } from "@/lib/live";
import { useDialStore } from "@/lib/store";

/**
 * Reconnection flash at the magnetopause nose. Its strength follows the coupling v·Bs, so a
 * northward IMF (Bs = 0) gives no flash at all: the single idea the scene most needs to teach.
 * Below ~0.5 mV/m almost no energy enters (the Burton injection threshold), so the flash starts
 * there and saturates near 12.5 mV/m.
 */

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragment = /* glsl */ `
uniform float uStrength;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c);
  float core = exp(-r * r * 90.0);
  float halo = exp(-r * r * 14.0) * 0.35;
  float flicker = 0.75 + 0.25 * sin(uTime * 9.0) * sin(uTime * 3.7);
  vec3 col = mix(vec3(1.0, 0.25, 0.55), vec3(1.0, 0.9, 0.9), core) * (core * 2.6 + halo) * uStrength * flicker;
  gl_FragColor = vec4(col, 1.0);
}
`;

export default function ReconnectionFlash() {
  const ref = useRef<THREE.Mesh>(null);
  const smooth = useRef({ r0: 10, flash: 0 });

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uStrength: { value: 0 }, uTime: { value: 0 } },
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state, dt) => {
    const s = useDialStore.getState();
    const f = liveFrame(s.bundle, s.activeTrace, s.params, s.cursor);
    const sm = smooth.current;
    sm.r0 = THREE.MathUtils.damp(sm.r0, f.standoffRe, 3, dt);
    sm.flash = THREE.MathUtils.damp(sm.flash, THREE.MathUtils.clamp((f.coupling - 0.5) / 12, 0, 1), 4, dt);
    material.uniforms.uStrength.value = sm.flash;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    const m = ref.current;
    if (m) {
      // Sub-solar point of the same boundary the Magnetopause shell draws.
      m.position.set(-magnetopauseSceneRadius(sm.r0, 1), 0, 0);
      m.quaternion.copy(state.camera.quaternion);
      m.visible = sm.flash > 0.01;
    }
  });

  return (
    <mesh ref={ref} renderOrder={5} raycast={() => null}>
      <planeGeometry args={[SCENE.earthRadius * 2.4, SCENE.earthRadius * 2.4]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
