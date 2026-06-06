import { describe, it, expect } from "vitest";
import { resolveNote, matchTokens, normalizeNote } from "./variationModel";
import { DEFAULT_VARIATION_CONFIG, familyOf, type VariationConfig } from "./variationConfig";

// The resolver is engine-only; the live config (variationConfig.ts) evolves freely.
// So the spec's acceptance is checked against a FIXED in-test config that mirrors
// the original spec shape — the engine behaviour is what's under test here.
const SPEC: VariationConfig = {
  FAMILIES: {
    HSPU: {
      dims: {
        support: { free: 1.0, wall: 0.85, band_light: 0.78, band_heavy: 0.62 },
        lean: { neutral: 1.0, fwd_small: 0.95, fwd_big: 0.88 },
        rom: { full: 1.0, to_block: 0.7, partial: 0.6 },
        elevation: { floor: 1.0, deficit_15: 1.15 },
      },
      defaults: { support: "free", lean: "neutral", rom: "full", elevation: "floor" },
    },
  },
  TOKENS: {
    HSPU: {
      wall: { support: "wall" },
      freestanding: { support: "free" },
      "yoga block": { rom: "to_block", support: "wall" },
      limited: { rom: "partial" },
      "guma heavy": { support: "band_heavy" },
      guma: { support: "band_light" },
      "forward lean": { lean: "fwd_big" },
    },
  },
};
const r = (note: string) => resolveNote("HSPU", note, SPEC);

describe("resolveNote (factored variation difficulty)", () => {
  it("a single explicit token sets its dimension", () => {
    expect(r("wall").scalar).toBe(0.85);
    expect(r("wall").vec.support).toBe("wall");
  });

  it("an implication sets multiple dimensions (yoga block ⇒ wall too)", () => {
    const res = r("yoga block");
    expect(res.scalar).toBe(0.595); // 0.70 (rom) × 0.85 (support) × 1 × 1
    expect(res.vec.support).toBe("wall"); // implied even though "wall" wasn't written
    expect(res.vec.rom).toBe("to_block");
  });

  it("an empty note is all-defaults, scalar 1", () => {
    const res = r("");
    expect(res.scalar).toBe(1);
    expect(res.vec).toEqual(SPEC.FAMILIES.HSPU!.defaults);
    expect(res.flags).toHaveLength(0);
  });

  it("an unknown token produces an unreviewed flag with the fragments", () => {
    const res = r("xyzzy nonsense");
    expect(res.flags.some((f) => f.type === "unreviewed")).toBe(true);
    const frag = res.flags.find((f) => f.type === "unreviewed")!.detail;
    expect(frag).toContain("xyzzy");
    expect(frag).toContain("nonsense");
  });

  it("longest-match-first: 'guma heavy' beats 'guma'", () => {
    expect(r("guma heavy").vec.support).toBe("band_heavy");
    expect(r("guma heavy").scalar).toBe(0.62);
    expect(r("guma").vec.support).toBe("band_light");
  });

  it("two tokens on one dimension flag a conflict, last-applied wins", () => {
    expect(r("wall freestanding").flags.map((f) => f.type)).toContain("conflict");
    expect(["wall", "free"]).toContain(r("wall freestanding").vec.support);
  });

  it("punctuation-only leftovers are ignored (peeled '+'/',' from cm levels)", () => {
    // "15cm + yoga block" is peeled to "+ yoga block" upstream → the "+" is no flag.
    const res = r("+ yoga block");
    expect(res.scalar).toBe(0.595);
    expect(res.flags.some((f) => f.type === "unreviewed")).toBe(false);
  });

  it("priority controls which token wins a tie and is applied last", () => {
    const cfg: VariationConfig = {
      FAMILIES: { F: { dims: { d: { a: 0.5, b: 0.9 } }, defaults: { d: "a" } } },
      TOKENS: { F: { x: { d: "a" }, y: { d: "b", priority: 10 } } },
    };
    expect(resolveNote("F", "x y", cfg).vec.d).toBe("b");
    expect(resolveNote("F", "x y", cfg).scalar).toBe(0.9);
  });

  it("unknown family is a no-op scalar 1 with a flag", () => {
    const res = resolveNote("NOPE", "wall", SPEC);
    expect(res.scalar).toBe(1);
    expect(res.flags[0]!.type).toBe("unknown_family");
  });
});

describe("matchTokens", () => {
  const table = SPEC.TOKENS.HSPU!;

  it("is case-insensitive and whitespace-normalised", () => {
    expect(matchTokens("  WALL  ", table).matched.map((m) => m.phrase)).toEqual(["wall"]);
    expect(normalizeNote("  A   B ")).toBe("a b");
  });

  it("consumes spans so a substring token can't re-match", () => {
    const res = matchTokens("guma heavy", table);
    expect(res.matched.map((m) => m.phrase)).toEqual(["guma heavy"]);
    expect(res.fragments).toHaveLength(0);
  });

  it("respects word boundaries (no match inside a longer word)", () => {
    expect(matchTokens("gumastas", table).matched).toHaveLength(0);
  });

  it("returns leftover fragments for unmatched words", () => {
    const res = matchTokens("wall plus something", table);
    expect(res.matched.map((m) => m.phrase)).toContain("wall");
    expect(res.fragments).toEqual(["plus", "something"]);
  });
});

describe("live HSPU config (variationConfig.ts) on real notes", () => {
  it("maps the handstand push-up family", () => {
    expect(familyOf("Handstand Push Ups")).toBe("HSPU");
  });

  it("resolves real logged notes into setups (numbers are placeholders)", () => {
    // "15cm + yoga block" is peeled to "+ yoga block" upstream.
    const yoga = resolveNote("HSPU", "+ yoga block", DEFAULT_VARIATION_CONFIG);
    expect(yoga.vec.support).toBe("back_to_wall");
    expect(yoga.vec.rom).toBe("+15cm"); // range of motion is now in cm
    // "uninterupted no wall" → conflict on support (yoga implies wall? no — just
    // the explicit "no wall" applies), continuity uninterrupted.
    const uninterrupted = resolveNote("HSPU", "uninterupted", DEFAULT_VARIATION_CONFIG);
    expect(uninterrupted.vec.continuity).toBe("uninterrupted");
    // a band token — bands are now numbered 1–6 ("guma 5" ⇒ band "5")
    expect(resolveNote("HSPU", "guma 5", DEFAULT_VARIATION_CONFIG).vec.band).toBe("5");
    // Legs and ladder rungs now resolve to the LADDER support plus a sub-dimension:
    // a leg grip (l-sit / hooked) and a rung height (lad3…lad9).
    const lsit = resolveNote("HSPU", "l sit", DEFAULT_VARIATION_CONFIG);
    expect(lsit.vec.support).toBe("ladder");
    expect(lsit.vec.ladderGrip).toBe("lsit");
    const lad5 = resolveNote("HSPU", "lad5", DEFAULT_VARIATION_CONFIG);
    expect(lad5.vec.support).toBe("ladder");
    expect(lad5.vec.ladderH).toBe("lad5");
  });
});
