"use client";

import { useEffect, useRef } from "react";
import { useDialStore } from "@/lib/store";
import DialPanel from "./DialPanel";

/**
 * The full solar-wind panel (three sliders, Max, Reset, Simulate, extrapolation advisory), opened
 * from the storm dial's "Fine-tune" link. Closes on Esc (global shortcut) or a click outside.
 */
export default function TunePopover() {
  const open = useDialStore((s) => s.panel === "tune");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest('[aria-label="Storm dial"]')) return;
      // Clicks on the 3D canvas orbit the camera; only HUD clicks elsewhere close the panel.
      if (t.tagName === "CANVAS") return;
      useDialStore.getState().openPanel(null);
    };
    window.addEventListener("pointerdown", onDown);
    ref.current?.querySelector<HTMLInputElement>("input[type=range]")?.focus();
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Fine-tune the solar wind"
      className="panel-in pointer-events-auto fixed inset-x-3 bottom-3 z-20 sm:absolute sm:inset-x-auto sm:bottom-0 sm:right-full sm:mr-3"
    >
      <DialPanel />
    </div>
  );
}
