import { describe, it, expect } from "vitest";
import {
  ALL_GRAPH_METRIC_IDS,
  allowedMetricsFor,
  isMetricAllowed,
  metricsAllowedForScope,
  exercisesBlockingMetric,
  fullyBlockedExercises,
  toggleMetric,
  setAllMetrics,
  type GraphPermissions,
} from "./graphPermissions";

describe("graph permissions — default blocks everything", () => {
  it("an unreviewed exercise has no allowed metrics", () => {
    const perm: GraphPermissions = {};
    expect(allowedMetricsFor(perm, "Squat").size).toBe(0);
    expect(isMetricAllowed(perm, "Squat", "e1rm")).toBe(false);
  });
  it("an empty list reads the same as unreviewed", () => {
    const perm: GraphPermissions = { Squat: [] };
    expect(allowedMetricsFor(perm, "Squat").size).toBe(0);
    expect(fullyBlockedExercises(perm, ["Squat"])).toEqual(["Squat"]);
  });
});

describe("toggleMetric", () => {
  it("adds then removes, never mutating the input", () => {
    const perm: GraphPermissions = {};
    const a = toggleMetric(perm, "Squat", "e1rm");
    expect(isMetricAllowed(a, "Squat", "e1rm")).toBe(true);
    expect(perm).toEqual({}); // input untouched
    const b = toggleMetric(a, "Squat", "e1rm");
    expect(isMetricAllowed(b, "Squat", "e1rm")).toBe(false);
    expect(b.Squat).toBeUndefined(); // last one removed → entry dropped
  });
  it("keeps allowed ids in display order", () => {
    let perm: GraphPermissions = {};
    perm = toggleMetric(perm, "Squat", "trend");
    perm = toggleMetric(perm, "Squat", "weight");
    // weight comes before trend in ALL_GRAPH_METRIC_IDS
    const order = perm.Squat!;
    expect(order.indexOf("weight")).toBeLessThan(order.indexOf("trend"));
  });
});

describe("setAllMetrics", () => {
  it("allow=true grants every metric; allow=false clears", () => {
    const all = setAllMetrics({}, "Squat", true);
    expect(all.Squat!.length).toBe(ALL_GRAPH_METRIC_IDS.length);
    const none = setAllMetrics(all, "Squat", false);
    expect(none.Squat).toBeUndefined();
  });
});

describe("metricsAllowedForScope — intersection across plotted exercises", () => {
  it("is empty when any plotted exercise is unreviewed", () => {
    const perm: GraphPermissions = { Squat: ["e1rm", "volume"] };
    expect(metricsAllowedForScope(perm, ["Squat", "Deadlift"]).size).toBe(0);
  });
  it("is the common allowed metrics when all are reviewed", () => {
    const perm: GraphPermissions = {
      Squat: ["e1rm", "volume", "reps"],
      Deadlift: ["e1rm", "reps"],
    };
    expect([...metricsAllowedForScope(perm, ["Squat", "Deadlift"])].sort()).toEqual(["e1rm", "reps"]);
  });
  it("a single exercise just returns its own allow-list", () => {
    const perm: GraphPermissions = { Squat: ["e1rm", "volume"] };
    expect([...metricsAllowedForScope(perm, ["Squat"])].sort()).toEqual(["e1rm", "volume"]);
  });
  it("empty scope yields nothing", () => {
    expect(metricsAllowedForScope({ Squat: ["e1rm"] }, []).size).toBe(0);
  });
});

describe("exercisesBlockingMetric", () => {
  it("lists the plotted exercises that block a metric", () => {
    const perm: GraphPermissions = { Squat: ["e1rm"], Deadlift: ["volume"] };
    expect(exercisesBlockingMetric(perm, ["Squat", "Deadlift"], "e1rm")).toEqual(["Deadlift"]);
    expect(exercisesBlockingMetric(perm, ["Squat", "Deadlift"], "volume")).toEqual(["Squat"]);
  });
});
