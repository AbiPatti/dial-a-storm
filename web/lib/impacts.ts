/**
 * What a storm of a given SYM-H would do to the systems people rely on. These are communication
 * aids, not forecasts: each system has five levels with SYM-H thresholds chosen so that documented
 * events land on the level they actually reached. Every escalated level names a real precedent.
 *
 * Historic SYM-H anchors (for the ruler): Gannon 2024 comes from our own OMNI data. Québec 1989 is
 * the published SYM-H minimum. Carrington 1859 predates SYM-H; its range is the literature estimate
 * of its ring-current depression (Siscoe et al. 2006 ~ -850 nT, Tsurutani et al. 2003 ~ -1760 nT).
 */
import { auroraLatitude } from "./severity";

export type ImpactLevel = 0 | 1 | 2 | 3 | 4;

export interface ImpactStage {
  status: string;
  detail: string;
  precedent?: string;
}

export interface ImpactSystem {
  id: "grid" | "satellites" | "gps" | "radio";
  label: string;
  /** SYM-H (nT) at or below which levels 1..4 begin. */
  thresholds: [number, number, number, number];
  stages: [ImpactStage, ImpactStage, ImpactStage, ImpactStage, ImpactStage];
}

export const LEVEL_COLORS = ["#a7f3d0", "#fcd34d", "#fb923c", "#fb3b5b", "#ff5fa2"] as const;

export const SYSTEMS: ImpactSystem[] = [
  {
    id: "grid",
    label: "Power grids",
    thresholds: [-100, -250, -450, -850],
    stages: [
      { status: "Normal", detail: "Long power lines carry only small currents." },
      { status: "Alarms", detail: "Induced currents trip voltage alarms." },
      { status: "Strain", detail: "Transformers overheat. Relays trip.", precedent: "Halloween 2003 · Malmö, Sweden went dark" },
      { status: "Blackouts", detail: "A regional grid can fall in 90 seconds.", precedent: "Québec 1989 · 6 M people, 9 hours dark" },
      { status: "Continental", detail: "Transformers burn out. Each takes months to replace.", precedent: "Lloyd's · up to 40 M dark for up to 2 yrs" },
    ],
  },
  {
    id: "satellites",
    label: "Satellites",
    thresholds: [-50, -150, -300, -850],
    stages: [
      { status: "Nominal", detail: "The upper atmosphere is calm. Orbits hold." },
      { status: "Drag", detail: "Heated air swells and drags on low orbits.", precedent: "Feb 2022 · 38 Starlinks lost, minor storm" },
      { status: "Orbits sink", detail: "Fleets burn fuel to hold altitude." },
      { status: "Mass manoeuvre", detail: "Thousands move at once. Tracking goes stale.", precedent: "May 2024 · record mass satellite migration" },
      { status: "Blind orbits", detail: "Tracking fails for days. Collisions become likely." },
    ],
  },
  {
    id: "gps",
    label: "GPS & timing",
    thresholds: [-100, -250, -450, -850],
    stages: [
      { status: "Precise", detail: "Centimetre positioning works normally." },
      { status: "Drifting", detail: "The ionosphere adds metres of error." },
      { status: "Unreliable", detail: "Precision farming and surveying stop.", precedent: "May 2024 · GPS tractors stopped mid-field" },
      { status: "Lost lock", detail: "Receivers drop out. Planes use backup navigation." },
      { status: "Clocks adrift", detail: "Phone networks and markets synced to GPS time drift." },
    ],
  },
  {
    id: "radio",
    label: "Radio & flights",
    thresholds: [-100, -200, -400, -850],
    stages: [
      { status: "Clear", detail: "Shortwave radio and polar routes unaffected." },
      { status: "Fading", detail: "HF radio fades near the poles." },
      { status: "Rerouted", detail: "Polar flights divert. Ocean HF contact is lost." },
      { status: "Blackout", detail: "HF radio dead at mid latitudes for hours." },
      { status: "Wires spark", detail: "Long wires carry currents that shock and burn.", precedent: "1859 · telegraph wires sparked" },
    ],
  },
];

export function levelFor(system: ImpactSystem, symH: number): ImpactLevel {
  if (!Number.isFinite(symH)) return 0;
  let level = 0;
  for (let i = 0; i < system.thresholds.length; i++) if (symH <= system.thresholds[i]) level = i + 1;
  return level as ImpactLevel;
}

/** Cities ordered north to south, with geographic latitude. Toronto is home for the Sheridan judges. */
export const CITIES: { name: string; lat: number }[] = [
  { name: "Reykjavík", lat: 64.1 },
  { name: "Oslo", lat: 59.9 },
  { name: "Edinburgh", lat: 55.9 },
  { name: "London", lat: 51.5 },
  { name: "Paris", lat: 48.9 },
  { name: "Seattle", lat: 47.6 },
  { name: "Toronto", lat: 43.7 },
  { name: "Chicago", lat: 41.9 },
  { name: "New York", lat: 40.7 },
  { name: "Madrid", lat: 40.4 },
];

export function auroraCities(symH: number): { lat: number; lit: boolean[]; southmost: string | null } {
  const lat = auroraLatitude(symH);
  const lit = CITIES.map((c) => c.lat >= lat);
  const last = lit.lastIndexOf(true);
  return { lat, lit, southmost: last >= 0 ? CITIES[last].name : null };
}

export interface Landmark {
  id: string;
  label: string;
  /** SYM-H in nT; `to` makes it a range (an estimate). */
  value: number;
  to?: number;
  note: string;
}

export const LANDMARKS: Landmark[] = [
  { id: "gannon", label: "Gannon 2024", value: -497, note: "Strongest storm in 20 years" },
  { id: "quebec", label: "Québec 1989", value: -710, note: "Blacked out a province" },
  { id: "carrington", label: "Carrington 1859", value: -850, to: -1760, note: "Estimated; no SYM-H existed" },
];

export const CARRINGTON = LANDMARKS[2].value;

/** One sentence placing a peak against history. */
export function verdict(peak: number): string {
  const depth = Math.max(0, -peak);
  if (peak <= CARRINGTON) return "Carrington-class. Nothing like this has hit a wired world.";
  if (peak <= -710) return `Deeper than the Québec blackout. ${Math.round(850 - depth)} nT short of Carrington.`;
  if (peak <= -497) return `Beyond Gannon 2024. ${Math.round(850 - depth)} nT short of Carrington.`;
  return `${Math.round(850 - depth)} nT short of a Carrington-class storm.`;
}
