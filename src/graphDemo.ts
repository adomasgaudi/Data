/**
 * Stand-alone graph DEMO — a from-scratch SVG time-series chart with NO Chart.js
 * and no shared rendering code with the rest of the app. It exists so we can test
 * a clean replacement for the charting tech in isolation.
 *
 * Why SVG by hand: the axes are drawn at FIXED pixel coordinates (a fixed plot
 * rectangle), so panning/zooming only changes the x→pixel mapping inside a
 * clipped area — the axes and the "sides" can never shift, which is the bug the
 * Chart.js graphs keep hitting. Pan = drag; zoom = wheel/pinch; both clamp to the
 * data range so you can't drift into empty space.
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

const escapeAttr = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] ?? c));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (t: number) => {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

/** Mount (or re-mount) the demo chart into `container`. Idempotent. */
export function mountGraphDemo(container: HTMLElement): void {
  const series = demoSeries();
  const allT = series.flatMap((s) => s.pts.map((p) => p.t));
  const allY = series.flatMap((s) => s.pts.map((p) => p.y));
  const dataMin = Math.min(...allT);
  const dataMax = Math.max(...allT);
  const yMin = 0;
  const yMax = Math.max(20, Math.ceil(Math.max(...allY) / 20) * 20);

  // Mutable x-view (what pan/zoom change). Y is fixed. Start zoomed-in to the
  // most recent ~12 weeks so there's room to pan/scroll right away.
  const minSpan = 3 * WEEK; // tightest zoom-in
  const fullSpan = dataMax - dataMin;
  let xMax = dataMax;
  let xMin = Math.max(dataMin, dataMax - 12 * WEEK);

  // Fixed geometry — the whole point: axes never move.
  const H = 360;
  const M = { l: 46, r: 14, t: 30, b: 26 };
  const widthOf = () => Math.max(280, Math.round(container.clientWidth || 340));

  /** Clamp the [xMin,xMax] view to the data range, keeping its width. */
  function clampView() {
    const span = Math.min(Math.max(xMax - xMin, minSpan), fullSpan);
    if (xMin < dataMin) { xMin = dataMin; xMax = dataMin + span; }
    if (xMax > dataMax) { xMax = dataMax; xMin = dataMax - span; }
    if (xMax - xMin !== span) xMax = xMin + span;
  }

  function draw() {
    const W = widthOf();
    const plotW = W - M.l - M.r;
    const plotH = H - M.t - M.b;
    const xPix = (t: number) => M.l + ((t - xMin) / (xMax - xMin)) * plotW;
    const yPix = (y: number) => M.t + (1 - (y - yMin) / (yMax - yMin)) * plotH;

    // Horizontal gridlines + y labels at fixed steps (fixed pixels → never move).
    const ySteps = 6;
    let yGrid = "";
    let yLabels = "";
    for (let i = 0; i <= ySteps; i++) {
      const v = yMin + ((yMax - yMin) * i) / ySteps;
      const py = yPix(v);
      yGrid += `<line x1="${M.l}" y1="${py}" x2="${W - M.r}" y2="${py}" stroke="#d4d9e2" stroke-width="1"/>`;
      yLabels += `<text x="${M.l - 6}" y="${py + 4}" text-anchor="end" font-size="11" fill="#6b7280">${Math.round(v)}</text>`;
    }

    // Vertical calendar gridlines + x labels for the CURRENT view (clipped to plot).
    let xGrid = "";
    let xLabels = "";
    for (const t of calendarGridlines(xMin, xMax)) {
      const px = xPix(t);
      if (px < M.l - 0.5 || px > W - M.r + 0.5) continue;
      xGrid += `<line x1="${px}" y1="${M.t}" x2="${px}" y2="${H - M.b}" stroke="#d4d9e2" stroke-width="1"/>`;
      xLabels += `<text x="${px}" y="${H - M.b + 16}" text-anchor="middle" font-size="11" fill="#6b7280">${fmtDate(t)}</text>`;
    }

    // Series polylines (clipped to the plot rect so they can't spill onto the axes).
    let lines = "";
    let legend = "";
    series.forEach((s) => {
      const pinView = s.pts.filter((p) => p.t >= xMin - WEEK && p.t <= xMax + WEEK);
      const d = pinView.map((p) => `${xPix(p.t).toFixed(1)},${yPix(p.y).toFixed(1)}`).join(" ");
      lines += `<polyline points="${d}" fill="none" stroke="${s.color}" stroke-width="2" />`;
      for (const p of pinView) lines += `<circle cx="${xPix(p.t).toFixed(1)}" cy="${yPix(p.y).toFixed(1)}" r="2.5" fill="${s.color}" />`;
      legend += `<span class="gd-key"><span class="gd-dot" style="background:${s.color}"></span>${escapeAttr(s.name)}</span>`;
    });

    container.innerHTML =
      `<div class="gd-legend">${legend}</div>` +
      `<svg class="gd-svg" width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="demo chart">` +
      `<defs><clipPath id="gd-clip"><rect x="${M.l}" y="${M.t}" width="${plotW}" height="${plotH}"/></clipPath></defs>` +
      yGrid +
      `<g clip-path="url(#gd-clip)">${xGrid}${lines}</g>` +
      // Axis frame (fixed)
      `<line x1="${M.l}" y1="${M.t}" x2="${M.l}" y2="${H - M.b}" stroke="#9aa3b2" stroke-width="1"/>` +
      `<line x1="${M.l}" y1="${H - M.b}" x2="${W - M.r}" y2="${H - M.b}" stroke="#9aa3b2" stroke-width="1"/>` +
      yLabels +
      xLabels +
      `</svg>`;
  }

  // ---- interactions (attached once to the persistent container) ----
  let drag: { x: number; xMin: number; xMax: number } | null = null;
  const tFromClientX = (clientX: number) => {
    const svg = container.querySelector("svg");
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const W = widthOf();
    const plotW = W - M.l - M.r;
    const px = ((clientX - rect.left) / rect.width) * W;
    return xMin + ((px - M.l) / plotW) * (xMax - xMin);
  };

  if (container.dataset.gdWired !== "1") {
    container.dataset.gdWired = "1";

    // Drag to pan. Listeners live on `window` for the duration of a drag, so they
    // keep firing even though draw() replaces the SVG on every frame.
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const W = widthOf();
      const plotW = W - M.l - M.r;
      const dt = ((e.clientX - drag.x) / plotW) * (drag.xMax - drag.xMin);
      xMin = drag.xMin - dt;
      xMax = drag.xMax - dt;
      clampView();
      draw();
    };
    const onUp = () => {
      drag = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    container.addEventListener("pointerdown", (e) => {
      drag = { x: e.clientX, xMin, xMax };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      e.preventDefault();
    });

    // Wheel / trackpad / pinch to zoom around the cursor.
    container.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const focus = tFromClientX(e.clientX) ?? (xMin + xMax) / 2;
        const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
        const span = Math.min(Math.max((xMax - xMin) * factor, minSpan), fullSpan);
        const leftFrac = (focus - xMin) / (xMax - xMin);
        xMin = focus - leftFrac * span;
        xMax = xMin + span;
        clampView();
        draw();
      },
      { passive: false },
    );
    window.addEventListener("resize", () => { if (container.isConnected) draw(); });
  }

  draw();
}
