import { describe, it, expect } from "vitest";
import { parseRows, sanityCheck, type SetRecord } from "./domain";

describe("parseRows", () => {
  it("coerces numeric strings and treats '' as null", () => {
    const { records, issues } = parseRows([
      {
        user: "Ada",
        username: "ada",
        date: "2024-01-01",
        bodyweight: "80.5",
        exercise_name: "Bench Press",
        set_number: "2",
        weight: "100",
        reps: 5,
        notes: "felt good",
        dropset: "1",
        percentile: "",
      },
    ]);
    expect(issues).toHaveLength(0);
    const r = records[0]!;
    expect(r.bodyweight).toBe(80.5);
    expect(r.setNumber).toBe(2);
    expect(r.weight).toBe(100);
    expect(r.reps).toBe(5);
    expect(r.dropset).toBe(true);
    expect(r.percentile).toBeNull();
  });

  it("records an issue for a non-numeric weight instead of throwing", () => {
    const { records, issues } = parseRows([
      { user: "Ada", username: "ada", date: "2024-01-01", weight: "heavy", reps: 5, exercise_name: "Bench" },
    ]);
    expect(records).toHaveLength(0);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toMatch(/not a number/);
  });

  it("does not let one bad row blank out the good ones", () => {
    const { records, issues } = parseRows([
      { user: "Ada", username: "ada", date: "2024-01-01", weight: 100, reps: 1, exercise_name: "Bench" },
      { user: "Bob", username: "bob", date: "2024-01-02", weight: "NaNish", reps: 1, exercise_name: "Bench" },
    ]);
    expect(records).toHaveLength(1);
    expect(issues).toHaveLength(1);
  });
});

describe("sanityCheck", () => {
  it("flags an implausible weight (likely unit/data bug)", () => {
    const records: SetRecord[] = [
      {
        user: "X",
        username: "x",
        date: "2024-01-01",
        bodyweight: 80,
        exerciseName: "Bench Press",
        setNumber: 1,
        weight: 2000,
        reps: 1,
        notes: "",
        dropset: false,
        percentile: 50,
      },
    ];
    const warnings = sanityCheck(records);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.field).toBe("weightKg");
  });

  it("passes clean data with no warnings", () => {
    const { records } = parseRows([
      { user: "Ada", username: "ada", date: "2024-01-01", bodyweight: 80, weight: 100, reps: 5, exercise_name: "Bench", percentile: 60 },
    ]);
    expect(sanityCheck(records)).toHaveLength(0);
  });
});
