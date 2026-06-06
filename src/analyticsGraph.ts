/**
 * Universal Analytics Graph (TASKS 25, 28). One reusable component, meant to
 * eventually replace the app's individual graph views. It takes selected
 * exercises, a date range, the enabled metrics and a GraphConfig, and renders a
 * series per (exercise × metric) with the in-house SVG engine.
 *
 * Foundation only — it reuses the metric registry's simple computes and applies
 * smoothing/decay from the config; it does NOT yet migrate every legacy graph's
 * business logic. With no exercises it draws mock data so the component is always
 * demonstrably alive. Multi-exercise, combined and comparison names all flow
 * through identically (it's name-based).
 */
import { mountSvgChart, type SvgChart, type SvgSeries, type SvgPoint } from "./svgChart";
import { decayedStrengthSeries, effectiveE1RM } from "./aggregate";
import type { SetRecord } from "./domain";
import { graphMetric, type GraphPoint } from "./graphMetrics";
import type { GraphConfig } from "./graphConfig";

const SERIES_COLORS = ["#284e86", "#b8902f", "#2e7d52", "#a23b3b", "#6c4ab0", "#1f8a8a", "#c0603a", "#7a6f9b"];

export interface AnalyticsGraphInput {
  exercises: readonly string[];
  /** Records to draw from (already computed/filtered by the caller). */
  records: readonly SetRecord[];
  /** Enabled metric ids (defaults to estimated 1RM when empty). */
  metrics: readonly string[];
  config: GraphConfig;
  /** Optional inclusive ISO date bounds. */
  dateFrom?: string;
  dateTo?: string;
  /** Short code for an exercise name (for series labels). */
  codeOf?: (name: string) => string;
  /** Show kg metrics as multiples of bodyweight (divide by `bodyweight`). */
  perBodyweight?: boolean;
  /** The athlete's bodyweight in kg, for the per-bodyweight view. */
  bodyweight?: number | null;
  /** Bodyweight+sex-scaled world record (kg) for an exercise, for the "% of world
   * record" metric; null when none is set. */
  worldRecordKg?: (exercise: string) => number | null;
}

/** Simple moving average over y, window `win` points. */
function movingAverage(points: GraphPoint[], win: number): GraphPoint[] {
  if (win <= 1 || points.length === 0) return points;
  const out: GraphPoint[] = [];
  let sum = 0;
  const q: number[] = [];
  for (const p of points) {
    const y = p.y ?? 0;
    q.push(y);
    sum += y;
    if (q.length > win) sum -= q.shift()!;
    out.push({ x: p.x, y: Math.round((sum / q.length) * 10) / 10 });
  }
  return out;
}

const charts = new WeakMap<HTMLElement, SvgChart>();

/** Render the universal graph into `container`. Returns how many series were
 * drawn, so the caller can show a missing-data note (0 = nothing to plot). */
