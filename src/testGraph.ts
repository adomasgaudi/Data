// 🧪 testGraph — a BRAND-NEW, from-scratch line chart for the Testing page.
//
// Deliberately NOT built on svgChart/analyticsGraph: it has ZERO event listeners
// (no pointerdown/move/wheel/touch), and it never sets `touch-action`. It is just
// static SVG markup dropped into the container. Because nothing here captures a
// touch, a finger-swipe over it scrolls the PAGE exactly like plain text would.
//
// Responsive without JS: one `viewBox` + `width:100%` lets the browser scale it,
// so there's no ResizeObserver either. Pure render in → SVG out.

export interface TestPoint {
  x: number; // epoch ms
  y: number;
}
export interface TestSeries {
  label: string;
  color: string;
  points: TestPoint[];
}

const VB_W = 820; // viewBox units (not pixels — it scales to the container width)
const VB_H = 360;
const PAD = { top: 16, right: 16, bottom: 34, left: 46 };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function niceTicks(min: number, max: number, count: number): number[] {
  if (!(max > min)) return [min];
  const span = max - min;
  const rough = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
}

/** Render the chart as static SVG into `container` (replaces its contents). */
export function renderTestGraph(container: HTMLElement, series: TestSeries[]): void {
  const drawable = series.filter((s) => s.points.length > 0);
  if (drawable.length === 0) {
    container.innerHTML = `<p style="opacity:.7;padding:1rem 0;">No data for the current selection — pick one or more exercises on the Analysis tab first.</p>`;
    return;
  }

  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const s of drawable) for (const p of s.points) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  if (xMin === xMax) { xMin -= 86400000; xMax += 86400000; }
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  // A little headroom under/over so points don't sit on the frame.
  const yPad = (yMax - yMin) * 0.08;
  yMin = Math.max(0, yMin - yPad); yMax += yPad;

  const plotW = VB_W - PAD.left - PAD.right;
  const plotH = VB_H - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => PAD.top + (1 - (y - yMin) / (yMax - yMin)) * plotH;

  const parts: string[] = [];
  parts.push(
    `<svg viewBox="0 0 ${VB_W} ${VB_H}" width="100%" preserveAspectRatio="xMidYMid meet" ` +
    `style="display:block;font-family:inherit;font-size:13px;" role="img" aria-label="Test graph">`
  );

  // Y grid + labels.
  for (const ty of niceTicks(yMin, yMax, 5)) {
    const y = sy(ty);
    parts.push(`<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${VB_W - PAD.right}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity="0.12"/>`);
    parts.push(`<text x="${PAD.left - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="currentColor" fill-opacity="0.7">${Math.round(ty)}</text>`);
  }
  // X labels (date ticks).
  const xTickCount = 5;
  for (let i = 0; i <= xTickCount; i++) {
    const xv = xMin + ((xMax - xMin) * i) / xTickCount;
    const x = sx(xv);
    parts.push(`<line x1="${x.toFixed(1)}" y1="${PAD.top}" x2="${x.toFixed(1)}" y2="${VB_H - PAD.bottom}" stroke="currentColor" stroke-opacity="0.06"/>`);
    parts.push(`<text x="${x.toFixed(1)}" y="${VB_H - PAD.bottom + 18}" text-anchor="middle" fill="currentColor" fill-opacity="0.7">${fmtDate(xv)}</text>`);
  }

  // Series: SCATTER plot — one dot per logged set, no connecting lines.
  for (const s of drawable) {
    for (const p of s.points) {
      parts.push(`<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="4" fill="${esc(s.color)}" fill-opacity="0.7" stroke="${esc(s.color)}" stroke-width="1"/>`);
    }
  }
  parts.push(`</svg>`);

  // Legend (plain HTML, also listener-free).
  const legend = drawable
    .map((s) => `<span style="display:inline-flex;align-items:center;gap:5px;margin:0 10px 6px 0;white-space:nowrap;">` +
      `<span style="width:11px;height:11px;border-radius:2px;background:${esc(s.color)};display:inline-block;"></span>` +
      `<span>${esc(s.label)}</span></span>`)
    .join("");

  container.innerHTML =
    `<div style="display:flex;flex-wrap:wrap;margin-bottom:6px;">${legend}</div>` + parts.join("");
}
