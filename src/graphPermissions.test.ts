import { describe, it, expect } from "vitest";
import {
  ALL_GRAPH_METRIC_IDS,
  allowedMetricsFor,
  isMetricAllowed,
  levelOf,
  metricsAllowedForScope,
  exercisesBlockingMetric,
  fullyBlockedExercises,
  setMetricLevel,
  cycleMetricLevel,
  setAllMetrics,
  normalizePermissions,
  type GraphPermissions,
} from "./graphPermissions";

describe("graph permissions — default blocks everything", () => {
  it("an unreviewed exercise has no allowed metrics", () => {
    const perm: GraphPermissions = {};
    expect(allowedMetricsFor(perm, "Squat").size).toBe(0);
    expect(isMetricAllowed(perm, "Squat", "e1rm")).toBe(false);
    expect(levelOf(perm, "Squat", "e1rm")).toBe(0);
  });
  it("an empty entry reads the same as unreviewed", () => {
    const perm: GraphPermissions = { Squat: {} };
    expect(allowedMetricsFor(perm, "Squat").size).toBe(0);
    expect(fullyBlockedExercises(perm, ["Squat"])).toEqual(["Squat"]);
  });
});

describe("setMetricLevel", () => {
  it("sets a level then clears at 0, never mutating the input", () => {
    const perm: GraphPermissions = {};
    const a = setMetricLevel(perm, "Squat", "e1rm", 2);
    expect(levelOf(a, "Squat", "e1rm")).toBe(2);
    expect(isMetricAllowed(a, "Squat", "e1rm")).toBe(true);
    expect(perm).toEqual({}); // input untouched
    const b = setMetricLevel(a, "Squat", "e1rm", 0);
    expect(levelOf(b, "Squat", "e1rm")).toBe(0);
    expect(b.Squat).toBeUndefined(); // last one cleared → entry dropped
  });
});

describe("cycleMetricLevel — no → 1 → 2 → 3 → no", () => {
  it("advances through every level and wraps", () => {
    let perm: GraphPermissions = {};
    perm = cycleMetricLevel(perm, "Squat", "e1rm");
    expect(levelOf(perm, "Squat", "e1rm")).toBe(1);
    perm = cycleMetricLevel(perm, "Squat", "e1rm");
    expect(levelOf(perm, "Squat", "e1rm")).toBe(2);
    perm = cycleMetricLevel(perm, "Squat", "e1rm");
    expect(levelOf(perm, "Squat", "e1rm")).toBe(3);
    perm = cycleMetricLevel(perm, "Squat", "e1rm");
    expect(levelOf(perm, "Squat", "e1rm")).toBe(0);
    expect(perm.Squat).toBeUndefined();
  });
});

describe("setAllMetrics", () => {
  it("level>0 grants every metric at that level; 0 clears", () => {
    const all = setAllMetrics({}, "Squat", 3);
    expect(Object.keys(all.Squat!).length).toBe(ALL_GRAPH_METRIC_IDS.length);
    expect(levelOf(all, "Squat", ALL_GRAPH_METRIC_IDS[0]!)).toBe(3);
    const none = setAllMetrics(all, "Squat", 0);
    expect(none.Squat).toBeUndefined();
  });
});

describe("normalizePermissions — migrates legacy + level shapes", () => {
  it("legacy string[] allow-lists become level 2 (confirmed)", () => {
    const out = normalizePermissions({ Squat: ["e1rm", "volume"], Deadlift: [] });
    expect(levelOf(out, "Squat", "e1rm")).toBe(2);
    expect(levelOf(out, "Squat", "volume")).toBe(2);
    expect(out.Deadlift).toBeUndefined(); // empty dropped
  });
  it("level maps pass through, clamped to 1..3, with 0 dropped", () => {
    const out = normalizePermissions({ Squat: { e1rm: 1, volume: 3, reps: 0, sets: 9 } });
    expect(levelOf(out, "Squat", "e1rm")).toBe(1);
    expect(levelOf(out, "Squat", "volume")).toBe(3);
    expect(levelOf(out, "Squat", "reps")).toBe(0);
    expect(levelOf(out, "Squat", "sets")).toBe(3); // clamped down
  });
  it("garbage in → empty out", () => {
    expect(normalizePermissions(null)).toEqual({});
    expect(normalizePermissions("nope")).toEqual({});
  });
});

describe("metricsAllowedForScope — intersection across plotted exercises", () => {
  it("is empty when any plotted exercise is unreviewed", () => {
    const perm: GraphPermissions = { Squat: { e1rm: 2, volume: 1 } };
    expect(metricsAllowedForScope(perm, ["Squat", "Deadlift"]).size).toBe(0);
  });
  it("is the common allowed metrics when all are reviewed", () => {
    const perm: GraphPermissions = {
      Squat: { e1rm: 2, volume: 1, reps: 3 },
      Deadlift: { e1rm: 1, reps: 2 },
    };
    expect([...metricsAllowedForScope(perm, ["Squat", "Deadlift"])].sort()).toEqual(["e1rm", "reps"]);
  });
  it("a single exercise just returns its own allow-list", () => {
    const perm: GraphPermissions = { Squat: { e1rm: 2, volume: 1 } };
    expect([...metricsAllowedForScope(perm, ["Squat"])].sort()).toEqual(["e1rm", "volume"]);
  });
  it("empty scope yields nothing", () => {
    expect(metricsAllowedForScope({ Squat: { e1rm: 1 } }, []).size).toBe(0);
  });
});

describe("exercisesBlockingMetric", () => {
  it("lists the plotted exercises that block a metric", () => {
    const perm: GraphPermissions = { Squat: { e1rm: 1 }, Deadlift: { volume: 2 } };
    expect(exercisesBlockingMetric(perm, ["Squat", "Deadlift"], "e1rm")).toEqual(["Deadlift"]);
    expect(exercisesBlockingMetric(perm, ["Squat", "Deadlift"], "volume")).toEqual(["Squat"]);
  });
});
