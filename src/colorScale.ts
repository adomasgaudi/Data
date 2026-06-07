/**
 * Pure colour + heat-intensity maths, extracted from main.ts so the
 * hash→hue→hex chain and the heatmap cell shading can be unit-tested without the
 * DOM. No app state; every input comes through arguments.
 */

/** HSL (h 0–360, s/l 0–100) → "#rrggbb". */
export function hslToHex(h: number, s: number, l: number): string {
  const sa = s / 100, la = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sa * Math.min(la, 1 - la);
  const f = (n: number) => Math.round(255 * (la - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  const to2 = (v: number) => v.toString(16).padStart(2, "0");
  return `#${to2(f(0))}${to2(f(8))}${to2(f(4))}`;
}

/** A stable hue-derived "#rrggbb" for any string, so every distinct group value
 * gets its own consistent colour. */
export function hashHueHex(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return hslToHex(((h % 360) + 360) % 360, 60, 45);
}

/** Background colour for a heatmap cell given intensity level and optional category hex. */
export function cellBgColor(level: number, catHex: string | null): string {
  if (level === 0) return "";
  if (level === 5) return "#f5c800"; // shining — always gold
  const hex = catHex ?? "#1e4fa3"; // default blue
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (level === 4) return `rgb(${Math.round(r * 0.55)},${Math.round(g * 0.55)},${Math.round(b * 0.55)})`;
  const t = level === 1 ? 0.28 : level === 2 ? 0.58 : 1.0;
  return `rgb(${Math.round(255 + (r - 255) * t)},${Math.round(255 + (g - 255) * t)},${Math.round(255 + (b - 255) * t)})`;
}

/** Intensity bucket for a day's set count: 0 rest, then 1/2/3/4/5 bands. */
export function heatLevel(sets: number): number {
  if (sets <= 0) return 0;
  if (sets < 2)  return 1; // 1 set — light
  if (sets < 4)  return 2; // 2–3 — darker
  if (sets < 10) return 3; // 4–9 — dark + outline
  if (sets < 20) return 4; // 10–19 — darkest
  return 5;                // 20+ — shining gold
}

/** A heatmap cell painted by SEVERAL categories: each segment's blended colour
 * (at the day's intensity `level`) across its fraction of the square, as a
 * hard-stop horizontal gradient — e.g. legs + shoulders → half blue, half gold.
 * One segment (or none) falls back to the solid {@link cellBgColor}; level 5 is
 * the special "shining gold" (never split). Fractions need not be exactly 1; they
 * are laid out cumulatively in order. */
export function cellBgGradient(level: number, segments: { hex: string; frac: number }[]): string {
  if (level === 0) return "";
  if (level === 5 || segments.length <= 1) return cellBgColor(level, segments[0]?.hex ?? null);
  const total = segments.reduce((n, s) => n + (s.frac > 0 ? s.frac : 0), 0) || 1;
  let acc = 0;
  const stops: string[] = [];
  for (const s of segments) {
    const c = cellBgColor(level, s.hex);
    const from = Math.round((acc / total) * 100);
    acc += Math.max(0, s.frac);
    const to = Math.round((acc / total) * 100);
    stops.push(`${c} ${from}% ${to}%`);
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
