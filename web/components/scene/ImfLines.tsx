"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SCENE, standoffToScene } from "@/lib/glsl";
import { liveFrame } from "@/lib/live";
import { useDialStore } from "@/lib/store";

/**
 * The solar wind's own magnetic field (IMF Bz), drawn as a few vertical field lines carried by the
 * wind toward Earth. Dashes flow up for northward field and down for southward field, and the
 * colour flips teal -> magenta, so the direction of Bz reads at a glance. Lines fade out as they
 * reach the magnetopause nose.
 */

const vertex = /* glsl */ `
attribute float aY;
attribute float aSeed;
uniform float uPhase;
uniform float uStartX;
uniform float uNoseX;
uniform float uTime;
varying float vY;
varying float vFade;
void main() {
  float life = fract(aSeed + uPhase);
  float x = mix(uStartX, uNoseX - 0.6, life);
  float z = (fract(aSeed * 7.31) - 0.5) * 7.0;
  float y = aY * 2.6 + (fract(aSeed * 3.17) - 0.5) * 2.0;
  x += 0.18 * sin(aY * 3.0 + uTime * 0.8 + aSeed * 20.0);
  vY = aY;
  vFade = smoothstep(0.0, 0.12, life) * smoothstep(1.0, 0.82, life);
  gl_Position = projectionMatrix * viewMatrix * vec4(x, y, z, 1.0);
}
`;

const fragment = /* glsl */ `
uniform float uTime;
uniform float uDir;
uniform float uSouth;
uniform float uStrength;
varying float vY;
varying float vFade;
void main() {
  float dash = smoothstep(0.35, 0.6, fract(vY * 3.0 + uTime * 0.9 * uDir));
  float ends = smoothstep(1.0, 0.7, abs(vY));
  vec3 north = vec3(0.5, 1.0, 0.78);
  vec3 south = vec3(1.0, 0.28, 0.36);
  vec3 col = mix(north, south, uSouth);
  float a = vFade * ends * (0.18 + dash * 1.1) * uStrength;
  gl_FragColor = vec4(col * a, 1.0);
}
`;

const LINES = 9;
const SAMPLES = 24;

export default function ImfLines() {
  const phase = useRef(0);
  const smooth = useRef({ south: 0, dir: 1, strength: 0.4, nose: -standoffToScene(10) });

  const geometry = useMemo(() => {
    const ys: number[] = [];
    const seeds: number[] = [];
    for (let l = 0; l < LINES; l++) {
      const seed = (l + 0.5) / LINES;
      for (let i = 0; i < SAMPLES; i++) {
        const a = -1 + (2 * i) / SAMPLES;
        const b = -1 + (2 * (i + 1)) / SAMPLES;
        ys.push(a, b);
        seeds.push(seed, seed);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(ys.length * 3), 3));
    g.setAttribute("aY", new THREE.Float32BufferAttribute(ys, 1));
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uPhase: { value: 0 },
          // Start just off the solar limb.
          uStartX: { value: SCENE.windStartX + 0.4 },
          uNoseX: { value: -standoffToScene(10) },
          uTime: { value: 0 },
          uDir: { value: 1 },
          uSouth: { value: 0 },
          uStrength: { value: 0.4 },
        },
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state, dt) => {
    const s = useDialStore.getState();
    const f = liveFrame(s.bundle, s.activeTrace, s.params, s.cursor);
    const sm = smooth.current;
    const south = f.bz < 0 ? 1 : 0;
    sm.south = THREE.MathUtils.damp(sm.south, south, 5, dt);
    sm.dir = THREE.MathUtils.damp(sm.dir, f.bz < 0 ? -1 : 1, 5, dt);
    sm.strength = THREE.MathUtils.damp(sm.strength, THREE.MathUtils.clamp(0.35 + Math.abs(f.bz) / 20, 0.35, 1.6), 3, dt);
    sm.nose = THREE.MathUtils.damp(sm.nose, -standoffToScene(f.standoffRe), 3, dt);
    phase.current = (phase.current + Math.min(dt, 0.1) * 0.03 * (f.speed / 400)) % 1000;
    const u = material.uniforms;
    u.uPhase.value = phase.current;
    u.uNoseX.value = sm.nose;
    u.uTime.value = state.clock.elapsedTime;
    u.uDir.value = sm.dir;
    u.uSouth.value = sm.south;
    u.uStrength.value = sm.strength;
  });

  return <lineSegments geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />;
}
