import { describe, it, expect } from "vitest";
import { FAMILIES, defaultLeanTable, familyOf } from "./variationConfig";

describe("familyOf", () => {
  it("maps known exercise names to a family, else null", () => {
    expect(familyOf("Handstand Push Ups")).toBe("HSPU");
    expect(familyOf("Push Up")).toBe("PUSHUP");
    expect(familyOf("Back Squat")).toBeNull();
  });
  it("recognises EVERY handstand push-up variant as HSPU, any spelling/origin", () => {
    for (const name of [
      "Handstand Push-ups",       // hyphen
      "Handstand Pushups",        // no space
      "handstand push up",        // lowercase, singular
      "Deficit Handstand Push Ups",
      "Wall Handstand Push Up",
      "HSPU",                     // the code as a name
      "HSPU-B",
    ]) expect(familyOf(name)).toBe("HSPU");
  });
  it("does NOT treat non-press handstands (holds/walks/kicks) as HSPU", () => {
    expect(familyOf("Handstand Hold")).toBeNull();
    expect(familyOf("Handstand Walk")).toBeNull();
    expect(familyOf("Handstand Kicks")).toBeNull();
  });
});

describe("defaultLeanTable", () => {
  it("returns the base lean table unchanged for non-back-to-wall supports", () => {
    const base = FAMILIES.HSPU!.dims.lean!;
    expect(defaultLeanTable("HSPU", "free")).toEqual(base);
    expect(defaultLeanTable("HSPU", "front_to_wall")).toEqual(base);
    expect(defaultLeanTable("HSPU", "ladder")).toEqual(base);
  });

  it("shifts the table DOWN 15cm for back-to-wall (the wall grace)", () => {
    // base: 0→1.0 3→1.03 5→1.04 8→1.07 10→1.09 13→1.11 15→1.13 18→1.16 20→1.17 23→1.2
    // b2w factor(X) = base factor(max(0, X-15)) using the largest key ≤ that cm.
    expect(defaultLeanTable("HSPU", "back_to_wall")).toEqual({
      "0cm": 1.0,   // -15 → 0
      "3cm": 1.0,   // -12 → 0
      "5cm": 1.0,   // -10 → 0
      "8cm": 1.0,   // -7  → 0
      "10cm": 1.0,  // -5  → 0
      "13cm": 1.0,  // -2  → 0
      "15cm": 1.0,  //  0  → 0cm (1.0)
      "18cm": 1.03, //  3  → 3cm (1.03)
      "20cm": 1.04, //  5  → 5cm (1.04)
      "23cm": 1.07, //  8  → 8cm (1.07)
    });
  });

  it("returns an empty table for an unknown family", () => {
    expect(defaultLeanTable("NOPE", "free")).toEqual({});
    expect(defaultLeanTable("NOPE", "back_to_wall")).toEqual({});
  });
});
