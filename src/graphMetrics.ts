/**
 * Graph metric registry (TASK 26) + the migrated graph calculations (TASKS 31–36).
 * One central place that defines every metric a graph can plot, referenced by id.
 * The migrated metrics carry a `compute` that turns one exercise's records into
 * points (line or range); the still-to-come ones are registered (so toggles and
 * future work can reference them) but not computed yet.
 */
import type { SetRecord } from "./domain";
import { addedWeight1RM, effectiveE1RM, decayedStrengthSeries } from "./aggregate";
import { setVolume, type OneRepMaxFormula } from "./metrics";
import { fitLog, fitCeiling, sampleProjection } from "./projection";
import type { GraphConfig } from "./graphConfig";

const DAY = 86_400_000;
const r1 = (n: number): number => Math.round(n * 10) / 10;
/** Round to at most 3 significant figures (73.33333 → 73.3, 106.4 → 106), as a plain
 * number — so click-to-pin details never show a long float. */
const sig3 = (n: number): number => (Number.isFinite(n) ? Number(n.toPrecision(3)) : n);

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
  detail?: string; // full per-set facts for the click-to-pin popup (one per line)
  fail?: boolean; // the set's note contained "fail" — drawn as an ✕ in the series colour
  pr?: boolean; // a new running-max (a record at the time) — drawn as a diamond
  rir?: number; // the set's reps-in-reserve — scales the dot (higher RIR = smaller)
  /** Per-POINT marker shape: for a combined / comparison lift, each member-origin
   * gets its OWN shape (same colour) so you can tell the mixed sources apart. */
  shape?: "circle" | "diamond" | "square" | "triangle" | "ring" | "plus";
}
/** Marker shapes cycled across a combined/comparison lift's member origins (same
 * colour, different form). Order chosen so the first few read most distinctly. */
export const ORIGIN_SHAPES = ["circle", "diamond", "triangle", "square", "ring", "plus"] as const;
/** Map a record's source lift (combined member) to a shape, given the sorted list
 * of distinct origins in the series — or undefined when it's a single-origin lift. */
function originShapeOf(r: SetRecord, origins: string[]): GraphPoint["shape"] {
  if (origins.length < 2) return undefined; // a plain lift → no per-point shapes
  const o = r.originalExerciseName ?? r.exerciseName;
  const i = origins.indexOf(o);
  return i < 0 ? undefined : ORIGIN_SHAPES[i % ORIGIN_SHAPES.length];
}
/** The distinct member origins behind a set list (a combined/comparison lift relabels
 * each member set, keeping its source in originalExerciseName), sorted for stable shapes. */
function distinctOrigins(records: readonly SetRecord[]): string[] {
  return [...new Set(records.map((r) => r.originalExerciseName ?? r.exerciseName))].sort();
}
/** A set whose note marks it as a failed attempt. */
const isFail = (r: SetRecord): boolean => /fail/i.test(r.notes ?? "");

/** Full facts for ONE logged set, one per line, for the chart's click-to-pin
 * detail popup: date, weight×reps, est. 1RM, RIR (when resolvable) and the note. */
function setDetail(r: SetRecord, cfg?: GraphConfig): string {
  const w = added(r);
  const lines: string[] = [r.date, `${w != null ? sig3(w) : "?"}kg × ${r.reps ?? "?"}`];
  // For a merged combined/comparison lift, name the SOURCE member this dot came from
  // (decodes its shape).
  const src = r.originalExerciseName && r.originalExerciseName !== r.exerciseName ? r.originalExerciseName : null;
  if (src) lines.push(`from ${src}`);
  if (cfg) {
    const e = addedWeight1RM(r, cfg.formula);
    if (e != null) lines.push(`1RM ${sig3(e)} kg`);
    const rir = cfg.rirOf?.(r);
    if (rir != null && Number.isFinite(rir)) lines.push(`RIR ${sig3(rir)}`);
  }
  if (r.notes?.trim()) lines.push(r.notes.trim());
  return lines.join("\n");
}
export interface GraphMetricDef {
  id: string;
  label: string;
  /** Series kind (default "line"). "range" uses lo/hi; "scatter" = dots. */
  type?: "line" | "range" | "scatter" | "bars";
  /** Which y-axis (most share the left). */
  axis?: "left" | "right";
  /** Per-exercise point builder. Absent = registered but not computed yet. */
  compute?: (records: readonly SetRecord[], cfg: GraphConfig) => GraphPoint[];
}

