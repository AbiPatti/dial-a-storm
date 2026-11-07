# Dial-a-Storm

Replay the eight strongest geomagnetic storms of 2010–2026, scale the solar wind that drove them
(southward Bz, speed, density), and see how a machine-learning model of the SYM-H index responds.
A WebGL scene of the Sun, solar wind, magnetosphere and aurora runs alongside the charts.

Built for the Sheridan Datathon 2026.

## Repository layout

```
pipeline/   Offline Python: loads NASA OMNI data, finds storms, trains the model, exports JSON
web/        Next.js app: loads the exported JSON and interpolates scenarios in the browser
docs/       CONTRACTS.md (JSON schemas) and ENGINEERING.md (modelling and stack rules)
```

The two halves only talk through the static files in `web/public/data/`. The web app never runs
Python or model inference.

## Getting started

For the full step-by-step guide (prerequisites, Windows and macOS commands, getting the data file,
troubleshooting), see [SETUP.md](SETUP.md). The short version:

### Web app

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

The repo ships with stand-in data (marked `FIXTURE` in the UI), so the app runs without Python or
the dataset.

Browser tests (Playwright) build the site and check data loading, storm selection, the sliders and
playback. Run `npx playwright install chromium` once, then:

```bash
npm run test:e2e
```

### Pipeline

Requires Python 3.11 or 3.12. Put the NASA OMNI CSV at
`pipeline/data/raw/nasa_omni_solar_wind_storms_5min_2010-2026.csv` (or set `OMNI_CSV`). It is too
large for GitHub and is gitignored.

```bash
cd pipeline
python -m venv .venv
.venv/bin/pip install -r requirements.txt   # Windows: .venv\Scripts\pip
.venv/bin/pytest                             # causality / leakage tests
.venv/bin/python -m dial_a_storm             # runs tests, then rebuilds web/public/data/
```

Other entry points: `python -m dial_a_storm.make_fixtures` regenerates the stand-in data, and each
stage (`load`, `storms`, `features`, `model`, `export_grid`) can be run on its own with `python -m dial_a_storm.<stage>`.

## Model in one paragraph

Features are built only from upstream solar-wind drivers, using lags and trailing integrals so no
feature can see the future. A Ridge regression on integrated coupling gives a backbone that keeps
scaling for storms bigger than anything in training, and XGBoost corrects its residuals. It trains
on 2010–2019, is tuned on 2020–2022 and tested on 2023–2026. The May 2024 Gannon superstorm is held
out entirely as the benchmark. See `docs/ENGINEERING.md` for the full rules.
