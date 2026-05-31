import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { epley1RM, brzycki1RM, setVolume, effectiveLoad } from "./metrics";

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

describe("effectiveLoad", () => {
  it("adds the bodyweight fraction to the added weight", () => {
    // Pull-up at coeff 0.95, 80 kg bodyweight, +10 kg belt → 0.95*80 + 10 = 86
    expect(effectiveLoad(10, 80, 0.95)).toBeCloseTo(86, 6);
    // Squat coeff 0.6, 100 kg bw, 140 kg bar → 60 + 140 = 200
    expect(effectiveLoad(140, 100, 0.6)).toBeCloseTo(200, 6);
  });
  it("treats a bodyweight-only set (no added weight) as just the bodyweight part", () => {
    expect(effectiveLoad(null, 80, 1)).toBeCloseTo(80, 6);
  });
  it("passes the added weight through unchanged when coeff <= 0", () => {
    expect(effectiveLoad(100, 80, 0)).toBe(100);
    expect(effectiveLoad(null, 80, 0)).toBeNull(); // stays null → filtered out as before
  });
  it("contributes nothing for the body part when bodyweight is unknown", () => {
    expect(effectiveLoad(20, null, 0.95)).toBeCloseTo(20, 6);
  });
});