const ts = (d: string): number => Date.parse(d);
const added = (r: SetRecord): number | null => (r.origWeight !== undefined ? r.origWeight : r.weight);

// Same-day sets are fanned across this window of the day (fraction of 24h), in
// logged set order, CENTRED on the day and as wide as the `spread` knob asks (0 =
// stacked on one line, ~0.9 = almost the whole day). The compacted-time axis FLOORs
// a timestamp to its day (see buildCompactor), so any fan offset in [0, 1) lands on
// that day's slot (correct date) and never bleeds into the next calendar day.
const DEFAULT_SPREAD = 0.9;

/** Synthetic per-set timestamps. Logged sets carry only a date, so every set in a
 * day parses to midnight and stacks on one x (points hide behind each other). Fan
 * each day's sets EVENLY across the day (in logged set order) so the sets of a
 * session read as distinct points — spread to the set count so a big session fills
 * the day and never overflows it. The compacted axis preserves this intra-day fan
 * at full slot width (see buildCompactor), so the sets stay separated even when
 * long gaps squeeze the sessions together. */
function setTimes(records: readonly SetRecord[], spread: number = DEFAULT_SPREAD): Map<SetRecord, number> {
  // The fan starts at the session's day and extends FORWARD by `spread` days (so the
  // sets never appear BEFORE their logged date). `spread` ≤ ~1 keeps a session inside
  // its own day (exact dates); a larger spread (up to ~10 days) lets a dense session
  // fan across several days for separation — best read in realistic-time mode.
  const width = Math.max(0, Math.min(9.9, Number.isFinite(spread) ? spread : DEFAULT_SPREAD));
  const lo = 0.05;
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
    const n = ordered.length;
    ordered.forEach((r, i) => {
      const frac = n <= 1 ? 0.5 : lo + width * (i / (n - 1)); // first set at the day, last `width` days on
      out.set(r, (day + frac) * DAY);
    });
  }
  return out;
}

/** One point per set for a numeric selector, dropping nulls, sorted by date. */
function perSet(
  records: readonly SetRecord[],
  sel: (r: SetRecord) => number | null | undefined,
  metaOf?: (r: SetRecord) => string,
  cfg?: GraphConfig,
): GraphPoint[] {
  const times = setTimes(records, cfg?.spread);
  const origins = distinctOrigins(records); // >1 → a combined/comparison lift
  const out: GraphPoint[] = [];
  for (const r of records) {
    const y = sel(r);
    if (y != null && Number.isFinite(y)) {
      const x = times.get(r) ?? ts(r.date);
      const p: GraphPoint = { x, y };
      if (metaOf) p.meta = metaOf(r);
      p.detail = setDetail(r, cfg);
      if (isFail(r)) p.fail = true;
      const rir = cfg?.rirOf?.(r); // size the dot by effort, when a resolver is given
      if (rir != null && Number.isFinite(rir)) p.rir = rir;
      // Combined/comparison lift → shape this dot by its source member (same colour),
      // and name the member in the tooltip so the shapes are decodable.
      const shape = originShapeOf(r, origins);
      if (shape) { p.shape = shape; const o = r.originalExerciseName; if (o) p.meta = p.meta ? `${o} · ${p.meta}` : o; }
      out.push(p);
    }
  }
  out.sort((a, b) => a.x - b.x);
  // Mark each new running-max (a record at the time) so the chart can diamond it.
  let best = -Infinity;
  for (const p of out) {
    const y = p.y ?? -Infinity;
    if (y > best + 1e-9) { p.pr = true; best = y; }
  }
  return out;
}

