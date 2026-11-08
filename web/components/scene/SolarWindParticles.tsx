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
 *   smoothly instead of teleporting particles. Per-particle speed factors are quantised to
 *   (34 + 1.5 j) / 40, j = 0..7, so `PHASE_WRAP * factor` is always an integer and wrapping the
 *   phase never makes particles jump.
 * - Density controls the visible fraction of particles and their brightness.
 * - Streamlines bend around the magnetopause (Shue et al. 1998 stand-off, the same shape as the
 *   Magnetopause shell): undeflected upstream of the bow shock, pushed out through the sheath, and
 *   kept outside the flank downstream. rho = sqrt(rObs^2 + rIn^2) conserves annular area, so
 *   streamlines never cross and never pinch back to the Sun–Earth line behind Earth.
 * - Each point is drawn as a streak along its screen-space direction of travel; faster wind gives
 *   longer streaks.
 * - Southward IMF (Bz < 0) opens the dayside magnetopause by magnetic reconnection. A fraction of
 *   the particles that reach the nose, proportional to the coupling v·Bs, is captured and slides
 *   along the boundary into the polar cusps, glowing magenta: the energy that feeds the storm.
 */

const PHASE_WRAP = 80;

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
uniform float uCapture;
uniform vec3 uCuspN;
uniform vec3 uCuspS;
uniform vec2 uViewport;
varying float vAlpha;
varying float vSpeed;
varying float vCompress;
varying float vCaptured;
varying vec2 vDir;
varying float vStretch;
${MAGNETOPAUSE_GLSL}

// Effective obstacle radius at x: zero upstream of the shock, rising through the sheath, then
// held at the flank and flaring gently downstream.
float obstacle(float x) {
  float r0 = magnetopauseRadius(uStandoffRe, 1.0, uEarthR);
  float rFlank = magnetopauseRadius(uStandoffRe, 0.0, uEarthR);
  float xShock = -1.4 * r0;
  if (x < xShock) return 0.0;
  if (x < 0.0) {
    float u = (x - xShock) / (-xShock);
    float s = u * u * (3.0 - 2.0 * u);
    return 1.04 * rFlank * pow(s, 0.65);
  }
  float t = x / max(r0, 0.1);
  return 1.04 * rFlank * (1.0 + 0.24 * pow(min(t, 1.2), 0.65) + 0.04 * max(0.0, t - 1.2));
}

// Position along a streamline; jitter softens the sheath edge per particle.
vec3 flowPos(float life, float r, float ang, float jitter) {
  float x = mix(uStartX, uEndX, life);
  float spread = mix(0.22, 1.0, smoothstep(0.0, 0.55, life)) + 0.12 * smoothstep(0.55, 1.0, life);
  float rIn = r * spread;
  float rObs = obstacle(x) * (0.97 + 0.06 * jitter);
  float rho = sqrt(rObs * rObs + rIn * rIn);
  return vec3(x, rho * sin(ang), rho * cos(ang));
}

// Shock heating / compression glow in the dayside sheath.
float compression(vec3 p, float rIn) {
  float r0 = magnetopauseRadius(uStandoffRe, 1.0, uEarthR);
  float rFlank = magnetopauseRadius(uStandoffRe, 0.0, uEarthR);
  float xShock = -1.4 * r0;
  float rho = length(p.yz);
  float dayside = smoothstep(xShock, xShock * 0.7, p.x) * smoothstep(1.2 * r0, -0.1 * r0, p.x);
  return clamp((rho - rIn) / max(rFlank, 1.0) * dayside * 1.5, 0.0, 1.0);
}

vec3 bezier(vec3 a, vec3 b, vec3 c, float t) {
  float u = 1.0 - t;
  return u * u * a + 2.0 * u * t * b + t * t * c;
}

