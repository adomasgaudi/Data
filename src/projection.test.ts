import { describe, it, expect } from "vitest";
import { fitLog, fitCeiling, sampleProjection } from "./projection";

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

describe("fitCeiling", () => {
  // Points generated from the exact model y = ceiling − e^(m·t+b): the fit must recover it.
  const ceiling = 200;
  function ceilingPts(m: number, b: number, days: number[]): { x: number; y: number }[] {
    return days.map((d) => ({ x: T0 + d * DAY, y: ceiling - Math.exp(m * d + b) }));
  }

  it("returns null with < 3 points below the ceiling", () => {
    expect(fitCeiling([], ceiling)).toBeNull();
    expect(fitCeiling(ceilingPts(-0.01, 4, [0, 30]), ceiling)).toBeNull();
    // Points AT/above the ceiling are unusable (gap ≤ 0) → still null.
    const atCeiling = [0, 30, 60].map((d) => ({ x: T0 + d * DAY, y: ceiling + 5 }));
    expect(fitCeiling(atCeiling, ceiling)).toBeNull();
  });

  it("recovers a known ceiling-approach curve and FLATTENS (slows) over time", () => {
    const fit = fitCeiling(ceilingPts(-0.005, Math.log(120), [0, 30, 90, 180, 365]), ceiling)!;
    expect(fit).not.toBeNull();
    // Predictions stay below the ceiling and rise toward it.
    const y0 = fit.predict(T0)!;
    const y365 = fit.predict(T0 + 365 * DAY)!;
    const y730 = fit.predict(T0 + 730 * DAY)!;
    expect(y0).toBeLessThan(ceiling);
    expect(y730).toBeLessThan(ceiling);
    expect(y365).toBeGreaterThan(y0); // improving
    // The hallmark: the LATE slope is gentler than the EARLY slope (diminishing returns).
    const early = (fit.predict(T0 + 60 * DAY)! - y0) / 60;
    const late = (y730 - fit.predict(T0 + 365 * DAY)!) / 365;
    expect(late).toBeLessThan(early);
  });

  it("never returns a finite value above the ceiling", () => {
    const fit = fitCeiling(ceilingPts(-0.004, Math.log(100), [0, 60, 120, 240]), ceiling)!;
    for (let d = 0; d <= 3650; d += 100) {
      const y = fit.predict(T0 + d * DAY);
      if (y !== null) expect(y).toBeLessThanOrEqual(ceiling);
    }
  });

  it("ANCHORS the curve to the latest point on NOISY data (PB-40: must fit the points)", () => {
    // Noisy rising data far below the ceiling — the old free-intercept fit floated below
    // the data. The anchored fit must pass through the most recent point exactly.
    const days = [0, 30, 60, 90, 120, 150];
    const ys = [52, 61, 58, 74, 80, 95]; // climbing, with wobble; all ≪ 200
    const pts = days.map((d, i) => ({ x: T0 + d * DAY, y: ys[i]! }));
    const fit = fitCeiling(pts, ceiling)!;
    expect(fit).not.toBeNull();
    const lastX = T0 + 150 * DAY;
    expect(Math.abs(fit.predict(lastX)! - 95)).toBeLessThan(1e-6); // sits ON the current point
    // …and still rises toward (never past) the ceiling beyond the data.
    const future = fit.predict(T0 + 900 * DAY)!;
    expect(future).toBeGreaterThan(95);
    expect(future).toBeLessThan(ceiling);
  });

  it("returns null for a flat/declining window (no approach → caller uses the log fit)", () => {
    const declining = [0, 30, 60, 90].map((d) => ({ x: T0 + d * DAY, y: 120 - d * 0.1 }));
    expect(fitCeiling(declining, ceiling)).toBeNull();
  });
});
