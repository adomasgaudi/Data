import { describe, it, expect } from "vitest";
import {
  isUnilateralName,
  isUnilateral,
  sideValues,
  sidesDiffer,
  divergenceEmpty,
} from "./unilateral";

describe("unilateral name detection", () => {
  it("matches clear single-side names (raw and normalised)", () => {
    for (const n of [
      "1-Arm Row",
      "One Arm Pull-up",
      "single arm dumbbell press",
      "1-Leg Deadlift",
      "single leg hip thrust",
      "Pistol Squat",
      "Unilateral leg press",
    ])
      expect(isUnilateralName(n)).toBe(true);
  });
  it("does NOT match two-sided lifts", () => {
    for (const n of ["Barbell Squat", "Bench Press", "Deadlift", "Pull-up", "Lat Pulldown"])
      expect(isUnilateralName(n)).toBe(false);
  });
  it("override forces state regardless of name", () => {
    expect(isUnilateral("Barbell Squat", true)).toBe(true);
    expect(isUnilateral("Pistol Squat", false)).toBe(false);
    expect(isUnilateral("Pistol Squat")).toBe(true);
    expect(isUnilateral("Barbell Squat")).toBe(false);
  });
});

describe("side values (linked, default equal)", () => {
  it("both sides equal the logged value with no divergence", () => {
    const b = sideValues(8, 20);
    expect(b.right).toEqual({ reps: 8, weight: 20 });
    expect(b.left).toEqual({ reps: 8, weight: 20 });
    expect(sidesDiffer(b)).toBe(false);
  });
  it("a partial divergence only changes the named side/field", () => {
    const b = sideValues(8, 20, { lReps: 6 });
    expect(b.right).toEqual({ reps: 8, weight: 20 });
    expect(b.left).toEqual({ reps: 6, weight: 20 });
    expect(sidesDiffer(b)).toBe(true);
  });
  it("an explicit null weight is honoured (bodyweight side)", () => {
    const b = sideValues(8, 20, { rWeight: null });
    expect(b.right.weight).toBeNull();
    expect(b.left.weight).toBe(20);
  });
  it("differing weight counts as a difference", () => {
    expect(sidesDiffer(sideValues(8, 20, { rWeight: 22.5 }))).toBe(true);
  });
});

describe("divergenceEmpty", () => {
  it("treats undefined / blank objects as empty", () => {
    expect(divergenceEmpty(undefined)).toBe(true);
    expect(divergenceEmpty({})).toBe(true);
  });
  it("any stored side field makes it non-empty", () => {
    expect(divergenceEmpty({ lReps: 6 })).toBe(false);
    expect(divergenceEmpty({ rWeight: null })).toBe(false);
  });
});
