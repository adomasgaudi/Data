import { describe, it, expect } from "vitest";
import { FREQ_TIERS, frequencyTier } from "./frequencyTier";

describe("frequencyTier", () => {
  it("classifies set counts into S/A/B/C/D", () => {
    expect(frequencyTier(40)?.tier).toBe("S");
    expect(frequencyTier(25)?.tier).toBe("S"); // boundary
    expect(frequencyTier(24)?.tier).toBe("A");
    expect(frequencyTier(15)?.tier).toBe("A");
    expect(frequencyTier(14)?.tier).toBe("B");
    expect(frequencyTier(8)?.tier).toBe("B");
    expect(frequencyTier(7)?.tier).toBe("C");
    expect(frequencyTier(3)?.tier).toBe("C");
    expect(frequencyTier(2)?.tier).toBe("D");
    expect(frequencyTier(1)?.tier).toBe("D");
  });
  it("returns null below the lowest threshold", () => {
    expect(frequencyTier(0)).toBeNull();
    expect(frequencyTier(-5)).toBeNull();
  });
  it("tiers are ordered high→low so the first match wins", () => {
    const mins = FREQ_TIERS.map((t) => t.min);
    expect(mins).toEqual([...mins].sort((a, b) => b - a));
  });
});