/** est. 1RM points for an exercise under the configured formula.
 * Pass `cfg` to include RIR values — used by the adaptive decay series (strengthDecay). */
function e1rmPoints(
  records: readonly SetRecord[],
  formula: OneRepMaxFormula,
  cfg?: GraphConfig,
): { x: number; y: number; rir?: number }[] {
  return perSet(records, (r) => addedWeight1RM(r, formula), undefined, cfg).map((p) => ({
    x: p.x,
    y: p.y!,
    ...(p.rir != null ? { rir: p.rir } : {}),
  }));
}

/** EFFECTIVE-1RM points for the decay/growth model (rule 58): the fade + the growth cap must
 * run on the FULL effective load (bodyweight folded in), not the peeled added weight. Returns
 * the effective points + a representative bodyweight SHARE (the most-recent comparable set's
 * effective − added) for the caller to peel back so the plotted line stays the ADDED weight
 * (rule 49). For bar-only lifts (coeff 0) the share is 0, so this is a no-op. */
export function effectiveDecayInput(
  records: readonly SetRecord[],
  formula: OneRepMaxFormula,
  cfg?: GraphConfig,
): { pts: { x: number; y: number; rir?: number }[]; offset: number } {
  const pts = perSet(records, (r) => effectiveE1RM(r, formula), undefined, cfg).map((p) => ({
    x: p.x,
    y: p.y!,
    ...(p.rir != null ? { rir: p.rir } : {}),
  }));
  const dated = records
    .filter((r) => r.date && effectiveE1RM(r, formula) != null)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const last = dated[0];
  const offset = last ? (effectiveE1RM(last, formula)! - (addedWeight1RM(last, formula) ?? 0)) : 0;
  return { pts, offset };
}

/** Running maximum — the legacy "Strength Score" line that never drops. */
function runningMax(pts: { x: number; y: number }[]): GraphPoint[] {
  let m = -Infinity;
  return pts.map((p) => ({ x: p.x, y: r1((m = Math.max(m, p.y))) }));
}

/** Select the points that feed the projection fit, per the configured basis.
 * Warm-ups (clearly submaximal: RIR ≥ 6 when effort is known) are ALWAYS dropped;
 * "hard" keeps only near-failure sets (RIR < 3), "records" reduces to the running
 * max, and "all" keeps every working set. */
function projectionBasisPoints(records: readonly SetRecord[], cfg: GraphConfig): { x: number; y: number }[] {
  const basis = cfg.projectionBasis ?? "records";
  const rirOf = cfg.rirOf;
  const kept = records.filter((r) => {
    if (!rirOf) return true; // no effort signal → can't tell warm-ups apart, keep all
    const rir = rirOf(r);
    if (rir == null || !Number.isFinite(rir)) return true; // unknown effort → keep
    if (rir >= 6) return false; // clear warm-up — never projected
    if (basis === "hard") return rir < 3; // near-failure only
    return true;
  });
  const pts = e1rmPoints(kept, cfg.formula).filter(
    (p) => (cfg.projectionFrom == null || p.x >= cfg.projectionFrom) && (cfg.projectionTo == null || p.x <= cfg.projectionTo),
  );
  return basis === "records" ? runningMax(pts).map((p) => ({ x: p.x, y: p.y! })) : pts;
}

/** Strength projection over the data span extended by the horizon. When a CEILING
 * is known (the user's Potential ceiling, else the world record) the curve is the
 * ceiling-approach fit y = ceiling − e^(m·t+b) — steep early, flattening toward the
 * ceiling (the owner's ask). Otherwise it falls back to the plain log fit
 * y = c + b·ln(t + a). Returns [] when there are too few points to fit. */
