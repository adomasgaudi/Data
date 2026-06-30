import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  roundToIncrement,
  hardSetWeight,
  warmupRamp,
  rampSetCount,
} from "./prescription";

describe("roundToIncrement", () => {
  it("rounds to the nearest step", () => {
    expect(roundToIncrement(101, 2.5)).toBe(100);
    expect(roundToIncrement(101.3, 2.5)).toBe(102.5);
    expect(roundToIncrement(101.3, 5)).toBe(100);
    expect(roundToIncrement(103, 5)).toBe(105);
  });
  it("does not round when increment is non-positive", () => {
    expect(roundToIncrement(101.3, 0)).toBe(101.3);
    expect(roundToIncrement(101.3, -1)).toBe(101.3);
  });
});

describe("hardSetWeight", () => {
  it("computes a % of 1RM directly", () => {
    const hs = hardSetWeight(100, { kind: "pct", pct: 80 }, "epley", 2.5);
    expect(hs?.weightKg).toBe(80);
    expect(hs?.pctOf1RM).toBe(80);
    expect(hs?.rir).toBeNull();
    // epley reps at 80% of a 100 1RM ≈ 30*(100/80-1) = 7.5 → 8
    expect(hs?.reps).toBe(8);
  });

  it("repsRIR loads from reps+RIR to failure", () => {
    // 5 reps @ RIR 2 ⇒ could do 7 to failure ⇒ epley w = 100/(1+7/30) ≈ 81.1 → 80
    const hs = hardSetWeight(100, { kind: "repsRIR", reps: 5, rir: 2 }, "epley", 2.5);
    expect(hs?.weightKg).toBe(80);
    expect(hs?.reps).toBe(5);
    expect(hs?.rir).toBe(2);
  });

  it("more RIR ⇒ never heavier (submaximal)", () => {
    const low = hardSetWeight(100, { kind: "repsRIR", reps: 5, rir: 1 }, "epley");
    const high = hardSetWeight(100, { kind: "repsRIR", reps: 5, rir: 4 }, "epley");
    expect(high!.weightKg).toBeLessThanOrEqual(low!.weightKg);
  });

  it("rejects invalid input", () => {
    expect(hardSetWeight(null, { kind: "pct", pct: 80 })).toBeNull();
    expect(hardSetWeight(0, { kind: "pct", pct: 80 })).toBeNull();
    expect(hardSetWeight(100, { kind: "pct", pct: 0 })).toBeNull();
    expect(hardSetWeight(100, { kind: "repsRIR", reps: 0, rir: 2 })).toBeNull();
  });

  it("pct mode lands within one increment of the requested %", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 300 }),
        fc.integer({ min: 30, max: 100 }),
        (orm, pct) => {
          const hs = hardSetWeight(orm, { kind: "pct", pct }, "epley", 2.5)!;
          expect(Math.abs(hs.weightKg - (orm * pct) / 100)).toBeLessThanOrEqual(2.5);
        },
      ),
    );
  });
});

describe("rampSetCount (pyramid: heavier ⇒ more sets)", () => {
  it("maps intensity to a sensible count", () => {
    expect(rampSetCount(0.6)).toBe(1);
    expect(rampSetCount(0.7)).toBe(2);
    expect(rampSetCount(0.8)).toBe(3);
    expect(rampSetCount(0.9)).toBe(4);
    expect(rampSetCount(1.0)).toBe(5);
  });
  it("is non-decreasing in intensity and clamped to 1..6", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 0.99, noNaN: true }),
        fc.double({ min: 0.1, max: 0.99, noNaN: true }),
        (a, b) => {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          expect(rampSetCount(lo)).toBeLessThanOrEqual(rampSetCount(hi));
          expect(rampSetCount(a)).toBeGreaterThanOrEqual(1);
          expect(rampSetCount(a)).toBeLessThanOrEqual(6);
        },
      ),
    );
  });
});

