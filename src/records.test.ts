import { describe, it, expect } from "vitest";
import {
  weightClasses,
  weightClassFor,
  recordFor,
  percentOfRecord,
  WORLD_RECORDS,
  POWER_LIFTS,
} from "./records";

describe("weightClasses", () => {
  it("ends in the unbounded + class for each sex", () => {
    const men = weightClasses("m");
    const women = weightClasses("f");
    expect(men[men.length - 1]).toEqual({ sex: "m", max: null, label: "120+" });
    expect(women[women.length - 1]).toEqual({ sex: "f", max: null, label: "84+" });
  });
  it("is ascending with the bounded classes first", () => {
    const men = weightClasses("m");
    expect(men[0]).toEqual({ sex: "m", max: 59, label: "−59" });
    expect(men.filter((c) => c.max !== null).map((c) => c.max!))
      .toEqual([...new Set(men.filter((c) => c.max !== null).map((c) => c.max!))].sort((a, b) => a - b));
  });
});

describe("weightClassFor", () => {
  it("picks the lightest class whose bound is at or above the bodyweight", () => {
    expect(weightClassFor("m", 80).label).toBe("−83"); // 74 < 80 ≤ 83
    expect(weightClassFor("m", 83).label).toBe("−83"); // boundary is inclusive
    expect(weightClassFor("m", 83.1).label).toBe("−93");
    expect(weightClassFor("f", 47).label).toBe("−47");
    expect(weightClassFor("f", 46).label).toBe("−47");
  });
  it("falls to the + class above the top bound", () => {
    expect(weightClassFor("m", 140).label).toBe("120+");
    expect(weightClassFor("f", 90).label).toBe("84+");
  });
});

describe("recordFor", () => {
  it("returns the kg value for a valid sex+class+lift", () => {
    expect(recordFor("m", "−83", "deadlift")).toBe(WORLD_RECORDS.m["−83"]!.deadlift);
    expect(recordFor("f", "84+", "total")).toBe(WORLD_RECORDS.f["84+"]!.total);
  });
  it("returns null for an unknown class", () => {
    expect(recordFor("m", "−999", "squat")).toBeNull();
  });
  it("has all four lifts for every class, total ≥ each single lift", () => {
    for (const sex of ["m", "f"] as const) {
      for (const [, set] of Object.entries(WORLD_RECORDS[sex])) {
        for (const lift of POWER_LIFTS) expect(set[lift]).toBeGreaterThan(0);
        expect(set.total).toBeGreaterThanOrEqual(Math.max(set.squat, set.bench, set.deadlift));
      }
    }
  });
  it("records rise monotonically with the bounded weight classes (squat)", () => {
    const bounded = weightClasses("m").filter((c) => c.max !== null);
    const squats = bounded.map((c) => recordFor("m", c.label, "squat")!);
    for (let i = 1; i < squats.length; i++) expect(squats[i]!).toBeGreaterThan(squats[i - 1]!);
  });
});

describe("percentOfRecord", () => {
  it("computes a rounded percentage", () => {
    expect(percentOfRecord(160, 320)).toBe(50);
    expect(percentOfRecord(100, 300)).toBe(33.3);
  });
  it("is null when an input is missing or the record is non-positive", () => {
    expect(percentOfRecord(null, 320)).toBeNull();
    expect(percentOfRecord(160, null)).toBeNull();
    expect(percentOfRecord(160, 0)).toBeNull();
  });
});
