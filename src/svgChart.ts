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
import { calendarGridlines, niceTicks } from "./chartAxis";

export interface SvgPoint {
  x: number;
  y?: number; // line / bars
  lo?: number; // range bottom
  hi?: number; // range top
  /** Extra text shown in the tooltip (e.g. "120×5"). */
  meta?: string;
}
export interface SvgSeries {
  name: string;
  color: string;
  type: "line" | "range" | "bars";
  /** Which y-scale this series uses (default "left"). */
  axis?: "left" | "right";
  points: SvgPoint[];
  /** Keep this series out of the legend (e.g. a trend line). */
  noLegend?: boolean;
}
export interface SvgChartConfig {
  series: SvgSeries[];
  height?: number;
  /** Force the (left) y-axis to include 0. */
  yBeginAtZero?: boolean;
  rightBeginAtZero?: boolean;
  yUnit?: string;
  rightUnit?: string;
  xKind?: "time" | "linear";
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
  const fmtX = (x: number) => (cfg.formatX ? cfg.formatX(x) : xKind() === "time" ? dateLabel(x) : num(x));
  const fmtTipX = (x: number) => (cfg.formatTipX ? cfg.formatTipX(x) : fmtX(x));
  const leftSeries = () => cfg.series.filter((s) => s.axis !== "right");
  const rightSeries = () => cfg.series.filter((s) => s.axis === "right");
  const hasRight = () => rightSeries().length > 0;

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
    const xe = xExtent(cfg.series);
    if (!Number.isFinite(xe.xMin)) { view = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }; ry = { yMin: 0, yMax: 1 }; return; }
    const xPad = (xe.xMax - xe.xMin) * 0.02 || 1;
    const le = yExtent(leftSeries(), cfg.yBeginAtZero);
    const yPad = (le.yMax - le.yMin) * 0.08 || 1;
    view = { xMin: xe.xMin - xPad, xMax: xe.xMax + xPad, yMin: le.yMin - (cfg.yBeginAtZero ? 0 : yPad), yMax: le.yMax + yPad };
    const re = yExtent(rightSeries(), cfg.rightBeginAtZero);
    const ryPad = (re.yMax - re.yMin) * 0.08 || 1;
    ry = { yMin: re.yMin - (cfg.rightBeginAtZero ? 0 : ryPad), yMax: re.yMax + ryPad };
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

    // x gridlines + thinned labels.
    let xLabels = "";
    const xticks = xKind() === "time" ? calendarGridlines(view.xMin, view.xMax) : niceTicks(view.xMin, view.xMax, 7);
    let lastLabelPx = -Infinity;
    for (const t of xticks) {
      const px = xPix(t);
      if (px < M.l - 0.5 || px > W - M.r + 0.5) continue;
      grid += `<line x1="${px.toFixed(1)}" y1="${M.t}" x2="${px.toFixed(1)}" y2="${h - M.b}" class="svgc-grid" stroke-width="1"/>`;
      if (px - lastLabelPx < 42) continue; // thin crowded labels (gridlines stay)
      lastLabelPx = px;
      xLabels += inside()
        ? halo(px.toFixed(1), (h - M.b - 5).toFixed(1), "middle", fmtX(t))
        : `<text x="${px.toFixed(1)}" y="${(h - M.b + 16).toFixed(1)}" text-anchor="middle" class="svgc-axislabel" font-size="11">${fmtX(t)}</text>`;
    }

    // series
    let body = "";
    let legend = "";
    for (const s of cfg.series) {
      const ymap = yOf(s);
      if (s.type === "line") {
        const d = s.points.map((p) => `${xPix(p.x).toFixed(1)},${ymap(p.y ?? 0).toFixed(1)}`).join(" ");
        body += `<polyline points="${d}" fill="none" stroke="${s.color}" stroke-width="2"/>`;
        for (const p of s.points) body += `<circle cx="${xPix(p.x).toFixed(1)}" cy="${ymap(p.y ?? 0).toFixed(1)}" r="2.4" fill="${s.color}"/>`;
      } else if (s.type === "range") {
        for (const p of s.points) {
          const x = xPix(p.x);
          body += `<line x1="${x.toFixed(1)}" y1="${ymap(p.hi ?? 0).toFixed(1)}" x2="${x.toFixed(1)}" y2="${ymap(p.lo ?? 0).toFixed(1)}" stroke="${s.color}" stroke-width="4" stroke-linecap="round"/>`;
        }
      } else {
        // bars: from baseline (0, clamped into plot) to the value.
        const inView = s.points.filter((p) => xPix(p.x) >= M.l && xPix(p.x) <= W - M.r);
        const bw = Math.max(2, Math.min(22, (plotW / Math.max(1, inView.length)) * 0.5));
        const base = Math.min(h - M.b, Math.max(M.t, ymap(0)));
        for (const p of s.points) {
          const x = xPix(p.x);
          if (x < M.l - bw || x > W - M.r + bw) continue;
          const top = ymap(p.y ?? 0);
          body += `<rect x="${(x - bw / 2).toFixed(1)}" y="${Math.min(top, base).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.abs(base - top).toFixed(1)}" rx="2" fill="${s.color}"/>`;
        }
      }
      if (!s.noLegend) legend += `<span class="svgc-key"><span class="svgc-dot" style="background:${s.color}"></span>${esc(s.name)}</span>`;
    }

    const frame = inside()
      ? `<rect x="${M.l}" y="${M.t}" width="${plotW}" height="${plotH}" fill="none" class="svgc-frame" stroke-width="1"/>`
      : `<line x1="${M.l}" y1="${M.t}" x2="${M.l}" y2="${h - M.b}" class="svgc-frame" stroke-width="1"/>` +
        `<line x1="${M.l}" y1="${h - M.b}" x2="${W - M.r}" y2="${h - M.b}" class="svgc-frame" stroke-width="1"/>`;

    legendEl.innerHTML = legend;
    noteEl.textContent = cfg.note ?? "";
    noteEl.hidden = !cfg.note;
    plotEl.innerHTML =
      `<svg class="svgc-svg" width="100%" height="${h}" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" role="img">` +
      `<defs><clipPath id="${clipId}"><rect x="${M.l}" y="${M.t}" width="${plotW}" height="${plotH}"/></clipPath></defs>` +
      `<g clip-path="url(#${clipId})">${grid}${body}${inside() ? xLabels + yLabels : ""}</g>` +
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
    let best: { p: SvgPoint; dx: number } | null = null;
    for (const s of cfg.series) for (const p of s.points) {
      const dx = Math.abs(p.x - xVal);
      if (!best || dx < best.dx) best = { p, dx };
    }
    if (!best) return;
    const xv = best.p.x;
    const rows = cfg.series
      .map((s) => {
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
  /** Data (x,y) under a client pixel, using the live view + current geometry. */
  function dataAt(clientX: number, clientY: number) {
    const svg = plotEl.querySelector("svg");
    const rect = svg ? svg.getBoundingClientRect() : plotEl.getBoundingClientRect();
    const W = widthOf();
    const h = H();
    const M = margins();
    const plotW = W - M.l - M.r;
    const plotH = h - M.t - M.b;
    const lx = ((clientX - rect.left) / rect.width) * W;
    const ly = ((clientY - rect.top) / rect.height) * h;
    return {
      x: view.xMin + ((lx - M.l) / plotW) * (view.xMax - view.xMin),
      y: view.yMin + (1 - (ly - M.t) / plotH) * (view.yMax - view.yMin),
    };
  }
  /** Zoom about data point (fx, fy) by independent factors per axis (>1 = out). */
  function zoomXY(fx: number, fy: number, kx: number, ky: number) {
    view = {
      xMin: fx - (fx - view.xMin) * kx,
      xMax: fx + (view.xMax - fx) * kx,
      yMin: panX() ? view.yMin : fy - (fy - view.yMin) * ky,
      yMax: panX() ? view.yMax : fy + (view.yMax - fy) * ky,
    };
  }

  const SPREAD = 26; // min finger spread (px) on an axis before that axis stretches
  const pts = new Map<number, { x: number; y: number }>();
  let pan: { x: number; y: number; v: typeof view; moved: boolean } | null = null;
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
      // pan by midpoint movement
      const ddx = ((mx - pinch.mx) / plotW) * (view.xMax - view.xMin);
      const ddy = panX() ? 0 : ((my - pinch.my) / plotH) * (view.yMax - view.yMin);
      view = { xMin: view.xMin - ddx, xMax: view.xMax - ddx, yMin: view.yMin + ddy, yMax: view.yMax + ddy };
      // per-axis zoom about the midpoint, gated by the spread on each axis
      const f = dataAt(mx, my);
      const kx = pinch.hx > SPREAD && hx > 4 ? pinch.hx / hx : 1;
      const ky = pinch.vy > SPREAD && vy > 4 ? pinch.vy / vy : 1;
      zoomXY(f.x, f.y, kx, ky);
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
      const dy = panX() ? 0 : ((e.clientY - pan.y) / plotH) * (pan.v.yMax - pan.v.yMin);
      view = { xMin: pan.v.xMin - dx, xMax: pan.v.xMax - dx, yMin: pan.v.yMin + dy, yMax: pan.v.yMax + dy };
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
      pan = { x: p.x, y: p.y, v: { ...view }, moved: true }; // keep panning with the remaining finger
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
      pan = { x: e.clientX, y: e.clientY, v: { ...view }, moved: false };
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
      const f = dataAt(e.clientX, e.clientY);
      const k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      // Shift+wheel = X only, Alt+wheel = Y only, plain = both.
      zoomXY(f.x, f.y, e.altKey ? 1 : k, e.shiftKey ? 1 : k);
      hideTip();
      draw();
    },
    { passive: false },
  );
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => draw()).observe(plotEl);

  resetView();
  draw();

  return {
    update(next: Partial<SvgChartConfig>) {
      const seriesChanged = next.series !== undefined;
      cfg = { ...cfg, ...next };
      if (seriesChanged) resetView();
      hideTip();
      draw();
    },
  };
}
