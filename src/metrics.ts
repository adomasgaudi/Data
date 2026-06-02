/**
 * Per-set strength metrics. Pure, total functions on primitives — the most
 * heavily tested code in the project because formula bugs are *systematic*:
 * get the 1RM formula subtly wrong and every leaderboard is wrong, confidently.
 * Each formula is unit-tested against hand-computed reference values.
 */

/**
 * Estimated one-rep max via the Epley formula: weight * (1 + reps/30).
 * By definition a single rep returns the weight itself.
 * Returns null when the inputs can't define a 1RM (missing or non-positive).
 */
export function epley1RM(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null) return null;
  if (weight <= 0 || reps <= 0) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * Estimated one-rep max via the Brzycki formula: weight * 36 / (37 - reps).
 * Undefined at/above 37 reps (denominator <= 0) — returns null there.
 */
export function brzycki1RM(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null) return null;
  if (weight <= 0 || reps <= 0) return null;
  if (reps === 1) return weight;
  if (reps >= 37) return null;
  return (weight * 36) / (37 - reps);
}

/**
 * Bench-press REPS↔%1RM curve from Nuzzo et al. (2024, Sports Medicine) — the
 * meta-analysis of 962 reps-to-failure tests across 7,289 people. We fit a
 * least-squares cubic to ln(reps) against a centred load t = (%1RM − 55) / 40
 * over the study's published bench-press point estimates (R² = 0.995). Unlike
 * the one-size-fits-all Epley/Brzycki, this is bench-specific and data-derived:
 * people manage *fewer* reps per %1RM on bench, so it yields more conservative
 * 1RMs. The coefficients below are precomputed from those estimates; the values
 * they must reproduce are pinned in metrics.test.ts. The page public/reps-1rm.html
 * visualises the same curve.
 */
const BENCH_LN_REPS_COEFFS = [3.189078334, -1.329509482, -0.232660599, -0.6277241766] as const;
const benchT = (pct: number): number => (pct - 55) / 40;

/** Average bench-press reps to failure at a given % of 1RM (e.g. 70 → ~13.8). */
export function benchRepsAtPct(pct: number): number {
  const t = benchT(pct);
  const [a, b, c, d] = BENCH_LN_REPS_COEFFS;
  return Math.exp(a + b * t + c * t * t + d * t * t * t);
}

/**
 * Inverse of benchRepsAtPct: the % of 1RM that `reps` reps to failure implies on
 * bench. The curve is monotonic, so a bounded bisection pins it down. Clamped to
 * the data's sensible span — about one rep ⇒ 100% (a true single is your 1RM),
 * and very high reps ⇒ the 5% floor — so it never returns a load above 100%.
 */
export function benchPctForReps(reps: number): number {
  if (reps <= benchRepsAtPct(100)) return 100;
  if (reps >= benchRepsAtPct(5)) return 5;
  let lo = 5; // lighter load, more reps
  let hi = 100; // heavier load, fewer reps
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (benchRepsAtPct(mid) > reps) lo = mid; // still too many reps → go heavier
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Estimated 1RM from a bench set via the Nuzzo curve: weight ÷ (%1RM/100), where
 * %1RM comes from the rep count. A single rep is, by definition, the 1RM.
 */
export function nuzzo1RM(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null) return null;
  if (weight <= 0 || reps <= 0) return null;
  if (reps === 1) return weight;
  return (weight * 100) / benchPctForReps(reps);
}

/**
 * The load you could lift for `reps` reps on bench, given your 1RM (Nuzzo curve):
 * 1RM × (%1RM/100). The inverse companion to nuzzo1RM.
 */
export function nuzzoWeightForReps(oneRepMax: number | null, reps: number | null): number | null {
  if (oneRepMax === null || reps === null) return null;
  if (oneRepMax <= 0 || reps <= 0) return null;
  return (oneRepMax * benchPctForReps(reps)) / 100;
}

/**
 * Predicted bench reps to failure at a given load, given your 1RM (Nuzzo curve):
 * read the curve at (weight/1RM)×100. At or above the 1RM it's a single.
 */
export function nuzzoRepsAtWeight(weight: number | null, oneRepMax: number | null): number | null {
  if (weight === null || oneRepMax === null) return null;
  if (weight <= 0 || oneRepMax <= 0) return null;
  if (weight >= oneRepMax) return 1;
  return benchRepsAtPct((weight / oneRepMax) * 100);
}

