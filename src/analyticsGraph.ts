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
import { decayedStrengthSeries } from "./aggregate";
import type { SetRecord } from "./domain";
import { graphMetric, type GraphPoint } from "./graphMetrics";
import type { GraphConfig } from "./graphConfig";

const SERIES_COLORS = ["#284e86", "#b8902f", "#2e7d52", "#a23b3b", "#6c4ab0", "#1f8a8a", "#c0603a", "#7a6f9b"];
const DAY = 86_400_000;

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
}

/** Simple moving average over y, window `win` points. */
function movingAverage(points: GraphPoint[], win: number): GraphPoint[] {
  if (win <= 1 || points.length === 0) return points;
  const out: GraphPoint[] = [];
  let sum = 0;
  const q: number[] = [];
  for (const p of points) {
    q.push(p.y);
    sum += p.y;
    if (q.length > win) sum -= q.shift()!;
    out.push({ x: p.x, y: Math.round((sum / q.length) * 10) / 10 });
  }
  return out;
}

function mockSeries(): SvgSeries[] {
  const base = Date.parse("2025-01-01");
  const pts: SvgPoint[] = Array.from({ length: 8 }, (_, i) => ({ x: base + i * 14 * DAY, y: 80 + i * 2 }));
  return [{ name: "Sample (mock)", color: SERIES_COLORS[0]!, type: "line", points: pts }];
}

const charts = new WeakMap<HTMLElement, SvgChart>();

/** Render the universal graph into `container` from the given input. */
export function renderAnalyticsGraph(container: HTMLElement, input: AnalyticsGraphInput): void {
  const metrics = (input.metrics.length ? input.metrics : ["e1rm"]).map(graphMetric).filter((m): m is NonNullable<typeof m> => !!m);
  const inRange = (r: SetRecord) => (!input.dateFrom || r.date >= input.dateFrom) && (!input.dateTo || r.date <= input.dateTo);
  const records = input.records.filter(inRange);
  const code = input.codeOf ?? ((n) => n);

  let series: SvgSeries[] = [];
  if (input.exercises.length === 0) {
    series = mockSeries(); // TASK 25: works with mock data
  } else {
    let ci = 0;
    for (const ex of input.exercises) {
      const exRecords = records.filter((r) => r.exerciseName === ex);
      for (const m of metrics) {
        if (!m.compute) continue; // registered-but-not-computed metric
        let pts = m.compute(exRecords, input.config);
        // Config-driven shaping (kept light at the foundation stage).
        if (input.config.decay && (m.id === "strength" || m.id === "strengthDecay" || m.id === "e1rm")) {
          pts = decayedStrengthSeries(pts, Date.now());
        }
        if (input.config.smoothing > 0) pts = movingAverage(pts, input.config.smoothing);
        const color = SERIES_COLORS[ci % SERIES_COLORS.length]!;
        ci++;
        if (pts.length)
          series.push({ name: `${code(ex)} · ${m.label}`, color, type: "line", points: pts, ...(m.axis ? { axis: m.axis } : {}) });
      }
    }
    if (series.length === 0) series = mockSeries();
  }

  const config = { series, xKind: "time" as const, compactable: true, yBeginAtZero: true, height: 300, insideLabels: true };
  const existing = charts.get(container);
  if (existing) existing.update(config);
  else charts.set(container, mountSvgChart(container, config));
}
