import { describe, it, expect } from "vitest";
import {
  isUnilateralName,
  isUnilateral,
  sideValues,
  resolveSides,
  sidesDiffer,
  divergenceEmpty,
  setUnits,
  explodeSides,
} from "./unilateral";

describe("resolveSides — the single source add & edit share (PB-54)", () => {
  it("empty left inputs (NaN) → linked, no divergence, base = right", () => {
    const r = resolveSides(20, 8, NaN, NaN);
    expect(r.divergence).toBeNull();
    expect(r.base).toEqual({ weight: 20, reps: 8 });
  });
  it("left equal to right → linked (clears divergence)", () => {
    expect(resolveSides(20, 8, 20, 8).divergence).toBeNull();
  });
  it("weaker LEFT becomes the base; divergence stores both sides", () => {
    const r = resolveSides(20, 8, 15, 8); // left lighter → weaker
    expect(r.base).toEqual({ weight: 15, reps: 8 });
    expect(r.divergence).toEqual({ rWeight: 20, rReps: 8, lWeight: 15, lReps: 8 });
  });
  it("weaker RIGHT stays the base when the left is stronger", () => {
    expect(resolveSides(20, 8, 25, 8).base).toEqual({ weight: 20, reps: 8 });
  });
  it("only a left REPS difference still diverges (left reps fewer → weaker)", () => {
    const r = resolveSides(20, 8, NaN, 5);
    expect(r.base).toEqual({ weight: 20, reps: 5 });
    expect(r.divergence).toEqual({ rWeight: 20, rReps: 8, lWeight: 20, lReps: 5 });
  });
  it("bodyweight (null weight): fewer reps on a side is weaker", () => {
    expect(resolveSides(null, 10, NaN, 7).base).toEqual({ weight: null, reps: 7 });
  });
});

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

describe("setUnits", () => {
  it("a unilateral set is 2 sets, others 1", () => {
    expect(setUnits(true)).toBe(2);
    expect(setUnits(false)).toBe(1);
  });
});

describe("explodeSides", () => {
  const clone = (r: { reps: number | null; weight: number | null; id: string }, reps: number | null, weight: number | null, side: "R" | "L") =>
    ({ ...r, reps, weight, id: `${r.id}-${side}` });
  it("passes non-unilateral records through unchanged", () => {
    const recs = [{ reps: 5, weight: 100, id: "a" }];
    expect(explodeSides(recs, () => false, () => undefined, clone)).toEqual(recs);
  });
  it("doubles a unilateral set into R then L, default equal", () => {
    const out = explodeSides([{ reps: 8, weight: 20, id: "a" }], () => true, () => undefined, clone);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ reps: 8, weight: 20, id: "a-R" });
    expect(out[1]).toMatchObject({ reps: 8, weight: 20, id: "a-L" });
  });
  it("carries each side's diverged reps/weight", () => {
    const out = explodeSides([{ reps: 8, weight: 20, id: "a" }], () => true, () => ({ lReps: 6 }), clone);
    expect(out[0]).toMatchObject({ reps: 8, id: "a-R" });
    expect(out[1]).toMatchObject({ reps: 6, id: "a-L" });
  });
});
