import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  epley1RM,
  brzycki1RM,
  effortClass,
  setVolume,
  effectiveLoad,
  benchRepsAtPct,
  benchPctForReps,
  BENCH_REPS_STUDY,
  nuzzo1RM,
  nuzzoWeightForReps,
  nuzzoRepsAtWeight,
  nuzzoRepMaxes,
  bestFitNuzzo1RM,
  estimate1RM,
  weightForReps,
  repsForWeight,
  predictedRir,
  linearFit,
  strengthRetention,
  grownStability,
  daysBetweenIso,
  STRENGTH_DECAY,
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

describe("effortClass", () => {
  it("classifies hard / mid / warmup by RIR, with a wider mid band for big legs", () => {
    // < 3 RIR is always hard
    expect(effortClass(0, false)).toBe("hard");
    expect(effortClass(2.9, true)).toBe("hard");
    // 3 up to the mid ceiling is mid (6 other muscles, 8 big legs)
    expect(effortClass(3, false)).toBe("mid");
    expect(effortClass(5.9, false)).toBe("mid");
    expect(effortClass(6, false)).toBe("warmup"); // other muscles tip to warmup at 6
    expect(effortClass(6, true)).toBe("mid"); // big legs still mid at 6
    expect(effortClass(7.9, true)).toBe("mid");
    expect(effortClass(8, true)).toBe("warmup"); // big legs tip to warmup at 8
  });
  it("treats a non-finite RIR as a warmup (no effort signal)", () => {
    expect(effortClass(NaN, false)).toBe("warmup");
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

  it("the plotted study points stay close to the fitted curve (R² ~ 1)", () => {
    // BENCH_REPS_STUDY is what the calculator + explainer graphs plot as dots;
    // the curve (benchRepsAtPct) is the line through them. They must not drift:
    // every published point sits within ~12% of the curve, and the fit is tight.
    let ssRes = 0, ssTot = 0;
    const mean = BENCH_REPS_STUDY.reduce((a, [, r]) => a + r, 0) / BENCH_REPS_STUDY.length;
    for (const [pct, reps] of BENCH_REPS_STUDY) {
      const pred = benchRepsAtPct(pct);
      expect(Math.abs(pred - reps) / reps).toBeLessThan(0.12);
      ssRes += (reps - pred) ** 2;
      ssTot += (reps - mean) ** 2;
    }
    expect(1 - ssRes / ssTot).toBeGreaterThan(0.99);
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

  it("benchPctForReps stays within the study range (15%–100%), a single = 1RM", () => {
    expect(benchPctForReps(1)).toBe(100);
    expect(benchPctForReps(1000)).toBe(15); // very high reps clamp to the 15% floor
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 300 }), (r) => {
        const pct = benchPctForReps(r);
        return pct <= 100 && pct >= 15;
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

  it("nuzzoRepMaxes keeps the heaviest weight per rep, drops junk + out-of-range", () => {
    const out = nuzzoRepMaxes([
      { weight: 100, reps: 5 }, { weight: 110, reps: 5 }, { weight: 90, reps: 5 }, // 5-rep best = 110
      { weight: 120, reps: 3 }, { weight: 60, reps: 12 }, { weight: 22, reps: 30 }, // 30-rep set kept (PB fix)
      { weight: 0, reps: 4 }, { weight: 50, reps: null }, { weight: null, reps: 2 }, // junk dropped
      { weight: 40, reps: 75 }, // past the 60-rep cap → dropped
    ]);
    expect(out).toEqual([
      { reps: 3, weight: 120 }, { reps: 5, weight: 110 }, { reps: 12, weight: 60 }, { reps: 30, weight: 22 },
    ]);
    expect(nuzzoRepMaxes([])).toEqual([]);
  });

  it("bestFitNuzzo1RM recovers the 1RM that put points exactly on the curve", () => {
    // Build rep-maxes FROM a known 1RM via the curve → the fit must return that 1RM.
    const trueOrm = 140;
    const repMaxes = [3, 5, 8, 12].map((reps) => ({ reps, weight: nuzzoWeightForReps(trueOrm, reps)! }));
    expect(bestFitNuzzo1RM(repMaxes)!).toBeCloseTo(trueOrm, 4);
    expect(bestFitNuzzo1RM([])).toBeNull();
  });
});

describe("weightForReps", () => {
  it("inverts Epley: a single is the 1RM, more reps means lighter", () => {
    expect(weightForReps(100, 1, "epley")).toBe(100);
    // Epley 1RM of 100 kg → 5RM is 100 / (1 + 5/30) = 85.714…
    expect(weightForReps(100, 5, "epley")!).toBeCloseTo(100 / (1 + 5 / 30), 6);
    expect(weightForReps(100, 10, "epley")!).toBeCloseTo(75, 6);
  });

  it("round-trips against estimate1RM for Epley and Brzycki", () => {
    for (const formula of ["epley", "brzycki"] as const) {
      for (const reps of [2, 5, 8, 12, 15]) {
        const w = weightForReps(120, reps, formula)!;
        expect(estimate1RM(w, reps, formula)!).toBeCloseTo(120, 6);
      }
    }
  });

  it("matches the Nuzzo weight curve for the nuzzo formula", () => {
    expect(weightForReps(100, 5, "nuzzo")).toBe(nuzzoWeightForReps(100, 5));
  });

  it("is null for missing, non-positive, or out-of-range inputs", () => {
    expect(weightForReps(null, 5)).toBeNull();
    expect(weightForReps(100, null)).toBeNull();
    expect(weightForReps(0, 5)).toBeNull();
    expect(weightForReps(100, 0)).toBeNull();
    expect(weightForReps(100, 37, "brzycki")).toBeNull(); // Brzycki undefined at 37 reps
  });
});

describe("repsForWeight", () => {
  it("is the round-trip inverse of weightForReps for all formulas", () => {
    for (const formula of ["epley", "brzycki", "nuzzo"] as const) {
      for (const reps of [2, 5, 8, 12, 15]) {
        const w = weightForReps(120, reps, formula)!;
        expect(repsForWeight(120, w, formula)!).toBeCloseTo(reps, 4);
      }
    }
  });

  it("counts more reps as the load drops below the 1RM (Epley)", () => {
    // Epley's continuous inverse: r = 30·(1RM/w − 1). At the 1RM that is 0 extra
    // reps (the discrete 1RM is the r=1 special case in weightForReps), and it
    // climbs smoothly as the load lightens.
    expect(repsForWeight(100, 100, "epley")!).toBeCloseTo(0, 6); // at max
    expect(repsForWeight(100, 75, "epley")!).toBeCloseTo(10, 6); // 30·(100/75−1)=10
    expect(repsForWeight(100, 60, "epley")!).toBeCloseTo(20, 6); // 30·(100/60−1)=20
  });

  it("does NOT clamp: a load above the 1RM goes below 1 rep", () => {
    // Owner chose raw estimates over clamping, so over-max loads read < 1 rep.
    expect(repsForWeight(100, 110, "epley")!).toBeLessThan(1);
  });

  it("is null only for missing or non-positive inputs", () => {
    expect(repsForWeight(null, 80)).toBeNull();
    expect(repsForWeight(100, null)).toBeNull();
    expect(repsForWeight(0, 80)).toBeNull();
    expect(repsForWeight(100, 0)).toBeNull();
  });
});

describe("predictedRir (predicted reps in reserve)", () => {
  it("is predicted reps minus real reps (Epley)", () => {
    // At a 100 kg 1RM, 75 kg predicts 10 reps. Doing 7 leaves ~3 in reserve.
    expect(predictedRir(100, 75, 7, "epley")!).toBeCloseTo(10 - 7, 6);
    expect(predictedRir(100, 60, 12, "epley")!).toBeCloseTo(20 - 12, 6);
  });

  it("is ~0 for a set taken to the predicted max", () => {
    // The set that defines the 1RM has nothing in reserve: real reps ≈ predicted.
    const oneRm = epley1RM(80, 5)!;
    expect(predictedRir(oneRm, 80, 5, "epley")!).toBeCloseTo(0, 6);
  });

  it("goes negative when the lifter beats the prediction (stale 1RM)", () => {
    // 75 kg predicts 10 reps off a 100 kg max; doing 14 means the max is low.
    expect(predictedRir(100, 75, 14, "epley")!).toBeLessThan(0);
  });

  it("is null for missing/non-positive reps or an uncomputable prediction", () => {
    expect(predictedRir(100, 75, null)).toBeNull();
    expect(predictedRir(100, 75, 0)).toBeNull();
    expect(predictedRir(null, 75, 5)).toBeNull();
    expect(predictedRir(100, 0, 5)).toBeNull();
  });
});

describe("strengthRetention (detraining decay)", () => {
  it("loses nothing during the two-week grace period", () => {
    expect(strengthRetention(0)).toBe(1);
    expect(strengthRetention(7)).toBe(1);
    expect(strengthRetention(STRENGTH_DECAY.graceDays)).toBe(1);
    expect(strengthRetention(-5)).toBe(1); // future/oddities never penalised
  });

  it("is about 10% down a month after the grace ends (fresh lift)", () => {
    // baseStability is tuned so a freshly-hit lift keeps ~90% 30 days past grace.
    expect(strengthRetention(44)).toBeCloseTo(0.9, 2);
  });

  it("is aggressive enough for a fresh lift — real loss by 6 months and a year", () => {
    expect(strengthRetention(180)).toBeLessThan(0.78); // >22% gone by ~6 months
    expect(strengthRetention(365)).toBeLessThan(0.68); // >32% gone by ~1 year
  });

  it("is genuinely curved, not linear (drops far faster early than late)", () => {
    const earlyDrop = strengthRetention(44) - strengthRetention(104); // months 1→3 past grace
    const lateDrop = strengthRetention(284) - strengthRetention(344); // a later equal window
    expect(earlyDrop).toBeGreaterThan(lateDrop * 1.8); // early loss ≫ late loss
  });

  it("decelerates: each further month removes less than the month before", () => {
    const oneMonth = strengthRetention(44);
    const twoMonths = strengthRetention(74);
    const threeMonths = strengthRetention(104);
    expect(oneMonth).toBeGreaterThan(twoMonths);
    expect(twoMonths).toBeGreaterThan(threeMonths);
    expect(oneMonth - twoMonths).toBeGreaterThan(twoMonths - threeMonths);
  });

  it("a more durable (trained-up) stability decays SLOWER than a fresh one", () => {
    const trained = grownStability(grownStability(STRENGTH_DECAY.baseStability));
    fc.assert(
      fc.property(fc.double({ min: 30, max: 2000, noNaN: true }), (d) => {
        // Same days off, bigger stability ⇒ at least as much strength kept.
        return strengthRetention(d, trained) >= strengthRetention(d, STRENGTH_DECAY.baseStability) - 1e-12;
      }),
    );
    // …and strictly more somewhere past the grace.
    expect(strengthRetention(120, trained)).toBeGreaterThan(strengthRetention(120));
  });

  it("never decays below the floor", () => {
    expect(strengthRetention(1e9)).toBe(STRENGTH_DECAY.floor);
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        fc.double({ min: 1, max: 5000, noNaN: true }),
        (d, s) => {
          const r = strengthRetention(d, s);
          return r >= STRENGTH_DECAY.floor && r <= 1;
        },
      ),
    );
  });

  it("is non-increasing in days off", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 5000, noNaN: true }),
        fc.double({ min: 0, max: 5000, noNaN: true }),
        (a, b) => {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          return strengthRetention(lo) >= strengthRetention(hi) - 1e-12;
        },
      ),
    );
  });
});