function predict(pts: { x: number; y: number }[], horizonDays: number, ceiling: number | null): GraphPoint[] {
  if (pts.length < 3) return [];
  // Ceiling must sit ABOVE the latest point, else there's nothing to approach.
  const last = pts[pts.length - 1]!.y;
  const usedCeiling = ceiling != null && ceiling > last;
  const fit = (usedCeiling ? fitCeiling(pts, ceiling!) : null) ?? fitLog(pts);
  if (!fit) return [];
  const t0 = pts[0]!.x;
  const end = pts[pts.length - 1]!.x + Math.max(0, horizonDays) * DAY;
  // #max-debug (PB-40): surface the projection fit on the on-screen dbg console so the
  // owner can SEE whether the curve actually passes through the current strength and
  // approaches the ceiling. `fit@cur` should ≈ `cur` now that fitCeiling anchors there.
  const dbg = (globalThis as { dbg?: (m: string) => void }).dbg;
  if (dbg) {
    const lastX = pts[pts.length - 1]!.x;
    const at = (x: number) => { const v = fit.predict(x); return v == null ? "–" : Math.round(v); };
    dbg(`proj n=${pts.length} ceil=${usedCeiling ? Math.round(ceiling!) : "log"} cur=${Math.round(last)} fit@cur=${at(lastX)} fit@end=${at(end)}`);
  }
  return sampleProjection(fit, t0, end, 24).map((p) => ({ x: p.x, y: r1(p.y) }));
}

const WEEK = 7 * DAY;
/** Plot x for a time's bucket: the MIDDLE of the period (day / week / month), so a
 * bar (drawn centred on its x) sits OVER the period it covers rather than pinned to
 * its left edge / the month gridline. Weeks use fixed 7-day blocks from the epoch
 * (same as Frequency); months use the true mid-point between the 1st and the next
 * 1st. The value is also a stable per-bucket key for grouping. */
function bucketCenter(t: number, interval: GraphConfig["interval"]): number {
  if (interval === "day") return Math.floor(t / DAY) * DAY + DAY / 2;
  // Calendar month-multiples: month (1) · quarter (3) · half-year (6) · year (12). Each set
  // floors to its block start (aligned to January) so the longer-range volume bars are stable.
  const monthSpan = interval === "month" ? 1 : interval === "quarter" ? 3 : interval === "halfyear" ? 6 : interval === "year" ? 12 : 0;
  if (monthSpan) {
    const d = new Date(t);
    const startMo = Math.floor(d.getUTCMonth() / monthSpan) * monthSpan;
    const start = Date.UTC(d.getUTCFullYear(), startMo, 1);
    const next = Date.UTC(d.getUTCFullYear(), startMo + monthSpan, 1);
    return (start + next) / 2;
  }
  // WEEK buckets start on MONDAY (matching the workout history + heatmap), NOT the raw
  // epoch week (floor(t/WEEK) starts THURSDAY, since epoch day 0 is a Thursday) — else a
  // set lands in a different week than the history shows it ("days don't match"). Shift the
  // epoch-day to the Monday on/before: Monday-as-0 index = (dayOfEpoch + 3) % 7.
  const day = Math.floor(t / DAY);
  const mondayDay = day - ((day + 3) % 7);
  if (interval === "biweek") {
    // 2-week buckets anchored to a fixed Monday (epoch day −3 is a Monday), so pairs of
    // Monday-weeks group consistently; centre = the bucket's midpoint (+7 days).
    const ANCHOR = -3;
    const startDay = ANCHOR + Math.floor((day - ANCHOR) / 14) * 14;
    return (startDay + 7) * DAY;
  }
  return mondayDay * DAY + WEEK / 2; // week (Monday-anchored)
}
/** Sum a per-set value into one point per time bucket (volume / reps "by date").
 * Buckets by the configured interval — week by default — so the count/volume bars
 * read as weekly totals unless the user switches Interval to Day. */
