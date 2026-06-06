/**
 * Graph metric registry (TASK 26) + the migrated graph calculations (TASKS 31–36).
 * One central place that defines every metric a graph can plot, referenced by id.
 * The migrated metrics carry a `compute` that turns one exercise's records into
 * points (line or range); the still-to-come ones are registered (so toggles and
 * future work can reference them) but not computed yet.
 */
import type { SetRecord } from "./domain";
import { addedWeight1RM, decayedStrengthSeries } from "./aggregate";
import { setVolume, linearFit, estimate1RM, type OneRepMaxFormula } from "./metrics";
import { isIsometric } from "./profile";
import type { GraphConfig } from "./graphConfig";

const DAY = 86_400_000;
const r1 = (n: number): number => Math.round(n * 10) / 10;

export interface GraphPoint {
  x: number;
  y?: number; // line/scatter value
  lo?: number; // range bottom
  hi?: number; // range top
  /** Range bars only: the y-value at each rep done, from rep 1 (= the weight
   * lifted) up to the full estimated 1RM at the last rep. Splits the bar into one
   * section per rep, each ending at that rep's 1RM-equivalent. */
  bands?: number[];
  meta?: string; // tooltip text
}
export interface GraphMetricDef {
  id: string;
  label: string;
  /** Series kind (default "line"). "range" uses lo/hi; "scatter" = dots. */
  type?: "line" | "range" | "scatter";
  /** Which y-axis (most share the left). */
  axis?: "left" | "right";
  /** Per-exercise point builder. Absent = registered but not computed yet. */
  compute?: (records: readonly SetRecord[], cfg: GraphConfig) => GraphPoint[];
}

const ts = (d: string): number => Date.parse(d);
const added = (r: SetRecord): number | null => (r.origWeight !== undefined ? r.origWeight : r.weight);

const HOUR = 3_600_000;
const EVENING_START_H = 17; // assume an evening workout (5pm) when no clock time is logged

/** Synthetic per-set timestamps. Logged sets carry only a date, so every set in a
 * day parses to midnight and stacks on one x (points hide behind each other).
 * Spread each day's sets one hour apart from an evening 5pm start, in logged set
 * order, so the sets of a session read as distinct times along the graph. */
function setTimes(records: readonly SetRecord[]): Map<SetRecord, number> {
  const byDay = new Map<number, SetRecord[]>();
  for (const r of records) {
    const t = ts(r.date);
    if (!Number.isFinite(t)) continue;
    const day = Math.floor(t / DAY);
    (byDay.get(day) ?? byDay.set(day, []).get(day)!).push(r);
  }
  const out = new Map<SetRecord, number>();
  for (const [day, rs] of byDay) {
    const ordered = [...rs].sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0));
    const base = day * DAY + EVENING_START_H * HOUR;
    ordered.forEach((r, i) => out.set(r, base + i * HOUR));
  }
  return out;
}

