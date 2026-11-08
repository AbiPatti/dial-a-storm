"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Progress } from "./StormCanvas";
import { prefersReducedMotion } from "@/lib/motion";
import { useDialStore } from "@/lib/store";

/**
 * Title screen. A full-screen solar-storm shader with the wordmark; scrolling (wheel, touch,
 * arrow keys, or the "Enter" cue) dives into the storm core and dissolves into the 3D scene,
 * whose camera flies in at the same moment.
 *
 * Scroll is virtual: input moves a target progress in [0, 1] and the displayed progress eases
 * toward it every frame (critically damped), so the motion stays smooth on any input device.
 * Releasing past 12 % completes the transition; releasing earlier springs back to the title.
 */

export const ENTERED_KEY = "dial-a-storm:entered";

// WebGL never renders on the server; the black backdrop shows until the shader is ready.
const StormCanvas = dynamic(() => import("./StormCanvas"), { ssr: false });

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export default function Landing() {
  const phase = useDialStore((s) => s.landing);
  const root = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const tagline = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLDivElement>(null);
  const cueButton = useRef<HTMLButtonElement>(null);
  // Once the storm has burned to black, drop its WebGL context: the black backdrop looks identical.
  const [burned, setBurned] = useState(false);
  const progress = useRef<Progress>({ target: 0, current: 0, dive: 0, fade: 0, mouse: { x: 0, y: 0 } });

  useEffect(() => {
    const { setLanding } = useDialStore.getState();
    if (document.documentElement.dataset.entered) {
      setLanding("entered");
      return;
    }
    const reduced = prefersReducedMotion();
    const p = progress.current;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let last = performance.now();
    let touchY: number | null = null;
    const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
    let detach = () => {};

    // Wall-clock time of the commit; guarantees completion even at very low frame rates.
    let committedAt: number | null = null;
    let committedFrom = 0;
    const commit = () => {
      if (committedAt === null) {
        committedAt = performance.now();
        committedFrom = p.current;
      }
      p.target = 1;
    };
    const nudge = (delta: number) => {
      p.target = Math.min(1, Math.max(0, p.target + delta));
      clearTimeout(idle);
      // On release: finish the transition once it is underway, otherwise spring back.
      idle = setTimeout(() => {
        if (p.target > 0.12) commit();
        else p.target = 0;
      }, 200);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (committedAt !== null) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      nudge(dy / (window.innerHeight * 1.4));
    };
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY === null || y === undefined) return;
      e.preventDefault();
      if (committedAt !== null) return;
      nudge((touchY - y) / (window.innerHeight * 0.8));
      touchY = y;
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", "Enter", " ", "End"].includes(e.key)) {
        e.preventDefault();
        commit();
      } else if (["ArrowUp", "PageUp", "Home"].includes(e.key) && committedAt === null) {
        e.preventDefault();
        p.target = 0;
      }
    };
    const onPointer = (e: PointerEvent) => {
      const m = Math.min(window.innerWidth, window.innerHeight);
      p.mouse.x = (e.clientX - window.innerWidth / 2) / m;
      p.mouse.y = (window.innerHeight / 2 - e.clientY) / m;
      parallax.tx = -(e.clientX / window.innerWidth - 0.5) * 24;
      parallax.ty = -(e.clientY / window.innerHeight - 0.5) * 16;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      // Exponential smoothing toward the target: quick to follow input, gentle to settle. Once
      // committed, a minimum speed guarantees the transition finishes even at low frame rates.
      const rate = committedAt !== null ? 2.2 : 5;
      let next = p.current + (p.target - p.current) * (1 - Math.exp(-rate * dt));
      if (committedAt !== null) {
        const floor = committedFrom + (1 - committedFrom) * ((now - committedAt) / 2600);
        next = Math.min(1, Math.max(next, floor));
      }
      p.current = committedAt !== null && 1 - next < 0.004 ? 1 : next;
      const x = p.current;
      // Choreography: dive into the flames (0-0.7), burn to black (0.55-0.88), reveal (0.8-1).
      p.dive = reduced ? 0 : easeInOut(Math.min(1, x / 0.75));
      p.fade = smooth(0.55, 0.88, x);
      parallax.x += (parallax.tx - parallax.x) * 0.06;
      parallax.y += (parallax.ty - parallax.y) * 0.06;

      const titleOut = smooth(0, 0.4, x);
      if (title.current) {
        title.current.style.opacity = String(1 - titleOut);
        title.current.style.transform = reduced
          ? ""
          : `translate3d(${parallax.x.toFixed(2)}px, ${(parallax.y - 40 * titleOut).toFixed(2)}px, 0) scale(${(1 + 0.45 * titleOut).toFixed(4)})`;
        title.current.style.filter = reduced ? "" : `blur(${(titleOut * 14).toFixed(2)}px)`;
      }
      if (tagline.current) {
        const k = smooth(0, 0.2, x);
        tagline.current.style.opacity = String(1 - k);
        tagline.current.style.transform = `translateY(${(k * 14).toFixed(2)}px)`;
      }
      if (cue.current) cue.current.style.opacity = String(1 - smooth(0, 0.1, x));
      if (root.current) {
        root.current.style.opacity = String(1 - smooth(0.8, 1, x));
        root.current.style.pointerEvents = x > 0.9 ? "none" : "";
      }

      // Wake the 3D scene just before it shows through, so it is not rendered while hidden.
      if (x > 0.72) setLanding("entering");
      if (x > 0.9) setBurned(true);
      if (x >= 1) {
        try {
          window.sessionStorage.setItem(ENTERED_KEY, "1");
        } catch {
          /* storage unavailable: the landing shows again on reload */
        }
        setLanding("entered");
        detach();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onPointer, { passive: true });
    const cueEl = cueButton.current;
    cueEl?.addEventListener("click", commit);
    // Landing stays mounted (it renders null once entered), so the window listeners must come off
    // as soon as the dive completes. Otherwise their preventDefault keeps blocking wheel and touch
    // scrolling (the Explainer tab) and Space / Enter / arrow keys for the rest of the session.
    detach = () => {
      clearTimeout(idle);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onPointer);
      cueEl?.removeEventListener("click", commit);
    };
    return () => {
      cancelAnimationFrame(raf);
      detach();
    };
  }, []);

  if (phase === "entered") return null;

  return (
    <div ref={root} className="landing fixed inset-0 z-50 select-none overflow-hidden bg-black" role="region" aria-label="Welcome">
      {!burned && <StormCanvas progress={progress} />}

      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <span className="solar-particle left-[22%] top-[26%] h-1.5 w-1.5 bg-[#ffe066]/90 shadow-[0_0_14px_#ffe066]" />
        <span className="solar-particle left-[30%] top-[68%] h-1 w-1 bg-[#ff7700]/90 shadow-[0_0_12px_#ff7700]" style={{ animationDelay: "-3s" }} />
        <span className="solar-particle right-[20%] top-[32%] h-2 w-2 bg-white/75 shadow-[0_0_16px_#fff]" style={{ animationDelay: "-5s" }} />
        <span className="solar-particle right-[26%] top-[74%] h-1 w-1 bg-[#ffa726]/85 shadow-[0_0_10px_#ffa726]" style={{ animationDelay: "-2s" }} />
      </div>

      <div className="pointer-events-none relative flex h-full flex-col items-center justify-center px-6 text-center">
        <div ref={title} className="relative will-change-transform">
          {/* Readability scrim: lives with the title so it fades out with it during the dive. */}
          <div
            className="absolute left-1/2 top-1/2 -z-10 h-[260px] w-[min(90vw,620px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40 blur-3xl"
            aria-hidden="true"
          />
          <h1 className="solar-title title-entrance font-display font-black uppercase">Dial-a-Storm</h1>
        </div>
        <div ref={tagline} className="relative mt-6">
          <p className="landing-fade max-w-md text-[13px] leading-relaxed tracking-wide text-amber-50/75 sm:text-[15px]">
            Rewind the biggest geomagnetic storms of 2010–2026. Turn up the Sun. Watch Earth respond.
          </p>
        </div>
      </div>

      <div ref={cue} className="absolute inset-x-0 bottom-8 flex justify-center">
        <button
          ref={cueButton}
          type="button"
          className="landing-cue flex flex-col items-center gap-3 rounded-full px-4 py-2 text-[10.5px] font-medium uppercase tracking-[0.32em] text-amber-50/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
          aria-label="Enter Dial-a-Storm"
        >
          Scroll to enter
          <span className="relative block h-10 w-px overflow-hidden bg-amber-50/15" aria-hidden="true">
            <span className="cue-dot absolute left-0 top-0 block h-3 w-px bg-amber-100" />
          </span>
        </button>
      </div>
    </div>
  );
}
