/**
 * End-to-end check on the bundled fixture: the exact shape the live endpoint
 * produces flows through boundary validation -> sanity check -> aggregation.
 * Guards against the fixture/endpoint contract drifting from the schema.
 */
import { describe, it, expect } from "vitest";
import sample from "./fixtures/sample.json";
import { DataEnvelopeSchema, parseRows, sanityCheck } from "./domain";
import { distinctExercises, distinctUsers, leaderboard, personalRecords } from "./aggregate";

describe("fixture integration", () => {
  const env = DataEnvelopeSchema.parse(sample);
  const { records, issues } = parseRows(env.rows);

  it("parses every fixture row with no issues", () => {
    expect(issues).toHaveLength(0);
    expect(records.length).toBe(env.rows.length);
  });

  it("has no sanity warnings (fixture is plausible kg data)", () => {
    expect(sanityCheck(records)).toHaveLength(0);
  });

  it("derives exercises and users", () => {
    // Ordered by instance count, most popular first (Bench 9 > Squat 7 > Deadlift 6).
    expect(distinctExercises(records)).toEqual(["Bench Press", "Squat", "Deadlift"]);
    expect(distinctUsers(records).length).toBeGreaterThanOrEqual(6);
  });

  it("produces a ranked bench-press leaderboard with the strongest on top", () => {
    const lb = leaderboard(records, "Bench Press");
    expect(lb.length).toBeGreaterThan(0);
    for (let i = 1; i < lb.length; i++) expect(lb[i - 1]!.e1rm).toBeGreaterThanOrEqual(lb[i]!.e1rm);
    expect(lb[0]!.user).toBe("Laurynas"); // 140x2 → ~149.3 kg e1rm, beats Johan's 120x6 → 144
  });

  it("computes a personal record per user/exercise pair present in the data", () => {
    const prs = personalRecords(records);
    expect(prs.find((p) => p.user === "Laurynas" && p.exerciseName === "Deadlift")?.topWeight.weight).toBe(240);
  });
});