void main() {
  vCaptured = 0.0;
  vDir = vec2(1.0, 0.0);
  vStretch = 1.0;
  if (aKeep > uDensityFrac) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    vSpeed = 0.0;
    vCompress = 0.0;
    return;
  }
  float factor = (34.0 + 1.5 * floor(aSeed.w * 7.999)) / 40.0;
  float life = fract(aSeed.x + uPhase * factor);
  float r = 6.5 * sqrt(aSeed.y);
  float ang = aSeed.z * 6.28318530718;

  vec3 p = flowPos(life, r, ang, aSeed.w);
  vec3 pAhead = flowPos(min(life + 0.004, 1.0), r, ang, aSeed.w);

  float spreadNow = mix(0.22, 1.0, smoothstep(0.0, 0.55, life)) + 0.12 * smoothstep(0.55, 1.0, life);
  vCompress = compression(p, r * spreadNow);
  vSpeed = uSpeedNorm;
  vAlpha = smoothstep(0.0, 0.05, life) * smoothstep(1.0, 0.90, life);

  // Reconnection capture: near-axis particles, a coupling-controlled fraction of them.
  float rNose = magnetopauseRadius(uStandoffRe, 1.0, uEarthR);
  float lifeNose = clamp((-rNose * 1.08 - uStartX) / (uEndX - uStartX), 0.0, 1.0);
  // Only particles aimed at the dayside nose (impact parameter well inside the boundary).
  float nearAxis = step(r * 0.94, rNose * 0.8);
  float picked = step(fract(aSeed.y * 13.7 + aSeed.z * 5.3), uCapture) * nearAxis;
  if (picked > 0.5 && life > lifeNose) {
    float t = clamp((life - lifeNose) / 0.07, 0.0, 1.0);
    vec3 p0 = flowPos(lifeNose, r, ang, aSeed.w);
    vec3 cusp = sin(ang) >= 0.0 ? uCuspN : uCuspS;
    vec3 ctrl = vec3(-rNose * 0.55, cusp.y * 2.4, p0.z * 0.4);
    p = bezier(p0, ctrl, cusp, t);
    pAhead = bezier(p0, ctrl, cusp, min(t + 0.04, 1.0));
    vCaptured = 1.0;
    vCompress = 0.0;
    // Fade in on capture, flare as the particle hits the cusp, then vanish until the next cycle.
    vAlpha *= smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.93, 1.0, t)) * (0.7 + 0.8 * t * t);
    if (t >= 1.0) vAlpha = 0.0;
  }

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;
  vec4 clipAhead = projectionMatrix * modelViewMatrix * vec4(pAhead, 1.0);
  vec2 screen = clip.xy / clip.w * 0.5 * uViewport;
  vec2 screenAhead = clipAhead.xy / clipAhead.w * 0.5 * uViewport;
  vec2 dv = screenAhead - screen;
  float len = length(dv);
  vDir = len > 1e-3 ? dv / len : vec2(1.0, 0.0);

  float base = min(uSize * uPixelRatio * (0.7 + aSeed.w) * 30.0 / max(-mv.z, 0.5), 5.0 * uPixelRatio);
  float streak = clamp(len * (2.5 + 5.0 * uSpeedNorm), base, 16.0 * uPixelRatio);
  vStretch = streak / max(base, 1e-3);
  gl_PointSize = streak;
  gl_Position = clip;
}
`;

const fragment = /* glsl */ `
uniform float uBrightness;
varying float vAlpha;
varying float vSpeed;
varying float vCompress;
varying float vCaptured;
varying vec2 vDir;
varying float vStretch;
void main() {
  if (vAlpha <= 0.0) discard;
  // Rotate the sprite into the direction of travel (gl_PointCoord has y pointing down).
  vec2 c = gl_PointCoord - 0.5;
  c.y = -c.y;
  vec2 q = vec2(dot(c, vDir), dot(c, vec2(-vDir.y, vDir.x)));
  // Capsule: full length along the streak, 1/stretch of the width across it.
  q.y *= vStretch;
  float r2 = dot(q, q);
  if (r2 > 0.25) discard;
  float soft = exp(-r2 * 14.0);
  // Brighter head, fading tail.
  float head = 0.55 + 0.45 * smoothstep(-0.5, 0.5, q.x);

  vec3 slow = vec3(1.0, 0.55, 0.18);
  vec3 fast = vec3(1.0, 0.85, 0.55);
  vec3 col = mix(slow, fast, vSpeed);
  col += vec3(1.0, 0.35, 0.4) * vCompress * 0.7;
  col = mix(col, vec3(1.0, 0.3, 0.8) * 1.6, vCaptured);
  float a = soft * head * vAlpha * uBrightness * (0.55 + 1.2 * vCompress + 0.8 * vCaptured);
  gl_FragColor = vec4(col * a, 1.0);
}
`;

interface SolarWindParticlesProps {
  count?: number;
}

/** Dayside polar cusp (~78° magnetic latitude) just above the surface, in world space. */
function cuspPoint(hemisphere: 1 | -1): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(78);
  const local = new THREE.Vector3(-Math.cos(lat), hemisphere * Math.sin(lat), 0).multiplyScalar(SCENE.earthRadius * 1.04);
  return local.applyAxisAngle(new THREE.Vector3(0, 0, 1), SCENE.tilt);
}

export default function SolarWindParticles({ count = 20_000 }: SolarWindParticlesProps) {
  const dpr = useThree((s) => s.viewport.dpr);
  const size = useThree((s) => s.size);
  const phase = useRef(0);
  const smooth = useRef({ speed: 400, density: 5, standoff: 10, capture: 0 });

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
          uSize: { value: 1.15 },
          uPixelRatio: { value: 1 },
          uSpeedNorm: { value: 0.2 },
          uBrightness: { value: 1 },
          uCapture: { value: 0 },
          uCuspN: { value: cuspPoint(1) },
          uCuspS: { value: cuspPoint(-1) },
          uViewport: { value: new THREE.Vector2(1, 1) },
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
    // Captured fraction grows with the coupling v·Bs (0 for northward IMF, ~45% by 20 mV/m).
    sm.capture = THREE.MathUtils.damp(sm.capture, THREE.MathUtils.clamp(f.coupling / 20, 0, 1) * 0.45, 3, dt);

    // Sun-to-Earth in ~13 s at 400 km/s, ~5 s at 1000 km/s (visual time, not physical).
    phase.current = (phase.current + Math.min(dt, 0.1) * 0.045 * (sm.speed / 400)) % PHASE_WRAP;
    const u = material.uniforms;
    u.uPhase.value = phase.current;
    u.uSpeedNorm.value = THREE.MathUtils.clamp((sm.speed - 300) / 700, 0, 1);
    u.uDensityFrac.value = THREE.MathUtils.clamp(0.2 + sm.density / 22, 0.2, 1);
    u.uBrightness.value = 1.0 + 0.6 * Math.min(1, sm.density / 30);
    u.uStandoffRe.value = sm.standoff;
    u.uCapture.value = sm.capture;
    u.uPixelRatio.value = dpr;
    (u.uViewport.value as THREE.Vector2).set(size.width * dpr, size.height * dpr);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />;
}
