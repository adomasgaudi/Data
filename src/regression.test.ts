/**
 * Full regression sweep (TASK 54). Exercises the unified view's data layer end to
 * end — selection across identity types, filtering across dimensions, and every
 * graph metric — asserting no throws, no missing metric types, and sensible
 * output. (The view modes are CSS-only over this same data, so the data layer is
 * the meaningful surface to regression-test.)
 */
import { describe, it, expect } from "vitest";
import type { SetRecord } from "./domain";
import { exerciseIdentity, exerciseRelationship } from "./domain";
import { selectableExercises, withSyntheticGroups } from "./aggregate";
import { filterExercises, FILTER_DIMS } from "./exerciseFilter";
import { exerciseMetaValues } from "./exerciseMeta";
import { GRAPH_METRICS, graphMetric, graphCompatibilityNotes } from "./graphMetrics";
import { DEFAULT_GRAPH_CONFIG } from "./graphConfig";

function rec(p: Partial<SetRecord>): SetRecord {
  return {
    user: "Ada", username: "ada", date: "2024-01-01", bodyweight: 80,
    exerciseName: "Squat", setNumber: 1, weight: 100, reps: 5,
    notes: "", dropset: false, percentile: 50, ...p,
  };
}

// A realistic mixed fixture: several exercises, several dates.
const RECORDS: SetRecord[] = [
  rec({ exerciseName: "Squat", date: "2024-01-01", weight: 100, reps: 5 }),
  rec({ exerciseName: "Squat", date: "2024-01-08", weight: 110, reps: 3 }),
  rec({ exerciseName: "Squat", date: "2024-01-15", weight: 120, reps: 1 }),
  rec({ exerciseName: "Bench Press", date: "2024-01-02", weight: 80, reps: 5 }),
  rec({ exerciseName: "Bench Press", date: "2024-01-09", weight: 85, reps: 3 }),
  rec({ exerciseName: "Pull Ups", date: "2024-01-03", weight: 0, reps: 10 }), // bodyweight / no added weight
];

describe("regression — selection across identity types (TASK 54)", () => {
  it("original lifts are all selectable, none lost", () => {
    const names = selectableExercises(RECORDS);
    for (const n of ["Squat", "Bench Press", "Pull Ups"]) expect(names).toContain(n);
  });
  it("synthetic combined/comparison records report their identity + relationship", () => {
    const synth = withSyntheticGroups(RECORDS, [
      { id: "combine.sq", derivedName: "SQ mix", members: { Squat: 1 } },
      { id: "compare.bp", derivedName: "BP cmp", members: { "Bench Press": 1 } },
    ]);
    const combined = synth.find((r) => r.exerciseName === "SQ mix")!;
    const compared = synth.find((r) => r.exerciseName === "BP cmp")!;
    expect(exerciseIdentity(combined)).toBe("combined");
    expect(exerciseRelationship(compared)).toBe("comparison_of");
    expect(exerciseIdentity(rec({}))).toBe("original");
  });
});

describe("regression — filtering across dimensions (TASK 54)", () => {
  const names = ["Squat", "Bench Press", "Pull Ups"];
  it("filters by joint / movement / plane / muscle / equipment without crashing", () => {
    for (const dim of ["joint", "movement", "plane", "muscleGroup", "equipment"]) {
      // every name resolves to an array for the dim (no throw)
      for (const n of names) expect(Array.isArray(exerciseMetaValues(n, dim))).toBe(true);
    }
    expect(filterExercises(names, [{ dim: "joint", values: ["Knee"] }])).toContain("Squat");
    expect(filterExercises(names, [{ dim: "joint", values: ["Knee"] }])).not.toContain("Bench Press");
  });
  it("multiple simultaneous filters AND together", () => {
    const out = filterExercises(names, [
      { dim: "joint", values: ["Knee", "Elbow"] },
      { dim: "muscleGroup", values: exerciseMetaValues("Bench Press", "muscleGroup") },
    ]);
    expect(out).toEqual(["Bench Press"]);
  });
  it("every advertised dimension is filterable", () => {
    for (const d of FILTER_DIMS) expect(() => filterExercises(names, [{ dim: d, values: ["x"] }])).not.toThrow();
  });
});

describe("regression — every graph metric computes safely (TASK 54)", () => {
  const squat = RECORDS.filter((r) => r.exerciseName === "Squat");
  it("all computed metrics compute on data and on empty input without throwing", () => {
    for (const m of GRAPH_METRICS) {
      if (m.id === "pctWR") continue; // computed specially in analyticsGraph (no registry compute)
      expect(m.compute, m.id).toBeTypeOf("function");
      expect(() => m.compute!(squat, DEFAULT_GRAPH_CONFIG), m.id).not.toThrow();
      expect(Array.isArray(m.compute!(squat, DEFAULT_GRAPH_CONFIG)), m.id).toBe(true);
      expect(m.compute!([], DEFAULT_GRAPH_CONFIG), `${m.id} empty`).toEqual([]); // empty-state safe
    }
  });
  it("bodyweight / missing-weight sets don't break volume metrics", () => {
    const pull = RECORDS.filter((r) => r.exerciseName === "Pull Ups");
    expect(() => graphMetric("volume")!.compute!(pull, DEFAULT_GRAPH_CONFIG)).not.toThrow();
    expect(() => graphMetric("volumeLoad")!.compute!(pull, DEFAULT_GRAPH_CONFIG)).not.toThrow();
  });
  it("key metrics yield points for a real lift", () => {
    for (const id of ["weightRange", "e1rm", "strength", "strengthDecay", "volume", "reps", "sets"]) {
      expect(graphMetric(id)!.compute!(squat, DEFAULT_GRAPH_CONFIG).length, id).toBeGreaterThan(0);
    }
  });
  it("prediction needs ≥3 points and degrades gracefully (no crash)", () => {
    expect(graphMetric("predicted")!.compute!(squat, DEFAULT_GRAPH_CONFIG).length).toBeGreaterThan(0); // 3 squat points
    expect(graphMetric("predicted")!.compute!(squat.slice(0, 2), DEFAULT_GRAPH_CONFIG)).toEqual([]);
    expect(graphCompatibilityNotes(["predicted"], DEFAULT_GRAPH_CONFIG, { e1rmPoints: 2 }).length).toBeGreaterThan(0);
  });
});
