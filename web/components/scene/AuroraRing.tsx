"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { NOISE_GLSL, SCENE } from "@/lib/glsl";
import { liveFrame } from "@/lib/live";
import { useDialStore } from "@/lib/store";

/**
 * Auroral ovals in both hemispheres, mounted in Earth's tilted (non-spinning) frame.
 *
 * The geometry is a unit strip: uv.x in [0,1] runs around magnetic local time, uv.y in [0,1]
 * runs from the equatorward edge to the poleward edge. The vertex shader places it on the sphere
 * from uniforms, so the oval expands every frame without rebuilding geometry:
 *   lat_eq(phi) = uLat + 7 deg * dayside(phi)      (oval sits poleward on the dayside)
 *   lat(phi, s) = lat_eq(phi) + s * width(phi)
 * uLat follows Lat ~ 65 deg - 0.05 |SYM-H|, clamped at 38 deg (lib/severity.ts).
 */

const vertex = /* glsl */ `
uniform float uLat;
uniform float uWidth;
uniform float uHemisphere;
uniform float uRadius;
uniform vec3 uSunDirLocal;
uniform float uTime;
varying float vS;
varying float vPhi;
varying float vDay;
void main() {
  float phi = uv.x * 6.28318530718;
  float s = uv.y;
  vec2 dirEq = vec2(cos(phi), sin(phi));
  vec2 sunXZ = normalize(uSunDirLocal.xz + vec2(1e-5, 0.0));
  float dayside = 0.5 + 0.5 * dot(dirEq, sunXZ);
  float latEq = uLat + radians(7.0) * dayside;
  float width = uWidth * (1.0 - 0.45 * dayside);
  float wobble = 0.012 * sin(phi * 5.0 + uTime * 0.4) + 0.008 * sin(phi * 11.0 - uTime * 0.7);
  float lat = min(latEq + s * width + wobble, radians(88.0));
  float alt = 1.012 + 0.06 * s;
  vec3 pos = vec3(cos(lat) * cos(phi), uHemisphere * sin(lat), cos(lat) * sin(phi)) * uRadius * alt;
  vS = s;
  vPhi = phi;
  vDay = dayside;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const fragment = /* glsl */ `
uniform float uIntensity;
uniform float uSeverity;
uniform float uTime;
varying float vS;
varying float vPhi;
varying float vDay;
${NOISE_GLSL}
void main() {
  float edge = smoothstep(0.0, 0.16, vS) * smoothstep(1.0, 0.5, vS);
  // Sample noise on the unit circle so the oval has no seam at phi = 0 / 2 pi.
  vec2 ring = vec2(cos(vPhi), sin(vPhi));
  float rays = 0.55 + 0.45 * snoise(vec3(ring * 9.0, vS * 1.5 + uTime * 0.35));
  float folds = 0.6 + 0.4 * sin(vPhi * 36.0 + 3.0 * snoise(vec3(ring * 2.0, uTime * 0.2)));
  float night = 1.0 - 0.65 * vDay;
  vec3 green = vec3(0.25, 1.0, 0.55);
  vec3 red = vec3(1.0, 0.22, 0.42);
  vec3 col = mix(green, red, smoothstep(0.4, 1.0, vS) * (0.35 + 0.65 * uSeverity));
  col = mix(col, vec3(1.0, 0.3, 0.65), uSeverity * 0.25 * (1.0 - vS));
  float a = edge * rays * folds * night * uIntensity;
  gl_FragColor = vec4(col * a * 1.5, 1.0);
}
`;

function makeMaterial(hemisphere: 1 | -1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLat: { value: THREE.MathUtils.degToRad(65) },
      uWidth: { value: THREE.MathUtils.degToRad(4) },
      uHemisphere: { value: hemisphere },
      uRadius: { value: SCENE.earthRadius },
      uSunDirLocal: { value: new THREE.Vector3(-1, 0, 0) },
      uTime: { value: 0 },
      uIntensity: { value: 0.2 },
      uSeverity: { value: 0 },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

export default function AuroraRing() {
  const groupRef = useRef<THREE.Group>(null);
  const lat = useRef(65);
  const depth = useRef(0);
  const scratch = useMemo(
    () => ({ q: new THREE.Quaternion(), earth: new THREE.Vector3(), sun: new THREE.Vector3(...SCENE.sunPosition) }),
    [],
  );

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1, 320, 10), []);
  const north = useMemo(() => makeMaterial(1), []);
  const south = useMemo(() => makeMaterial(-1), []);

  useEffect(
    () => () => {
      geometry.dispose();
      north.dispose();
      south.dispose();
    },
    [geometry, north, south],
  );

  useFrame((state, dt) => {
    const s = useDialStore.getState();
    const frame = liveFrame(s.bundle, s.activeTrace, s.params, s.cursor);
    lat.current = THREE.MathUtils.damp(lat.current, frame.auroraLat, 3, dt);
    depth.current = THREE.MathUtils.damp(depth.current, Math.max(0, -frame.symH), 3, dt);
    const severity = Math.min(1, depth.current / 500);
    const widthDeg = 4 + 0.025 * depth.current;
    const intensity = 0.2 + 0.9 * Math.min(1, depth.current / 350);

    const g = groupRef.current;
    let sunLocal: THREE.Vector3 | null = null;
    if (g) {
      g.getWorldPosition(scratch.earth);
      g.getWorldQuaternion(scratch.q).invert();
      sunLocal = scratch.sun.clone().sub(scratch.earth).normalize().applyQuaternion(scratch.q);
    }
    for (const m of [north, south]) {
      m.uniforms.uLat.value = THREE.MathUtils.degToRad(lat.current);
      m.uniforms.uWidth.value = THREE.MathUtils.degToRad(widthDeg);
      m.uniforms.uIntensity.value = intensity;
      m.uniforms.uSeverity.value = severity;
      m.uniforms.uTime.value = state.clock.elapsedTime;
      if (sunLocal) m.uniforms.uSunDirLocal.value.copy(sunLocal);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} material={north} frustumCulled={false} renderOrder={4} />
      <mesh geometry={geometry} material={south} frustumCulled={false} renderOrder={4} />
    </group>
  );
}
