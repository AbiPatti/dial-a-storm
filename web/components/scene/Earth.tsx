"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { SCENE } from "@/lib/glsl";
import { liveFrame } from "@/lib/live";
import { severityRgb } from "@/lib/severity";
import { useDialStore } from "@/lib/store";

/**
 * Textured Earth: day map, city lights on the night side, clouds and ocean glint from
 * /textures/earth/*.jpg, plus a thin atmosphere rim. The rim tint follows storm severity so Earth
 * itself warms up as the storm deepens.
 */

const SUN_DIR = new THREE.Vector3(...SCENE.sunPosition).normalize();

const vertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const surfaceFragment = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uSpecClouds;
uniform vec3 uSunDir;
uniform vec3 uAtmo;
uniform float uSeverity;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 L = normalize(uSunDir);
  float sunOri = dot(N, L);
  float dayMix = smoothstep(-0.2, 0.45, sunOri);

  vec3 day = texture2D(uDay, vUv).rgb;
  vec3 night = texture2D(uNight, vUv).rgb * vec3(1.0, 0.78, 0.52) * 1.6;
  vec3 col = mix(night, day * (0.15 + 1.05 * max(sunOri, 0.0)), dayMix);

  vec2 sc = texture2D(uSpecClouds, vUv).rg;
  float clouds = smoothstep(0.45, 1.0, sc.g);
  col = mix(col, vec3(1.0) * (0.06 + 0.95 * max(sunOri, 0.0)), clouds * 0.9);

  // Ocean glint.
  vec3 H = normalize(L + V);
  col += vec3(1.0, 0.86, 0.7) * pow(max(dot(N, H), 0.0), 60.0) * sc.r * dayMix * 0.8;

  // Atmosphere seen edge-on, warmer as the storm grows.
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  float lit = mix(smoothstep(-0.4, 0.8, sunOri), 1.0, uSeverity * 0.6);
  col = mix(col, uAtmo, fres * lit * (0.55 + 0.35 * uSeverity));
  gl_FragColor = vec4(col, 1.0);
}
`;

const atmosphereFragment = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uAtmo;
uniform float uSeverity;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  float rim = pow(1.0 - abs(dot(N, V)), 3.0);
  float edge = smoothstep(0.0, 0.35, abs(dot(N, V)));
  float sunSide = mix(smoothstep(-0.5, 0.4, dot(N, normalize(uSunDir))), 1.0, uSeverity * 0.5);
  gl_FragColor = vec4(uAtmo * rim * edge * sunSide * (0.9 + 0.8 * uSeverity), 1.0);
}
`;

function loadTexture(loader: THREE.TextureLoader, url: string, srgb: boolean) {
  const t = loader.load(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

interface EarthProps {
  /** Children are mounted in Earth's tilted, non-spinning frame (aurora, field lines, ring current). */
  children?: ReactNode;
}

export default function Earth({ children }: EarthProps) {
  const spinRef = useRef<THREE.Mesh>(null);
  const severity = useRef(0);
  const atmo = useRef(new THREE.Color(...severityRgb(0)));
  const target = useMemo(() => new THREE.Color(), []);

  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    return {
      day: loadTexture(loader, "/textures/earth/day.jpg", true),
      night: loadTexture(loader, "/textures/earth/night.jpg", true),
      specClouds: loadTexture(loader, "/textures/earth/specular-clouds.jpg", false),
    };
  }, []);

  const uniforms = useMemo(
    () => ({
      uDay: { value: textures.day },
      uNight: { value: textures.night },
      uSpecClouds: { value: textures.specClouds },
      uSunDir: { value: SUN_DIR.clone() },
      uAtmo: { value: new THREE.Color(...severityRgb(0)) },
      uSeverity: { value: 0 },
    }),
    [textures],
  );

  const surface = useMemo(() => new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: surfaceFragment }), [uniforms]);
  const atmosphere = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: vertex,
        fragmentShader: atmosphereFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );

  useEffect(
    () => () => {
      surface.dispose();
      atmosphere.dispose();
      Object.values(textures).forEach((t) => t.dispose());
    },
    [surface, atmosphere, textures],
  );

  useFrame((_, dt) => {
    const s = useDialStore.getState();
    const frame = liveFrame(s.bundle, s.activeTrace, s.params, s.cursor);
    severity.current = THREE.MathUtils.damp(severity.current, frame.severity, 3, dt);
    target.setRGB(...severityRgb(frame.symH));
    atmo.current.lerp(target, 1 - Math.exp(-3 * dt));
    uniforms.uAtmo.value.copy(atmo.current);
    uniforms.uSeverity.value = severity.current;
    if (spinRef.current) spinRef.current.rotation.y += dt * 0.03;
  });

  return (
    <group rotation={[0, 0, SCENE.tilt]}>
      <mesh ref={spinRef} rotation={[0, -1.2, 0]}>
        <sphereGeometry args={[SCENE.earthRadius, 128, 96]} />
        <primitive object={surface} attach="material" />
      </mesh>
      <mesh renderOrder={3}>
        <sphereGeometry args={[SCENE.earthRadius * 1.12, 96, 64]} />
        <primitive object={atmosphere} attach="material" />
      </mesh>
      {children}
    </group>
  );
}
