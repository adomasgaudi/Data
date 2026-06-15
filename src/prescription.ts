/**
 * COACH PRESCRIPTION CALCULATORS — pure, tested working-weight & warmup maths.
 *
 * Part of the `#CEO` "coach as primary user" work (see
 * docs/ceo/coach-primary-user.md, Phase 3). The coach works one client at a
 * time and needs two concrete numbers per lift:
 *   1. the WORKING (hard-set) weight, and
 *   2. a WARMUP ramp up to it.
 *
 * Both are derived from the client's estimated 1RM via the SAME 1RM curve the
 * rest of the app trusts (metrics.ts: weightForReps / repsForWeight) — this
 * module adds NO new strength model, only prescription logic on top. Everything
 * here is pure and unit/property-tested, because a wrong warmup or load is a
 * systematic coaching error.
 */
import { weightForReps, repsForWeight, type OneRepMaxFormula } from "./metrics";

/** Round a load to the gym's smallest loadable step (default 2.5 kg). A
 * non-positive increment means "don't round". */
export function roundToIncrement(weightKg: number, increment = 2.5): number {
  if (!(increment > 0)) return weightKg;
  return Math.round(weightKg / increment) * increment;
}

/**
 * How the coach defines a hard set (owner: BOTH, switchable per exercise):
 *   • repsRIR — target `reps` stopping `rir` reps short of failure (e.g. 5 @ RIR 2).
 *   • pct     — a straight % of the estimated 1RM (e.g. 85%).
 */
export type HardSetTarget =
  | { kind: "repsRIR"; reps: number; rir: number }
  | { kind: "pct"; pct: number };

export interface HardSet {
  /** The prescribed working load, rounded to the loadable increment. */
  weightKg: number;
  /** Target reps for the work set. */
  reps: number;
  /** Reps in reserve (repsRIR mode); null in %1RM mode. */
  rir: number | null;
  /** The working load as a % of the 1RM (1 dp), for display/sanity. */
  pctOf1RM: number;
}

/**
 * The working weight for a hard set, from the client's estimated 1RM.
 *   • repsRIR: stopping `rir` short of failure means the set COULD go
 *     `reps + rir` to failure, so the load is weightForReps(1RM, reps+rir).
 *   • pct: load = 1RM × pct/100; the reps shown are what the curve predicts at
 *     that load.
 * Returns null on missing/invalid 1RM or target.
 */
export function hardSetWeight(
  oneRepMax: number | null,
  target: HardSetTarget,
  formula: OneRepMaxFormula = "epley",
  increment = 2.5,
): HardSet | null {
  if (oneRepMax === null || !(oneRepMax > 0)) return null;

  if (target.kind === "pct") {
    if (!(target.pct > 0)) return null;
    const weightKg = roundToIncrement((oneRepMax * target.pct) / 100, increment);
    if (!(weightKg > 0)) return null;
    const predicted = repsForWeight(oneRepMax, weightKg, formula);
    return {
      weightKg,
      reps: predicted === null ? 1 : Math.max(1, Math.round(predicted)),
      rir: null,
      pctOf1RM: Math.round((weightKg / oneRepMax) * 1000) / 10,
    };
  }

  // repsRIR
  if (!(target.reps > 0) || !(target.rir >= 0)) return null;
  const failureReps = target.reps + target.rir;
  const raw = weightForReps(oneRepMax, failureReps, formula);
  if (raw === null || !(raw > 0)) return null;
  const weightKg = roundToIncrement(raw, increment);
  if (!(weightKg > 0)) return null;
  return {
    weightKg,
    reps: target.reps,
    rir: target.rir,
    pctOf1RM: Math.round((weightKg / oneRepMax) * 1000) / 10,
  };
}

/** Warm-up scheme (owner): quick (2 sets) · standard (4) · heavy / pyramid (6). */
export type WarmupPlan = "quick" | "standard" | "heavy";
export const WARMUP_PLANS: WarmupPlan[] = ["quick", "standard", "heavy"];
export const WARMUP_PLAN_SETS: Record<WarmupPlan, number> = { quick: 2, standard: 4, heavy: 6 };

