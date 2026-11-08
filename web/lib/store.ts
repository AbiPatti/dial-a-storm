/**
 * Single Zustand store for Dial-a-Storm.
 *
 * Holds: catalogue (manifest + storms), the active storm bundle (window + prepared grid), slider
 * multipliers, the interpolated what-if trace, and playback state. The 3D scene reads it every
 * frame through `useDialStore.getState()` (no React re-render); the HUD subscribes with selectors.
 */
import { create } from "zustand";
import { loadManifest, loadScenarioGrid, loadStormWindow, loadStorms } from "./data";
import { clampToAxis, prepareGrid, scenarioInRange, scenarioPeakCoupling, traceMinimum, trilinearTrace } from "./interpolate";
import { DEFAULT_PARAMS, type Manifest, type Params, type PreparedGrid, type StormRecord, type StormWindow } from "./types";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

/** Selectable objects in the 3D scene. */
export type SceneObject = "sun" | "earth" | "magnetopause" | "aurora";
/** Camera presets the rig can fly to. */
export type ViewId = "overview" | SceneObject;
/** Landing page: title screen, scroll transition into the scene, then the app. */
export type LandingPhase = "landing" | "entering" | "entered";
/** Level-3 panels (only one open at a time). */
export type PanelId = "storms" | "model" | "help";

export interface StormBundle {
  window: StormWindow;
  grid: PreparedGrid;
  /** Epoch milliseconds of sample 0. */
  t0Ms: number;
  /** Fractional sample indices of the storm interval (SYM-H < -50 nT) inside the window. */
  stormSpan: [number, number];
  peakIndex: number;
  observedMin: number;
}

export interface DialState {
  status: LoadStatus;
  error: string | null;
  manifest: Manifest | null;
  storms: StormRecord[];

  activeStormId: string | null;
  stormStatus: LoadStatus;
  bundle: StormBundle | null;

  params: Params;
  activeTrace: Float32Array | null;
  inRange: boolean;
  peakCoupling: number;
  tracePeak: { value: number; index: number } | null;

  cursor: number;
  playing: boolean;
  /** Wall-clock seconds to replay the whole window. */
  playbackSeconds: number;
  /** Incremented on every Simulate press, so UI can react to a new run. */
  simulationId: number;

  /** Scene interaction (UI-only state; the scene reads it in useFrame via getState()). */
  selected: SceneObject | null;
  hovered: SceneObject | null;
  /** Camera fly-to request; `nonce` changes on every request so repeats re-trigger. */
  focus: { view: ViewId; nonce: number };
  labels: boolean;
  panel: PanelId | null;
  landing: LandingPhase;

  init: () => Promise<void>;
  selectStorm: (id: string) => Promise<void>;
  setParam: (key: keyof Params, value: number) => void;
  resetParams: () => void;
  simulate: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (index: number) => void;
  tick: (dtSeconds: number) => void;
  setPlaybackSeconds: (s: number) => void;
  select: (o: SceneObject | null) => void;
  hover: (o: SceneObject | null) => void;
  focusOn: (v: ViewId) => void;
  toggleLabels: () => void;
  openPanel: (p: PanelId | null) => void;
  setLanding: (p: LandingPhase) => void;
  /** Move to the previous (-1) or next (+1) storm in the catalogue. */
  stepStorm: (dir: 1 | -1) => void;
}

const msOf = (iso: string) => Date.parse(iso);

function buildBundle(window: StormWindow, grid: PreparedGrid): StormBundle {
  const t0Ms = msOf(window.t0);
  const step = window.cadence_minutes * 60_000;
  const toIndex = (iso: string) => Math.min(window.n_times - 1, Math.max(0, (msOf(iso) - t0Ms) / step));
  let observedMin = Infinity;
  for (const v of window.series.sym_h_observed) if (v !== null && v < observedMin) observedMin = v;
  return {
    window,
    grid,
    t0Ms,
    stormSpan: [toIndex(window.storm_start), toIndex(window.storm_end)],
    peakIndex: toIndex(window.peak_time),
    observedMin: Number.isFinite(observedMin) ? observedMin : 0,
  };
}

/** Interpolate the what-if trace. Returns a fresh array so subscribers see a new reference. */
function computeScenario(grid: PreparedGrid, params: Params) {
  const trace = trilinearTrace(grid, params);
  return {
    activeTrace: trace,
    inRange: scenarioInRange(grid, params),
    peakCoupling: scenarioPeakCoupling(grid, params),
    tracePeak: traceMinimum(trace),
  };
}

