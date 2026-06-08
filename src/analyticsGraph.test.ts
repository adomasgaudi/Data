import { describe, it, expect } from "vitest";
import { harmoniousColor, seriesPaletteColor } from "./analyticsGraph";

describe("harmoniousColor (blue/gold themed series palette)", () => {
  it("uses the signature blue / gold for the first two series", () => {
    expect(harmoniousColor(0, 1)).toBe(seriesPaletteColor(0));
    expect(harmoniousColor(0, 2)).toBe(seriesPaletteColor(0));
    expect(harmoniousColor(1, 2)).toBe(seriesPaletteColor(1));
  });

  it("gives valid, distinct, on-theme colours across the realistic series range", () => {
    for (const n of [3, 4, 6, 10]) {
      const cols = Array.from({ length: n }, (_, i) => harmoniousColor(i, n));
      for (const c of cols) expect(c, `n=${n}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(new Set(cols).size, `n=${n} all distinct`).toBe(n); // curated palette holds ≥12 distinct
    }
  });

  it("draws from the curated palette (lapis + ochre lead), not a generated rainbow", () => {
    expect(harmoniousColor(2, 3)).toBe(seriesPaletteColor(2)); // 3rd colour = terracotta, on-theme
    expect(seriesPaletteColor(0)).toBe("#284e86"); // lapis blue
    expect(seriesPaletteColor(1)).toBe("#b8902f"); // ochre gold
  });
});
