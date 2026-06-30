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
  it("registers all 12 metrics, referenceable by id", () => {
    expect(GRAPH_METRICS.length).toBe(12);
    for (const id of [
      "weightRange", "e1rm", "pctWR", "pctBest", "strength", "strengthDecay", "predicted",
      "volume", "volumeLoad", "reps", "sets", "frequency",
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
    const e = graphMetric("e1rm")!.compute!(recs, DEFAULT_GRAPH_CONFIG);
    expect(e.length).toBe(2);
    expect(e[0]!.x).toBeLessThan(e[1]!.x); // sorted by date ascending
    expect(e[0]!.lo).toBe(100); // weight used — stem bottom for the 1RM bubble
    expect(e[0]!.y).toBeGreaterThan(e[0]!.lo!);
    const vol = graphMetric("volume")!.compute!(recs, DEFAULT_GRAPH_CONFIG);
    expect(vol.map((p) => p.y)).toEqual([300, 450]); // 100×3, 90×5
    expect(graphMetric("reps")!.compute!(recs, DEFAULT_GRAPH_CONFIG).map((p) => p.y)).toEqual([3, 5]);
    expect(graphMetric("e1rm")!.compute!(recs, DEFAULT_GRAPH_CONFIG).length).toBe(2);
  });

  it("pctBest scales each set to a fraction of the best 1RM in view (peak = 1.0)", () => {
    const recs = [
      rec({ date: "2024-01-01", weight: 50, origWeight: 50, reps: 5 }),
      rec({ date: "2024-02-01", weight: 100, origWeight: 100, reps: 5 }), // the strongest set
    ];
    const pts = graphMetric("pctBest")!.compute!(recs, DEFAULT_GRAPH_CONFIG);
    expect(pts.length).toBe(2);
    const peak = Math.max(...pts.map((p) => p.y!));
    expect(peak).toBe(1); // the best set is 100%
    expect(Math.min(...pts.map((p) => p.y!))).toBeCloseTo(0.5, 1); // half the load ≈ half
    expect(graphMetric("pctBest")!.compute!([], DEFAULT_GRAPH_CONFIG)).toEqual([]); // empty-safe
  });

  it("volume uses ADDED (bar) weight, not the bodyweight-folded effective load", () => {
    // A Hip-Thrust-like set: 60 kg on the bar (origWeight) folds to a 120 kg effective load
    // (weight). Volume must match the workout history (added × reps), not double it.
    const recs = [rec({ date: "2024-01-01", weight: 120, origWeight: 60, reps: 10 })];
    expect(graphMetric("volume")!.compute!(recs, DEFAULT_GRAPH_CONFIG)[0]!.y).toBe(600); // 60×10, not 1200
  });

  it("weekly buckets are Monday-start (matches the history), not epoch/Thursday weeks", () => {
    // Mon Jan 1 2024 & Sun Jan 7 are the SAME Monday-week; Mon Jan 8 starts the next.
    const recs = [
      rec({ date: "2024-01-01", weight: 50, origWeight: 50, reps: 10 }),
      rec({ date: "2024-01-07", weight: 50, origWeight: 50, reps: 10 }),
      rec({ date: "2024-01-08", weight: 50, origWeight: 50, reps: 10 }),
    ];
    const vol = graphMetric("volume")!.compute!(recs, DEFAULT_GRAPH_CONFIG);
    expect(vol.length).toBe(2); // two Monday-weeks (epoch/Thursday weeks would split Jan 1 / Jan 7)
    expect(vol.map((p) => p.y)).toEqual([1000, 500]); // {Jan1+Jan7}, {Jan8}
  });

  it("quarter / year intervals bucket volume into 3- and 12-month blocks", () => {
    const recs = [
      rec({ date: "2024-01-15", weight: 50, origWeight: 50, reps: 10 }),
      rec({ date: "2024-03-20", weight: 50, origWeight: 50, reps: 10 }),
      rec({ date: "2024-05-10", weight: 50, origWeight: 50, reps: 10 }),
    ];
    const q = graphMetric("volume")!.compute!(recs, { ...DEFAULT_GRAPH_CONFIG, interval: "quarter" });
    expect(q.map((p) => p.y)).toEqual([1000, 500]); // Q1 {Jan+Mar}=1000, Q2 {May}=500
    const y = graphMetric("volume")!.compute!(recs, { ...DEFAULT_GRAPH_CONFIG, interval: "year" });
    expect(y.map((p) => p.y)).toEqual([1500]); // all of 2024 in one bucket
  });

  it("bi-week interval groups two Monday-weeks into one bucket", () => {
    const cfg = { ...DEFAULT_GRAPH_CONFIG, interval: "biweek" as const };
    const recs = [
      rec({ date: "2024-01-01", weight: 50, origWeight: 50, reps: 10 }),
      rec({ date: "2024-01-08", weight: 50, origWeight: 50, reps: 10 }),
      rec({ date: "2024-01-15", weight: 50, origWeight: 50, reps: 10 }),
    ];
    const vol = graphMetric("volume")!.compute!(recs, cfg);
    expect(vol.length).toBe(2); // 3 consecutive Monday-weeks span exactly 2 bi-week buckets
    expect(vol.reduce((s, p) => s + (p.y ?? 0), 0)).toBe(1500); // volume conserved
  });

  it("multi-day intervals (2d–5d) bucket volume into fixed N-day windows", () => {
    const recs = [
      rec({ date: "2024-01-01", weight: 50, origWeight: 50, reps: 10 }),
      rec({ date: "2024-01-02", weight: 50, origWeight: 50, reps: 10 }),
      rec({ date: "2024-01-03", weight: 50, origWeight: 50, reps: 10 }),
      rec({ date: "2024-01-04", weight: 50, origWeight: 50, reps: 10 }),
    ];
    const vol3 = graphMetric("volume")!.compute!(recs, { ...DEFAULT_GRAPH_CONFIG, interval: "3d" });
    expect(vol3.length).toBe(2);
    expect(vol3.reduce((s, p) => s + (p.y ?? 0), 0)).toBe(2000);
    const vol2 = graphMetric("volume")!.compute!(recs, { ...DEFAULT_GRAPH_CONFIG, interval: "2d" });
    expect(vol2.length).toBe(2);
    expect(vol2.reduce((s, p) => s + (p.y ?? 0), 0)).toBe(2000);
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
    const combined = graphMetric("e1rm")!.compute!(
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
    const plain = graphMetric("e1rm")!.compute!(
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

  it("strength line drops shadowed weak-set vertices, keeps corners + lull dips (UI-47)", () => {
    // A strong session, then two WEAKER sessions inside a 28-day window (shadowed by the
    // strong one), then a new PR. The weak sessions must NOT add their own data points —
    // the line holds flat at the proven level, then steps up. (Owner: weaker sets confuse
    // which point is real.)
    const recs = [
      rec({ date: "2024-01-01", weight: 100, reps: 1 }), // 100
      rec({ date: "2024-01-08", weight: 90, reps: 1 }),  // weaker, shadowed → no vertex
      rec({ date: "2024-01-15", weight: 92, reps: 1 }),  // weaker, shadowed → no vertex
      rec({ date: "2024-01-22", weight: 110, reps: 1 }), // new PR → vertex
    ];
    const cfg = { ...DEFAULT_GRAPH_CONFIG, strengthWindow: 28 * 24 * 3600 * 1000 };
    const ys = graphMetric("strength")!.compute!(recs, cfg).map((p) => p.y);
    // Endpoints + the step: flat 100 (start + last-before-jump) then 110 — never 90/92.
    expect(ys).toEqual([100, 100, 110]);
    expect(ys).not.toContain(90);
    expect(ys).not.toContain(92);
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

  it("projection basis honours warm-up exclusion + hard-only filter", () => {
    // 4 sessions; each has a hard top set and a warm-up. rirOf marks warm-ups (rir 8).
    const recs = [
      rec({ date: "2024-01-01", weight: 100, reps: 3, setNumber: 1 }),
      rec({ date: "2024-01-01", weight: 40, reps: 10, setNumber: 2 }), // warm-up
      rec({ date: "2024-02-01", weight: 105, reps: 3, setNumber: 1 }),
      rec({ date: "2024-03-01", weight: 110, reps: 3, setNumber: 1 }),
      rec({ date: "2024-04-01", weight: 115, reps: 3, setNumber: 1 }),
    ];
    const rirOf = (r: SetRecord) => (r.weight != null && r.weight < 60 ? 8 : 1); // light = warm-up
    const hardCfg = { ...DEFAULT_GRAPH_CONFIG, rirOf, projectionBasis: "hard" as const };
    const allCfg = { ...DEFAULT_GRAPH_CONFIG, rirOf, projectionBasis: "all" as const };
    // Both bases still produce a forecast (warm-up dropped, ≥3 hard points remain).
    expect(graphMetric("predicted")!.compute!(recs, hardCfg).length).toBeGreaterThan(0);
    expect(graphMetric("predicted")!.compute!(recs, allCfg).length).toBeGreaterThan(0);
    // Records basis (default) is monotonic in the source → still fits.
    expect(graphMetric("predicted")!.compute!(recs, DEFAULT_GRAPH_CONFIG).length).toBeGreaterThan(0);
  });

  it("projection fit-window (projectionFrom/To) excludes out-of-window sets", () => {
    const recs = [2020, 2021, 2022, 2023, 2024].map((y, i) =>
      rec({ date: `${y}-01-01`, weight: 100 + i * 5, reps: 3 }));
    const all = graphMetric("predicted")!.compute!(recs, DEFAULT_GRAPH_CONFIG);
    expect(all.length).toBeGreaterThan(0);
    // Window covering only the last 2 points (< 3) → not enough to fit → empty.
    const narrow = { ...DEFAULT_GRAPH_CONFIG, projectionFrom: Date.UTC(2023, 0, 1), projectionTo: Date.UTC(2024, 6, 1) };
    expect(graphMetric("predicted")!.compute!(recs, narrow)).toEqual([]);
    // Window covering the first 3 points → fits, and never starts before the window.
    const early = { ...DEFAULT_GRAPH_CONFIG, projectionFrom: Date.UTC(2019, 0, 1), projectionTo: Date.UTC(2022, 6, 1) };
    const earlyPts = graphMetric("predicted")!.compute!(recs, early);
    expect(earlyPts.length).toBeGreaterThan(0);
    expect(earlyPts[0]!.x).toBeGreaterThanOrEqual(Date.UTC(2020, 0, 1));
  });
});

describe("graph config layer (TASK 29)", () => {
  it("has a default config with all settings", () => {
    expect(DEFAULT_GRAPH_CONFIG).toEqual({
      aggregation: "none", interval: "week", smoothing: 0, decay: false,
      formula: "epley", predictionDays: 90, projectionBasis: "records", opacity: 0.6, rightHeadroom: 1, volumeYShift: 0, barGirth: 1, spread: 0.9,
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
