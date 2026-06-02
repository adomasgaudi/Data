/**
 * Stand-alone graph — ADVANCED variant. Same from-scratch SVG engine as the safe
 * demo (free 2-D pan, both-axis zoom, fixed axis frame, NO Chart.js), but wider:
 * the x and y value labels are drawn INSIDE the plot (with a white halo for
 * legibility) instead of in outer margins, so the plotting area fills the width.
 *
 * Kept separate from graphDemo.ts on purpose — the demo is the safe fallback; if
 * this advanced one misbehaves we still have that.
 */
import { calendarGridlines } from "./chartAxis";

interface Pt {
  t: number;
  y: number;
}
interface Series {
  name: string;
  color: string;
  pts: Pt[];
}

const WEEK = 7 * 86_400_000;

function demoSeries(): Series[] {
  const today = Date.now();
  const n = 26;
  const make = (base: number, slope: number, noise: number, seed: number): Pt[] => {
    let s = seed;
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
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

/** Inside-label text with a white halo so it stays readable over gridlines/data. */
const haloText = (x: string, y: string, anchor: string, text: string) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="11" fill="#4b5563" ` +
  `stroke="#ffffff" stroke-width="3" paint-order="stroke" style="paint-order:stroke">${text}</text>`;

/** Mount (or re-mount) the advanced chart into `container`. Idempotent. */
export function mountGraphAdvanced(container: HTMLElement): void {
  const series = demoSeries();
  const allT = series.flatMap((s) => s.pts.map((p) => p.t));
  const allY = series.flatMap((s) => s.pts.map((p) => p.y));
  const dataMinT = Math.min(...allT);
  const dataMaxT = Math.max(...allT);
  const dataMaxY = Math.max(...allY);

  let xMin = dataMinT;
  let xMax = dataMaxT;
  let yMin = 0;
  let yMax = Math.ceil((dataMaxY * 1.15) / 10) * 10;

  // Wider than the demo: labels live INSIDE, so margins are tiny.
  const H = 360;
  const M = { l: 6, r: 6, t: 8, b: 6 };
  const widthOf = () => Math.max(280, Math.round(container.clientWidth || 340));

  function draw() {
    const W = widthOf();
    const plotW = W - M.l - M.r;
    const plotH = H - M.t - M.b;
    const xPix = (t: number) => M.l + ((t - xMin) / (xMax - xMin)) * plotW;
    const yPix = (y: number) => M.t + (1 - (y - yMin) / (yMax - yMin)) * plotH;

    let yGrid = "";
    let yLabels = "";
    for (const v of niceTicks(yMin, yMax, 6)) {
      const py = yPix(v);
      if (py < M.t - 0.5 || py > H - M.b + 0.5) continue;
      yGrid += `<line x1="${M.l}" y1="${py.toFixed(1)}" x2="${W - M.r}" y2="${py.toFixed(1)}" stroke="#d4d9e2" stroke-width="1"/>`;
      // y value just inside the left edge, sitting above its gridline.
      yLabels += haloText((M.l + 4).toString(), (py - 3).toFixed(1), "start", String(Math.round(v)));
    }

    let xGrid = "";
    let xLabels = "";
    for (const t of calendarGridlines(xMin, xMax)) {
      const px = xPix(t);
      if (px < M.l - 0.5 || px > W - M.r + 0.5) continue;
      xGrid += `<line x1="${px.toFixed(1)}" y1="${M.t}" x2="${px.toFixed(1)}" y2="${H - M.b}" stroke="#d4d9e2" stroke-width="1"/>`;
      // x value just inside the bottom edge.
      xLabels += haloText(px.toFixed(1), (H - M.b - 5).toFixed(1), "middle", fmtDate(t));
    }

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
      `<svg class="gd-svg" width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="advanced demo chart">` +
      `<defs><clipPath id="gda-clip"><rect x="${M.l}" y="${M.t}" width="${plotW}" height="${plotH}"/></clipPath></defs>` +
      `<g clip-path="url(#gda-clip)">${yGrid}${xGrid}${lines}${xLabels}${yLabels}</g>` +
      `<rect x="${M.l}" y="${M.t}" width="${plotW}" height="${plotH}" fill="none" stroke="#9aa3b2" stroke-width="1"/>` +
      `</svg>`;
  }

  // ---- interactions: 1 finger pans; 2 fingers pinch with PER-AXIS stretch ----
  // The pinch is decomposed by finger orientation: the horizontal spread between
  // the fingers drives the X scale and the vertical spread drives Y. So spread
  // them sideways to stretch only X, up/down to stretch only Y, diagonally for
  // both. Wheel still zooms both; drag pans.
  function dataAt(clientX: number, clientY: number) {
    const svg = container.querySelector("svg");
    const rect = svg ? svg.getBoundingClientRect() : container.getBoundingClientRect();
    const W = widthOf();
    const plotW = W - M.l - M.r;
    const plotH = H - M.t - M.b;
    const lx = ((clientX - rect.left) / rect.width) * W;
    const ly = ((clientY - rect.top) / rect.height) * H;
    return { x: xMin + ((lx - M.l) / plotW) * (xMax - xMin), y: yMin + (1 - (ly - M.t) / plotH) * (yMax - yMin) };
  }

  const pts = new Map<number, { x: number; y: number }>();
  let pan: { x: number; y: number; xMin: number; xMax: number; yMin: number; yMax: number } | null = null;
  let pinch: { hx: number; vy: number; mx: number; my: number } | null = null;
  const SPREAD = 26; // min finger spread (px) on an axis before that axis stretches

  if (container.dataset.gdaWired !== "1") {
    container.dataset.gdaWired = "1";

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
        const W = widthOf();
        const plotW = W - M.l - M.r;
        const plotH = H - M.t - M.b;
        // pan by the midpoint movement
        const ddx = ((mx - pinch.mx) / plotW) * (xMax - xMin);
        const ddy = ((my - pinch.my) / plotH) * (yMax - yMin);
        xMin -= ddx; xMax -= ddx; yMin += ddy; yMax += ddy;
        // per-axis scale about the midpoint, gated by the spread on that axis
        const f = dataAt(mx, my);
        const kx = pinch.hx > SPREAD && hx > 4 ? pinch.hx / hx : 1;
        const ky = pinch.vy > SPREAD && vy > 4 ? pinch.vy / vy : 1;
        xMin = f.x - (f.x - xMin) * kx; xMax = f.x + (xMax - f.x) * kx;
        yMin = f.y - (f.y - yMin) * ky; yMax = f.y + (yMax - f.y) * ky;
        pinch = { hx, vy, mx, my };
        draw();
      } else if (pan) {
        const W = widthOf();
        const plotW = W - M.l - M.r;
        const plotH = H - M.t - M.b;
        const dx = ((e.clientX - pan.x) / plotW) * (pan.xMax - pan.xMin);
        const dy = ((e.clientY - pan.y) / plotH) * (pan.yMax - pan.yMin);
        xMin = pan.xMin - dx; xMax = pan.xMax - dx; yMin = pan.yMin + dy; yMax = pan.yMax + dy;
        draw();
      }
    };
    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 1) {
        const p = [...pts.values()][0]!;
        pan = { x: p.x, y: p.y, xMin, xMax, yMin, yMax };
      } else if (pts.size === 0) {
        pan = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      }
    };
    container.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest(".gd-reset")) return;
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
        pan = { x: e.clientX, y: e.clientY, xMin, xMax, yMin, yMax };
      }
      e.preventDefault();
    });

    container.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const f = dataAt(e.clientX, e.clientY);
        // Shift-wheel = X only, Alt-wheel = Y only, plain = both (desktop testing).
        const k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
        const kx = e.altKey ? 1 : k;
        const ky = e.shiftKey ? 1 : k;
        xMin = f.x - (f.x - xMin) * kx; xMax = f.x + (xMax - f.x) * kx;
        yMin = f.y - (f.y - yMin) * ky; yMax = f.y + (yMax - f.y) * ky;
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
