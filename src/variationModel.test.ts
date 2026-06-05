import { describe, it, expect } from "vitest";
import { resolveNote, matchTokens, normalizeNote } from "./variationModel";
import { DEFAULT_VARIATION_CONFIG, FAMILIES, type VariationConfig } from "./variationConfig";

const flagTypes = (note: string) => resolveNote("HSPU", note).flags.map((f) => f.type);

describe("resolveNote (factored variation difficulty)", () => {
  it("a single explicit token sets its dimension", () => {
    expect(resolveNote("HSPU", "wall").scalar).toBe(0.85);
    expect(resolveNote("HSPU", "wall").vec.support).toBe("wall");
  });

  it("an implication sets multiple dimensions (yoga block ⇒ wall too)", () => {
    const r = resolveNote("HSPU", "yoga block");
    expect(r.scalar).toBe(0.595); // 0.70 (rom) × 0.85 (support) × 1 × 1
    expect(r.vec.support).toBe("wall"); // implied even though "wall" wasn't written
    expect(r.vec.rom).toBe("to_block");
  });

  it("an empty note is all-defaults, scalar 1", () => {
    const r = resolveNote("HSPU", "");
    expect(r.scalar).toBe(1);
    expect(r.vec).toEqual(FAMILIES.HSPU!.defaults);
    expect(r.flags).toHaveLength(0);
  });

  it("an unknown token produces an unreviewed flag with the fragments", () => {
    const r = resolveNote("HSPU", "M yoga");
    expect(r.flags.some((f) => f.type === "unreviewed")).toBe(true);
    const frag = r.flags.find((f) => f.type === "unreviewed")!.detail;
    expect(frag).toContain("yoga");
    expect(frag).toContain("m");
  });

  it("longest-match-first: 'guma heavy' beats 'guma'", () => {
    expect(resolveNote("HSPU", "guma heavy").vec.support).toBe("band_heavy");
    expect(resolveNote("HSPU", "guma heavy").scalar).toBe(0.62);
    expect(resolveNote("HSPU", "guma").vec.support).toBe("band_light");
  });

  it("two tokens on one dimension flag a conflict, last-applied wins", () => {
    expect(flagTypes("wall freestanding")).toContain("conflict");
    // both touch `support`; vec keeps one of the two levels, never a default
    expect(["wall", "free"]).toContain(resolveNote("HSPU", "wall freestanding").vec.support);
  });

  it("priority controls which token wins a tie and is applied last", () => {
    const cfg: VariationConfig = {
      FAMILIES: { F: { dims: { d: { a: 0.5, b: 0.9 } }, defaults: { d: "a" } } },
      TOKENS: { F: { x: { d: "a" }, y: { d: "b", priority: 10 } } },
    };
    // y has higher priority → applied last → wins, even though both match.
    expect(resolveNote("F", "x y", cfg).vec.d).toBe("b");
    expect(resolveNote("F", "x y", cfg).scalar).toBe(0.9);
  });

  it("unknown family is a no-op scalar 1 with a flag", () => {
    const r = resolveNote("NOPE", "wall");
    expect(r.scalar).toBe(1);
    expect(r.flags[0]!.type).toBe("unknown_family");
  });

  it("config is external — passing a different config changes the result", () => {
    expect(resolveNote("HSPU", "wall", DEFAULT_VARIATION_CONFIG).scalar).toBe(0.85);
    const cfg: VariationConfig = {
      FAMILIES: { HSPU: { dims: { support: { free: 1, wall: 0.5 } }, defaults: { support: "free" } } },
      TOKENS: { HSPU: { wall: { support: "wall" } } },
    };
    expect(resolveNote("HSPU", "wall", cfg).scalar).toBe(0.5);
  });
});

describe("matchTokens", () => {
  const table = DEFAULT_VARIATION_CONFIG.TOKENS.HSPU!;

  it("is case-insensitive and whitespace-normalised", () => {
    expect(matchTokens("  WALL  ", table).matched.map((m) => m.phrase)).toEqual(["wall"]);
    expect(normalizeNote("  A   B ")).toBe("a b");
  });

  it("consumes spans so a substring token can't re-match", () => {
    const r = matchTokens("guma heavy", table);
    expect(r.matched.map((m) => m.phrase)).toEqual(["guma heavy"]);
    expect(r.fragments).toHaveLength(0);
  });

  it("respects word boundaries (no match inside a longer word)", () => {
    expect(matchTokens("gumastas", table).matched).toHaveLength(0);
  });

  it("returns leftover fragments for unmatched words", () => {
    const r = matchTokens("wall plus something", table);
    expect(r.matched.map((m) => m.phrase)).toContain("wall");
    expect(r.fragments).toEqual(["plus", "something"]);
  });
});
