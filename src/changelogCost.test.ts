import { describe, it, expect } from "vitest";
import {
  CHANGELOG,
  PROJECT_COST_EUR,
  EUR_PER_WEIGHTED_SP,
  costForNode,
  modelForRelease,
  modelsUnder,
  DEFAULT_MODEL_EARLY,
  DEFAULT_MODEL_RECENT,
  type Release,
} from "./changelog";

describe("model-aware version cost", () => {
  it("the whole tree's cost still sums to the real project spend", () => {
    const total = CHANGELOG.reduce((s, r) => s + costForNode(r), 0);
    expect(total).toBeCloseTo(PROJECT_COST_EUR, 6);
  });

  it("an Opus version costs ~5x a Haiku version of the same SP", () => {
    const opus: Release = { version: "b.9.9.9", shortTitle: "", code: "", title: "", sp: 10, note: "", model: "Opus 4.8" };
    const haiku: Release = { version: "b.9.9.9", shortTitle: "", code: "", title: "", sp: 10, note: "", model: "Haiku 4.5" };
    expect(costForNode(opus) / costForNode(haiku)).toBeCloseTo(5, 6);
    // and both are anchored to the shared per-weighted-SP rate
    expect(costForNode(opus)).toBeCloseTo(10 * 1 * EUR_PER_WEIGHTED_SP, 9);
    expect(costForNode(haiku)).toBeCloseTo(10 * 0.2 * EUR_PER_WEIGHTED_SP, 9);
  });

  it("breakpoint default: early versions are Opus, post-rule ones Haiku, stamp wins", () => {
    const early: Release = { version: "b.2.5.10", shortTitle: "", code: "", title: "", sp: 1, note: "" };
    const recent: Release = { version: "b.2.8.318", shortTitle: "", code: "", title: "", sp: 1, note: "" };
    const stamped: Release = { version: "b.2.5.10", shortTitle: "", code: "", title: "", sp: 1, note: "", model: "Haiku 4.5" };
    expect(modelForRelease(early)).toBe(DEFAULT_MODEL_EARLY);
    expect(modelForRelease(recent)).toBe(DEFAULT_MODEL_RECENT);
    expect(modelForRelease(stamped)).toBe("Haiku 4.5");
  });

  it("modelsUnder is one model for a leaf and the distinct set for a group", () => {
    const leaf: Release = { version: "b.2.8.318", shortTitle: "", code: "", title: "", sp: 1, note: "" };
    expect(modelsUnder(leaf)).toEqual(["Haiku 4.5"]);
    const group: Release = {
      version: "span", shortTitle: "", code: "", title: "", sp: 0, note: "",
      children: [
        { version: "b.2.5.0", shortTitle: "", code: "", title: "", sp: 1, note: "" }, // Opus
        { version: "b.2.8.318", shortTitle: "", code: "", title: "", sp: 1, note: "" }, // Haiku
      ],
    };
    expect(new Set(modelsUnder(group))).toEqual(new Set(["Opus 4.8", "Haiku 4.5"]));
  });
});
