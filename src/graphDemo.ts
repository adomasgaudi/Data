/**
 * Stand-alone graph DEMO — a from-scratch SVG time-series chart with NO Chart.js
 * and no shared rendering code with the rest of the app. A clean test bed for a
 * replacement charting engine.
 *
 * The plot rectangle (and therefore the axis frame) is at FIXED pixel
 * coordinates, so the chrome never shifts. Inside it you can pan FREELY in any
 * direction (drag) and zoom (wheel/pinch) with NO limits — both axes' label
 * values follow the view. Series are clipped to the plot rect.
 */
import { calendarGridlines } from "./chartAxis";

interface Pt {
  t: number; // ms timestamp
  y: number;
}
interface Series {
  name: string;
  color: string;
  pts: Pt[];
}

const WEEK = 7 * 86_400_000;

/** Deterministic demo data (seeded) so the page always shows something stable. */
function demoSeries(): Series[] {
  const today = Date.now();
  const n = 26; // ~6 months of weekly points
  const make = (base: number, slope: number, noise: number, seed: number): Pt[] => {
    let s = seed;
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff; // tiny LCG
      const jitter = (s / 0x7fffffff - 0.5) * noise;
      pts.push({ t: today - (n - 1 - i) * WEEK, y: Math.max(0, base + slope * i + jitter) });
    }
    return pts;
  };
  return [
    { name: "Squat", color: "#284e86", pts: make(80, 1.4, 7, 7) },
    { name: "Bench Press", color: "#b8902f", pts: make(55, 0.7, 5, 13) },
  ];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (t: number) => {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
const escapeAttr = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] ?? c));

