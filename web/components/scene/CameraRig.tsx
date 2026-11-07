"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { prefersReducedMotion } from "@/lib/motion";
import { useDialStore, type ViewId } from "@/lib/store";

/**
 * Orbit camera with eased fly-to presets.
 *
 * - Drag to orbit, scroll / pinch to zoom (clamped), double-click an object to fly to it.
 * - On first load the camera glides in from deep space to the overview.
 * - Any user drag cancels an in-flight transition, so the rig never fights the hand.
 * - With prefers-reduced-motion the camera jumps instead of flying.
 */

type V3 = [number, number, number];
export const VIEWS: Record<ViewId, { position: V3; target: V3 }> = {
  overview: { position: [11, 10, 31], target: [-8.5, -1.4, 0] },
  sun: { position: [-12, 4.5, 21], target: [-30, 0, 0] },
  earth: { position: [4.6, 1.6, 8.2], target: [0, -0.7, 0] },
  magnetopause: { position: [4, 15, 22], target: [-1.5, -1, 0] },
  aurora: { position: [1.6, 6.2, 3.2], target: [-0.3, 0.9, 0] },
};
const ESTABLISHING: V3 = [26, 15, 44];

/** Portrait screens see less horizontally: pull the camera back and centre the overview on Earth. */
function resolveView(view: ViewId, aspect: number) {
  const v = VIEWS[view];
  const target = new THREE.Vector3(...v.target);
  if (aspect >= 1) return { position: new THREE.Vector3(...v.position), target };
  if (view === "overview") target.set(-3.5, -7, 0);
  const offset = new THREE.Vector3(...v.position).sub(new THREE.Vector3(...v.target));
  offset.multiplyScalar(Math.min(2.1, 1.1 / Math.max(aspect, 0.3)));
  return { position: target.clone().add(offset), target };
}

export default function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const flight = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const aspect = () => (camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1.6);
    const c = controls.current;
    const start = resolveView("overview", aspect());
    if (reduced) camera.position.copy(start.position);
    else camera.position.set(...ESTABLISHING);
    c?.target.copy(start.target);
    c?.update();

    const go = (view: ViewId) => {
      const v = resolveView(view, aspect());
      if (prefersReducedMotion()) {
        flight.current = null;
        camera.position.copy(v.position);
        controls.current?.target.copy(v.target);
        controls.current?.update();
        return;
      }
      flight.current = v;
    };

    let introDone = false;
    const intro = () => {
      if (introDone) return;
      introDone = true;
      go("overview");
    };
    if (useDialStore.getState().status === "ready") intro();
    const unsub = useDialStore.subscribe((s, prev) => {
      if (s.focus.nonce !== prev.focus.nonce) go(s.focus.view);
      if (s.status === "ready" && prev.status !== "ready") intro();
    });
    return () => {
      unsub();
      document.body.style.cursor = "";
    };
  }, [camera]);

  useFrame((_, dt) => {
    const f = flight.current;
    const c = controls.current;
    if (!f || !c) return;
    const k = 1 - Math.exp(-2.4 * Math.min(dt, 0.05));
    camera.position.lerp(f.position, k);
    c.target.lerp(f.target, k);
    if (camera.position.distanceToSquared(f.position) < 1e-4 && c.target.distanceToSquared(f.target) < 1e-4) flight.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={0.7}
      minDistance={2.8}
      maxDistance={120}
      enablePan={false}
      onStart={() => {
        flight.current = null;
      }}
    />
  );
}