describe("warmupRamp", () => {
  it("builds general primers then a ramp, all below the work set", () => {
    const sets = warmupRamp({ oneRepMax: 100, workingWeightKg: 80 });
    expect(sets.length).toBeGreaterThan(0);
    // strictly increasing, all > 0 and < working weight
    for (let i = 0; i < sets.length; i++) {
      expect(sets[i]!.weightKg).toBeGreaterThan(0);
      expect(sets[i]!.weightKg).toBeLessThan(80);
      if (i > 0) expect(sets[i]!.weightKg).toBeGreaterThan(sets[i - 1]!.weightKg);
    }
    expect(sets.some((s) => s.kind === "general")).toBe(true);
    expect(sets.some((s) => s.kind === "ramp")).toBe(true);
  });

  it("heavier working weight yields at least as many ramp sets", () => {
    const light = warmupRamp({ oneRepMax: 100, workingWeightKg: 65 }).filter((s) => s.kind === "ramp");
    const heavy = warmupRamp({ oneRepMax: 100, workingWeightKg: 95 }).filter((s) => s.kind === "ramp");
    expect(heavy.length).toBeGreaterThanOrEqual(light.length);
  });

  it("sets are % of 1RM with a plate-round range; the plan drives the set count", () => {
    const sets = warmupRamp({ oneRepMax: 100, workingWeightKg: 90, increment: 2.5, plan: "standard" });
    expect(sets.length).toBeGreaterThan(0);
    for (const s of sets) {
      expect(s.pctOf1RM).toBeGreaterThanOrEqual(40);
      expect(s.exactKg).toBeGreaterThan(0);
      expect(s.downKg).toBeLessThanOrEqual(s.weightKg);
      expect(s.upKg).toBeGreaterThanOrEqual(s.weightKg);
    }
    const quick = warmupRamp({ oneRepMax: 100, workingWeightKg: 90, plan: "quick" });
    const heavy = warmupRamp({ oneRepMax: 100, workingWeightKg: 90, plan: "heavy" });
    expect(heavy.length).toBeGreaterThan(quick.length);
  });

  it("first set is a light primer shown as a 30–60% / 10–20-rep band with an NRM band", () => {
    const sets = warmupRamp({ oneRepMax: 100, workingWeightKg: 80, plan: "quick" });
    const primer = sets[0]!;
    expect(primer.kind).toBe("general");
    expect(primer.repsLabel).toBe("10–20");
    expect(primer.pctLabel).toBe("30–60%");
    // the band's load range spans ~30%→60% of the 1RM (not a single point)
    expect(primer.upKg).toBeGreaterThan(primer.downKg);
    // the primer carries an NRM BAND (e.g. "20–40") and no single maxReps
    expect(primer.maxRepsLabel).toMatch(/^\d+–\d+$/);
    expect(primer.maxReps).toBeUndefined();
  });

  it("a ramp set reads as a ZONE band: weight, %1RM, NRM and reps all span the zone", () => {
    const sets = warmupRamp({ oneRepMax: 100, workingWeightKg: 80, plan: "quick" });
    const ramp = sets.find((s) => s.kind === "ramp")!;
    // owner: the single ramp step reads "60–80%", not a bare "78%"
    expect(ramp.pctLabel).toMatch(/^\d+–\d+%$/);
    expect(ramp.pctLabel!.startsWith("60–")).toBe(true);
    // the WEIGHT band must match that %1RM zone (owner: "the weight isn't what the % is").
    // For a 100 1RM the band edges equal the zone %s in kg (e.g. 60–75%), plate-rounded —
    // NOT a single ~75% load (which would make down==up).
    const [loPct, hiPct] = ramp.pctLabel!.replace("%", "").split("–").map(Number);
    expect(ramp.downKg).toBeLessThanOrEqual(loPct! + 2.5);
    expect(ramp.upKg).toBeGreaterThanOrEqual(hiPct! - 2.5);
    expect(ramp.upKg).toBeGreaterThan(ramp.downKg); // a real band, not a point
    // reps are a ⅓-of-max BAND (owner: "9–20RM ⇒ 3–6, not just 3"), not a single number
    expect(ramp.repsLabel).toMatch(/^\d+–\d+$/);
    expect(ramp.maxRepsLabel).toMatch(/^\d+–\d+$/);
    expect(ramp.maxReps).toBeGreaterThan(0);
  });

  it("returns [] on invalid input", () => {
    expect(warmupRamp({ oneRepMax: 0, workingWeightKg: 80 })).toEqual([]);
    expect(warmupRamp({ oneRepMax: 100, workingWeightKg: 0 })).toEqual([]);
  });

  it("property: every warmup set is positive, strictly increasing, below the work set", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 40, max: 300 }),
        fc.double({ min: 0.2, max: 0.99, noNaN: true }),
        (orm, frac) => {
          const working = orm * frac;
          const sets = warmupRamp({ oneRepMax: orm, workingWeightKg: working });
          let prev = 0;
          for (const s of sets) {
            expect(s.weightKg).toBeGreaterThan(0);
            expect(s.weightKg).toBeLessThan(working);
            expect(s.weightKg).toBeGreaterThan(prev);
            expect(s.reps).toBeGreaterThanOrEqual(1);
            prev = s.weightKg;
          }
        },
      ),
    );
  });

  it("bodyweightLoad=0 is identical to omitting it (barbell unchanged)", () => {
    const a = warmupRamp({ oneRepMax: 100, workingWeightKg: 80, increment: 2.5, plan: "standard" });
    const b = warmupRamp({ oneRepMax: 100, workingWeightKg: 80, increment: 2.5, plan: "standard", bodyweightLoad: 0 });
    expect(b).toEqual(a);
  });

  it("assisted calisthenics (negative added weight) still gets a warm-up", () => {
    // Dips at -5 kg added, with ~94 kg bodyweight share: the ADDED working weight is
    // negative but the EFFECTIVE load is positive, so the ramp should produce sets.
    const sets = warmupRamp({ oneRepMax: 56, workingWeightKg: -5, bodyweightLoad: 94, increment: 2.5 });
    expect(sets.length).toBeGreaterThan(0);
    // Displayed (added) weights climb toward the work set and stay strictly below it;
    // early sets are MORE assisted (more negative) than the -5 kg work set.
    let prev = -Infinity;
    for (const s of sets) {
      expect(s.weightKg).toBeLessThan(-5);
      expect(s.weightKg).toBeGreaterThan(prev);
      prev = s.weightKg;
    }
    expect(sets[0]!.weightKg).toBeLessThan(0); // first warm-up is assisted
  });

  it("still returns [] when even the effective load is non-positive", () => {
    expect(warmupRamp({ oneRepMax: -10, workingWeightKg: -20, bodyweightLoad: 5 })).toEqual([]);
  });

  it("displayed bar weights are plate-rounded even with a non-plate bodyweight share", () => {
    // Squat: 1RM 151.3 added, work 120, bodyweight share 0.6×97.1 = 58.26 (NOT a plate
    // multiple). Before the fix the effective load was plate-rounded then 58.26 subtracted,
    // giving messy bar weights (24.24–26.74 kg). Now the ADDED weight rounds to the plate.
    const sets = warmupRamp({ oneRepMax: 151.3, workingWeightKg: 120, bodyweightLoad: 58.26, increment: 2.5, plan: "heavy" });
    expect(sets.length).toBeGreaterThan(0);
    const onGrid = (v: number) => expect(Math.abs(v / 2.5 - Math.round(v / 2.5))).toBeLessThan(1e-6);
    for (const s of sets) {
      onGrid(s.weightKg);
      onGrid(s.downKg);
      onGrid(s.upKg);
    }
  });
});