/** "Nice" round y-axis tick values across [min, max]. */
function niceTicks(min: number, max: number, target: number): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** Mount (or re-mount) the demo chart into `container`. Idempotent. */
export function mountGraphDemo(container: HTMLElement): void {
  const series = demoSeries();
  const allT = series.flatMap((s) => s.pts.map((p) => p.t));
  const allY = series.flatMap((s) => s.pts.map((p) => p.y));
  const dataMinT = Math.min(...allT);
  const dataMaxT = Math.max(...allT);
  const dataMaxY = Math.max(...allY);

  // Mutable view — pan/zoom change all four edges, with NO limits.
  let xMin = dataMinT;
  let xMax = dataMaxT;
  let yMin = 0;
  let yMax = Math.ceil((dataMaxY * 1.15) / 10) * 10;

  // Fixed geometry — the axis frame never moves.
  const H = 360;
  const M = { l: 46, r: 14, t: 30, b: 26 };
  const widthOf = () => Math.max(280, Math.round(container.clientWidth || 340));

  function draw() {
    const W = widthOf();
    const plotW = W - M.l - M.r;
    const plotH = H - M.t - M.b;
    const xPix = (t: number) => M.l + ((t - xMin) / (xMax - xMin)) * plotW;
    const yPix = (y: number) => M.t + (1 - (y - yMin) / (yMax - yMin)) * plotH;

    // Horizontal gridlines + y labels at nice round values within the view.
    let yGrid = "";
    let yLabels = "";
    for (const v of niceTicks(yMin, yMax, 6)) {
      const py = yPix(v);
      if (py < M.t - 0.5 || py > H - M.b + 0.5) continue;
      yGrid += `<line x1="${M.l}" y1="${py.toFixed(1)}" x2="${W - M.r}" y2="${py.toFixed(1)}" stroke="#d4d9e2" stroke-width="1"/>`;
      yLabels += `<text x="${M.l - 6}" y="${(py + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#6b7280">${Math.round(v)}</text>`;
    }

    // Vertical calendar gridlines + x labels for the current view.
    let xGrid = "";
    let xLabels = "";
    for (const t of calendarGridlines(xMin, xMax)) {
      const px = xPix(t);
      if (px < M.l - 0.5 || px > W - M.r + 0.5) continue;
      xGrid += `<line x1="${px.toFixed(1)}" y1="${M.t}" x2="${px.toFixed(1)}" y2="${H - M.b}" stroke="#d4d9e2" stroke-width="1"/>`;
      xLabels += `<text x="${px.toFixed(1)}" y="${H - M.b + 16}" text-anchor="middle" font-size="11" fill="#6b7280">${fmtDate(t)}</text>`;
    }

    // Series polylines + points (clipped to the plot rect).
    let lines = "";
    let legend = "";
    for (const s of series) {
      const d = s.pts.map((p) => `${xPix(p.t).toFixed(1)},${yPix(p.y).toFixed(1)}`).join(" ");
      lines += `<polyline points="${d}" fill="none" stroke="${s.color}" stroke-width="2" />`;
      for (const p of s.pts) lines += `<circle cx="${xPix(p.t).toFixed(1)}" cy="${yPix(p.y).toFixed(1)}" r="2.5" fill="${s.color}" />`;
      legend += `<span class="gd-key"><span class="gd-dot" style="background:${s.color}"></span>${escapeAttr(s.name)}</span>`;
    }

    container.innerHTML =
      `<div class="gd-legend">${legend}<button type="button" class="gd-reset">Reset</button></div>` +
      `<svg class="gd-svg" width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="demo chart">` +
      `<defs><clipPath id="gd-clip"><rect x="${M.l}" y="${M.t}" width="${plotW}" height="${plotH}"/></clipPath></defs>` +
      `<g clip-path="url(#gd-clip)">${yGrid}${xGrid}${lines}</g>` +
      `<line x1="${M.l}" y1="${M.t}" x2="${M.l}" y2="${H - M.b}" stroke="#9aa3b2" stroke-width="1"/>` +
      `<line x1="${M.l}" y1="${H - M.b}" x2="${W - M.r}" y2="${H - M.b}" stroke="#9aa3b2" stroke-width="1"/>` +
      yLabels +
      xLabels +
      `</svg>`;
  }

  // ---- interactions: free 2-D pan (drag) + zoom (wheel), no limits ----
  let drag: { x: number; y: number; xMin: number; xMax: number; yMin: number; yMax: number } | null = null;

  if (container.dataset.gdWired !== "1") {
    container.dataset.gdWired = "1";

    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const W = widthOf();
      const plotW = W - M.l - M.r;
      const plotH = H - M.t - M.b;
      const dx = ((e.clientX - drag.x) / plotW) * (drag.xMax - drag.xMin);
      const dy = ((e.clientY - drag.y) / plotH) * (drag.yMax - drag.yMin);
      // Content follows the cursor: drag right → shift x left; drag down → show
      // higher values (y range moves up). No clamping — pan is unlimited.
      xMin = drag.xMin - dx;
      xMax = drag.xMax - dx;
      yMin = drag.yMin + dy;
      yMax = drag.yMax + dy;
      draw();
    };
    const onUp = () => {
      drag = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    container.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest(".gd-reset")) return; // let the button click
      drag = { x: e.clientX, y: e.clientY, xMin, xMax, yMin, yMax };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      e.preventDefault();
    });

    // Wheel zooms BOTH axes around the cursor (free, unlimited).
    container.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const svg = container.querySelector("svg");
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const W = widthOf();
        const plotW = W - M.l - M.r;
        const plotH = H - M.t - M.b;
        const fx = xMin + (((e.clientX - rect.left) / rect.width) * W - M.l) / plotW * (xMax - xMin);
        const fy = yMin + (1 - (((e.clientY - rect.top) / rect.height) * H - M.t) / plotH) * (yMax - yMin);
        const k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
        xMin = fx - (fx - xMin) * k;
        xMax = fx + (xMax - fx) * k;
        yMin = fy - (fy - yMin) * k;
        yMax = fy + (yMax - fy) * k;
        draw();
      },
      { passive: false },
    );

    container.addEventListener("click", (e) => {
      if (!(e.target as HTMLElement).closest(".gd-reset")) return;
      xMin = dataMinT; xMax = dataMaxT; yMin = 0; yMax = Math.ceil((dataMaxY * 1.15) / 10) * 10;
      draw();
    });

    window.addEventListener("resize", () => { if (container.isConnected) draw(); });
  }

  draw();
}