/**
 * Above this many reps, every rep→1RM formula is guesswork (Epley/Brzycki were
 * fit on low-rep sets), so a 35-rep set would extrapolate to an absurd 1RM.
 * Sets above this many reps yield NO 1RM at all (addedWeight1RM returns null) —
 * we report "—" rather than a clamped value, so a high-rep set never masquerades
 * as a max anywhere. The Test-tab teaching calculator is exempt (explores freely).
 */
export const MAX_1RM_REPS = 15;

export type OneRepMaxFormula = "epley" | "brzycki" | "nuzzo";

export function estimate1RM(
  weight: number | null,
  reps: number | null,
  formula: OneRepMaxFormula = "epley",
): number | null {
  if (formula === "brzycki") return brzycki1RM(weight, reps);
  if (formula === "nuzzo") return nuzzo1RM(weight, reps);
  return epley1RM(weight, reps);
}

/**
 * Inverse of estimate1RM: the load you could lift for `reps` reps given a 1RM,
 * under the chosen formula. Turns an athlete's estimated max into target working
 * weights (their 5RM / 10RM / 15RM). A single rep is, by definition, the 1RM.
 * Returns null on missing or non-positive inputs.
 *   Epley:   1RM = w(1 + r/30)   → w = 1RM / (1 + r/30)
 *   Brzycki: 1RM = w·36/(37 − r) → w = 1RM·(37 − r)/36   (null at r ≥ 37)
 *   Nuzzo:   bench %1RM curve     → nuzzoWeightForReps
 */
export function weightForReps(
  oneRepMax: number | null,
  reps: number | null,
  formula: OneRepMaxFormula = "epley",
): number | null {
  if (oneRepMax === null || reps === null) return null;
  if (oneRepMax <= 0 || reps <= 0) return null;
  if (reps === 1) return oneRepMax;
  if (formula === "nuzzo") return nuzzoWeightForReps(oneRepMax, reps);
  if (formula === "brzycki") {
    if (reps >= 37) return null;
    return (oneRepMax * (37 - reps)) / 36;
  }
  return oneRepMax / (1 + reps / 30);
}

/**
 * Inverse of weightForReps in the other direction: given a 1RM and a working
 * load, how many reps should that load allow under the chosen formula. The
 * companion to weightForReps for a two-way calculator (weight → reps).
 * Intentionally does NOT clamp — a load at/above the 1RM yields ≤ 1 rep, a load
 * above it can go fractional/negative, so callers see the raw curve. Returns
 * null only when inputs are missing or non-positive (genuinely undefined).
 *   Epley:   1RM = w(1 + r/30)   → r = 30·(1RM/w − 1)
 *   Brzycki: 1RM = w·36/(37 − r) → r = 37 − 36·w/1RM
 *   Nuzzo:   bench %1RM curve     → nuzzoRepsAtWeight
 */
export function repsForWeight(
  oneRepMax: number | null,
  weight: number | null,
  formula: OneRepMaxFormula = "epley",
): number | null {
  if (oneRepMax === null || weight === null) return null;
  if (oneRepMax <= 0 || weight <= 0) return null;
  if (formula === "nuzzo") return nuzzoRepsAtWeight(weight, oneRepMax);
  if (formula === "brzycki") return 37 - (36 * weight) / oneRepMax;
  return 30 * (oneRepMax / weight - 1); // epley
}

/**
 * Ordinary least-squares line through points: returns slope and intercept, or
 * null if there are fewer than two points or all x are equal. Used to read a
 * progression rate (kg per day) off an athlete's estimated-1RM history.
 */
export function linearFit(points: readonly { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  return { slope, intercept: (sy - slope * sx) / n };
}

/** Total load moved by a set: weight * reps. Null if either is missing. */
export function setVolume(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null) return null;
  return weight * reps;
}

/**
 * Load to feed the 1RM formula for a movement that lifts part of the body:
 *   coeff * bodyweight + addedWeight.
 * coeff <= 0 means the body isn't part of the load — the added weight passes
 * through unchanged (so a missing weight stays null and is filtered out as
 * before). For coeff > 0 a missing added weight counts as 0 (bodyweight-only
 * set), and an unknown bodyweight contributes 0.
 */
export function effectiveLoad(
  addedWeight: number | null,
  bodyweight: number | null,
  coeff: number,
): number | null {
  if (coeff <= 0) return addedWeight;
  return (bodyweight ?? 0) * coeff + (addedWeight ?? 0);
}