/** One point per set for a numeric selector, dropping nulls, sorted by date. */
function perSet(
  records: readonly SetRecord[],
  sel: (r: SetRecord) => number | null | undefined,
  metaOf?: (r: SetRecord) => string,
): GraphPoint[] {
  const times = setTimes(records);
  const out: GraphPoint[] = [];
  for (const r of records) {
    const y = sel(r);
    if (y != null && Number.isFinite(y)) {
      const x = times.get(r) ?? ts(r.date);
      out.push(metaOf ? { x, y, meta: metaOf(r) } : { x, y });
    }
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

/** Sum a per-set value into one point per calendar day (volume / reps "by date"). */
function byDaySum(records: readonly SetRecord[], sel: (r: SetRecord) => number | null | undefined): GraphPoint[] {
  const m = new Map<number, number>();
  for (const r of records) {
    const v = sel(r);
    if (v == null || !Number.isFinite(v)) continue;
    const day = Math.floor(ts(r.date) / DAY) * DAY;
    m.set(day, (m.get(day) ?? 0) + v);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y: r1(y) }));
}
/** Count sets per calendar day. */
function setsPerDay(records: readonly SetRecord[]): GraphPoint[] {
  return byDaySum(records, () => 1);
}
/** Distinct training days per week (training frequency). */
function sessionsPerWeek(records: readonly SetRecord[]): GraphPoint[] {
  const days = new Set<number>();
  for (const r of records) {
    const t = ts(r.date);
    if (Number.isFinite(t)) days.add(Math.floor(t / DAY));
  }
  const weeks = new Map<number, Set<number>>();
  for (const d of days) {
    const wk = Math.floor((d * DAY) / (7 * DAY)) * (7 * DAY);
    (weeks.get(wk) ?? weeks.set(wk, new Set()).get(wk)!).add(d);
  }
  return [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([x, set]) => ({ x, y: set.size }));
}
/** New-personal-record sets (each time the est. 1RM beats all before it). */
function prMarkers(records: readonly SetRecord[], formula: OneRepMaxFormula): GraphPoint[] {
  let best = -Infinity;
  const out: GraphPoint[] = [];
  for (const p of e1rmPoints(records, formula)) {
    if (p.y > best + 1e-9) {
      best = p.y;
      out.push({ x: p.x, y: r1(p.y), meta: `PR ${r1(p.y)}` });
    }
  }
  return out;
}
/** Logarithmic best-fit over the data span (no future projection). */
function trendLine(records: readonly SetRecord[], formula: OneRepMaxFormula): GraphPoint[] {
  const pts = e1rmPoints(records, formula);
  if (pts.length < 2) return [];
  const t0 = pts[0]!.x;
  const dayOf = (x: number) => (x - t0) / DAY;
  const fit = linearFit(pts.map((p) => ({ x: Math.log(dayOf(p.x) + 1), y: p.y })));
  if (!fit) return [];
  const lastDay = dayOf(pts[pts.length - 1]!.x);
  const out: GraphPoint[] = [];
  for (let i = 0; i <= 16; i++) {
    const d = (lastDay * i) / 16;
    out.push({ x: t0 + d * DAY, y: r1(fit.intercept + fit.slope * Math.log(d + 1)) });
  }
  return out;
}
/** Moving average of est. 1RM; window = config smoothing (≥2) else 3. */
function movingAvgMetric(records: readonly SetRecord[], cfg: GraphConfig): GraphPoint[] {
  const pts = e1rmPoints(records, cfg.formula);
  const win = cfg.smoothing > 1 ? cfg.smoothing : 3;
  const out: GraphPoint[] = [];
  const q: number[] = [];
  let sum = 0;
  for (const p of pts) {
    q.push(p.y);
    sum += p.y;
    if (q.length > win) sum -= q.shift()!;
    out.push({ x: p.x, y: r1(sum / q.length) });
  }
  return out;
}

