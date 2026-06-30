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
import { mountSvgChart, type SvgChart, type SvgSeries, type SvgPoint, type SvgShape, type SvgChartConfig, type ViewBox } from "./svgChart";
import { decayedStrengthSeries, effectiveE1RM } from "./aggregate";
import type { SetRecord } from "./domain";
import { graphMetric, type GraphPoint } from "./graphMetrics";
import { bestFitNuzzo1RM, nuzzoWeightForReps, nuzzo1RM } from "./metrics";
import type { GraphConfig } from "./graphConfig";
import { INTERVAL_LABELS } from "./graphConfig";

// Series palette built around the app's "Girl with a Pearl Earring" theme: the two
// anchors are lapis BLUE and ochre GOLD (the accent + gold tokens), then a harmonious
// muted earth/jewel spread (terracotta, pine teal, amethyst, bronze, cornflower,
// amber, sage, mauve) — Vermeer-restrained, near-complementary, all medium-toned so
// they read on both the light and dark backgrounds. Colour = who, so the first few
// (one per athlete) matter most. shadeColor() lightens/darkens for sub-series.
const SERIES_COLORS = ["#284e86", "#b8902f", "#9c463a", "#34786f", "#5b4f96", "#7a6526", "#6b8fc4", "#c2762f", "#4e8059", "#9c5a86", "#3d5e8c", "#cdab57"];
/** Scatter marker shapes, used in the multi-athlete overlay to tell EXERCISES apart
 * by FORM while each ATHLETE keeps one colour (hue) — so colour = who, shape = what. */
const EXERCISE_SHAPES: SvgShape[] = ["circle", "diamond", "square", "triangle", "ring", "plus"];

/** The palette colour at index `i` (wraps). Exposed so a multi-athlete view can
 * render an athlete colour key that matches the lines (each athlete = one colour). */
export function seriesPaletteColor(i: number): string {
  return SERIES_COLORS[((i % SERIES_COLORS.length) + SERIES_COLORS.length) % SERIES_COLORS.length]!;
}