function byBucketSum(records: readonly SetRecord[], sel: (r: SetRecord) => number | null | undefined, interval: GraphConfig["interval"]): GraphPoint[] {
  const m = new Map<number, number>();
  for (const r of records) {
    const v = sel(r);
    if (v == null || !Number.isFinite(v)) continue;
    const t = ts(r.date);
    if (!Number.isFinite(t)) continue;
    const key = bucketCenter(t, interval);
    m.set(key, (m.get(key) ?? 0) + v);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y: r1(y) }));
}
/** Count sets per time bucket. */
function setsPerBucket(records: readonly SetRecord[], interval: GraphConfig["interval"]): GraphPoint[] {
  return byBucketSum(records, () => 1, interval);
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
    const wk = (d - ((d + 3) % 7)) * DAY + WEEK / 2; // Monday-anchored week centre (matches bucketCenter)
    (weeks.get(wk) ?? weeks.set(wk, new Set()).get(wk)!).add(d);
  }
  return [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([x, set]) => ({ x, y: set.size }));
}
export const GRAPH_METRICS: GraphMetricDef[] = [
  {
    id: "weightRange",
    label: "Weight Range",
    type: "range",
    compute: (rs, cfg) => {
      const times = setTimes(rs, cfg.spread);
      const out: GraphPoint[] = [];
      for (const r of rs) {
        const reps = r.reps ?? 0;
        // Plot on the SAME added-weight basis as the 1RM shown everywhere else (the
        // set list, the 1RM metric): from the plate you added (0 for a pure
        // bodyweight set) up to the set's added-weight 1RM. Using the bodyweight-
        // inclusive effective load here instead made the bars read ~bodyweight
        // (e.g. pull-ups at 90–130 kg — numbers that never appear in the set) — the
        // bug this fixes. addedWeight1RM is null for not-comparable / isometric.
        const lo = added(r) ?? 0;
        const hi = addedWeight1RM(r, cfg.formula);
        if (hi == null) continue;
        // Section the bar by rep: the value at each rep k is what THIS load done for
        // k reps estimates as a 1RM, from k=1 (the load itself) up to the logged rep
        // count (the full estimated 1RM at the top) — a rep-by-rep 1RM ladder.
        const bands: number[] = [];
        for (let k = 1; k <= reps; k++) {
          const v = addedWeight1RM({ ...r, reps: k }, cfg.formula);
          if (v != null) bands.push(r1(v));
        }
        out.push({ x: times.get(r) ?? ts(r.date), lo, hi, ...(bands.length >= 2 ? { bands } : {}), meta: `${r1(lo)}kg × ${r.reps ?? "?"} → ${r1(hi)} 1RM`, detail: setDetail(r, cfg) });
      }
      return out.sort((a, b) => a.x - b.x);
    },
  },
  {
    id: "e1rm",
    label: "1RM",
    type: "scatter",
    compute: (rs, cfg) => perSet(rs, (r) => addedWeight1RM(r, cfg.formula), (r) => `${r1(addedWeight1RM(r, cfg.formula) ?? 0)} 1RM`, cfg),
  },
  // "% of world record" — computed specially in analyticsGraph (needs the athlete's
  // sex + bodyweight + the per-exercise record); carries no compute. Shown as a
  // FRACTION of the record (1.0 = world record), so it shares the left value axis.
  { id: "pctWR", label: "WR%", type: "scatter" },
  // "% of your top performance" — each set's added-weight 1RM as a FRACTION of the best
  // 1RM in view (the peak = 1.0 = 100%). Self-contained (no WR/sex/bodyweight needed), so
  // unlike pctWR it carries a real compute. A fraction (0–1), shares the left value axis;
  // analyticsGraph skips the per-bodyweight divide for it (it's already relative).
  {
    id: "pctBest",
    label: "Best%",
    type: "scatter",
    compute: (rs, cfg) => {
      const pts = perSet(rs, (r) => addedWeight1RM(r, cfg.formula), undefined, cfg);
      let peak = -Infinity;
      for (const p of pts) if (p.y != null && p.y > peak) peak = p.y;
      if (!Number.isFinite(peak) || peak <= 0) return [];
      return pts.map((p) =>
        p.y == null ? p : { ...p, y: Math.round((p.y / peak) * 1000) / 1000, meta: `${Math.round((p.y / peak) * 100)}% of best (${r1(p.y)} 1RM)` },
      );
    },
  },
  { id: "strength", label: "Strength", compute: (rs, cfg) => runningMax(e1rmPoints(rs, cfg.formula)) },
  { id: "strengthDecay", label: "Strength Decay", compute: (rs, cfg) => {
      // EFF-1 (rule 58): run the fade + growth cap on the EFFECTIVE 1RM, then peel the
      // bodyweight share back so the plotted line is the ADDED weight (rule 49).
      const { pts, offset } = effectiveDecayInput(rs, cfg.formula, cfg);
      const wr = cfg.decayParams?.level === 4 ? (cfg.ceilingOf?.(rs) ?? null) : null;
      return decayedStrengthSeries(pts, Date.now(), 4, cfg.decayParams, wr, offset);
    } },
  { id: "predicted", label: "Predicted Strength", compute: (rs, cfg) => predict(projectionBasisPoints(rs, cfg), cfg.predictionDays, cfg.potentialCeiling ?? cfg.ceilingOf?.(rs) ?? null) },
  // Volume / count metrics live on the RIGHT axis so they don't distort the kg
  // scale when shown alongside weight/1RM (TASK 42). They bucket by the configured
  // Interval — WEEK by default — and read as bars (a column per bucket); switch
  // Interval to Day for daily columns. Only Frequency is a smoothed cadence (line).
  // Volume = added (bar) weight × reps — the SAME basis as the workout-history weekly
  // summary, so the bars match it. (Was r.weight = bodyweight-inclusive effective load,
  // which double-counted bodyweight lifts like Hip Thrust — graph 12k vs history 6k.)
  { id: "volume", label: "Volume", type: "bars", axis: "right", compute: (rs, cfg) => byBucketSum(rs, (r) => (r.notComparable ? null : setVolume(added(r), r.reps)), cfg.interval) },
  { id: "volumeLoad", label: "Volume Load", type: "bars", axis: "right", compute: (rs, cfg) => byBucketSum(rs, (r) => (r.notComparable ? null : setVolume(added(r), r.reps)), cfg.interval) },
  { id: "reps", label: "Reps", type: "bars", axis: "right", compute: (rs, cfg) => byBucketSum(rs, (r) => r.reps, cfg.interval) },
  { id: "sets", label: "Sets", type: "bars", axis: "right", compute: (rs, cfg) => setsPerBucket(rs, cfg.interval) },
  { id: "frequency", label: "Frequency", axis: "right", compute: (rs) => sessionsPerWeek(rs) },
];

export const graphMetric = (id: string): GraphMetricDef | undefined => GRAPH_METRICS.find((m) => m.id === id);

/** Metrics measured in kilograms (left axis) vs counts/volume (right axis). */
const KG_METRICS = new Set(["weightRange", "e1rm", "strength", "strengthDecay", "predicted"]);
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
  if (cfg.decay && !["strength", "e1rm", "strengthDecay"].some((m) => ids.has(m)))
    notes.push("Decay only affects the Strength / 1RM metrics — enable one to see it.");
  const hasKg = [...ids].some((m) => KG_METRICS.has(m));
  const hasCount = [...ids].some((m) => COUNT_METRICS.has(m));
  if (hasKg && hasCount) notes.push("Volume / counts use the right axis so they don't distort the kg scale.");
  return notes;
}