export const GRAPH_METRICS: GraphMetricDef[] = [
  {
    id: "weight",
    label: "Weight",
    type: "scatter",
    compute: (rs) => perSet(rs, (r) => added(r), (r) => `${added(r)}kg × ${r.reps ?? "?"}`),
  },
  {
    id: "weightRange",
    label: "Weight Range",
    type: "range",
    compute: (rs, cfg) => {
      const times = setTimes(rs);
      const out: GraphPoint[] = [];
      for (const r of rs) {
        const reps = r.reps ?? 0;
        const add = added(r) ?? 0;
        // A weighted set has a meaningful ADDED-weight range: from the plate you
        // lifted up to its added-weight 1RM. A PURE bodyweight set (no plate) does
        // not — its added 1RM is near zero or negative for easy variations (an
        // easy handstand push-up reads a negative "addable" 1RM by design), so the
        // bar sat below the axis and the graph read "not enough data". For those we
        // instead plot the EFFECTIVE (bodyweight-inclusive) load you actually moved
        // — scaled by the set's variation difficulty — up to its 1RM: a real,
        // positive strength range for calisthenics.
        let lo: number;
        let hi: number | null;
        let oneRm: (k: number) => number | null;
        if (add > 0) {
          lo = add;
          hi = addedWeight1RM(r, cfg.formula);
          oneRm = (k) => addedWeight1RM({ ...r, reps: k }, cfg.formula);
        } else {
          if (r.notComparable || isIsometric(r.exerciseName)) continue; // no 1RM for these
          const eff = (r.weight ?? 0) * (r.difficultyMult ?? 1);
          lo = eff;
          hi = estimate1RM(eff, reps, cfg.formula);
          oneRm = (k) => estimate1RM(eff, k, cfg.formula);
        }
        if (hi == null) continue;
        // Section the bar by rep: the value at each rep k is what THIS load done for
        // k reps estimates as a 1RM, from k=1 (the load itself) up to the logged rep
        // count (the full estimated 1RM at the top) — a rep-by-rep 1RM ladder.
        const bands: number[] = [];
        for (let k = 1; k <= reps; k++) {
          const v = oneRm(k);
          if (v != null) bands.push(r1(v));
        }
        out.push({ x: times.get(r) ?? ts(r.date), lo, hi, ...(bands.length >= 2 ? { bands } : {}), meta: `${r1(lo)}kg × ${r.reps ?? "?"} → ${r1(hi)} 1RM` });
      }
      return out.sort((a, b) => a.x - b.x);
    },
  },
  {
    id: "e1rm",
    label: "Estimated 1RM",
    type: "scatter",
    compute: (rs, cfg) => perSet(rs, (r) => addedWeight1RM(r, cfg.formula), (r) => `${r1(addedWeight1RM(r, cfg.formula) ?? 0)} 1RM`),
  },
  { id: "strength", label: "Strength Score", compute: (rs, cfg) => runningMax(e1rmPoints(rs, cfg.formula)) },
  { id: "strengthDecay", label: "Strength Score With Decay", compute: (rs, cfg) => decayedStrengthSeries(e1rmPoints(rs, cfg.formula), Date.now()) },
  { id: "predicted", label: "Predicted Strength", compute: (rs, cfg) => predict(e1rmPoints(rs, cfg.formula), cfg.predictionDays) },
  // Volume / count metrics live on the RIGHT axis so they don't distort the kg
  // scale when shown alongside weight/1RM (TASK 42). These are raw per-day totals
  // that bounce around with what you chose to do, so they read as scatter (a dot
  // per day) — only Frequency is a smoothed cadence, so it stays a line.
  { id: "volume", label: "Volume", type: "scatter", axis: "right", compute: (rs) => byDaySum(rs, (r) => (r.notComparable ? null : setVolume(r.weight, r.reps))) },
  { id: "volumeLoad", label: "Volume Load", type: "scatter", axis: "right", compute: (rs) => byDaySum(rs, (r) => (r.notComparable ? null : setVolume(added(r), r.reps))) },
  { id: "reps", label: "Reps", type: "scatter", axis: "right", compute: (rs) => byDaySum(rs, (r) => r.reps) },
  { id: "sets", label: "Sets", type: "scatter", axis: "right", compute: (rs) => setsPerDay(rs) },
  { id: "frequency", label: "Frequency", axis: "right", compute: (rs) => sessionsPerWeek(rs) },
  { id: "pr", label: "Personal Records", type: "scatter", compute: (rs, cfg) => prMarkers(rs, cfg.formula) },
  { id: "trend", label: "Trend Line", compute: (rs, cfg) => trendLine(rs, cfg.formula) },
  { id: "movingAvg", label: "Moving Average", compute: (rs, cfg) => movingAvgMetric(rs, cfg) },
];

export const graphMetric = (id: string): GraphMetricDef | undefined => GRAPH_METRICS.find((m) => m.id === id);

/** Metrics measured in kilograms (left axis) vs counts/volume (right axis). */
const KG_METRICS = new Set(["weight", "weightRange", "e1rm", "strength", "strengthDecay", "predicted", "trend", "movingAvg", "pr"]);
const COUNT_METRICS = new Set(["volume", "volumeLoad", "reps", "sets", "frequency"]);

/**
 * Compatibility rules (TASK 42): plain-language notes about metric combinations
 * that can't render or read well, so the UI can explain unavailable states
 * instead of silently drawing nothing. Pure — takes the enabled ids, the config
 * and a small data context.
 */
export function graphCompatibilityNotes(
  metricIds: readonly string[],
  cfg: GraphConfig,
  ctx: { e1rmPoints: number },
): string[] {
  const ids = new Set(metricIds);
  const notes: string[] = [];
  if (ids.has("predicted") && ctx.e1rmPoints < 3) notes.push("Predicted strength needs at least 3 logged points — not enough data yet.");
  if (ids.has("trend") && ctx.e1rmPoints < 2) notes.push("Trend line needs at least 2 logged points.");
  if (cfg.decay && !["strength", "e1rm", "strengthDecay"].some((m) => ids.has(m)))
    notes.push("Decay only affects the Strength / 1RM metrics — enable one to see it.");
  const hasKg = [...ids].some((m) => KG_METRICS.has(m));
  const hasCount = [...ids].some((m) => COUNT_METRICS.has(m));
  if (hasKg && hasCount) notes.push("Volume / counts use the right axis so they don't distort the kg scale.");
  return notes;
}
