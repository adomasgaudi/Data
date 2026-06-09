import { describe, it, expect } from "vitest";
import type { SetRecord } from "./domain";
import {
  sorenessSusceptibility,
  exerciseDailyVolumes,
  exerciseOverreach,
  overreachForDay,
  sorenessKernel,
  muscleSorenessAsOf,
  muscleSorenessNow,
  SUSCEPTIBILITY_DEFAULT,
  OVERREACH_CAP,
  type DayVolume,
} from "./soreness";

function rec(p: Partial<SetRecord>): SetRecord {
  return {
    user: "User", username: "user", date: "2024-04-01", bodyweight: 80,
    exerciseName: "Squat", setNumber: 1, weight: 100, reps: 1,
    notes: "", dropset: false, percentile: 50, ...p,
  };
}
function dv(date: string, volume: number): DayVolume { return { date, volume }; }

describe("sorenessSusceptibility", () => {
  it("ranks eccentric/stretch lifts above compounds above isolation/machine", () => {
    expect(sorenessSusceptibility("Romanian Deadlift")).toBeGreaterThan(sorenessSusceptibility("Squat"));
    expect(sorenessSusceptibility("Squat")).toBeGreaterThan(sorenessSusceptibility("Cable Curl"));
  });
  it("a specific high rule beats a generic low one (leg curl, not 'curl')", () => {
    expect(sorenessSusceptibility("Lying Leg Curl")).toBe(1.5);
    expect(sorenessSusceptibility("Barbell Curl")).toBe(0.7);
  });
  it("an unknown lift gets the average default", () => {
    expect(sorenessSusceptibility("Zercher Wobble")).toBe(SUSCEPTIBILITY_DEFAULT);
  });
});

describe("exerciseDailyVolumes", () => {
  const recs = [
    rec({ exerciseName: "Squat", weight: 100, reps: 5, date: "2024-04-01" }), // 500
    rec({ exerciseName: "Squat", weight: 100, reps: 5, date: "2024-04-01" }), // +500 = 1000 same day
    rec({ exerciseName: "Squat", weight: 100, reps: 5, date: "2024-03-20" }), // 500
    rec({ exerciseName: "Bench Press", weight: 80, reps: 10, date: "2024-04-01" }), // other ex
    rec({ exerciseName: "Squat", weight: null, reps: 5, date: "2024-04-02" }), // skipped (null weight)
    rec({ username: "other", exerciseName: "Squat", weight: 999, reps: 9, date: "2024-04-01" }), // other user
  ];
  it("sums sets per exercise-day, oldest first, skipping incomplete sets / other users", () => {
    const m = exerciseDailyVolumes(recs, "user");
    expect(m.get("Squat")).toEqual([dv("2024-03-20", 500), dv("2024-04-01", 1000)]);
    expect(m.get("Bench Press")).toEqual([dv("2024-04-01", 800)]);
  });
});

describe("exerciseOverreach", () => {
  it("flags a day that beats the last-30-day daily record", () => {
    const days = [dv("2024-03-25", 1000), dv("2024-04-01", 1200)];
    const ov = exerciseOverreach(days, "Squat", "2024-04-01");
    expect(ov.exceededDay).toBe(true);
    expect(ov.dayRecord).toBe(1000);
    expect(ov.dayVolume).toBe(1200);
    expect(ov.overreach).toBeGreaterThan(0);
    expect(ov.overreach).toBeLessThanOrEqual(OVERREACH_CAP);
  });
  it("does NOT flag a steady history that equals its records", () => {
    const days = ["2024-03-04", "2024-03-11", "2024-03-18", "2024-03-25", "2024-04-01"].map((d) => dv(d, 1000));
    const ov = exerciseOverreach(days, "Squat", "2024-04-01");
    expect(ov.exceededDay).toBe(false);
    expect(ov.exceededWeek).toBe(false);
    expect(ov.exceededTwoWeek).toBe(false);
    expect(ov.overreach).toBe(0);
  });
  it("treats a brand-new lift (no prior record) as a full overreach", () => {
    const days = [dv("2024-04-01", 1000)];
    const ov = exerciseOverreach(days, "Squat", "2024-04-01");
    expect(ov.exceededDay).toBe(true);
    expect(ov.dayRecord).toBe(0);
    expect(ov.overreach).toBe(1);
  });
  it("caps a freak spike at OVERREACH_CAP", () => {
    const days = [dv("2024-03-25", 100), dv("2024-04-01", 100_000)];
    const ov = exerciseOverreach(days, "Squat", "2024-04-01");
    expect(ov.overreach).toBe(OVERREACH_CAP);
  });
});

