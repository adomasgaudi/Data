import { describe, it, expect } from "vitest";
import type { SetRecord } from "./domain";
import { GRAPH_METRICS, graphMetric } from "./graphMetrics";
import { DEFAULT_GRAPH_CONFIG } from "./graphConfig";

function rec(p: Partial<SetRecord>): SetRecord {
  return {
    user: "U", username: "u", date: "2024-01-01", bodyweight: 80,
    exerciseName: "Bench Press", setNumber: 1, weight: 100, reps: 5,
    notes: "", dropset: false, percentile: 50, ...p,
  };
}

describe("graph metric registry (TASK 26)", () => {
  it("registers all 14 metrics, referenceable by id", () => {
    expect(GRAPH_METRICS.length).toBe(14);
    for (const id of [
      "weight", "weightRange", "e1rm", "strength", "strengthDecay", "predicted",
      "volume", "volumeLoad", "reps", "sets", "frequency", "pr", "trend", "movingAvg",
    ]) {
      expect(graphMetric(id), id).toBeDefined();
      expect(graphMetric(id)!.label.length).toBeGreaterThan(0);
    }
    expect(graphMetric("nope")).toBeUndefined();
  });

  it("computed metrics turn records into sorted {x,y} points", () => {
    const recs = [
      rec({ date: "2024-02-01", weight: 90, reps: 5 }),
      rec({ date: "2024-01-01", weight: 100, reps: 3 }),
    ];
    const w = graphMetric("weight")!.compute!(recs, DEFAULT_GRAPH_CONFIG);
    expect(w.map((p) => p.y)).toEqual([100, 90]); // sorted by date ascending
    expect(w[0]!.x).toBeLessThan(w[1]!.x);
    const vol = graphMetric("volume")!.compute!(recs, DEFAULT_GRAPH_CONFIG);
    expect(vol.map((p) => p.y)).toEqual([300, 450]); // 100×3, 90×5
    expect(graphMetric("reps")!.compute!(recs, DEFAULT_GRAPH_CONFIG).map((p) => p.y)).toEqual([3, 5]);
    expect(graphMetric("e1rm")!.compute!(recs, DEFAULT_GRAPH_CONFIG).length).toBe(2);
  });

  it("migrated metrics now compute; not-yet-built ones still don't (groundwork)", () => {
    // TASKS 31–36 migrated these:
    for (const id of ["weight", "weightRange", "e1rm", "strength", "strengthDecay", "predicted"]) {
      expect(graphMetric(id)!.compute, id).toBeTypeOf("function");
    }
    // Still registered-only:
    expect(graphMetric("trend")!.compute).toBeUndefined();
    expect(graphMetric("sets")!.compute).toBeUndefined();
  });

  it("weight range is a range series with lo/hi (TASK 32)", () => {
    const pts = graphMetric("weightRange")!.compute!([rec({ weight: 100, reps: 5 })], DEFAULT_GRAPH_CONFIG);
    expect(pts[0]!.lo).toBe(100);
    expect(pts[0]!.hi!).toBeGreaterThan(100); // up to the estimated 1RM
    expect(graphMetric("weightRange")!.type).toBe("range");
  });

  it("strength score never drops (running max), decay can dip (TASKS 34–35)", () => {
    const recs = [rec({ date: "2024-01-01", weight: 100, reps: 1 }), rec({ date: "2024-02-01", weight: 80, reps: 1 })];
    const s = graphMetric("strength")!.compute!(recs, DEFAULT_GRAPH_CONFIG);
    expect(s.map((p) => p.y)).toEqual([100, 100]); // running max holds at 100
  });

  it("predicted strength needs ≥3 points, else empty (TASK 36 missing-data)", () => {
    const few = [rec({ date: "2024-01-01" }), rec({ date: "2024-02-01" })];
    expect(graphMetric("predicted")!.compute!(few, DEFAULT_GRAPH_CONFIG)).toEqual([]);
    const many = [
      rec({ date: "2024-01-01", weight: 100, reps: 1 }),
      rec({ date: "2024-02-01", weight: 105, reps: 1 }),
      rec({ date: "2024-03-01", weight: 110, reps: 1 }),
    ];
    expect(graphMetric("predicted")!.compute!(many, DEFAULT_GRAPH_CONFIG).length).toBeGreaterThan(0);
  });
});

describe("graph config layer (TASK 29)", () => {
  it("has a default config with all settings", () => {
    expect(DEFAULT_GRAPH_CONFIG).toEqual({
      aggregation: "none", interval: "week", smoothing: 0, prediction: false, decay: false,
      formula: "epley", predictionDays: 90,
    });
  });
});
