import { describe, it, expect } from "vitest";
import {
  pairEdge, pairEdgeParts, resolvePairGrade, setPairGrade,
  stripWildcards, stripWildcardsPersonal, flaggedPairsFor, PAIR_WILDCARD,
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

describe("resolvePairGrade — layering + direction, STRICTLY per-exercise", () => {
  const shared: PairMap = { [pairEdge("Squat", "Calf Raise")]: "super" };
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
  it("does NOT leak a flag onto another from-exercise (the bug: no wildcard)", () => {
    // Calf Raise is flagged super FROM Squat — it must stay neutral from any other lift.
    expect(resolvePairGrade("Deadlift", "Calf Raise", shared, personal, "h").grade).toBe("neutral");
    expect(resolvePairGrade("Bench", "Calf Raise", shared, personal, "h").grade).toBe("neutral");
  });
});

describe("stripWildcards — purge cross-exercise contamination", () => {
  it("removes `*→to` edges, keeps specific ones, reports the change", () => {
    const s: PairMap = { [pairEdge(PAIR_WILDCARD, "X")]: "noway", [pairEdge("A", "X")]: "super" };
    const r = stripWildcards(s);
    expect(r.changed).toBe(true);
    expect(r.map).toEqual({ [pairEdge("A", "X")]: "super" });
  });
  it("reports no change when there's nothing to purge", () => {
    const s: PairMap = { [pairEdge("A", "B")]: "good" };
    expect(stripWildcards(s)).toEqual({ map: s, changed: false });
  });
  it("purges wildcards across every user's personal bucket and drops emptied ones", () => {
    const p: PersonalPairMap = { g: { [pairEdge(PAIR_WILDCARD, "X")]: "noway" }, h: { [pairEdge("A", "B")]: "good" } };
    const r = stripWildcardsPersonal(p);
    expect(r.changed).toBe(true);
    expect(r.map.g).toBeUndefined();        // g's only edge was a wildcard → bucket dropped
    expect(r.map.h).toEqual({ [pairEdge("A", "B")]: "good" });
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

describe("flaggedPairsFor — manager view", () => {
  it("unions shared + personal with effective grade/layer, sorted best→worst", () => {
    const shared: PairMap = { [pairEdge("Squat", "Calf")]: "good", [pairEdge("Bench", "Leg")]: "difficult" };
    const personal: PersonalPairMap = { g: { [pairEdge("Squat", "Calf")]: "super" } };
    const rows = flaggedPairsFor(shared, personal, "g");
    expect(rows[0]).toEqual({ from: "Squat", to: "Calf", grade: "super", layer: "personal" });
    expect(rows.some((r) => r.from === "Bench" && r.grade === "difficult" && r.layer === "shared")).toBe(true);
  });
});
