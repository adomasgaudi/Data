import { describe, it, expect } from "vitest";
import { harmoniousColor, seriesPaletteColor } from "./analyticsGraph";

describe("harmoniousColor (colour theory for 3+ series)", () => {
  it("keeps the signature fixed palette for 1–2 series", () => {
    expect(harmoniousColor(0, 1)).toBe(seriesPaletteColor(0));
    expect(harmoniousColor(0, 2)).toBe(seriesPaletteColor(0));
    expect(harmoniousColor(1, 2)).toBe(seriesPaletteColor(1));
  });

  it("generates valid, distinct hex colours for 3+ series", () => {
    for (const n of [3, 4, 6, 10]) {
      const cols = Array.from({ length: n }, (_, i) => harmoniousColor(i, n));
      for (const c of cols) expect(c, `n=${n}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(new Set(cols).size, `n=${n} all distinct`).toBe(n); // evenly-spaced hues never collide
    }
  });

  it("spaces hues evenly (the 1st and the wrap-around stay apart)", () => {
    // With 3 series the hues are 120° apart, so no two share a colour.
    const [a, b, c] = [harmoniousColor(0, 3), harmoniousColor(1, 3), harmoniousColor(2, 3)];
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
