/** Fetch + validate static artifacts. Every response passes through a Zod schema. */
import type { ZodType, ZodTypeDef } from "zod";
import {
  ManifestSchema,
  ScenarioGridSchema,
  StormWindowSchema,
  StormsDocumentSchema,
  type Manifest,
  type ScenarioGrid,
  type StormWindow,
  type StormsDocument,
} from "./types";

export const DATA_BASE = "/data";

export class DataError extends Error {
  constructor(
    message: string,
    readonly url: string,
  ) {
    super(message);
    this.name = "DataError";
  }
}

async function fetchValidated<T>(url: string, schema: ZodType<T, ZodTypeDef, unknown>, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal, cache: "force-cache" });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new DataError(`network error loading ${url}: ${(err as Error).message}`, url);
  }
  if (!res.ok) throw new DataError(`${url} returned HTTP ${res.status}`, url);
  const json: unknown = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new DataError(`${url} failed schema validation at ${issue.path.join(".") || "<root>"}: ${issue.message}`, url);
  }
  return parsed.data;
}

const windowCache = new Map<string, Promise<StormWindow>>();
const gridCache = new Map<string, Promise<ScenarioGrid>>();

function memo<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit;
  const p = load().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, p);
  return p;
}

export function loadManifest(signal?: AbortSignal): Promise<Manifest> {
  return fetchValidated(`${DATA_BASE}/manifest.json`, ManifestSchema, signal);
}

export function loadStorms(signal?: AbortSignal): Promise<StormsDocument> {
  return fetchValidated(`${DATA_BASE}/storms.json`, StormsDocumentSchema, signal);
}

export function loadStormWindow(id: string): Promise<StormWindow> {
  return memo(windowCache, id, () => fetchValidated(`${DATA_BASE}/storm_windows/${encodeURIComponent(id)}.json`, StormWindowSchema));
}

export function loadScenarioGrid(id: string): Promise<ScenarioGrid> {
  return memo(gridCache, id, () => fetchValidated(`${DATA_BASE}/scenario_grid/${encodeURIComponent(id)}.json`, ScenarioGridSchema));
}
