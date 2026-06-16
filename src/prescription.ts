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
  /** This set's load as a % of 1RM (whole number). For the primer this is the band MIDPOINT
   * (see pctLabel for the displayed 30–60% band). */
  pctOf1RM: number;
  /** Exact (unrounded) target = 1RM × pct, 1 dp — shown small/grey. */
  exactKg: number;
  /** Exact rounded to the NEAREST loadable increment — the headline weight. */
  weightKg: number;
  /** Exact rounded DOWN / UP to the increment — a small load range to pick within. */
  downKg: number;
  upKg: number;
  reps: number;
  /** Display override for the %1RM column — e.g. the primer's "30–60%" band. Falls back
   * to `pctOf1RM%` when absent (the ramp sets, which are precise). */
  pctLabel?: string;
  /** Display override for the reps column — e.g. the primer's "10–20". Falls back to
   * `reps` when absent. */
  repsLabel?: string;
}

export interface WarmupOptions {
  oneRepMax: number;
  workingWeightKg: number;
  formula?: OneRepMaxFormula;
  increment?: number;
  plan?: WarmupPlan;
  /** Bodyweight share of the load (coeff × bodyweight) for a calisthenics lift, in kg.
   * Default 0 (a plain barbell lift). When > 0 the ramp runs on the EFFECTIVE load
   * (added + bodyweight, always positive) and each row's displayed ADDED weight is the
   * effective load minus this share — so an ASSISTED lift (negative added weight) gets a
   * real warm-up instead of an empty one, and the assistance eases off toward the work set. */
  bodyweightLoad?: number;
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
 *   • ONE light PRIMER: 30–60% of 1RM, 10–20 reps — shown as a BAND (a primer is
 *     flexible, not a precise load), so its row reads "30–60%" / "× 10–20".
 *   • RAMP sets: 60% up to ~90% of 1RM, each doing ⅓ of the reps the client COULD
 *     do at that load (⅓ of predicted max reps) — submaximal grooving, never to
 *     failure. Precise loads (their %1RM and reps are concrete numbers).
 *   • Pyramid: a heavier PLAN adds more ramp steps (the plan's total set count,
 *     minus the one primer).
 * The working weight itself is the WORK set and is not included here.
 * Weights are rounded to the loadable increment, kept strictly increasing and
 * below the working weight. Returns [] on invalid input.
 */
export function warmupRamp(opts: WarmupOptions): WarmupSet[] {
  const formula = opts.formula ?? "epley";
  const increment = opts.increment ?? 2.5;
  const plan = opts.plan ?? "standard";
  // Ramp in EFFECTIVE-load terms so a calisthenics lift works even when the ADDED weight
  // is negative (assisted). bwl = 0 for a barbell lift, making eff* identical to the
  // added values below — so plain lifts are byte-for-byte unchanged. The %1RM and the
  // strictly-increasing/just-below-work checks all run on the (always-positive) effective
  // load; only the DISPLAYED weightKg is peeled back to the added weight (eff − bwl).
  const bwl = opts.bodyweightLoad ?? 0;
  const eff1rm = opts.oneRepMax + bwl;
  const effWork = opts.workingWeightKg + bwl;
  if (!(eff1rm > 0) || !(effWork > 0)) return [];

  const workPct = effWork / eff1rm;
  const n = WARMUP_PLAN_SETS[plan];
  const sets: WarmupSet[] = [];
  const eps = increment * 1e-6;
  // The DISPLAYED ADDED-weight plate-rounding band (down/up to the increment) at a %1RM.
  // Rounds the ADDED (loadable bar) weight, not the effective load — so a non-plate
  // bodyweight share (e.g. 0.6×97.1) still yields real plate weights. For a barbell lift
  // (bwl=0) the added weight equals the effective load.
  const band = (pct: number) => {
    const added = eff1rm * pct - bwl;
    return {
      down: Math.round(Math.floor(added / increment + eps) * increment * 100) / 100,
      up: Math.round(Math.ceil(added / increment - eps) * increment * 100) / 100,
    };
  };

  // 1) LIGHT PRIMER (owner): a flexible 30–60% / 10–20-rep set, shown as BANDS — a primer
  //    is "just do some light high-rep reps", not a spuriously precise single load. Clamped
  //    strictly below the work set so even a light work day still gets a lighter primer.
  const pHiPct = Math.max(0.1, Math.min(0.6, workPct - 0.07));
  const pLoPct = Math.max(0.05, Math.min(0.3, pHiPct - 0.05));
  const pMidPct = (pLoPct + pHiPct) / 2;
  const pMidEff = roundToIncrement(eff1rm * pMidPct, increment); // effective load, for ordering
  sets.push({
    kind: "general",
    pctOf1RM: Math.round(pMidPct * 100),
    exactKg: Math.round((eff1rm * pMidPct - bwl) * 10) / 10,
    weightKg: roundToIncrement(eff1rm * pMidPct - bwl, increment),
    downKg: band(pLoPct).down,
    upKg: band(pHiPct).up,
    reps: 15, // representative; the column shows the 10–20 band
    pctLabel: `${Math.round(pLoPct * 100)}–${Math.round(pHiPct * 100)}%`,
    repsLabel: "10–20",
  });

  // 2) RAMP SETS (owner): from 60% up to just below the work set, each doing ⅓ of the reps
  //    you COULD hit at that load (submaximal grooving, never to failure). Count = the plan
  //    total minus the one primer, so heavier plans add more ramp steps (pyramid). Kept
  //    strictly increasing and below the work set; degenerate light-work cases self-trim.
  const rampN = Math.max(1, n - 1);
  const rampFloor = 0.6;
  const rampTop = Math.min(0.9, workPct - 0.05); // a touch below the work set, capped at 90%
  let lastEff = pMidEff; // ramps must climb above the primer
  for (let i = 0; i < rampN; i++) {
    const pct = rampTop <= rampFloor ? rampFloor : rampFloor + (rampTop - rampFloor) * (rampN === 1 ? 1 : i / (rampN - 1));
    const exactEff = eff1rm * pct;
    const effRounded = roundToIncrement(exactEff, increment);
    if (effRounded <= lastEff || effRounded >= effWork) continue; // strictly increasing, below work
    const achievable = repsForWeight(eff1rm, effRounded, formula);
    const b = band(pct);
    sets.push({
      kind: "ramp",
      pctOf1RM: Math.round(pct * 100),
      exactKg: Math.round((exactEff - bwl) * 10) / 10,
      weightKg: roundToIncrement(exactEff - bwl, increment),
      downKg: b.down,
      upKg: b.up,
      reps: achievable === null ? 8 : Math.max(1, Math.round(achievable / 3)),
    });
    lastEff = effRounded;
  }
  return sets;
}
