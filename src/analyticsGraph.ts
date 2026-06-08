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
import { mountSvgChart, type SvgChart, type SvgSeries, type SvgPoint, type SvgShape } from "./svgChart";
import { decayedStrengthSeries, effectiveE1RM } from "./aggregate";
import type { SetRecord } from "./domain";
import { graphMetric, type GraphPoint } from "./graphMetrics";
import type { GraphConfig } from "./graphConfig";

const SERIES_COLORS = ["#284e86", "#b8902f", "#2e7d52", "#a23b3b", "#6c4ab0", "#1f8a8a", "#c0603a", "#7a6f9b", "#3a7d3a", "#9b59b6", "#d4843a", "#406a9e"];
/** Scatter marker shapes, used in the multi-athlete overlay to tell EXERCISES apart
 * by FORM while each ATHLETE keeps one colour (hue) — so colour = who, shape = what. */
const EXERCISE_SHAPES: SvgShape[] = ["circle", "diamond", "square", "triangle", "ring", "plus"];

/** The palette colour at index `i` (wraps). Exposed so a multi-athlete view can
 * render an athlete colour key that matches the lines (each athlete = one colour). */
export function seriesPaletteColor(i: number): string {
  return SERIES_COLORS[((i % SERIES_COLORS.length) + SERIES_COLORS.length) % SERIES_COLORS.length]!;
}

/** A shade of a base hex colour, for distinguishing a 2nd+ series of the SAME
 * render-shape within one exercise. n=0 is the base; odd n lightens, even n
 * darkens, by a growing amount — so an exercise's series stay clearly "the same
 * colour family" while still being told apart. */
function shadeColor(hex: string, n: number): string {
  if (n <= 0) return hex;
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const target = n % 2 === 1 ? 255 : 0; // odd → toward white, even → toward black
  const amt = Math.min(0.62, Math.ceil(n / 2) * 0.26);
  const ch = (h: string) => { const c = parseInt(h, 16); return Math.round(c + (target - c) * amt); };
  const hh = (v: number) => v.toString(16).padStart(2, "0");
  return `#${hh(ch(m[1]!))}${hh(ch(m[2]!))}${hh(ch(m[3]!))}`;
}

/** Group metric types into the render "shapes" the eye reads as one kind, so only
 * series of the SAME shape (e.g. two bar metrics) need a shade to be told apart;
 * dots vs bars vs line already differ by form and can share the base colour. */
