import { describe, it, expect } from "vitest";
import { filterExercises, matchesFilters, FILTER_DIMS, type MetaProvider } from "./exerciseFilter";
import {
  JOINTS,
  MOVEMENTS,
  PLANES,
  exerciseMetaValues,
  movementDisplay,
  planesForExercise,
  type UserAssignments,
} from "./exerciseMeta";

// A tiny hand-built metadata provider so the engine tests don't depend on the
// seeded data: identity-agnostic, just name → values per dimension.
const META: Record<string, Partial<Record<string, string[]>>> = {
  Squat: { joint: ["Knee", "Hip"], movement: ["Flexion"], muscleGroup: ["Quads"], plane: ["Sagittal"] },
  "Bench Press": { joint: ["Elbow"], movement: ["Horizontal Adduction"], muscleGroup: ["Chest"], plane: ["Horizontal / Transverse"] },
  "Squat Family": { joint: ["Knee", "Hip"], movement: ["Flexion"], muscleGroup: ["Quads"], plane: ["Sagittal"] }, // a "combined" identity name
};
const provider: MetaProvider = (name, dim) => META[name]?.[dim] ?? [];
const NAMES = ["Squat", "Bench Press", "Squat Family"];

describe("filterExercises engine (TASK 19)", () => {
  it("no active filters returns everything (order preserved)", () => {
    expect(filterExercises(NAMES, [], provider)).toEqual(NAMES);
    expect(filterExercises(NAMES, [{ dim: "joint", values: [] }], provider)).toEqual(NAMES);
  });

  it("filters by a single dimension", () => {
    expect(filterExercises(NAMES, [{ dim: "joint", values: ["Knee"] }], provider)).toEqual(["Squat", "Squat Family"]);
    expect(filterExercises(NAMES, [{ dim: "muscleGroup", values: ["Chest"] }], provider)).toEqual(["Bench Press"]);
  });

  it("OR within a dimension, AND across dimensions", () => {
    // joint ∈ {Knee, Elbow} → all three; AND muscleGroup ∈ {Chest} → just Bench.
    const out = filterExercises(
      NAMES,
      [
        { dim: "joint", values: ["Knee", "Elbow"] },
        { dim: "muscleGroup", values: ["Chest"] },
      ],
      provider,
    );
    expect(out).toEqual(["Bench Press"]);
  });

  it("is identity-agnostic — a combined-group name filters like any other", () => {
    const out = filterExercises(NAMES, [{ dim: "movement", values: ["Flexion"] }], provider);
    expect(out).toContain("Squat Family"); // the "combined" name is matched purely on metadata
    expect(out).toContain("Squat");
  });

  it("matchesFilters agrees with filterExercises", () => {
    const f = [{ dim: "plane" as const, values: ["Sagittal"] }];
    expect(matchesFilters("Squat", f, provider)).toBe(true);
    expect(matchesFilters("Bench Press", f, provider)).toBe(false);
  });

  it("supports every advertised dimension", () => {
    expect(FILTER_DIMS).toEqual([
      "discipline", "bodyPart", "muscleGroup", "joint", "movement", "plane",
      "function", "equipment", "difficulty", "loadType", "laterality", "tier",
    ]);
  });
});

describe("joint / movement / plane taxonomies (TASKS 20–22)", () => {
  it("the joint and movement taxonomies are populated and extensible lists", () => {
    expect(JOINTS).toContain("Knee");
    expect(JOINTS).toContain("Costovertebral");
    expect(MOVEMENTS).toContain("Dorsiflexion");
    expect(MOVEMENTS.length).toBeGreaterThanOrEqual(27);
    expect(PLANES).toContain("Combined / Multiplanar");
  });

  it("seeded exercises have joints + movements", () => {
    expect(exerciseMetaValues("Squat", "joint")).toContain("Knee");
    expect(exerciseMetaValues("Squat", "movement")).toContain("Flexion");
  });

  it("exercises inherit planes through their movements (TASK 22)", () => {
    // Bench Press has a Horizontal Adduction movement → transverse plane inherited.
    expect(exerciseMetaValues("Bench Press", "plane")).toContain("Horizontal / Transverse");
    // A pure-Flexion movement set inherits the sagittal plane.
    expect(planesForExercise("Squat")).toContain("Sagittal");
  });
});

describe("joint-specific movement aliases (TASK 23)", () => {
  it("relabels generic movements per joint without changing the stored value", () => {
    expect(movementDisplay("Flexion", "Talocrural (Ankle)")).toBe("Dorsiflexion");
    expect(movementDisplay("Abduction", "Wrist")).toBe("Radial Deviation");
    expect(movementDisplay("Flexion")).toBe("Flexion"); // no joint → generic
    expect(movementDisplay("Flexion", "Knee")).toBe("Flexion"); // no alias → generic
    // The stored/filterable movement is still the generic one.
    expect(exerciseMetaValues("Squat", "movement")).toContain("Flexion");
  });
});

describe("user taxonomy assignments drive filtering (TASK 24)", () => {
  it("a saved assignment overrides the seeded metadata", () => {
    const user: UserAssignments = { "Mystery Lift": { joint: ["Hip"], movement: ["Extension"] } };
    expect(exerciseMetaValues("Mystery Lift", "joint", user)).toEqual(["Hip"]);
    // …and planes inherit from the user-assigned movements.
    expect(exerciseMetaValues("Mystery Lift", "plane", user)).toContain("Sagittal");
  });
});
