"use client";

import { useEffect, useRef, useState } from "react";
import { useDialStore } from "@/lib/store";
import { SHORTCUTS } from "@/lib/useShortcuts";
import { CloseIcon } from "./icons";

/** Three-step introduction (opens on the first visit, and from the ? button), plus shortcuts. */

export const GUIDE_SEEN_KEY = "dial-a-storm:guide-seen";

export function guideSeen(): boolean {
  try {
    return window.localStorage.getItem(GUIDE_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(GUIDE_SEEN_KEY, "1");
  } catch {
    /* storage unavailable (private mode): the guide simply shows again next time */
  }
}

/**
 * The demo centrepiece: the 2024 Gannon storm (never seen in training) with the storm knob at
 * ×3, replayed from the start with the magnetopause in focus.
 */
async function runSuperstormDemo() {
  const s = useDialStore.getState();
  const id = s.manifest?.holdout.id ?? s.storms[0]?.id;
  if (!id) return;
  s.openPanel(null);
  if (s.activeStormId !== id || !s.bundle) await s.selectStorm(id);
  const st = useDialStore.getState();
  const axes = st.bundle?.grid.axes;
  if (!axes) return;
  st.setIntensity(axes.bz[axes.bz.length - 1]);
  st.select("magnetopause");
  st.focusOn("magnetopause");
  st.simulate();
}

export default function GuidePanel() {
  const open = useDialStore((s) => s.panel === "help");
  const fixture = useDialStore((s) => s.manifest?.model.kind === "burton_fixture");
  const stormName = useDialStore((s) => s.storms.find((x) => x.id === s.activeStormId)?.name ?? "a historic storm");
  const holdoutName = useDialStore((s) => s.manifest?.holdout.name ?? "Gannon storm");
  const [step, setStep] = useState(0);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) setStep(0);
    else if (wasOpen.current) markSeen();
    wasOpen.current = open;
  }, [open]);

  if (!open) return null;
  const close = () => useDialStore.getState().openPanel(null);

  const steps = [
    {
      title: "A real storm, replayed",
      body: (
        <>
          You are watching the <b className="font-medium text-white">{stormName}</b>, rebuilt from NASA OMNI solar-wind measurements. Particles stream
          from the Sun, bend around Earth&apos;s magnetic shield (the glowing <i>magnetopause</i>) and pass the dotted ring of geostationary satellites.
        </>
      ),
    },
    {
      title: "What if the Sun hit harder?",
      body: (
        <>
          The knob (bottom right) turns up the real solar wind; <i>Fine-tune</i> opens the three drivers separately.{" "}
          {fixture
            ? "A physics model (FIXTURE stand-in until the ML pipeline runs) predicts how hard the storm hits Earth (SYM-H)."
            : "A machine-learning model trained on 2010–2019 predicts how hard the storm hits Earth (SYM-H)."}{" "}
          Southward field opens the shield: watch the reconnection flash at its nose, particles pour into the polar cusps, the shield shrink inside
          the satellite ring and the aurora spread toward the equator. Faint ghost outlines show what really happened. The Explainer tab walks
          through the physics.
        </>
      ),
    },
    {
      title: "Explore",
      body: (
        <ul className="space-y-1">
          <li>
            <b className="font-medium text-white">Drag</b> to orbit, <b className="font-medium text-white">scroll</b> to zoom.
          </li>
          <li>
            <b className="font-medium text-white">Click</b> a label or object for details, <b className="font-medium text-white">double-click</b> to fly
            there.
          </li>
          <li>
            <kbd>Space</kbd> plays the storm, <kbd>←</kbd> <kbd>→</kbd> step through it.
          </li>
        </ul>
      ),
    },
  ];
  const last = step === steps.length - 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 grid place-items-center p-3">
      <div role="dialog" aria-label="Guide" className="glass glass-solid panel-in pointer-events-auto w-[min(calc(100vw-24px),420px)] p-5">
        <div className="flex items-start justify-between">
          <p className="eyebrow !text-plasma-300">
            Guide · {step + 1} / {steps.length}
          </p>
          <button type="button" className="icon-btn -mr-2 -mt-2" aria-label="Close guide" onClick={close}>
            <CloseIcon />
          </button>
        </div>
        <h2 className="mt-1 text-lg font-semibold text-white">{steps[step].title}</h2>
        <div className="mt-2 text-[13px] leading-relaxed text-slate-300">{steps[step].body}</div>

        {last && (
          <details className="mt-3 text-[12px] text-slate-400">
            <summary className="cursor-pointer hover:text-slate-200">All keyboard shortcuts</summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
              {SHORTCUTS.map((s) => (
                <div key={s.label} className="contents">
                  <dt className="flex gap-1">
                    {s.keys.map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}
                  </dt>
                  <dd>{s.label}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}

        <div className="mt-5 flex items-center gap-2">
          <div className="flex gap-1" aria-hidden="true">
            {steps.map((_, i) => (
              <span key={i} className={`h-1 rounded-full transition-all ${i === step ? "w-4 bg-plasma-300" : "w-1.5 bg-white/20"}`} />
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            {step > 0 ? (
              <button type="button" className="chip" onClick={() => setStep(step - 1)}>
                Back
              </button>
            ) : (
              <button type="button" className="chip" onClick={close}>
                Skip
              </button>
            )}
            {last ? (
              <>
                <button type="button" className="chip" onClick={close}>
                  Explore freely
                </button>
                <button
                  type="button"
                  className="rounded-full bg-plasma-300 px-3 py-1 text-[12px] font-semibold text-void transition hover:bg-white"
                  onClick={() => void runSuperstormDemo()}
                  title={`${holdoutName}, storm knob at ×3, replayed from the start`}
                >
                  Try the superstorm what-if
                </button>
              </>
            ) : (
              <button
                type="button"
                className="rounded-full bg-plasma-300 px-3 py-1 text-[12px] font-semibold text-void transition hover:bg-white"
                onClick={() => setStep(step + 1)}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
