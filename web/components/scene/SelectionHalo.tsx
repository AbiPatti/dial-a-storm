"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SCENE } from "@/lib/glsl";
import { useDialStore, type SceneObject } from "@/lib/store";

/**
 * Camera-facing targeting ring around the selected (or hovered) Sun or Earth. It pops in with a
 * short scale-down, so selection reads as an event. The magnetopause and aurora highlight
 * themselves through their own shader uniforms instead.
 */

const TARGETS: Partial<Record<SceneObject, { position: THREE.Vector3; radius: number }>> = {
  sun: { position: new THREE.Vector3(...SCENE.sunPosition), radius: SCENE.sunRadius * 1.3 },
  earth: { position: new THREE.Vector3(0, 0, 0), radius: SCENE.earthRadius * 1.42 },
};

const fragment = /* glsl */ `
uniform float uAlpha;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float ring = smoothstep(0.012, 0.0, abs(r - 0.9));
  float ticks = step(0.55, fract(a / 6.28318530718 * 40.0 + uTime * 0.03));
  float outer = smoothstep(0.008, 0.0, abs(r - 0.965)) * ticks;
  vec3 col = vec3(0.55, 0.82, 1.0);
  gl_FragColor = vec4(col * (ring * 0.9 + outer * 0.55) * uAlpha, 1.0);
}
`;

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export default function SelectionHalo() {
  const mesh = useRef<THREE.Mesh>(null);
  const alpha = useRef(0);
  const current = useRef<SceneObject | null>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 } },
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state, dt) => {
    const m = mesh.current;
    if (!m) return;
    const s = useDialStore.getState();
    const pick = s.selected && TARGETS[s.selected] ? s.selected : s.hovered && TARGETS[s.hovered] ? s.hovered : null;
    const goal = pick === null ? 0 : pick === s.selected ? 1 : 0.4;
    if (pick !== null && pick !== current.current) {
      current.current = pick;
      alpha.current = 0;
    }
    alpha.current = THREE.MathUtils.damp(alpha.current, goal, 9, dt);
    const t = current.current ? TARGETS[current.current] : undefined;
    m.visible = alpha.current > 0.01 && t !== undefined;
    if (!t) return;
    m.position.copy(t.position);
    m.quaternion.copy(state.camera.quaternion);
    m.scale.setScalar(t.radius * 2 * (1 + 0.18 * (1 - alpha.current)));
    material.uniforms.uAlpha.value = alpha.current;
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh ref={mesh} material={material} renderOrder={10} visible={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
