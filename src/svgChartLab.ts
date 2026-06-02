/**
 * LAB COPY of svgChart.ts — a safe place to iterate on the chart without
 * touching the working one. Difference from the shipped engine: x-axis labels
 * are thinned so they never overlap at wide zoom (the cramped-months fix).
 * NO Chart.js: fixed plot rectangle, free 2-D pan/zoom, tap/hover tooltip.
 *
 * Series kinds:
 *   • "line"  — points {x, y}; drawn as a polyline + dots.
 *   • "range" — points {x, lo, hi}; drawn as one floating bar per point.
 *
 * The pure axis maths (calendar gridlines, nice y ticks) live in chartAxis.ts and
 * are unit-tested; this module is the rendering + interaction shell.
 */
import { calendarGridlines, niceTicks } from "./chartAxis";

export interface SvgPoint {
  x: number;
  y?: number; // line
  lo?: number; // range bottom
  hi?: number; // range top
  /** Extra text shown in the tooltip (e.g. "120×5"). */
  meta?: string;
}
export interface SvgSeries {
  name: string;
  color: string;
  type: "line" | "range";
  points: SvgPoint[];
}
export interface SvgChartConfig {
  series: SvgSeries[];
  height?: number;
  /** Force the y-axis to include 0. */
  yBeginAtZero?: boolean;
  yUnit?: string;
  xKind?: "time" | "linear";
  /** Axis tick label for an x value. */
  formatX?: (x: number) => string;
  /** Tooltip header for an x value (defaults to formatX). */
  formatTipX?: (x: number) => string;
  /** Draw axis values inside the plot (wider) vs in outer margins. */
  insideLabels?: boolean;
  /** Allow pan/zoom (default true). */
  interactive?: boolean;
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

/** Min/max x and y across every series (range points count lo & hi). */
function extents(series: SvgSeries[]) {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      const ys = s.type === "range" ? [p.lo ?? 0, p.hi ?? 0] : [p.y ?? 0];
      for (const y of ys) {
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
  }
  return { xMin, xMax, yMin, yMax };
}

export function mountSvgChartLab(container: HTMLElement, initial: SvgChartConfig): SvgChart {
  let cfg: Required<Pick<SvgChartConfig, "series">> & SvgChartConfig = { ...initial };
  const H = () => cfg.height ?? 300;
  const inside = () => cfg.insideLabels ?? false;
  const interactive = () => cfg.interactive ?? true;
  const xKind = () => cfg.xKind ?? "time";
  const fmtX = (x: number) => (cfg.formatX ? cfg.formatX(x) : xKind() === "time" ? dateLabel(x) : num(x));
  const fmtTipX = (x: number) => (cfg.formatTipX ? cfg.formatTipX(x) : fmtX(x));

  // Persistent DOM: legend + plot (rebuilt each draw) + tooltip (kept).
  container.classList.add("svgc");
  container.innerHTML = `<div class="svgc-legend"></div><div class="svgc-plot"></div><div class="svgc-note muted"></div><div class="svgc-tip" hidden></div>`;
  const legendEl = container.querySelector<HTMLElement>(".svgc-legend")!;
  const plotEl = container.querySelector<HTMLElement>(".svgc-plot")!;
  const noteEl = container.querySelector<HTMLElement>(".svgc-note")!;
  const tipEl = container.querySelector<HTMLElement>(".svgc-tip")!;

  // View state (pan/zoom).
  let view = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  const margins = () => (inside() ? { l: 6, r: 6, t: 8, b: 6 } : { l: 46, r: 14, t: 12, b: 26 });
  const widthOf = () => Math.max(260, Math.round(plotEl.clientWidth || container.clientWidth || 320));

  function resetView() {
    const e = extents(cfg.series);
    if (!Number.isFinite(e.xMin)) { view = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }; return; }
    const xPad = (e.xMax - e.xMin) * 0.02 || 1;
    let yMin = e.yMin;
    let yMax = e.yMax;
    if (cfg.yBeginAtZero) yMin = Math.min(0, yMin);
    const yPad = (yMax - yMin) * 0.08 || 1;
    view = { xMin: e.xMin - xPad, xMax: e.xMax + xPad, yMin: yMin - (cfg.yBeginAtZero ? 0 : yPad), yMax: yMax + yPad };
  }

