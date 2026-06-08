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
  it("registers all 15 metrics, referenceable by id", () => {
    expect(GRAPH_METRICS.length).toBe(15);
    for (const id of [
      "weight", "weightRange", "e1rm", "pctWR", "strength", "strengthDecay", "predicted",
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
    // pctWR is computed specially in analyticsGraph (needs sex/bodyweight/the WR),
    // so it deliberately carries no registry compute.
    for (const m of GRAPH_METRICS) if (m.id !== "pctWR") expect(m.compute, m.id).toBeTypeOf("function");
  });

  it("weight range is a range series with lo/hi (TASK 32)", () => {
    const pts = graphMetric("weightRange")!.compute!([rec({ weight: 100, reps: 5 })], DEFAULT_GRAPH_CONFIG);
    expect(pts[0]!.lo).toBe(100);
    expect(pts[0]!.hi!).toBeGreaterThan(100); // up to the estimated 1RM
    expect(graphMetric("weightRange")!.type).toBe("range");
  });

  it("a combined lift shapes each member-origin differently (same series), plain lifts don't", () => {
    // A combined lift relabels member sets to one name, keeping the source in
    // originalExerciseName — scatter points then get a per-origin shape.
    const combined = graphMetric("weight")!.compute!(
      [
        rec({ exerciseName: "SQ mix", originalExerciseName: "Squat", weight: 100 }),
        rec({ exerciseName: "SQ mix", originalExerciseName: "Front Squat", weight: 80, setNumber: 2 }),
        rec({ exerciseName: "SQ mix", originalExerciseName: "Squat", weight: 110, date: "2024-01-02" }),
      ],
      DEFAULT_GRAPH_CONFIG,
    );
    const byShape = new Set(combined.map((p) => p.shape));
    expect(byShape.size).toBe(2); // two distinct member shapes
    expect([...byShape].every((s) => s !== undefined)).toBe(true);
    // A plain single-origin lift gets NO per-point shapes (stays plain dots).
    const plain = graphMetric("weight")!.compute!(
      [rec({ weight: 100 }), rec({ weight: 105, date: "2024-01-02" })],
      DEFAULT_GRAPH_CONFIG,
    );
    expect(plain.every((p) => p.shape === undefined)).toBe(true);
  });

  it("weight range uses the ADDED-weight 1RM (matches the set list), not the bodyweight load", () => {
    // A pure bodyweight set (origWeight null) adds no plate → lo = 0, and the top
    // is the added-weight 1RM (above bodyweight for a hard lift like pull-ups) —
    // NOT the ~bodyweight effective load, which produced numbers never in the set.
    const full = graphMetric("weightRange")!.compute!(
      [rec({ exerciseName: "Pull Up", weight: 80, origWeight: null, reps: 5 })],
      DEFAULT_GRAPH_CONFIG,
    );
    expect(full.length).toBe(1);
    expect(full[0]!.lo).toBe(0); // no plate added
    expect(full[0]!.hi!).toBeGreaterThan(0); // added-weight 1RM, above bodyweight
    expect(full[0]!.hi!).toBeLessThan(80); // and well below the bodyweight-inclusive load

    // An easy variation (×0.5) reads a NEGATIVE added-weight 1RM (needs assistance).
    const easy = graphMetric("weightRange")!.compute!(
      [rec({ exerciseName: "Handstand Push Up", weight: 80, origWeight: null, difficultyMult: 0.5, reps: 5 })],
      DEFAULT_GRAPH_CONFIG,
    );
    expect(easy[0]!.hi!).toBeLessThan(0);
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
      formula: "epley", predictionDays: 90, opacity: 0.6, rightHeadroom: 1, volumeYShift: 0, barGirth: 1, spread: 0.9,
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
  it("buckets count/volume by the configured interval — WEEK by default, DAY on request", () => {
    // Two sets in the SAME week (Mon + Wed), one the next week.
    const wk = [
      rec({ date: "2024-01-01", weight: 100, reps: 5 }), // vol 500
      rec({ date: "2024-01-03", weight: 100, reps: 5 }), // vol 500, same week
      rec({ date: "2024-01-10", weight: 100, reps: 5 }), // vol 500, next week
    ];
    const byWeek = graphMetric("volume")!.compute!(wk, DEFAULT_GRAPH_CONFIG); // default interval = week
    expect(byWeek.length).toBe(2); // two weeks
    expect(byWeek[0]!.y).toBe(1000); // 500 + 500 in week 1
    const byDay = graphMetric("volume")!.compute!(wk, { ...DEFAULT_GRAPH_CONFIG, interval: "day" });
    expect(byDay.length).toBe(3); // three distinct days
    expect(graphMetric("sets")!.compute!(wk, DEFAULT_GRAPH_CONFIG)[0]!.y).toBe(2); // 2 sets in week 1
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
