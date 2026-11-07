"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MAGNETOPAUSE_GLSL, SCENE, standoffToScene } from "@/lib/glsl";
import { liveFrame } from "@/lib/live";
import { useDialStore } from "@/lib/store";

/**
 * Earth's dipole field lines, mounted in Earth's tilted frame so their feet land in the auroral
 * ovals. Lines are generated once (r = L cos^2(lat), in R_E) and deformed in world space by the
 * vertex shader: squashed inside the magnetopause on the dayside and dragged into a tail on the
 * nightside as the storm builds. Pulses run along every line; they speed up and turn magenta when
 * southward field is coupling energy in. One LineSegments draw call.
 */

const vertex = /* glsl */ `
attribute float aT;
attribute float aSeed;
uniform float uStandoffRe;
uniform float uEarthR;
uniform float uStretch;
varying float vT;
varying float vSeed;
varying float vDepth;
${MAGNETOPAUSE_GLSL}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 p = wp.xyz;
  float d = max(length(p), 1e-4);
  float cosT = -p.x / d;
  // Dayside: soft-clamp the line inside the shield.
  // Same boundary as the Magnetopause shell and the particle deflection (lib/glsl.ts).
  float limit = magnetopauseRadius(uStandoffRe, cosT, uEarthR) * 0.94;
  float squashed = limit * tanh(d / limit);
  float day = smoothstep(-0.3, 0.35, cosT);
  p = (p / d) * mix(d, squashed, day);
  // Nightside: drag outer lines downstream into a tail.
  float night = smoothstep(0.1, -0.6, cosT);
  float outer = smoothstep(${(SCENE.earthRadius * 1.8).toFixed(2)}, ${(SCENE.earthRadius * 3.6).toFixed(2)}, d);
  p.x += night * outer * uStretch * (d - ${(SCENE.earthRadius * 1.2).toFixed(2)});
  p.yz *= 1.0 - 0.35 * night * outer * min(uStretch, 1.0);
  vT = aT;
  vSeed = aSeed;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const fragment = /* glsl */ `
uniform float uTime;
uniform float uSouth;
uniform float uEnergy;
varying float vT;
varying float vSeed;
varying float vDepth;
void main() {
  float phase = fract(vT * 1.5 - uTime * (0.12 + 0.35 * uEnergy) + vSeed);
  float pulse = pow(1.0 - phase, 14.0);
  float ends = smoothstep(0.0, 0.06, vT) * smoothstep(1.0, 0.94, vT);
  vec3 calm = vec3(0.5, 1.0, 0.78);
  vec3 storm = vec3(1.0, 0.28, 0.36);
  vec3 col = mix(calm, storm, uSouth);
  float base = 0.13 + 0.1 * uEnergy;
  float a = ends * (base + pulse * (0.9 + 1.8 * uEnergy));
  a *= smoothstep(40.0, 12.0, vDepth);
  gl_FragColor = vec4(col * a, 1.0);
}
`;

/** L-shells in R_E and the number of meridians. */
const L_SHELLS = [2.2, 3.2, 4.6, 6.5, 9.0];
const MERIDIANS = 10;
const SAMPLES = 72;

/** Same radial compression the rest of the scene uses (R_E -> scene units). */
const toScene = (rRe: number) => standoffToScene(rRe);

function buildGeometry() {
  const positions: number[] = [];
  const ts: number[] = [];
  const seeds: number[] = [];
  let seed = 0.37;
  for (let m = 0; m < MERIDIANS; m++) {
    const phi = (m / MERIDIANS) * Math.PI * 2 + 0.15;
    for (const L of L_SHELLS) {
      seed = (seed * 9301 + 0.4927) % 1;
      const lat0 = Math.acos(Math.sqrt(1 / L));
      let prev: [number, number, number] | null = null;
      let prevT = 0;
      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES;
        const lat = -lat0 + 2 * lat0 * t;
        const rRe = Math.max(1, L * Math.cos(lat) ** 2);
        const r = toScene(rRe);
        const p: [number, number, number] = [r * Math.cos(lat) * Math.cos(phi), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(phi)];
        if (prev) {
          positions.push(...prev, ...p);
          ts.push(prevT, t);
          seeds.push(seed, seed);
        }
        prev = p;
        prevT = t;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("aT", new THREE.Float32BufferAttribute(ts, 1));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
  return g;
}

export default function FieldLines() {
  const smooth = useRef({ standoff: 10, stretch: 0.3, south: 0, energy: 0 });
  const geometry = useMemo(buildGeometry, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uStandoffRe: { value: 10 },
          uEarthR: { value: SCENE.earthRadius },
          uStretch: { value: 0.3 },
          uTime: { value: 0 },
          uSouth: { value: 0 },
          uEnergy: { value: 0 },
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
    sm.standoff = THREE.MathUtils.damp(sm.standoff, f.standoffRe, 3, dt);
    sm.stretch = THREE.MathUtils.damp(sm.stretch, 0.3 + 1.4 * f.severity, 2, dt);
    sm.south = THREE.MathUtils.damp(sm.south, THREE.MathUtils.clamp(-f.bz / 15, 0, 1), 4, dt);
    sm.energy = THREE.MathUtils.damp(sm.energy, THREE.MathUtils.clamp((f.coupling - 0.5) / 15, 0, 1), 3, dt);
    const u = material.uniforms;
    u.uStandoffRe.value = sm.standoff;
    u.uStretch.value = sm.stretch;
    u.uSouth.value = sm.south;
    u.uEnergy.value = sm.energy;
    u.uTime.value = state.clock.elapsedTime;
  });

  return <lineSegments geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}
