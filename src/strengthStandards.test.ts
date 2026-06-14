import { describe, it, expect } from "vitest";
import {
  curveFor, percentileFor, hasStandards, PERCENTILES, POPULATIONS,
  STANDARDS_ESTIMATED, type Population,
} from "./strengthStandards";

describe("strengthStandards", () => {
  it("knows common lifts and not unknown ones", () => {
    expect(hasStandards("Bench Press")).toBe(true);
    expect(hasStandards("Barbell Squat")).toBe(true);
    expect(hasStandards("Romanian Deadlift")).toBe(true);
    expect(hasStandards("Glute Bridge Thing 9000")).toBe(false);
    expect(curveFor("Nonsense lift", "m", "strengthlevel")).toBeNull();
    expect(percentileFor("Nonsense lift", "m", 1.5, "pro")).toBeNull();
  });

  it("most-specific keyword wins (front squat ≠ squat, leg press ≠ press)", () => {
    // front squat curve is lower than back squat at the same percentile
    const back = curveFor("Back Squat", "m", "strengthlevel")!;
    const front = curveFor("Front Squat", "m", "strengthlevel")!;
    expect(front[2]).toBeLessThan(back[2]!);
  });

  it("curves are monotonically increasing across percentiles", () => {
    for (const lift of ["Bench Press", "Squat", "Deadlift", "Overhead Press"]) {
      for (const pop of POPULATIONS) {
        for (const sex of ["m", "f"] as const) {
          const c = curveFor(lift, sex, pop)!;
          expect(c.length).toBe(PERCENTILES.length);
          for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThan(c[i - 1]!);
        }
      }
    }
  });

  it("population ordering: general < gym < pro at every percentile", () => {
    const order: Population[] = ["general", "strengthlevel", "pro"];
    for (const lift of ["Bench Press", "Deadlift"]) {
      const curves = order.map((p) => curveFor(lift, "m", p)!);
      for (let i = 0; i < PERCENTILES.length; i++) {
        expect(curves[0]![i]).toBeLessThan(curves[1]![i]!);
        expect(curves[1]![i]).toBeLessThan(curves[2]![i]!);
      }
    }
  });

  it("percentileFor round-trips the anchors and clamps the ends", () => {
    const c = curveFor("Bench Press", "m", "strengthlevel")!;
    // The median anchor ratio should read back ~50th percentile.
    expect(percentileFor("Bench Press", "m", c[2]!, "strengthlevel")).toBe(50);
    // Way below the floor → clamped to ≥1; way above elite → ≤99.
    expect(percentileFor("Bench Press", "m", 0.01, "strengthlevel")).toBeGreaterThanOrEqual(1);
    expect(percentileFor("Bench Press", "m", 99, "strengthlevel")).toBeLessThanOrEqual(99);
  });

  it("is flagged as estimated data", () => {
    expect(STANDARDS_ESTIMATED).toBe(true);
  });
});
