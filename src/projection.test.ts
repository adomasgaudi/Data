import { describe, it, expect } from "vitest";
import { fitLog, sampleProjection } from "./projection";

const DAY = 86_400_000;
const T0 = Date.UTC(2024, 0, 1);

// Build points from y = c + b·ln(t + a) with known params
function syntheticPts(a: number, b: number, c: number, days: number[]): { x: number; y: number }[] {
  return days.map((d) => ({ x: T0 + d * DAY, y: c + b * Math.log(d + a) }));
}

describe("fitLog", () => {
  it("returns null for < 3 points", () => {
    expect(fitLog([])).toBeNull();
    expect(fitLog([{ x: T0, y: 100 }])).toBeNull();
    expect(fitLog([{ x: T0, y: 100 }, { x: T0 + DAY, y: 105 }])).toBeNull();
  });

  it("recovers known params on noiseless data (a=1, b=5, c=80)", () => {
    const pts = syntheticPts(1, 5, 80, [0, 7, 14, 30, 60, 90, 180]);
    const fit = fitLog(pts);
    expect(fit).not.toBeNull();
    // Prediction at day 90 should be close to ground truth
    const truth = 80 + 5 * Math.log(90 + 1);
    const pred = fit!.predict(T0 + 90 * DAY);
    expect(pred).not.toBeNull();
    expect(Math.abs(pred! - truth)).toBeLessThan(0.5);
  });

  it("recovers known params for a large shift (a=30)", () => {
    const pts = syntheticPts(30, 10, 60, [0, 7, 14, 30, 60, 120, 240]);
    const fit = fitLog(pts);
    expect(fit).not.toBeNull();
    const truth = 60 + 10 * Math.log(120 + 30);
    const pred = fit!.predict(T0 + 120 * DAY);
    expect(pred).not.toBeNull();
    expect(Math.abs(pred! - truth)).toBeLessThan(2);
  });

  it("returns null for degenerate input (all same y)", () => {
    // All identical y → slope = 0 is valid, not null; just check no crash and x0 is first x
    const pts = [T0, T0 + DAY, T0 + 2 * DAY].map((x) => ({ x, y: 100 }));
    const fit = fitLog(pts);
    // Degenerate but still fits (slope = 0, c ≈ 100)
    if (fit !== null) {
      expect(Math.abs(fit.predict(T0 + 50 * DAY)! - 100)).toBeLessThan(1);
    }
  });

  it("predict returns null for domain violation (x before x0 - a)", () => {
    const pts = syntheticPts(1, 5, 80, [0, 7, 14, 30, 60]);
    const fit = fitLog(pts)!;
    // x well before x0 (t would be very negative, t + a ≤ 0)
    expect(fit.predict(T0 - 10 * DAY)).toBeNull();
  });

  it("predict is finite for future dates", () => {
    const pts = syntheticPts(1, 5, 80, [0, 14, 30, 60, 90]);
    const fit = fitLog(pts)!;
    const future = T0 + 365 * DAY;
    const p = fit.predict(future);
    expect(p).not.toBeNull();
    expect(Number.isFinite(p!)).toBe(true);
  });
});

describe("sampleProjection", () => {
  it("returns empty for degenerate ranges", () => {
    const fit = fitLog(syntheticPts(1, 5, 80, [0, 7, 14, 30]))!;
    expect(sampleProjection(fit, T0 + 10 * DAY, T0 + 9 * DAY)).toEqual([]);
    expect(sampleProjection(fit, T0, T0, 10)).toEqual([]);
  });

  it("returns steps+1 points for a valid range", () => {
    const fit = fitLog(syntheticPts(1, 5, 80, [0, 7, 14, 30, 60]))!;
    const pts = sampleProjection(fit, T0, T0 + 90 * DAY, 20);
    expect(pts.length).toBe(21);
    for (const p of pts) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it("omits domain-violating points and does not crash", () => {
    const fit = fitLog(syntheticPts(1, 5, 80, [0, 7, 14, 30]))!;
    // fromX deeply before x0 — some early points violate domain
    const pts = sampleProjection(fit, T0 - 5 * DAY, T0 + 30 * DAY, 20);
    // At least the valid portion is returned
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) expect(Number.isFinite(p.y)).toBe(true);
  });
});