// Colour for the i-th of n series. The CURATED blue/gold palette above IS the
// n-colour answer — it leads with the theme's lapis + ochre and extends into a
// harmonious muted earth/jewel spread, so every n stays ON-THEME (not a full-wheel
// rainbow) while staying distinct across the realistic ≤10-series range. `n` is kept
// for API symmetry (1–2 series are still just blue / gold, the palette's first two).
export function harmoniousColor(i: number, _n: number): string {
  return seriesPaletteColor(i);
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
  /** Fixed plot height in px (overrides the per-mode default), so a caller can keep one
   * constant height across graph types — e.g. the dashboard reel, where a changing height
   * makes switching bubbles feel like a snap rather than a swipe. */
  height?: number;
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
  /** Draggable vertical fit-window markers (the projection's include-from/to lines),
   * in ms timestamps. Passed straight to the chart; omitted = no markers. */
  xMarkers?: { id: string; x: number; color?: string; label?: string }[] | undefined;
  /** Static vertical reference lines (e.g. a "today" marker) in ms timestamps. Passed
   * straight to the chart; non-draggable. Omitted = none. */
  xRefLines?: { x: number; color?: string; label?: string }[] | undefined;
  /** Horizontal value-zone bands on the left (kg) axis. Ignored on the %WR view (own bands). */
  yBands?: { from: number; to?: number; fill: string }[] | undefined;
  /** Filled ribbons that FOLLOW a curve over time (left axis) — e.g. the 60–80% / 80–100%-of-
   * each-day's-strength intensity zones. Each point gives the band's top & bottom y at that x. */
  areaBands?: { points: { x: number; yTop: number; yBot: number }[]; fill: string; label?: string }[] | undefined;
  /** Called on release after dragging a fit-window marker (id + new ms timestamp). */
  onMarkerDrag?: ((id: string, x: number) => void) | undefined;
  /** Reps-vs-weight fit: a manual EFFECTIVE 1RM that POSITIONS the Nuzzo curve for an
   * exercise (null = auto best-fit). Lets the green curve be DRAGGED to adjust, the same
   * way the projection fit-window markers work. Only consulted for a SINGLE plotted lift. */
  rvwFitOf?: (exercise: string) => number | null;
  /** Called on release after dragging the reps-vs-weight fit line (exercise + new
   * effective 1RM). */
  onRvwFitDrag?: (exercise: string, effOneRm: number) => void;
  /** The FULL (all-windows) reps×weight extent — pins the rvw axes so paging a 2-week
   * window (or dragging the fit) keeps a STABLE frame instead of re-fitting/jumping. */
  rvwAxis?: { xMin: number; xMax: number; yMax: number } | undefined;
  /** Restore a saved pan/zoom view on mount (the dashboard remembers each bubble's view
   * across switches / refresh); null / absent = auto-fit to the data. */
  initialView?: ViewBox | null | undefined;
  /** Persist the user's pan/zoom (the new view), or null when they re-fit. */
  onViewChange?: ((view: ViewBox | null) => void) | undefined;
  /** Jump to an exercise's logged history (powers the pinned popup's "→ in history" link). */
  onPointHistory?: ((ex: string) => void) | undefined;
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
// Which MODE the mounted chart is in ("ts" time-series / "rvw" reps-vs-weight). The
// two configs differ fundamentally (time vs linear X, totally different keys), and
// update() MERGES configs (PB-8) — so on a mode switch we drop the instance and
// remount fresh (mountSvgChart clears the container) rather than merge stale keys.
const chartMode = new WeakMap<HTMLElement, string>();

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
  const metricIds = new Set(metrics.map((m) => m.id));
  const dualVol = metricIds.has("volume") && metricIds.has("volumeLoad");
  const volIv = input.config.interval;
  const volAltIv = input.config.volumeAltInterval ?? volIv;
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

  // ---- REPS vs WEIGHT mode (owner) -------------------------------------------
  // A non-time scatter: every set of each selected exercise plotted at (x = weight
  // kg, y = reps), one colour per exercise (or per athlete×exercise overlaid), with
  // an optional per-exercise least-squares best-fit line. Bypasses the whole metric/
  // time-series pipeline below — it's a fundamentally different plot.
  if (input.config.repsVsWeight) {
    const rvw: SvgSeries[] = [];
    const singleGroup = groups.length === 1; // a draggable fit only makes sense for ONE curve
    // The fit curve + its drag handle use the app's TEAL accent (same as "Your lifts" /
    // the projection markers) — the harmonious green-ish, not a raw green (owner).
    const RVW_FIT_GREEN = "#2f8f88";
    let fitMarker: { exercise: string; markerX: number; bodyShare: number; refReps: number; scale: number } | null = null;
    let fitCurve: SvgPoint[] | null = null; // the single-lift fit curve → drives the RIR zones
    // ×BW (per-bodyweight) view: divide the DISPLAYED dial weight by the athlete's bodyweight
    // so the X axis reads as multiples of bodyweight (a 100 kg squat at 80 kg BW = 1.25×) —
    // letting athletes of different sizes line up. Each series uses its OWN athlete's bw. The
    // fit + axis pinning stay in KG (only the displayed x is scaled); axisScale carries the
    // single-lift scale through to the pinned axis range. 0 / unknown bw → scale 1 (plain kg).
    let axisScale = 1;
    groups.forEach((g, gi2) => {
      const base = multiUser ? harmoniousColor(g.userIdx ?? gi2, input.users!.length) : harmoniousColor(gi2, groups.length);
      const groupBw = g.user != null && input.bodyweightOf ? input.bodyweightOf(g.user) : input.bodyweight;
      const scale = (input.perBodyweight && groupBw && groupBw > 0) ? groupBw : 1;
      if (singleGroup) axisScale = scale;
      // Plot the LOGGED dial weight (origWeight) the athlete actually used — NOT the
      // bodyweight-inclusive effective load that computeRecord stamps onto `weight`
      // (which showed loads they never lifted, e.g. a bodyweight-folded DL at 60 vs the
      // 40 on the bar). Matches the workout history's display rule (WO-194).
      const dispW = (r: SetRecord): number | null => (r.origWeight != null ? r.origWeight : r.weight);
      // Recency emphasis (owner): fade OLD sets, keep recent ones solid, and let a set from
      // the last 2 weeks "shine" (glow). Opacity steps down with age in days.
      const now = Date.now();
      const ageOp = (date: string): number => {
        const t = Date.parse(date);
        if (!Number.isFinite(t)) return 0.5;
        const days = (now - t) / 86_400_000;
        return days < 14 ? 0.9 : days < 30 ? 0.72 : days < 90 ? 0.55 : days < 180 ? 0.42 : 0.3;
      };
      const pts = g.records
        .filter((r) => dispW(r) != null && r.reps != null && r.reps > 0)
        .map((r) => {
          const w = Math.round(dispW(r)! * 10) / 10;
          const fresh = Number.isFinite(Date.parse(r.date)) && (now - Date.parse(r.date)) / 86_400_000 < 14;
          const rir = input.config.rirOf?.(r); // size the bubble by effort (lower RIR = bigger)
          // Full per-dot facts for the pinned popup (owner): the DATE, the original LOGGED
          // weight×reps, the effective load when it differs, the VARIANTS (note), then RIR —
          // plus histEx so the popup can link to where the set was logged.
          const eff = r.weight != null ? Math.round(r.weight * 10) / 10 : null;
          const detailLines = [r.date, `${w}kg × ${r.reps} logged`];
          if (eff != null && Math.abs(eff - w) > 0.05) detailLines.push(`${eff}kg effective`);
          if (r.notes?.trim()) detailLines.push(r.notes.trim());
          if (rir != null && Number.isFinite(rir)) detailLines.push(`RIR ${Math.round(rir * 10) / 10}`);
          const pt: { x: number; y: number; meta: string; op: number; glow: boolean; rir?: number; detail: string; histEx: string } =
            { x: w, y: r.reps!, meta: `${g.label}: ${w}kg × ${r.reps}`, op: ageOp(r.date), glow: fresh, detail: detailLines.join("\n"), histEx: r.originalExerciseName ?? r.exerciseName };
          if (rir != null && Number.isFinite(rir)) pt.rir = rir;
          return pt;
        });
      if (!pts.length) return;
      // pts keep x in KG (the fit below reads p.x); the scatter SERIES shows the ×BW-scaled x.
      const dispPts = scale === 1 ? pts : pts.map((p) => ({ ...p, x: Math.round((p.x / scale) * 1000) / 1000 }));
      rvw.push({ name: groups.length > 1 ? g.label : "Sets", color: base, type: "scatter", points: dispPts as SvgPoint[] });
      if (input.config.repsVsWeightFit) {
        // Best-fit NUZZO curve (owner), not a straight line: find the 1RM that best
        // places the Nuzzo reps↔%1RM curve through these sets, then sample it across the
        // data's rep span — a smooth load-rep curve that bows the way real strength does.
        // BODYWEIGHT-AWARE (#prune, sibling of the card fix): the dots are the ADDED dial
        // weight, but the Nuzzo % applies to the EFFECTIVE load (added + bodyweight share),
        // so fit on effective and translate the curve back down by the share — for a
        // pull-up the curve then bows AND drops into negative (assisted) kg. The share is
        // the bodyweight folded into `weight` (weight − added), ~constant per lift; 0 for
        // bar-only lifts, so they're unchanged.
        let shareSum = 0, shareN = 0;
        for (const r of g.records) {
          const add = r.origWeight != null ? r.origWeight : r.weight;
          if (r.weight != null && add != null) { shareSum += r.weight - add; shareN++; }
        }
        const bodyShare = shareN ? shareSum / shareN : 0;
        // The Nuzzo fit needs a POSITIVE effective load. For an assisted lift whose bodyweight
        // share isn't known (no bodyweight on file → share 0), the effective weights go ≤0 and
        // bestFitNuzzo1RM returns garbage — a curve disconnected from the dots ("pull-ups nuzzo
        // broken"). Skip the curve then (the dots still plot); it draws once a real load exists.
        if (pts.some((p) => p.x + bodyShare <= 0)) return;
        const exName = g.records[0]?.exerciseName ?? g.label;
        // A manually-dragged fit 1RM (single lift only) POSITIONS the curve; else auto best-fit.
        const auto = bestFitNuzzo1RM(pts.map((p) => ({ reps: p.y, weight: p.x + bodyShare }))); // effective 1RM
        const oneRm = (singleGroup ? input.rvwFitOf?.(exName) ?? null : null) ?? auto;
        const ys = pts.map((p) => p.y);
        const r0 = Math.max(1, Math.floor(Math.min(...ys)));
        const r1 = Math.ceil(Math.max(...ys));
        if (oneRm && r1 > r0) {
          const curve: SvgPoint[] = [];
          const step = (r1 - r0) / 48; // ~48 samples → visually smooth
          for (let r = r0; r <= r1 + 1e-9; r += step) {
            const eff = nuzzoWeightForReps(oneRm, r);
            if (eff != null) curve.push({ x: Math.round(((eff - bodyShare) / scale) * 100) / 100, y: Math.round(r * 100) / 100 } as SvgPoint);
          }
          if (curve.length > 1) {
            // The single-lift fit curve is GREEN + draggable (owner); multi-lift keeps per-lift
            // colour. DASHED (no dots) so it reads as the fitted Nuzzo curve, not data (owner).
            // noExtendX: the curve must NOT drive the x-domain — else dragging the fit re-fits the
            // view and the whole plot JUMPS on release (owner: "jumps around confusingly").
            rvw.push({ name: `${g.label} fit`, color: singleGroup ? RVW_FIT_GREEN : base, type: "line", noLegend: true, points: curve, dashed: true, noExtendX: singleGroup });
            // PB-35: anchor the drag handle at the curve's HEAVIEST drawn point (its r0-rep
            // end — curve[0], the rightmost VISIBLE point), NOT the off-screen 1RM (which fell
            // outside the auto-fitted x-domain → invisible). Dragging sets the 1RM that puts the
            // curve through (newX, r0 reps) — see onMarkerDrag below.
            if (singleGroup) { fitMarker = { exercise: exName, markerX: curve[0]!.x as number, bodyShare, refReps: r0, scale }; fitCurve = curve; }
          }
        }
      }
    });
    // Pin the axes to the FULL extent (single lift) so paging a 2-week window — or dragging
    // the fit — keeps a STABLE frame and you can SEE the points move (owner: "shouldn't jump,
    // I can't tell the change … no autofit"). Set explicitly (undefined when off) — update()
    // merges, so a stale forced range must be cleared (PB-8).
    const axis = singleGroup ? input.rvwAxis : undefined;
    const perBW = !!input.perBodyweight;
    const cfg: SvgChartConfig = {
      series: rvw, xKind: "linear", height: input.height ?? 360, panMode: "xy", yBeginAtZero: true, leftMargin: 30,
      formatX: perBW ? (x) => x.toFixed(1) : (x) => `${Math.round(x)}`,
      formatTipX: perBW ? (x) => `${x.toFixed(2)}× BW` : (x) => `${Math.round(x)} kg`,
      xTitle: perBW ? "× bodyweight" : "weight (kg)", yTitle: "reps",
      // The pinned axis extent is computed in KG by the caller — scale it by the single lift's
      // bodyweight so the ×BW view pins to the matching BW range (axisScale = 1 in kg mode).
      forceXRange: axis ? { min: axis.xMin / axisScale, max: axis.xMax / axisScale } : undefined,
      forceLeftRange: axis ? { min: 0, max: axis.yMax } : undefined,
      initialView: input.initialView, onViewChange: input.onViewChange, // remember pan/zoom
      onPointHistory: input.onPointHistory,
    };
    // RIR effort zones (single lift): ribbons stepping DOWN from the failure curve in REPS —
    // 0–3 RIR (a hard set), 3–6, 6–12 — teal, fading out the easier they get (matches the card).
    if (fitCurve) {
      const fc: SvgPoint[] = fitCurve;
      const band = (top: number, bot: number, fill: string, label: string) => ({
        points: fc.map((p) => ({ x: p.x, yTop: Math.max(0, (p.y as number) - top), yBot: Math.max(0, (p.y as number) - bot) })),
        fill, label, labelColor: RVW_FIT_GREEN,
      });
      cfg.areaBands = [
        band(0, 3, "rgba(47,143,136,0.15)", "hard sets (≤3 RIR)"),
        band(3, 6, "rgba(47,143,136,0.09)", "3–6 RIR"),
        band(6, 12, "rgba(47,143,136,0.045)", "6–12 RIR"),
      ];
    }
    // Drag the green Nuzzo curve to adjust its fit — a draggable vertical "fit" line sitting
    // on the curve's heaviest drawn point (reusing the projection fit-marker mechanism + its
    // dashed line / handle / "fit" label). Releasing maps the new weight back to a 1RM via the
    // Nuzzo curve at that point's reps (x_eff = newX + bodyweight share), committing the fit.
    if (fitMarker) {
      const fm: { exercise: string; markerX: number; bodyShare: number; refReps: number; scale: number } = fitMarker;
      cfg.xMarkers = [{ id: "rvwfit", x: fm.markerX, color: RVW_FIT_GREEN, label: "fit" }];
      cfg.onMarkerDrag = (id, x) => {
        if (id !== "rvwfit") return;
        // x comes back in the DISPLAYED unit (×BW when scaled) — multiply back to kg for the
        // Nuzzo 1RM (effective = added kg + bodyShare).
        const eff = nuzzo1RM(x * fm.scale + fm.bodyShare, fm.refReps);
        if (eff != null) input.onRvwFitDrag?.(fm.exercise, eff);
      };
    }
    if (chartMode.get(container) !== "rvw") { charts.delete(container); chartMode.set(container, "rvw"); }
    container.classList.add("svgc-freepan");
    const existingRvw = charts.get(container);
    if (existingRvw) existingRvw.update(cfg);
    else charts.set(container, mountSvgChart(container, cfg));
    return rvw.filter((s) => s.type === "scatter").length;
  }
  // Switching back to the time-series plot from reps-vs-weight → remount fresh too.
  if (chartMode.get(container) !== "ts") { charts.delete(container); chartMode.set(container, "ts"); }

  const series: SvgSeries[] = [];
  // Per-bodyweight: track the RAW kg MAX of the left-axis series so the y-axis can be
  // pinned to (kg range ÷ the MAIN athlete's bodyweight). That keeps the main athlete's
  // curve exactly where it was in kg (1.0 sits where their bodyweight was) and lets the
  // other athletes stretch / contract against it.
  let kgMax = -Infinity;
  let gi = -1;
  for (const g of groups) {
    gi++;
    // Single-exercise / single-athlete: ONE base colour per group, shaded per repeated
    // render-shape. MULTI-ATHLETE overlay: the colour is the ATHLETE's hue (one per
    // user, matching the athlete key above the chart) and EXERCISES are told apart by
    // marker SHAPE — colour = who, shape = what.
    // 3+ colours → a generated, evenly-spaced harmonious palette (colour theory);
    // 1–2 keep the signature blue/gold. Multi-athlete: hue = the athlete (n = users);
    // single-athlete: hue = the exercise (n = groups).
    const base = multiUser
      ? harmoniousColor(g.userIdx ?? gi, input.users!.length)
      : harmoniousColor(gi, groups.length);
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
        pts = decayedStrengthSeries(pts.map((p) => ({ x: p.x, y: p.y ?? 0 })), Date.now(), 4, input.config.decayParams);
      }
      if (m.type !== "range" && input.config.smoothing > 0) pts = movingAverage(pts, input.config.smoothing);
      // Per-bodyweight view: divide the kg (left-axis) metrics by bodyweight so they
      // read as multiples of BW; the count metrics (right axis) are left alone. With
      // several athletes overlaid, each series uses its OWN athlete's bodyweight.
      // "% of best" (pctBest) is ALREADY a relative fraction, not kg — never divide it.
      const isFraction = m.id === "pctBest";
      const groupBw = g.user != null && input.bodyweightOf ? input.bodyweightOf(g.user) : input.bodyweight;
      if (input.perBodyweight && m.axis !== "right" && !isFraction) {
        // Note the raw kg MAX (all left-axis series) before dividing, for the pin.
        for (const p of pts) for (const v of [p.y, p.lo, p.hi, ...(p.bands ?? [])]) {
          if (v != null && Number.isFinite(v) && v > kgMax) kgMax = v;
        }
      }
      if (input.perBodyweight && groupBw && groupBw > 0 && m.axis !== "right" && !isFraction) {
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
      let name = groups.length > 1 ? `${g.label} · ${m.label}` : m.label;
      if (dualVol && m.id === "volume") name += ` (${INTERVAL_LABELS[volIv]})`;
      if (dualVol && m.id === "volumeLoad") name += ` (${INTERVAL_LABELS[volAltIv]})`;
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
          // Predicted Strength projects into the future. It now EXTENDS the time axis so
          // the chosen horizon (out to 15 yr) is actually visible and the ceiling-approach
          // curve has room to flatten (owner: "the graph should extend to 15 years"). Dashed
          // so the forecast still reads as a projection, not as logged data.
          // Strength Decay is also dashed (owner: "should be a dashed line not a collection of
          // bubbles") — decayedStrengthSeries emits many points, so as a plain line it drew a
          // dot at each; dashed turns those off (dotR=0) and reads as a continuous trend.
          ...(m.id === "predicted" || m.id === "strengthDecay" ? { dashed: true } : {}),
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
  // Per-bodyweight: pin the left axis to the kg view ÷ the MAIN athlete's bodyweight, so
  // toggling kg ⇄ BW never moves the main athlete (1.0 lands where their 1RM-in-kg axis
  // was). CRITICAL (PB-8): use the SAME top padding the kg auto-fit uses — 8% measured
  // from ZERO (begin-at-zero), i.e. kgMax × 1.08 — NOT 8% of the data spread (max−min).
  // The two paddings diverge when the lifts sit high (e.g. 30–65 kg), which is what made
  // the graph jump on the kg ⇄ BW toggle. Mirroring the kg view makes BW = kg ÷ bw exactly.
  const mainBw = input.bodyweight ?? null;
  const forceLeftRange = (input.perBodyweight && mainBw && mainBw > 0 && Number.isFinite(kgMax))
    ? { min: 0, max: (kgMax + (kgMax * 0.08 || 1)) / mainBw }
    : undefined;
  // EXPERIMENTAL "native log": transform each LEFT-axis (strength/kg) point's VALUE to
  // −ln(ceiling − value) and plot THAT on a normal linear axis. So the data itself becomes
  // the log values (vs the axis-scale "potentialLog" which leaves the values in kg). The
  // axis then stays linear, so pan/zoom is naturally correct.
  const nativeCeil = input.config.potentialNativeLog && typeof input.config.potentialCeiling === "number" && input.config.potentialCeiling > 0
    ? input.config.potentialCeiling : null;
  if (nativeCeil !== null) {
    const tf = (y: number) => -Math.log(Math.max(0.5, nativeCeil - y));
    for (const s of series) {
      if (s.axis === "right") continue; // volume/right axis stays as-is
      s.points = s.points.map((p) => {
        const q: typeof p = { ...p };
        if (typeof p.y === "number") (q as { y: number }).y = tf(p.y);
        if (typeof (p as { lo?: number }).lo === "number") (q as { lo?: number }).lo = tf((p as { lo: number }).lo);
        if (typeof (p as { hi?: number }).hi === "number") (q as { hi?: number }).hi = tf((p as { hi: number }).hi);
        return q;
      });
    }
  }
  const config = {
    series, xKind: "time" as const, compactable: true, noCompactToggle: true,
    interactive: input.interactive ?? true,
    yBeginAtZero: true, rightBeginAtZero: true, height: input.height ?? 300, insideLabels: true,
    // PB-8 (real root): the chart's update() MERGES this config over the previous one
    // (`{...cfg, ...next}`), so any optional key OMITTED when its feature is off keeps its
    // stale ON value. That's why kg→BW worked but BW→kg left the y-axis pinned to the BW
    // range (0–1.4) and clipped the kg points off the top → empty graph. So every
    // toggleable key below is ALWAYS present (undefined when off), never conditionally
    // spread — undefined overwrites the stale value through the merge.
    // The "potential log" view spaces the left axis non-linearly toward a kg ceiling, so
    // it must NOT also be ×BW-pinned (a kg ceiling vs BW-unit data). Drop the pin when on.
    forceLeftRange: input.config.potentialLog ? undefined : forceLeftRange,
    potentialLog: input.config.potentialLog, // always present (undefined when off) — PB-8 rule
    potentialCeiling: input.config.potentialCeiling,
    rightHeadroom: input.config.rightHeadroom,
    barGirth: input.config.barGirth,
    directLabels: true, // float each lift's name next to its records
    styleToggles: true, // tiny legend buttons: faint lines + line tags
    legendGroupLabels, // undefined → no grouped legend (cleared when grouping changes)
    // Free 2-D pan/zoom: both y-axes shift together, so volume and 1RM stay aligned;
    // use Right-axis / Volume-shift knobs to separate overlapping series.
    panMode: "xy" as const,
    yBands: showsWr
      ? [
          { from: 0.4, to: 0.6, fill: "rgba(120,120,120,0.06)" },
          { from: 0.6, fill: "rgba(120,120,120,0.12)" },
        ]
      : input.yBands, // caller-supplied horizontal zones (off here unless given)
    areaBands: input.areaBands, // 60–80% / 80–100%-of-each-day's-strength ribbons (always present so the merge clears them when off — PB-8)
    // Projection fit-window lines (always present so the merge clears them when off — PB-8).
    xMarkers: input.xMarkers,
    xRefLines: input.xRefLines,
    onMarkerDrag: input.onMarkerDrag,
    initialView: input.initialView, // restore the bubble's saved pan/zoom on mount
    onViewChange: input.onViewChange, // persist the user's pan/zoom (null = re-fit)
    onPointHistory: input.onPointHistory,
  };
  const existing = charts.get(container);
  container.classList.add("svgc-freepan");
  if (existing) existing.update(config);
  else charts.set(container, mountSvgChart(container, config));
  return series.length;
}
