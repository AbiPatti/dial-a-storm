"use client";

import { useEffect } from "react";
import { useDialStore } from "./store";

/**
 * Drives playback with requestAnimationFrame (independent of the WebGL loop, so the chart keeps
 * working if WebGL is unavailable) and binds the space bar to play/pause.
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

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "BUTTON" || el.isContentEditable)) return;
      e.preventDefault();
      useDialStore.getState().togglePlay();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}
