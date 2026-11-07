"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SCENE, standoffToScene } from "@/lib/glsl";
import { liveFrame } from "@/lib/live";
import { useDialStore } from "@/lib/store";

/**
 * GPU-animated solar wind: every particle's position is a pure function of its seed and a global
 * flow phase, so 20,000 particles cost one draw call and no per-frame CPU work.
 *
 * - Flow phase is integrated on the CPU (phase += dt * k * v), so changing speed changes the rate
 *   smoothly instead of teleporting particles.
 * - Density controls the visible fraction of particles and their brightness.
 * - Particles are deflected around a magnetopause r(theta) = r0 (2 / (1 + cos theta))^0.6,
 *   where r0 follows the Shue et al. (1998) stand-off for the current Bz and Pdyn.
 */

const vertex = /* glsl */ `
attribute vec4 aSeed;
attribute float aKeep;
uniform float uPhase;
uniform float uStartX;
uniform float uEndX;
uniform float uStandoff;
uniform float uDensityFrac;
uniform float uSize;
uniform float uPixelRatio;
uniform float uSpeedNorm;
varying float vAlpha;
varying float vSpeed;
varying float vCompress;
void main() {
  if (aKeep > uDensityFrac) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    vSpeed = 0.0;
    vCompress = 0.0;
    return;
  }
  float life = fract(aSeed.x + uPhase * (0.85 + 0.3 * aSeed.w));
  float x = mix(uStartX, uEndX, life);
  float spread = mix(0.22, 1.0, smoothstep(0.0, 0.55, life));
  float r = 6.5 * sqrt(aSeed.y) * spread;
  float ang = aSeed.z * 6.28318530718;
  vec3 p = vec3(x, r * sin(ang), r * cos(ang));

  float d = max(length(p), 1e-4);
  float cosT = -p.x / d;
  float rmp = uStandoff * pow(2.0 / (1.0 + max(cosT, -0.6)), 0.6);
  float k = smoothstep(rmp * 1.35, rmp * 0.98, d);
  float target = max(d, rmp * (1.02 + 0.1 * aSeed.w));
  p = (p / d) * mix(d, target, k);

  vCompress = k * smoothstep(-0.2, 0.8, cosT);
  vSpeed = uSpeedNorm;
  vAlpha = smoothstep(0.0, 0.05, life) * smoothstep(1.0, 0.86, life);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * uPixelRatio * (0.7 + aSeed.w) * 30.0 / max(-mv.z, 0.5);
  gl_Position = projectionMatrix * mv;
}
`;

const fragment = /* glsl */ `
uniform float uBrightness;
varying float vAlpha;
varying float vSpeed;
varying float vCompress;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c);
  if (r2 > 0.25 || vAlpha <= 0.0) discard;
  float soft = exp(-r2 * 14.0);
  vec3 slow = vec3(1.0, 0.62, 0.25);
  vec3 fast = vec3(0.65, 0.86, 1.0);
  vec3 col = mix(slow, fast, vSpeed);
  col += vec3(1.0, 0.5, 0.9) * vCompress * 0.8;
  gl_FragColor = vec4(col * soft * vAlpha * uBrightness * (0.55 + 1.2 * vCompress), 1.0);
}
`;

interface SolarWindParticlesProps {
  count?: number;
}

export default function SolarWindParticles({ count = 20_000 }: SolarWindParticlesProps) {
  const dpr = useThree((s) => s.viewport.dpr);
  const phase = useRef(0);
  const smooth = useRef({ speed: 400, density: 5, standoff: standoffToScene(10) });

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(count * 4);
    const keep = new Float32Array(count);
    // Deterministic LCG so the field is identical across reloads.
    let state = 0x9e3779b9;
    const rand = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      seeds[i * 4] = rand();
      seeds[i * 4 + 1] = rand();
      seeds[i * 4 + 2] = rand();
      seeds[i * 4 + 3] = rand();
      keep[i] = rand();
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    g.setAttribute("aKeep", new THREE.BufferAttribute(keep, 1));
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uPhase: { value: 0 },
          uStartX: { value: SCENE.windStartX },
          uEndX: { value: SCENE.windEndX },
          uStandoff: { value: standoffToScene(10) },
          uDensityFrac: { value: 0.35 },
          uSize: { value: 1.1 },
          uPixelRatio: { value: 1 },
          uSpeedNorm: { value: 0.2 },
          uBrightness: { value: 1 },
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

  useFrame((_, dt) => {
    const s = useDialStore.getState();
    const f = liveFrame(s.bundle, s.activeTrace, s.params, s.cursor);
    const sm = smooth.current;
    sm.speed = THREE.MathUtils.damp(sm.speed, f.speed, 3, dt);
    sm.density = THREE.MathUtils.damp(sm.density, f.density, 3, dt);
    sm.standoff = THREE.MathUtils.damp(sm.standoff, standoffToScene(f.standoffRe), 3, dt);

    // ~22 s Sun-to-Earth transit at 400 km/s, ~9 s at 1000 km/s (visual time, not physical).
    phase.current = (phase.current + Math.min(dt, 0.1) * 0.045 * (sm.speed / 400)) % 1000;
    const u = material.uniforms;
    u.uPhase.value = phase.current;
    u.uSpeedNorm.value = THREE.MathUtils.clamp((sm.speed - 300) / 700, 0, 1);
    u.uDensityFrac.value = THREE.MathUtils.clamp(0.12 + sm.density / 25, 0.12, 1);
    u.uBrightness.value = 0.7 + 0.5 * Math.min(1, sm.density / 30);
    u.uStandoff.value = sm.standoff;
    u.uPixelRatio.value = dpr;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />;
}
