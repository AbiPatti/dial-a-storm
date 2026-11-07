"use client";

import { useFrame } from "@react-three/fiber";
import { pickHandlers } from "./pick";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { NOISE_GLSL, SCENE } from "@/lib/glsl";
import { liveFrame } from "@/lib/live";
import { severityRgb } from "@/lib/severity";
import { useDialStore } from "@/lib/store";

const SUN_DIR = new THREE.Vector3(...SCENE.sunPosition).normalize();

const worldVertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vObj = position;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const surfaceFragment = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uAtmo;
uniform float uSeverity;
uniform float uTime;
varying vec3 vObj;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
${NOISE_GLSL}
void main() {
  vec3 p = normalize(vObj);
  float continent = fbm(p * 1.9 + vec3(4.1, 0.3, 2.2));
  float land = smoothstep(0.03, 0.08, continent);
  float lat = abs(p.y);
  float ice = smoothstep(0.82, 0.9, lat + 0.04 * snoise(p * 6.0));

  vec3 ocean = mix(vec3(0.008, 0.035, 0.13), vec3(0.03, 0.15, 0.33), smoothstep(-0.35, 0.03, continent));
  float relief = fbm3(p * 7.0);
  float arid = smoothstep(0.0, 0.45, snoise(p * 2.4 + 7.0)) * (1.0 - smoothstep(0.35, 0.7, lat));
  vec3 landCol = mix(vec3(0.09, 0.25, 0.09), vec3(0.47, 0.38, 0.22), arid) * (0.78 + 0.45 * relief);
  vec3 surf = mix(ocean, landCol, land);
  surf = mix(surf, vec3(0.86, 0.9, 0.96), ice);

  float cl = fbm(p * 3.1 + vec3(uTime * 0.012, 0.0, uTime * 0.007));
  float clouds = smoothstep(0.1, 0.48, cl);

  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunDir);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndl = dot(N, L);
  float day = smoothstep(-0.1, 0.2, ndl);

  vec3 albedo = mix(surf, vec3(0.95), clouds * 0.85);
  vec3 col = albedo * (0.025 + 1.15 * max(ndl, 0.0));

  vec3 H = normalize(L + V);
  col += vec3(1.0, 0.95, 0.85) * pow(max(dot(N, H), 0.0), 70.0) * (1.0 - land) * (1.0 - clouds) * day * 0.7;

  float cities = smoothstep(0.62, 0.9, snoise(p * 42.0) * 0.5 + 0.5) * land * (1.0 - ice) * (1.0 - clouds * 0.8);
  col += vec3(1.0, 0.7, 0.32) * cities * (1.0 - day) * 0.85;

  // Inner Fresnel rim: the atmosphere seen edge-on, coloured by storm severity.
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float lit = mix(0.35 + 0.65 * smoothstep(-0.3, 0.5, ndl), 1.0, uSeverity * 0.7);
  col += uAtmo * fres * lit * (0.4 + 0.45 * uSeverity);

  gl_FragColor = vec4(col, 1.0);
}
`;

const atmosphereFragment = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uAtmo;
uniform float uSeverity;
uniform float uTime;
uniform float uEarthRadius;
uniform float uShellRadius;
varying vec3 vObj;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float d = clamp(dot(N, V), 0.0, 1.0);
  // Impact parameter of the view ray relative to Earth's centre.
  float b = sqrt(max(0.0, 1.0 - d * d)) * uShellRadius;
  float h = (b - uEarthRadius) / (uShellRadius - uEarthRadius);
  float glow = h > 0.0 ? pow(1.0 - clamp(h, 0.0, 1.0), 2.4) : pow(b / uEarthRadius, 7.0);

  float sunSide = 0.3 + 0.7 * smoothstep(-0.45, 0.6, dot(N, normalize(uSunDir)));
  sunSide = mix(sunSide, 1.0, uSeverity * 0.6);
  float pulse = 1.0 + 0.18 * uSeverity * sin(uTime * 2.2);
  vec3 col = uAtmo * glow * sunSide * (0.6 + 0.8 * uSeverity) * pulse;
  gl_FragColor = vec4(col, 1.0);
}
`;

interface EarthProps {
  /** Children are mounted in Earth's tilted, non-spinning frame (e.g. the auroral ovals). */
  children?: ReactNode;
}

export default function Earth({ children }: EarthProps) {
  const spinRef = useRef<THREE.Mesh>(null);
  const severity = useRef(0);
  const atmo = useRef(new THREE.Color(...severityRgb(0)));
  const target = useMemo(() => new THREE.Color(), []);
  const shellRadius = SCENE.earthRadius * 1.14;

  const uniforms = useMemo(
    () => ({
      uSunDir: { value: SUN_DIR.clone() },
      uAtmo: { value: new THREE.Color(...severityRgb(0)) },
      uSeverity: { value: 0 },
      uTime: { value: 0 },
    }),
    [],
  );

  const surface = useMemo(
    () => new THREE.ShaderMaterial({ uniforms, vertexShader: worldVertex, fragmentShader: surfaceFragment }),
    [uniforms],
  );

  const atmosphere = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...uniforms,
          uEarthRadius: { value: SCENE.earthRadius },
          uShellRadius: { value: shellRadius },
        },
        vertexShader: worldVertex,
        fragmentShader: atmosphereFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms, shellRadius],
  );

  useEffect(
    () => () => {
      surface.dispose();
      atmosphere.dispose();
    },
    [surface, atmosphere],
  );

  useFrame((state, dt) => {
    const s = useDialStore.getState();
    const frame = liveFrame(s.bundle, s.activeTrace, s.params, s.cursor);
    severity.current = THREE.MathUtils.damp(severity.current, frame.severity, 4, dt);
    target.setRGB(...severityRgb(frame.symH));
    atmo.current.lerp(target, 1 - Math.exp(-4 * dt));
    uniforms.uAtmo.value.copy(atmo.current);
    uniforms.uSeverity.value = severity.current;
    uniforms.uTime.value = state.clock.elapsedTime;
    if (spinRef.current) spinRef.current.rotation.y += dt * 0.04;
  });

  return (
    <group rotation={[0, 0, SCENE.tilt]}>
      <mesh ref={spinRef} userData={{ blocksShell: true }} {...pickHandlers("earth")}>
        <sphereGeometry args={[SCENE.earthRadius, 128, 96]} />
        <primitive object={surface} attach="material" />
      </mesh>
      <mesh renderOrder={3}>
        <sphereGeometry args={[shellRadius, 96, 64]} />
        <primitive object={atmosphere} attach="material" />
      </mesh>
      {children}
    </group>
  );
}
