import { describe, it, expect } from "vitest";
import {
  parseCmLevel,
  dimUsesCmCurve,
  splitCmDimLevels,
  formatCmLevelKey,
  inferCmKeyStyle,
  namedUnitCm,
  factorForCmDimLevel,
  defaultSparseAnchorCms,
  defaultSparseAnchors,
  mergeCmCurveAnchors,
} from "./cmDimEdit";

describe("cmDimEdit", () => {
  const romAnchors = { "+25cm": 0.56, "0cm": 1.0, "-20cm": 1.5 };
  const shd = { "0cm": 1.0, blue: 1.0, "30cm": 1.0, "45cm": 1.0 };

  it("parses signed and plain cm keys", () => {
    expect(parseCmLevel("+25cm")).toBe(25);
    expect(parseCmLevel("30cm")).toBe(30);
    expect(parseCmLevel("blue")).toBeUndefined();
  });

  it("detects curve dims", () => {
    expect(dimUsesCmCurve(romAnchors)).toBe(true);
    expect(dimUsesCmCurve(shd)).toBe(true);
    expect(dimUsesCmCurve({ blue: 1, wall: 1 })).toBe(false);
  });

  it("splits anchors from named units", () => {
    const { anchors, named } = splitCmDimLevels(shd);
    expect(Object.keys(anchors)).toEqual(["0cm", "30cm", "45cm"]);
    expect(Object.keys(named)).toEqual(["blue"]);
  });

  it("formats cm keys per family style", () => {
    expect(inferCmKeyStyle(["+25cm", "0cm"])).toBe("signed");
    expect(inferCmKeyStyle(["0cm", "30cm"])).toBe("plain");
    expect(formatCmLevelKey(32, "signed")).toBe("+32cm");
    expect(formatCmLevelKey(30, "plain")).toBe("30cm");
  });

  it("resolves named blue via cm curve", () => {
    const anchors = { "0cm": 1.0, "30cm": 0.9, "45cm": 0.85 };
    const f = factorForCmDimLevel(anchors, "blue", namedUnitCm("blue"));
    expect(f).toBeCloseTo(0.98, 2);
  });

  it("interpolates off-preset cm", () => {
    expect(factorForCmDimLevel(romAnchors, "+32cm")).toBeCloseTo(0.437, 2);
  });

  it("derives sparse anchor cms from a full ROM table", () => {
    const full = {
      "+25cm": 0.56, "+23cm": 0.6, "+20cm": 0.66, "+15cm": 0.72, "+10cm": 0.8,
      "+5cm": 0.88, "+2cm": 0.94, "0cm": 1.0, "-3cm": 1.06, "-5cm": 1.1,
      "-10cm": 1.22, "-15cm": 1.35, "-20cm": 1.5,
    };
    expect(defaultSparseAnchorCms(full)).toEqual([-20, 0, 25]);
    const sparse = defaultSparseAnchors(full);
    expect(Object.keys(sparse)).toEqual(["-20cm", "0cm", "+25cm"]);
    expect(sparse["0cm"]).toBe(1);
    expect(sparse["+25cm"]).toBe(0.56);
  });

  it("merges sparse anchor overrides", () => {
    const base = { "0cm": 1, "+25cm": 0.56 };
    expect(mergeCmCurveAnchors(base, { "+10cm": 0.8 })).toEqual({ "0cm": 1, "+25cm": 0.56, "+10cm": 0.8 });
  });
});
