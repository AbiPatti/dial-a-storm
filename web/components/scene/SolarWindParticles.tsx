"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MAGNETOPAUSE_GLSL, SCENE } from "@/lib/glsl";
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
 *   where r0 follows the Shue et al. (1998) stand-off for the current Bz and Pdyn. The shape is
 *   mapped to scene units exactly like the Magnetopause shell (lib/glsl.ts), so they line up.
 */

const vertex = /* glsl */ `
attribute vec4 aSeed;
attribute float aKeep;
uniform float uPhase;
uniform float uStartX;
uniform float uEndX;
uniform float uStandoffRe;
uniform float uEarthR;
uniform float uDensityFrac;
uniform float uSize;
uniform float uPixelRatio;
uniform float uSpeedNorm;
varying float vAlpha;
varying float vSpeed;
varying float vCompress;
${MAGNETOPAUSE_GLSL}
void main() {
  if (aKeep > uDensityFrac) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    vSpeed = 0.0;
    vCompress = 0.0;
    return;
  }

  // Monotonic flow from Sun to deep space past Earth
  float life = fract(aSeed.x + uPhase * (0.85 + 0.3 * aSeed.w));
  float x = mix(uStartX, uEndX, life);

  // Solar wind cone expands from Sun surface toward Earth, then gently expands into deep space
  float spread = mix(0.22, 1.0, smoothstep(0.0, 0.55, life)) + 0.12 * smoothstep(0.55, 1.0, life);
  float rIn = 6.5 * sqrt(aSeed.y) * spread;

  // Standoff distances matching the 3D magnetopause shell
  float r0 = magnetopauseRadius(uStandoffRe, 1.0, uEarthR);
  float rFlank = magnetopauseRadius(uStandoffRe, 0.0, uEarthR);
  float xShock = -1.4 * r0;

  // Effective obstacle boundary along x:
  // - Upstream (< xShock): undeflected
  // - Dayside shock & magnetosheath (xShock <= x < 0): smooth deflection outward around nose & flanks
  // - Downstream wake (x >= 0): maintains flank deflection and flares gently into deep space
  //   (physical solar wind does not snap/pinch back to the centerline after passing Earth)
  float rObs = 0.0;
  if (x >= xShock && x < 0.0) {
    float u = (x - xShock) / (-xShock);
    float s = u * u * (3.0 - 2.0 * u);
    rObs = 1.04 * rFlank * pow(s, 0.65);
  } else if (x >= 0.0) {
    float t = x / max(r0, 0.1);
    float flare = 1.0 + 0.24 * pow(min(t, 1.2), 0.65) + 0.04 * max(0.0, t - 1.2);
    rObs = 1.04 * rFlank * flare;
  }

  // Per-particle boundary jitter so the sheath edge feels soft and natural
  float rObsPart = rObs * (0.97 + 0.06 * aSeed.w);

  // Physical streamline deflection around the obstacle:
  // Annular area conservation ensures streamlines never intersect or pinch back
  float rho = sqrt(rObsPart * rObsPart + rIn * rIn);

  float ang = aSeed.z * 6.28318530718;
  vec3 p = vec3(x, rho * sin(ang), rho * cos(ang));

  // Dayside shock heating / compression glow at the bow shock and magnetosheath
  float compAmount = (rho - rIn) / max(rFlank, 1.0);
  float dayside = smoothstep(xShock, xShock * 0.7, x) * smoothstep(1.2 * r0, -0.1 * r0, x);
  vCompress = clamp(compAmount * dayside * 1.5, 0.0, 1.0);

  vSpeed = uSpeedNorm;
  vAlpha = smoothstep(0.0, 0.05, life) * smoothstep(1.0, 0.90, life);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = min(uSize * uPixelRatio * (0.7 + aSeed.w) * 30.0 / max(-mv.z, 0.5), 5.0 * uPixelRatio);
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
  const smooth = useRef({ speed: 400, density: 5, standoff: 10 });

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
          uStandoffRe: { value: 10 },
          uEarthR: { value: SCENE.earthRadius },
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
    sm.standoff = THREE.MathUtils.damp(sm.standoff, f.standoffRe, 3, dt);

    // ~22 s Sun-to-Earth transit at 400 km/s, ~9 s at 1000 km/s (visual time, not physical).
    phase.current = (phase.current + Math.min(dt, 0.1) * 0.045 * (sm.speed / 400)) % 1000;
    const u = material.uniforms;
    u.uPhase.value = phase.current;
    u.uSpeedNorm.value = THREE.MathUtils.clamp((sm.speed - 300) / 700, 0, 1);
    u.uDensityFrac.value = THREE.MathUtils.clamp(0.12 + sm.density / 25, 0.12, 1);
    u.uBrightness.value = 0.7 + 0.5 * Math.min(1, sm.density / 30);
    u.uStandoffRe.value = sm.standoff;
    u.uPixelRatio.value = dpr;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />;
}
