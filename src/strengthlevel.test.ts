/**
 * Deterministic tests for the StrengthLevel port (no network). Verifies the
 * flattening logic that mirrors the Apps Script's appendRowsFromSingleWorkout:
 * one row per set, correct set numbering, and "" for missing fields — exactly
 * the shape the dashboard's boundary schema expects.
 */
import { describe, it, expect } from "vitest";
import { rowsFromWorkout } from "./strengthlevel";
import { parseRows } from "./domain";

const SAMPLE_WORKOUT = {
  date: "2026-05-20",
  bodyweight: 82,
  exercises: [
    {
      exercise_name: "Bench Press",
      sets: [
        { weight: 100, reps: 5, notes: "", dropset: false, percentile: 70 },
        { weight: 105, reps: 3, notes: "top set", dropset: false, percentile: 74 },
      ],
    },
    {
      exercise_name: "Squat",
      sets: [{ weight: 140, reps: 1, percentile: 80 }], // missing notes/dropset
    },
  ],
};

describe("rowsFromWorkout", () => {
  const rows = rowsFromWorkout(SAMPLE_WORKOUT, "Adomas", "adomasgaudi");

  it("emits one row per set across all exercises", () => {
    expect(rows).toHaveLength(3);
  });

  it("numbers sets per-exercise starting at 1", () => {
    expect(rows.map((r) => `${r.exercise_name}#${r.set_number}`)).toEqual([
      "Bench Press#1",
      "Bench Press#2",
      "Squat#1",
    ]);
  });

  it("carries workout-level fields onto every row", () => {
    expect(rows.every((r) => r.user === "Adomas" && r.date === "2026-05-20" && r.bodyweight === 82)).toBe(true);
  });

  it('uses "" for missing set fields (Apps Script parity)', () => {
    const squat = rows[2]!;
    expect(squat.notes).toBe("");
    expect(squat.dropset).toBe("");
  });

  it("produces rows that pass the dashboard boundary schema", () => {
    const { records, issues } = parseRows(rows);
    expect(issues).toHaveLength(0);
    expect(records).toHaveLength(3);
    expect(records[1]!.exerciseName).toBe("Bench Press");
    expect(records[1]!.weight).toBe(105);
  });
});
