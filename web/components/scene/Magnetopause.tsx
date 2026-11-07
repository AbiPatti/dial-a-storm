"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GEO_RE, NOISE_GLSL, SCENE, magnetopauseSceneRadius, standoffToScene } from "@/lib/glsl";
import { liveFrame } from "@/lib/live";
import { useDialStore } from "@/lib/store";
import { DEFAULT_PARAMS } from "@/lib/types";

/**
 * The magnetopause as an object you can see and select.
 *
 * - Shell: Shue et al. (1998) shape r(theta) = r0 (2 / (1 + cos theta))^0.6 around the Sun-Earth
 *   line, with r0 the live stand-off (lib/severity.ts) for the dialled Bz and Pdyn. Vertices are
 *   rebuilt on the CPU when r0 changes, so raycasting (hover / click) matches what is drawn.
 * - Ghost: the same surface for the historic (1x) drivers, drawn as faint lines while any dial is
 *   moved, so the user sees how far the what-if pushed the boundary.
 * - Geostationary orbit (6.6 R_E) in Earth's tilted equatorial plane. Markers turn red where the
 *   orbit lies outside the magnetopause, i.e. where a GEO satellite would sit in the solar wind.
 */

const N_THETA = 44;
const N_PHI = 72;
const THETA_MAX = THREE.MathUtils.degToRad(124);

interface ShellBase {
  dirs: Float32Array;
  cosT: Float32Array;
  index: number[];
}

