import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  epley1RM,
  brzycki1RM,
  setVolume,
  effectiveLoad,
  benchRepsAtPct,
  benchPctForReps,
  nuzzo1RM,
  nuzzoWeightForReps,
  nuzzoRepsAtWeight,
  estimate1RM,
  linearFit,
} from "./metrics";

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

describe("linearFit", () => {
  it("recovers the slope and intercept of a clean line", () => {
    // y = 2x + 5
    const fit = linearFit([
      { x: 0, y: 5 },
      { x: 1, y: 7 },
      { x: 2, y: 9 },
      { x: 3, y: 11 },
    ])!;
    expect(fit.slope).toBeCloseTo(2, 6);
    expect(fit.intercept).toBeCloseTo(5, 6);
  });
  it("is null with too few points or vertical data", () => {
    expect(linearFit([{ x: 1, y: 1 }])).toBeNull();
    expect(linearFit([{ x: 3, y: 1 }, { x: 3, y: 9 }])).toBeNull();
  });
  it("reads a positive progression slope from an upward trend", () => {
    const fit = linearFit([{ x: 0, y: 100 }, { x: 7, y: 105 }, { x: 14, y: 112 }])!;
    expect(fit.slope).toBeGreaterThan(0);
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

describe("Nuzzo bench curve", () => {
  it("reproduces the study's bench point estimates within rounding", () => {
    // Published bench-press means: 70% ≈ 14, 80% ≈ 9, 90% ≈ 4 (Nuzzo et al.).
    expect(benchRepsAtPct(70)).toBeCloseTo(13.8, 1);
    expect(benchRepsAtPct(80)).toBeCloseTo(8.3, 1);
    expect(benchRepsAtPct(90)).toBeCloseTo(4.2, 1);
    expect(benchRepsAtPct(50)).toBeCloseTo(28.6, 1);
  });

  it("benchRepsAtPct is monotonic: heavier load => fewer reps", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 15, max: 100 }),
        fc.integer({ min: 15, max: 100 }),
        (p1, p2) => {
          const r1 = benchRepsAtPct(p1);
          const r2 = benchRepsAtPct(p2);
          if (p1 < p2) return r1 >= r2 - 1e-9;
          if (p1 > p2) return r1 <= r2 + 1e-9;
          return Math.abs(r1 - r2) < 1e-9;
        },
      ),
    );
  });

  it("benchPctForReps inverts benchRepsAtPct (round-trip)", () => {
    for (const reps of [2, 3, 5, 8, 12, 20]) {
      const pct = benchPctForReps(reps);
      expect(benchRepsAtPct(pct)).toBeCloseTo(reps, 3);
    }
  });

  it("benchPctForReps never exceeds 100% and a single is the 1RM", () => {
    expect(benchPctForReps(1)).toBe(100);
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 300 }), (r) => {
        const pct = benchPctForReps(r);
        return pct <= 100 && pct >= 5;
      }),
    );
  });

  it("nuzzo1RM returns the weight itself for a single rep", () => {
    expect(nuzzo1RM(100, 1)).toBe(100);
  });

  it("nuzzo1RM grows with reps and never dips below the weight lifted", () => {
    expect(nuzzo1RM(100, 5)!).toBeGreaterThan(100);
    expect(nuzzo1RM(100, 10)!).toBeGreaterThan(nuzzo1RM(100, 5)!);
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 500, noNaN: true }),
        fc.integer({ min: 1, max: 30 }),
        (w, r) => nuzzo1RM(w, r)! >= w - 1e-9,
      ),
    );
  });

  it("nuzzo1RM is more conservative than Epley on bench (fewer reps per %1RM)", () => {
    for (const reps of [3, 5, 8, 10]) {
      expect(nuzzo1RM(100, reps)!).toBeLessThan(epley1RM(100, reps)!);
    }
  });

  it("nuzzoWeightForReps is the inverse of nuzzo1RM", () => {
    // Lift X for r reps → estimate a 1RM → that 1RM should give back X at r reps.
    for (const reps of [2, 4, 6, 10]) {
      const oneRm = nuzzo1RM(100, reps)!;
      expect(nuzzoWeightForReps(oneRm, reps)!).toBeCloseTo(100, 6);
    }
    expect(nuzzoWeightForReps(120, 1)).toBeCloseTo(120, 6); // a single is the full 1RM
  });

  it("nuzzoRepsAtWeight reads the curve back at a given load", () => {
    // 80% of a 100 kg 1RM (80 kg) should predict ~8-9 bench reps.
    expect(nuzzoRepsAtWeight(80, 100)!).toBeCloseTo(benchRepsAtPct(80), 6);
    expect(nuzzoRepsAtWeight(100, 100)).toBe(1); // at the 1RM it's a single
    expect(nuzzoRepsAtWeight(110, 100)).toBe(1); // above the 1RM, still a single
  });

  it("estimate1RM routes the 'nuzzo' formula to nuzzo1RM", () => {
    expect(estimate1RM(100, 5, "nuzzo")).toBe(nuzzo1RM(100, 5));
    expect(estimate1RM(100, 5, "epley")).toBe(epley1RM(100, 5));
  });

  it("is null for missing or non-positive inputs", () => {
    expect(nuzzo1RM(null, 5)).toBeNull();
    expect(nuzzo1RM(100, null)).toBeNull();
    expect(nuzzo1RM(0, 5)).toBeNull();
    expect(nuzzoWeightForReps(null, 5)).toBeNull();
    expect(nuzzoRepsAtWeight(80, null)).toBeNull();
  });
});
