# Dial-a-Storm Data Contracts (schema_version 1)

The Python pipeline (`pipeline/dial_a_storm`) writes static JSON to `web/public/data/`. The web app fetches the
files from `/data/...` and validates every one with the Zod schemas in `web/lib/types.ts`. This file
is the reference both sides implement. A schema change must update the Python writer,
`web/lib/types.ts` and this document in the same commit; breaking changes bump `schema_version`.

```
web/public/data/
├── manifest.json                    model, splits, metrics, hold-out benchmark, grid axes
├── storms.json                      top-8 storm catalogue
├── storm_windows/{id}.json          observed series + drivers + baseline predictions
└── scenario_grid/{id}.json          precomputed what-if traces (8 x 6 x 6 x T)
```

## Shared conventions

| Convention | Rule |
|---|---|
| Timestamps | ISO-8601 UTC strings, `YYYY-MM-DDTHH:MM:SSZ`. |
| Time axis | Windows and grids are regular. Sample `i` is at `t0 + i * cadence_minutes`. No per-sample time array is stored. |
| Cadence | `cadence_minutes = 15` (model grid). Raw OMNI is 5 min. |
| Missing values | `null` in nullable series. Never `NaN` (writers use `allow_nan=False`). |
| Units | B in nT, v in km/s, n in cm^-3, Pdyn in nPa, coupling / Ey in mV/m, SYM-H in nT. |
| `source` | `"PIPELINE"` for ML output; `"FIXTURE"` for the stand-in files made by `dial_a_storm.make_fixtures`. The UI shows a FIXTURE badge. |
| `model_kind` | `"hybrid_ridge_xgb"` (Ridge backbone + XGBoost residual) or `"burton_fixture"` (Burton/O'Brien-McPherron physics model, fixtures only). |
| Storm id | `storm_YYYYMMDD` from the UTC date the storm interval starts; `_2`, `_3`… on collision. |

### Physics (implemented once in `pipeline/dial_a_storm/physics.py`, mirrored in `web/lib/live.ts`)

- `Bs = max(-Bz, 0)`
- `Pdyn = 1.6726e-6 * n * v^2` (nPa)
- `c = Ey = v * Bs * 1e-3` (mV/m)
- Scenario `(bz_mult, speed_mult, density_mult)`: `Bz_new = Bz * bz_mult` where `Bz < 0`, else `Bz`;
  `Bt_new = sqrt(max(0, Bt^2 - Bz^2 + Bz_new^2))`; `v_new = v * speed_mult`; `n_new = n * density_mult`; By unchanged.
- Consequence used by the client: scenario coupling is exactly `bz_mult * speed_mult * c(t)`, and
  scenario Pdyn is exactly `density_mult * speed_mult^2 * Pdyn(t)`.

### UI mappings (communication aids, not NOAA products)

| SYM-H (nT) | Tier id | Label |
|---|---|---|
| `> -50` | `G0` | Quiet |
| `(-100, -50]` | `G1-G2` | Moderate |
| `(-250, -100]` | `G3-G4` | Strong / Severe |
| `<= -250` | `G5` | Extreme Superstorm |

Equatorward auroral boundary: `lat = max(38, 65 - 0.05 * max(0, -SYM-H))` degrees. Only negative
SYM-H expands the oval.

---

## 1. `manifest.json`

Written by `dial_a_storm.model` (PIPELINE) or `dial_a_storm.make_fixtures` (FIXTURE).

| Field | Type | Notes |
|---|---|---|
| `schema_version` | `1` | |
| `source` | `"PIPELINE" \| "FIXTURE"` | |
| `generated_at` | ISO UTC | |
| `model.kind` | model_kind | |
| `model.description` | string | Human-readable summary. |
| `model.cadence_minutes` | number | `15` |
| `model.target` | `"sym_h"` | |
| `model.features` | string[] | Ordered feature columns (63 for the hybrid). |
| `model.banned_inputs` | string[] | `["ae","al","pcn","proton_flux","sym_h"]` |
| `model.ridge` | object \| null | `null` for fixtures. `{features: string[], coefficients: {name: number}, intercept, alpha, val_rmse_by_alpha: {alpha: rmse}}`. Coefficients are in raw feature units. |
| `model.xgb` | object \| null | `null` for fixtures. `{best_iteration: int, params: {name: number\|string\|bool\|null}}` |
| `model.train_seconds` | number | |
| `splits.{train,val,test}` | `{start_year, end_year, rows}` | Inclusive years. `train` 2010–2019, `val` 2020–2022, `test` 2023–2026. `rows` = 15-min samples. |
| `metrics.{split}.{model}` | Metric | `split` ∈ `train`, `val`, `test`, `test_excl_holdout`. `model` ∈ `hybrid`, `ridge`, `xgb_only` (PIPELINE) or `burton` (FIXTURE). All models in a split are scored on the same rows. |
| `holdout.id`, `holdout.name` | string | `storm_20240510`, "Gannon Superstorm". |
| `holdout.window_start`, `holdout.window_end` | ISO UTC | Evaluation window (the storm's ±24 h display window). |
| `holdout.observed_peak_nT` | number \| null | Minimum observed SYM-H in the window (−497). |
| `holdout.observed_peak_time` | ISO UTC \| null | |
| `holdout.predicted_peak_nT.{model}` | number \| null | Minimum predicted SYM-H per model. |
| `holdout.predicted_peak_time.{model}` | ISO UTC \| null | |
| `holdout.metrics.{model}` | Metric | |
| `coupling.train_max_mV_m` | number | Max 5-min `c` over 2010–2019. The `in_range` threshold. |
| `coupling.train_p999_mV_m` | number | 99.9th percentile, for context. |
| `coupling.train_max_time` | ISO UTC | |
| `grid.bz_south_mult` | number[] | `[0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0]` |
| `grid.speed_mult` | number[] | `[0.8, 0.9, 1.0, 1.1, 1.25, 1.5]` |
| `grid.density_mult` | number[] | `[0.5, 0.75, 1.0, 1.5, 2.0, 3.0]` |
| `g_scale` | `{tier, label, upper_nT, lower_nT}[]` | The table above (`null` = unbounded). |
| `files` | `{storms, storm_windows, scenario_grid}` | Relative path templates; `{id}` is a storm id. |
| `data` | `{source_csv, rows_5min, imputation, citation}` | Provenance. |

**Metric**

| Field | Type | Notes |
|---|---|---|
| `n` | int | Scored samples. |
| `rmse`, `mae`, `bias` | number | nT. `bias = mean(pred - obs)`. Omitted when `n = 0`. |
| `r2` | number | |
| `storm_n` | int | Samples with observed SYM-H < −50 nT. |
| `storm_rmse` | number \| null | RMSE on those samples. |

## 2. `storms.json`

Written by `dial_a_storm.storms`.

| Field | Type | Notes |
|---|---|---|
| `schema_version`, `source`, `generated_at` | | |
| `threshold_nT` | number | `-50` |
| `merge_gap_hours` | number | Runs below threshold separated by ≤ this are merged (`3`). |
| `window_pad_hours` | number | `24` |
| `storms` | StormRecord[] | Sorted by `rank` (1 = deepest). Length `8`. |

**StormRecord**

| Field | Type | Notes |
|---|---|---|
| `id` | string | `storm_YYYYMMDD[_k]` |
| `rank` | int ≥ 1 | By minimum SYM-H. |
| `name` | string | Known event name or `"{tier} storm, {d Mon YYYY}"`. |
| `start`, `end` | ISO UTC | Merged interval with SYM-H < −50 nT (inclusive 5-min samples). |
| `peak_time` | ISO UTC | Time of minimum SYM-H. |
| `peak_sym_h` | number | nT. |
| `g_tier` | tier id | Tier of `peak_sym_h`. |
| `duration_hours` | number | |
| `window_start`, `window_end` | ISO UTC | `start − 24 h` floored and `end + 24 h` ceiled to 15 min, clipped to the data range. |
| `split` | `"train" \| "val" \| "test"` | Split containing `peak_time`. |
| `holdout` | boolean | `true` only for the Gannon storm. |
| `peak_coupling_mV_m`, `max_speed_km_s`, `min_bz_nT`, `max_pdyn_nPa` | number \| null | Extremes inside `[start, end]`, observed (unscaled). |
| `sw_coverage` | number in [0,1] | Fraction of interval samples with Bz, v and n present. |

## 3. `storm_windows/{id}.json`

Written by `dial_a_storm.export_grid.build_documents`. All arrays have length `n_times`.

| Field | Type | Notes |
|---|---|---|
| `schema_version`, `source`, `id`, `name`, `model_kind` | | |
| `cadence_minutes` | number | `15` |
| `t0` | ISO UTC | Equals the storm's `window_start`. |
| `n_times` | int ≥ 2 | `T` |
| `storm_start`, `storm_end`, `peak_time` | ISO UTC | Copied from the StormRecord. |
| `series.sym_h_observed` | (number\|null)[] | Observed SYM-H. For display and scoring only, never a model input. |
| `series.{bz, by, bt, speed, density}` | (number\|null)[] | Observed drivers after the ≤30 min causal gap fill. |
| `series.pdyn`, `series.coupling` | (number\|null)[] | Derived with the physics conventions above. |
| `sw_filled` | (0\|1)[] | `1` where a longer gap was forward-filled (or nominal quiet wind was used before the first observation) for the replay. |
| `predictions.primary` | (number\|null)[] | Shipped model at multipliers (1, 1, 1). Identical to that grid node. |
| `predictions.ridge` | (number\|null)[] \| null | Ridge backbone alone (PIPELINE only). |
| `predictions.xgb_only` | (number\|null)[] \| null | Pure XGBoost comparison (PIPELINE only). |
| `metrics` | `{rmse, observed_peak_nT, predicted_peak_nT}` | `primary` vs observed in this window. |

## 4. `scenario_grid/{id}.json`

Written by `dial_a_storm.export_grid.build_documents`.

| Field | Type | Notes |
|---|---|---|
| `schema_version`, `source`, `id`, `model_kind`, `cadence_minutes`, `t0`, `n_times` | | `t0`, `n_times` match the window file exactly. |
| `axes.bz_south_mult` (NB), `axes.speed_mult` (NV), `axes.density_mult` (NN) | number[] | Strictly ascending, all > 0. Same as `manifest.grid`. |
| `order` | `["bz_south_mult","speed_mult","density_mult","time"]` | Row-major order of `traces`. |
| `units` | `"nT"` | |
| `traces` | number[] | Length `NB·NV·NN·T`. Predicted SYM-H rounded to integer nT (SYM-H's native resolution). |
| `in_range` | boolean[] | Length `NB·NV·NN`. `false` if the scenario's peak coupling inside the window exceeds `train_max_coupling_mV_m`. |
| `peak_coupling_mV_m` | number[] | Length `NB·NV·NN`. Peak scenario `c` inside the window. |
| `baseline_peak_coupling_mV_m` | number | Peak `c` at (1, 1, 1). |
| `train_max_coupling_mV_m` | number | Copy of `manifest.coupling.train_max_mV_m`. |
| `min_value`, `max_value` | number | Extremes of `traces`. |

### Indexing

```
point(ib, iv, in) = (ib * NV + iv) * NN + in
traces[point * T + t]        SYM-H at time sample t
in_range[point]              coupling flag for that grid node
```

### Client interpolation (`web/lib/interpolate.ts`)

For slider values `(b, v, n)`, each axis is located by binary search to bracket `[x0, x1]` with
weight `τ = (x − x0) / (x1 − x0)`. Values are clamped to the axis range, so the grid never
extrapolates. Then

```
y(t) = Σ_{c ∈ {0,1}^3} w_c · traces[point(c) · T + t]
w_c  = (c_b ? τ_b : 1−τ_b) · (c_v ? τ_v : 1−τ_v) · (c_n ? τ_n : 1−τ_n)
```

The weights sum to 1, and at a grid node the result is exactly the stored trace. The client
computes the live flag exactly as `bz · speed · baseline_peak_coupling_mV_m <= train_max_coupling_mV_m`,
which agrees with `in_range` at every node.

### How traces are produced

For each node, the 5-min drivers from `window_start − 36 h` to `window_end` are scaled, passed
through `features.build_features` (causal lags of 15 min–12 h, trailing coupling integrals of
1–24 h, Burton-OBM ring-current state, southward-duration counter), and predicted at every 15-min sample of the window. The 36 h
lead-in makes the longest look-back fully defined at sample 0.

## Validation guarantees (enforced by `web/lib/types.ts`)

- `schema_version === 1`, `source` and `model_kind` from the enums above.
- Every window series and prediction array has length `n_times`.
- `traces.length === NB·NV·NN·n_times`; `in_range.length === peak_coupling_mV_m.length === NB·NV·NN`.
- Axes strictly ascending and positive.
- The store also rejects a window/grid pair whose `t0` or `n_times` differ.
