import { describe, it, expect } from "vitest";
import {
  pairEdge, pairEdgeParts, resolvePairGrade, setPairGrade,
  migrateLegacyPairs, flaggedPairsFor, PAIR_WILDCARD,
  type PairMap, type PersonalPairMap,
} from "./pairing";

describe("pairing edge keys", () => {
  it("round-trips from/to through an edge key", () => {
    const e = pairEdge("Squat", "Calf Raise");
    expect(pairEdgeParts(e)).toEqual({ from: "Squat", to: "Calf Raise" });
  });
  it("treats a bare candidate as a wildcard source", () => {
    // A key with no separator (legacy shape) reads as *→candidate.
    expect(pairEdgeParts("Calf Raise")).toEqual({ from: PAIR_WILDCARD, to: "Calf Raise" });
  });
});

describe("resolvePairGrade — layering + direction + wildcard", () => {
  const shared: PairMap = {
    [pairEdge("Squat", "Calf Raise")]: "super",
    [pairEdge(PAIR_WILDCARD, "Bicep Curl")]: "good", // migrated per-exercise baseline
  };
  const personal: PersonalPairMap = {
    g: { [pairEdge("Squat", "Calf Raise")]: "noway" }, // g vetoes the gym's super
  };

  it("personal override shadows the shared flag for that user only", () => {
    expect(resolvePairGrade("Squat", "Calf Raise", shared, personal, "g")).toEqual({ grade: "noway", layer: "personal" });
    expect(resolvePairGrade("Squat", "Calf Raise", shared, personal, "h")).toEqual({ grade: "super", layer: "shared" });
  });
  it("is directional — the reverse edge is independent", () => {
    expect(resolvePairGrade("Calf Raise", "Squat", shared, personal, "h")).toEqual({ grade: "neutral", layer: "auto" });
  });
  it("falls back to the wildcard baseline when no specific edge exists", () => {
    expect(resolvePairGrade("Deadlift", "Bicep Curl", shared, personal, "h")).toEqual({ grade: "good", layer: "shared" });
  });
  it("specific edge beats the wildcard", () => {
    const s: PairMap = { [pairEdge(PAIR_WILDCARD, "X")]: "noway", [pairEdge("A", "X")]: "super" };
    expect(resolvePairGrade("A", "X", s, {}, "h").grade).toBe("super");
  });
});

describe("setPairGrade — immutability + clear + layers", () => {
  it("sets a shared grade without mutating inputs", () => {
    const shared: PairMap = {}; const personal: PersonalPairMap = {};
    const out = setPairGrade({ from: "A", to: "B", grade: "super", layer: "shared", user: "g", shared, personal });
    expect(out.shared[pairEdge("A", "B")]).toBe("super");
    expect(shared).toEqual({}); // original untouched
  });
  it("clears a shared grade when set to neutral", () => {
    const shared: PairMap = { [pairEdge("A", "B")]: "good" };
    const out = setPairGrade({ from: "A", to: "B", grade: "neutral", layer: "shared", user: "g", shared, personal: {} });
    expect(out.shared[pairEdge("A", "B")]).toBeUndefined();
  });
  it("writes a personal override under the user and prunes an emptied bucket", () => {
    let personal: PersonalPairMap = {};
    ({ personal } = setPairGrade({ from: "A", to: "B", grade: "noway", layer: "personal", user: "g", shared: {}, personal }));
    expect(personal.g![pairEdge("A", "B")]).toBe("noway");
    ({ personal } = setPairGrade({ from: "A", to: "B", grade: "neutral", layer: "personal", user: "g", shared: {}, personal }));
    expect(personal.g).toBeUndefined(); // empty bucket pruned
  });
});

describe("migrateLegacyPairs", () => {
  it("turns flat 3-state + 5-grade flags into shared wildcard edges", () => {
    const out = migrateLegacyPairs({ "Calf Raise": "prefer", "Cable Fly": "avoid", "Plank": "super" });
    expect(out[pairEdge(PAIR_WILDCARD, "Calf Raise")]).toBe("good");
    expect(out[pairEdge(PAIR_WILDCARD, "Cable Fly")]).toBe("noway");
    expect(out[pairEdge(PAIR_WILDCARD, "Plank")]).toBe("super");
  });
  it("ignores unknown values and empty input", () => {
    expect(migrateLegacyPairs({ X: "weird" })).toEqual({});
    expect(migrateLegacyPairs(null)).toEqual({});
  });
});

describe("flaggedPairsFor — manager view", () => {
  it("unions shared + personal with effective grade/layer, sorted best→worst", () => {
    const shared: PairMap = { [pairEdge("Squat", "Calf")]: "good", [pairEdge("Bench", "Leg")]: "difficult" };
    const personal: PersonalPairMap = { g: { [pairEdge("Squat", "Calf")]: "super" } };
    const rows = flaggedPairsFor(shared, personal, "g");
    expect(rows[0]).toEqual({ from: "Squat", to: "Calf", grade: "super", layer: "personal" });
    expect(rows.some((r) => r.from === "Bench" && r.grade === "difficult" && r.layer === "shared")).toBe(true);
  });
});
