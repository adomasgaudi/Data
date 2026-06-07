import { describe, it, expect } from "vitest";
import { hslToHex, hashHueHex, cellBgColor, heatLevel, cellBgGradient } from "./colorScale";

describe("cellBgGradient — multi-category cells", () => {
  it("one (or zero) segments → a solid colour, not a gradient", () => {
    expect(cellBgGradient(3, [{ hex: "#1e4fa3", frac: 1 }])).toBe(cellBgColor(3, "#1e4fa3"));
    expect(cellBgGradient(3, [])).toBe(cellBgColor(3, null));
  });
  it("two equal segments → a 50/50 hard-stop gradient", () => {
    const g = cellBgGradient(3, [{ hex: "#1e4fa3", frac: 1 }, { hex: "#b8902f", frac: 1 }]);
    expect(g).toBe(`linear-gradient(90deg, ${cellBgColor(3, "#1e4fa3")} 0% 50%, ${cellBgColor(3, "#b8902f")} 50% 100%)`);
  });
  it("fractions are laid out cumulatively and normalised", () => {
    const g = cellBgGradient(2, [{ hex: "#111111", frac: 3 }, { hex: "#222222", frac: 1 }]);
    expect(g).toContain(" 0% 75%"); // 3 of 4
    expect(g).toContain(" 75% 100%");
  });
  it("level 0 is empty; level 5 stays a single shining colour (never split)", () => {
    expect(cellBgGradient(0, [{ hex: "#111", frac: 1 }, { hex: "#222", frac: 1 }])).toBe("");
    expect(cellBgGradient(5, [{ hex: "#111", frac: 1 }, { hex: "#222", frac: 1 }])).toBe(cellBgColor(5, "#111"));
  });
});

describe("hslToHex", () => {
  it("maps the primary hues", () => {
    expect(hslToHex(0, 100, 50)).toBe("#ff0000");   // red
    expect(hslToHex(120, 100, 50)).toBe("#00ff00");  // green
    expect(hslToHex(240, 100, 50)).toBe("#0000ff");  // blue
  });
  it("greys out at zero saturation", () => {
    expect(hslToHex(0, 0, 50)).toBe("#808080");
  });
});

describe("hashHueHex", () => {
  it("is deterministic and always a 6-digit hex", () => {
    expect(hashHueHex("Squat")).toBe(hashHueHex("Squat"));
    expect(hashHueHex("Squat")).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("gives different strings different colours", () => {
    expect(hashHueHex("Squat")).not.toBe(hashHueHex("Bench Press"));
  });
});

describe("cellBgColor", () => {
  it("is empty for a rest day and gold at the top band", () => {
    expect(cellBgColor(0, null)).toBe("");
    expect(cellBgColor(5, null)).toBe("#f5c800");
    expect(cellBgColor(5, "#123456")).toBe("#f5c800"); // gold regardless of category
  });
  it("tints toward the category hex at low levels", () => {
    expect(cellBgColor(1, null)).toBe("rgb(192,206,229)"); // default blue, t=0.28
  });
  it("darkens the category hex at level 4", () => {
    expect(cellBgColor(4, "#646464")).toBe("rgb(55,55,55)"); // 100*0.55 = 55
  });
});

describe("heatLevel", () => {
  it("buckets a day's set count into 0..5", () => {
    expect(heatLevel(0)).toBe(0);
    expect(heatLevel(1)).toBe(1);
    expect(heatLevel(2)).toBe(2);
    expect(heatLevel(3)).toBe(2);
    expect(heatLevel(4)).toBe(3);
    expect(heatLevel(9)).toBe(3);
    expect(heatLevel(10)).toBe(4);
    expect(heatLevel(19)).toBe(4);
    expect(heatLevel(20)).toBe(5);
    expect(heatLevel(100)).toBe(5);
  });
});
