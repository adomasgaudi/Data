import { describe, it, expect } from "vitest";
import type { SetRecord } from "./domain";
import { GRAPH_METRICS, graphMetric, graphCompatibilityNotes } from "./graphMetrics";
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

  it("every registered metric now has a compute (TASKS 31–41)", () => {
    for (const m of GRAPH_METRICS) expect(m.compute, m.id).toBeTypeOf("function");
  });

  it("weight range is a range series with lo/hi (TASK 32)", () => {
    const pts = graphMetric("weightRange")!.compute!([rec({ weight: 100, reps: 5 })], DEFAULT_GRAPH_CONFIG);
    expect(pts[0]!.lo).toBe(100);
    expect(pts[0]!.hi!).toBeGreaterThan(100); // up to the estimated 1RM
    expect(graphMetric("weightRange")!.type).toBe("range");
  });

  it("weight range plots bodyweight lifts via effective load (not added 0)", () => {
    // A pure bodyweight set (no plate) has origWeight null. Instead of an empty /
    // below-axis added-weight bar, it plots the effective (bodyweight-inclusive)
    // load moved up to its 1RM — a real positive range, scaled by difficulty.
    const full = graphMetric("weightRange")!.compute!(
      [rec({ exerciseName: "Pull Up", weight: 80, origWeight: null, reps: 5 })],
      DEFAULT_GRAPH_CONFIG,
    );
    expect(full.length).toBe(1);
    expect(full[0]!.lo).toBe(80); // the effective load handled
    expect(full[0]!.hi!).toBeGreaterThan(80); // up to its estimated 1RM

    // An easy variation (×0.5) scales the effective load down — still positive.
    const easy = graphMetric("weightRange")!.compute!(
      [rec({ exerciseName: "Handstand Push Up", weight: 80, origWeight: null, difficultyMult: 0.5, reps: 5 })],
      DEFAULT_GRAPH_CONFIG,
    );
    expect(easy[0]!.lo).toBe(40);
    expect(easy[0]!.hi!).toBeGreaterThan(40);
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

describe("volume / reps / sets / frequency aggregates (TASKS 37–39)", () => {
  const recs = [
    rec({ date: "2024-01-01", weight: 100, reps: 5 }), // vol 500
    rec({ date: "2024-01-01", weight: 100, reps: 3 }), // same day → vol 300, 2 sets
    rec({ date: "2024-01-08", weight: 90, reps: 5 }), // vol 450, next week
  ];
  it("volume sums per day", () => {
    const v = graphMetric("volume")!.compute!(recs, DEFAULT_GRAPH_CONFIG);
    expect(v.length).toBe(2); // two distinct days
    expect(v[0]!.y).toBe(800); // 500 + 300 on day 1
  });
  it("reps sum per day, sets count per day", () => {
    expect(graphMetric("reps")!.compute!(recs, DEFAULT_GRAPH_CONFIG)[0]!.y).toBe(8); // 5 + 3
    expect(graphMetric("sets")!.compute!(recs, DEFAULT_GRAPH_CONFIG)[0]!.y).toBe(2);
  });
  it("frequency counts distinct training days per week", () => {
    const f = graphMetric("frequency")!.compute!(recs, DEFAULT_GRAPH_CONFIG);
    expect(f.reduce((n, p) => n + (p.y ?? 0), 0)).toBe(2); // 2 distinct days total
  });
  it("volume/reps/sets sit on the right axis (TASK 42)", () => {
    for (const id of ["volume", "volumeLoad", "reps", "sets", "frequency"]) expect(graphMetric(id)!.axis).toBe("right");
  });
});

describe("PR markers, trend, moving average (TASKS 40–41)", () => {
  const recs = [
    rec({ date: "2024-01-01", weight: 100, reps: 1 }),
    rec({ date: "2024-02-01", weight: 90, reps: 1 }), // not a PR
    rec({ date: "2024-03-01", weight: 110, reps: 1 }), // new PR
  ];
  it("PR markers fire only on new records (scatter)", () => {
    const pr = graphMetric("pr")!.compute!(recs, DEFAULT_GRAPH_CONFIG);
    expect(pr.map((p) => p.y)).toEqual([100, 110]); // 90 skipped
    expect(graphMetric("pr")!.type).toBe("scatter");
  });
  it("trend + moving average produce points (and don't crash on little data)", () => {
    expect(graphMetric("trend")!.compute!(recs, DEFAULT_GRAPH_CONFIG).length).toBeGreaterThan(0);
    expect(graphMetric("trend")!.compute!([rec({})], DEFAULT_GRAPH_CONFIG)).toEqual([]); // <2 → empty
    expect(graphMetric("movingAvg")!.compute!(recs, { ...DEFAULT_GRAPH_CONFIG, smoothing: 2 }).length).toBe(3);
  });
});

describe("metric compatibility rules (TASK 42)", () => {
  it("flags predicted with too little data, and decay without a strength metric", () => {
    expect(graphCompatibilityNotes(["predicted"], DEFAULT_GRAPH_CONFIG, { e1rmPoints: 2 })[0]).toMatch(/at least 3/);
    expect(graphCompatibilityNotes(["volume"], { ...DEFAULT_GRAPH_CONFIG, decay: true }, { e1rmPoints: 10 }).some((n) => /Decay/.test(n))).toBe(true);
  });
  it("notes the separate axis when mixing kg + counts, and is quiet when fine", () => {
    expect(graphCompatibilityNotes(["e1rm", "volume"], DEFAULT_GRAPH_CONFIG, { e1rmPoints: 10 }).some((n) => /right axis/.test(n))).toBe(true);
    expect(graphCompatibilityNotes(["e1rm"], DEFAULT_GRAPH_CONFIG, { e1rmPoints: 10 })).toEqual([]);
  });
});
