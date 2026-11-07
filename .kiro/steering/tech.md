# Dial-a-Storm: Engineering & Stack Rules

Dial-a-Storm lets users replay the top 8 geomagnetic storms of 2010–2026, rescale the solar-wind
drivers (southward Bz, speed, density), and watch an ML surrogate of SYM-H respond, next to a
WebGL 2 scene of the Sun, solar wind, magnetosphere and aurora.

## Architecture (two halves, one contract)

- `data/` is an offline Python 3.11+ pipeline. It trains the model, precomputes scenario grids and
  writes static JSON to `web/public/data/`. Nothing in `data/` runs at request time.
- `web/` is a Next.js 14 App Router client. It never runs Python or ML inference. It loads the
  static JSON, validates it with Zod, and trilinearly interpolates the scenario grid in the browser.
- `docs/CONTRACTS.md` is the single source of truth for every exported JSON file. Any schema change
  must update, in the same commit: the Python writer, `web/lib/types.ts`, and `docs/CONTRACTS.md`.
  Bump `schema_version` on breaking changes.

## Data science rules (non-negotiable)

1. **Zero future leakage.** A feature at time t may only use solar-wind observations at times <= t.
   Only `.shift(k)` with k >= 0 and trailing `.rolling()` windows are allowed. No centered windows,
   no `bfill`, no `shift(-k)`, no interpolation across a gap using the right-hand neighbour.
2. **Banned inputs.** SYM-H, AE, AL, PCN and >10 MeV proton flux are Earth responses. They must never
   enter the feature matrix. `features.build_features` projects onto `DRIVER_COLUMNS` before any
   computation; `tests/test_causality.py` enforces this.
3. **Gap imputation** fills only gaps of <= 30 min (6 samples), and only from the past (causal
   forward fill). Longer gaps stay NaN. The target (SYM-H) is never imputed.
4. **Temporal splits:** train 2010–2019, validate 2020–2022, test 2023–2026. The 10–11 May 2024
   Gannon storm is the held-out out-of-sample benchmark and must never be used for fitting,
   early stopping or hyper-parameter selection.
5. **Hybrid model:** Ridge backbone on integrated coupling sums (extrapolates linearly) + XGBoost on
   the Ridge residuals. Never ship pure XGBoost as the predictor; it saturates at the training max.
6. **Physics conventions** (all in `data/src/physics.py`, nowhere else):
   - `Bs = max(-Bz, 0)`; scenario Bz multiplier applies only where Bz < 0.
   - `Bt_new = sqrt(max(0, Bt^2 - Bz^2 + Bz_new^2))`.
   - `Pdyn = 1.6726e-6 * n * v^2` nPa; `Ey = c = v * Bs * 1e-3` mV/m.
7. Scenario points whose peak coupling exceeds the 2010–2019 maximum are flagged `in_range: false`.
   The UI must show this, never hide it.
8. Run `pytest` in `data/` before exporting. Tests must pass.

## Web rules

- Renderer: WebGL 2 through `@react-three/fiber` v8 + Three.js. **Forbidden:** WebGPU,
  `three/webgpu`, TSL, node materials.
- Shaders: hand-written GLSL in `THREE.ShaderMaterial` (or drei `shaderMaterial`). Shared GLSL
  lives in `web/lib/glsl.ts`.
- Post-processing: `@react-three/postprocessing` with a single `Bloom` effect. DPR clamped to
  `[1, 1.5]`.
- Per-frame values flow through `useFrame` + `useDialStore.getState()`. Do not call React
  `setState` inside `useFrame`.
- All fetched JSON is parsed through the Zod schemas in `web/lib/types.ts`. No unchecked casts.
- Charts are hand-written SVG. No chart libraries.
- Styling: Tailwind CSS. HUD panels use the `glass` utility from `app/globals.css`.
- State: one Zustand store in `web/lib/store.ts`.

## Commands

```bash
# Python pipeline (from data/)
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/pytest
.venv/bin/python -m src.pipeline                 # writes web/public/data/
.venv/bin/python -m src.make_fixtures            # regenerates the FIXTURE artifacts

# Web (from web/)
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```
