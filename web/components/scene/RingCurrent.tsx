"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { standoffToScene } from "@/lib/glsl";
import { liveFrame } from "@/lib/live";
import { useDialStore } from "@/lib/store";

/**
 * The ring current: a belt of trapped ions drifting westward around Earth at ~3–5 R_E. Its magnetic
 * field is what SYM-H measures, so it is driven only by the model's SYM-H: the storm ring and the
 * headline number can never disagree. Nearly invisible when quiet (> -30 nT). Mounted in Earth's
 * tilted frame; one Points draw call, motion computed in the vertex shader.
 */

const vertex = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime;
uniform float uRadius;
uniform float uStrength;
uniform float uPixelRatio;
varying float vGlow;
void main() {
  // Inner ions drift faster; the belt thickens as the storm grows.
  float r = uRadius * (0.72 + 0.56 * aSeed.x);
  float speed = 0.35 / (0.6 + aSeed.x);
  float ang = aSeed.y * 6.28318530718 - uTime * speed;
  float thick = (0.12 + 0.3 * uStrength) * uRadius * 0.25;
  float y = (aSeed.z - 0.5) * 2.0 * thick * (1.0 - abs(aSeed.x - 0.5));
  vec3 p = vec3(cos(ang) * r, y, sin(ang) * r);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vGlow = (0.5 + 0.5 * sin(aSeed.y * 40.0 + uTime * 2.0)) * (1.0 - abs(aSeed.x - 0.5) * 1.2);
  gl_PointSize = (1.4 + 1.6 * uStrength) * uPixelRatio * 26.0 / max(-mv.z, 0.5);
  gl_Position = projectionMatrix * mv;
}
`;

const fragment = /* glsl */ `
uniform float uStrength;
varying float vGlow;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c);
  if (r2 > 0.25) discard;
  float soft = exp(-r2 * 16.0);
  vec3 col = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.3, 0.42), smoothstep(0.5, 1.0, uStrength));
  gl_FragColor = vec4(col * soft * (0.35 + 0.9 * vGlow) * uStrength * 1.3, 1.0);
}
`;

const COUNT = 5000;

export default function RingCurrent() {
  const dpr = useThree((s) => s.viewport.dpr);
  const strength = useRef(0);
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const seeds = new Float32Array(COUNT * 3);
    let state = 0x2545f491;
    const rand = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = 0; i < COUNT * 3; i++) seeds[i] = rand();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uRadius: { value: standoffToScene(4) },
          uStrength: { value: 0 },
          uPixelRatio: { value: 1 },
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
    const target = THREE.MathUtils.clamp((-f.symH - 30) / 350, 0, 1.15);
    // Slow ease: the ring fills and drains like a bathtub rather than snapping.
    strength.current = THREE.MathUtils.damp(strength.current, target, 2.5, dt);
    material.uniforms.uStrength.value = strength.current;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPixelRatio.value = dpr;
    if (ref.current) ref.current.visible = strength.current > 0.01;
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}
