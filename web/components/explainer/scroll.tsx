"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * Scroll-driven motion for the Explainer, in the style of Apple's product pages: native scrolling
 * drives the animation (no scroll hijacking). Progress is written straight to CSS custom properties
 * on the element, so scrolling never causes a React render; the CSS in globals.css (`.x-*`) turns
 * those numbers into transforms and opacity, and goes static under prefers-reduced-motion.
 */

/** The Explainer's scroll container (the tab panel scrolls, not the window). */
export const ScrollerContext = createContext<RefObject<HTMLElement> | null>(null);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Writes scroll progress (0..1) to a CSS variable on `target`.
 * - "track":   a tall section with a sticky child; 0 when its top reaches the top of the
 *              viewport, 1 when its bottom reaches the bottom (the pinned stretch).
 * - "through": 0 when the element's top enters at the bottom, 1 when its bottom leaves the top.
 */
export function useScrollVar(target: RefObject<HTMLElement>, mode: "track" | "through", name = "--p") {
  const scroller = useContext(ScrollerContext);
  useEffect(() => {
    const root = scroller?.current;
    const el = target.current;
    if (!root || !el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = root.clientHeight;
      const r = el.getBoundingClientRect();
      const top = r.top - root.getBoundingClientRect().top;
      const p = mode === "track" ? -top / Math.max(1, r.height - vh) : (vh - top) / (vh + r.height);
      el.style.setProperty(name, clamp01(p).toFixed(4));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    root.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [scroller, target, mode, name]);
}

/** Calls `onEnter` once, the first time the element scrolls into view. */
export function useInView(target: RefObject<HTMLElement>, onEnter: (el: HTMLElement) => void, threshold = 0.15) {
  const scroller = useContext(ScrollerContext);
  const cb = useRef(onEnter);
  cb.current = onEnter;
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            cb.current(e.target as HTMLElement);
            io.disconnect();
          }
        }
      },
      { root: scroller?.current ?? null, threshold, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scroller, target, threshold]);
}

/** Fades and rises its content into place the first time it scrolls into view. */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className = "",
  style,
  children,
  ...rest
}: {
  as?: ElementType;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  id?: string;
  "aria-labelledby"?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useInView(ref, (el) => el.setAttribute("data-in", ""));
  return (
    <Tag ref={ref} className={`x-reveal ${className}`} style={{ ...style, transitionDelay: delay ? `${delay}ms` : undefined }} {...rest}>
      {children}
    </Tag>
  );
}
