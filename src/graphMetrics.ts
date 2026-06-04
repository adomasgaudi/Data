/**
 * Graph metric registry (TASK 26). One central place that defines every metric a
 * graph can plot, referenced by id. A metric optionally carries a `compute` that
 * turns one exercise's records into {x,y} points — the simple, direct ones are
 * implemented here; the heavier/derived ones are registered (so the toggles and
 * future work can reference them) but not computed yet (no business-logic
 * migration in this foundation step).
 */
import type { SetRecord } from "./domain";
import { addedWeight1RM } from "./aggregate";
import { setVolume } from "./metrics";
import type { GraphConfig } from "./graphConfig";

export interface GraphPoint {
  x: number;
  y: number;
}
export interface GraphMetricDef {
  id: string;
  label: string;
  /** Which y-axis (most share the left; counts can move right later). */
  axis?: "left" | "right";
  /** Per-exercise point builder. Absent = registered but not computed yet. */
  compute?: (records: readonly SetRecord[], cfg: GraphConfig) => GraphPoint[];
}

const ts = (d: string): number => Date.parse(d);
/** One point per set for a numeric selector, dropping nulls, sorted by date. */
function perSet(
  records: readonly SetRecord[],
  sel: (r: SetRecord) => number | null | undefined,
): GraphPoint[] {
  const out: GraphPoint[] = [];
  for (const r of records) {
    const y = sel(r);
    if (y != null && Number.isFinite(y)) out.push({ x: ts(r.date), y });
  }
  return out.sort((a, b) => a.x - b.x);
}

export const GRAPH_METRICS: GraphMetricDef[] = [
  { id: "weight", label: "Weight", compute: (rs) => perSet(rs, (r) => r.origWeight ?? r.weight) },
  { id: "weightRange", label: "Weight Range" },
  { id: "e1rm", label: "Estimated 1RM", compute: (rs) => perSet(rs, (r) => addedWeight1RM(r, "epley")) },
  { id: "strength", label: "Strength Score", compute: (rs) => perSet(rs, (r) => addedWeight1RM(r, "epley")) },
  { id: "strengthDecay", label: "Strength Score With Decay", compute: (rs) => perSet(rs, (r) => addedWeight1RM(r, "epley")) },
  { id: "predicted", label: "Predicted Strength" },
  { id: "volume", label: "Volume", compute: (rs) => perSet(rs, (r) => setVolume(r.weight, r.reps)) },
  { id: "volumeLoad", label: "Volume Load", compute: (rs) => perSet(rs, (r) => setVolume(r.origWeight ?? r.weight, r.reps)) },
  { id: "reps", label: "Reps", compute: (rs) => perSet(rs, (r) => r.reps) },
  { id: "sets", label: "Sets" },
  { id: "frequency", label: "Frequency" },
  { id: "pr", label: "Personal Records" },
  { id: "trend", label: "Trend Line" },
  { id: "movingAvg", label: "Moving Average" },
];

export const graphMetric = (id: string): GraphMetricDef | undefined => GRAPH_METRICS.find((m) => m.id === id);