export function renderAnalyticsGraph(container: HTMLElement, input: AnalyticsGraphInput): number {
  const isAll = input.exercises.length === 0;
  // Metric defaults: a single lift reads best as Estimated 1RM; the whole-athlete
  // "all" view defaults to total VOLUME (a 1RM across mixed lifts is meaningless,
  // but total training volume per day/week is a useful whole-athlete trend).
  const defaultMetric = isAll ? "volume" : "e1rm";
  const metrics = (input.metrics.length ? input.metrics : [defaultMetric]).map(graphMetric).filter((m): m is NonNullable<typeof m> => !!m);
  const inRange = (r: SetRecord) => (!input.dateFrom || r.date >= input.dateFrom) && (!input.dateTo || r.date <= input.dateTo);
  const records = input.records.filter(inRange);
  const code = input.codeOf ?? ((n) => n);

  // "all" → one whole-athlete series per metric over EVERY logged set; otherwise
  // a series per (selected exercise × metric). Same compute path either way — no
  // mock data in the shipped view.
  const groups: { label: string; records: SetRecord[] }[] = isAll
    ? [{ label: "All exercises", records: [...records] }]
    : input.exercises.map((ex) => ({ label: code(ex), records: records.filter((r) => r.exerciseName === ex) }));

  const series: SvgSeries[] = [];
  let ci = 0;
  for (const g of groups) {
    for (const m of metrics) {
      // "% of world record": each set's added-weight 1RM ÷ this exercise's
      // (bodyweight+sex-scaled) world record × 100. Needs the e1rm compute + the WR.
      if (m.id === "pctWR") {
        const wr = input.worldRecordKg?.(g.records[0]?.exerciseName ?? "");
        if (!wr || wr <= 0) continue;
        // Fraction of the world record (1.0 = the record). Uses the BODYWEIGHT-
        // INCLUSIVE 1RM (effectiveE1RM) vs the bodyweight-inclusive record, so it
        // stays ≥ 0 — a sub-bodyweight (assisted) effort reads low, not negative.
        const pts = g.records
          .filter((r) => r.date && effectiveE1RM(r, input.config.formula) != null)
          .map((r) => ({ x: Date.parse(r.date), y: Math.round((effectiveE1RM(r, input.config.formula)! / wr) * 1000) / 1000 }))
          .filter((p) => Number.isFinite(p.x))
          .sort((a, b) => a.x - b.x);
        if (pts.length) series.push({ name: groups.length > 1 ? `${g.label} · vs WR` : "vs world record", color: SERIES_COLORS[ci++ % SERIES_COLORS.length]!, type: "scatter", points: pts as SvgPoint[] });
        continue;
      }
      if (!m.compute) continue; // registered-but-not-computed metric
      let pts: GraphPoint[] = m.compute(g.records, input.config);
      // Decay can also be applied to plain strength/1RM lines via the config.
      if (input.config.decay && (m.id === "strength" || m.id === "e1rm")) {
        pts = decayedStrengthSeries(pts.map((p) => ({ x: p.x, y: p.y ?? 0 })), Date.now());
      }
      if (m.type !== "range" && input.config.smoothing > 0) pts = movingAverage(pts, input.config.smoothing);
      // Per-bodyweight view: divide the kg (left-axis) metrics by bodyweight so they
      // read as multiples of BW; the count metrics (right axis) are left alone.
      if (input.perBodyweight && input.bodyweight && input.bodyweight > 0 && m.axis !== "right") {
        const bw = input.bodyweight;
        const d = (v: number) => Math.round((v / bw) * 1000) / 1000;
        pts = pts.map((p) => ({
          ...p,
          ...(p.y != null ? { y: d(p.y) } : {}),
          ...(p.lo != null ? { lo: d(p.lo) } : {}),
          ...(p.hi != null ? { hi: d(p.hi) } : {}),
          ...(p.bands ? { bands: p.bands.map(d) } : {}),
        }));
      }
      const color = SERIES_COLORS[ci % SERIES_COLORS.length]!;
      ci++;
      // One group → label by metric only; several → prefix the exercise.
      const name = groups.length > 1 ? `${g.label} · ${m.label}` : m.label;
      if (pts.length)
        series.push({ name, color, type: m.type ?? "line", points: pts as SvgPoint[], ...(m.axis ? { axis: m.axis } : {}) });
    }
  }

  // "% of world record" view: shade the background grayer as you climb toward the
  // record — a touch above 0.4, more above 0.6 (very light).
  const showsWr = metrics.some((m) => m.id === "pctWR");
  const config = {
    series, xKind: "time" as const, compactable: true, noCompactToggle: true,
    yBeginAtZero: true, rightBeginAtZero: true, height: 300, insideLabels: true,
    ...(showsWr ? { yBands: [
      { from: 0.4, to: 0.6, fill: "rgba(120,120,120,0.06)" },
      { from: 0.6, fill: "rgba(120,120,120,0.12)" },
    ] } : {}),
  };
  const existing = charts.get(container);
  if (existing) existing.update(config);
  else charts.set(container, mountSvgChart(container, config));
  return series.length;
}
