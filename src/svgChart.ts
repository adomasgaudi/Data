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
import { timeBands, niceTicks, buildCompactor, type TimeCompactor } from "./chartAxis";

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

export interface SvgPoint {
  x: number;
  y?: number; // line / bars
  lo?: number; // range bottom
  hi?: number; // range top
  /** For range bars: split the line into exactly this many dashes (e.g. reps). */
  dashes?: number;
  /** Extra text shown in the tooltip (e.g. "120×5"). */
  meta?: string;
}
export interface SvgSeries {
  name: string;
  color: string;
  type: "line" | "range" | "bars" | "scatter";
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
}
export interface SvgChartConfig {
  series: SvgSeries[];
  height?: number;
  /** Force the (left) y-axis to include 0. */
  yBeginAtZero?: boolean;
  rightBeginAtZero?: boolean;
  /** Stretch the right y-axis by this factor so its series sit low/squished
   * (e.g. 3 = bars only fill the bottom third). Default 1. */
  rightHeadroom?: number;
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
  /** Allow pan/zoom (default true). */
  interactive?: boolean;
  /** "xy" (default) = free 2-D pan/zoom; "x" = horizontal only (y stays put). */
  panMode?: "x" | "xy";
  /** Note shown under the legend. */
  note?: string;
}
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
  const plotEl = container.querySelector<HTMLElement>(".svgc-plot")!;
  const noteEl = container.querySelector<HTMLElement>(".svgc-note")!;
  const tipEl = container.querySelector<HTMLElement>(".svgc-tip")!;
  const clipId = `svgc-clip-${Math.random().toString(36).slice(2, 8)}`;

  // View: x + left-y pan/zoom. The right-y scale is fixed to its data range.
  let view = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  let ry = { yMin: 0, yMax: 1 };
  const margins = () => (inside() ? { l: 6, r: 6, t: 8, b: 6 } : { l: 46, r: hasRight() ? 40 : 14, t: 12, b: 26 });
  const widthOf = () => Math.max(260, Math.round(plotEl.clientWidth || container.clientWidth || 320));

  function resetView() {
    const xe = xExtent(geomSeries().filter(visible));
    if (!Number.isFinite(xe.xMin)) { view = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }; ry = { yMin: 0, yMax: 1 }; return; }
    const xPad = (xe.xMax - xe.xMin) * 0.02 || 1;
    const le = yExtent(leftSeries(), cfg.yBeginAtZero);
    if (Number.isFinite(le.yMin)) {
      const yPad = (le.yMax - le.yMin) * 0.08 || 1;
      view = { xMin: xe.xMin - xPad, xMax: xe.xMax + xPad, yMin: le.yMin - (cfg.yBeginAtZero ? 0 : yPad), yMax: le.yMax + yPad };
    } else {
      view = { xMin: xe.xMin - xPad, xMax: xe.xMax + xPad, yMin: 0, yMax: 1 };
    }
    const re = yExtent(rightSeries(), cfg.rightBeginAtZero);
    if (Number.isFinite(re.yMin)) {
      const ryPad = (re.yMax - re.yMin) * 0.08 || 1;
      ry = { yMin: re.yMin - (cfg.rightBeginAtZero ? 0 : ryPad), yMax: re.yMax + ryPad };
      // Stretch the top so these series sit low (don't tower over the left-axis data).
      const hf = cfg.rightHeadroom ?? 1;
      if (hf > 1) ry = { yMin: ry.yMin, yMax: ry.yMin + (ry.yMax - ry.yMin) * hf };
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
    const xPix = (x: number) => M.l + ((x - view.xMin) / (view.xMax - view.xMin)) * plotW;
    const yL = (y: number) => M.t + (1 - (y - view.yMin) / (view.yMax - view.yMin)) * plotH;
    const yR = (y: number) => M.t + (1 - (y - ry.yMin) / (ry.yMax - ry.yMin)) * plotH;
    const yOf = (s: SvgSeries) => (s.axis === "right" ? yR : yL);

    let grid = "";
    let yLabels = "";
    for (const v of niceTicks(view.yMin, view.yMax, 6)) {
      const py = yL(v);
      if (py < M.t - 0.5 || py > h - M.b + 0.5) continue;
      grid += `<line x1="${M.l}" y1="${py.toFixed(1)}" x2="${W - M.r}" y2="${py.toFixed(1)}" class="svgc-grid" stroke-width="1"/>`;
      yLabels += inside()
        ? halo((M.l + 4).toString(), (py - 3).toFixed(1), "start", String(Math.round(v)))
        : `<text x="${M.l - 6}" y="${(py + 4).toFixed(1)}" text-anchor="end" class="svgc-axislabel" font-size="11">${Math.round(v)}</text>`;
    }
    // right-axis labels (no gridlines, to avoid a double grid)
    if (hasRight()) {
      for (const v of niceTicks(ry.yMin, ry.yMax, 6)) {
        const py = yR(v);
        if (py < M.t - 0.5 || py > h - M.b + 0.5) continue;
        yLabels += inside()
          ? halo((W - M.r - 4).toString(), (py - 3).toFixed(1), "end", String(Math.round(v)))
          : `<text x="${W - M.r + 6}" y="${(py + 4).toFixed(1)}" text-anchor="start" class="svgc-axislabel" font-size="11">${Math.round(v)}</text>`;
      }
    }

    // x bands + gridlines + thinned labels.
    let xLabels = "";
    let bands = "";
    const clampX = (px: number) => Math.max(M.l, Math.min(W - M.r, px));
    if (xKind() === "time" && !useCompact()) {
      // Calendar bands (day/week/month/year): alternating background stripes give
      // the period at a glance, and each band's label is centred in it — so labels
      // never disappear when you zoom in and never collide into "Jan 1, Jan 1".
      let lastLabelPx = -Infinity;
      for (const b of timeBands(view.xMin, view.xMax)) {
        const x0 = xPix(b.start);
        const x1 = xPix(b.end);
        if (x1 < M.l - 0.5 || x0 > W - M.r + 0.5) continue;
        const cx0 = clampX(x0);
        const cx1 = clampX(x1);
        if (b.shade && cx1 - cx0 > 0.5)
          bands += `<rect x="${cx0.toFixed(1)}" y="${M.t}" width="${(cx1 - cx0).toFixed(1)}" height="${(h - M.b - M.t).toFixed(1)}" class="svgc-band"/>`;
        // gridline at the band boundary
        if (x0 >= M.l - 0.5 && x0 <= W - M.r + 0.5)
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
    let legend = "";
    // Legend keys become toggles only when there are 2+ of them (a single series
    // shouldn't be hide-able into a blank chart).
    const legendCount = cfg.series.filter((s) => !s.noLegend).length;
    const toggleable = legendCount >= 2;
    for (const s of geomSeries()) {
      if (!s.noLegend)
        legend +=
          `<span class="svgc-key${toggleable ? " is-toggle" : ""}${visible(s) ? "" : " is-off"}"` +
          `${toggleable ? ` role="button" tabindex="0" data-series="${esc(s.name)}" title="Show/hide ${esc(s.name)}"` : ""}>` +
          `<span class="svgc-dot" style="background:${s.color}"></span>${esc(s.name)}</span>`;
      if (!visible(s)) continue; // hidden: in the legend, but not drawn
      const ymap = yOf(s);
      if (s.type === "line") {
        const d = s.points.map((p) => `${xPix(p.x).toFixed(1)},${ymap(p.y ?? 0).toFixed(1)}`).join(" ");
        body += `<polyline points="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-opacity="0.9"/>`;
        for (const p of s.points) body += `<circle cx="${xPix(p.x).toFixed(1)}" cy="${ymap(p.y ?? 0).toFixed(1)}" r="2.4" fill="${s.color}" fill-opacity="0.6"/>`;
      } else if (s.type === "scatter") {
        // Dots only, no connecting line — for values that jump around (e.g. a
        // day's est-1RM) where a line would imply a trend that isn't there. Slight
        // transparency so overlapping same-day sets read as a denser blob (depth).
        for (const p of s.points) body += `<circle cx="${xPix(p.x).toFixed(1)}" cy="${ymap(p.y ?? 0).toFixed(1)}" r="3.2" fill="${s.color}" fill-opacity="0.55"/>`;
      } else if (s.type === "range") {
        for (const p of s.points) {
          const x = xPix(p.x);
          const yHi = ymap(p.hi ?? 0);
          const yLo = ymap(p.lo ?? 0);
          const L = Math.abs(yLo - yHi);
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
      } else {
        // bars: from baseline (0, clamped into plot) to the value. Each bar is as
        // wide as the data's own x-step (e.g. one week) so bars butt up against
        // each other like a histogram, rather than thin fixed-width sticks.
        const inView = s.points.filter((p) => xPix(p.x) >= M.l && xPix(p.x) <= W - M.r);
        const xs = s.points.map((p) => p.x).sort((a, b) => a - b);
        let step = Infinity;
        for (let i = 1; i < xs.length; i++) { const d = xs[i]! - xs[i - 1]!; if (d > 0 && d < step) step = d; }
        const stepPx = Number.isFinite(step) ? (step / (view.xMax - view.xMin)) * plotW : plotW / Math.max(1, inView.length);
        const bw = Math.max(2, stepPx * 0.63); // ~30% thinner than a full week
        const base = Math.min(h - M.b, Math.max(M.t, ymap(0)));
        // Bars can be outline-only or a translucent fill so they don't hide other series.
        const paint = s.outline
          ? `fill="none" stroke="${s.color}" stroke-width="1.3"`
          : `fill="${s.color}" fill-opacity="${s.fillOpacity ?? 1}"`;
        for (const p of s.points) {
          const x = xPix(p.x);
          if (x < M.l - bw || x > W - M.r + bw) continue;
          const top = ymap(p.y ?? 0);
          body += `<rect x="${(x - bw / 2).toFixed(1)}" y="${Math.min(top, base).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.abs(base - top).toFixed(1)}" rx="2" ${paint}/>`;
        }
      }
    }

    const frame = inside()
      ? `<rect x="${M.l}" y="${M.t}" width="${plotW}" height="${plotH}" fill="none" class="svgc-frame" stroke-width="1"/>`
      : `<line x1="${M.l}" y1="${M.t}" x2="${M.l}" y2="${h - M.b}" class="svgc-frame" stroke-width="1"/>` +
        `<line x1="${M.l}" y1="${h - M.b}" x2="${W - M.r}" y2="${h - M.b}" class="svgc-frame" stroke-width="1"/>`;

    // Time-axis charts get an app-wide "realistic ⇄ compacted" toggle on the right
    // of the legend row. Compacted squeezes the empty gaps so all sets fit.
    if (compactable() && !cfg.noCompactToggle)
      legend +=
        `<button type="button" class="svgc-compact${useCompact() ? " is-on" : ""}" aria-pressed="${useCompact()}" ` +
        `title="${useCompact() ? "Showing compacted time (gaps squeezed). Tap for real time spacing." : "Showing real time (with the gaps). Tap to squeeze the gaps so all sets fit."}">` +
        `${useCompact() ? "⇄ Compacted time" : "⇄ Realistic time"}</button>`;
    legendEl.innerHTML = legend;
    noteEl.textContent = cfg.note ?? "";
    noteEl.hidden = !cfg.note;
    plotEl.innerHTML =
      `<svg class="svgc-svg" width="100%" height="${h}" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" role="img">` +
      `<defs><clipPath id="${clipId}"><rect x="${M.l}" y="${M.t}" width="${plotW}" height="${plotH}"/></clipPath></defs>` +
      `<g clip-path="url(#${clipId})">${bands}${grid}${body}${inside() ? xLabels + yLabels : ""}</g>` +
      frame +
      (inside() ? "" : xLabels + yLabels) +
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
    const xVal = view.xMin + ((localX - M.l) / plotW) * (view.xMax - view.xMin);
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
        return `<div class="svgc-tip-row"><span class="svgc-dot" style="background:${s.color}"></span>${esc(s.name)}: <b>${val}</b></div>`;
      })
      .join("");
    tipEl.innerHTML = `<div class="svgc-tip-hd">${esc(fmtTipX(xv))}</div>${rows}`;
    tipEl.hidden = false;
    const px = M.l + ((xv - view.xMin) / (view.xMax - view.xMin)) * plotW;
    tipEl.style.left = `${Math.min(Math.max(px, 8), (plotEl.clientWidth || W) - tipEl.offsetWidth - 8)}px`;
    tipEl.style.top = `4px`;
  }
  const hideTip = () => { tipEl.hidden = true; };

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
    return { fx: view.xMin + ((lx - M.l) / plotW) * (view.xMax - view.xMin), vfrac: (ly - M.t) / plotH };
  }
  /** Zoom by independent factors per axis (>1 = out): x about fx, y about the
   * screen-fraction `vfrac` so BOTH the left and right y-axes scale together. */
  function zoomXY(fx: number, vfrac: number, kx: number, ky: number) {
    let { xMin, xMax, yMin, yMax } = view;
    xMin = fx - (fx - xMin) * kx;
    xMax = fx + (xMax - fx) * kx;
    if (!panX()) {
      const fyL = yMin + (1 - vfrac) * (yMax - yMin);
      yMin = fyL - (fyL - yMin) * ky;
      yMax = fyL + (yMax - fyL) * ky;
      const fyR = ry.yMin + (1 - vfrac) * (ry.yMax - ry.yMin);
      ry = { yMin: fyR - (fyR - ry.yMin) * ky, yMax: fyR + (ry.yMax - fyR) * ky };
    }
    view = { xMin, xMax, yMin, yMax };
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
      const lr = view.yMax - view.yMin;
      view = { xMin: view.xMin - fracX * (view.xMax - view.xMin), xMax: view.xMax - fracX * (view.xMax - view.xMin), yMin: view.yMin + fracY * lr, yMax: view.yMax + fracY * lr };
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
      const dy = fracY * (pan.v.yMax - pan.v.yMin);
      view = { xMin: pan.v.xMin - dx, xMax: pan.v.xMax - dx, yMin: pan.v.yMin + dy, yMax: pan.v.yMax + dy };
      if (!panX()) { const rr = pan.r.yMax - pan.r.yMin; ry = { yMin: pan.r.yMin + fracY * rr, yMax: pan.r.yMax + fracY * rr }; }
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
      if (wasTap) showTip(e.clientX);
    }
  };
  plotEl.addEventListener("pointerdown", (e) => {
    if (!interactive()) { showTip(e.clientX); return; }
    if (pts.size === 0) {
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()];
      pinch = { hx: Math.abs(a!.x - b!.x), vy: Math.abs(a!.y - b!.y), mx: (a!.x + b!.x) / 2, my: (a!.y + b!.y) / 2 };
      pan = null;
    } else {
      pan = { x: e.clientX, y: e.clientY, v: { ...view }, r: { ...ry }, moved: false };
    }
    e.preventDefault();
  });
  plotEl.addEventListener("pointermove", (e) => {
    if (pts.size > 0 || e.buttons !== 0) return;
    if (e.pointerType === "mouse") showTip(e.clientX);
  });
  plotEl.addEventListener("pointerleave", hideTip);
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
  legendEl.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".svgc-compact")) { setCompactPref(!compactPref); return; }
    const key = (e.target as HTMLElement).closest<HTMLElement>(".svgc-key.is-toggle");
    if (key?.dataset.series) toggleSeries(key.dataset.series);
  });
  legendEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const key = (e.target as HTMLElement).closest<HTMLElement>(".svgc-key.is-toggle");
    if (key?.dataset.series) { e.preventDefault(); toggleSeries(key.dataset.series); }
  });

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

  rebuildCompactor();
  resetView();
  draw();

  return {
    update(next: Partial<SvgChartConfig>) {
      const seriesChanged = next.series !== undefined;
      cfg = { ...cfg, ...next };
      if (seriesChanged) { rebuildCompactor(); resetView(); }
      hideTip();
      draw();
    },
  };
}