  function draw() {
    const W = widthOf();
    const h = H();
    const M = margins();
    const plotW = W - M.l - M.r;
    const plotH = h - M.t - M.b;
    const xPix = (x: number) => M.l + ((x - view.xMin) / (view.xMax - view.xMin)) * plotW;
    const yPix = (y: number) => M.t + (1 - (y - view.yMin) / (view.yMax - view.yMin)) * plotH;

    // y gridlines + labels (nice round values).
    let grid = "";
    let yLabels = "";
    for (const v of niceTicks(view.yMin, view.yMax, 6)) {
      const py = yPix(v);
      if (py < M.t - 0.5 || py > h - M.b + 0.5) continue;
      grid += `<line x1="${M.l}" y1="${py.toFixed(1)}" x2="${W - M.r}" y2="${py.toFixed(1)}" stroke="#d4d9e2" stroke-width="1"/>`;
      yLabels += inside()
        ? halo((M.l + 4).toString(), (py - 3).toFixed(1), "start", String(Math.round(v)))
        : `<text x="${M.l - 6}" y="${(py + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#6b7280">${Math.round(v)}</text>`;
    }

    // x gridlines + labels. Gridlines stay at every boundary, but LABELS are
    // thinned so they never overlap: only show one if it's far enough from the
    // last shown label (fixes the cramped months at wide zoom).
    let xLabels = "";
    const xticks = xKind() === "time" ? calendarGridlines(view.xMin, view.xMax) : niceTicks(view.xMin, view.xMax, 7);
    const minLabelGap = 42; // px between x labels
    let lastLabelPx = -Infinity;
    for (const t of xticks) {
      const px = xPix(t);
      if (px < M.l - 0.5 || px > W - M.r + 0.5) continue;
      grid += `<line x1="${px.toFixed(1)}" y1="${M.t}" x2="${px.toFixed(1)}" y2="${h - M.b}" stroke="#d4d9e2" stroke-width="1"/>`;
      if (px - lastLabelPx < minLabelGap) continue; // skip crowded labels
      lastLabelPx = px;
      xLabels += inside()
        ? halo(px.toFixed(1), (h - M.b - 5).toFixed(1), "middle", fmtX(t))
        : `<text x="${px.toFixed(1)}" y="${(h - M.b + 16).toFixed(1)}" text-anchor="middle" font-size="11" fill="#6b7280">${fmtX(t)}</text>`;
    }

    // series
    let body = "";
    let legend = "";
    for (const s of cfg.series) {
      if (s.type === "line") {
        const d = s.points.map((p) => `${xPix(p.x).toFixed(1)},${yPix(p.y ?? 0).toFixed(1)}`).join(" ");
        body += `<polyline points="${d}" fill="none" stroke="${s.color}" stroke-width="2"/>`;
        for (const p of s.points) body += `<circle cx="${xPix(p.x).toFixed(1)}" cy="${yPix(p.y ?? 0).toFixed(1)}" r="2.4" fill="${s.color}"/>`;
      } else {
        for (const p of s.points) {
          const x = xPix(p.x);
          body += `<line x1="${x.toFixed(1)}" y1="${yPix(p.hi ?? 0).toFixed(1)}" x2="${x.toFixed(1)}" y2="${yPix(p.lo ?? 0).toFixed(1)}" stroke="${s.color}" stroke-width="4" stroke-linecap="round"/>`;
        }
      }
      legend += `<span class="svgc-key"><span class="svgc-dot" style="background:${s.color}"></span>${esc(s.name)}</span>`;
    }

    const frame = inside()
      ? `<rect x="${M.l}" y="${M.t}" width="${plotW}" height="${plotH}" fill="none" stroke="#9aa3b2" stroke-width="1"/>`
      : `<line x1="${M.l}" y1="${M.t}" x2="${M.l}" y2="${h - M.b}" stroke="#9aa3b2" stroke-width="1"/>` +
        `<line x1="${M.l}" y1="${h - M.b}" x2="${W - M.r}" y2="${h - M.b}" stroke="#9aa3b2" stroke-width="1"/>`;

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

  const halo = (x: string, y: string, anchor: string, text: string) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="11" fill="#4b5563" stroke="#fff" stroke-width="3" style="paint-order:stroke">${esc(text)}</text>`;

  const clipId = `svgc-clip-${Math.random().toString(36).slice(2, 8)}`;

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
    // nearest point by x across all series
    let best: { s: SvgSeries; p: SvgPoint; dx: number } | null = null;
    for (const s of cfg.series) {
      for (const p of s.points) {
        const dx = Math.abs(p.x - xVal);
        if (!best || dx < best.dx) best = { s, p, dx };
      }
    }
    if (!best) return;
    // show all series' value at that x (same x match), grouped.
    const xv = best.p.x;
    const rows = cfg.series
      .map((s) => {
        const p = s.points.find((q) => q.x === xv);
        if (!p) return "";
        const val = s.type === "range" ? `${num(p.lo ?? 0)}→${num(p.hi ?? 0)}${p.meta ? " " + esc(p.meta) : ""}` : `${num(p.y ?? 0)}${cfg.yUnit ? " " + cfg.yUnit : ""}`;
        return `<div class="svgc-tip-row"><span class="svgc-dot" style="background:${s.color}"></span>${esc(s.name)}: <b>${val}</b></div>`;
      })
      .join("");
    tipEl.innerHTML = `<div class="svgc-tip-hd">${esc(fmtTipX(xv))}</div>${rows}`;
    tipEl.hidden = false;
    const px = xPixView(xv);
    tipEl.style.left = `${Math.min(Math.max(px, 8), (plotEl.clientWidth || W) - tipEl.offsetWidth - 8)}px`;
    tipEl.style.top = `4px`;
  }
  function xPixView(x: number) {
    const W = widthOf();
    const M = margins();
    const plotW = W - M.l - M.r;
    return M.l + ((x - view.xMin) / (view.xMax - view.xMin)) * plotW;
  }
  const hideTip = () => { tipEl.hidden = true; };

  // ---- interactions ----
  let drag: { x: number; y: number; v: typeof view; moved: boolean } | null = null;
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const W = widthOf();
    const h = H();
    const M = margins();
    const plotW = W - M.l - M.r;
    const plotH = h - M.t - M.b;
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
    const dx = ((e.clientX - drag.x) / plotW) * (drag.v.xMax - drag.v.xMin);
    const dy = ((e.clientY - drag.y) / plotH) * (drag.v.yMax - drag.v.yMin);
    view = { xMin: drag.v.xMin - dx, xMax: drag.v.xMax - dx, yMin: drag.v.yMin + dy, yMax: drag.v.yMax + dy };
    hideTip();
    draw();
  };
  const onUp = (e: PointerEvent) => {
    const wasTap = drag && !drag.moved;
    drag = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (wasTap) showTip(e.clientX);
  };
  plotEl.addEventListener("pointerdown", (e) => {
    if (!interactive()) { showTip(e.clientX); return; }
    drag = { x: e.clientX, y: e.clientY, v: { ...view }, moved: false };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    e.preventDefault();
  });
  plotEl.addEventListener("pointermove", (e) => {
    if (drag || e.buttons !== 0) return; // hover only (mouse)
    if (e.pointerType === "mouse") showTip(e.clientX);
  });
  plotEl.addEventListener("pointerleave", hideTip);
  plotEl.addEventListener(
    "wheel",
    (e) => {
      if (!interactive()) return;
      e.preventDefault();
      const svg = plotEl.querySelector("svg");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const W = widthOf();
      const h = H();
      const M = margins();
      const plotW = W - M.l - M.r;
      const plotH = h - M.t - M.b;
      const fx = view.xMin + (((e.clientX - rect.left) / rect.width) * W - M.l) / plotW * (view.xMax - view.xMin);
      const fy = view.yMin + (1 - (((e.clientY - rect.top) / rect.height) * h - M.t) / plotH) * (view.yMax - view.yMin);
      const k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      view = {
        xMin: fx - (fx - view.xMin) * k,
        xMax: fx + (view.xMax - fx) * k,
        yMin: fy - (fy - view.yMin) * k,
        yMax: fy + (view.yMax - fy) * k,
      };
      hideTip();
      draw();
    },
    { passive: false },
  );
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => draw()).observe(plotEl);
  }

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
