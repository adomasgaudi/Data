import { describe, it, expect } from "vitest";
import {
  benchKey, benchmarkKg, isMet, sortBenchmarks, topMet, cleanStore,
  type Benchmark,
} from "./benchmarks";

const x = (label: string, value: number): Benchmark => ({ label, value, unit: "x" });
const kg = (label: string, value: number): Benchmark => ({ label, value, unit: "kg" });

describe("benchmarks", () => {
  it("normalizes the store key", () => {
    expect(benchKey("  Bench Press ")).toBe("bench press");
    expect(benchKey("Squat")).toBe(benchKey("squat"));
  });

  it("converts a benchmark to kg: ×bw scales, kg is absolute", () => {
    expect(benchmarkKg(x("Strong", 1.5), 80)).toBe(120);
    expect(benchmarkKg(kg("Strong", 140), 80)).toBe(140);
  });

  it("isMet compares the lifter's 1RM to the kg threshold", () => {
    expect(isMet(x("Solid", 1.0), 80, 80)).toBe(true);   // 80kg ≥ 1.0×80
    expect(isMet(x("Strong", 1.5), 119, 80)).toBe(false); // 119 < 120
    expect(isMet(kg("Elite", 180), 180, 80)).toBe(true);
  });

  it("sorts a mixed ×bw / kg list easiest→hardest at a reference bodyweight", () => {
    const list = [x("Strong", 1.5), kg("Elite", 180), x("Solid", 1.0)];
    const sorted = sortBenchmarks(list, 80).map((b) => b.label);
    expect(sorted).toEqual(["Solid", "Strong", "Elite"]); // 80, 120, 180 kg
  });

  it("topMet returns the hardest benchmark reached, or null", () => {
    const list = [x("Solid", 1.0), x("Strong", 1.5), kg("Elite", 180)];
    expect(topMet(list, 130, 80)?.label).toBe("Strong"); // meets 80 & 120, not 180
    expect(topMet(list, 70, 80)).toBeNull();              // meets none
    expect(topMet(list, 200, 80)?.label).toBe("Elite");
  });

  it("cleanStore drops malformed rows and empty lists", () => {
    const raw = {
      "bench press": [
        { label: "Solid", value: 1.0, unit: "x" },
        { label: "", value: 1.5, unit: "x" },        // empty label
        { label: "Bad", value: -2, unit: "kg" },      // non-positive
        { label: "Nope", value: 1, unit: "lbs" },     // bad unit
      ],
      squat: [],                                       // empty → dropped
      junk: "not an array",
    };
    const out = cleanStore(raw);
    expect(out["bench press"]).toHaveLength(1);
    expect(out["bench press"]![0]!.label).toBe("Solid");
    expect(out.squat).toBeUndefined();
    expect(out.junk).toBeUndefined();
  });

  it("returns an empty store for non-object input", () => {
    expect(cleanStore(null)).toEqual({});
    expect(cleanStore("x")).toEqual({});
    expect(cleanStore(42)).toEqual({});
  });
});
