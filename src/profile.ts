/**
 * Manually-provided athlete attributes and per-exercise bodyweight coefficients.
 *
 * The "bodyweight-lifted" 1RM works like this: for a movement that lifts part
 * of your own body (pull-ups, squats…), the load fed to the 1RM formula is
 *   coefficient × bodyweight + added weight.
 * coefficient 0 = the body isn't part of the load (e.g. bench press → bar only);
 * 1 = the whole bodyweight is lifted (a strict pull-up).
 */

export interface AthleteProfile {
  height: number; // cm
  weight: number; // kg
  bodyFat: number; // fraction 0..1
  age: number | null;
}

/** Keyed by StrengthLevel username (the key used in the set log). */
export const ATHLETES: Record<string, AthleteProfile> = {
  mantasp: { height: 200, weight: 128, bodyFat: 0.38, age: 15 },
  johannesschut: { height: 190, weight: 85, bodyFat: 0.22, age: 35 },
  andriusp: { height: 185, weight: 111, bodyFat: 0.35, age: 40 },
  adomasgaudi: { height: 180, weight: 97, bodyFat: 0.25, age: 29 },
  bebras: { height: 175, weight: 70, bodyFat: 0.15, age: 15 }, // Laurynas
  natali: { height: 174, weight: 74, bodyFat: 0.35, age: 50 }, // Natalija
  agne_ram: { height: 174, weight: 63, bodyFat: 0.25, age: 31 },
  marijasenkus: { height: 172, weight: 56, bodyFat: 0.2, age: 38 },
  indre_ju: { height: 167, weight: 67, bodyFat: 0.28, age: 40 },
  simona: { height: 168, weight: 74, bodyFat: 0.3, age: 39 },
  sandrakri: { height: 168, weight: 72, bodyFat: 0.3, age: 35 },
  dzuljeta: { height: 167, weight: 55, bodyFat: 0.2, age: 32 },
  andromeda94: { height: 160, weight: 44, bodyFat: 0.2, age: 31 }, // Kristina
  henrikas: { height: 182, weight: 113, bodyFat: 0.35, age: null },
  karolisb: { height: 173, weight: 71, bodyFat: 0.18, age: 23 },
  "t.urba": { height: 180, weight: 82, bodyFat: 0.18, age: 30 }, // Tomas
  simonasputrius: { height: 200, weight: 128, bodyFat: 0.35, age: 19 },
  brigita_r: { height: 160, weight: 55, bodyFat: 0.2, age: 30 },
  monika: { height: 165, weight: 52, bodyFat: 0.2, age: 29 },
};

/** Fraction of bodyweight a movement lifts. Exact match on the data's exercise name. */
export const EXERCISE_BW_COEFF: Record<string, number> = {
  Squat: 0.6,
  Deadlift: 0.3,
  "Bench Press": 0,
  "Pull Ups": 0.95,
  Dips: 0.95,
  "One Arm Dumbbell Preacher Curl": 0.05,
  "Seated Shoulder Press": 0,
  "Dumbbell Shoulder Press": 0,
  "Shoulder Press": 0,
  "Decline Sit Up": 0.3,
  "Roman Chair Side Bend": 0.3,
  "Hip Abduction": 0,
};

/** Exercises not in the table contribute no bodyweight (treated as pure load). */
export const DEFAULT_BW_COEFF = 0;
