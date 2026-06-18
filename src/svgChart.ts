/**
 * From-scratch SVG chart engine — the Chart.js replacement across the app. NO
 * Chart.js, no canvas: a fixed plot rectangle (so the axis frame never shifts),
 * pan (drag) + zoom (wheel/pinch), and a tap/hover tooltip.
 *
 * Series kinds:
 *   • "line"  — points {x, y}; polyline + dots.
 *   • "range" — points {x, lo, hi}; one floating bar per point.
 *   • "bars"  — points {x, y}; a vertical bar from 0 to y.
 * A series may sit on the "right" axis (its own y-scale) for dual-axis charts.
 *
 * The pure axis maths (calendar gridlines, nice y ticks) live in chartAxis.ts and
 * are unit-tested; this module is the rendering + interaction shell.
 */
import { timeBands, timeLevel, niceTicks, buildCompactor, type TimeCompactor } from "./chartAxis";

/* "Compacted time" is a single app-wide preference: flip it on any time chart and
 * every time chart follows, so the axis mode is consistent everywhere. Stored on
 * the device; subscribers (the mounted compactable charts) re-draw on change. */
const COMPACT_KEY = "colosseum.timeCompact.v1";
let compactPref = (() => { try { return localStorage.getItem(COMPACT_KEY) === "1"; } catch { return false; } })();
const compactSubs = new Set<() => void>();
function setCompactPref(on: boolean): void {
  if (on === compactPref) return;
  compactPref = on;
  try { localStorage.setItem(COMPACT_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  for (const fn of [...compactSubs]) fn();
}

/** Read / set the app-wide "compacted time" preference (so a caller can surface
 * the toggle in its own settings menu instead of the chart legend). */
export const getTimeCompact = (): boolean => compactPref;
export const setTimeCompact = (on: boolean): void => setCompactPref(on);

/* Two app-wide chart-STYLE prefs, toggled by tiny legend buttons (only on charts
 * that opt in via cfg.styleToggles): faintLines draws trend/strength LINES thin,
 * dashed and greyed so the data dots dominate; dataTags floats a leader-line + brace
 * "tag" naming each line so you can still tell them apart when faint. Stored on the
 * device; subscribers redraw on change. */
const FAINT_KEY = "colosseum.faintLines.v1";
const TAGS_KEY = "colosseum.dataTags.v1";
let faintLines = (() => { try { return localStorage.getItem(FAINT_KEY) === "1"; } catch { return false; } })();
let dataTags = (() => { try { return localStorage.getItem(TAGS_KEY) === "1"; } catch { return false; } })();
const styleSubs = new Set<() => void>();
function setFaintLines(on: boolean): void { if (on === faintLines) return; faintLines = on; try { localStorage.setItem(FAINT_KEY, on ? "1" : "0"); } catch { /* ignore */ } for (const fn of [...styleSubs]) fn(); }
function setDataTags(on: boolean): void { if (on === dataTags) return; dataTags = on; try { localStorage.setItem(TAGS_KEY, on ? "1" : "0"); } catch { /* ignore */ } for (const fn of [...styleSubs]) fn(); }

/** Blend a #rrggbb colour toward its own grey (luma) by `amt` (0..1) → #rrggbb. */
function grayify(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const gray = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
  r = Math.round(r + (gray - r) * amt); g = Math.round(g + (gray - g) * amt); b = Math.round(b + (gray - b) * amt);
  const hh = (v: number) => v.toString(16).padStart(2, "0");
  return `#${hh(r)}${hh(g)}${hh(b)}`;
}

/** Scatter marker shapes — used to tell series apart by FORM (not just colour). */
export type SvgShape = "circle" | "diamond" | "square" | "triangle" | "ring" | "plus";
export interface SvgPoint {
  x: number;
  y?: number; // line / bars
  lo?: number; // range bottom
  hi?: number; // range top
  /** For range bars: split the line into exactly this many dashes (e.g. reps). */
  dashes?: number;
  /** For range bars: the y-value at each rep, lo→hi. Splits the bar into one
   * section per rep (each ending at that rep's 1RM-equivalent), drawn as
   * alternating-shade segments with a divider tick between them. */
  bands?: number[];
  /** Extra text shown in the tooltip (e.g. "120×5"). */
  meta?: string;
  /** Full per-point detail for the click-to-pin popup, one fact per line (e.g.
   * date, weight×reps, 1RM, RIR, notes). Falls back to value+meta when absent. */
  detail?: string;
  /** Source exercise this point came from — when set (and cfg.onPointHistory is given)
   * the pinned popup shows a "→ in history" link that jumps to that exercise. */
  histEx?: string;
  /** A failed attempt (note contained "fail") — drawn as an ✕ in the series colour. */
  fail?: boolean;
  /** A new record (running-max) set — drawn as a diamond instead of a dot. */
  pr?: boolean;
  /** Reps-in-reserve — scales the scatter dot (higher RIR = smaller; null = biggest). */
  rir?: number;
  /** Per-POINT marker shape (overrides the series shape only when the series has
   * none): a combined/comparison lift shapes each member-origin differently, same
   * colour, so the mixed sources are tellable apart. */
  shape?: SvgShape;
  /** Per-POINT scatter fill-opacity override (0..1). Used to FADE old sets and keep
   * recent ones solid (recency emphasis). Falls back to the default when absent. */
  op?: number;
  /** Per-POINT glow — a soft halo behind the scatter marker, for a VERY recent set so it
   * "shines" (e.g. logged in the last 2 weeks). */
  glow?: boolean;
}
export interface SvgSeries {
  name: string;
  color: string;
  type: "line" | "range" | "bars" | "scatter";
  /** Scatter only: marker shape. Lets a multi-series chart use ONE colour (hue) per
   * group (e.g. per athlete) and a different SHAPE per series (e.g. per exercise),
   * so colour reads as "who" and shape as "what". Default = circle. */
  shape?: SvgShape;
  /** Which y-scale this series uses (default "left"). */
  axis?: "left" | "right";
  points: SvgPoint[];
  /** Keep this series out of the legend (e.g. a trend line). */
  noLegend?: boolean;
  /** Start hidden (the user can switch it on via the legend toggle). */
  hidden?: boolean;
  /** Bars only: draw as a thin outline (no fill) so they don't cover other series. */
  outline?: boolean;
  /** Fill opacity 0..1 (e.g. bars you want see-through over other series). Default 1. */
  fillOpacity?: number;
  /** This series may DRAW but must never widen the x (time) domain — for future
   * projections (e.g. Predicted Strength) whose tail extends past the real data.
   * The axis stays anchored to the logged data and the projection is clipped. */
  noExtendX?: boolean;
  /** Draw this line dashed even outside "faint" mode — marks a series as a FORECAST
   * (the projection / Predicted Strength), so it never reads as logged data. */
  dashed?: boolean;
  /** Line series only: don't draw the per-point dots (just the connecting line) — for
   * same-day session connectors where a separate scatter series owns the dots. */
  noDots?: boolean;
  /** Vertical shift for THIS series only, as a fraction of the plot height
   * (+ = up, − = down). A pure visual reposition — moves the whole series (bars
   * move with their baseline) without changing its values; used to lift the
   * Volume bars off the strength line so the two don't overlap. Default 0. */
  yShiftFrac?: number;
}
export interface SvgChartConfig {
  series: SvgSeries[];
  height?: number;
  /** Override the left margin (px) — narrow it when the y-tick labels are short (e.g.
   * 2-digit reps) so the plot fills more width. Outer-label charts only; default 46. */
  leftMargin?: number;
  /** Pin the X axis to this exact range on (re)fit, instead of auto-fitting to the data —
   * used by the reps×weight view so paging 2-week windows (or dragging the fit) keeps a
   * STABLE frame (the points move within it) instead of re-fitting and jumping. Pass
   * undefined to clear (PB-8 — set it explicitly per render). */
  forceXRange?: { min: number; max: number } | undefined;
  /** Force the (left) y-axis to include 0. */
  yBeginAtZero?: boolean;
  /** Pin the left y-axis to this exact range on (re)fit, instead of auto-fitting to
   * the data — used by the per-bodyweight view to keep the main athlete's curve in
   * place (axis = kg range ÷ their bodyweight) while other athletes stretch. Pan /
   * zoom still override it. */
  // Allow explicit `undefined` (not just absent): producers pass these keys ALWAYS — set
  // to undefined when off — so the merge in update() clears a stale value instead of
  // keeping the previous one (PB-8: BW→kg left the axis pinned to the BW range).
  forceLeftRange?: { min: number; max: number } | undefined;
  rightBeginAtZero?: boolean;
  /** "Lifetime potential" log view: space the LEFT axis by −ln(ceiling − value) so an
   * exponential approach to the ceiling straightens out. Off / ceiling≤data = linear. */
  potentialLog?: boolean | undefined;
  potentialCeiling?: number | undefined;
  /** Stretch the right y-axis by this factor so its series sit low/squished
   * (e.g. 3 = bars only fill the bottom third). Default 1. */
  rightHeadroom?: number;
  /** Bar width multiplier (default 1) — fattens/slims every bar. */
  barGirth?: number;
  /** Float each series' name next to its last record (point), in the series colour
   * — "direct labelling" so you can read which lift is which without the legend. */
  directLabels?: boolean;
  yUnit?: string;
  rightUnit?: string;
  xKind?: "time" | "linear";
  /** Time charts only: show a "realistic ⇄ compacted time" toggle in the legend
   * row. Compacted mode squeezes the empty gaps so every session fits on screen
   * (see buildCompactor). The toggle is app-wide — all compactable charts follow. */
  compactable?: boolean;
  /** Compactable charts only: suppress the in-legend "⇄ Realistic/Compacted"
   * button (e.g. when the caller surfaces the toggle in its own settings menu). */
  noCompactToggle?: boolean;
  /** Axis tick label for an x value. */
  formatX?: (x: number) => string;
  /** Tooltip header for an x value (defaults to formatX). */
  formatTipX?: (x: number) => string;
  /** Draw axis values inside the plot (wider) vs in outer margins. */
  insideLabels?: boolean;
  /** Axis TITLES (e.g. "weight (kg)" / "reps"). Outer-label charts only; they widen
   *  the bottom/left margins to make room. Ignored when insideLabels is on. */
  xTitle?: string;
  yTitle?: string;
  /** Allow pan/zoom (default true). */
  interactive?: boolean;
  /** "xy" (default) = free 2-D pan/zoom; "x" = horizontal only (y stays put). */
  panMode?: "x" | "xy";
  /** Note shown under the legend. */
  note?: string;
  /** Labels for the " · "-separated SEGMENTS of the series names (e.g. ["Athlete",
   * "Exercise", "Type"]). When set, the legend menu adds a row of show/hide CHIPS per
   * segment — tapping a value toggles every series sharing it on/off at once, so you
   * can hide a whole athlete / exercise / graph-type in one tap. */
  legendGroupLabels?: string[] | undefined;
  /** Opt in to the two tiny legend style toggles: "faint lines" (thin/dashed/grey
   * trend lines so the data dots dominate) and "tags" (leader-line brace labels that
   * name each line). They drive app-wide prefs but only affect charts that opt in. */
  styleToggles?: boolean;
  /** Horizontal background bands on the LEFT axis (value zones), e.g. shade the
   * region as you approach a target. Drawn behind everything. */
  yBands?: { from: number; to?: number; fill: string }[] | undefined;
  /** Filled ribbon(s) between two y-curves over x (left axis), e.g. the "hard sets"
   * zone under the Nuzzo failure line. Each point gives the band's top & bottom y at
   * that x; drawn behind the series. An optional label floats inside the band. */
  areaBands?: { points: { x: number; yTop: number; yBot: number }[]; fill: string; label?: string; labelColor?: string }[] | undefined;
  /** Vertical background bands on the X axis (value zones), e.g. the 3–6RM / 6–12RM
   * load zones. Drawn behind the series; an optional label floats at the top. */
  xBands?: { from: number; to: number; fill: string; label?: string; labelColor?: string }[] | undefined;
  /** Draggable VERTICAL markers in x (data) space — e.g. the projection fit-window
   * start/end lines. Each draws a labelled line + grab handle; dragging one calls
   * onMarkerDrag with its committed x. Inert (no extra interaction) when absent. */
  xMarkers?: { id: string; x: number; color?: string; label?: string }[] | undefined;
  /** STATIC vertical reference lines in x (data) space — non-draggable, no grip, thin.
   * E.g. a "today" marker on a time chart. Skipped when its x falls outside the view. */
  xRefLines?: { x: number; color?: string; label?: string }[] | undefined;
  /** Called on release after a marker drag, with the marker id and its new x value. */
  onMarkerDrag?: ((id: string, x: number) => void) | undefined;
  /** Draggable HORIZONTAL markers in y (LEFT-axis data) space — e.g. the projection's
   * ceiling line the strength curve flattens toward. Each draws a labelled line + grab
   * handle spanning the plot width; dragging one calls onYMarkerDrag with its committed y.
   * Inert (no extra interaction) when absent. */
  yMarkers?: { id: string; y: number; color?: string; label?: string }[] | undefined;
  /** Called on release after a horizontal-marker drag, with the marker id + new y value. */
  onYMarkerDrag?: ((id: string, y: number) => void) | undefined;
  /** Restore a previously-saved pan/zoom view ON MOUNT instead of auto-fitting to the
   * data — lets the dashboard remember each bubble's view across switches / refresh.
   * Read once at mount (inert on update()); invalid / absent → normal auto-fit. */
  initialView?: ViewBox | null | undefined;
  /** Fired (debounced) when the USER pans/zooms — with the new view to persist; fired
   * with null when the user RE-FITS (double-tap / Fit) so the caller drops the saved
   * view. NOT fired for programmatic fits (mount / series update / compact toggle). */
  onViewChange?: ((view: ViewBox | null) => void) | undefined;
  /** Given a point's `histEx`, jump to that exercise's logged history (the pinned
   * popup shows a "→ in history" link when this and the point's histEx are set). */
  onPointHistory?: ((ex: string) => void) | undefined;
}
/** The chart's pan/zoom window in DATA space (x = time ms or weight; y = the left axis). */
export type ViewBox = { xMin: number; xMax: number; yMin: number; yMax: number };
export interface SvgChart {
  update(cfg: Partial<SvgChartConfig>): void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateLabel = (t: number) => {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] ?? c));
const num = (v: number) => (Math.round(v * 10) / 10).toString();

/** SVG markup for a scatter marker of `shape` centred at (cx,cy), radius r, in the
 * series colour. `emphasize` (a record/PR) draws it a touch bigger and more solid.
 * circle/diamond/square/triangle are filled; ring + plus are stroked (a second tier
 * of "outline" forms) so up to six exercises stay distinct within one athlete hue. */
function shapeMarker(shape: SvgShape, cx: number, cy: number, r: number, color: string, op: number, emphasize = false): string {
  const o = emphasize ? Math.min(0.95, op + 0.3) : op;
  const rr = emphasize ? r * 1.18 : r;
  const X = cx.toFixed(1), Y = cy.toFixed(1);
  const fill = `fill="${color}" fill-opacity="${o}"`;
  switch (shape) {
    case "square":
      return `<rect x="${(cx - rr).toFixed(1)}" y="${(cy - rr).toFixed(1)}" width="${(2 * rr).toFixed(1)}" height="${(2 * rr).toFixed(1)}" rx="0.6" ${fill}/>`;
    case "triangle": {
      const h = rr * 1.25;
      return `<path d="M${X} ${(cy - h).toFixed(1)} L${(cx + rr).toFixed(1)} ${(cy + rr * 0.75).toFixed(1)} L${(cx - rr).toFixed(1)} ${(cy + rr * 0.75).toFixed(1)} Z" ${fill}/>`;
    }
    case "diamond": {
      const d = rr * 1.3;
      return `<path d="M${X} ${(cy - d).toFixed(1)} L${(cx + d).toFixed(1)} ${Y} L${X} ${(cy + d).toFixed(1)} L${(cx - d).toFixed(1)} ${Y} Z" ${fill}/>`;
    }
    case "ring":
      return `<circle cx="${X}" cy="${Y}" r="${rr.toFixed(1)}" fill="none" stroke="${color}" stroke-width="1.6" stroke-opacity="${Math.min(1, o + 0.25)}"/>`;
    case "plus": {
      const a = rr * 1.25;
      return `<g stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-opacity="${Math.min(1, o + 0.25)}"><line x1="${(cx - a).toFixed(1)}" y1="${Y}" x2="${(cx + a).toFixed(1)}" y2="${Y}"/><line x1="${X}" y1="${(cy - a).toFixed(1)}" x2="${X}" y2="${(cy + a).toFixed(1)}"/></g>`;
    }
    default:
      return `<circle cx="${X}" cy="${Y}" r="${rr.toFixed(1)}" ${fill}/>`;
  }
}
/** A tiny legend glyph (12×12 SVG) of a series' shape, or a colour square when the
 * series has no shape — so the legend maps cleanly to the marker on the plot. */
function legendDot(s: SvgSeries): string {
  if (s.type === "scatter" && s.shape)
    return `<svg class="svgc-dot svgc-dot-glyph" width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true">${shapeMarker(s.shape, 0, 0, 4, s.color, 0.9)}</svg>`;
  return `<span class="svgc-dot" style="background:${s.color}"></span>`;
}

/** Blend a #rrggbb colour toward white by `amt` (0..1) → an rgb() string. */
function lighten(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const ch = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** Find the y-pixel segments where `threshold`+ range bars overlap, per x-column.
 * Bars at (rounded) the same x pixel are swept over y; stretches covered by at
 * least `threshold` bars are returned so they can be drawn as a "shining" core. */
function denseOverlapSegments(
  bars: { px: number; yTop: number; yBot: number }[],
  threshold: number,
): { px: number; yTop: number; yBot: number }[] {
  const byX = new Map<number, { yTop: number; yBot: number }[]>();
  for (const b of bars) (byX.get(b.px) ?? byX.set(b.px, []).get(b.px)!).push(b);
  const out: { px: number; yTop: number; yBot: number }[] = [];
  for (const [px, ivals] of byX) {
    if (ivals.length < threshold) continue;
    const events: { y: number; d: number }[] = [];
    for (const iv of ivals) { events.push({ y: iv.yTop, d: 1 }); events.push({ y: iv.yBot, d: -1 }); }
    events.sort((a, b) => a.y - b.y || b.d - a.d); // opens before closes at a tie
    let cov = 0, start: number | null = null;
    for (const e of events) {
      const prev = cov;
      cov += e.d;
      if (prev < threshold && cov >= threshold) start = e.y;
      else if (prev >= threshold && cov < threshold && start != null) { out.push({ px, yTop: start, yBot: e.y }); start = null; }
    }
  }
  return out;
}

/** y extent across a set of series (range points count lo & hi; bars include 0). */
function yExtent(series: SvgSeries[], beginAtZero?: boolean) {
  let yMin = Infinity, yMax = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      const ys = s.type === "range" ? [p.lo ?? 0, p.hi ?? 0] : [p.y ?? 0];
      if (s.type === "bars") ys.push(0);
      for (const y of ys) {
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
  }
  if (!Number.isFinite(yMin)) { yMin = 0; yMax = 1; }
  if (beginAtZero) yMin = Math.min(0, yMin);
  if (yMin === yMax) yMax = yMin + 1;
  return { yMin, yMax };
}
function xExtent(series: SvgSeries[]) {
  let xMin = Infinity, xMax = -Infinity;
  for (const s of series) for (const p of s.points) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
  }
  return { xMin, xMax };
}
/** The single source of truth for the TIME axis: the extent of all real DATA series,
 * IGNORING legend visibility and EXCLUDING future-projection overlays (`noExtendX`,
 * e.g. Predicted Strength). Toggling a series in the legend rescales the VALUE axes
 * but must never slide the TIME axis — the "volume bars move independently" bug.
 * Volume bars (bucketed, narrow span) and e1RM lines (per-set, full span)
 * therefore share one fixed frame instead of each pulling the domain to its own data.
 * (Compact mode is the one intentional exception — it squeezes to the visible days.) */
export function dataXExtent(series: SvgSeries[]) {
  return xExtent(series.filter((s) => !s.noExtendX));
}

export function mountSvgChart(container: HTMLElement, initial: SvgChartConfig): SvgChart {
  let cfg: SvgChartConfig = { ...initial };
  const H = () => cfg.height ?? 300;
  const inside = () => cfg.insideLabels ?? false;
  const interactive = () => cfg.interactive ?? true;
  const panX = () => (cfg.panMode ?? "xy") === "x";
  const xKind = () => cfg.xKind ?? "time";

  // ---- compacted-time support ----
  const compactable = () => (cfg.compactable ?? false) && xKind() === "time";
  const useCompact = () => compactable() && compactPref;
  let compactor: TimeCompactor = { to: (t) => t, from: (c) => c };
  function rebuildCompactor() {
    // Only the VISIBLE series drive compaction: filter the legend to one exercise
    // and it's that exercise's training days that compact (the days you didn't do
    // it disappear). Fall back to all series if everything is hidden.
    const xs: number[] = [];
    for (const s of cfg.series) if (visible(s)) for (const p of s.points) xs.push(p.x);
    if (xs.length === 0) for (const s of cfg.series) for (const p of s.points) xs.push(p.x);
    compactor = buildCompactor(xs);
  }
  // The series used for ALL geometry (extents, drawing, tooltip): the raw series
  // in realistic mode, or a copy with each x squeezed onto the compacted axis.
  const geomSeries = (): SvgSeries[] =>
    useCompact()
      ? cfg.series.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p, x: compactor.to(p.x) })) }))
      : cfg.series;

  const fmtX = (x: number) => {
    if (useCompact()) return dateLabel(compactor.from(x));
    if (cfg.formatX) return cfg.formatX(x);
    return xKind() === "time" ? dateLabel(x) : num(x);
  };
  const fmtTipX = (x: number) => {
    if (useCompact()) return dateLabel(compactor.from(x));
    return cfg.formatTipX ? cfg.formatTipX(x) : fmtX(x);
  };
  // Series the user has toggled off via the legend (keyed by name). Visible
  // series drive the axes and tooltip; hidden ones still show in the legend so
  // they can be turned back on.
  const hidden = new Set<string>();
  for (const s of cfg.series) if (s.hidden) hidden.add(s.name); // seed default-off series
  const visible = (s: SvgSeries) => !hidden.has(s.name);
  const leftSeries = () => cfg.series.filter((s) => s.axis !== "right" && visible(s));
  const rightSeries = () => cfg.series.filter((s) => s.axis === "right" && visible(s));
  const hasRight = () => cfg.series.some((s) => s.axis === "right"); // keep right margin stable

  container.classList.add("svgc");
  container.innerHTML = `<div class="svgc-legend"></div><div class="svgc-plot"></div><div class="svgc-note muted"></div><div class="svgc-tip" hidden></div>`;
  const legendEl = container.querySelector<HTMLElement>(".svgc-legend")!;
  // The collapsed "Legend (N)" dropdown is rebuilt on every draw; remember whether
  // it's open so toggling a series (which redraws) doesn't snap it shut. It only
  // closes on a click outside the legend.
  let legendOpen = false;
  const plotEl = container.querySelector<HTMLElement>(".svgc-plot")!;
  const noteEl = container.querySelector<HTMLElement>(".svgc-note")!;
  const tipEl = container.querySelector<HTMLElement>(".svgc-tip")!;
  const clipId = `svgc-clip-${Math.random().toString(36).slice(2, 8)}`;
  const glowId = `svgc-glow-${Math.random().toString(36).slice(2, 8)}`;
  // Draggable x-markers: their last-drawn pixel x (viewBox units) for hit-testing, and
  // the in-flight drag. Empty/null unless cfg.xMarkers is set (inert for every other chart).
  let markerPx: { id: string; px: number }[] = [];
  // Horizontal (y) markers' last-drawn pixel y, for the ceiling-line drag (mirrors markerPx).
  let markerPy: { id: string; py: number }[] = [];
  let mkDrag: { id: string; axis: "x" | "y"; startX: number; startY: number; origPx: number; origPy: number; g: SVGGElement | null; newX: number; newY: number } | null = null;

  // View: x + left-y pan/zoom. The right-y scale is fixed to its data range.
  let view = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  let ry = { yMin: 0, yMax: 1 };
  // "Potential (log)" AXIS-scale mode: the LEFT y-axis is spaced by −ln(ceiling − value),
  // so an approach-to-ceiling reads straight. tY / tYinv are the data⇄transformed maps
  // (identity when off); pan/zoom MUST operate in transformed space so the kg numbers move
  // logarithmically, not linearly. (The "native log" mode instead transforms the DATA
  // values upstream and leaves the axis linear, so this stays off there.)
  const yLogCeil = (): number | null =>
    cfg.potentialLog && typeof cfg.potentialCeiling === "number" && cfg.potentialCeiling > 0 ? cfg.potentialCeiling : null;
  const tY = (v: number): number => { const L = yLogCeil(); return L === null ? v : -Math.log(Math.max(0.5, L - v)); };
  const tYinv = (t: number): number => { const L = yLogCeil(); return L === null ? t : L - Math.exp(-t); };
  /** Pan the left-y view by a screen fraction, in transformed space (linear when off). */
  const panYView = (yMin: number, yMax: number, frac: number) => {
    const T0 = tY(yMin), T1 = tY(yMax), dT = frac * (T1 - T0);
    return { yMin: tYinv(T0 + dT), yMax: tYinv(T1 + dT) };
  };
  /** Zoom the left-y view about screen-fraction vfrac by factor ky, in transformed space. */
  const zoomYView = (yMin: number, yMax: number, vfrac: number, ky: number) => {
    const T0 = tY(yMin), T1 = tY(yMax), fy = T0 + (1 - vfrac) * (T1 - T0);
    return { yMin: tYinv(fy - (fy - T0) * ky), yMax: tYinv(fy + (T1 - fy) * ky) };
  };
  // True once the user has panned/zoomed: then a series UPDATE (e.g. toggling a graph
  // metric) keeps the current view instead of re-fitting, so adding/removing metrics
  // no longer resets the pan/zoom. Cleared by resetView (fitView / double-tap / mount).
  let userAdjusted = false;
  // Persist the user's pan/zoom (the dashboard remembers a bubble's view across switches /
  // refresh). Debounced so a pan/zoom stream writes once it settles, not every frame.
  let viewCommitTimer = 0;
  const finiteBox = (v: ViewBox | null | undefined): v is ViewBox =>
    !!v && [v.xMin, v.xMax, v.yMin, v.yMax].every((n) => Number.isFinite(n)) && v.xMax > v.xMin && v.yMax > v.yMin;
  const commitView = () => {
    if (!cfg.onViewChange) return; // opt-in: zero cost for charts that don't persist
    if (viewCommitTimer) clearTimeout(viewCommitTimer);
    viewCommitTimer = window.setTimeout(() => {
      viewCommitTimer = 0;
      cfg.onViewChange?.({ xMin: view.xMin, xMax: view.xMax, yMin: view.yMin, yMax: view.yMax });
    }, 250);
  };
  // PB-39: persist the pan/zoom IMMEDIATELY when the gesture ENDS (pointer-up), not only on
  // the 250ms debounce. The dashboard re-mounts the chart on incidental re-renders; a re-mount
  // landing in the debounce window restored the PREVIOUS saved view (showing the auto-fit)
  // before the just-finished pan ever committed — so the pan "didn't persist". Flushing on
  // release saves the new view before any re-mount can read a stale one.
  const flushView = () => {
    if (!cfg.onViewChange || !viewCommitTimer) return;
    clearTimeout(viewCommitTimer); viewCommitTimer = 0;
    cfg.onViewChange?.({ xMin: view.xMin, xMax: view.xMax, yMin: view.yMin, yMax: view.yMax });
  };
  let lastTap: { t: number; x: number } | null = null; // for double-tap-to-reset
  // Click-to-pin: every drawn datapoint's pixel box (in SVG user units), rebuilt
  // each draw, so a tap can hit-test the nearest one and pin a sticky detail popup.
  type HitPoint = { px: number; py: number; yTop: number; yBot: number; s: SvgSeries; p: SvgPoint };
  let hitPoints: HitPoint[] = [];
  let pinned = false; // the detail popup is pinned to a point (stays until dismissed)
  /** Re-fit the view to the data (undo any pan/zoom). */
  const fitView = () => {
    rebuildCompactor(); resetView(); hideTip(); draw();
    if (viewCommitTimer) { clearTimeout(viewCommitTimer); viewCommitTimer = 0; }
    cfg.onViewChange?.(null); // user re-fit (double-tap / Fit) → drop any saved view
  };
  // Axis TITLES sit INLINE at the axis ends (y-title top-left, x-title bottom-right) in
  // the EXISTING tick margins — they no longer widen l/b, so the plot stays big (owner).
  // PB-33: axis titles sit INLINE in the existing tick margins (y-title top-left above
  // the value column, x-title bottom-right after the last tick) — NO extra reserved
  // space (owner: "the axis names take up too much space, keep them inline").
  const margins = () => (inside() ? { l: 6, r: 6, t: 8, b: 6 } : { l: cfg.leftMargin ?? 46, r: hasRight() ? 40 : 14, t: 12, b: 26 });
  const widthOf = () => Math.max(260, Math.round(plotEl.clientWidth || container.clientWidth || 320));

  function resetView() {
    userAdjusted = false; // re-fitting to data → auto-fit re-enabled
    // TIME axis = the stable extent of ALL real data (visibility-independent), so
    // toggling a legend entry never slides it (bars stop "moving"). Compact mode is
    // the deliberate exception: it squeezes to the VISIBLE exercise's training days.
    const xe = useCompact()
      ? xExtent(geomSeries().filter(visible))
      : dataXExtent(geomSeries());
    const fx = cfg.forceXRange;
    if (!fx && !Number.isFinite(xe.xMin)) { view = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }; ry = { yMin: 0, yMax: 1 }; return; }
    // Small domain breathing only; the ~10px visible side margin is added at the
    // transform (xPix, PB-23) so it holds on EVERY view, not just this fit.
    const xPad = (xe.xMax - xe.xMin) * 0.02 || 1;
    // Pinned X range (reps×weight): use the caller's bounds verbatim so window/fit changes
    // don't re-scale the frame; else the data extent + a little breathing room.
    const xMin0 = fx ? fx.min : xe.xMin - xPad;
    const xMax0 = fx ? fx.max : xe.xMax + xPad;
    const le = yExtent(leftSeries(), cfg.yBeginAtZero);
    if (cfg.forceLeftRange) {
      // Pinned left axis (per-bodyweight): use the caller's range verbatim.
      view = { xMin: xMin0, xMax: xMax0, yMin: cfg.forceLeftRange.min, yMax: cfg.forceLeftRange.max };
    } else if (Number.isFinite(le.yMin)) {
      const yPad = (le.yMax - le.yMin) * 0.08 || 1;
      view = { xMin: xMin0, xMax: xMax0, yMin: le.yMin - (cfg.yBeginAtZero ? 0 : yPad), yMax: le.yMax + yPad };
    } else {
      view = { xMin: xMin0, xMax: xMax0, yMin: 0, yMax: 1 };
    }
    fitRight();
  }

  /** Fit the RIGHT axis to its current series (bars / counts). Kept separate from
   * resetView so it can refit even when the user has panned/zoomed the left/x view:
   * the right axis is a dependent secondary scale for the bars, never user-panned, so
   * it must always describe whatever bar metric is currently plotted — otherwise
   * switching e.g. Frequency (0–2) → Volume (0–500) leaves the bars overflowing a stale
   * right axis (they shoot off the top). */
  function fitRight() {
    const re = yExtent(rightSeries(), cfg.rightBeginAtZero);
    if (Number.isFinite(re.yMin)) {
      const ryPad = (re.yMax - re.yMin) * 0.08 || 1;
      ry = { yMin: re.yMin - (cfg.rightBeginAtZero ? 0 : ryPad), yMax: re.yMax + ryPad };
      // Scale the right-axis top: >1 squishes its series lower, <1 makes them taller
      // (the relative-axis knob). 1 = auto.
      const hf = cfg.rightHeadroom ?? 1;
      if (hf > 0 && hf !== 1) ry = { yMin: ry.yMin, yMax: ry.yMin + (ry.yMax - ry.yMin) * hf };
    } else {
      ry = { yMin: 0, yMax: 1 };
    }
  }

  const halo = (x: string, y: string, anchor: string, text: string) =>
    `<text class="svgc-halo" x="${x}" y="${y}" text-anchor="${anchor}" font-size="11">${esc(text)}</text>`;

  function draw() {
    const W = widthOf();
    const h = H();
    const M = margins();
    const plotW = W - M.l - M.r;
    const plotH = h - M.t - M.b;
    // PB-23: the data area is inset ~10px from the left/right frame so edge dots (the
    // first/last points & trend-line ends) are never jammed against the side — on EVERY
    // view (fit, pan, zoom, pagination), because the margin lives in the transform, not
    // in any one view-setter. Inverse transforms (tooltip / pan-zoom) use the same xL/xW.
    const padX = plotW > 80 ? 10 : 0;
    const xL = M.l + padX, xW = plotW - 2 * padX;
    const xPix = (x: number) => xL + ((x - view.xMin) / (view.xMax - view.xMin)) * xW;
    // "Potential (log)" axis mode: position values via tY (−ln(ceiling − value)); niceTicks
    // still makes nice kg ticks, yL just places them non-linearly. Identity when off.
    const yL = (y: number) => {
      const t0 = tY(view.yMin), t1 = tY(view.yMax);
      return M.t + (1 - (t1 === t0 ? 0 : (tY(y) - t0) / (t1 - t0))) * plotH;
    };
    const yR = (y: number) => M.t + (1 - (y - ry.yMin) / (ry.yMax - ry.yMin)) * plotH;
    const yOf = (s: SvgSeries) => (s.axis === "right" ? yR : yL);

    let grid = "";
    let yLabels = "";
    // Format ticks with decimals when the step is sub-1 (e.g. a 0–1 fraction axis),
    // else as integers — otherwise Math.round() collapses 0.1/0.2… to 0.
    const fmtTick = (v: number, ticks: number[]): string => {
      const stepT = ticks.length > 1 ? Math.abs(ticks[1]! - ticks[0]!) : Math.abs(v) || 1;
      if (stepT >= 1 || stepT === 0) return String(Math.round(v));
      return v.toFixed(Math.min(3, Math.ceil(-Math.log10(stepT))));
    };
    const yT = niceTicks(view.yMin, view.yMax, 6);
    for (const v of yT) {
      const py = yL(v);
      if (py < M.t - 0.5 || py > h - M.b + 0.5) continue;
      grid += `<line x1="${M.l}" y1="${py.toFixed(1)}" x2="${W - M.r}" y2="${py.toFixed(1)}" class="svgc-grid" stroke-width="1"/>`;
      yLabels += inside()
        ? halo((M.l + 4).toString(), (py - 3).toFixed(1), "start", fmtTick(v, yT))
        : `<text x="${M.l - 6}" y="${(py + 4).toFixed(1)}" text-anchor="end" class="svgc-axislabel" font-size="11">${fmtTick(v, yT)}</text>`;
    }
    // right-axis labels (no gridlines, to avoid a double grid). Follow the same
    // vertical shift the right-axis series uses (e.g. the Volume-shift knob) so the
    // axis keeps describing where the bars actually sit.
    if (hasRight()) {
      const rShiftPx = (rightSeries().find((s) => s.yShiftFrac)?.yShiftFrac ?? 0) * plotH;
      const ryT = niceTicks(ry.yMin, ry.yMax, 6);
      for (const v of ryT) {
        const py = yR(v) - rShiftPx;
        if (py < M.t - 0.5 || py > h - M.b + 0.5) continue;
        yLabels += inside()
          ? halo((W - M.r - 4).toString(), (py - 3).toFixed(1), "end", fmtTick(v, ryT))
          : `<text x="${W - M.r + 6}" y="${(py + 4).toFixed(1)}" text-anchor="start" class="svgc-axislabel" font-size="11">${fmtTick(v, ryT)}</text>`;
      }
    }

    // Horizontal value-zone bands on the left axis (e.g. "approaching the record"),
    // drawn first so everything else sits on top.
    let bands = "";
    for (const b of cfg.yBands ?? []) {
      const yTop = yL(Math.min(b.to ?? view.yMax, view.yMax));
      const yBot = yL(Math.max(b.from, view.yMin));
      const top = Math.max(M.t, Math.min(yTop, yBot));
      const bot = Math.min(h - M.b, Math.max(yTop, yBot));
      if (bot - top > 0.5) bands += `<rect x="${M.l}" y="${top.toFixed(1)}" width="${plotW.toFixed(1)}" height="${(bot - top).toFixed(1)}" fill="${b.fill}"/>`;
    }
    // Filled ribbons between two y-curves (e.g. the "hard sets" zone under the failure
    // line): top edge left→right, then bottom edge right→left, closed. Left-axis y.
    for (const ab of cfg.areaBands ?? []) {
      const ps = ab.points;
      if (ps.length < 2) continue;
      const top = ps.map((p) => `${xPix(p.x).toFixed(1)},${yL(p.yTop).toFixed(1)}`);
      const bot = ps.map((p) => `${xPix(p.x).toFixed(1)},${yL(p.yBot).toFixed(1)}`).reverse();
      bands += `<polygon points="${top.concat(bot).join(" ")}" fill="${ab.fill}" stroke="none"/>`;
      if (ab.label) {
        const mid = ps[Math.floor(ps.length / 2)]!;
        bands += `<text class="svgc-areaband-lbl" x="${xPix(mid.x).toFixed(1)}" y="${yL((mid.yTop + mid.yBot) / 2).toFixed(1)}" font-size="10" fill="${ab.labelColor ?? "#9c463a"}" text-anchor="middle">${esc(ab.label)}</text>`;
      }
    }
    // Vertical value-zone bands on the X axis (e.g. the 3–6RM / 6–12RM load zones).
    for (const xb of cfg.xBands ?? []) {
      const x0 = xPix(Math.min(xb.from, xb.to)), x1 = xPix(Math.max(xb.from, xb.to));
      const left = Math.max(M.l, Math.min(x0, x1)), right = Math.min(W - M.r, Math.max(x0, x1));
      if (right - left <= 0.5) continue;
      bands += `<rect x="${left.toFixed(1)}" y="${M.t}" width="${(right - left).toFixed(1)}" height="${(h - M.b - M.t).toFixed(1)}" fill="${xb.fill}"/>`;
      if (xb.label) bands += `<text class="svgc-areaband-lbl" x="${((left + right) / 2).toFixed(1)}" y="${(M.t + 11).toFixed(1)}" font-size="10" fill="${xb.labelColor ?? "#9c463a"}" text-anchor="middle">${esc(xb.label)}</text>`;
    }
    // x bands + gridlines + thinned labels.
    let xLabels = "";
    const clampX = (px: number) => Math.max(M.l, Math.min(W - M.r, px));
    if (xKind() === "time") {
      // Calendar bands (day/week/month/year): alternating background stripes give
      // the period at a glance, and each band's label is centred in it — so labels
      // never disappear when you zoom in and never collide into "Jan 1, Jan 1".
      // In COMPACTED time the view coords are squeezed (empty days dropped), so we
      // build the bands over the REAL date range and map each boundary back onto the
      // compacted axis — the month/week stripes + labels survive compaction (squeezed
      // thin where there was no training) instead of the axis degrading into evenly-
      // spaced "random" days with no month structure.
      const realMin = useCompact() ? compactor.from(view.xMin) : view.xMin;
      const realMax = useCompact() ? compactor.from(view.xMax) : view.xMax;
      const toView = (realT: number) => (useCompact() ? compactor.to(realT) : realT);
      let lastLabelPx = -Infinity;
      // Show BOTH period levels at once (owner): alternating MONTHS as a very-light-blue
      // wash + alternating WEEKS as very-light-gray stripes over it. Weeks too thin to
      // see (wide zoom) are skipped, so it degrades to month blocks gracefully.
      const bandRect = (b: { start: number; end: number; shade: boolean }, cls: string, minW: number): string => {
        const x0 = xPix(toView(b.start)), x1 = xPix(toView(b.end));
        if (x1 < M.l - 0.5 || x0 > W - M.r + 0.5) return "";
        const cx0 = clampX(x0), cx1 = clampX(x1);
        return (b.shade && cx1 - cx0 > minW)
          ? `<rect x="${cx0.toFixed(1)}" y="${M.t}" width="${(cx1 - cx0).toFixed(1)}" height="${(h - M.b - M.t).toFixed(1)}" class="${cls}"/>`
          : "";
      };
      for (const b of timeBands(realMin, realMax, "month")) bands += bandRect(b, "svgc-band-month", 0.5);
      for (const b of timeBands(realMin, realMax, "week")) bands += bandRect(b, "svgc-band", 3);
      // Gridlines + labels follow the auto level (sensible label density per zoom).
      // Boundary lines ONLY at the year level (owner): week/month dividers are noise —
      // the alternating bands already show the period — but year boundaries stay marked.
      const showGrid = timeLevel(realMax - realMin) === "year";
      for (const b of timeBands(realMin, realMax)) {
        const x0 = xPix(toView(b.start));
        const cx0 = clampX(x0), cx1 = clampX(xPix(toView(b.end)));
        if (cx1 < M.l - 0.5 || cx0 > W - M.r + 0.5) continue;
        // gridline at the band boundary (years only)
        if (showGrid && x0 >= M.l - 0.5 && x0 <= W - M.r + 0.5)
          grid += `<line x1="${x0.toFixed(1)}" y1="${M.t}" x2="${x0.toFixed(1)}" y2="${h - M.b}" class="svgc-grid" stroke-width="1"/>`;
        // label centred in the visible part of the band, thinned if crowded
        const mid = (cx0 + cx1) / 2;
        if (mid - lastLabelPx < 40) continue;
        lastLabelPx = mid;
        xLabels += inside()
          ? halo(mid.toFixed(1), (h - M.b - 5).toFixed(1), "middle", b.label)
          : `<text x="${mid.toFixed(1)}" y="${(h - M.b + 16).toFixed(1)}" text-anchor="middle" class="svgc-axislabel" font-size="11">${esc(b.label)}</text>`;
      }
    } else {
      let lastLabelPx = -Infinity;
      for (const t of niceTicks(view.xMin, view.xMax, 7)) {
        const px = xPix(t);
        if (px < M.l - 0.5 || px > W - M.r + 0.5) continue;
        grid += `<line x1="${px.toFixed(1)}" y1="${M.t}" x2="${px.toFixed(1)}" y2="${h - M.b}" class="svgc-grid" stroke-width="1"/>`;
        if (px - lastLabelPx < 42) continue; // thin crowded labels (gridlines stay)
        lastLabelPx = px;
        xLabels += inside()
          ? halo(px.toFixed(1), (h - M.b - 5).toFixed(1), "middle", fmtX(t))
          : `<text x="${px.toFixed(1)}" y="${(h - M.b + 16).toFixed(1)}" text-anchor="middle" class="svgc-axislabel" font-size="11">${fmtX(t)}</text>`;
      }
    }

    // series
    let body = "";
    hitPoints = []; // rebuilt below as each datapoint is drawn (for click-to-pin)
    const keyHtml: string[] = [];
    // Legend keys become toggles only when there are 2+ of them (a single series
    // shouldn't be hide-able into a blank chart).
    const legendCount = cfg.series.filter((s) => !s.noLegend).length;
    const toggleable = legendCount >= 2;
    // Bar series share each x-slot at FULL width (a month bar stays month-wide no
    // matter how many lifts are shown); extra series are slid slightly right so they
    // overlap "one on top of another" with a rightward slant (see the bars branch).
    const visBars = geomSeries().filter((s) => s.type === "bars" && visible(s));
    const barN = Math.max(1, visBars.length);
    // Direct labels: floating series names next to their last record (collected in
    // the loop where xPix/ymap are in scope, drawn on top after). One per exercise
    // (deduped by the name's prefix before " · "), only for dot/line "record" series.
    const directLabels: string[] = [];
    const labeled = new Set<string>();
    // "Tags": leader-line + brace labels naming each LINE near its end (so you can
    // still tell faint/grey lines apart). Capped + deduped so the chart isn't buried.
    const tagAnnotations: string[] = [];
    const tagged = new Set<string>();
    const tagSpots: { x: number; y: number }[] = []; // placed cluster centres (avoid stacking)
    const wantTags = !!cfg.styleToggles && dataTags;
    for (const s of geomSeries()) {
      if (!s.noLegend)
        keyHtml.push(
          `<span class="svgc-key${toggleable ? " is-toggle" : ""}${visible(s) ? "" : " is-off"}"` +
            `${toggleable ? ` role="button" tabindex="0" data-series="${esc(s.name)}" title="Show/hide ${esc(s.name)}"` : ""}>` +
            `${legendDot(s)}${esc(s.name)}</span>`,
        );
      if (!visible(s)) continue; // hidden: in the legend, but not drawn
      // Optional per-series vertical shift (a fraction of the plot height, + = up):
      // a pure visual offset applied to every y-pixel for THIS series, so e.g. the
      // Volume bars can be lifted off the strength line. Bars shift with their
      // baseline because ymap(0) is offset too.
      const baseYmap = yOf(s);
      const yShiftPx = (s.yShiftFrac ?? 0) * plotH;
      const ymap = yShiftPx ? (v: number) => baseYmap(v) - yShiftPx : baseYmap;
      if (s.type === "line") {
        // Faint mode: trend/strength lines go thin, dashed and greyed so the raw data
        // (the scatter dots) reads as the foreground, not the smoothed curve.
        const faint = !!cfg.styleToggles && faintLines;
        const col = faint ? grayify(s.color, 0.55) : s.color;
        const d = s.points.map((p) => `${xPix(p.x).toFixed(1)},${ymap(p.y ?? 0).toFixed(1)}`).join(" ");
        // A forecast series (s.dashed) draws dashed + slightly translucent even when
        // not in faint mode, so the projection never looks like logged data.
        const dash = faint ? ` stroke-dasharray="3 3"` : s.dashed ? ` stroke-dasharray="5 4"` : "";
        body += `<polyline points="${d}" fill="none" stroke="${col}" stroke-width="${faint ? 1 : 2}" stroke-opacity="${faint ? 0.4 : s.dashed ? 0.7 : 0.9}"${dash}/>`;
        const dotR = faint ? 1.3 : (s.dashed || s.noDots) ? 0 : 2.4;
        for (const p of s.points) {
          const cx = xPix(p.x), cy = ymap(p.y ?? 0);
          body += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${dotR}" fill="${col}" fill-opacity="${faint ? 0.35 : 0.6}"/>`;
          hitPoints.push({ px: cx, py: cy, yTop: cy, yBot: cy, s, p });
        }
      } else if (s.type === "scatter") {
        // Dots only, no connecting line — for values that jump around (e.g. a
        // day's est-1RM) where a line would imply a trend that isn't there. Slight
        // transparency so overlapping same-day sets read as a denser blob (depth).
        for (const p of s.points) {
          const cx = xPix(p.x), cy = ymap(p.y ?? 0);
          if (p.fail) {
            // A failed attempt → an ✕ in the SERIES colour (same as the lift).
            const d = 3.8;
            body += `<g stroke="${s.color}" stroke-width="1.8" stroke-linecap="round"><line x1="${(cx - d).toFixed(1)}" y1="${(cy - d).toFixed(1)}" x2="${(cx + d).toFixed(1)}" y2="${(cy + d).toFixed(1)}"/><line x1="${(cx - d).toFixed(1)}" y1="${(cy + d).toFixed(1)}" x2="${(cx + d).toFixed(1)}" y2="${(cy - d).toFixed(1)}"/></g>`;
          } else if (s.shape ?? p.shape) {
            // A SHAPE marker. Series shape wins (multi-athlete: shape = the exercise,
            // colour = the athlete); otherwise the per-POINT shape — a combined lift's
            // member-origin (same colour, different form). A record (pr) keeps the
            // shape, just bigger + more solid so it still pops.
            const shp = s.shape ?? p.shape!;
            const r = p.rir != null ? Math.min(3.2, Math.max(1.6, 3.2 - 0.22 * p.rir)) : 3.0;
            const mk = shapeMarker(shp, cx, cy, r, s.color, p.op ?? 0.62, !!p.pr);
            body += p.glow ? `<g filter="url(#${glowId})">${mk}</g>` : mk;
          } else if (p.pr) {
            // A new record → a diamond (≈ the dot's size, so records stand out
            // without dominating the scatter).
            const d = 3.6;
            body += `<path d="M${cx.toFixed(1)} ${(cy - d).toFixed(1)} L${(cx + d).toFixed(1)} ${cy.toFixed(1)} L${cx.toFixed(1)} ${(cy + d).toFixed(1)} L${(cx - d).toFixed(1)} ${cy.toFixed(1)} Z" fill="${s.color}" fill-opacity="0.85"/>`;
          } else {
            // Plain set → a dot sized by effort: higher RIR (easier) draws smaller;
            // the hardest (low / no RIR) keep the previous biggest size (3.2).
            const r = p.rir != null ? Math.min(3.2, Math.max(1.5, 3.2 - 0.22 * p.rir)) : 3.2;
            const dot = `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${s.color}" fill-opacity="${(p.op ?? 0.55).toFixed(2)}"/>`;
            body += p.glow ? `<g filter="url(#${glowId})">${dot}</g>` : dot;
          }
          hitPoints.push({ px: cx, py: cy, yTop: cy, yBot: cy, s, p });
        }
      } else if (s.type === "range") {
        const bars: { px: number; yTop: number; yBot: number }[] = [];
        for (const p of s.points) {
          const x = xPix(p.x);
          const yHi = ymap(p.hi ?? 0);
          const yLo = ymap(p.lo ?? 0);
          const L = Math.abs(yLo - yHi);
          if (p.bands && p.bands.length >= 2 && L > 2) {
            // Sectioned by rep: one segment per rep, each ending at that rep's
            // 1RM-equivalent (bands[0] = the weight itself, last = full 1RM). All
            // sections share ONE colour (so the bar reads as a single range); a thin
            // white strip divides each rep boundary so the sections are still legible.
            const bs = p.bands;
            const y0 = ymap(bs[0]!);
            const yN = ymap(bs[bs.length - 1]!);
            body += `<line x1="${x.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yN.toFixed(1)}" stroke="${s.color}" stroke-width="5" stroke-linecap="butt" stroke-opacity="0.55"/>`;
            for (let i = 1; i < bs.length - 1; i++) {
              const yb = ymap(bs[i]!);
              body += `<line x1="${(x - 3).toFixed(1)}" y1="${yb.toFixed(1)}" x2="${(x + 3).toFixed(1)}" y2="${yb.toFixed(1)}" stroke="#ffffff" stroke-width="1.3"/>`;
            }
          } else {
            const n = p.dashes && p.dashes > 1 ? Math.round(p.dashes) : 0;
            // n dashes + (n-1) equal gaps span exactly the line, so the dash count
            // reads as the rep count at a glance.
            let dash = "";
            let cap = "round";
            if (n > 1 && L > 3) {
              const d = L / (2 * n - 1);
              dash = ` stroke-dasharray="${d.toFixed(2)} ${d.toFixed(2)}"`;
              cap = "butt";
            }
            // Slight transparency so stacked/overlapping ranges show their density.
            body += `<line x1="${x.toFixed(1)}" y1="${yHi.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yLo.toFixed(1)}" stroke="${s.color}" stroke-width="4" stroke-linecap="${cap}" stroke-opacity="0.55"${dash}/>`;
          }
          bars.push({ px: Math.round(x), yTop: Math.min(yHi, yLo), yBot: Math.max(yHi, yLo) });
          hitPoints.push({ px: x, py: (yHi + yLo) / 2, yTop: Math.min(yHi, yLo), yBot: Math.max(yHi, yLo), s, p });
        }
        // Where 3+ bars pile up, stacked transparency just turns muddy/dark — so
        // instead those stretches "shine": a bright, glowing core drawn on top.
        const shine = lighten(s.color, 0.7);
        for (const seg of denseOverlapSegments(bars, 3)) {
          if (seg.yBot - seg.yTop < 0.5) continue;
          body += `<line x1="${seg.px.toFixed(1)}" y1="${seg.yTop.toFixed(1)}" x2="${seg.px.toFixed(1)}" y2="${seg.yBot.toFixed(1)}" stroke="${shine}" stroke-width="3" stroke-linecap="round" stroke-opacity="0.95" filter="url(#${glowId})"/>`;
        }
      } else {
        // bars: from baseline (0, clamped into plot) to the value. Each bar is as
        // wide as the data's own x-step (e.g. one week) so bars butt up against
        // each other like a histogram, rather than thin fixed-width sticks.
        const xs = s.points.map((p) => p.x).sort((a, b) => a - b);
        let step = Infinity;
        for (let i = 1; i < xs.length; i++) { const d = xs[i]! - xs[i - 1]!; if (d > 0 && d < step) step = d; }
        // Bar width tracks the data's own x-step (histogram look). Cap it so a sparse
        // series — a single bucket, or a few far-apart ones — can't blow up into one
        // giant bar that paints a whole shaded band across the chart (the old
        // Infinity-step fallback used the entire plot width).
        const stepPx = Number.isFinite(step) ? (step / (view.xMax - view.xMin)) * xW : xW / 24;
        const girth = cfg.barGirth ?? 1; // user width knob (grouped lanes get thin, so allow fattening)
        const bw = Math.max(2, Math.min(stepPx * 0.63, plotW / 14) * girth); // ~30% thinner than a step, capped, ×girth
        // Baseline = the (possibly shifted) zero line. Both the baseline and each
        // bar's top are clamped to the plot, so a vertically-shifted series stays
        // rigid and just clips at the floor/ceiling instead of stretching.
        const base = ymap(0);
        const clampY = (y: number) => Math.min(h - M.b, Math.max(M.t, y));
        // Multiple bar series: keep EVERY bar the SAME full width (a month-wide
        // bar stays month-wide no matter how many lifts are shown) and OFFSET each
        // extra series a little to the RIGHT, so they overlap "one on top of
        // another" with a slight rightward slant instead of splitting the slot into
        // thin side-by-side lanes that shrink as you add lifts. One series → a plain
        // full-width bar centred on its bucket, as before.
        const bi = Math.max(0, visBars.indexOf(s));
        const rightShift = Math.min(bw * 0.3, 10); // per-series rightward slant
        const laneCenter = bi * rightShift;
        const rectW = bw; // same width for every series, regardless of how many
        // Overlapping bars need SOME translucency so the one behind still shows, but
        // the owner wants them solid-ish ("not too transparent") — floor the fill so
        // a low opacity slider can't wash the overlap into mud when 2+ bars stack.
        const baseOp = s.fillOpacity ?? 1;
        const fillOp = barN > 1 ? Math.max(baseOp, 0.78) : baseOp;
        // Bars can be outline-only or a translucent fill so they don't hide other series.
        const paint = s.outline
          ? `fill="none" stroke="${s.color}" stroke-width="1.3"`
          : `fill="${s.color}" fill-opacity="${fillOp}"`;
        for (const p of s.points) {
          const x = xPix(p.x) + laneCenter;
          if (x < M.l - bw || x > W - M.r + bw) continue;
          const top = ymap(p.y ?? 0);
          const yTop = clampY(Math.min(top, base));
          const yBot = clampY(Math.max(top, base));
          if (yBot - yTop < 0.2) continue; // fully clipped out of the plot
          body += `<rect x="${(x - rectW / 2).toFixed(1)}" y="${yTop.toFixed(1)}" width="${rectW.toFixed(1)}" height="${(yBot - yTop).toFixed(1)}" rx="2" ${paint}/>`;
          hitPoints.push({ px: x, py: yTop, yTop, yBot, s, p });
        }
      }
      // Floating exercise name next to this series' last record (dots/lines only —
      // the "records"; bars are excluded). One label per exercise, with a white halo
      // for legibility over a busy chart; flips to the left near the right edge.
      // Tag annotation: find this SCATTER series' DENSEST cluster of points (where
      // it's most concentrated, not a random end) and mark it with a brace + name.
      if (wantTags && s.type === "scatter" && s.points.length >= 3 && tagAnnotations.length < 12 && !tagged.has(s.name)) {
        tagged.add(s.name);
        const px = s.points
          .map((p) => ({ x: xPix(p.x), y: ymap(p.y ?? 0) }))
          .filter((q) => q.x >= M.l && q.x <= W - M.r && q.y >= M.t && q.y <= h - M.b);
        if (px.length >= 3) {
          // Densest point = the one with the most neighbours within R px.
          const R2 = 22 * 22;
          let best = px[0]!, bestC = -1;
          for (const a of px) {
            let c = 0;
            for (const b of px) { const dx = a.x - b.x, dy = a.y - b.y; if (dx * dx + dy * dy <= R2) c++; }
            if (c > bestC) { bestC = c; best = a; }
          }
          // Skip if a cluster was already tagged right here (don't stack labels).
          if (bestC >= 3 && !tagSpots.some((t) => Math.hypot(t.x - best.x, t.y - best.y) < 22)) {
            tagSpots.push(best);
            const parts = s.name.split(" · ");
            const lbl = parts.length >= 3 ? parts[1]! : parts[0]!; // the exercise segment
            const col = grayify(s.color, 0.12); // keep most of the athlete hue
            const right = best.x < W - M.r - 56;
            const lx = best.x + (right ? 16 : -16);
            const ly = Math.max(M.t + 8, best.y - 13);
            tagAnnotations.push(
              `<text x="${best.x.toFixed(1)}" y="${(best.y + 4).toFixed(1)}" font-size="13" text-anchor="middle" fill="${col}" fill-opacity="0.9">${right ? "{" : "}"}</text>` +
                `<line x1="${(best.x + (right ? 5 : -5)).toFixed(1)}" y1="${best.y.toFixed(1)}" x2="${(lx - (right ? 3 : -3)).toFixed(1)}" y2="${ly.toFixed(1)}" stroke="${col}" stroke-width="0.8" stroke-opacity="0.6"/>` +
                `<text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" font-size="9" text-anchor="${right ? "start" : "end"}" paint-order="stroke" stroke="#fff" stroke-width="2.2" stroke-opacity="0.9" fill="${col}" style="font-weight:700">${esc(lbl)}</text>`,
            );
          }
        }
      }
      if (cfg.directLabels && (s.type === "scatter" || s.type === "line") && s.points.length) {
        const label = s.name.split(" · ")[0]!;
        if (!labeled.has(label)) {
          const last = s.points[s.points.length - 1]!;
          const cx = xPix(last.x), cy = ymap(last.y ?? 0);
          if (cx >= M.l && cx <= W - M.r && cy >= M.t && cy <= h - M.b) {
            labeled.add(label);
            const nearRight = cx > W - M.r - 56;
            const tx = nearRight ? cx - 6 : cx + 6;
            const anchor = nearRight ? "end" : "start";
            directLabels.push(
              `<text x="${tx.toFixed(1)}" y="${(cy - 5).toFixed(1)}" font-size="9" text-anchor="${anchor}" ` +
                `paint-order="stroke" stroke="#fff" stroke-width="2.4" stroke-opacity="0.85" fill="${s.color}" style="font-weight:700">${esc(label)}</text>`,
            );
          }
        }
      }
    }
    body += directLabels.join("");
    body += tagAnnotations.join("");

    // Draggable vertical fit-window markers (e.g. the projection's include-from/to lines):
    // a coloured dashed line top-to-bottom + a grip tab at the top + a fat transparent
    // hit-line. Their pixel x is cached for pointer hit-testing.
    // STATIC x reference lines (e.g. "today"): a thin line, no grip, no hit-target. Drawn
    // before the draggable markers so those sit on top. Skipped when off the visible plot.
    if (cfg.xRefLines && cfg.xRefLines.length) {
      for (const rl of cfg.xRefLines) {
        const px = xPix(rl.x);
        if (px < M.l - 0.5 || px > W - M.r + 0.5) continue; // outside the view → don't draw
        const col = rl.color ?? "#cf5a4a";
        const lbl = rl.label ? `<text class="svgc-xref-lbl" x="${(px + 3).toFixed(1)}" y="${(h - M.b - 3).toFixed(1)}" font-size="9" fill="${col}" fill-opacity="0.8">${esc(rl.label)}</text>` : "";
        body +=
          `<g class="svgc-xref">` +
          `<line x1="${px.toFixed(1)}" y1="${M.t}" x2="${px.toFixed(1)}" y2="${(h - M.b).toFixed(1)}" stroke="${col}" stroke-width="1" stroke-dasharray="3 3" stroke-opacity="0.7"/>` +
          lbl +
          `</g>`;
      }
    }
    markerPx = [];
    if (cfg.xMarkers && cfg.xMarkers.length) {
      for (const mk of cfg.xMarkers) {
        const px = xPix(mk.x);
        markerPx.push({ id: mk.id, px });
        const col = mk.color ?? "#2f8f88";
        const lbl = mk.label ? `<text class="svgc-xmk-lbl" x="${(px + 4).toFixed(1)}" y="${(M.t + 11).toFixed(1)}" font-size="10" fill="${col}">${esc(mk.label)}</text>` : "";
        body +=
          `<g class="svgc-xmk" data-mk="${esc(mk.id)}" style="cursor:ew-resize">` +
          `<line x1="${px.toFixed(1)}" y1="${M.t}" x2="${px.toFixed(1)}" y2="${(h - M.b).toFixed(1)}" stroke="${col}" stroke-width="1.5" stroke-dasharray="4 3" stroke-opacity="0.9"/>` +
          `<rect x="${(px - 5).toFixed(1)}" y="${M.t}" width="10" height="14" rx="2" fill="${col}"/>` +
          `<line x1="${px.toFixed(1)}" y1="${M.t}" x2="${px.toFixed(1)}" y2="${(h - M.b).toFixed(1)}" stroke="transparent" stroke-width="18"/>` +
          lbl +
          `</g>`;
      }
    }
    // Draggable HORIZONTAL markers (e.g. the projection ceiling the curve flattens toward):
    // a dashed line spanning the plot width + a grip tab at the left + a fat transparent
    // hit-line. Pixel y cached for pointer hit-testing. Uses the LEFT-axis mapper (yL).
    markerPy = [];
    if (cfg.yMarkers && cfg.yMarkers.length) {
      for (const mk of cfg.yMarkers) {
        const py = yL(mk.y);
        if (py < M.t - 0.5 || py > h - M.b + 0.5) continue; // off-plot → skip (still draggable in range)
        markerPy.push({ id: mk.id, py });
        const col = mk.color ?? "#9c5a86";
        const lbl = mk.label ? `<text class="svgc-ymk-lbl" x="${(W - M.r - 4).toFixed(1)}" y="${(py - 4).toFixed(1)}" text-anchor="end" font-size="10" fill="${col}">${esc(mk.label)}</text>` : "";
        body +=
          `<g class="svgc-ymk" data-mk="${esc(mk.id)}" style="cursor:ns-resize">` +
          `<line x1="${M.l}" y1="${py.toFixed(1)}" x2="${(W - M.r).toFixed(1)}" y2="${py.toFixed(1)}" stroke="${col}" stroke-width="1.5" stroke-dasharray="4 3" stroke-opacity="0.9"/>` +
          `<rect x="${M.l.toFixed(1)}" y="${(py - 7).toFixed(1)}" width="14" height="14" rx="2" fill="${col}"/>` +
          `<line x1="${M.l}" y1="${py.toFixed(1)}" x2="${(W - M.r).toFixed(1)}" y2="${py.toFixed(1)}" stroke="transparent" stroke-width="18"/>` +
          lbl +
          `</g>`;
      }
    }

    const frame = inside()
      ? `<rect x="${M.l}" y="${M.t}" width="${plotW}" height="${plotH}" fill="none" class="svgc-frame" stroke-width="1"/>`
      : `<line x1="${M.l}" y1="${M.t}" x2="${M.l}" y2="${h - M.b}" class="svgc-frame" stroke-width="1"/>` +
        `<line x1="${M.l}" y1="${h - M.b}" x2="${W - M.r}" y2="${h - M.b}" class="svgc-frame" stroke-width="1"/>`;

    // Time-axis charts get an app-wide "realistic ⇄ compacted" toggle on the right
    // of the legend row. Compacted squeezes the empty gaps so all sets fit.
    const compactBtn =
      compactable() && !cfg.noCompactToggle
        ? `<button type="button" class="svgc-compact${useCompact() ? " is-on" : ""}" aria-pressed="${useCompact()}" ` +
          `title="${useCompact() ? "Showing compacted time (gaps squeezed). Tap for real time spacing." : "Showing real time (with the gaps). Tap to squeeze the gaps so all sets fit."}">` +
          `${useCompact() ? "⇄ Compacted time" : "⇄ Realistic time"}</button>`
        : "";
    // Two tiny style toggles (opt-in): faint trend lines + line tags.
    const styleBtns = cfg.styleToggles
      ? `<button type="button" class="svgc-style-btn${faintLines ? " is-on" : ""}" data-stylebtn="faint" aria-pressed="${faintLines}" title="${faintLines ? "Trend lines are thin/dashed/grey — tap for bold lines." : "Make the trend lines thin, dashed & grey so the data dots stand out."}">〰</button>` +
        `<button type="button" class="svgc-style-btn${dataTags ? " is-on" : ""}" data-stylebtn="tags" aria-pressed="${dataTags}" title="${dataTags ? "Line tags shown — tap to hide." : "Tag each line with a leader-brace label naming it."}">⟨ ⟩</button>`
      : "";
    // Many keys get cramped in an inline row, so past a handful collapse them into
    // a floating "Legend" dropdown (overlay — doesn't grow the chart). The compact
    // toggle stays inline. Toggling series still works: the keys keep their
    // data-series handlers inside the menu.
    // Grouped show/hide chips: for each labelled name-segment (Athlete / Exercise /
    // Type) with 2+ distinct values, one chip per value that toggles EVERY series
    // sharing it (on = all shown, off = all hidden, mixed = some). One-tap bulk hide.
    let groupTogglesHtml = "";
    if (cfg.legendGroupLabels && keyHtml.length > 1) {
      const legendSeries = cfg.series.filter((s) => !s.noLegend);
      const rows: string[] = [];
      cfg.legendGroupLabels.forEach((label, pos) => {
        if (!label) return;
        const order: string[] = [];
        const byVal = new Map<string, SvgSeries[]>();
        for (const s of legendSeries) {
          const v = s.name.split(" · ")[pos];
          if (v === undefined) continue;
          if (!byVal.has(v)) { byVal.set(v, []); order.push(v); }
          byVal.get(v)!.push(s);
        }
        if (order.length < 2) return; // nothing to group on at this position
        const chips = order.map((v) => {
          const grp = byVal.get(v)!;
          const state = grp.every((s) => hidden.has(s.name)) ? "off" : grp.some((s) => hidden.has(s.name)) ? "mixed" : "on";
          return `<button type="button" class="svgc-grp-chip is-${state}" data-grouppos="${pos}" data-groupval="${esc(v)}" title="Show/hide every ${esc(label)} · ${esc(v)} series">${esc(v)}</button>`;
        }).join("");
        rows.push(`<div class="svgc-grp-row"><span class="svgc-grp-lbl">${esc(label)}</span>${chips}</div>`);
      });
      if (rows.length) groupTogglesHtml = `<div class="svgc-legend-groups">${rows.join("")}</div>`;
    }
    // "Fit" button — re-centre & fit all the data in view (undoes any pan/zoom).
    // Same as double-tapping the plot, but discoverable. Only when pan/zoom is on.
    const centerBtn = interactive()
      ? `<button type="button" class="svgc-center" title="Centre the data — fit everything in view (reset zoom & pan)">⤢ Fit</button>`
      : "";
    // The two style toggles (faint lines / line tags) live INSIDE the Legend dropdown
    // when there is one — so the bar below the chart stays to just "Legend ▾  ⤢ Fit".
    // With no dropdown (few series) they stay inline beside the keys, as before.
    const hasFold = keyHtml.length > 6 || !!groupTogglesHtml;
    const styleRow = styleBtns
      ? `<div class="svgc-legend-style"><span class="svgc-grp-lbl">Lines</span>${styleBtns}</div>`
      : "";
    const tail = compactBtn + centerBtn;
    const keys = keyHtml.join("");
    legendEl.innerHTML =
      hasFold
        ? `<details class="svgc-legend-fold"${legendOpen ? " open" : ""}><summary class="svgc-legend-sum">Legend <span class="svgc-legend-n">(${keyHtml.length})</span></summary>` +
          `<div class="svgc-legend-menu">${styleRow}${groupTogglesHtml}<div class="svgc-legend-keys">${keys}</div></div></details>${tail}`
        : keys + styleBtns + tail;
    // Sync the remembered open state when the user opens/closes it directly, and on
    // open decide whether to flip the menu ABOVE the button (when there's more room
    // above than below — it then overlays the chart instead of pushing the page).
    const fold = legendEl.querySelector<HTMLDetailsElement>(".svgc-legend-fold");
    if (fold) fold.addEventListener("toggle", () => {
      legendOpen = fold.open;
      if (!fold.open) { fold.classList.remove("svgc-legend-fold--up"); return; }
      const sum = fold.querySelector<HTMLElement>(".svgc-legend-sum");
      const menu = fold.querySelector<HTMLElement>(".svgc-legend-menu");
      if (!sum || !menu) return;
      const r = sum.getBoundingClientRect();
      const need = Math.min(menu.scrollHeight + 12, window.innerHeight * 0.6);
      const below = window.innerHeight - r.bottom, above = r.top;
      fold.classList.toggle("svgc-legend-fold--up", below < need && above > below);
      // Horizontal: clamp the menu into the viewport. It is right-aligned to the
      // button by default, which runs off the LEFT edge when the button sits near
      // the left. Measure and pin its left so it always stays fully on-screen.
      const foldRect = fold.getBoundingClientRect();
      const menuW = menu.offsetWidth;
      const vpLeft = Math.max(8, Math.min(r.right - menuW, window.innerWidth - 8 - menuW));
      menu.style.right = "auto";
      menu.style.left = `${(vpLeft - foldRect.left).toFixed(1)}px`;
    });
    noteEl.textContent = cfg.note ?? "";
    noteEl.hidden = !cfg.note;
    // Axis titles (outer-label charts only) — tucked INLINE at the axis ends so they cost
    // no extra margin (owner: "names move inline with numbers so they don't take up space"):
    // PB-33: axis titles INLINE in the existing margins — y-title top-left above the
    // value column, x-title bottom-right after the last tick number — so they read as
    // axis names without stealing plot space (just made dark+bold so they're visible).
    let axisTitles = "";
    if (!inside()) {
      if (cfg.yTitle) axisTitles += `<text x="${M.l.toFixed(1)}" y="${(M.t - 3).toFixed(1)}" text-anchor="start" class="svgc-axistitle">${esc(cfg.yTitle)}</text>`;
      if (cfg.xTitle) axisTitles += `<text x="${(W - M.r).toFixed(1)}" y="${(h - 4).toFixed(1)}" text-anchor="end" class="svgc-axistitle">${esc(cfg.xTitle)}</text>`;
    }
    plotEl.innerHTML =
      `<svg class="svgc-svg" width="100%" height="${h}" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" role="img">` +
      `<defs><clipPath id="${clipId}"><rect x="${M.l}" y="${M.t}" width="${plotW}" height="${plotH}"/></clipPath>` +
      `<filter id="${glowId}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
      `<g clip-path="url(#${clipId})">${bands}${grid}${body}${inside() ? xLabels + yLabels : ""}</g>` +
      frame +
      (inside() ? "" : xLabels + yLabels) +
      axisTitles +
      `</svg>`;
  }

  // ---- tooltip ----
  function showTip(clientX: number) {
    const svg = plotEl.querySelector("svg");
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const W = widthOf();
    const M = margins();
    const plotW = W - M.l - M.r;
    const localX = ((clientX - rect.left) / rect.width) * W;
    // PB-23: match the xL/xW inset used by xPix so hit-testing aligns with the dots.
    const padX = plotW > 80 ? 10 : 0;
    const xL = M.l + padX, xW = plotW - 2 * padX;
    const xVal = view.xMin + ((localX - xL) / xW) * (view.xMax - view.xMin);
    const gs = geomSeries();
    let best: { p: SvgPoint; dx: number } | null = null;
    for (const s of gs) {
      if (!visible(s)) continue;
      for (const p of s.points) {
        const dx = Math.abs(p.x - xVal);
        if (!best || dx < best.dx) best = { p, dx };
      }
    }
    if (!best) return;
    const xv = best.p.x;
    const rows = gs
      .map((s) => {
        if (!visible(s)) return "";
        const p = s.points.find((q) => q.x === xv);
        if (!p) return "";
        const unit = s.axis === "right" ? cfg.rightUnit : cfg.yUnit;
        const val = s.type === "range"
          ? `${num(p.lo ?? 0)}→${num(p.hi ?? 0)}${p.meta ? " " + esc(p.meta) : ""}`
          : `${num(p.y ?? 0)}${unit ? " " + unit : ""}`;
        return `<div class="svgc-tip-row">${legendDot(s)}${esc(s.name)}: <b>${val}</b></div>`;
      })
      .join("");
    tipEl.innerHTML = `<div class="svgc-tip-hd">${esc(fmtTipX(xv))}</div>${rows}`;
    tipEl.hidden = false;
    const px = xL + ((xv - view.xMin) / (view.xMax - view.xMin)) * xW;
    tipEl.style.left = `${Math.min(Math.max(px, 8), (plotEl.clientWidth || W) - tipEl.offsetWidth - 8)}px`;
    tipEl.style.top = `4px`;
  }
  const hideTip = () => { tipEl.hidden = true; tipEl.classList.remove("svgc-tip-pinned"); pinned = false; };

  // ---- click-to-pin detail popup ----
  /** Nearest drawn datapoint to a screen pixel (within a small radius), or null.
   * Distance is to the dot, or to the nearest edge of a bar's vertical span. */
  function hitTest(clientX: number, clientY: number): HitPoint | null {
    const svg = plotEl.querySelector("svg");
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const W = widthOf();
    const h = H();
    const lx = ((clientX - rect.left) / rect.width) * W; // → SVG user units
    const ly = ((clientY - rect.top) / rect.height) * h;
    let best: HitPoint | null = null;
    let bestD = Infinity;
    for (const hp of hitPoints) {
      const dx = lx - hp.px;
      const cy = ly < hp.yTop ? hp.yTop : ly > hp.yBot ? hp.yBot : ly; // clamp into the bar span
      const dy = ly - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = hp; }
    }
    return best && bestD <= 26 ? best : null; // ~26 SVG units ≈ a fingertip
  }
  /** Detail-popup HTML for one point: a close ✕, the series name, then the point's
   * `detail` lines (or a value fallback) and any record/fail badges. */
  function pointDetailHtml(s: SvgSeries, p: SvgPoint): string {
    const lines: string[] = [];
    if (p.detail) {
      for (const ln of p.detail.split("\n")) if (ln.trim()) lines.push(esc(ln.trim()));
    } else {
      const unit = s.axis === "right" ? cfg.rightUnit : cfg.yUnit;
      lines.push(esc(fmtTipX(p.x)));
      lines.push(
        s.type === "range"
          ? `${num(p.lo ?? 0)}→${num(p.hi ?? 0)}${p.meta ? " " + esc(p.meta) : ""}`
          : `${num(p.y ?? 0)}${unit ? " " + unit : ""}${p.meta ? " · " + esc(p.meta) : ""}`,
      );
    }
    const badges: string[] = [];
    if (p.pr) badges.push(`<span class="svgc-tip-badge pr">◆ record</span>`);
    if (p.fail) badges.push(`<span class="svgc-tip-badge fail">✕ fail</span>`);
    const head = `<div class="svgc-tip-hd">${legendDot(s)}${esc(s.name)}</div>`;
    const body = lines.map((l, i) => `<div class="svgc-tip-line${i === 0 ? " is-first" : ""}">${l}</div>`).join("");
    const histLink = p.histEx && cfg.onPointHistory
      ? `<button type="button" class="svgc-tip-hist" data-histex="${esc(p.histEx)}">→ in history</button>`
      : "";
    return `<button type="button" class="svgc-tip-x" aria-label="Close">✕</button>${head}${body}` +
      (badges.length ? `<div class="svgc-tip-badges">${badges.join("")}</div>` : "") + histLink;
  }
  /** Pin the sticky detail popup beside a datapoint; it stays until dismissed. */
  function pinDetail(hp: HitPoint) {
    const W = widthOf();
    const h = H();
    const cx = plotEl.offsetLeft + (hp.px / W) * plotEl.clientWidth;
    const cy = plotEl.offsetTop + (hp.py / h) * plotEl.clientHeight;
    tipEl.innerHTML = pointDetailHtml(hp.s, hp.p);
    tipEl.classList.add("svgc-tip-pinned");
    tipEl.hidden = false;
    pinned = true;
    // Prefer to the right of the point; flip left if it would overflow. Clamp into
    // the chart box both ways so it's never cut off.
    const cw = container.clientWidth;
    const tw = tipEl.offsetWidth;
    const th = tipEl.offsetHeight;
    let left = cx + 12;
    if (left + tw > cw - 4) left = cx - tw - 12;
    left = Math.max(4, Math.min(left, cw - tw - 4));
    let top = cy - th / 2;
    top = Math.max(4, Math.min(top, container.clientHeight - th - 4));
    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${top}px`;
  }
  // The ✕ on a pinned popup closes it (the popup gets pointer-events when pinned).
  tipEl.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".svgc-tip-x")) { e.stopPropagation(); hideTip(); return; }
    const hist = (e.target as HTMLElement).closest<HTMLElement>(".svgc-tip-hist");
    if (hist?.dataset.histex && cfg.onPointHistory) { e.stopPropagation(); cfg.onPointHistory(hist.dataset.histex); hideTip(); }
  });

  // ---- interactions: 1 finger / mouse = pan, 2 fingers = pinch-zoom, wheel = zoom ----
  /** Vertical screen fraction (0=top..1=bottom) + the x data value under a pixel. */
  function pixInfo(clientX: number, clientY: number) {
    const svg = plotEl.querySelector("svg");
    const rect = svg ? svg.getBoundingClientRect() : plotEl.getBoundingClientRect();
    const W = widthOf();
    const h = H();
    const M = margins();
    const plotW = W - M.l - M.r;
    const plotH = h - M.t - M.b;
    const lx = ((clientX - rect.left) / rect.width) * W;
    const ly = ((clientY - rect.top) / rect.height) * h;
    // PB-23: same xL/xW inset as xPix so pan/zoom anchor on the pointer, not 10px off.
    const padX = plotW > 80 ? 10 : 0;
    const xL = M.l + padX, xW = plotW - 2 * padX;
    return { fx: view.xMin + ((lx - xL) / xW) * (view.xMax - view.xMin), vfrac: (ly - M.t) / plotH };
  }
  /** Zoom by independent factors per axis (>1 = out): x about fx, y about the
   * screen-fraction `vfrac` so BOTH the left and right y-axes scale together. */
  function zoomXY(fx: number, vfrac: number, kx: number, ky: number) {
    let { xMin, xMax, yMin, yMax } = view;
    xMin = fx - (fx - xMin) * kx;
    xMax = fx + (xMax - fx) * kx;
    if (!panX()) {
      ({ yMin, yMax } = zoomYView(yMin, yMax, vfrac, ky)); // transformed-space when log axis on
      const fyR = ry.yMin + (1 - vfrac) * (ry.yMax - ry.yMin);
      ry = { yMin: fyR - (fyR - ry.yMin) * ky, yMax: fyR + (ry.yMax - fyR) * ky };
    }
    view = { xMin, xMax, yMin, yMax };
    userAdjusted = true; // remember the user's pan/zoom across series updates
    commitView(); // persist (covers wheel zoom + pinch zoom)
  }

  const SPREAD = 26; // min finger spread (px) on an axis before that axis stretches
  const pts = new Map<number, { x: number; y: number }>();
  let pan: { x: number; y: number; v: typeof view; r: typeof ry; moved: boolean } | null = null;
  // Per-axis pinch: track the horizontal spread (drives X) and vertical spread
  // (drives Y) between the two fingers separately, so spreading them sideways
  // stretches only X, up/down only Y, diagonally both.
  let pinch: { hx: number; vy: number; mx: number; my: number } | null = null;

  const onMove = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    if (pts.size > 0) e.preventDefault();
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const all = [...pts.values()];
    if (all.length >= 2 && pinch) {
      const [a, b] = all;
      const hx = Math.abs(a!.x - b!.x);
      const vy = Math.abs(a!.y - b!.y);
      const mx = (a!.x + b!.x) / 2;
      const my = (a!.y + b!.y) / 2;
      const M = margins();
      const W = widthOf();
      const h = H();
      const plotW = W - M.l - M.r;
      const plotH = h - M.t - M.b;
      // pan by midpoint movement (both y-axes shift together)
      const fracX = (mx - pinch.mx) / plotW;
      const fracY = panX() ? 0 : (my - pinch.my) / plotH;
      const py = panYView(view.yMin, view.yMax, fracY); // transformed-space when log axis on
      view = { xMin: view.xMin - fracX * (view.xMax - view.xMin), xMax: view.xMax - fracX * (view.xMax - view.xMin), yMin: py.yMin, yMax: py.yMax };
      if (!panX()) { const rr = ry.yMax - ry.yMin; ry = { yMin: ry.yMin + fracY * rr, yMax: ry.yMax + fracY * rr }; }
      // per-axis zoom about the midpoint, gated by the spread on each axis
      const { fx, vfrac } = pixInfo(mx, my);
      const kx = pinch.hx > SPREAD && hx > 4 ? pinch.hx / hx : 1;
      const ky = pinch.vy > SPREAD && vy > 4 ? pinch.vy / vy : 1;
      zoomXY(fx, vfrac, kx, ky);
      pinch = { hx, vy, mx, my };
      hideTip();
      draw();
    } else if (pan) {
      const M = margins();
      const W = widthOf();
      const h = H();
      const plotW = W - M.l - M.r;
      const plotH = h - M.t - M.b;
      if (Math.abs(e.clientX - pan.x) + Math.abs(e.clientY - pan.y) > 4) pan.moved = true;
      const dx = ((e.clientX - pan.x) / plotW) * (pan.v.xMax - pan.v.xMin);
      const fracY = panX() ? 0 : (e.clientY - pan.y) / plotH;
      const py = panYView(pan.v.yMin, pan.v.yMax, fracY); // transformed-space when log axis on
      view = { xMin: pan.v.xMin - dx, xMax: pan.v.xMax - dx, yMin: py.yMin, yMax: py.yMax };
      if (!panX()) { const rr = pan.r.yMax - pan.r.yMin; ry = { yMin: pan.r.yMin + fracY * rr, yMax: pan.r.yMax + fracY * rr }; }
      userAdjusted = true; // remember the user's pan across series updates
      commitView(); // persist the user's pan (1-finger / mouse drag)
      hideTip();
      draw();
    }
  };
  const onUp = (e: PointerEvent) => {
    const wasTap = pts.size === 1 && pan && !pan.moved;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 1) {
      const p = [...pts.values()][0]!;
      pan = { x: p.x, y: p.y, v: { ...view }, r: { ...ry }, moved: true }; // keep panning with the remaining finger
    } else if (pts.size === 0) {
      pan = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      try { plotEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (wasTap) {
        const now = Date.now();
        if (lastTap && now - lastTap.t < 300 && Math.abs(e.clientX - lastTap.x) < 24) {
          lastTap = null;
          fitView(); // double-tap → re-fit to the data (undo accidental pan/zoom)
        } else {
          lastTap = { t: now, x: e.clientX };
          // Tap ON a datapoint → pin its sticky detail popup; tap on empty space →
          // dismiss any pinned popup (and fall back to the quick x-tooltip).
          const hp = hitTest(e.clientX, e.clientY);
          if (hp) pinDetail(hp);
          else { hideTip(); showTip(e.clientX); }
        }
      } else {
        flushView(); // PB-39: a real pan/zoom just ended → persist it NOW, before any re-mount
      }
    }
  };
  // Pointer x in viewBox units (same space as markerPx), for marker hit-testing.
  function pointerLocalX(clientX: number): number {
    const svg = plotEl.querySelector("svg");
    const rect = svg ? svg.getBoundingClientRect() : plotEl.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * widthOf();
  }
  // Live marker drag: move the grabbed marker's <g> horizontally and stash the new data
  // x; commit on release via cfg.onMarkerDrag (so the heavy fit recompute runs once).
  const onMkMove = (e: PointerEvent) => {
    if (!mkDrag) return;
    e.preventDefault();
    const lx = pointerLocalX(e.clientX);
    if (mkDrag.g) mkDrag.g.setAttribute("transform", `translate(${(lx - mkDrag.origPx).toFixed(1)},0)`);
    mkDrag.newX = pixInfo(e.clientX, 0).fx;
  };
  const onMkUp = () => {
    window.removeEventListener("pointermove", onMkMove);
    window.removeEventListener("pointerup", onMkUp);
    window.removeEventListener("pointercancel", onMkUp);
    const d = mkDrag; mkDrag = null;
    if (d) cfg.onMarkerDrag?.(d.id, d.newX);
  };
  plotEl.addEventListener("pointerdown", (e) => {
    if (!interactive()) {
      const hp = hitTest(e.clientX, e.clientY);
      if (hp) pinDetail(hp);
      else { hideTip(); showTip(e.clientX); }
      return;
    }
    // A press near a draggable marker grabs it (instead of panning the chart).
    if (cfg.onMarkerDrag && markerPx.length && pts.size === 0) {
      const lx = pointerLocalX(e.clientX);
      let near: { id: string; px: number } | null = null;
      for (const m of markerPx) if (!near || Math.abs(m.px - lx) < Math.abs(near.px - lx)) near = m;
      if (near && Math.abs(near.px - lx) <= 16) {
        const g = plotEl.querySelector<SVGGElement>(`.svgc-xmk[data-mk="${CSS.escape(near.id)}"]`);
        mkDrag = { id: near.id, axis: "x", startX: e.clientX, startY: 0, origPx: near.px, origPy: 0, g, newX: pixInfo(e.clientX, 0).fx, newY: 0 };
        window.addEventListener("pointermove", onMkMove);
        window.addEventListener("pointerup", onMkUp);
        window.addEventListener("pointercancel", onMkUp);
        try { plotEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        e.preventDefault();
        return;
      }
    }
    if (pts.size === 0) {
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { plotEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()];
      pinch = { hx: Math.abs(a!.x - b!.x), vy: Math.abs(a!.y - b!.y), mx: (a!.x + b!.x) / 2, my: (a!.y + b!.y) / 2 };
      pan = null;
    } else {
      pan = { x: e.clientX, y: e.clientY, v: { ...view }, r: { ...ry }, moved: false };
    }
    e.preventDefault();
  });
  // iOS Safari: pointer capture alone sometimes still scrolls the page mid-drag.
  plotEl.addEventListener("touchmove", (e) => { if (pts.size > 0) e.preventDefault(); }, { passive: false });
  // Chrome/Android: the browser commits to a scroll gesture at touchstart time, BEFORE
  // touchmove fires. For freepan (2D) charts we must preventDefault at touchstart so
  // the browser never starts a scroll — otherwise any slightly-vertical drag triggers
  // page scroll + pointercancel, breaking chart panning. Only for svgc-freepan
  // containers; other charts intentionally keep touch-action:pan-y so page scroll works.
  plotEl.addEventListener("touchstart", (e) => {
    if (interactive() && container.classList.contains("svgc-freepan")) e.preventDefault();
  }, { passive: false });
  plotEl.addEventListener("pointermove", (e) => {
    if (pts.size > 0 || e.buttons !== 0 || pinned) return; // a pinned popup wins over hover
    if (e.pointerType === "mouse") showTip(e.clientX);
  });
  plotEl.addEventListener("pointerleave", () => { if (!pinned) hideTip(); });
  // Double-click (desktop) / double-tap (mobile, handled in onUp) re-fits the view.
  plotEl.addEventListener("dblclick", () => { if (interactive()) fitView(); });
  plotEl.addEventListener(
    "wheel",
    (e) => {
      if (!interactive()) return;
      e.preventDefault();
      const { fx, vfrac } = pixInfo(e.clientX, e.clientY);
      const k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      // Shift+wheel = X only, Alt+wheel = Y only, plain = both.
      zoomXY(fx, vfrac, e.altKey ? 1 : k, e.shiftKey ? 1 : k);
      hideTip();
      draw();
    },
    { passive: false },
  );
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => draw()).observe(plotEl);

  // Legend keys double as show/hide toggles (when there are 2+ series). Toggling
  // keeps the current pan/zoom — only the series and tooltip update.
  const toggleSeries = (name: string) => {
    if (hidden.has(name)) hidden.delete(name);
    else hidden.add(name);
    hideTip();
    // Visible set changed → recompute which days compact, and re-frame to them.
    if (useCompact()) { rebuildCompactor(); resetView(); }
    draw();
  };
  /** Bulk toggle: every series whose name's segment `pos` equals `value`. If they're
   * all visible → hide them all; otherwise → show them all. */
  const toggleGroup = (pos: number, value: string) => {
    const grp = cfg.series.filter((s) => !s.noLegend && s.name.split(" · ")[pos] === value);
    if (grp.length === 0) return;
    const allVisible = grp.every((s) => !hidden.has(s.name));
    for (const s of grp) { if (allVisible) hidden.add(s.name); else hidden.delete(s.name); }
    hideTip();
    if (useCompact()) { rebuildCompactor(); resetView(); }
    draw();
  };
  legendEl.addEventListener("click", (e) => {
    // toggleSeries() redraws and rebuilds this legend's DOM, detaching the node
    // that was just clicked. If the click then bubbled to the document
    // outside-click handler, `legendEl.contains(target)` would be false (the node
    // is now orphaned) and it would wrongly close the legend. Stop propagation on
    // any in-legend action so the legend stays open until you click truly outside.
    if ((e.target as HTMLElement).closest(".svgc-center")) { e.stopPropagation(); if (interactive()) fitView(); return; }
    if ((e.target as HTMLElement).closest(".svgc-compact")) { e.stopPropagation(); setCompactPref(!compactPref); return; }
    const sb = (e.target as HTMLElement).closest<HTMLElement>(".svgc-style-btn");
    if (sb?.dataset.stylebtn) { e.stopPropagation(); if (sb.dataset.stylebtn === "faint") setFaintLines(!faintLines); else setDataTags(!dataTags); return; }
    const grp = (e.target as HTMLElement).closest<HTMLElement>(".svgc-grp-chip");
    if (grp?.dataset.grouppos !== undefined && grp.dataset.groupval !== undefined) {
      e.stopPropagation(); toggleGroup(Number(grp.dataset.grouppos), grp.dataset.groupval); return;
    }
    const key = (e.target as HTMLElement).closest<HTMLElement>(".svgc-key.is-toggle");
    if (key?.dataset.series) { e.stopPropagation(); toggleSeries(key.dataset.series); }
  });
  legendEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const key = (e.target as HTMLElement).closest<HTMLElement>(".svgc-key.is-toggle");
    if (key?.dataset.series) { e.preventDefault(); toggleSeries(key.dataset.series); }
  });
  // Close the floating legend only when clicking OUTSIDE it (so toggling several
  // series in a row keeps it open). Drops itself once the chart is detached.
  const onDocClick = (e: MouseEvent) => {
    if (!container.isConnected) { document.removeEventListener("click", onDocClick); return; }
    if (!legendOpen) return;
    if (legendEl.contains(e.target as Node)) return;
    legendOpen = false;
    const fold = legendEl.querySelector<HTMLDetailsElement>(".svgc-legend-fold");
    if (fold) fold.open = false;
  };
  document.addEventListener("click", onDocClick);

  // Follow the app-wide compacted-time preference: when it flips on any chart,
  // every compactable chart re-frames and redraws. Stale subs (after a re-mount
  // into the same container) drop themselves once detached.
  if (cfg.compactable) {
    const sub = () => {
      if (!container.isConnected) { compactSubs.delete(sub); return; }
      rebuildCompactor(); // visible set may have changed while in realistic mode
      resetView();
      hideTip();
      draw();
    };
    compactSubs.add(sub);
  }
  // Follow the app-wide faint-lines / tags prefs (toggled from this chart's legend).
  if (cfg.styleToggles) {
    const sub = () => { if (!container.isConnected) { styleSubs.delete(sub); return; } hideTip(); draw(); };
    styleSubs.add(sub);
  }

  rebuildCompactor();
  resetView();
  // Restore a saved pan/zoom instead of the auto-fit (dashboard "remember my view"). Treat
  // it as a user adjustment so a later series update keeps it (double-tap re-fits). ry (the
  // dependent right axis) stays freshly fitted by resetView above.
  if (finiteBox(cfg.initialView)) { view = { ...cfg.initialView }; userAdjusted = true; }
  draw();

  return {
    update(next: Partial<SvgChartConfig>) {
      const seriesChanged = next.series !== undefined;
      // NOTE (PB-8): this MERGES — an optional key absent from `next` keeps its previous
      // value. Callers that build a full config must therefore pass every toggleable key
      // EXPLICITLY (undefined when off), or a turned-off feature (e.g. the per-bodyweight
      // forceLeftRange) leaves a stale value pinning the view. Partial callers (e.g.
      // `update({ series: [] })`) rely on this merge to keep the rest of their config.
      cfg = { ...cfg, ...next };
      // Series changed (e.g. a metric toggled on/off): keep the time-axis mapping
      // fresh, but only RE-FIT the view if the user hasn't panned/zoomed — so adding
      // / removing metrics preserves the user's pan & zoom (double-tap to re-fit).
      // Re-fit the whole view only if the user hasn't panned/zoomed; but ALWAYS re-fit
      // the right axis to the (possibly new) bar metric, so its bars never overflow a
      // stale right-axis scale left over from a different metric.
      // PB-39 ROOT FIX: the dashboard sends a fresh series every render (seriesChanged always
      // true), so a reused chart used to resetView() to the data fit on EVERY re-render —
      // discarding the saved pan/zoom, because update() ignored cfg.initialView (it was only
      // honored on a fresh mount). Now the update path HONORS the saved view too: keep the live
      // pan if the user is mid-adjust (fitRight only); else restore the saved initialView if one
      // is supplied; else fall back to the data fit. So "remember my view" holds across the
      // same-bubble re-renders the stage-reuse fix routes through update().
      if (seriesChanged) {
        rebuildCompactor();
        if (userAdjusted) fitRight();
        else if (finiteBox(cfg.initialView)) { view = { ...cfg.initialView }; userAdjusted = true; fitRight(); }
        else resetView();
      }
      hideTip();
      draw();
    },
  };
}
