import { describe, it, expect } from "vitest";
import { testMockRecords } from "./mockData";

describe("testMockRecords", () => {
  const recs = testMockRecords("test", "test", "2026-06-15");

  it("generates a populated, well-formed history", () => {
    expect(recs.length).toBeGreaterThan(100);
    for (const r of recs) {
      expect(r.username).toBe("test");
      expect(r.user).toBe("test");
      expect(r.reps).toBeGreaterThan(0);
      expect(r.bodyweight).toBeGreaterThan(0);
      expect(r.date <= "2026-06-15").toBe(true); // never in the future
    }
  });

  it("is deterministic for a given day (no flicker across re-renders)", () => {
    expect(testMockRecords("test", "test", "2026-06-15")).toEqual(recs);
  });

  it("uses unique, high set numbers so it can't collide with CSV/manual sets", () => {
    const nums = recs.map((r) => r.setNumber);
    expect(new Set(nums).size).toBe(nums.length);
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(900_000);
  });

  it("spans multiple lifts and progresses over time", () => {
    expect(new Set(recs.map((r) => r.exerciseName)).size).toBeGreaterThanOrEqual(5);
    const squat = recs.filter((r) => r.exerciseName === "Squat");
    expect(squat[squat.length - 1]!.weight!).toBeGreaterThan(squat[0]!.weight!); // overload
  });
});
