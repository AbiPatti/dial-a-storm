"use client";

import { useEffect } from "react";
import { useDialStore } from "./store";

/**
 * Drives playback with requestAnimationFrame (independent of the WebGL loop, so the chart keeps
 * working if WebGL is unavailable). Keyboard shortcuts live in useShortcuts.ts.
 */
export function usePlayback(): void {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      useDialStore.getState().tick(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);
}
