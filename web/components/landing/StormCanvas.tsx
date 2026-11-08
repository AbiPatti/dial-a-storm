"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, type MutableRefObject } from "react";
import * as THREE from "three";

/** WebGL half of the landing page: a full-screen solar-storm shader (loaded client-side only). */

export interface Progress {
  target: number;
  current: number;
  dive: number;
  /** 0..1: the storm burns down to black before the scene emerges. */
  fade: number;
  /** Cursor in shader space: centred, divided by the shorter screen side, y up. */
  mouse: { x: number; y: number };
}

const vertex = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragment = /* glsl */ `
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uDive;
uniform float uFade;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = rot * p * 2.06 + vec2(1.8, 9.1);
    a *= 0.48;
  }
  return v;
}

void main() {
  vec2 screen = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  // Dive: zoom into the storm core as the user scrolls.
  float zoom = mix(1.0, 0.36, uDive);
  vec2 st = screen * zoom;
  vec2 mouse = uMouse * (1.0 - uDive);

  // Magnetic turbulence swirling around the cursor.
  float mouseInfluence = exp(-length(st - mouse) * 3.0);
  float swirl = mouseInfluence * 1.6 * sin(uTime * 0.95);
  mat2 rotMouse = mat2(cos(swirl), -sin(swirl), sin(swirl), cos(swirl));
  vec2 w = rotMouse * (st - mouse * 0.22);

  float t = uTime * 0.24 + uDive * 1.5;
  vec2 q = vec2(fbm(w * 2.2 + vec2(t * 0.35, t * 0.18)), fbm(w * 2.2 + vec2(-t * 0.25, t * 0.3)));
  vec2 r = vec2(fbm(w * 3.4 + 4.2 * q + vec2(1.7, 9.2) + t * 0.4), fbm(w * 3.4 + 4.2 * q + vec2(8.3, 2.8) - t * 0.28));
  float plasma = fbm(w * 2.2 + 3.8 * r + t * 0.25);

  float d = length(w * vec2(1.08, 0.96));
  float corona = smoothstep(1.15, 0.08, d);
  float inner = smoothstep(0.48, 0.02, d);
  float singularity = smoothstep(0.18, 0.0, d);

  vec3 ember = vec3(0.55, 0.06, 0.01);
  vec3 orange = vec3(1.0, 0.36, 0.015);
  vec3 gold = vec3(1.0, 0.78, 0.10);
  vec3 white = vec3(1.0, 0.98, 0.92);
  vec3 color = vec3(0.0, 0.0, 0.002);

  // Background stars (drift slightly with the cursor and stream past during the dive).
  vec2 sc = (screen * mix(1.0, 0.45, uDive) + uMouse * 0.05) * 110.0;
  float s1 = hash(floor(sc));
  if (s1 > 0.981) {
    float tw = 0.45 + 0.55 * sin(uTime * 2.8 + s1 * 70.0);
    vec3 tint = mix(vec3(0.9, 0.96, 1.0), vec3(1.0, 0.88, 0.65), hash11(s1 * 13.0));
    color += tint * smoothstep(0.24, 0.01, length(fract(sc) - 0.5)) * tw * 1.35;
  }
  vec2 sc2 = (screen + uMouse * 0.02) * 240.0;
  float s2 = hash(floor(sc2));
  if (s2 > 0.988) {
    color += vec3(0.85, 0.92, 1.0) * smoothstep(0.18, 0.01, length(fract(sc2) - 0.5)) * (0.35 + 0.65 * sin(uTime * 3.6 + s2 * 50.0)) * 0.8;
  }

  color = mix(color, ember, clamp(plasma * 2.0 * corona, 0.0, 1.0));
  color = mix(color, orange, clamp(pow(r.x, 1.5) * 2.1 * corona, 0.0, 1.0));
  color = mix(color, gold, clamp(pow(q.y, 1.9) * 1.8 * corona + inner * 0.8, 0.0, 1.0));
  float hot = clamp(pow(plasma * r.y * 2.0, 2.2) * inner * 2.6, 0.0, 1.0);
  color += gold * hot * 1.1;
  color += white * (singularity * 1.35 + hot * 0.6);

  // Floating coronal embers.
  vec2 pc = (w + mouse * 0.12) * 250.0;
  float ph = hash(floor(pc));
  if (ph > 0.925) {
    float phase = fract(ph * 63.0 + uTime * (0.28 + ph * 0.35));
    float e = smoothstep(0.42, 0.04, length(fract(pc) - 0.5)) * sin(phase * 3.14159);
    color += mix(orange, gold, hash11(ph * 19.0)) * e * (0.6 + 1.4 * corona);
  }

  // Vignette in screen space, opening up as we dive in.
  float vignette = smoothstep(mix(1.4, 2.2, uDive), 0.38 * (1.0 - uDive), length(screen * vec2(1.0, 0.92)));
  color *= vignette * (1.0 + 0.35 * uDive);
  // Burn down to black, cooling through ember red; hot regions linger slightly longer than the haze.
  color = mix(color, color * vec3(1.0, 0.42, 0.16), smoothstep(0.0, 0.6, uFade));
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color *= 1.0 - smoothstep(0.0, 1.0, uFade * (1.25 - 0.25 * clamp(lum, 0.0, 1.0)));
  gl_FragColor = vec4(color, 1.0);
}
`;

function StormField({ progress }: { progress: MutableRefObject<Progress> }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uMouse: { value: new THREE.Vector2() },
          uDive: { value: 0 },
          uFade: { value: 0 },
        },
        vertexShader: vertex,
        fragmentShader: fragment,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  const mouse = useMemo(() => new THREE.Vector2(), []);

  useFrame((state, dt) => {
    const u = material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    state.gl.getDrawingBufferSize(u.uResolution.value);
    mouse.set(progress.current.mouse.x, progress.current.mouse.y);
    (u.uMouse.value as THREE.Vector2).lerp(mouse, 1 - Math.exp(-3 * dt));
    u.uDive.value = progress.current.dive;
    u.uFade.value = progress.current.fade;
  });

  return (
    <mesh material={material} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

export default function StormCanvas({ progress }: { progress: MutableRefObject<Progress> }) {
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={1}
      flat
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance", stencil: false, depth: false }}
      aria-hidden="true"
    >
      <StormField progress={progress} />
    </Canvas>
  );
}
