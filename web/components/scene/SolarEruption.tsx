"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { bowShockX, eruptionAt, frontLeadX } from "@/lib/flare";
import { NOISE_GLSL, SCENE } from "@/lib/glsl";
import { liveFrame } from "@/lib/live";
import { useDialStore } from "@/lib/store";

/**
 * The solar eruption that starts a storm, drawn from the playback cursor (lib/flare.ts):
 *
 * 1. A flash at the launch site on the Earth-facing side of the Sun, with diffraction spikes.
 * 2. An arcade of glowing loops that rises from the surface and fades (post-flare loops).
 * 3. A CME: a cone of plasma and a bright, turbulent shock front that travels the Sun-Earth line
 *    and meets the bow shock exactly when the data's wind speed jumps.
 *
 * Everything is additive and hand-written GLSL on WebGL 2. Nothing here owns state; it is all a
 * function of the cursor, so scrubbing in either direction is exact.
 */

const R = SCENE.sunRadius;
const SITE = new THREE.Vector3(SCENE.sunPosition[0] + R, 0, 0);

/* ----------------------------------------------------------------------------------------------
 * Flash
 * -------------------------------------------------------------------------------------------- */

const flashVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const flashFragment = /* glsl */ `
uniform float uI;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float core = exp(-r * r * 38.0);
  float halo = exp(-r * 5.5) * 0.55;
  float cross = (exp(-abs(p.x) * 38.0) + exp(-abs(p.y) * 38.0)) * exp(-r * 2.6);
  vec2 d = vec2(p.x + p.y, p.x - p.y) * 0.7071;
  float diag = 0.45 * (exp(-abs(d.x) * 60.0) + exp(-abs(d.y) * 60.0)) * exp(-r * 3.6);
  float a = (core * 2.6 + halo + 0.9 * cross + diag) * uI * (1.0 - smoothstep(0.82, 1.0, r));
  vec3 col = mix(vec3(1.0, 0.52, 0.16), vec3(1.0, 0.96, 0.82), clamp(core + halo * 0.5, 0.0, 1.0));
  gl_FragColor = vec4(col * a, 1.0);
}
`;

/* ----------------------------------------------------------------------------------------------
 * Loops
 * -------------------------------------------------------------------------------------------- */

const loopVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const loopFragment = /* glsl */ `
uniform float uI;
uniform float uTime;
uniform float uSeed;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
${NOISE_GLSL}
void main() {
  float along = vUv.x;
  float apex = sin(3.14159265 * along);
  // Tube shading: bright along the middle, soft at the silhouette.
  float mid = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  // Strands of plasma travelling up the loop.
  float strands = 0.62 + 0.55 * snoise(vec3(along * 11.0 - uTime * 0.9, vUv.y * 2.0 + uSeed, uSeed * 3.0));
  float a = mid * (0.25 + 0.75 * apex) * clamp(strands, 0.1, 1.5) * uI;
  vec3 col = mix(vec3(1.0, 0.42, 0.1), vec3(1.0, 0.86, 0.55), apex * mid);
  gl_FragColor = vec4(col * a, 1.0);
}
`;

/* ----------------------------------------------------------------------------------------------
 * CME: shock front + cone
 * -------------------------------------------------------------------------------------------- */

const frontVertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
void main() {
  vObj = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const frontFragment = /* glsl */ `
uniform float uI;
uniform float uTime;
uniform vec3 uHot;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
${NOISE_GLSL}
void main() {
  float ndv = abs(dot(normalize(vN), normalize(vV)));
  float rim = pow(1.0 - ndv, 3.2);
  // Leading hemisphere only: the front is a bow, not a ball.
  float lead = smoothstep(0.0, 0.9, vObj.x);
  // Filaments: stretched noise, thresholded so the shell breaks into bright strands and gaps.
  float web = fbm3(vObj * vec3(2.4, 5.5, 5.5) + vec3(uTime * 0.3, 0.0, uTime * 0.18));
  float strands = smoothstep(-0.15, 0.6, web);
  float a = (rim * 1.6 + 0.035) * lead * (0.25 + 1.4 * strands) * uI;
  vec3 col = mix(uHot, vec3(1.0, 0.9, 0.66), clamp(rim * 1.3 + smoothstep(0.6, 1.0, vObj.x) * 0.5, 0.0, 1.0));
  gl_FragColor = vec4(col * a, 1.0);
}
`;

const coneFragment = /* glsl */ `
uniform float uI;
uniform float uTime;
uniform vec3 uHot;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
${NOISE_GLSL}
void main() {
  // A unit cone is centred on the origin with its apex at y = +0.5 and its base at y = -0.5. After
  // the mesh rotation the apex sits at the Sun, so along runs 0 (Sun) to 1 (front).
  float along = 0.5 - vObj.y;
  float ndv = abs(dot(normalize(vN), normalize(vV)));
  // Soft silhouette (no outline): the cone is a faint plasma haze, thickest where we look through
  // the most of it.
  float body = pow(ndv, 0.7);
  float web = fbm3(vec3(vObj.x * 3.2, along * 3.5 - uTime * 0.7, vObj.z * 3.2));
  float streak = smoothstep(-0.2, 0.7, web);
  float a = (0.05 + 0.5 * body * streak) * smoothstep(0.0, 0.3, along) * (1.0 - 0.6 * along) * uI;
  vec3 col = mix(uHot, vec3(1.0, 0.8, 0.5), 0.3 * (1.0 - along));
  gl_FragColor = vec4(col * a, 1.0);
}
`;

const ARCH_FAN = [0, 0.55, -0.6, 1.25, -1.15];

function additive(parameters: THREE.ShaderMaterialParameters): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...parameters });
}

