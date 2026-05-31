import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { epley1RM, brzycki1RM, setVolume } from "./metrics";

describe("epley1RM", () => {
  it("returns the weight itself for a single rep", () => {
    expect(epley1RM(100, 1)).toBe(100);
  });

  it("matches hand-computed reference values", () => {
    // 100 * (1 + 10/30) = 133.333...
    expect(epley1RM(100, 10)).toBeCloseTo(133.3333, 4);
    // 60 * (1 + 5/30) = 70
    expect(epley1RM(60, 5)).toBeCloseTo(70, 6);
  });

  it("is null for missing or non-positive inputs", () => {
    expect(epley1RM(null, 5)).toBeNull();
    expect(epley1RM(100, null)).toBeNull();
    expect(epley1RM(0, 5)).toBeNull();
    expect(epley1RM(100, 0)).toBeNull();
    expect(epley1RM(-20, 5)).toBeNull();
  });

  it("is monotonic: more reps at fixed weight => higher estimate", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 500, noNaN: true }),
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 30 }),
        (w, r1, r2) => {
          const a = epley1RM(w, r1)!;
          const b = epley1RM(w, r2)!;
          if (r1 < r2) return a <= b;
          if (r1 > r2) return a >= b;
          return a === b;
        },
      ),
    );
  });

  it("never estimates below the weight actually lifted", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 500, noNaN: true }),
        fc.integer({ min: 1, max: 50 }),
        (w, r) => epley1RM(w, r)! >= w - 1e-9,
      ),
    );
  });
});

describe("brzycki1RM", () => {
  it("returns the weight itself for a single rep", () => {
    expect(brzycki1RM(100, 1)).toBe(100);
  });

  it("matches a hand-computed reference value", () => {
    // 100 * 36 / (37 - 10) = 3600/27 = 133.333...
    expect(brzycki1RM(100, 10)).toBeCloseTo(133.3333, 4);
  });

  it("is null at or above 37 reps (formula breaks down)", () => {
    expect(brzycki1RM(100, 37)).toBeNull();
    expect(brzycki1RM(100, 40)).toBeNull();
  });
});

describe("setVolume", () => {
  it("multiplies weight by reps", () => {
    expect(setVolume(100, 5)).toBe(500);
  });
  it("is null when either input is missing", () => {
    expect(setVolume(null, 5)).toBeNull();
    expect(setVolume(100, null)).toBeNull();
  });
});
