# AGENTS.md

Shared instructions for every AI coding assistant working in this repo (Kiro, Claude Code, Codex,
Cursor and others). This is the single source of truth: tool-specific files only point here.

| Tool | How it gets these instructions |
|---|---|
| Kiro | Reads this file automatically; `.kiro/steering/project.md` adds `docs/ENGINEERING.md`. |
| Claude Code | `CLAUDE.md` imports this file and `docs/ENGINEERING.md`. |
| Others | Read this file, then `docs/ENGINEERING.md`. |

Put shared guidance in this file. Keep tool-specific files as thin pointers so they cannot drift.

## Project

Dial-a-Storm (Sheridan Datathon 2026, NASA track) replays the top 8 geomagnetic storms of
2010–2026. Users rescale the solar-wind drivers (southward Bz, speed, density) with sliders and
watch an ML surrogate of the SYM-H index respond, next to a WebGL 2 scene.

## Documents to read

| File | Contents | Read before |
|---|---|---|
| `docs/ENGINEERING.md` | Non-negotiable modelling, leakage and web-stack rules | Any change |
| `docs/CONTRACTS.md` | Exact schema of every JSON file in `web/public/data/` | Changing an exporter, `web/lib/types.ts` or anything that reads the data |
| `SETUP.md` | Human setup guide, clone to running | Helping someone install or run the project |
| `.claude/skills/verify-site/SKILL.md` | Step-by-step verification checklist (pytest, typecheck, Playwright, screenshots) | Reporting any change as done. It is written as a Claude Code skill, but every tool should follow the same steps. |

## Layout

```
pipeline/                 Offline Python 3.11/3.12 (run everything from this folder)
  dial_a_storm/           Package: config, physics, load, storms, features, model, export_grid,
                          make_fixtures, pipeline (`python -m dial_a_storm` = full run)
  tests/test_causality.py Leakage / contamination tests (17)
  data/                   NOT IN GIT: raw/ (CSV), cache/ (Parquet, trained models)
web/                      Next.js 14 App Router, client-only
  app/                    page.tsx (landing + two tabs: Simulator, Explainer), layout.tsx (next/font:
                          Inter, JetBrains Mono, Instrument Serif, self-hosted Orbitron), globals.css
  components/landing/     Landing (title screen, scroll-driven dive into the app), StormCanvas (shader)
  components/scene/       R3F scene (the Simulator tab): SpaceCanvas, Sun, Earth (textured),
                          SolarWindParticles (streaks, cusp capture, no pinch-back), ImfLines,
                          Magnetopause (shell + GEO ring), ReconnectionFlash, FieldLines, RingCurrent,
                          AuroraRing, SceneLabels, SelectionHalo, CameraRig (orbit + fly-to), pick.ts
  components/hud/         TopBar (storm picker + tabs + toolbar), Headline (narration, storm phase,
                          HistoryRuler), StormDial (one knob; fine-tune and dock behind a menu),
                          Impacts (consequences), TunePopover wrapping DialPanel (fine-tune
                          sliders), TimelineDock,
                          InfoPanel (selected object), GuidePanel
  components/explainer/   ExplainerTab (physics chain, method, hold-out, catalogue, honest notes)
  components/deck/        ComparisonChart (SVG, with shock / peak markers)
  components/ui/          HoldoutSection (Gannon hold-out results, shown in the Explainer tab)
  e2e/site.spec.ts        Playwright browser tests (playwright.config.ts serves the build on :3100)
  lib/                    types.ts (Zod), data.ts (fetch), store.ts (Zustand), interpolate.ts,
                          live.ts (per-frame physics), phases.ts (shock / main / recovery),
                          severity.ts, glsl.ts, usePlayback.ts,
                          useShortcuts.ts (keyboard), motion.ts (reduced motion)
  public/data/            Committed JSON artifacts (source "PIPELINE": Ridge + XGBoost hybrid output)
docs/                     CONTRACTS.md, ENGINEERING.md
```

## Not in the repo: create these locally

| Item | Where | How |
|---|---|---|
| NASA OMNI CSV (138 MB) | `pipeline/data/raw/nasa_omni_solar_wind_storms_5min_2010-2026.csv` | Get it from a teammate. Too big for GitHub. `OMNI_CSV` overrides the path. |
| Python virtualenv | `pipeline/.venv/` | `python -m venv .venv`, then `pip install -r requirements.txt` |
| Pipeline caches and models | `pipeline/data/cache/` | Created by the pipeline |
| Node modules | `web/node_modules/` | `npm install` in `web/` |
| Playwright browser | Playwright's user cache | `npx playwright install chromium` in `web/`, once per machine |

All of these are gitignored. Never commit them, and never commit `.env` files or secrets.

## Commands

The virtualenv path is `.venv/bin/` on macOS/Linux and `.venv\Scripts\` on Windows.

```bash
# pipeline/  (Python 3.11 or 3.12; 3.14 has no wheels for the pinned pandas/numpy)
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/pytest                                    # must print "17 passed"
.venv/bin/python -m dial_a_storm                    # tests -> load -> storms -> features -> model -> export
.venv/bin/python -m dial_a_storm.pipeline --out DIR # write artifacts elsewhere (keeps committed files intact)
.venv/bin/python -m dial_a_storm.pipeline --rebuild # rebuild cached Parquet
.venv/bin/python -m dial_a_storm.make_fixtures      # FIXTURE stand-in (physics model); overwrites web/public/data

# web/
npm install
npm run dev         # http://localhost:3000
npm run typecheck   # tsc --noEmit (there is no lint script)
npm run build
npm run test:e2e    # Playwright: builds, serves on :3100, tests in headless Chromium
npx playwright test -g "playback"   # one e2e test
```

## Hard rules (summary; `docs/ENGINEERING.md` is authoritative)

1. No future leakage: features at time t use only data at or before t. No `bfill`, `shift(-k)` or
   centered windows.
2. SYM-H, AE, AL, PCN and proton flux are responses. They never enter the feature matrix.
3. Splits: train 2010–2019, validate 2020–2022, test 2023–2026. The Gannon storm
   (`storm_20240510`) is never used for fitting, early stopping or tuning.
4. The model is a Ridge backbone plus XGBoost on its residuals. Never ship pure XGBoost.
5. Physics formulas live only in `pipeline/dial_a_storm/physics.py` (mirrored for display in
   `web/lib/live.ts`).
6. Web: WebGL 2 via R3F v8 and Three.js only. No WebGPU, TSL or node materials. Hand-written GLSL,
   a single Bloom pass, DPR clamped to [1, 1.5], no React `setState` inside `useFrame`.
7. A schema change updates the Python writer, `web/lib/types.ts` and `docs/CONTRACTS.md` in the
   same commit.

## Before you finish a change

- Pipeline change: `.venv/bin/pytest` passes. If you touched modelling, run the full pipeline with
  `--out` to a temporary directory and compare the Gannon line in the log against the known
  baseline: hybrid -378.7, ridge -357.7, xgb_only -156.0 nT (observed -497).
- Web change: `npm run typecheck` and `npm run test:e2e` both pass (the e2e run includes a
  production build). New user-visible behaviour gets a test in `web/e2e/`.
- Follow `.claude/skills/verify-site/SKILL.md` for the full checklist, and report which steps ran.
- `web/public/data/`: the committed files are real pipeline output. Re-running the full pipeline on
  the same CSV should reproduce the model (check the Gannon line above); `make_fixtures` replaces
  them with the physics stand-in. Never commit FIXTURE data, and don't commit regenerated artifacts
  unless the team asked for it. Restore them with `git checkout -- web/public/data`.
