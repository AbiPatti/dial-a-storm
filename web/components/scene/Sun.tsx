"use client";

import { useFrame } from "@react-three/fiber";
import { pickHandlers } from "./pick";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { NOISE_GLSL, SCENE } from "@/lib/glsl";
import { eruptionAt } from "@/lib/flare";
import { liveFrame } from "@/lib/live";
import { useDialStore } from "@/lib/store";

/** Map solar-wind speed (km/s) to a 0..1 activity level: 300 km/s -> 0, 1000 km/s -> 1. */
export function activityFromSpeed(speed: number): number {
  return THREE.MathUtils.clamp((speed - 300) / 700, 0, 1);
}

const surfaceVertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  vObj = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const surfaceFragment = /* glsl */ `
uniform float uTime;
uniform float uClock;     // drift clock, integrated on the CPU so a change of rate never jumps the pattern
uniform float uActivity;
uniform vec4 uFlare;      // flash, rise, linger, strength
uniform vec3 uSite;       // unit vector from the Sun's centre to the eruption site
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewDir;
${NOISE_GLSL}
void main() {
  vec3 p = normalize(vObj);
  float t = uClock;
  // Domain-warped turbulence: a slow warp field displaces a finer fbm.
  float warp = fbm3(p * 2.2 + vec3(0.0, t, t * 0.7));
  float n = fbm(p * 3.6 + warp * 1.5 + vec3(t * 1.3, -t, 0.0));
  float gran = snoise(p * 30.0 + vec3(0.0, uTime * 0.25, 0.0));
  float spots = smoothstep(0.38, 0.55, fbm3(p * 1.7 + vec3(13.0, t * 0.15, 0.0)));

  vec3 deep = vec3(0.80, 0.16, 0.02);
  vec3 mid = vec3(1.00, 0.50, 0.09);
  vec3 hot = vec3(1.00, 0.92, 0.62);
  float h = clamp(n * 0.9 + 0.5, 0.0, 1.0);
  vec3 col = mix(deep, mid, smoothstep(0.15, 0.6, h));
  col = mix(col, hot, smoothstep(0.58, 0.95, h));
  col *= 0.88 + 0.18 * gran;
  col *= 1.0 - 0.5 * spots;

  // Flaring regions brighten with solar-wind activity.
  float flare = smoothstep(0.62, 0.92, n * 0.5 + 0.5) * uActivity;
  col += hot * flare * 0.8;

  // Eruption: a white-hot kernel at the launch site, and a wider active region that stays lit
  // while the loops rise.
  float cs = clamp(dot(p, uSite), 0.0, 1.0);
  float kernel = exp(-(1.0 - cs) * 70.0);
  float region = exp(-(1.0 - cs) * 10.0) * (0.65 + 0.5 * gran);
  col += hot * kernel * uFlare.x * 3.0 * uFlare.w;
  col += mix(vec3(1.0, 0.42, 0.08), hot, 0.35) * region * uFlare.y * uFlare.z * 0.7 * uFlare.w;

  // Limb darkening (Eddington-like, mu^0.5).
  float mu = clamp(dot(normalize(vNormalV), normalize(vViewDir)), 0.0, 1.0);
  col *= 0.42 + 0.58 * pow(mu, 0.5);

  gl_FragColor = vec4(col * (1.2 + 0.45 * uActivity), 1.0);
}
`;

const coronaVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const coronaFragment = /* glsl */ `
uniform float uTime;
uniform float uFlow;      // outward-streaming clock, integrated on the CPU
uniform float uActivity;
uniform float uInner;
uniform vec4 uFlare;      // flash, rise, linger, strength
varying vec2 vUv;
${NOISE_GLSL}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float rr = clamp((r - uInner) / (1.0 - uInner), 0.0, 1.0);

  // Streamers: angular noise advected outward faster when the wind is fast.
  float flow = uFlow;
  float streams = fbm3(vec3(cos(a) * 1.8, sin(a) * 1.8, uTime * 0.04 - rr * 1.3));
  // Angular noise is sampled on the unit circle (cos a, sin a) so there is no seam at a = +/-pi.
  vec2 ring = vec2(cos(a), sin(a));
  float rays = 0.55 + 0.45 * streams + 0.25 * snoise(vec3(ring * 4.0, rr * 2.5 - flow));

  // Radial fall-off: the corona reaches further as activity rises.
  float reach = mix(5.5, 4.4, uActivity);
  float glow = pow(1.0 - rr, reach) * rays * (0.5 + 0.5 * uActivity);
  glow += 0.6 * exp(-rr * 14.0) * (1.0 + 0.35 * uActivity);
  // The whole corona swells briefly with an eruption, then settles.
  glow *= 1.0 + uFlare.w * (0.9 * uFlare.x + 0.25 * uFlare.y * uFlare.z);

  vec3 col = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.86, 0.58), exp(-rr * 5.0));
  float edge = smoothstep(1.0, 0.8, r);
  gl_FragColor = vec4(col * glow * edge, 1.0);
}
`;

export default function Sun() {
  const coronaRef = useRef<THREE.Mesh>(null);
  const activity = useRef(0.3);
  // Pattern clocks accumulate dt * rate. The old shaders multiplied the whole elapsed time by a rate
  // that followed the wind speed, so every change of speed shifted the pattern by (change x time):
  // the lava lurched and the corona breathed in and out at each storm shock.
  const clocks = useRef({ surface: 0, flow: 0 });
  const coronaScale = 3.4;

  const surface = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uClock: { value: 0 },
          uActivity: { value: 0.3 },
          uFlare: { value: new THREE.Vector4(0, 0, 0, 0) },
          uSite: { value: new THREE.Vector3(1, 0, 0) },
        },
        vertexShader: surfaceVertex,
        fragmentShader: surfaceFragment,
      }),
    [],
  );

  const corona = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uFlow: { value: 0 },
          uActivity: { value: 0.3 },
          uInner: { value: 1 / coronaScale },
          uFlare: { value: new THREE.Vector4(0, 0, 0, 0) },
        },
        vertexShader: coronaVertex,
        fragmentShader: coronaFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(
    () => () => {
      surface.dispose();
      corona.dispose();
    },
    [surface, corona],
  );

  useFrame((state, dt) => {
    const s = useDialStore.getState();
    const frame = liveFrame(s.bundle, s.activeTrace, s.params, s.cursor);
    const target = activityFromSpeed(frame.speed);
    // Slow response: the wind speed can step by 250 km/s within a second of replay at a shock.
    activity.current = THREE.MathUtils.damp(activity.current, target, 0.9, dt);
    const c = clocks.current;
    const step = Math.min(dt, 0.1);
    c.surface += step * (0.05 + 0.04 * activity.current);
    c.flow += step * (0.12 + 0.2 * activity.current);
    const t = state.clock.elapsedTime;
    const eruption = eruptionAt(s.bundle, s.cursor, s.tracePeak?.value ?? null);
    const flare = eruption ? [eruption.flash, eruption.rise, eruption.linger, eruption.strength] : [0, 0, 0, 0];
    (surface.uniforms.uFlare.value as THREE.Vector4).set(flare[0], flare[1], flare[2], flare[3]);
    (corona.uniforms.uFlare.value as THREE.Vector4).set(flare[0], flare[1], flare[2], flare[3]);
    surface.uniforms.uTime.value = t;
    surface.uniforms.uClock.value = c.surface;
    surface.uniforms.uActivity.value = activity.current;
    corona.uniforms.uTime.value = t;
    corona.uniforms.uFlow.value = c.flow;
    corona.uniforms.uActivity.value = activity.current;
    if (coronaRef.current) coronaRef.current.quaternion.copy(state.camera.quaternion);
  });

  const r = SCENE.sunRadius;
  return (
    <group position={SCENE.sunPosition}>
      <mesh userData={{ blocksShell: true }} {...pickHandlers("sun")}>
        <sphereGeometry args={[r, 96, 64]} />
        <primitive object={surface} attach="material" />
      </mesh>
      <mesh ref={coronaRef} renderOrder={2}>
        <planeGeometry args={[r * 2 * coronaScale, r * 2 * coronaScale]} />
        <primitive object={corona} attach="material" />
      </mesh>
    </group>
  );
}
