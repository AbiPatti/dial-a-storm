# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Dial-a-Storm: replay the top 8 geomagnetic storms of 2010–2026, rescale the solar-wind drivers
(southward Bz, speed, density) with sliders, and watch an ML surrogate of SYM-H respond next to a
WebGL 2 scene. The full rules are in `docs/ENGINEERING.md`, and every JSON schema is in
`docs/CONTRACTS.md`. Read both before changing the model, the exports or the scene.

## Commands

Windows dev machine: venv binaries are in `.venv/Scripts/` (not `.venv/bin/`).

```bash
# Python pipeline (run from pipeline/; Python 3.11 or 3.12)
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/pytest                                        # causality suite
.venv/Scripts/pytest tests/test_causality.py::test_gannon_holdout_outside_fit_splits   # single test
.venv/Scripts/python -m dial_a_storm                        # tests -> load -> storms -> features -> model -> export
.venv/Scripts/python -m dial_a_storm.pipeline --out <dir>   # write artifacts elsewhere
.venv/Scripts/python -m dial_a_storm.pipeline --rebuild     # rebuild cached Parquet
.venv/Scripts/python -m dial_a_storm.make_fixtures          # regenerate FIXTURE artifacts (Burton physics model)

# Web (run from web/)
npm install
npm run dev         # http://localhost:3000
npm run typecheck   # tsc --noEmit; there is no lint or JS test script
npm run build
```

Local data lives in `pipeline/data/` (gitignored): `raw/` holds the 138 MB OMNI CSV (`OMNI_CSV`
overrides the path), and `cache/` holds Parquet files and trained models. `WEB_DATA_DIR` overrides
the export dir. The pipeline runs pytest first and refuses to export on failure (`--skip-tests` bypasses this; avoid it).

## Architecture

Two halves joined by static JSON:

- **`pipeline/dial_a_storm/` (offline Python)**: trains the model and precomputes everything into
  `web/public/data/`. Nothing here runs at request time. `config.py` holds every constant that
  appears in an artifact (paths, splits, grid axes, holdout, G-scale, schema version). `physics.py`
  is the only place for physics formulas.
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

## Non-negotiable data-science rules (enforced by `pipeline/tests/test_causality.py`)

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
