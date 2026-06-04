import { describe, it, expect } from "vitest";
import {
  parseRows,
  sanityCheck,
  exerciseIdentity,
  EXERCISE_IDENTITIES,
  exerciseRelationship,
  includedExercises,
  EXERCISE_RELATIONSHIPS,
  type SetRecord,
} from "./domain";

describe("exercise relationships", () => {
  it("a plain lift has no relationship and no members", () => {
    expect(exerciseRelationship({})).toBe("none");
    expect(includedExercises({})).toEqual([]);
  });
  it("a dissolved lift can point to its original parent", () => {
    const r: Partial<SetRecord> = { identity: "dissolved", parentExerciseId: "Bench Press", relationshipType: "dissolved_into" };
    expect(exerciseRelationship(r)).toBe("dissolved_into");
    expect(r.parentExerciseId).toBe("Bench Press");
  });
  it("a combined lift includes multiple member exercises", () => {
    const r: Partial<SetRecord> = {
      identity: "combined",
      relationshipType: "combined_from",
      includedExerciseIds: ["Squat", "Smith Machine Squat", "Hack Squat"],
    };
    expect(exerciseRelationship(r)).toBe("combined_from");
    expect(includedExercises(r)).toEqual(["Squat", "Smith Machine Squat", "Hack Squat"]);
  });
  it("a comparison group includes multiple member exercises", () => {
    const r: Partial<SetRecord> = {
      identity: "comparison_group",
      relationshipType: "comparison_of",
      includedExerciseIds: ["Deadlift", "Romanian Deadlift"],
    };
    expect(exerciseRelationship(r)).toBe("comparison_of");
    expect(includedExercises(r).length).toBe(2);
  });
  it("derives the relationship from identity when not set explicitly", () => {
    expect(exerciseRelationship({ syntheticGroupId: "combine.sq-mix" })).toBe("combined_from");
    expect(exerciseRelationship({ syntheticGroupId: "compare.dl-pattern" })).toBe("comparison_of");
  });
  it("exposes all relationship types", () => {
    expect(EXERCISE_RELATIONSHIPS).toEqual(["none", "dissolved_into", "combined_from", "comparison_of"]);
  });
});

describe("exerciseIdentity", () => {
  it("defaults a plain logged set to original (no migration needed)", () => {
    expect(exerciseIdentity({})).toBe("original");
    expect(exerciseIdentity({ syntheticGroupId: "" })).toBe("original");
  });
  it("derives combined / comparison_group from the synthetic-group id", () => {
    expect(exerciseIdentity({ syntheticGroupId: "combine.sq-mix" })).toBe("combined");
    expect(exerciseIdentity({ syntheticGroupId: "compare.dl-pattern" })).toBe("comparison_group");
  });
  it("an explicit identity field wins over the derived one", () => {
    expect(exerciseIdentity({ identity: "dissolved", syntheticGroupId: "combine.x" })).toBe("dissolved");
    expect(exerciseIdentity({ identity: "original" })).toBe("original");
  });
  it("exposes all four identity types for future use", () => {
    expect(EXERCISE_IDENTITIES).toEqual(["original", "dissolved", "combined", "comparison_group"]);
  });
});

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
