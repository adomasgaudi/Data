import { describe, it, expect } from "vitest";
import {
  fmt, pct, bwMult, wr, shortDate, dowLetter, isoWeekNumber, todayIso, trainingDuration,
  relativeDayLabel, dayHeaderParts,
} from "./format";

describe("fmt", () => {
  it("returns '0' for zero and non-finite", () => {
    expect(fmt(0)).toBe("0");
    expect(fmt(NaN)).toBe("0");
    expect(fmt(Infinity)).toBe("0");
  });
  it("uses 3 sig figs when the leading digit is 1–3, else 2", () => {
    expect(fmt(12.34)).toBe("12.3"); // lead 1 → 3sf
    expect(fmt(123.4)).toBe("123");  // lead 1 → 3sf
    expect(fmt(98.7)).toBe("99");    // lead 9 → 2sf
    expect(fmt(456.7)).toBe("460");  // lead 4 → 2sf
  });
  it("keeps negatives", () => {
    expect(fmt(-5)).toBe("-5");
  });
});

describe("pct / bwMult", () => {
  it("formats fractions as whole percents", () => {
    expect(pct(0.6)).toBe("60%");
    expect(pct(0.123)).toBe("12%");
    expect(pct(1)).toBe("100%");
  });
  it("formats bodyweight multiples at 2dp", () => {
    expect(bwMult(1.2345)).toBe("1.23 BW");
    expect(bwMult(1)).toBe("1.00 BW");
  });
});

describe("wr", () => {
  it("drops the meaningless 0 base for bodyweight reps", () => {
    expect(wr(null, 5)).toBe('<sup class="wr-bw">5</sup>');
    expect(wr(0, 5)).toBe('<sup class="wr-bw">5</sup>');
  });
  it("shows an em-dash when there is neither weight nor reps", () => {
    expect(wr(null, null)).toBe("—");
  });
  it("shows weight with reps superscript when weighted", () => {
    expect(wr(100, 5)).toBe("100<sup>5</sup>");
    expect(wr(100, null)).toBe("100");
  });
});

describe("dates", () => {
  it("shortDate abbreviates month + day, falls back to input", () => {
    expect(shortDate("2026-05-02")).toBe("May 2");
    expect(shortDate("2026-12-25")).toBe("Dec 25");
    expect(shortDate("bad")).toBe("bad");
  });
  it("dowLetter gives the UTC weekday letter", () => {
    expect(dowLetter("2021-01-04")).toBe("M");  // Monday
    expect(dowLetter("2021-01-03")).toBe("Su"); // Sunday
    expect(dowLetter("bad")).toBe("");
  });
  it("relativeDayLabel: Today / this-week weekday / Last weekday / older fallback", () => {
    const today = "2026-06-04"; // Thursday; this Mon–Sun week is 2026-06-01 … 2026-06-07
    expect(relativeDayLabel(today, today)).toBe("Today");
    expect(relativeDayLabel("2026-06-01", today)).toBe("Monday");   // this week (Mon)
    expect(relativeDayLabel("2026-06-02", today)).toBe("Tuesday");  // this week
    expect(relativeDayLabel("2026-06-07", today)).toBe("Sunday");   // this week (Sun end)
    expect(relativeDayLabel("2026-05-31", today)).toBe("Last Sunday");   // last week (Sun end)
    expect(relativeDayLabel("2026-05-25", today)).toBe("Last Monday");   // last week (Mon start)
    expect(relativeDayLabel("2026-05-24", today)).toBe(`${dowLetter("2026-05-24")} May 24`); // older → compact
  });
  it("dayHeaderParts: relative phrase + month-day + year", () => {
    const today = "2026-06-04"; // Thursday
    expect(dayHeaderParts(today, today)).toEqual({ rel: "Today", md: "Jun 4", year: "2026" });
    expect(dayHeaderParts("2026-06-01", today)).toEqual({ rel: "Monday", md: "Jun 1", year: "2026" }); // this week
    expect(dayHeaderParts("2026-05-28", today)).toEqual({ rel: "Last Thursday", md: "May 28", year: "2026" }); // last week
    expect(dayHeaderParts("2026-05-12", today)).toEqual({ rel: "Tuesday", md: "May 12", year: "2026" }); // older → plain weekday
  });
  it("isoWeekNumber matches Monday-start ISO weeks", () => {
    expect(isoWeekNumber("2021-01-04")).toBe(1); // first Monday of 2021
    expect(isoWeekNumber("2026-01-01")).toBe(1); // Jan 1 2026 is a Thursday → week 1
    expect(isoWeekNumber("bad")).toBe(0);
  });
  it("todayIso is a YYYY-MM-DD string", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("trainingDuration", () => {
  it("picks the unit that reads cleanest at each scale", () => {
    expect(trainingDuration("2026-01-01", "2026-01-01")).toBe("0 days");
    expect(trainingDuration("2026-01-01", "2026-01-02")).toBe("1 day");
    expect(trainingDuration("2026-01-01", "2026-01-05")).toBe("4 days");
    expect(trainingDuration("2026-01-01", "2026-01-31")).toBe("4 weeks"); // 30 days
    expect(trainingDuration("2026-01-01", "2026-04-11")).toBe("3 months"); // 100 days
    expect(trainingDuration("2024-01-01", "2026-03-11")).toBe("2.2 years"); // 800 days
  });
});
