import { describe, it, expect } from "vitest";
import {
  handPointOffsetCm, leanCanonicalCm, leanCanonicalFromBlock, snapToLeanLevelCm,
  YOGA_BLOCK_CM, TAP_CONTACT_ORDER, TAP_CONTACT_LABEL,
  DEFAULT_HAND_LENGTH_CM,
} from "./handstandLean";
import { FAMILIES } from "./variationConfig";

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
  it("snaps a converted cm to the nearest discrete lean level", () => {
    const keys = ["0cm", "3cm", "5cm", "8cm", "10cm", "13cm", "15cm", "18cm", "20cm", "23cm"];
    expect(snapToLeanLevelCm(19, keys)).toBe("18cm"); // 3cm@fingertips (≈19) → nearest 18cm
    expect(snapToLeanLevelCm(0, keys)).toBe("0cm");
    expect(snapToLeanLevelCm(100, keys)).toBe("23cm"); // beyond the table → clamps to the max
  });
});

describe("handstand wall-tap contact", () => {
  it("is ordered easiest → hardest with monotonically rising factors in the family config", () => {
    expect(TAP_CONTACT_ORDER).toEqual(["hips_rest", "sh_rest", "hips_tap", "sh_tap"]);
    const dim = FAMILIES.HANDSTAND!.dims.tapContact!; // factors live in the family config (SSOT)
    const factors = TAP_CONTACT_ORDER.map((c) => dim[c]!);
    for (let i = 1; i < factors.length; i++) expect(factors[i]!).toBeGreaterThan(factors[i - 1]!);
    expect(dim.sh_tap).toBe(1.0); // hardest = reference
  });
  it("has a short code label for every level", () => {
    for (const c of TAP_CONTACT_ORDER) expect(TAP_CONTACT_LABEL[c].length).toBeLessThanOrEqual(8);
  });
});