function buildBase(): ShellBase {
  const count = (N_THETA + 1) * (N_PHI + 1);
  const dirs = new Float32Array(count * 3);
  const cosT = new Float32Array(count);
  const index: number[] = [];
  for (let i = 0; i <= N_THETA; i++) {
    const th = (i / N_THETA) * THETA_MAX;
    for (let j = 0; j <= N_PHI; j++) {
      const ph = (j / N_PHI) * Math.PI * 2;
      const k = i * (N_PHI + 1) + j;
      // Axis points at the Sun (-x).
      dirs[k * 3] = -Math.cos(th);
      dirs[k * 3 + 1] = Math.sin(th) * Math.cos(ph);
      dirs[k * 3 + 2] = Math.sin(th) * Math.sin(ph);
      cosT[k] = Math.cos(th);
    }
  }
  for (let i = 0; i < N_THETA; i++) {
    for (let j = 0; j < N_PHI; j++) {
      const a = i * (N_PHI + 1) + j;
      const b = a + N_PHI + 1;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  return { dirs, cosT, index };
}

function writeShell(base: ShellBase, r0Re: number, out: Float32Array) {
  const { dirs, cosT } = base;
  for (let k = 0; k < cosT.length; k++) {
    const r = magnetopauseSceneRadius(r0Re, cosT[k]);
    out[k * 3] = dirs[k * 3] * r;
    out[k * 3 + 1] = dirs[k * 3 + 1] * r;
    out[k * 3 + 2] = dirs[k * 3 + 2] * r;
  }
}

/** Ghost wireframe: a few constant-theta rings plus meridians, as line segments. */
function ghostSegments(): number[] {
  const seg: number[] = [];
  const at = (i: number, j: number) => i * (N_PHI + 1) + j;
  for (const i of [3, 9, 16, 24, 32]) {
    for (let j = 0; j < N_PHI; j++) seg.push(at(i, j), at(i, j + 1));
  }
  for (let j = 0; j < N_PHI; j += 8) {
    for (let i = 0; i < 32; i++) seg.push(at(i, j), at(i + 1, j));
  }
  return seg;
}

const shellVertex = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec2 vUv;
void main() {
  vUv = uv;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const shellFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uHighlight;
uniform float uCompression;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec2 vUv;
${NOISE_GLSL}
void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float t = vUv.y;
  float phi = vUv.x * 6.28318530718;
  float fres = pow(1.0 - abs(dot(N, V)), 2.2);
  float tail = 1.0 - smoothstep(0.35, 0.9, t);
  float nose = exp(-t * 5.0) * (0.35 + 0.65 * uCompression);
  // Plasma streaks flowing from the nose down the flanks.
  vec2 ring = vec2(cos(phi), sin(phi));
  float streak = 0.6 + 0.4 * snoise(vec3(ring * 2.5, t * 7.0 - uTime * 0.5));
  // Faint meridians: a scientific grid that brightens when the shell is selected.
  float grid = smoothstep(0.985, 1.0, abs(cos(phi * 6.0))) * (0.12 + 0.5 * uHighlight);
  float a = (fres * 0.36 + nose * 0.2) * streak * tail * (0.45 + 0.9 * uHighlight) + grid * tail * fres * 0.6;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

const QUIET = new THREE.Color(0.42, 0.68, 1.0);
const COMPRESSED = new THREE.Color(1.0, 0.42, 0.28);
const GEO_SAFE = new THREE.Color(0.7, 0.82, 1.0);
const GEO_EXPOSED = new THREE.Color(2.6, 0.55, 0.35);
const N_MARKERS = 12;

export default function Magnetopause() {
  const base = useMemo(buildBase, []);
  const r0 = useRef(10);
  const ghostR0 = useRef(10);
  const lastShell = useRef(-1);
  const lastGhost = useRef(-1);
  const highlight = useRef(0);
  const ghostAlpha = useRef(0);
  const spin = useRef(0);
  const markers = useRef<THREE.InstancedMesh>(null);
  const geoGroup = useRef<THREE.Group>(null);
  const scratch = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color(), col: new THREE.Color() }), []);
  const geoRadius = standoffToScene(GEO_RE);

  const shellGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const count = base.cosT.length;
    const uv = new Float32Array(count * 2);
    for (let i = 0; i <= N_THETA; i++) {
      for (let j = 0; j <= N_PHI; j++) {
        const k = i * (N_PHI + 1) + j;
        uv[k * 2] = j / N_PHI;
        uv[k * 2 + 1] = i / N_THETA;
      }
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(base.index);
    return g;
  }, [base]);

  const ghostGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(base.cosT.length * 3), 3));
    g.setIndex(ghostSegments());
    return g;
  }, [base]);

  const geoRing = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * geoRadius, 0, Math.sin(a) * geoRadius));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [geoRadius]);

  const shellMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: QUIET.clone() },
          uTime: { value: 0 },
          uHighlight: { value: 0 },
          uCompression: { value: 0 },
        },
        vertexShader: shellVertex,
        fragmentShader: shellFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const ghostMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const ringMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.28, depthWrite: false }),
    [],
  );
  const markerGeometry = useMemo(() => new THREE.SphereGeometry(0.048, 12, 8), []);
  const markerMaterial = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);

  useEffect(
    () => () => {
      [shellGeometry, ghostGeometry, geoRing, markerGeometry].forEach((g) => g.dispose());
      [shellMaterial, ghostMaterial, ringMaterial, markerMaterial].forEach((m) => m.dispose());
    },
    [shellGeometry, ghostGeometry, geoRing, markerGeometry, shellMaterial, ghostMaterial, ringMaterial, markerMaterial],
  );

  // Only accept front-facing hits, so clicks from inside the shell fall through to empty space.
  const shellRef = useRef<THREE.Mesh>(null);
  useEffect(() => {
    const mesh = shellRef.current;
    if (!mesh) return;
    const hits: THREE.Intersection[] = [];
    mesh.raycast = function raycast(rc, out) {
      hits.length = 0;
      THREE.Mesh.prototype.raycast.call(this, rc, hits);
      // The shell is star-shaped around Earth, so the radial direction is an outward normal.
      for (const h of hits) if (h.point.dot(rc.ray.direction) < 0) out.push(h);
    };
  }, []);

  useFrame((state, dt) => {
    const s = useDialStore.getState();
    const live = liveFrame(s.bundle, s.activeTrace, s.params, s.cursor);
    const hist = liveFrame(s.bundle, s.activeTrace, DEFAULT_PARAMS, s.cursor);
    r0.current = THREE.MathUtils.damp(r0.current, live.standoffRe, 3, dt);
    ghostR0.current = THREE.MathUtils.damp(ghostR0.current, hist.standoffRe, 3, dt);

    if (Math.abs(r0.current - lastShell.current) > 0.004) {
      lastShell.current = r0.current;
      const pos = shellGeometry.getAttribute("position") as THREE.BufferAttribute;
      writeShell(base, r0.current, pos.array as Float32Array);
      pos.needsUpdate = true;
      shellGeometry.computeVertexNormals();
      shellGeometry.computeBoundingSphere();
    }
    if (Math.abs(ghostR0.current - lastGhost.current) > 0.004) {
      lastGhost.current = ghostR0.current;
      const pos = ghostGeometry.getAttribute("position") as THREE.BufferAttribute;
      writeShell(base, ghostR0.current, pos.array as Float32Array);
      pos.needsUpdate = true;
      ghostGeometry.computeBoundingSphere();
    }

    const sel = s.selected === "magnetopause" ? 1 : s.hovered === "magnetopause" ? 0.55 : 0;
    highlight.current = THREE.MathUtils.damp(highlight.current, sel, 6, dt);
    const compression = THREE.MathUtils.clamp((10 - r0.current) / 5, 0, 1);
    const u = shellMaterial.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uHighlight.value = highlight.current;
    u.uCompression.value = compression;
    (u.uColor.value as THREE.Color).copy(QUIET).lerp(COMPRESSED, compression);

    const dialled = s.params.bz !== 1 || s.params.speed !== 1 || s.params.density !== 1;
    const gap = Math.abs(live.standoffRe - hist.standoffRe);
    ghostAlpha.current = THREE.MathUtils.damp(ghostAlpha.current, dialled && gap > 0.05 ? 0.17 : 0, 4, dt);
    ghostMaterial.opacity = ghostAlpha.current;
    ghostMaterial.visible = ghostAlpha.current > 0.01;
    ringMaterial.opacity = 0.22 + 0.3 * highlight.current;

    // GEO markers ride the orbit; exposure is tested in world space against the shell.
    spin.current += dt * 0.05;
    const im = markers.current;
    const g = geoGroup.current;
    if (im && g) {
      g.updateWorldMatrix(true, false);
      const p = new THREE.Vector3();
      for (let i = 0; i < N_MARKERS; i++) {
        const a = spin.current + (i / N_MARKERS) * Math.PI * 2;
        p.set(Math.cos(a) * geoRadius, 0, Math.sin(a) * geoRadius);
        scratch.m.makeTranslation(p.x, p.y, p.z);
        im.setMatrixAt(i, scratch.m);
        p.applyMatrix4(g.matrixWorld);
        const exposed = p.length() > magnetopauseSceneRadius(r0.current, -p.x / p.length());
        im.setColorAt(i, exposed ? GEO_EXPOSED : GEO_SAFE);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  });

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.intersections.some((h) => h.object.userData.blocksShell)) return;
    useDialStore.getState().hover("magnetopause");
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    if (useDialStore.getState().hovered === "magnetopause") {
      useDialStore.getState().hover(null);
      document.body.style.cursor = "";
    }
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.intersections.some((h) => h.object.userData.blocksShell)) return;
    e.stopPropagation();
    useDialStore.getState().select("magnetopause");
  };
  const onDouble = (e: ThreeEvent<MouseEvent>) => {
    if (e.intersections.some((h) => h.object.userData.blocksShell)) return;
    e.stopPropagation();
    const st = useDialStore.getState();
    st.select("magnetopause");
    st.focusOn("magnetopause");
  };

  return (
    <group>
      <mesh
        ref={shellRef}
        geometry={shellGeometry}
        material={shellMaterial}
        renderOrder={2}
        frustumCulled={false}
        onPointerMove={onMove}
        onPointerOut={onOut}
        onClick={onClick}
        onDoubleClick={onDouble}
      />
      <lineSegments geometry={ghostGeometry} material={ghostMaterial} frustumCulled={false} renderOrder={2} />
      <group ref={geoGroup} rotation={[0, 0, SCENE.tilt]}>
        <lineLoop geometry={geoRing} material={ringMaterial} />
        <instancedMesh ref={markers} args={[markerGeometry, markerMaterial, N_MARKERS]} frustumCulled={false} />
      </group>
    </group>
  );
}
