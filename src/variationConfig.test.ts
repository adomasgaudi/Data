import { describe, it, expect } from "vitest";
import { FAMILIES, defaultLeanTable, familyOf, DEFAULT_VARIATION_CONFIG } from "./variationConfig";
import { resolveNote } from "./variationModel";

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
  it("treats non-press handstands (holds/walks/kicks/wall tap) as the HANDSTAND setup model, NOT HSPU", () => {
    // They get the shared handstand SETUP variations (support/ladder/yoga/lean), but
    // never the pressing model — so they're HANDSTAND, distinct from HSPU.
    expect(familyOf("Handstand Hold")).toBe("HANDSTAND");
    expect(familyOf("Handstand Walk")).toBe("HANDSTAND");
    expect(familyOf("Handstand Kicks")).toBe("HANDSTAND");
    expect(familyOf("Handstand wall touch")).toBe("HANDSTAND");
    expect(familyOf("Handstand touch shoulders")).toBe("HANDSTAND");
    // The push-up variants are still matched FIRST → HSPU, not HANDSTAND.
    expect(familyOf("Wall Handstand Push Up")).toBe("HSPU");
  });
  it("treats the scapular handstand push-up variant as HSPU", () => {
    expect(familyOf("Scapular Handstand Push Up")).toBe("HSPU");
    expect(familyOf("Scapular HSPU")).toBe("HSPU");
  });
});

describe("HSPU one-hand / low-ROM variation tokens", () => {
  const res = (note: string) => resolveNote("HSPU", note, DEFAULT_VARIATION_CONFIG);
  it("maps 'one hand' / 'one arm' to the one-hand factor", () => {
    expect(res("one hand").vec.hands).toBe("one");
    expect(res("one arm").vec.hands).toBe("one");
    expect(res("one hand").scalar).toBeCloseTo(1.8, 6);
  });
  it("maps 'low rom' / 'partial' to the low-range factor", () => {
    expect(res("low rom").vec.range).toBe("low");
    expect(res("partial").vec.range).toBe("low");
    expect(res("low rom").scalar).toBeCloseTo(0.7, 6);
  });
  it("combines one-hand × low-ROM multiplicatively", () => {
    expect(res("one hand low rom").scalar).toBeCloseTo(1.8 * 0.7, 6);
  });
});

describe("back support (shoulderDist) — blue 6cm / 30cm / 45cm", () => {
  for (const fam of ["HSPU", "HANDSTAND"] as const) {
    it(`${fam} offers the blue / 30cm / 45cm back-support levels`, () => {
      const levels = FAMILIES[fam]!.dims.shoulderDist!;
      expect(Object.keys(levels)).toEqual(expect.arrayContaining(["0cm", "blue", "30cm", "45cm"]));
    });
    it(`${fam} parses a 'blue' note → back-to-wall + the blue block`, () => {
      const r = resolveNote(fam, "blue", DEFAULT_VARIATION_CONFIG);
      expect(r.vec.shoulderDist).toBe("blue");
      expect(r.vec.support).toBe("back_to_wall");
    });
    it(`${fam} parses a '30cm back' note → the 30cm support`, () => {
      expect(resolveNote(fam, "30cm back", DEFAULT_VARIATION_CONFIG).vec.shoulderDist).toBe("30cm");
    });
  }
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