export default function SolarEruption() {
  const root = useRef<THREE.Group>(null);
  const flashMesh = useRef<THREE.Mesh>(null);
  const loops = useRef<(THREE.Group | null)[]>([]);
  const frontMesh = useRef<THREE.Mesh>(null);
  const coneMesh = useRef<THREE.Mesh>(null);
  const standoff = useRef(10);

  const flashMat = useMemo(
    () => additive({ uniforms: { uI: { value: 0 } }, vertexShader: flashVertex, fragmentShader: flashFragment, depthTest: false }),
    [],
  );
  const loopMats = useMemo(
    () =>
      ARCH_FAN.map((_, i) =>
        additive({
          uniforms: { uI: { value: 0 }, uTime: { value: 0 }, uSeed: { value: 1.7 * i + 0.3 } },
          vertexShader: loopVertex,
          fragmentShader: loopFragment,
          side: THREE.DoubleSide,
        }),
      ),
    [],
  );
  const frontMat = useMemo(
    () =>
      additive({
        uniforms: { uI: { value: 0 }, uTime: { value: 0 }, uHot: { value: new THREE.Color(1.0, 0.5, 0.16) } },
        vertexShader: frontVertex,
        fragmentShader: frontFragment,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const coneMat = useMemo(
    () =>
      additive({
        uniforms: { uI: { value: 0 }, uTime: { value: 0 }, uHot: { value: new THREE.Color(1.0, 0.45, 0.14) } },
        vertexShader: frontVertex,
        fragmentShader: coneFragment,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const geo = useMemo(
    () => ({
      flash: new THREE.PlaneGeometry(9, 9),
      loop: new THREE.TorusGeometry(1, 0.05, 10, 56, Math.PI),
      front: new THREE.SphereGeometry(1, 56, 40),
      cone: new THREE.ConeGeometry(1, 1, 48, 1, true),
    }),
    [],
  );

  useEffect(
    () => () => {
      [flashMat, frontMat, coneMat, ...loopMats].forEach((m) => m.dispose());
      Object.values(geo).forEach((g) => g.dispose());
    },
    [flashMat, frontMat, coneMat, loopMats, geo],
  );

  const tmp = useMemo(() => ({ toCam: new THREE.Vector3(), hot: new THREE.Color() }), []);

  useFrame((state, dt) => {
    const s = useDialStore.getState();
    const eruption = eruptionAt(s.bundle, s.cursor, s.tracePeak?.value ?? null);
    const group = root.current;
    if (!group) return;
    group.visible = eruption !== null;
    if (!eruption) return;

    const t = state.clock.elapsedTime;
    const { p, strength, flash, rise, linger, front } = eruption;

    // Flash: billboard at the launch site, hidden when the site is on the far side of the Sun.
    if (flashMesh.current) {
      flashMesh.current.quaternion.copy(state.camera.quaternion);
      tmp.toCam.copy(state.camera.position).sub(SITE).normalize();
      const facing = THREE.MathUtils.smoothstep(tmp.toCam.x, -0.2, 0.25);
      flashMat.uniforms.uI.value = flash * strength * facing;
    }

    // Loops: they grow while they rise, then fade as the CME leaves.
    const grow = rise;
    loops.current.forEach((g, i) => {
      if (!g) return;
      const w = (0.55 + 0.35 * i) * (0.45 + 0.95 * grow);
      const h = (0.7 + 0.55 * i) * (0.25 + 2.3 * grow);
      g.scale.set(w, h, w);
      const onset = THREE.MathUtils.smoothstep(rise, 0.0, 0.12);
      loopMats[i].uniforms.uI.value = 1.5 * strength * linger * onset * (1 - 0.12 * i);
      loopMats[i].uniforms.uTime.value = t;
    });

    // CME: the front travels from the launch site to the bow shock.
    const f = liveFrame(s.bundle, s.activeTrace, s.params, s.cursor);
    standoff.current = THREE.MathUtils.damp(standoff.current, f.standoffRe, 3, dt);
    const leadX = frontLeadX(p, SITE.x, bowShockX(standoff.current));
    const bubble = 0.9 + 3.6 * Math.pow(p, 0.75);
    const semiAxis = bubble * 0.55;
    const hot = tmp.hot.setRGB(1.0, 0.56 - 0.12 * strength, 0.1 + 0.04 * strength);
    if (frontMesh.current) {
      frontMesh.current.position.set(leadX - semiAxis, 0, 0);
      frontMesh.current.scale.set(semiAxis, bubble, bubble);
      frontMat.uniforms.uI.value = 1.5 * strength * front;
      frontMat.uniforms.uTime.value = t;
      frontMat.uniforms.uHot.value.copy(hot);
    }
    if (coneMesh.current) {
      const length = Math.max(0.01, leadX - SITE.x);
      coneMesh.current.position.set(SITE.x + length / 2, 0, 0);
      coneMesh.current.scale.set(bubble * 0.85, length, bubble * 0.85);
      coneMat.uniforms.uI.value = 0.7 * strength * front;
      coneMat.uniforms.uTime.value = t;
      coneMat.uniforms.uHot.value.copy(hot);
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh ref={flashMesh} position={[SITE.x + 0.3, 0, 0]} geometry={geo.flash} material={flashMat} renderOrder={6} />

      {/* Loops: a fan of arches, each twisted about the outward (x) axis, feet sunk below the surface. */}
      <group position={[SITE.x - 0.7, 0, 0]}>
        {ARCH_FAN.map((phi, i) => (
          <group key={i} rotation={[phi, 0, 0]}>
            <group
              ref={(g) => {
                loops.current[i] = g;
              }}
              rotation={[0, 0, -Math.PI / 2]}
            >
              <mesh geometry={geo.loop} material={loopMats[i]} renderOrder={3} />
            </group>
          </group>
        ))}
      </group>

      {/* The cone rotates +y (apex) to -x so its apex stays at the Sun. */}
      <mesh ref={coneMesh} geometry={geo.cone} material={coneMat} rotation={[0, 0, Math.PI / 2]} renderOrder={3} />
      <mesh ref={frontMesh} geometry={geo.front} material={frontMat} renderOrder={4} />
    </group>
  );
}
