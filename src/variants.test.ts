import { describe, it, expect } from "vitest";
import {
  parseVariantNote,
  variantName,
  hasVariantTag,
  splitVariant,
  defaultVariantCoeff,
} from "./variants";

describe("parseVariantNote — squat-rack hole", () => {
  it("reads the SQ hole in the formats the owner actually logged", () => {
    const cases: [string, number][] = [
      ["SQ8", 8], ["sq3", 3], ["Sq 5", 5], ["SQ13", 13], ["SQ9", 9],
      ["SQ-1", -1], ["SQ -1", -1], ["SQ 1", 1], ["Squat rack 6", 6], ["Squat rack 4", 4],
    ];
    for (const [note, value] of cases) {
      const v = parseVariantNote("Push Ups", note);
      expect(v, note).not.toBeNull();
      expect(v!.dim).toBe("sq");
      expect(v!.value).toBe(value);
      expect(v!.label).toBe(`SQ${value}`);
    }
  });

  it("does not invent a hole from an ambiguous note", () => {
    expect(parseVariantNote("Push Ups", "Squat rack po 2")).toBeNull();
    expect(parseVariantNote("Push Ups", "Ant kelių")).toBeNull();
    expect(parseVariantNote("Push Ups", "Kneeling deficit")).toBeNull();
  });
});

describe("parseVariantNote — centimetres", () => {
  it("reads cm anywhere in the note", () => {
    for (const [note, value] of [["23cm", 23], ["15cm + yoga block", 15], ["Pakelta 10cm", 10], ["23cm uninterupted", 23]] as [string, number][]) {
      const v = parseVariantNote("Handstand Push Ups", note);
      expect(v, note).not.toBeNull();
      expect(v!.dim).toBe("cm");
      expect(v!.value).toBe(value);
      expect(v!.label).toBe(`${value}cm`);
    }
  });

  it("ignores non-cm measures", () => {
    expect(parseVariantNote("Pike Push Up", "4ft to thumb")).toBeNull();
  });
});

describe("parseVariantNote — smith / level (push-ups only)", () => {
  it("reads the level on a smith/push exercise", () => {
    const base = "Smith Machine Incline Close Grip Push Up";
    for (const [note, value] of [["5 level", 5], ["3", 3], ["Level 6", 6], ["5.5 level", 5.5], ["9lygis", 9], ["8 lygis", 8], ["Smith 3", 3], ["7 level dropset", 7]] as [string, number][]) {
      const v = parseVariantNote(base, note);
      expect(v, note).not.toBeNull();
      expect(v!.dim).toBe("smith");
      expect(v!.value).toBeCloseTo(value, 5);
    }
  });

  it("rounds a noisy fractional level to one decimal", () => {
    const v = parseVariantNote("Smith Machine Incline Close Grip Push Up", "Level 5.666666666666666666666");
    expect(v!.value).toBe(5.7);
    expect(v!.label).toBe("L5.7");
  });

  it("does NOT read a bare number / level as a variant on a non-push lift", () => {
    expect(parseVariantNote("Squat", "3")).toBeNull();
    expect(parseVariantNote("Bench Press", "5 level")).toBeNull();
  });

  it("prefers an explicit cm or SQ reading over a level on a push lift", () => {
    expect(parseVariantNote("Smith Machine Incline Close Grip Push Up", "Sq 5")!.dim).toBe("sq");
    expect(parseVariantNote("Pike Push Up", "10cm")!.dim).toBe("cm");
  });
});

describe("variant name helpers", () => {
  it("folds and splits the tag round-trip", () => {
    expect(variantName("Push Ups", "SQ8")).toBe("Push Ups (SQ8)");
    expect(splitVariant("Push Ups (SQ8)")).toEqual({ base: "Push Ups", label: "SQ8" });
    expect(splitVariant("Handstand Push Ups (23cm)")).toEqual({ base: "Handstand Push Ups", label: "23cm" });
    expect(splitVariant("Smith ... (L5.5)")).toEqual({ base: "Smith ...", label: "L5.5" });
  });

  it("recognises a tagged name and leaves a plain one", () => {
    expect(hasVariantTag("Push Ups (SQ8)")).toBe(true);
    expect(hasVariantTag("Push Ups (L5)")).toBe(true);
    expect(hasVariantTag("Push Ups")).toBe(false);
    expect(hasVariantTag("Bench Press (wide grip)")).toBe(false); // not a leverage tag
  });
});

describe("defaultVariantCoeff", () => {
  it("makes a higher squat-rack hole easier (less bodyweight)", () => {
    const v = (value: number) => defaultVariantCoeff(0.65, { dim: "sq", value, label: "", matched: "" });
    expect(v(8)).toBeLessThan(v(1)); // hole 8 easier than hole 1
    expect(v(-1)).toBeGreaterThan(v(1)); // decline harder
    expect(v(8)).toBeGreaterThanOrEqual(0.1); // clamped sane
    expect(v(20)).toBeGreaterThanOrEqual(0.1);
  });

  it("leaves a cm variant at the base coeff for the owner to set", () => {
    expect(defaultVariantCoeff(0.65, { dim: "cm", value: 10, label: "", matched: "" })).toBe(0.7);
  });
});
