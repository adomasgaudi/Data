import { describe, it, expect } from "vitest";
import {
  handPointOffsetCm, leanCanonicalCm, leanCanonicalFromBlock,
  YOGA_BLOCK_CM, TAP_CONTACT_ORDER, TAP_CONTACT_FACTOR, TAP_CONTACT_LABEL,
  DEFAULT_HAND_LENGTH_CM,
} from "./handstandLean";

describe("handstand lean — hand-point conversion", () => {
  it("palm-base is the canonical zero-offset reference", () => {
    expect(handPointOffsetCm("base", 16)).toBe(0);
    expect(leanCanonicalCm(20, "base", 16)).toBe(20);
  });
  it("fingertips are a full hand-length toward the wall (owner's 3cm@tips ⇒ 19cm)", () => {
    expect(handPointOffsetCm("fingertips", 16)).toBe(16);
    expect(leanCanonicalCm(3, "fingertips", 16)).toBe(19);
  });
  it("in-between points are fractions of the hand length", () => {
    expect(handPointOffsetCm("knuckles", 16)).toBe(8);       // 0.5 L
    expect(handPointOffsetCm("fingerKnuckles", 16)).toBeCloseTo(11.2); // 0.7 L
  });
  it("uses the owner's default hand length when none given", () => {
    expect(leanCanonicalCm(0, "fingertips")).toBe(DEFAULT_HAND_LENGTH_CM);
  });
  it("converts a yoga-block side read at a hand point to canonical cm", () => {
    expect(YOGA_BLOCK_CM).toEqual({ small: 5, medium: 15, large: 23 });
    expect(leanCanonicalFromBlock("medium", "base", 16)).toBe(15);
    expect(leanCanonicalFromBlock("medium", "fingertips", 16)).toBe(31); // 15 + 16
  });
});

describe("handstand wall-tap contact", () => {
  it("is ordered easiest → hardest with monotonically rising factors", () => {
    expect(TAP_CONTACT_ORDER).toEqual(["hips_rest", "sh_rest", "hips_tap", "sh_tap"]);
    const factors = TAP_CONTACT_ORDER.map((c) => TAP_CONTACT_FACTOR[c]);
    for (let i = 1; i < factors.length; i++) expect(factors[i]!).toBeGreaterThan(factors[i - 1]!);
    expect(TAP_CONTACT_FACTOR.sh_tap).toBe(1.0); // hardest = reference
  });
  it("has a short code label for every level", () => {
    for (const c of TAP_CONTACT_ORDER) expect(TAP_CONTACT_LABEL[c].length).toBeLessThanOrEqual(8);
  });
});
