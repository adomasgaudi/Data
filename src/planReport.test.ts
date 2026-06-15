import { describe, it, expect } from "vitest";
import {
  benchmarkStanding, volumeStanding, selfAverageSets, liftsBehind,
  bodypartStandings, PCTILE_FLOOR, type LiftInput,
} from "./planReport";
import { type Benchmark } from "./benchmarks";

const x = (label: string, value: number): Benchmark => ({ label, value, unit: "x" });

function lift(over: Partial<LiftInput>): LiftInput {
  return {
    name: "Bench Press", e1rm: 100, bodyweight: 80, weeklySets: 4,
    priorityTarget: null, benchmarks: [], percentile: 50, muscleGroup: "Chest", ...over,
  };
}

describe("planReport — benchmark axis", () => {
  it("flags below the next unmet benchmark and clears when all are met", () => {
    const bms = [x("Solid", 1.0), x("Strong", 1.5)]; // 80kg, 120kg at bw 80
    const behind = benchmarkStanding(lift({ e1rm: 100, benchmarks: bms })); // met Solid, below Strong
    expect(behind.behind).toBe(true);
    expect(behind.reason).toBe("below-benchmark");
    expect(behind.nextBenchmark?.label).toBe("Strong");
    expect(behind.gap).toBeCloseTo((120 - 100) / 120, 5);
    const met = benchmarkStanding(lift({ e1rm: 130, benchmarks: bms })); // above both
    expect(met.behind).toBe(false);
  });

  it("falls back to the 10th gym percentile when no benchmark is set", () => {
    expect(benchmarkStanding(lift({ benchmarks: [], percentile: 6 })).behind).toBe(true);
    expect(benchmarkStanding(lift({ benchmarks: [], percentile: PCTILE_FLOOR })).behind).toBe(false);
    expect(benchmarkStanding(lift({ benchmarks: [], percentile: 40 })).behind).toBe(false);
    expect(benchmarkStanding(lift({ benchmarks: [], percentile: 6 })).reason).toBe("below-percentile");
  });

  it("does not judge a lift with no 1RM or no standard", () => {
    expect(benchmarkStanding(lift({ e1rm: null })).reason).toBe("no-data");
    expect(benchmarkStanding(lift({ benchmarks: [], percentile: null })).reason).toBe("no-data");
  });
});

describe("planReport — volume axis", () => {
  it("uses the Priorities target when set", () => {
    expect(volumeStanding(lift({ weeklySets: 2, priorityTarget: 6 }), 99).behind).toBe(true);
    expect(volumeStanding(lift({ weeklySets: 6, priorityTarget: 6 }), 99).behind).toBe(false);
    expect(volumeStanding(lift({ weeklySets: 2, priorityTarget: 6 }), 99).deficit).toBe(4);
  });

  it("falls back to the athlete's own average when no target is set", () => {
    expect(volumeStanding(lift({ weeklySets: 2, priorityTarget: null }), 5).behind).toBe(true); // 2 < 5
    expect(volumeStanding(lift({ weeklySets: 6, priorityTarget: null }), 5).behind).toBe(false); // 6 > 5
    expect(volumeStanding(lift({ weeklySets: 2, priorityTarget: null }), 5).reason).toBe("below-average");
  });
});

describe("planReport — aggregation", () => {
  it("self-average counts only trained lifts (sets > 0)", () => {
    const lifts = [lift({ weeklySets: 6 }), lift({ weeklySets: 2 }), lift({ weeklySets: 0 })];
    expect(selfAverageSets(lifts)).toBe(4); // (6+2)/2, the 0 is excluded
  });

  it("liftStandings sorts worst-first and liftsBehind filters", () => {
    const lifts = [
      lift({ name: "A", weeklySets: 6, percentile: 50 }),            // fine
      lift({ name: "B", weeklySets: 1, percentile: 50 }),            // low volume vs avg
      lift({ name: "C", weeklySets: 6, benchmarks: [x("Strong", 2.0)], e1rm: 80 }), // below benchmark (160kg)
    ];
    const behind = liftsBehind(lifts).map((s) => s.name);
    expect(behind).toContain("B");
    expect(behind).toContain("C");
    expect(behind).not.toContain("A");
    // worst-first: every returned lift is actually behind
    expect(liftsBehind(lifts).every((s) => s.behind)).toBe(true);
  });

  it("bodypartStandings flags groups below the trained-group average", () => {
    const lifts = [
      lift({ name: "Bench", muscleGroup: "Chest", weeklySets: 10 }),
      lift({ name: "Squat", muscleGroup: "Legs", weeklySets: 8 }),
      lift({ name: "Curl", muscleGroup: "Arms", weeklySets: 1 }),
    ];
    const parts = bodypartStandings(lifts);
    const arms = parts.find((p) => p.muscleGroup === "Arms")!;
    const chest = parts.find((p) => p.muscleGroup === "Chest")!;
    expect(arms.behind).toBe(true);   // 1 < avg (19/3 ≈ 6.3)
    expect(chest.behind).toBe(false); // 10 > avg
    expect(parts[0]!.muscleGroup).toBe("Arms"); // worst (biggest deficit) first
  });
});
