"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import Landing from "@/components/landing/Landing";
import DialPanel from "@/components/hud/DialPanel";
import GuidePanel, { guideSeen } from "@/components/hud/GuidePanel";
import InfoPanel from "@/components/hud/InfoPanel";
import ModelDrawer from "@/components/hud/ModelDrawer";
import TimelineDock from "@/components/hud/TimelineDock";
import TopBar from "@/components/hud/TopBar";
import { useDialStore } from "@/lib/store";
import { usePlayback } from "@/lib/usePlayback";
import { useShortcuts } from "@/lib/useShortcuts";

// WebGL must never render on the server.
const SpaceCanvas = dynamic(() => import("@/components/scene/SpaceCanvas"), { ssr: false });

/**
 * The 3D scene fills the viewport and is the primary interface. The HUD floats above it in three
 * levels: always-visible essentials (storm, dials, timeline), a contextual card for the selected
 * object, and on-demand panels (model & validation, guide).
 */
export default function Page() {
  const init = useDialStore((s) => s.init);
  const status = useDialStore((s) => s.status);
  const error = useDialStore((s) => s.error);
  const entered = useDialStore((s) => s.landing === "entered");
  const hud = useRef<HTMLElement>(null);
  usePlayback();
  useShortcuts();

  // Data loads behind the landing page, so the scene is ready by the time the user scrolls in.
  useEffect(() => {
    void init();
  }, [init]);

  // The HUD is hidden from pointer, keyboard and screen readers until the landing has dissolved.
  useEffect(() => {
    hud.current?.toggleAttribute("inert", !entered);
    if (entered && !guideSeen()) useDialStore.getState().openPanel("help");
  }, [entered]);

  return (
    <>
      <SpaceCanvas />
      <main
        ref={hud}
        aria-hidden={!entered}
        className={`hud-reveal pointer-events-none fixed inset-0 z-10 flex flex-col ${entered ? "opacity-100" : "opacity-0"}`}
      >
        <TopBar />

        <div className="relative min-h-0 flex-1 px-3 sm:px-4">
          <div className="max-h-full overflow-y-auto">
            <InfoPanel />
          </div>

          {status === "loading" && (
            <div role="status" className="fade-in absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="mx-auto h-px w-24 animate-pulse bg-gradient-to-r from-transparent via-plasma-300 to-transparent" />
              <p className="mt-3 font-mono text-[11px] tracking-[0.2em] text-slate-400">LOADING THE OMNI ARCHIVE</p>
            </div>
          )}
          {status === "error" && (
            <div role="alert" className="glass pointer-events-auto absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 p-5 text-sm">
              <div className="font-semibold text-rose-300">Could not load storm data</div>
              <p className="mt-1 break-words text-slate-300">{error}</p>
              <p className="mt-2 text-slate-400">
                Expected static files under <code className="font-mono">web/public/data/</code>. Regenerate them with{" "}
                <code className="font-mono">python -m dial_a_storm.pipeline</code> (or <code className="font-mono">python -m dial_a_storm.make_fixtures</code>) from{" "}
                <code className="font-mono">pipeline/</code>.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 p-3 sm:flex-row sm:items-end sm:gap-3 sm:p-4">
          <TimelineDock />
          <DialPanel />
        </div>
      </main>
      <ModelDrawer />
      <GuidePanel />
      <Landing />
    </>
  );
}
