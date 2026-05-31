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

export type OneRepMaxFormula = "epley" | "brzycki";

export function estimate1RM(
  weight: number | null,
  reps: number | null,
  formula: OneRepMaxFormula = "epley",
): number | null {
  return formula === "brzycki" ? brzycki1RM(weight, reps) : epley1RM(weight, reps);
}

/** Total load moved by a set: weight * reps. Null if either is missing. */
export function setVolume(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null) return null;
  return weight * reps;
}
