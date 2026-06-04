import { describe, it, expect } from "vitest";
import type { SetRecord } from "./domain";
import { duplicateAudit, relationshipAudit, type RelationshipDef } from "./exerciseAudit";
import {
  inferJoints,
  inferMovements,
  bulkInferMetadata,
  bulkInferAssignments,
  jointsForExercise,
  movementsForExercise,
  exerciseMetaValues,
} from "./exerciseMeta";

function rec(p: Partial<SetRecord>): SetRecord {
  return {
    user: "User",
    username: "user",
    date: "2024-01-01",
    bodyweight: 80,
    exerciseName: "Bench Press",
    setNumber: 1,
    weight: 100,
    reps: 1,
    notes: "",
    dropset: false,
    percentile: 50,
    ...p,
  };
}

// ---- TASK 61 ----
describe("duplicateAudit (TASK 61)", () => {
  it("returns a review list of look-alike names without merging", () => {
    const recs = [
      rec({ exerciseName: "Ab curl" }),
      rec({ exerciseName: "Ab curls" }),
      rec({ exerciseName: "Ab Curls" }),
      rec({ exerciseName: "Bench Press" }),
    ];
    const clusters = duplicateAudit(recs);
    const abc = clusters.find((c) => c.names.includes("Ab curl"));
    expect(abc).toBeTruthy();
    expect(abc!.names.length).toBeGreaterThanOrEqual(3);
    expect(abc!.suggested).toBe(abc!.names[0]); // most-logged spelling, a hint only
    // A unique name is never flagged.
    expect(clusters.some((c) => c.names.includes("Bench Press"))).toBe(false);
  });

  it("is empty for clean data (nothing to review)", () => {
    expect(duplicateAudit([rec({ exerciseName: "Squat" }), rec({ exerciseName: "Deadlift" })])).toEqual([]);
  });
});

// ---- TASK 62 ----
describe("relationshipAudit (TASK 62)", () => {
  const existing = ["Squat", "Bench Press", "Deadlift", "Overhead Press"];

  it("flags an orphan dissolved exercise (no parent)", () => {
    const defs: RelationshipDef[] = [{ name: "Box Squat", identity: "dissolved" }];
    const issues = relationshipAudit(defs, existing);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.kind).toBe("orphan_dissolved");
  });

  it("flags a broken parent reference", () => {
    const defs: RelationshipDef[] = [{ name: "Box Squat", identity: "dissolved", parent: "Nonexistent" }];
    expect(relationshipAudit(defs, existing)[0]!.kind).toBe("broken_parent");
  });

  it("flags self-parenting", () => {
    const defs: RelationshipDef[] = [{ name: "Squat", identity: "dissolved", parent: "Squat" }];
    expect(relationshipAudit(defs, [...existing])[0]!.kind).toBe("self_parent");
  });

  it("accepts a valid dissolved exercise", () => {
    const defs: RelationshipDef[] = [{ name: "Box Squat", identity: "dissolved", parent: "Squat" }];
    expect(relationshipAudit(defs, existing)).toEqual([]);
  });

  it("flags empty combined and comparison groups", () => {
    const defs: RelationshipDef[] = [
      { name: "Push Combo", identity: "combined", members: ["Bench Press"] },
      { name: "Press Compare", identity: "comparison_group", members: [] },
    ];
    const kinds = relationshipAudit(defs, existing).map((i) => i.kind);
    expect(kinds).toContain("empty_combined");
    expect(kinds).toContain("empty_comparison");
  });

  it("flags a missing member while accepting valid ones", () => {
    const defs: RelationshipDef[] = [{ name: "Push Combo", identity: "combined", members: ["Bench Press", "Ghost Lift"] }];
    const issues = relationshipAudit(defs, existing);
    expect(issues.map((i) => i.kind)).toEqual(["missing_member"]);
  });

  it("flags duplicate definitions once", () => {
    const defs: RelationshipDef[] = [
      { name: "Box Squat", identity: "dissolved", parent: "Squat" },
      { name: "Box Squat", identity: "dissolved", parent: "Squat" },
    ];
    const dupes = relationshipAudit(defs, existing).filter((i) => i.kind === "duplicate_def");
    expect(dupes).toHaveLength(1);
  });
});

// ---- TASKS 57–60 ----
describe("keyword inference (TASKS 57–60)", () => {
  it("infers joints + movements for common, unseeded lifts", () => {
    expect(inferMovements("Leg Curl")).toContain("Flexion");
    expect(inferJoints("Leg Curl")).toContain("Knee");
    expect(inferJoints("Seated Cable Row")).toContain("Scapula");
    expect(inferMovements("Barbell Shrug")).toContain("Elevation");
    expect(inferMovements("Standing Calf Raise")).toContain("Plantar Flexion");
  });

  it("uses the FIRST (most specific) matching rule — leg curl is not a bicep curl", () => {
    expect(inferJoints("Lying Leg Curl")).toEqual(["Knee"]); // not Elbow/Radioulnar
    expect(inferJoints("Incline Bench Press")).not.toContain("Knee");
  });

  it("leaves a name that matches nothing unassigned (no guessing)", () => {
    expect(inferJoints("Sauna Session")).toEqual([]);
    expect(inferMovements("Sauna Session")).toEqual([]);
  });

  it("falls back to inference only when no explicit registry entry exists", () => {
    // Squat is seeded explicitly; inference must not override it.
    expect(jointsForExercise("Squat")).toContain("Spine");
    // Hammer Curl is not seeded → inferred.
    expect(movementsForExercise("Hammer Curl")).toContain("Flexion");
  });

  it("planes flow through inferred movements in exerciseMetaValues", () => {
    const planes = exerciseMetaValues("Dumbbell Lateral Raise", "plane");
    expect(planes).toContain("Frontal"); // Abduction → Frontal
  });

  it("bulkInferMetadata tags each name with its source", () => {
    const out = bulkInferMetadata(["Squat", "Hammer Curl", "Sauna Session"]);
    expect(out.find((m) => m.name === "Squat")!.source).toBe("registry");
    expect(out.find((m) => m.name === "Hammer Curl")!.source).toBe("inferred");
    expect(out.find((m) => m.name === "Sauna Session")!.source).toBe("none");
  });

  it("bulkInferAssignments skips unknowns so they stay unassigned", () => {
    const a = bulkInferAssignments(["Hammer Curl", "Sauna Session"]);
    expect(a["Hammer Curl"]).toBeTruthy();
    expect(a["Sauna Session"]).toBeUndefined();
  });
});
