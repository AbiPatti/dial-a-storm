"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { formatDate } from "@/lib/live";
import { tierById } from "@/lib/severity";
import { useDialStore, type TabId } from "@/lib/store";
import { ArrowIcon, ChevronIcon, FitIcon, HelpIcon, LabelIcon } from "./icons";

function SourceBadge() {
  const manifest = useDialStore((s) => s.manifest);
  if (!manifest) return null;
  const fixture = manifest.source === "FIXTURE";
  return (
    <span className={`micro ${fixture ? "!text-ember-300" : "!text-mint-300"}`} title={manifest.model.description}>
      {fixture ? "FIXTURE DATA" : "PIPELINE"}
    </span>
  );
}

/** Popover listing the 8 storms. Closes on selection, Esc or a click outside. */
function StormPicker({ anchor }: { anchor: React.RefObject<HTMLElement> }) {
  const storms = useDialStore((s) => s.storms);
  const activeId = useDialStore((s) => s.activeStormId);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return;
      useDialStore.getState().openPanel(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [anchor]);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus();
  }, []);

  return (
    <div ref={ref} role="dialog" aria-label="Storm catalogue" className="glass glass-solid panel-in absolute left-0 top-[calc(100%+8px)] w-[min(calc(100vw-24px),380px)] p-1.5">
      <div className="flex items-baseline justify-between px-2.5 pb-1.5 pt-1.5">
        <span className="eyebrow">Top 8 storms · 2010–2026</span>
        <span className="text-[10.5px] text-slate-500">
          <kbd>[</kbd> <kbd>]</kbd> to step
        </span>
      </div>
      <ul className="space-y-0.5">
        {storms.map((s) => {
          const active = s.id === activeId;
          const tier = tierById(s.g_tier);
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => {
                  const st = useDialStore.getState();
                  void st.selectStorm(s.id);
                  st.openPanel(null);
                }}
                className={`flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors ${active ? "bg-plasma-300/10" : "hover:bg-white/[0.05]"}`}
              >
                <span className="w-3 text-center font-mono text-[10px] text-slate-500">{s.rank}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[13px] ${active ? "text-white" : "text-slate-200"}`}>{s.name}</span>
                  <span className="block text-[11px] text-slate-500">
                    {formatDate(s.peak_time)} · {s.split === "train" ? "training era" : s.split === "val" ? "validation" : "test era"}
                    {s.holdout && <span className="ml-1.5 rounded bg-rose-500/15 px-1 py-px font-mono text-[9.5px] text-rose-300">HOLD-OUT</span>}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-[12px] tabular-nums" style={{ color: tier.color }}>
                    {s.peak_sym_h.toFixed(0)} nT
                  </span>
                  <span className="block font-mono text-[9.5px] text-slate-500">{tier.display}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const TABS: { id: TabId; label: string }[] = [
  { id: "simulator", label: "Simulator" },
  { id: "explainer", label: "Explainer" },
];

/** Two top-level tabs (WAI-ARIA tabs pattern: arrow keys move between them). */
function TabSwitch() {
  const tab = useDialStore((s) => s.tab);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    e.stopPropagation();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length];
    useDialStore.getState().setTab(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };
  return (
    <div role="tablist" aria-label="Sections" onKeyDown={onKey} className="pointer-events-auto glass order-last flex w-full shrink-0 items-center justify-center gap-0.5 p-1 sm:order-none sm:w-auto">
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={`${t.id}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => useDialStore.getState().setTab(t.id)}
            className={`rounded-[10px] px-3 py-1.5 text-[13px] transition-colors ${active ? "bg-white/[0.09] text-stone-100" : "text-stone-400 hover:text-stone-200"}`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default function TopBar() {
  const storms = useDialStore((s) => s.storms);
  const activeId = useDialStore((s) => s.activeStormId);
  const stormStatus = useDialStore((s) => s.stormStatus);
  const panel = useDialStore((s) => s.panel);
  const labels = useDialStore((s) => s.labels);
  const tab = useDialStore((s) => s.tab);
  const chipRef = useRef<HTMLDivElement>(null);
  const storm = storms.find((s) => s.id === activeId) ?? null;
  const st = useDialStore.getState;

  return (
    <header className="pointer-events-none flex flex-wrap items-start justify-between gap-2 p-3 sm:flex-nowrap sm:gap-3 sm:p-4">
      <div className="pointer-events-auto glass flex min-w-0 items-center gap-1 p-1 sm:pl-3.5">
        <div className="sr-only sm:not-sr-only sm:flex sm:shrink-0 sm:items-center sm:gap-2 sm:pr-2">
          <h1 className="font-serif text-[22px] leading-none tracking-tight text-stone-100">
            Dial<span className="italic text-ember-400">-a-</span>Storm
          </h1>
          <SourceBadge />
        </div>
        <div className="hidden h-5 w-px shrink-0 bg-white/10 sm:block" aria-hidden="true" />
        <div ref={chipRef} className="relative flex min-w-0 items-center">
          <button
            type="button"
            className="icon-btn !h-8 !w-7 shrink-0"
            onClick={() => st().stepStorm(-1)}
            disabled={!storms.length}
            aria-label="Previous storm"
            data-tip="Previous storm  ["
          >
            <ArrowIcon dir="left" />
          </button>
          <button
            type="button"
            onClick={() => st().openPanel(panel === "storms" ? null : "storms")}
            aria-expanded={panel === "storms"}
            aria-haspopup="dialog"
            aria-label={storm ? `Storm: ${storm.name}. Change storm` : "Choose a storm"}
            className="flex min-w-0 items-center gap-2 rounded-[10px] px-2 py-1 text-left transition-colors hover:bg-white/[0.06]"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium leading-tight text-slate-100">{storm?.name ?? "Loading storms…"}</span>
              <span className="block truncate text-[10.5px] leading-tight text-slate-500">
                {storm ? `${formatDate(storm.peak_time)} · #${storm.rank} of ${storms.length}` : " "}
                {storm?.holdout && <span className="ml-1.5 font-mono text-[9.5px] text-rose-300">HOLD-OUT</span>}
                {stormStatus === "loading" && <span className="ml-1.5 text-plasma-300">loading…</span>}
                {stormStatus === "error" && (
                  <span role="alert" className="ml-1.5 text-rose-300">
                    could not load this storm
                  </span>
                )}
              </span>
            </span>
            <span className="shrink-0 text-slate-400">
              <ChevronIcon open={panel === "storms"} />
            </span>
          </button>
          <button
            type="button"
            className="icon-btn !h-8 !w-7 shrink-0"
            onClick={() => st().stepStorm(1)}
            disabled={!storms.length}
            aria-label="Next storm"
            data-tip="Next storm  ]"
          >
            <ArrowIcon dir="right" />
          </button>
          {panel === "storms" && <StormPicker anchor={chipRef} />}
        </div>
      </div>

      <TabSwitch />

      <nav aria-label="View" className="pointer-events-auto glass flex shrink-0 items-center gap-0.5 p-1">
        {tab === "simulator" && (
          <>
            <button type="button" className="icon-btn" aria-label="Fit whole scene" data-tip="Fit scene  0" data-tip-pos="left" onClick={() => st().focusOn("overview")}>
              <FitIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Labels"
              aria-pressed={labels}
              data-tip="Labels  L"
              data-tip-pos="left"
              onClick={() => st().toggleLabels()}
            >
              <LabelIcon />
            </button>
          </>
        )}
        <button
          type="button"
          className="icon-btn"
          aria-label="Help"
          aria-expanded={panel === "help"}
          data-tip="Guide & shortcuts  ?"
          data-tip-pos="left"
          onClick={() => st().openPanel(panel === "help" ? null : "help")}
        >
          <HelpIcon />
        </button>
      </nav>
    </header>
  );
}
