"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import ExplainerTab from "@/components/explainer/ExplainerTab";
import GuidePanel, { guideSeen } from "@/components/hud/GuidePanel";
import Headline from "@/components/hud/Headline";
import Impacts from "@/components/hud/Impacts";
import InfoPanel from "@/components/hud/InfoPanel";
import StormDial from "@/components/hud/StormDial";
import TimelineDock from "@/components/hud/TimelineDock";
import TopBar from "@/components/hud/TopBar";
import TunePopover from "@/components/hud/TunePopover";
import Landing from "@/components/landing/Landing";
import { useDialStore } from "@/lib/store";
import { usePlayback } from "@/lib/usePlayback";
import { useShortcuts } from "@/lib/useShortcuts";

// WebGL must never render on the server.
const SpaceCanvas = dynamic(() => import("@/components/scene/SpaceCanvas"), { ssr: false });

/**
 * A landing page, then two tabs that share one header.
 *
 * - Landing: a title screen; scrolling dives into the storm and dissolves into the app.
 * - Simulator: the 3D scene fills the viewport. The HUD is deliberately sparse: the live
 *   narrative and history ruler (left), the storm's consequences or the selected object's card
 *   (right), one storm knob with the full solar-wind panel behind "Fine-tune" (bottom right),
 *   and the timeline (bottom).
 * - Explainer: a scrolling page with the physics, method, hold-out test, catalogue and limits.
 *   The scene stays mounted (so returning is instant) but stops rendering.
 */
export default function Page() {
  const init = useDialStore((s) => s.init);
  const status = useDialStore((s) => s.status);
  const error = useDialStore((s) => s.error);
  const tab = useDialStore((s) => s.tab);
  const selected = useDialStore((s) => s.selected);
  const tuning = useDialStore((s) => s.panel === "tune");
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

  const simulator = tab === "simulator";

  return (
    <>
      <SpaceCanvas active={simulator} />
      <main
        ref={hud}
        aria-hidden={!entered}
        className={`hud-reveal pointer-events-none fixed inset-0 z-10 ${entered ? "opacity-100" : "opacity-0"}`}
      >
        {simulator ? (
          <div id="simulator-panel" role="tabpanel" aria-labelledby="tab-simulator" className="flex h-full flex-col">
            <TopBar />

            <div className="relative flex min-h-0 flex-1 justify-between gap-3 px-3 sm:px-4">
              <div className={`min-w-0 pt-2 sm:pt-4 ${selected ? "hidden md:block" : ""}`}>
                <Headline />
              </div>
              <div className="max-h-full shrink-0 overflow-y-auto">
                {/* One right-hand card at a time: the selected object, else the consequences (hidden while fine-tuning). */}
                {selected ? (
                  <InfoPanel />
                ) : (
                  status === "ready" &&
                  !tuning && (
                    <div className="hidden md:block">
                      <Impacts />
                    </div>
                  )
                )}
              </div>

              {status === "loading" && (
                <div role="status" className="fade-in absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <div className="mx-auto h-px w-24 animate-pulse bg-gradient-to-r from-transparent via-ember-300 to-transparent" />
                  <p className="micro mt-3">Loading the OMNI archive</p>
                </div>
              )}
              {status === "error" && (
                <div role="alert" className="glass pointer-events-auto absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 p-5 text-sm">
                  <div className="font-semibold text-rose-300">Could not load storm data</div>
                  <p className="mt-1 break-words text-stone-300">{error}</p>
                  <p className="mt-2 text-stone-400">
                    Expected static files under <code className="font-mono">web/public/data/</code>. Regenerate them with{" "}
                    <code className="font-mono">python -m dial_a_storm.pipeline</code> (or <code className="font-mono">python -m dial_a_storm.make_fixtures</code>) from{" "}
                    <code className="font-mono">pipeline/</code>.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse items-stretch gap-2 p-3 sm:flex-row sm:items-end sm:gap-3 sm:p-4">
              <TimelineDock />
              <div className="relative shrink-0 self-end">
                <TunePopover />
                <StormDial />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="pointer-events-auto">
              <ExplainerTab />
            </div>
            <div className="pointer-events-none fixed inset-x-0 top-0 z-30 bg-gradient-to-b from-ink via-ink/80 to-transparent">
              <TopBar />
            </div>
          </>
        )}
      </main>
      <GuidePanel />
      <Landing />
    </>
  );
}
