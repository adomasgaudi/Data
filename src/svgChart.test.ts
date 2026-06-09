import { describe, it, expect } from "vitest";
import { dataXExtent, type SvgSeries } from "./svgChart";

/** Build a minimal series at the given x-values (unit-agnostic — dataXExtent only
 * reads x). `extra` lets a test mark it as bars, hidden, or a projection. */
const at = (name: string, xs: number[], extra: Partial<SvgSeries> = {}): SvgSeries => ({
  name, color: "#000", type: "line", points: xs.map((x) => ({ x, y: 1 })), ...extra,
});

// Regression cover for the recurring "volume bars move independently" bug: the time
// axis must be ONE stable frame derived from all real data, never sliding when the
// legend is toggled or a projection is added.
describe("dataXExtent — the stable time-axis domain", () => {
  it("spans the UNION of bars + lines (bucketed bars are narrower than per-set lines)", () => {
    const bars = at("Volume", [10, 15, 20], { type: "bars", axis: "right" });
    const lines = at("e1RM", [0, 12, 30]);
    expect(dataXExtent([bars, lines])).toEqual({ xMin: 0, xMax: 30 });
  });

  it("ignores legend visibility — a default-hidden series still anchors the axis", () => {
    // The whole point: toggling a series off must not slide the time axis, so the
    // extent never filters by visibility — a hidden, wider series still counts.
    const bars = at("Volume", [10, 20], { type: "bars" });
    const wide = at("e1RM", [0, 40], { hidden: true });
    expect(dataXExtent([bars, wide])).toEqual({ xMin: 0, xMax: 40 });
  });

  it("excludes future-projection overlays (noExtendX) from widening the axis", () => {
    // Predicted Strength projects into the future; it may draw (clipped) but must
    // not stretch the frame — the axis stays anchored to the real logged data.
    const lines = at("e1RM", [0, 30]);
    const predicted = at("Predicted", [0, 30, 400], { noExtendX: true });
    expect(dataXExtent([lines, predicted])).toEqual({ xMin: 0, xMax: 30 });
  });
});