const shapeOf = (type: string | undefined): string => (type === "bars" ? "bars" : type === "range" ? "range" : type === "scatter" ? "scatter" : "line");

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
   * record" metric; null when none is set. The optional `user` is passed when
   * several athletes are overlaid, so each series uses its OWN scaled record. */
  worldRecordKg?: (exercise: string, user?: string) => number | null;
  /** MULTI-ATHLETE overlay: when >1 user is given, a series is built per
   * (exercise × user) instead of per exercise, each labelled with the athlete. */
  users?: readonly string[];
  /** Display name for an athlete username (multi-athlete series labels). */
  userLabelOf?: (user: string) => string;
  /** Per-athlete bodyweight (kg) for the per-bodyweight view when overlaying users
   * — each series divides by its own athlete's bodyweight. */
  bodyweightOf?: (user: string) => number | null;
  /** Disable pan/zoom gesture capture (a static chart that never hijacks scroll).
   * Defaults to true (interactive). */
  interactive?: boolean;
  /** When true, NO exercises means an EMPTY graph (draw nothing) instead of the
   * whole-athlete "All exercises" aggregate — so clearing the selection leaves the
   * plot empty rather than implicitly showing everything. */
  emptyOnNoExercises?: boolean;
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
  // Empty selection: either the whole-athlete aggregate (isAll) OR a truly empty
  // plot, depending on the caller. emptyOnNoExercises wins — no implicit "show all".
  const noneSelected = input.exercises.length === 0;
  const isAll = noneSelected && !input.emptyOnNoExercises;
  // Metric defaults: a single lift reads best as Estimated 1RM; the whole-athlete
  // "all" view defaults to total VOLUME (a 1RM across mixed lifts is meaningless,
  // but total training volume per day/week is a useful whole-athlete trend).
  const defaultMetric = isAll ? "volume" : "e1rm";
  const metrics = (input.metrics.length ? input.metrics : [defaultMetric]).map(graphMetric).filter((m): m is NonNullable<typeof m> => !!m);
  const inRange = (r: SetRecord) => (!input.dateFrom || r.date >= input.dateFrom) && (!input.dateTo || r.date <= input.dateTo);
  const records = input.records.filter(inRange);
  const code = input.codeOf ?? ((n) => n);

  // "all" → one whole-athlete series per metric over EVERY logged set; otherwise
  // a series per (selected exercise × metric) — or, when several athletes are
  // overlaid, per (exercise × athlete) so each lift's line is split by who did it.
  // Same compute path either way — no mock data in the shipped view.
  const multiUser = !!(input.users && input.users.length > 1);
  const userLabel = (u: string) => input.userLabelOf?.(u) ?? u;
  const groups: { label: string; records: SetRecord[]; user?: string; userIdx?: number; exIdx?: number }[] = isAll
    ? [{ label: "All exercises", records: [...records] }]
    : multiUser
      ? input.exercises.flatMap((ex, ei) =>
          input.users!.map((u, ui) => ({
            label: `${userLabel(u)} · ${code(ex)}`,
            records: records.filter((r) => r.exerciseName === ex && r.username === u),
            user: u,
            userIdx: ui, // colour (hue) = the athlete
            exIdx: ei,   // shape = the exercise
          })),
        )
      : input.exercises.map((ex) => ({ label: code(ex), records: records.filter((r) => r.exerciseName === ex) }));

  const series: SvgSeries[] = [];
  let gi = -1;
  for (const g of groups) {
    gi++;
    // Single-exercise / single-athlete: ONE base colour per group, shaded per repeated
    // render-shape. MULTI-ATHLETE overlay: the colour is the ATHLETE's hue (one per
    // user, matching the athlete key above the chart) and EXERCISES are told apart by
    // marker SHAPE — colour = who, shape = what.
    const base = SERIES_COLORS[(multiUser ? g.userIdx ?? gi : gi) % SERIES_COLORS.length]!;
    const exShape: SvgShape | undefined = multiUser ? EXERCISE_SHAPES[(g.exIdx ?? 0) % EXERCISE_SHAPES.length] : undefined;
    const shapeSeen: Record<string, number> = {};
    const colorFor = (type: string | undefined): string => {
      // Multi-athlete: scatter keeps the pure athlete hue (shape carries the lift);
      // a line/bar of that lift gets a per-exercise shade so same-hue lines still split.
      if (multiUser) return shapeOf(type) === "scatter" ? base : shadeColor(base, g.exIdx ?? 0);
      const shape = shapeOf(type);
      const n = shapeSeen[shape] ?? 0;
      shapeSeen[shape] = n + 1;
      return shadeColor(base, n);
    };
    for (const m of metrics) {
      // "% of world record": each set's added-weight 1RM ÷ this exercise's
      // (bodyweight+sex-scaled) world record × 100. Needs the e1rm compute + the WR.
      if (m.id === "pctWR") {
        const wr = input.worldRecordKg?.(g.records[0]?.exerciseName ?? "", g.user);
        if (!wr || wr <= 0) continue;
        // Fraction of the world record (1.0 = the record). Uses the BODYWEIGHT-
        // INCLUSIVE 1RM (effectiveE1RM) vs the bodyweight-inclusive record, so it
        // stays ≥ 0 — a sub-bodyweight (assisted) effort reads low, not negative.
        const pts = g.records
          .filter((r) => r.date && effectiveE1RM(r, input.config.formula) != null)
          .map((r) => ({ x: Date.parse(r.date), y: Math.round((effectiveE1RM(r, input.config.formula)! / wr) * 1000) / 1000 }))
          .filter((p) => Number.isFinite(p.x))
          .sort((a, b) => a.x - b.x);
        if (pts.length) series.push({ name: groups.length > 1 ? `${g.label} · vs WR` : "vs world record", color: colorFor("scatter"), type: "scatter", points: pts as SvgPoint[], ...(exShape ? { shape: exShape } : {}) });
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
      // read as multiples of BW; the count metrics (right axis) are left alone. With
      // several athletes overlaid, each series uses its OWN athlete's bodyweight.
      const groupBw = g.user != null && input.bodyweightOf ? input.bodyweightOf(g.user) : input.bodyweight;
      if (input.perBodyweight && groupBw && groupBw > 0 && m.axis !== "right") {
        const bw = groupBw;
        const d = (v: number) => Math.round((v / bw) * 1000) / 1000;
        pts = pts.map((p) => ({
          ...p,
          ...(p.y != null ? { y: d(p.y) } : {}),
          ...(p.lo != null ? { lo: d(p.lo) } : {}),
          ...(p.hi != null ? { hi: d(p.hi) } : {}),
          ...(p.bands ? { bands: p.bands.map(d) } : {}),
        }));
      }
      // One group → label by metric only; several → prefix the exercise.
      const name = groups.length > 1 ? `${g.label} · ${m.label}` : m.label;
      // Vertical shift (fraction of plot height) for the Volume bars only — lifts
      // them off the strength line. Both share the same dates, so we shift in y,
      // never x. Applied as a per-series render offset by the chart.
      const isVolume = m.id === "volume" || m.id === "volumeLoad";
      if (pts.length)
        series.push({
          name, color: colorFor(m.type), type: m.type ?? "line", points: pts as SvgPoint[],
          ...((m.type ?? "line") === "scatter" && exShape ? { shape: exShape } : {}),
          ...(m.axis ? { axis: m.axis } : {}),
          ...(m.type === "bars" ? { fillOpacity: input.config.opacity } : {}),
          ...(isVolume && input.config.volumeYShift ? { yShiftFrac: input.config.volumeYShift } : {}),
        });
    }
  }

  // "% of world record" view: shade the background grayer as you climb toward the
  // record — a touch above 0.4, more above 0.6 (very light).
  const showsWr = metrics.some((m) => m.id === "pctWR");
  // Legend group chips match how the series NAMES are segmented (athlete · exercise ·
  // metric), so you can bulk show/hide a whole athlete / exercise / graph-type.
  const legendGroupLabels = isAll ? undefined
    : multiUser ? ["Athlete", "Exercise", "Type"]
    : groups.length > 1 ? ["Exercise", "Type"]
    : metrics.length > 1 ? ["Type"]
    : undefined;
  const config = {
    series, xKind: "time" as const, compactable: true, noCompactToggle: true,
    interactive: input.interactive ?? true,
    yBeginAtZero: true, rightBeginAtZero: true, height: 300, insideLabels: true,
    rightHeadroom: input.config.rightHeadroom,
    barGirth: input.config.barGirth,
    directLabels: true, // float each lift's name next to its records
    styleToggles: true, // tiny legend buttons: faint lines + line tags
    ...(legendGroupLabels ? { legendGroupLabels } : {}),
    // Free 2-D pan/zoom: both y-axes shift together, so volume and 1RM stay aligned;
    // use Right-axis / Volume-shift knobs to separate overlapping series.
    panMode: "xy" as const,
    ...(showsWr ? { yBands: [
      { from: 0.4, to: 0.6, fill: "rgba(120,120,120,0.06)" },
      { from: 0.6, fill: "rgba(120,120,120,0.12)" },
    ] } : {}),
  };
  const existing = charts.get(container);
  container.classList.add("svgc-freepan");
  if (existing) existing.update(config);
  else charts.set(container, mountSvgChart(container, config));
  return series.length;
}
