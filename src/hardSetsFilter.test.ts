import { describe, it, expect } from "vitest";
import type { SetRecord } from "./domain";
import { DEFAULT_GRAPH_CONFIG } from "./graphConfig";
import {
  hardSetFilterDropIds,
  recordSetId,
  type HardSetFilterConfig,
} from "./hardSetsFilter";
import type { EffortClass } from "./metrics";

function rec(p: Partial<SetRecord>): SetRecord {
  return {
    user: "U", username: "u", date: "2024-01-01", bodyweight: 80,
    exerciseName: "Bench Press", setNumber: 1, weight: 100, reps: 5,
    notes: "", dropset: false, percentile: 50, ...p,
  };
}

describe("hardSetsFilter", () => {
  const effortHard = (): EffortClass | null => "hard";

  it("RIR mode drops mid/warmup sets", () => {
    const records = [rec({ setNumber: 1 }), rec({ setNumber: 2, date: "2024-01-02" })];
    const effort = (r: SetRecord): EffortClass | null => (r.setNumber === 2 ? "warmup" : "hard");
    const filter: HardSetFilterConfig = { mode: "rir", minPct: 0.8, strengthRef: "now" };
    const drop = hardSetFilterDropIds(records, filter, DEFAULT_GRAPH_CONFIG, effort);
    expect(drop.size).toBe(1);
    expect(drop.has(recordSetId(records[1]!))).toBe(true);
  });

  it("%1RM Now keeps submax sets above threshold relative to then-strength", () => {
    const records = [
      rec({ date: "2024-01-01", weight: 100, origWeight: 100, reps: 1, setNumber: 1 }),
      rec({ date: "2024-01-08", weight: 80, origWeight: 80, reps: 5, setNumber: 1 }),
      rec({ date: "2024-01-15", weight: 50, origWeight: 50, reps: 10, setNumber: 1 }),
    ];
    const filter: HardSetFilterConfig = { mode: "pct", minPct: 0.75, strengthRef: "now" };
    const drop = hardSetFilterDropIds(records, filter, DEFAULT_GRAPH_CONFIG, effortHard);
    expect(drop.has(recordSetId(records[0]!))).toBe(false); // PR
    expect(drop.has(recordSetId(records[1]!))).toBe(false); // ~80% of 100
    expect(drop.has(recordSetId(records[2]!))).toBe(true); // easy set
  });

  it("off mode drops nothing", () => {
    const records = [rec({ weight: 40, reps: 15 })];
    const filter: HardSetFilterConfig = { mode: "off", minPct: 0.8, strengthRef: "now" };
    expect(hardSetFilterDropIds(records, filter, DEFAULT_GRAPH_CONFIG, effortHard).size).toBe(0);
  });
});
