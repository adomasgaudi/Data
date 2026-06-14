/**
 * Strength standards — bodyweight-relative 1RM percentile curves for three populations,
 * so a lift's WR section can show "what each percentile can do" and place the athlete on
 * it (docs/ceo/strength-percentiles-benchmarks.md).
 *
 * DATA STATUS: ESTIMATES (owner-approved, real data later). The StrengthLevel "gym"
 * curve is hand-seeded from common StrengthLevel standards (the 5 levels beginner→elite
 * ≈ the 5 percentiles below); the GENERAL and PRO curves are DERIVED from it by a
 * population multiplier, not sourced. Everything is flagged `estimated` so the UI marks
 * it and a later #research pass (Phase 5) can replace the numbers without touching the
 * shape. Values are bw-ratios: kg = ratio × bodyweight (what StrengthLevel uses); for
 * bodyweight lifts (pull-up/dip) it's TOTAL load ÷ bodyweight.
 */
export type Population = "general" | "strengthlevel" | "pro";
export type Sex = "m" | "f";

/** The five reference percentiles (≈ StrengthLevel beginner / novice / intermediate /
 *  advanced / elite). */
export const PERCENTILES = [5, 25, 50, 75, 95] as const;

export const POPULATIONS: Population[] = ["general", "strengthlevel", "pro"];
export const POPULATION_LABEL: Record<Population, string> = {
  general: "General",
  strengthlevel: "Gym (StrengthLevel)",
  pro: "Professional",
};

type Curve = [number, number, number, number, number]; // bw-ratio at each PERCENTILE
interface LiftStd { keys: string[]; m: Curve; f: Curve }

/** StrengthLevel "gym" bw-ratio curves. Most-specific keys FIRST (so "front squat"
 *  matches before "squat", etc.). */
const GYM_STANDARDS: LiftStd[] = [
  { keys: ["front squat"], m: [0.6, 1.0, 1.3, 1.7, 2.1], f: [0.5, 0.85, 1.05, 1.35, 1.7] },
  { keys: ["leg press"], m: [1.5, 2.5, 3.5, 4.5, 6.0], f: [1.2, 2.0, 3.0, 4.0, 5.0] },
  { keys: ["overhead press", "shoulder press", "military", "ohp", "strict press"], m: [0.35, 0.55, 0.8, 1.1, 1.4], f: [0.2, 0.35, 0.5, 0.7, 0.95] },
  { keys: ["hip thrust"], m: [1.0, 1.75, 2.5, 3.25, 4.0], f: [0.9, 1.6, 2.3, 3.0, 3.75] },
  { keys: ["bench"], m: [0.5, 0.75, 1.0, 1.5, 2.0], f: [0.3, 0.5, 0.7, 1.0, 1.4] },
  { keys: ["deadlift"], m: [1.0, 1.5, 2.0, 2.5, 3.0], f: [0.8, 1.25, 1.6, 2.0, 2.5] },
  { keys: ["squat"], m: [0.75, 1.25, 1.5, 2.0, 2.5], f: [0.6, 1.0, 1.25, 1.6, 2.0] },
  { keys: ["row"], m: [0.5, 0.75, 1.0, 1.3, 1.6], f: [0.35, 0.55, 0.75, 1.0, 1.3] },
  { keys: ["pull up", "pullup", "pull-up", "chin up", "chinup", "chin-up"], m: [1.0, 1.15, 1.35, 1.6, 2.0], f: [0.85, 1.0, 1.15, 1.4, 1.75] },
  { keys: ["dip"], m: [1.0, 1.2, 1.45, 1.75, 2.1], f: [0.8, 1.0, 1.2, 1.5, 1.85] },
  { keys: ["curl", "bicep"], m: [0.25, 0.4, 0.55, 0.75, 1.0], f: [0.15, 0.25, 0.35, 0.5, 0.7] },
];

/** Population multipliers vs the gym curve (ESTIMATE): the general public is far weaker
 *  (mostly non-lifters); pros sit near the gym-elite end and beyond. */
const POP_MULT: Record<Population, number> = { general: 0.6, strengthlevel: 1, pro: 1.3 };

/** True — every number here is currently an estimate (see file header). */
export const STANDARDS_ESTIMATED = true;

/** The gym standard whose keyword matches this exercise name, or null. */
function findStd(name: string): LiftStd | null {
  const n = name.toLowerCase();
  return GYM_STANDARDS.find((s) => s.keys.some((k) => n.includes(k))) ?? null;
}

/** True if we have any standard curve for this lift. */
export function hasStandards(name: string): boolean {
  return findStd(name) !== null;
}

/** The bw-ratio curve (one ratio per PERCENTILE) for a lift / sex / population, or null
 *  when the lift isn't covered. */
export function curveFor(name: string, sex: Sex, pop: Population): number[] | null {
  const std = findStd(name);
  if (!std) return null;
  const base = sex === "f" ? std.f : std.m;
  const mult = POP_MULT[pop];
  return base.map((r) => Math.round(r * mult * 100) / 100);
}

/** Estimate the percentile (1–99) a bw-ratio lands at on a population's curve, by
 *  piecewise-linear interpolation between the five anchors (extrapolated, clamped at the
 *  ends). null when the lift isn't covered. */
export function percentileFor(name: string, sex: Sex, bwRatio: number, pop: Population): number | null {
  const curve = curveFor(name, sex, pop);
  if (!curve) return null;
  const P = PERCENTILES;
  if (bwRatio <= curve[0]!) {
    const pct = curve[0]! > 0 ? (P[0] * bwRatio) / curve[0]! : P[0];
    return Math.max(1, Math.round(pct));
  }
  for (let i = 0; i < curve.length - 1; i++) {
    const lo = curve[i]!, hi = curve[i + 1]!;
    if (bwRatio <= hi) {
      const frac = hi > lo ? (bwRatio - lo) / (hi - lo) : 0;
      return Math.round(P[i]! + frac * (P[i + 1]! - P[i]!));
    }
  }
  // Above the 95th anchor: ease toward 99.
  const last = curve[curve.length - 1]!;
  const over = last > 0 ? (bwRatio - last) / last : 0; // fraction above elite
  return Math.min(99, Math.round(P[P.length - 1]! + over * 40));
}
