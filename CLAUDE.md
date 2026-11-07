# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Dial-a-Storm: replay the top 8 geomagnetic storms of 2010–2026, rescale the solar-wind drivers
(southward Bz, speed, density) with sliders, and watch an ML surrogate of SYM-H respond next to a
WebGL 2 scene. The full rules are in `.kiro/steering/tech.md`, and every JSON schema is in
`docs/CONTRACTS.md`. Read both before changing the model, the exports or the scene.

## Commands

Windows dev machine: in a venv, use `.venv\Scripts\python` (not `.venv/bin/python`).

```bash
# Python pipeline (run from data/; Python 3.11, also 3.12)
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/pytest                                        # causality suite (pytest.ini: pythonpath=., testpaths=tests)
.venv/Scripts/pytest tests/test_causality.py::test_gannon_holdout_outside_fit_splits   # single test
.venv/Scripts/python -m src.pipeline                        # tests -> load -> storms -> features -> model -> export
.venv/Scripts/python -m src.pipeline --out <dir>            # write artifacts elsewhere
.venv/Scripts/python -m src.pipeline --rebuild              # rebuild cached Parquet in data/cache/
.venv/Scripts/python -m src.make_fixtures                   # regenerate FIXTURE artifacts (Burton physics model)

# Web (run from web/)
npm install
npm run dev         # http://localhost:3000
npm run typecheck   # tsc --noEmit; there is no lint or JS test script
npm run build
```

**Raw data path.** `config.RAW_CSV` defaults to `<repo>/nasa_omni_solar_wind_storms_5min_2010-2026.csv`,
but the file is at `data/raw/`. Set `OMNI_CSV=data/raw/nasa_omni_solar_wind_storms_5min_2010-2026.csv`
(or move the file). The CSV is 138 MB and gitignored (`*.csv`). `WEB_DATA_DIR` overrides the output dir.

`src.pipeline` runs pytest first and refuses to export if it fails (`--skip-tests` bypasses this; avoid it).

## Architecture

Two halves joined by static JSON:

- **`data/` (offline Python)**: trains the model and precomputes everything into `web/public/data/`.
  Nothing in it runs at request time. `src/config.py` holds every constant that appears in an
  artifact (splits, grid axes, holdout, G-scale, schema version). `src/physics.py` is the only
  place for physics formulas.
- **`web/` (Next.js 14 App Router, client only)**: never runs Python or ML. `lib/data.ts` fetches
  `/data/*`, `lib/types.ts` validates it with Zod, and `lib/interpolate.ts` trilinearly blends the
  8 nearest scenario-grid nodes for each slider position. `lib/live.ts` mirrors the physics for
  per-frame display values. A single Zustand store (`lib/store.ts`) holds catalogue, active storm
  bundle, params and the interpolated trace. The R3F scene (`components/scene/`) reads it in
  `useFrame` via `useDialStore.getState()`; the HUD (`components/deck/`) subscribes with selectors.

**Artifacts** (`web/public/data/`): `manifest.json`, `storms.json`, `storm_windows/{id}.json`,
`scenario_grid/{id}.json` (8×6×6 multipliers × T samples, row-major, 15-min cadence). The committed
files are currently `source: "FIXTURE"`; running the pipeline replaces them with `PIPELINE` output.

**Contract rule:** any schema change updates the Python writer, `web/lib/types.ts` and
`docs/CONTRACTS.md` in the same commit; breaking changes bump `schema_version`.

## Non-negotiable data-science rules (enforced by `data/tests/test_causality.py`)

1. No future leakage: features at t use only data at ≤ t. Allowed: `.shift(k≥0)` and trailing
   `.rolling()`. Forbidden: centered windows, `bfill`, `shift(-k)`, interpolation from the right.
2. SYM-H, AE, AL, PCN and proton flux are responses and must never enter features.
   `features.build_features` projects onto `DRIVER_COLUMNS` first.
3. Gap fill only gaps of ≤ 30 min, causal forward fill only. Never impute the SYM-H target.
4. Splits: train 2010–2019, val 2020–2022, test 2023–2026. The Gannon storm (`storm_20240510`) is
   the hold-out and is never used for fitting, early stopping or tuning.
5. Model = Ridge on integrated coupling sums + XGBoost on Ridge residuals. Never ship pure XGBoost
   (it saturates at the training max).
6. Scenarios whose peak coupling exceeds the 2010–2019 max are flagged `in_range: false`, and the UI
   must show this.

## Web rules

- WebGL 2 via `@react-three/fiber` v8 + Three.js. WebGPU, `three/webgpu`, TSL and node materials are forbidden.
- Hand-written GLSL in `ShaderMaterial`; shared snippets in `web/lib/glsl.ts`. Single `Bloom` post effect; DPR clamped to `[1, 1.5]`.
- Never call React `setState` inside `useFrame`.
- All fetched JSON goes through the Zod schemas; no unchecked casts.
- Charts are hand-written SVG (no chart libraries). Tailwind; HUD panels use the `glass` utility in `app/globals.css`.
- `SpaceCanvas` is loaded with `dynamic(..., { ssr: false })`; WebGL must not render on the server.
