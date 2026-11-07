/**
 * Zod schemas for every static artifact in /public/data. These mirror docs/CONTRACTS.md and the
 * Python writers in data/src. Any change here must be made in all three places.
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

const IsoUtc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, "expected ISO-8601 UTC (YYYY-MM-DDTHH:MM:SSZ)");
const Source = z.enum(["PIPELINE", "FIXTURE"]);
const ModelKind = z.enum(["hybrid_ridge_xgb", "burton_fixture"]);
const NullableSeries = z.array(z.number().nullable());
const SplitName = z.enum(["train", "val", "test"]);

export const MetricSchema = z.object({
  n: z.number().int().nonnegative(),
  rmse: z.number().optional(),
  mae: z.number().optional(),
  r2: z.number().optional(),
  bias: z.number().optional(),
  storm_n: z.number().int().nonnegative().optional(),
  storm_rmse: z.number().nullable().optional(),
});

const GScaleEntry = z.object({
  tier: z.string(),
  label: z.string(),
  upper_nT: z.number().nullable(),
  lower_nT: z.number().nullable(),
});

const ascending = (a: number[]) => a.every((v, i) => i === 0 || v > a[i - 1]);
const Axis = z.array(z.number().positive()).min(2).refine(ascending, "axis must be strictly ascending");

export const ManifestSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  source: Source,
  generated_at: IsoUtc,
  model: z.object({
    kind: ModelKind,
    description: z.string(),
    cadence_minutes: z.number().positive(),
    target: z.literal("sym_h"),
    features: z.array(z.string()),
    banned_inputs: z.array(z.string()),
    ridge: z
      .object({
        features: z.array(z.string()),
        coefficients: z.record(z.number()),
        intercept: z.number(),
        alpha: z.number(),
        val_rmse_by_alpha: z.record(z.number()),
      })
      .nullable(),
    xgb: z
      .object({
        best_iteration: z.number().int(),
        params: z.record(z.union([z.number(), z.string(), z.boolean(), z.null()])),
      })
      .nullable(),
    train_seconds: z.number(),
  }),
  splits: z.record(
    SplitName,
    z.object({ start_year: z.number().int(), end_year: z.number().int(), rows: z.number().int() }),
  ),
  metrics: z.record(z.string(), z.record(z.string(), MetricSchema)),
  holdout: z.object({
    id: z.string(),
    name: z.string(),
    window_start: IsoUtc,
    window_end: IsoUtc,
    observed_peak_nT: z.number().nullable(),
    observed_peak_time: IsoUtc.nullable(),
    predicted_peak_nT: z.record(z.string(), z.number().nullable()),
    predicted_peak_time: z.record(z.string(), IsoUtc.nullable()),
    metrics: z.record(z.string(), MetricSchema),
  }),
  coupling: z.object({
    train_max_mV_m: z.number().positive(),
    train_p999_mV_m: z.number().positive(),
    train_max_time: IsoUtc,
  }),
  grid: z.object({ bz_south_mult: Axis, speed_mult: Axis, density_mult: Axis }),
  g_scale: z.array(GScaleEntry),
  files: z.object({ storms: z.string(), storm_windows: z.string(), scenario_grid: z.string() }),
  data: z.object({
    source_csv: z.string(),
    rows_5min: z.number().int().nullable(),
    imputation: z.string(),
    citation: z.string(),
  }),
});

export const StormRecordSchema = z.object({
  id: z.string().regex(/^storm_\d{8}(_\d+)?$/),
  rank: z.number().int().positive(),
  name: z.string(),
  start: IsoUtc,
  end: IsoUtc,
  peak_time: IsoUtc,
  peak_sym_h: z.number(),
  g_tier: z.enum(["G0", "G1-G2", "G3-G4", "G5"]),
  duration_hours: z.number().positive(),
  window_start: IsoUtc,
  window_end: IsoUtc,
  split: SplitName,
  holdout: z.boolean(),
  peak_coupling_mV_m: z.number().nullable(),
  max_speed_km_s: z.number().nullable(),
  min_bz_nT: z.number().nullable(),
  max_pdyn_nPa: z.number().nullable(),
  sw_coverage: z.number().min(0).max(1),
});

export const StormsDocumentSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  source: Source,
  generated_at: IsoUtc,
  threshold_nT: z.number(),
  merge_gap_hours: z.number(),
  window_pad_hours: z.number(),
  storms: z.array(StormRecordSchema).min(1),
});

export const StormWindowSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    source: Source,
    id: z.string(),
    name: z.string(),
    model_kind: ModelKind,
    cadence_minutes: z.number().positive(),
    t0: IsoUtc,
    n_times: z.number().int().min(2),
    storm_start: IsoUtc,
    storm_end: IsoUtc,
    peak_time: IsoUtc,
    series: z.object({
      sym_h_observed: NullableSeries,
      bz: NullableSeries,
      by: NullableSeries,
      bt: NullableSeries,
      speed: NullableSeries,
      density: NullableSeries,
      pdyn: NullableSeries,
      coupling: NullableSeries,
    }),
    sw_filled: z.array(z.union([z.literal(0), z.literal(1)])),
    predictions: z.object({
      primary: NullableSeries,
      ridge: NullableSeries.nullable(),
      xgb_only: NullableSeries.nullable(),
    }),
    metrics: z.object({
      rmse: z.number(),
      observed_peak_nT: z.number(),
      predicted_peak_nT: z.number(),
    }),
  })
  .superRefine((w, ctx) => {
    const n = w.n_times;
    const check = (name: string, arr: unknown[] | null) => {
      if (arr && arr.length !== n) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${name} has ${arr.length} samples, expected ${n}` });
      }
    };
    Object.entries(w.series).forEach(([k, v]) => check(`series.${k}`, v));
    check("sw_filled", w.sw_filled);
    Object.entries(w.predictions).forEach(([k, v]) => check(`predictions.${k}`, v));
  });

export const ScenarioGridSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    source: Source,
    id: z.string(),
    model_kind: ModelKind,
    cadence_minutes: z.number().positive(),
    t0: IsoUtc,
    n_times: z.number().int().min(2),
    axes: z.object({ bz_south_mult: Axis, speed_mult: Axis, density_mult: Axis }),
    order: z.tuple([z.literal("bz_south_mult"), z.literal("speed_mult"), z.literal("density_mult"), z.literal("time")]),
    units: z.literal("nT"),
    traces: z.array(z.number()),
    in_range: z.array(z.boolean()),
    peak_coupling_mV_m: z.array(z.number()),
    baseline_peak_coupling_mV_m: z.number().nonnegative(),
    train_max_coupling_mV_m: z.number().positive(),
    min_value: z.number(),
    max_value: z.number(),
  })
  .superRefine((g, ctx) => {
    const points = g.axes.bz_south_mult.length * g.axes.speed_mult.length * g.axes.density_mult.length;
    if (g.traces.length !== points * g.n_times) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `traces length ${g.traces.length} != ${points} x ${g.n_times}` });
    }
    if (g.in_range.length !== points) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `in_range length ${g.in_range.length} != ${points}` });
    }
    if (g.peak_coupling_mV_m.length !== points) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `peak_coupling length != ${points}` });
    }
  });

export type Metric = z.infer<typeof MetricSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
export type StormRecord = z.infer<typeof StormRecordSchema>;
export type StormsDocument = z.infer<typeof StormsDocumentSchema>;
export type StormWindow = z.infer<typeof StormWindowSchema>;
export type ScenarioGrid = z.infer<typeof ScenarioGridSchema>;
export type DataSource = z.infer<typeof Source>;

/** Slider multipliers. `bz` scales southward Bz only. */
export interface Params {
  bz: number;
  speed: number;
  density: number;
}

export const DEFAULT_PARAMS: Params = { bz: 1, speed: 1, density: 1 };

/** Grid converted to typed arrays for the interpolation hot loop. */
export interface PreparedGrid {
  id: string;
  n: number;
  axes: { bz: number[]; speed: number[]; density: number[] };
  data: Float32Array;
  inRange: boolean[];
  peakCoupling: number[];
  baselinePeakCoupling: number;
  trainMaxCoupling: number;
  min: number;
  max: number;
}

export const MODEL_LABELS: Record<string, string> = {
  hybrid: "Hybrid (Ridge + XGBoost residual)",
  primary: "Shipped model",
  ridge: "Ridge backbone only",
  xgb_only: "Pure XGBoost",
  burton: "Burton–OBM physics (fixture)",
};
