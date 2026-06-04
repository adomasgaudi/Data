/**
 * Graph metric registry (TASK 26) + the migrated graph calculations (TASKS 31–36).
 * One central place that defines every metric a graph can plot, referenced by id.
 * The migrated metrics carry a `compute` that turns one exercise's records into
 * points (line or range); the still-to-come ones are registered (so toggles and
 * future work can reference them) but not computed yet.
 */
import type { SetRecord } from "./domain";
import { addedWeight1RM, decayedStrengthSeries } from "./aggregate";
import { setVolume, linearFit, type OneRepMaxFormula } from "./metrics";
import type { GraphConfig } from "./graphConfig";

const DAY = 86_400_000;
const r1 = (n: number): number => Math.round(n * 10) / 10;

export interface GraphPoint {
  x: number;
  y?: number; // line/scatter value
  lo?: number; // range bottom
  hi?: number; // range top
  meta?: string; // tooltip text
}
export interface GraphMetricDef {
  id: string;
  label: string;
  /** Series kind (default "line"). "range" uses lo/hi. */
  type?: "line" | "range";
  /** Which y-axis (most share the left). */
  axis?: "left" | "right";
  /** Per-exercise point builder. Absent = registered but not computed yet. */
  compute?: (records: readonly SetRecord[], cfg: GraphConfig) => GraphPoint[];
}

const ts = (d: string): number => Date.parse(d);
const added = (r: SetRecord): number | null => (r.origWeight !== undefined ? r.origWeight : r.weight);

/** One point per set for a numeric selector, dropping nulls, sorted by date. */
function perSet(
  records: readonly SetRecord[],
  sel: (r: SetRecord) => number | null | undefined,
  metaOf?: (r: SetRecord) => string,
): GraphPoint[] {
  const out: GraphPoint[] = [];
  for (const r of records) {
    const y = sel(r);
    if (y != null && Number.isFinite(y)) out.push(metaOf ? { x: ts(r.date), y, meta: metaOf(r) } : { x: ts(r.date), y });
  }
  return out.sort((a, b) => a.x - b.x);
}

/** est. 1RM points for an exercise under the configured formula. */
function e1rmPoints(records: readonly SetRecord[], formula: OneRepMaxFormula): { x: number; y: number }[] {
  return perSet(records, (r) => addedWeight1RM(r, formula)).map((p) => ({ x: p.x, y: p.y! }));
}

/** Running maximum — the legacy "Strength Score" line that never drops. */
function runningMax(pts: { x: number; y: number }[]): GraphPoint[] {
  let m = -Infinity;
  return pts.map((p) => ({ x: p.x, y: r1((m = Math.max(m, p.y))) }));
}

/** Logarithmic projection (a + b·ln(day+1)) over the data span extended by the
 * horizon. Returns [] when there are too few points to fit (missing-data state). */
function predict(pts: { x: number; y: number }[], horizonDays: number): GraphPoint[] {
  if (pts.length < 3) return [];
  const t0 = pts[0]!.x;
  const dayOf = (x: number) => (x - t0) / DAY;
  const fit = linearFit(pts.map((p) => ({ x: Math.log(dayOf(p.x) + 1), y: p.y })));
  if (!fit) return [];
  const lastDay = dayOf(pts[pts.length - 1]!.x);
  const end = lastDay + Math.max(0, horizonDays);
  const out: GraphPoint[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const d = (end * i) / N;
    out.push({ x: t0 + d * DAY, y: r1(fit.intercept + fit.slope * Math.log(d + 1)) });
  }
  return out;
}

export const GRAPH_METRICS: GraphMetricDef[] = [
  {
    id: "weight",
    label: "Weight",
    compute: (rs) => perSet(rs, (r) => added(r), (r) => `${added(r)}kg × ${r.reps ?? "?"}`),
  },
  {
    id: "weightRange",
    label: "Weight Range",
    type: "range",
    compute: (rs, cfg) => {
      const out: GraphPoint[] = [];
      for (const r of rs) {
        const lo = added(r);
        const hi = addedWeight1RM(r, cfg.formula);
        if (lo == null || hi == null) continue;
        out.push({ x: ts(r.date), lo, hi, meta: `${lo}kg × ${r.reps ?? "?"} → ${r1(hi)} 1RM` });
      }
      return out.sort((a, b) => a.x - b.x);
    },
  },
  {
    id: "e1rm",
    label: "Estimated 1RM",
    compute: (rs, cfg) => perSet(rs, (r) => addedWeight1RM(r, cfg.formula), (r) => `${r1(addedWeight1RM(r, cfg.formula) ?? 0)} 1RM`),
  },
  { id: "strength", label: "Strength Score", compute: (rs, cfg) => runningMax(e1rmPoints(rs, cfg.formula)) },
  { id: "strengthDecay", label: "Strength Score With Decay", compute: (rs, cfg) => decayedStrengthSeries(e1rmPoints(rs, cfg.formula), Date.now()) },
  { id: "predicted", label: "Predicted Strength", compute: (rs, cfg) => predict(e1rmPoints(rs, cfg.formula), cfg.predictionDays) },
  { id: "volume", label: "Volume", compute: (rs) => perSet(rs, (r) => setVolume(r.weight, r.reps)) },
  { id: "volumeLoad", label: "Volume Load", compute: (rs) => perSet(rs, (r) => setVolume(added(r), r.reps)) },
  { id: "reps", label: "Reps", compute: (rs) => perSet(rs, (r) => r.reps) },
  { id: "sets", label: "Sets" },
  { id: "frequency", label: "Frequency" },
  { id: "pr", label: "Personal Records" },
  { id: "trend", label: "Trend Line" },
  { id: "movingAvg", label: "Moving Average" },
];

export const graphMetric = (id: string): GraphMetricDef | undefined => GRAPH_METRICS.find((m) => m.id === id);