describe("overreachForDay", () => {
  it("returns only the exercises trained that day", () => {
    const recs = [
      rec({ exerciseName: "Squat", weight: 100, reps: 10, date: "2024-04-01" }),
      rec({ exerciseName: "Bench Press", weight: 80, reps: 10, date: "2024-04-01" }),
      rec({ exerciseName: "Deadlift", weight: 120, reps: 5, date: "2024-03-29" }), // not today
    ];
    const out = overreachForDay(recs, "user", "2024-04-01").map((o) => o.exercise).sort();
    expect(out).toEqual(["Bench Press", "Squat"]);
  });
});

describe("sorenessKernel (DOMS rise-then-fall)", () => {
  it("is ~0 right after the session and rises to a peak under a day later", () => {
    expect(sorenessKernel(0, 3)).toBeCloseTo(0, 6);
    expect(sorenessKernel(0.8, 3)).toBeGreaterThan(sorenessKernel(0, 3));
  });
  it("is normalized so its own peak is 1", () => {
    // tPeak for tauDecay 3, tauRise 0.6 ≈ 1.207 days.
    expect(sorenessKernel(1.207, 3)).toBeGreaterThan(0.999);
    expect(sorenessKernel(1.207, 3)).toBeLessThanOrEqual(1 + 1e-9);
  });
  it("decays toward 0 well after the peak", () => {
    expect(sorenessKernel(2, 3)).toBeGreaterThan(sorenessKernel(6, 3));
    expect(sorenessKernel(12, 3)).toBeLessThan(0.05);
  });
  it("returns 0 for a degenerate curve (decay ≤ rise)", () => {
    expect(sorenessKernel(1, 0.6, 0.6)).toBe(0);
    expect(sorenessKernel(1, 0.5, 0.6)).toBe(0);
  });
});

describe("muscleSorenessAsOf", () => {
  // One novel overreach Squat session; nothing else.
  const recs = [rec({ exerciseName: "Squat", weight: 100, reps: 12, date: "2024-04-01" })];

  it("is ~0 the same day, peaks a day later, then decays", () => {
    const same = muscleSorenessNow(recs, "user", "2024-04-01");
    const next = muscleSorenessAsOf(recs, "user", "2024-04-02");
    const later = muscleSorenessAsOf(recs, "user", "2024-04-10");
    expect(same.get("Quads") ?? 0).toBeCloseTo(0, 6); // DOMS hasn't set in yet
    expect(next.get("Quads") ?? 0).toBeGreaterThan(0);
    expect(next.get("Quads") ?? 0).toBeGreaterThan(later.get("Quads") ?? 0); // fades
  });
  it("only sores the muscles the lift trains", () => {
    const s = muscleSorenessAsOf(recs, "user", "2024-04-02");
    expect(s.get("Quads") ?? 0).toBeGreaterThan(0);
    expect(s.get("Triceps") ?? 0).toBe(0);
  });
  it("honours an involvement override (0 → that muscle stays fresh)", () => {
    const s = muscleSorenessAsOf(recs, "user", "2024-04-02", {
      involvement: (_ex, m) => (m === "Glutes" ? 0 : 1),
    });
    expect(s.get("Glutes") ?? 0).toBe(0);
    expect(s.get("Quads") ?? 0).toBeGreaterThan(0);
  });
});
