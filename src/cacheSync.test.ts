import { describe, it, expect } from "vitest";
import { isSyncable, deepEq, merge3, merge3Json } from "./cacheSync";

describe("cacheSync key classification", () => {
  it("syncs shared data keys, never device prefs or the sets/base keys", () => {
    expect(isSyncable("colosseum.exerciseCodes.v1")).toBe(true);
    expect(isSyncable("colosseum.priorities.v1")).toBe(true);
    expect(isSyncable("colosseum.metaOverrides.v1")).toBe(true);
    // device/display prefs
    expect(isSyncable("colosseum.theme")).toBe(false);
    expect(isSyncable("colosseum.lang")).toBe(false);
    expect(isSyncable("colosseum.lastAthlete.v1")).toBe(false);
    expect(isSyncable("colosseum.viewMode")).toBe(false);
    expect(isSyncable("colosseum.activeSet.include.v1")).toBe(false);
    // dedicated path / internal / non-namespaced
    expect(isSyncable("colosseum.manualSets.v1")).toBe(false);
    expect(isSyncable("colosseum._kvBase.v1")).toBe(false);
    expect(isSyncable("other.thing")).toBe(false);
  });
});

describe("deepEq", () => {
  it("is key-order-insensitive and deep", () => {
    expect(deepEq({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(deepEq({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
    expect(deepEq({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEq([1, 2], [2, 1])).toBe(false); // arrays are order-sensitive
  });
});

describe("merge3Json — never clobbers a one-sided edit", () => {
  it("identical sides pass through", () => {
    expect(merge3Json({ a: 1 }, { a: 1 }, { a: 1 })).toEqual({ a: 1 });
  });
  it("only one side changed → take that side", () => {
    const base = { a: 1 };
    expect(merge3Json(base, { a: 2 }, { a: 1 })).toEqual({ a: 2 }); // local changed
    expect(merge3Json(base, { a: 1 }, { a: 9 })).toEqual({ a: 9 }); // remote changed
  });
  it("both add different keys → union (no loss)", () => {
    expect(merge3Json({}, { a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });
  it("both edit DIFFERENT sub-keys of a map → both kept", () => {
    const base = { codes: { Squat: "SQ", Bench: "BP" } };
    const local = { codes: { Squat: "SQ2", Bench: "BP" } };
    const remote = { codes: { Squat: "SQ", Bench: "BP2" } };
    expect(merge3Json(base, local, remote)).toEqual({ codes: { Squat: "SQ2", Bench: "BP2" } });
  });
  it("one side deletes a key the other didn't touch → deleted", () => {
    expect(merge3Json({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2 })).toEqual({ a: 1 });
  });
  it("modify-vs-delete keeps the modification (loss-averse)", () => {
    // base has b; local deletes b; remote changes b → keep remote's value
    expect(merge3Json({ b: 1 }, {}, { b: 5 })).toEqual({ b: 5 });
  });
  it("arrays union + dedupe (e.g. deletedSets from two devices)", () => {
    expect(merge3Json(["x"], ["x", "y"], ["x", "z"])).toEqual(["x", "y", "z"]);
  });
  it("scalar value tie → cloud (remote) wins deterministically", () => {
    expect(merge3Json("base", "mine", "theirs")).toBe("theirs");
  });
});

describe("merge3 — string level", () => {
  it("merges two devices' priorities blobs by user without loss", () => {
    const base = JSON.stringify({ adomas: { Squat: 1 } });
    const local = JSON.stringify({ adomas: { Squat: 1 }, indre: { Deadlift: 2 } });
    const remote = JSON.stringify({ adomas: { Squat: 1 }, marija: { Bench: 3 } });
    expect(JSON.parse(merge3(base, local, remote)!)).toEqual({
      adomas: { Squat: 1 }, indre: { Deadlift: 2 }, marija: { Bench: 3 },
    });
  });
  it("identical strings short-circuit", () => {
    expect(merge3('{"a":1}', '{"a":1}', '{"a":1}')).toBe('{"a":1}');
  });
});
