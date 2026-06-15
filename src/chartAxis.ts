/**
 * Time-axis gridline maths, kept pure (no DOM / Chart.js) so it can be unit
 * tested. The charts use a numeric (linear, milliseconds) x-axis rather than a
 * date scale — no date-adapter dependency — and draw their own calendar-anchored
 * vertical gridlines from these timestamps.
 */

export const MS_DAY = 86_400_000;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Time granularity for the calendar bands, picked by how wide the view is. */
export type TimeLevel = "day" | "week" | "month" | "year";

export function timeLevel(span: number): TimeLevel {
  if (!(span > 0)) return "day";
  if (span <= 12 * MS_DAY) return "day";
  if (span <= 26 * 7 * MS_DAY) return "week"; // ~half a year
  if (span <= 3 * 365 * MS_DAY) return "month";
  return "year";
}

export interface TimeBand {
  start: number; // band start (UTC ms), may be before `min`
  end: number; // band end (UTC ms, exclusive), may be after `max`
  label: string; // unambiguous label centred in the band
  shade: boolean; // alternate fill, stable across panning (by absolute period #)
}

/**
 * Calendar bands spanning [min, max] at an auto-picked granularity (day / week /
 * month / year). Each band carries its own label and an alternating `shade` flag
 * (parity of the absolute period number, so the stripes never flip while you pan).
 * Bands always cover the visible range — so labels never vanish when you zoom in —
 * and the labels include the year where it would otherwise be ambiguous, so you
 * never get three identical "Jan 1"s. Everything is UTC to match the ISO dates.
 */
export function timeBands(min: number, max: number, force?: TimeLevel): TimeBand[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const level = force ?? timeLevel(max - min);
  const out: TimeBand[] = [];
  const d = new Date(min);

  if (level === "day") {
    let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    while (t < max) {
      const nd = new Date(t);
      const end = Date.UTC(nd.getUTCFullYear(), nd.getUTCMonth(), nd.getUTCDate() + 1);
      out.push({ start: t, end, label: `${MON[nd.getUTCMonth()]} ${nd.getUTCDate()}`, shade: Math.floor(t / MS_DAY) % 2 === 0 });
      t = end;
    }
  } else if (level === "week") {
    const day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const dow = new Date(day0).getUTCDay(); // 0=Sun..6=Sat → step back to Monday
    let t = day0 - ((dow === 0 ? 7 : dow) - 1) * MS_DAY;
    while (t < max) {
      const nd = new Date(t);
      const end = t + 7 * MS_DAY;
      out.push({ start: t, end, label: `${MON[nd.getUTCMonth()]} ${nd.getUTCDate()}`, shade: Math.round(t / (7 * MS_DAY)) % 2 === 0 });
      t = end;
    }
  } else if (level === "month") {
    let y = d.getUTCFullYear();
    let m = d.getUTCMonth();
    let t = Date.UTC(y, m, 1);
    while (t < max) {
      const end = Date.UTC(y, m + 1, 1);
      out.push({ start: t, end, label: m === 0 ? `${MON[m]} ${y}` : MON[m]!, shade: (y * 12 + m) % 2 === 0 });
      m++;
      if (m > 11) { m = 0; y++; }
      t = end;
    }
  } else {
    let y = d.getUTCFullYear();
    let t = Date.UTC(y, 0, 1);
    while (t < max) {
      const end = Date.UTC(y + 1, 0, 1);
      out.push({ start: t, end, label: String(y), shade: y % 2 === 0 });
      y++;
      t = end;
    }
  }
  return out;
}

/**
 * "Compacted time" axis: a monotonic remapping of real timestamps that drops the
 * empty days entirely — every distinct training DAY becomes one evenly-spaced slot
 * (like the workout list with rest days hidden, but as a graph). A month-long
 * layoff collapses to a single step, so consecutive sessions sit side by side and
 * the whole history fits on screen. Built from the data's own timestamps; with the
 * legend filtered to one exercise it's that exercise's days that get compacted, so
 * the days you didn't train it vanish.
 *
 * `to` maps a real timestamp → compacted coordinate (feed the chart these);
 * `from` inverts it (compacted coordinate → real timestamp) so axis ticks and
 * tooltips still print real calendar dates. Both are piecewise-linear and
 * extrapolate at real (slope-1) rate outside the data range. With < 2 distinct
 * days there's nothing to compact, so both are the identity.
 */
