import { describe, it, expect } from "vitest";
import { calendarGridlines, MS_DAY } from "./chartAxis";

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