let selectToken = 0;

export const useDialStore = create<DialState>()((set, get) => ({
  status: "idle",
  error: null,
  manifest: null,
  storms: [],

  activeStormId: null,
  stormStatus: "idle",
  bundle: null,

  params: { ...DEFAULT_PARAMS },
  activeTrace: null,
  inRange: true,
  peakCoupling: 0,
  tracePeak: null,

  cursor: 0,
  playing: false,
  playbackSeconds: 24,
  simulationId: 0,

  selected: null,
  hovered: null,
  focus: { view: "overview", nonce: 0 },
  labels: true,
  panel: null,
  landing: "landing",

  init: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading", error: null });
    try {
      const [manifest, storms] = await Promise.all([loadManifest(), loadStorms()]);
      set({ manifest, storms: storms.storms, status: "ready" });
      const preferred = storms.storms.find((s) => s.id === manifest.holdout.id) ?? storms.storms[0];
      await get().selectStorm(preferred.id);
    } catch (err) {
      set({ status: "error", error: (err as Error).message });
    }
  },

  selectStorm: async (id) => {
    const token = ++selectToken;
    set({ activeStormId: id, stormStatus: "loading", playing: false });
    try {
      const [window, rawGrid] = await Promise.all([loadStormWindow(id), loadScenarioGrid(id)]);
      if (token !== selectToken) return;
      if (rawGrid.n_times !== window.n_times || rawGrid.t0 !== window.t0) {
        throw new Error(`grid and window for ${id} are not aligned`);
      }
      const grid = prepareGrid(rawGrid);
      const bundle = buildBundle(window, grid);
      const params = get().params;
      set({
        bundle,
        stormStatus: "ready",
        // Open at the observed peak, so the scene shows the storm at full strength right away.
        cursor: bundle.peakIndex,
        ...computeScenario(grid, params),
      });
    } catch (err) {
      if (token !== selectToken) return;
      set({ stormStatus: "error", error: (err as Error).message });
    }
  },

  setParam: (key, value) => {
    const { bundle, params } = get();
    const axes = bundle?.grid.axes;
    const v = axes ? clampToAxis(axes[key], value) : value;
    const next = { ...params, [key]: v };
    if (!bundle) {
      set({ params: next });
      return;
    }
    set({ params: next, ...computeScenario(bundle.grid, next) });
  },

  resetParams: () => {
    const { bundle } = get();
    const next = { ...DEFAULT_PARAMS };
    set(bundle ? { params: next, ...computeScenario(bundle.grid, next) } : { params: next });
  },

  simulate: () => {
    if (!get().bundle) return;
    set((s) => ({ cursor: 0, playing: true, simulationId: s.simulationId + 1 }));
  },

  play: () => {
    const { bundle, cursor } = get();
    if (!bundle) return;
    const atEnd = cursor >= bundle.window.n_times - 1;
    set({ playing: true, cursor: atEnd ? 0 : cursor });
  },

  pause: () => set({ playing: false }),

  togglePlay: () => (get().playing ? get().pause() : get().play()),

  seek: (index) => {
    const { bundle } = get();
    if (!bundle) return;
    set({ cursor: Math.min(bundle.window.n_times - 1, Math.max(0, index)) });
  },

  tick: (dt) => {
    const { playing, bundle, cursor, playbackSeconds } = get();
    if (!playing || !bundle) return;
    const last = bundle.window.n_times - 1;
    const next = cursor + (dt * last) / playbackSeconds;
    if (next >= last) set({ cursor: last, playing: false });
    else set({ cursor: next });
  },

  setPlaybackSeconds: (s) => set({ playbackSeconds: Math.max(4, Math.min(120, s)) }),

  select: (o) => set({ selected: o }),
  hover: (o) => {
    if (get().hovered !== o) set({ hovered: o });
  },
  focusOn: (view) => set((s) => ({ focus: { view, nonce: s.focus.nonce + 1 } })),
  toggleLabels: () => set((s) => ({ labels: !s.labels })),
  openPanel: (p) => set({ panel: p }),
  setLanding: (p) => {
    if (get().landing !== p) set({ landing: p });
  },
  stepStorm: (dir) => {
    const { storms, activeStormId } = get();
    if (!storms.length) return;
    const i = storms.findIndex((s) => s.id === activeStormId);
    const next = storms[(Math.max(0, i) + dir + storms.length) % storms.length];
    void get().selectStorm(next.id);
  },
}));
