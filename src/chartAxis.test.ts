import { describe, it, expect } from "vitest";
import { buildCompactor, calendarGridlines, MS_DAY, niceTicks, timeBands, timeLevel } from "./chartAxis";

const utc = (y: number, m: number, d: number) => Date.UTC(y, m, d);
const isMonday = (t: number) => new Date(t).getUTCDay() === 1;

describe("calendarGridlines", () => {
  it("returns nothing for empty or invalid ranges", () => {
    expect(calendarGridlines(NaN, 1)).toEqual([]);
    expect(calendarGridlines(Infinity, -Infinity)).toEqual([]);
    expect(calendarGridlines(100, 100)).toEqual([]); // zero-width
    expect(calendarGridlines(200, 100)).toEqual([]); // inverted
  });

  it("uses Mondays for a short (≤16 week) range", () => {
    const min = utc(2026, 0, 1); // Thu 2026-01-01
    const max = utc(2026, 1, 1); // ~4.4 weeks later
    const lines = calendarGridlines(min, max);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.every(isMonday)).toBe(true);
    expect(lines.every((t) => t >= min && t <= max)).toBe(true);
    // strictly increasing, 7 days apart
    for (let i = 1; i < lines.length; i++) expect(lines[i]! - lines[i - 1]!).toBe(7 * MS_DAY);
  });

  it("uses month firsts for a multi-month (≤3 year) range", () => {
    const min = utc(2025, 0, 10); // mid-Jan 2025
    const max = utc(2025, 11, 20); // mid-Dec 2025
    const lines = calendarGridlines(min, max);
    // Feb..Dec firsts (Jan 1 is before min) = 11 lines
    expect(lines.length).toBe(11);
    expect(lines.every((t) => new Date(t).getUTCDate() === 1)).toBe(true);
    expect(lines.every((t) => t >= min && t <= max)).toBe(true);
    expect(lines[0]).toBe(utc(2025, 1, 1)); // Feb 1
  });

  it("uses year starts for a long (>3 year) range", () => {
    const min = utc(2019, 5, 1);
    const max = utc(2026, 5, 1);
    const lines = calendarGridlines(min, max);
    expect(lines.every((t) => {
      const dt = new Date(t);
      return dt.getUTCMonth() === 0 && dt.getUTCDate() === 1;
    })).toBe(true);
    expect(lines).toContain(utc(2020, 0, 1));
    expect(lines).toContain(utc(2026, 0, 1));
    expect(lines).not.toContain(utc(2019, 0, 1)); // before min
  });

  it("is stable: a sub-window's lines are a subset of the wider window's", () => {
    const wide = calendarGridlines(utc(2025, 0, 1), utc(2025, 11, 31));
    const inner = calendarGridlines(utc(2025, 3, 1), utc(2025, 7, 31));
    // Every monthly boundary inside the inner window also appears in the wide one.
    for (const t of inner) expect(wide).toContain(t);
  });
});

describe("timeLevel", () => {
  it("picks the granularity by span", () => {
    expect(timeLevel(3 * MS_DAY)).toBe("day");
    expect(timeLevel(40 * MS_DAY)).toBe("week");
    expect(timeLevel(400 * MS_DAY)).toBe("month");
    expect(timeLevel(5 * 365 * MS_DAY)).toBe("year");
  });
});

