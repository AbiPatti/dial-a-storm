"use client";

import { COMPACT_M, LiveComparisonChart } from "@/components/deck/ComparisonChart";
import { formatUtc, liveFrame } from "@/lib/live";
import { phaseAt } from "@/lib/phases";
import { useDialStore } from "@/lib/store";
import { PauseIcon, PlayIcon, RestartIcon } from "./icons";

/**
 * Bottom dock: transport controls, the SYM-H timeline (observed vs what-if, scrubbable) and a
 * slider aligned to the chart's plot area so the thumb sits on the playback needle.
 */
export default function TimelineDock() {
  const bundle = useDialStore((s) => s.bundle);
  const trace = useDialStore((s) => s.activeTrace);
  const params = useDialStore((s) => s.params);
  const cursor = useDialStore((s) => s.cursor);
  const playing = useDialStore((s) => s.playing);
  const inRange = useDialStore((s) => s.inRange);
  const playbackSeconds = useDialStore((s) => s.playbackSeconds);
  const tracePeak = useDialStore((s) => s.tracePeak);
  const { togglePlay, seek, pause, setPlaybackSeconds } = useDialStore.getState();

  const f = liveFrame(bundle, trace, params, cursor);
  const n = bundle?.window.n_times ?? 1;
  const dialled = params.bz !== 1 || params.speed !== 1 || params.density !== 1;
  const phase = bundle && trace && tracePeak ? phaseAt(bundle, bundle.events, trace, tracePeak.index, cursor) : null;

  return (
    <section aria-label="Playback" className="glass pointer-events-auto min-w-0 flex-1 px-3 pb-2 pt-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!bundle}
          aria-label={playing ? "Pause" : "Play"}
          data-tip={playing ? "Pause  Space" : "Play  Space"}
          data-tip-pos="top"
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-void transition hover:bg-plasma-300 disabled:opacity-40"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" onClick={() => seek(0)} disabled={!bundle} aria-label="Restart" data-tip="Restart  Home" data-tip-pos="top" className="icon-btn shrink-0">
          <RestartIcon />
        </button>
        <div className="min-w-0 pl-1">
          <div className="truncate font-mono text-[12px] tabular-nums text-slate-100" aria-live="off">
            {f.ready ? formatUtc(f.timeMs, true) : "—"}
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
            {f.ready && (
              <>
                <span className="rounded px-1 font-mono text-[9.5px] font-semibold text-void" style={{ backgroundColor: f.tier.color }}>
                  {f.tier.display}
                </span>
                <span className="truncate">{f.tier.label}</span>
                {phase && <span className="truncate text-ember-300" data-testid="storm-phase">· {phase.label}</span>}
              </>
            )}
            {f.filled && <span className="text-alert-300">· solar-wind gap, last value held</span>}
          </div>
        </div>

        <ul className="ml-auto hidden items-center gap-3 text-[10.5px] text-slate-400 md:flex" aria-label="Chart legend">
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: inRange ? "#38bdf8" : "#fbbf24" }} />
            What-if{!inRange && " (extrapolated)"}
          </li>
          {dialled && (
            <li className="flex items-center gap-1.5">
              <span className="h-0 w-4 border-t border-dashed border-slate-400" />
              Model at 1×
            </li>
          )}
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-slate-200/50" />
            Observed
          </li>
        </ul>
        <label className="ml-auto flex shrink-0 items-center gap-1 text-[10.5px] text-slate-500 md:ml-2">
          <span className="sr-only sm:not-sr-only">Replay</span>
          <select
            value={playbackSeconds}
            onChange={(e) => setPlaybackSeconds(Number(e.target.value))}
            aria-label="Replay duration"
            className="rounded-md border border-white/10 bg-void/80 px-1 py-0.5 text-[11px] text-slate-200"
          >
            <option value={12}>12 s</option>
            <option value={24}>24 s</option>
            <option value={48}>48 s</option>
          </select>
        </label>
      </div>

      <div className="mt-1">
        <LiveComparisonChart height={84} compact />
      </div>
      <div style={{ paddingLeft: COMPACT_M.left - 8, paddingRight: Math.max(0, COMPACT_M.right - 8) }}>
        <input
          type="range"
          min={0}
          max={n - 1}
          step={0.25}
          value={cursor}
          disabled={!bundle}
          onChange={(e) => {
            pause();
            seek(Number(e.target.value));
          }}
          className="dial-range block w-full"
          style={{ ["--accent" as string]: "#e2e8f0", ["--fill" as string]: `${(cursor / Math.max(1, n - 1)) * 100}%` }}
          aria-label="Scrub playback time"
          aria-valuetext={f.ready ? formatUtc(f.timeMs) : undefined}
        />
      </div>
    </section>
  );
}
