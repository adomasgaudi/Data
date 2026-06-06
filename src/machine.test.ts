import { describe, it, expect } from "vitest";
import { classifyMixed, machineMultiplier, GRAVITY_MULT, AGGRESSIVE_THRESHOLDS } from "./machine";

describe("classifyMixed", () => {
  it("returns empty for no sets", () => {
    expect(classifyMixed([])).toEqual([]);
  });

  it("does not call anything gravity below minSets (too little to tell)", () => {
    // Only 3 sets → no cable→gravity split, so nothing is downgraded to gravity.
    // The lightest set can still be flagged review (it's suspiciously light).
    const v = classifyMixed([30, 50, 90]);
    expect(v).not.toContain("gravity");
    expect(v[0]).toBe("review"); // 30 < 0.55 × 90
  });

  it("splits a clear two-cluster set: high cluster = gravity, rest = cable", () => {
    // Cable working ~40–50, gravity ~75–85 (≈1.6× above the cable best).
    const v = classifyMixed([40, 45, 50, 75, 80, 85]);
    expect(v).toEqual(["cable", "cable", "cable", "gravity", "gravity", "gravity"]);
  });

  it("keeps input order regardless of the sets' order", () => {
    // Same data shuffled: a gravity 80 sits first, a cable 45 last.
    const v = classifyMixed([80, 40, 75, 50, 85, 45]);
    expect(v).toEqual(["gravity", "cable", "gravity", "cable", "gravity", "cable"]);
  });

  it("flags a low set (gravity warm-up?) as review, not cable", () => {
    // 18 is well under 0.55 × cable level (50) → review.
    const v = classifyMixed([18, 40, 45, 50, 78, 82]);
    expect(v[0]).toBe("review");
    expect(v.slice(1)).toEqual(["cable", "cable", "cable", "gravity", "gravity"]);
  });

  it("no cluster gap → all cable (low ones still reviewed)", () => {
    // A smooth ramp with no ≥1.3× jump near the top: nothing is gravity.
    const v = classifyMixed([48, 50, 52, 54, 56]);
    expect(v).not.toContain("gravity");
  });

  it("treats the topmost qualifying gap as the boundary when several gaps exist", () => {
    // Warm-up jump 20→40 (2×) low down, cable working 40–55, gravity 90+.
    const v = classifyMixed([20, 40, 45, 50, 55, 90, 95]);
    expect(v[5]).toBe("gravity");
    expect(v[6]).toBe("gravity");
    expect(v[4]).toBe("cable");
  });

  it("honours custom thresholds", () => {
    // With a very high gapMin nothing splits.
    const v = classifyMixed([40, 50, 80, 85], { ...AGGRESSIVE_THRESHOLDS, gapMin: 5 });
    expect(v).not.toContain("gravity");
  });
});

describe("machineMultiplier", () => {
  it("scales gravity to its cable-equivalent", () => {
    expect(machineMultiplier("gravity")).toBe(GRAVITY_MULT);
    expect(machineMultiplier("gravity")).toBe(0.6);
  });
  it("leaves cable and review untouched", () => {
    expect(machineMultiplier("cable")).toBe(1);
    expect(machineMultiplier("review")).toBe(1);
  });
});