export interface TimeCompactor {
  to(t: number): number;
  from(c: number): number;
}
export function buildCompactor(times: Iterable<number>): TimeCompactor {
  // Bucket to whole days (FLOOR, so a chart's intra-day fan offsets — which span the
  // WHOLE day, [0,1) — all stay on their own day), then space the distinct days
  // uniformly — one MS_DAY slot each.
  const days = [
    ...new Set([...times].filter((t) => Number.isFinite(t)).map((t) => Math.floor(t / MS_DAY))),
  ].sort((a, b) => a - b);
  if (days.length < 2) return { to: (t) => t, from: (c) => c };
  const real = days.map((d) => d * MS_DAY); // real start-of-day timestamps
  const comp = days.map((_, i) => i * MS_DAY); // uniform: every training day is one slot
  const slotOf = new Map<number, number>();
  days.forEach((d, i) => slotOf.set(d, i));
  // Piecewise-linear interpolation between two parallel monotonic arrays.
  const interp = (xs: number[], ys: number[], v: number): number => {
    if (v <= xs[0]!) return ys[0]! + (v - xs[0]!); // slope-1 extrapolation
    const last = xs.length - 1;
    if (v >= xs[last]!) return ys[last]! + (v - xs[last]!);
    let lo = 0, hi = last;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid]! <= v) lo = mid; else hi = mid; }
    const span = xs[hi]! - xs[lo]!;
    const f = span > 0 ? (v - xs[lo]!) / span : 0;
    return ys[lo]! + f * (ys[hi]! - ys[lo]!);
  };
  // A timestamp on a training DAY keeps its intra-day offset at FULL slot width:
  // comp = slot-start + (t − day-start). That's the fix for same-day sets vanishing
  // in compacted view — their fan used to be scaled DOWN by the (collapsed) gap to
  // the next session, so a long layoff squeezed a whole session onto one pixel. Now
  // a day's own 0–24h spread always occupies its full one-day-wide slot, regardless
  // of the gaps around it. Off-day query points (between sessions) fall back to the
  // piecewise-linear day-start interpolation, which agrees at every day boundary so
  // the whole mapping stays monotonic.
  const to = (t: number): number => {
    const d = Math.floor(t / MS_DAY);
    const slot = slotOf.get(d);
    return slot !== undefined ? slot * MS_DAY + (t - d * MS_DAY) : interp(real, comp, t);
  };
  const from = (cc: number): number => {
    const slot = Math.floor(cc / MS_DAY);
    return slot >= 0 && slot < days.length ? days[slot]! * MS_DAY + (cc - slot * MS_DAY) : interp(comp, real, cc);
  };
  return { to, from };
}

/**
 * "Nice" round tick values across [min, max] — roughly `target` of them, on a
 * 1/2/5×10ⁿ step. Pure, for the y-axis of the SVG charts. Returns at least the
 * bounds-snapped values; empty only for a non-positive span.
 */
export function niceTicks(min: number, max: number, target = 6): number[] {
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return [];
  const raw = span / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) {
    out.push(Math.round(v * 1e6) / 1e6);
  }
  return out;
}

/**
 * Calendar-anchored vertical-gridline timestamps spanning [min, max], with the
 * granularity chosen by how wide the range is so the line count stays sensible:
 *   • ≤ ~16 weeks  → Mondays
 *   • ≤ ~3 years   → the 1st of each month
 *   • otherwise    → Jan 1 of each year
 *
 * Everything is in UTC to match the ISO date keys. Because the lines sit on real
 * calendar boundaries (not arbitrary axis positions), recomputing them from the
 * live visible range every frame is stable — they never jitter while panning,
 * they just slide with the data and get denser/sparser as you zoom.
 */
export function calendarGridlines(min: number, max: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const span = max - min;
  const out: number[] = [];
  const d = new Date(min);

  if (span <= 16 * 7 * MS_DAY) {
    // Weekly: the first Monday at or after `min`, then every 7 days.
    const day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const dow = new Date(day0).getUTCDay(); // 0=Sun..6=Sat
    const toMonday = (8 - (dow === 0 ? 7 : dow)) % 7;
    for (let t = day0 + toMonday * MS_DAY; t <= max; t += 7 * MS_DAY) out.push(t);
  } else if (span <= 3 * 365 * MS_DAY) {
    // Monthly: the 1st at or after `min`, then each following month's 1st.
    let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    if (t < min) t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    while (t <= max) {
      out.push(t);
      const n = new Date(t);
      t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1);
    }
  } else {
    // Yearly: Jan 1 at or after `min`, then each following Jan 1.
    let y = d.getUTCFullYear();
    if (Date.UTC(y, 0, 1) < min) y++;
    for (let t = Date.UTC(y, 0, 1); t <= max; y++, t = Date.UTC(y, 0, 1)) out.push(t);
  }
  return out;
}