describe("grownStability", () => {
  it("increases stability with each session and caps at maxStability", () => {
    expect(grownStability(STRENGTH_DECAY.baseStability)).toBeGreaterThan(STRENGTH_DECAY.baseStability);
    expect(grownStability(STRENGTH_DECAY.baseStability)).toBeCloseTo(
      STRENGTH_DECAY.baseStability * STRENGTH_DECAY.stabilityGrowth,
      6,
    );
    expect(grownStability(STRENGTH_DECAY.maxStability)).toBe(STRENGTH_DECAY.maxStability);
    expect(grownStability(STRENGTH_DECAY.maxStability * 5)).toBe(STRENGTH_DECAY.maxStability);
  });
});

describe("daysBetweenIso", () => {
  it("counts whole days between ISO dates", () => {
    expect(daysBetweenIso("2024-01-01", "2024-01-01")).toBe(0);
    expect(daysBetweenIso("2024-01-01", "2024-01-15")).toBe(14);
    expect(daysBetweenIso("2024-01-31", "2024-02-01")).toBe(1);
  });

  it("is negative when the second date precedes the first", () => {
    expect(daysBetweenIso("2024-02-01", "2024-01-31")).toBe(-1);
  });

  it("is unaffected by month/year boundaries (UTC midnight)", () => {
    expect(daysBetweenIso("2023-12-31", "2024-01-01")).toBe(1);
    expect(daysBetweenIso("2024-01-01", "2025-01-01")).toBe(366); // 2024 is a leap year
  });

  it("returns 0 for unparseable input", () => {
    expect(daysBetweenIso("nope", "2024-01-01")).toBe(0);
  });
});
