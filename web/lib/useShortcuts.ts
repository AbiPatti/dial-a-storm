"use client";

import { useEffect } from "react";
import { useDialStore, type ViewId } from "./store";

/** Keyboard shortcuts, listed for users in the Guide (components/hud/GuidePanel.tsx). */
export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Space"], label: "Play / pause" },
  { keys: ["←", "→"], label: "Step 1 hour (Shift: 6 hours)" },
  { keys: ["Home"], label: "Back to the start" },
  { keys: ["[", "]"], label: "Previous / next storm" },
  { keys: ["0"], label: "Fit the whole scene" },
  { keys: ["1", "2", "3", "4"], label: "Fly to Sun / Earth / magnetopause / aurora" },
  { keys: ["R"], label: "Reset the dials to history (1×)" },
  { keys: ["L"], label: "Show / hide labels" },
  { keys: ["E"], label: "Switch between Simulator and Explainer" },
  { keys: ["?"], label: "Help" },
  { keys: ["Esc"], label: "Close panel / deselect" },
];

const VIEW_KEYS: Record<string, ViewId> = { "0": "overview", "1": "sun", "2": "earth", "3": "magnetopause", "4": "aurora" };

/** Binds the global shortcuts. Ignored while typing in a form field. */
export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const inField = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || el?.isContentEditable;
      const s = useDialStore.getState();

      if (e.key === "Escape") {
        if (s.panel) s.openPanel(null);
        else if (s.selected) s.select(null);
        return;
      }
      // Range inputs own the arrow keys; buttons own Space/Enter.
      if (inField) return;
      if (e.key === "e" || e.key === "E") {
        s.setTab(s.tab === "simulator" ? "explainer" : "simulator");
        return;
      }
      // The explainer is a normal scrolling page: Space and the arrows scroll it.
      if (s.tab !== "simulator") {
        if (e.key === "?") s.openPanel(s.panel === "help" ? null : "help");
        return;
      }
      if (e.code === "Space") {
        if (tag === "BUTTON") return;
        e.preventDefault();
        s.togglePlay();
        return;
      }
      const hour = s.bundle ? 60 / s.bundle.window.cadence_minutes : 4;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowLeft": {
          e.preventDefault();
          s.pause();
          s.seek(s.cursor + (e.key === "ArrowRight" ? 1 : -1) * hour * (e.shiftKey ? 6 : 1));
          return;
        }
        case "Home":
          e.preventDefault();
          s.seek(0);
          return;
        case "[":
          s.stepStorm(-1);
          return;
        case "]":
          s.stepStorm(1);
          return;
        case "r":
        case "R":
          s.resetParams();
          return;
        case "l":
        case "L":
          s.toggleLabels();
          return;
        case "?":
          s.openPanel(s.panel === "help" ? null : "help");
          return;
      }
      const view = VIEW_KEYS[e.key];
      if (view) {
        if (view !== "overview") s.select(view);
        s.focusOn(view);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