describe("timeBands", () => {
  it("returns nothing for empty or invalid ranges", () => {
    expect(timeBands(NaN, 1)).toEqual([]);
    expect(timeBands(200, 100)).toEqual([]);
  });

  it("always covers the visible range (so zoomed-in labels never vanish)", () => {
    // A 3-day window — used to leave no Monday in view and thus no labels.
    const min = utc(2026, 0, 6); // Tue
    const max = utc(2026, 0, 9); // Fri
    const bands = timeBands(min, max);
    expect(bands.length).toBeGreaterThanOrEqual(3);
    expect(bands[0]!.start).toBeLessThanOrEqual(min);
    expect(bands[bands.length - 1]!.end).toBeGreaterThanOrEqual(max);
    expect(bands.every((b) => b.label.length > 0)).toBe(true);
  });

  it("labels each year distinctly for a multi-year span (no duplicate 'Jan 1')", () => {
    const bands = timeBands(utc(2022, 0, 1), utc(2026, 0, 1));
    expect(bands.map((b) => b.label)).toContain("2022");
    expect(bands.map((b) => b.label)).toContain("2025");
    expect(new Set(bands.map((b) => b.label)).size).toBe(bands.length); // all unique
  });

  it("contiguous bands with stable alternating shade", () => {
    const bands = timeBands(utc(2025, 0, 10), utc(2025, 5, 20)); // monthly
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]!.start).toBe(bands[i - 1]!.end); // no gaps/overlaps
      expect(bands[i]!.shade).toBe(!bands[i - 1]!.shade); // alternates
    }
  });
});

describe("niceTicks", () => {
  it("returns nothing for a non-positive or non-finite span", () => {
    expect(niceTicks(5, 5)).toEqual([]);
    expect(niceTicks(10, 0)).toEqual([]);
    expect(niceTicks(0, Infinity)).toEqual([]);
  });
  it("makes round steps and stays within range", () => {
    const t = niceTicks(0, 120, 6);
    expect(t[0]).toBe(0);
    expect(t).toContain(100);
    expect(t.every((v) => v >= 0 && v <= 120)).toBe(true);
    // Even spacing on a 1/2/5×10ⁿ step.
    const step = t[1]! - t[0]!;
    for (let i = 1; i < t.length; i++) expect(Math.abs(t[i]! - t[i - 1]! - step)).toBeLessThan(1e-6);
    expect([1, 2, 5, 10, 20, 25, 50].includes(step)).toBe(true);
  });
  it("handles small ranges with fractional steps", () => {
    const t = niceTicks(0, 3, 6);
    expect(t.length).toBeGreaterThanOrEqual(3);
    expect(t[0]).toBe(0);
    expect(Math.max(...t)).toBeLessThanOrEqual(3);
  });
});

describe("buildCompactor", () => {
  it("is the identity with fewer than two distinct points", () => {
    const c = buildCompactor([5]);
    expect(c.to(5)).toBe(5);
    expect(c.from(5)).toBe(5);
    expect(buildCompactor([]).to(42)).toBe(42);
    expect(buildCompactor([7, 7, 7]).to(7)).toBe(7);
  });
  it("keeps order and round-trips at the data points", () => {
    const days = [0, 1, 2, 30, 31].map((d) => d * MS_DAY); // a cluster, a long gap, a cluster
    const c = buildCompactor(days);
    const mapped = days.map((d) => c.to(d));
    // strictly increasing → order preserved
    for (let i = 1; i < mapped.length; i++) expect(mapped[i]!).toBeGreaterThan(mapped[i - 1]!);
    // to/from invert at every data point
    for (const d of days) expect(c.from(c.to(d))).toBeCloseTo(d, 3);
  });
  it("squeezes the long gap down to the median gap", () => {
    const days = [0, 1, 2, 30, 31].map((d) => d * MS_DAY);
    const c = buildCompactor(days);
    const gapBig = c.to(30 * MS_DAY) - c.to(2 * MS_DAY); // the 28-day layoff
    const gapSmall = c.to(1 * MS_DAY) - c.to(0); // a normal 1-day step
    // The median gap here is 1 day, so the big gap collapses to ~1 day, not 28.
    expect(gapBig).toBeCloseTo(gapSmall, 6);
    // The real span is still much larger than the compacted span.
    expect(c.to(31 * MS_DAY) - c.to(0)).toBeLessThan((31 * MS_DAY) / 5);
  });
  it("is monotonic for arbitrary query points between sessions", () => {
    const days = [0, 5, 6, 7, 40].map((d) => d * MS_DAY);
    const c = buildCompactor(days);
    let prev = -Infinity;
    for (let d = -2; d <= 42; d++) {
      const v = c.to(d * MS_DAY);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});