export interface WarmupSet {
  /** "general" = light high-rep primer (<60% 1RM); "ramp" = grooving set toward the load. */
  kind: "general" | "ramp";
  /** This set's load as a % of 1RM (whole number). */
  pctOf1RM: number;
  /** Exact (unrounded) target = 1RM × pct, 1 dp — shown small/grey. */
  exactKg: number;
  /** Exact rounded to the NEAREST loadable increment — the headline weight. */
  weightKg: number;
  /** Exact rounded DOWN / UP to the increment — a small load range to pick within. */
  downKg: number;
  upKg: number;
  reps: number;
}

export interface WarmupOptions {
  oneRepMax: number;
  workingWeightKg: number;
  formula?: OneRepMaxFormula;
  increment?: number;
  plan?: WarmupPlan;
}

/**
 * The number of RAMP sets between 60% and the working weight. Owner: "the
 * heavier, the more warmup sets (pyramid)" — so it scales with intensity
 * (working weight ÷ 1RM): ~60% → 1 set, rising to a cap of 6 near a true max.
 */
export function rampSetCount(intensity: number): number {
  const n = Math.round((intensity - 0.6) / 0.1) + 1;
  return Math.max(1, Math.min(6, n));
}

/**
 * A warmup ramp up to a working weight, per the owner's scheme:
 *   • General: 30–60% of working weight, 10–20 reps (light primer).
 *   • Ramp: from 60% up to ~90% of working weight, each set doing ⅓ of the reps
 *     the client COULD do at that load (⅓ of predicted max reps) — submaximal
 *     grooving, never to failure.
 *   • Pyramid: heavier working weight → more ramp sets (see rampSetCount).
 * The working weight itself is the WORK set and is not included here.
 * Weights are rounded to the loadable increment, kept strictly increasing and
 * below the working weight. Returns [] on invalid input.
 */
export function warmupRamp(opts: WarmupOptions): WarmupSet[] {
  const { oneRepMax, workingWeightKg } = opts;
  const formula = opts.formula ?? "epley";
  const increment = opts.increment ?? 2.5;
  const plan = opts.plan ?? "standard";
  if (!(oneRepMax > 0) || !(workingWeightKg > 0)) return [];

  // Warm-up sets are % of 1RM (owner), spanning ~40% up to just below the work set; the
  // set COUNT comes from the plan, reps ≈ ⅓ of what's achievable at that load (grooving).
  const workPct = workingWeightKg / oneRepMax;
  const floorPct = 0.4;
  const topPct = Math.min(0.9, workPct - 0.05); // a touch below the work set, capped at 90%
  const n = WARMUP_PLAN_SETS[plan];
  const sets: WarmupSet[] = [];
  let lastKg = 0;
  for (let i = 0; i < n; i++) {
    const pct = topPct <= floorPct ? floorPct : floorPct + (topPct - floorPct) * (i / Math.max(1, n - 1));
    const exactKg = oneRepMax * pct;
    const weightKg = roundToIncrement(exactKg, increment);
    // Keep strictly increasing and strictly below the working weight.
    if (weightKg <= lastKg || weightKg >= workingWeightKg) continue;
    const achievable = repsForWeight(oneRepMax, weightKg, formula);
    sets.push({
      kind: pct < 0.6 ? "general" : "ramp",
      pctOf1RM: Math.round(pct * 100),
      exactKg: Math.round(exactKg * 10) / 10,
      weightKg,
      downKg: Math.round(Math.floor(exactKg / increment) * increment * 100) / 100,
      upKg: Math.round(Math.ceil(exactKg / increment) * increment * 100) / 100,
      reps: achievable === null ? 8 : Math.max(1, Math.round(achievable / 3)),
    });
    lastKg = weightKg;
  }
  return sets;
}
