"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SCENE, standoffToScene } from "@/lib/glsl";
import { liveFrame } from "@/lib/live";
import { useDialStore } from "@/lib/store";

/**
 * Earth's magnetic shield, in world space (Sun along -x):
 *
 * - Magnetopause shell: a unit sphere displaced in the vertex shader to the same
 *   r(theta) = r0 (2 / (1 + cos theta))^0.6 surface the solar-wind particles slide around, so the
 *   wind and the shell always agree. r0 follows the Shue et al. (1998) stand-off.
 * - Reconnection flash: a glow at the nose whose strength follows southward Bz x speed. Northward
 *   field gives no flash, which is the one idea the scene most needs to teach.
 *
 * The dipole field lines live in FieldLines (Earth's tilted frame) and read the same uniforms.
 */

/** Shue-style magnetopause radius; shared with the particle and field-line shaders. */
export const MAGNETOPAUSE_GLSL = /* glsl */ `
float magnetopauseR(vec3 p, float standoff) {
  float d = max(length(p), 1e-4);
  float cosT = -p.x / d;
  return standoff * pow(2.0 / (1.0 + max(cosT, -0.6)), 0.6);
}
`;

const shellVertex = /* glsl */ `
uniform float uStandoff;
varying vec3 vNormalW;
varying vec3 vPosW;
varying float vCos;
// Same surface as the particles on the dayside; the tail is capped so the camera stays outside.
float magnetopauseR(vec3 p, float standoff) {
  float d = max(length(p), 1e-4);
  float cosT = -p.x / d;
  return standoff * pow(2.0 / (1.0 + max(cosT, -0.25)), 0.6);
}
void main() {
  vec3 dir = normalize(position);
  float r = magnetopauseR(dir, uStandoff);
  vec3 p = dir * r;
  // Normal of the displaced surface from neighbouring samples along two tangents.
  vec3 t1 = normalize(cross(dir, abs(dir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(dir, t1);
  float e = 0.01;
  vec3 a = normalize(dir + t1 * e);
  vec3 b = normalize(dir + t2 * e);
  vec3 pa = a * magnetopauseR(a, uStandoff);
  vec3 pb = b * magnetopauseR(b, uStandoff);
  vec3 n = normalize(cross(pa - p, pb - p));
  if (dot(n, dir) < 0.0) n = -n;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * n);
  vCos = -dir.x;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const shellFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uCompression;
uniform float uTime;
varying vec3 vNormalW;
varying vec3 vPosW;
varying float vCos;
void main() {
  vec3 V = normalize(cameraPosition - vPosW);
  float fres = pow(1.0 - abs(dot(normalize(vNormalW), V)), 7.0);
  // A cap facing the Sun: bright nose, fading to nothing along the flanks.
  float cap = smoothstep(-0.1, 0.75, vCos);
  float nose = smoothstep(0.55, 1.0, vCos);
  float shimmer = 0.8 + 0.2 * sin(vCos * 22.0 - uTime * 1.6);
  float a = fres * cap * (0.5 + 1.2 * uCompression * nose) * shimmer;
  vec3 col = mix(uColor, vec3(1.0, 0.3, 0.38), uCompression * 0.85);
  gl_FragColor = vec4(col * a, 1.0);
}
`;

const flashVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const flashFragment = /* glsl */ `
uniform float uStrength;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c);
  float core = exp(-r * r * 90.0);
  float halo = exp(-r * r * 14.0) * 0.35;
  float flicker = 0.75 + 0.25 * sin(uTime * 9.0) * sin(uTime * 3.7);
  vec3 col = mix(vec3(1.0, 0.25, 0.35), vec3(1.0, 0.9, 0.85), core) * (core * 2.6 + halo) * uStrength * flicker;
  gl_FragColor = vec4(col, 1.0);
}
`;

export default function Magnetosphere() {
  const flashRef = useRef<THREE.Mesh>(null);
  const smooth = useRef({ standoff: standoffToScene(10), compression: 0, flash: 0 });

  const shell = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uStandoff: { value: standoffToScene(10) },
          uColor: { value: new THREE.Color("#7dffc8") },
          uCompression: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: shellVertex,
        fragmentShader: shellFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  const flash = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uStrength: { value: 0 }, uTime: { value: 0 } },
        vertexShader: flashVertex,
        fragmentShader: flashFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(
    () => () => {
      shell.dispose();
      flash.dispose();
    },
    [shell, flash],
  );

  useFrame((state, dt) => {
    const s = useDialStore.getState();
    const f = liveFrame(s.bundle, s.activeTrace, s.params, s.cursor);
    const sm = smooth.current;
    const t = state.clock.elapsedTime;
    sm.standoff = THREE.MathUtils.damp(sm.standoff, standoffToScene(f.standoffRe), 3, dt);
    // 0 at a quiet 10 R_E nose, 1 at 5 R_E.
    sm.compression = THREE.MathUtils.damp(sm.compression, THREE.MathUtils.clamp((10 - f.standoffRe) / 5, 0, 1), 3, dt);
    // Burton-like threshold: no energy gets in below ~0.5 mV/m of v*Bs.
    sm.flash = THREE.MathUtils.damp(sm.flash, THREE.MathUtils.clamp((f.coupling - 0.5) / 12, 0, 1), 4, dt);

    shell.uniforms.uStandoff.value = sm.standoff;
    shell.uniforms.uCompression.value = sm.compression;
    shell.uniforms.uTime.value = t;
    flash.uniforms.uStrength.value = sm.flash;
    flash.uniforms.uTime.value = t;

    const fl = flashRef.current;
    if (fl) {
      fl.position.set(-sm.standoff, 0, 0);
      fl.quaternion.copy(state.camera.quaternion);
      fl.visible = sm.flash > 0.01;
    }
  });

  return (
    <group>
      <mesh renderOrder={2} frustumCulled={false}>
        <sphereGeometry args={[1, 128, 96]} />
        <primitive object={shell} attach="material" />
      </mesh>
      <mesh ref={flashRef} renderOrder={5}>
        <planeGeometry args={[SCENE.earthRadius * 2.4, SCENE.earthRadius * 2.4]} />
        <primitive object={flash} attach="material" />
      </mesh>
    </group>
  );
}
