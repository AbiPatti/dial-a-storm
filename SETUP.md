# Setup Guide: from clone to running app

This guide takes you from a fresh clone to the running app, and then to rebuilding the model data
yourself. Part 1 is all you need to see the app. Part 2 is only for retraining the model.

- **Part 1 (web app):** about 5 minutes. Needs Node.js only. Uses the stand-in data that ships
  with the repo.
- **Part 2 (ML pipeline):** about 10 minutes. Needs Python and the 138 MB NASA OMNI CSV. Replaces
  the stand-in data with real model output.

## Prerequisites

| Tool | Version | Needed for | Check with |
|---|---|---|---|
| Git | any recent | cloning | `git --version` |
| Node.js | 18.17 or newer (LTS recommended) | web app | `node --version` |
| npm | comes with Node | web app | `npm --version` |
| Python | **3.11 or 3.12** | pipeline only | `python3 --version` (Windows: `py --version`) |
| A browser with WebGL 2 | recent Chrome, Edge, Firefox or Safari | viewing the 3D scene | visit https://get.webgl.org/webgl2/ |

Python 3.13 may work but is untested. Python 3.14 will not work, because the pinned pandas and
numpy versions have no 3.14 builds.

**macOS only:** XGBoost needs the OpenMP runtime. Install it once with `brew install libomp`.

## 0. Clone

```bash
git clone https://github.com/AbiPatti/dial-a-storm.git
cd dial-a-storm
```

You get this layout:

```
dial-a-storm/
├── pipeline/          Offline Python: data loading, storm detection, features, model, export
│   ├── dial_a_storm/  The Python package (run with `python -m dial_a_storm`)
│   ├── tests/         Causality / leakage tests
│   └── data/          Local only, gitignored: raw/ holds the CSV, cache/ holds Parquet + models
├── web/               Next.js app
│   ├── e2e/           Playwright browser tests
│   └── public/data/   The JSON files the app loads (committed; stand-in "FIXTURE" data)
└── docs/              CONTRACTS.md (JSON schemas), ENGINEERING.md (rules)
```

---

## Part 1: Run the web app

```bash
cd web
npm install
npm run dev
```

Open **http://localhost:3000**.

You should see the Simulator tab: a 3D Sun, solar-wind particles and Earth, a narrative headline
on the left, the solar-wind dials bottom-right and the SYM-H timeline along the bottom. An orange **FIXTURE DATA** badge next to the title is
expected. It means the predictions come from a stand-in physics model, not the trained ML model
(Part 2 replaces them).

### Try it

1. Drag to orbit the scene and scroll to zoom. Click an object or its label (Sun, Earth,
   magnetopause, aurora) for a details card, and double-click to fly to it.
2. Change storm with the picker at the top left, or with `[` and `]`.
3. Move the **Southward Bz**, **Wind speed** and **Proton density** dials (bottom right). The
   timeline updates live. **Max** sets every dial to its maximum and **Reset** returns to history.
4. Press **Simulate from the start**, or Space, to replay the storm. Drag the timeline to scrub.
   The headline names the storm phase: shock, main phase, peak, recovery.
5. Open the **Explainer** tab (or press `E`) for the physics, the method, the Gannon hold-out
   test, the storm catalogue and the data's limits.

An amber **BEYOND TRAINING DATA** box means the scenario drives the magnetosphere harder than
anything in the 2010–2019 training data. It is a deliberate warning, not an error. For Gannon it
shows even with the dials at 1×.

### Other web commands (from `web/`)

```bash
npm run typecheck   # TypeScript check
npm run build       # production build
npm run start       # serve the production build on http://localhost:3000
```

### Browser tests (from `web/`)

The Playwright tests build the site, serve it on port 3100 and check data loading, storm
selection, the sliders and playback in headless Chromium.

```bash
npx playwright install chromium   # once per machine (downloads a browser)
npm run test:e2e
```

---

## Part 2: Run the ML pipeline (optional)

This retrains the model on the NASA data and regenerates everything in `web/public/data/`.

### 2.1 Get the data file

The file `nasa_omni_solar_wind_storms_5min_2010-2026.csv` (138 MB) is too large for GitHub and is
not in the repo. Get it from a teammate. Then create the folder and put the file in it:

```bash
# from the repo root
mkdir -p pipeline/data/raw
mv /path/to/nasa_omni_solar_wind_storms_5min_2010-2026.csv pipeline/data/raw/
```

On Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force pipeline\data\raw
Move-Item C:\path\to\nasa_omni_solar_wind_storms_5min_2010-2026.csv pipeline\data\raw\
```

To keep the CSV somewhere else instead, set `OMNI_CSV` to its full path before running the
pipeline, for example `export OMNI_CSV=/data/omni.csv` (PowerShell: `$env:OMNI_CSV="C:\data\omni.csv"`).

The file must have this header row:

```
datetime_utc,bt_nT,bz_gsm_nT,by_gsm_nT,speed_km_s,density_cm3,temp_K,pressure_nPa,efield_mV_m,ae_nT,al_nT,sym_h_nT,pcn,proton_flux_10mev
```

### 2.2 Create the Python environment

All pipeline commands run from the `pipeline/` folder.

**macOS / Linux**

```bash
cd pipeline
python3.12 -m venv .venv          # or python3.11
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
```

**Windows (PowerShell)**

```powershell
cd pipeline
py -3.12 -m venv .venv            # or py -3.11
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\pip install -r requirements.txt
```

In the rest of this guide, `.venv/bin/` is the macOS/Linux path. On Windows use `.venv\Scripts\`
instead.

### 2.3 Run the tests

```bash
.venv/bin/pytest
```

Expected output: `17 passed`. The tests check that no feature uses future data or Earth-response
variables (SYM-H, AE, AL, PCN, proton flux). They run on synthetic data, so they don't need the CSV.

### 2.4 Run the full pipeline

```bash
.venv/bin/python -m dial_a_storm
```

This runs the tests again, then loads and validates the CSV, detects the top 8 storms, builds
features, trains the model and exports the scenario grids. It takes about 30 seconds on a recent
laptop. The end of the output should include:

```
INFO dial_a_storm.model: Gannon observed peak -497.0 nT; predicted {'hybrid': -378.7, 'ridge': -357.7, 'xgb_only': -156.0}
INFO dial_a_storm.pipeline: pipeline finished in ...s -> .../web/public/data
```

Refresh the browser (the dev server can stay running). The badge changes from **FIXTURE DATA** to
**PIPELINE**, and the hold-out section compares the hybrid model with pure XGBoost.

**Git note:** the pipeline overwrites the committed files in `web/public/data/`, so `git status`
will show them as modified. Only commit them if the team has agreed to switch the shipped data to
real model output. To undo the change:

```bash
git checkout -- web/public/data      # run from the repo root
```

### Pipeline options

```bash
.venv/bin/python -m dial_a_storm.pipeline --out /tmp/preview   # write the JSON somewhere else
.venv/bin/python -m dial_a_storm.pipeline --rebuild            # rebuild the cached Parquet files
.venv/bin/python -m dial_a_storm.make_fixtures                 # regenerate the FIXTURE stand-in data
.venv/bin/python -m dial_a_storm.load                          # run a single stage
```

The individual stages are `load`, `storms`, `features`, `model` and `export_grid`. Each stage
builds any missing data cache it depends on, but `export_grid` also needs a trained model. On a
fresh clone, run `model` (or the full pipeline) before `export_grid`.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `FileNotFoundError: OMNI CSV not found at .../pipeline/data/raw/...` | The CSV is missing or in the wrong place. See 2.1, or set `OMNI_CSV`. |
| `pip install` fails building pandas or numpy | Wrong Python version. Recreate `.venv` with Python 3.11 or 3.12. |
| `XGBoostError: ... libomp.dylib ...` (macOS) | Run `brew install libomp`. |
| `.venv/bin/...: No such file or directory` on Windows | Use `.venv\Scripts\...`. |
| Windows blocks `Activate.ps1` | You don't need to activate the venv. Call `.venv\Scripts\python` directly as shown above. |
| `npm run test:e2e` says the browser is missing | Run `npx playwright install chromium` in `web/`. |
| Port 3000 already in use | Run `npm run dev -- -p 3001` and open http://localhost:3001. |
| Black screen or "WebGL 2 is not available" | Turn on hardware acceleration in the browser settings, or try another browser. The charts and controls still work without the 3D scene. |
| "Could not load storm data" | A file in `web/public/data/` is missing or doesn't match the schema. Restore it with `git checkout -- web/public/data`, or regenerate it (Part 2). |
| `causality tests failed; refusing to export` | A code change broke a leakage rule. Run `.venv/bin/pytest -v` to see which test failed. |

## Further reading

- `README.md`: project overview.
- `docs/ENGINEERING.md`: modelling rules, the no-leakage guarantees and the web stack rules.
- `docs/CONTRACTS.md`: the exact schema of every JSON file in `web/public/data/`.
