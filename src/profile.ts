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

/** Exercises with no match contribute no bodyweight (treated as pure load). */
export const DEFAULT_BW_COEFF = 0;

/**
 * Leverage-aware default for how much bodyweight an exercise effectively loads,
 * used for any exercise not pinned in EXERCISE_BW_COEFF. This is deliberately NOT
 * a naive "fraction of bodyweight": for high-leverage holds (front lever, planche,
 * straight-leg raises) the coefficient is small, because a little weight added far
 * from the pivot changes the difficulty far more than its raw kg implies. So a
 * front lever is ~0.1, not 1.0 — adding 1 kg at the ankles should move the number
 * a lot. Machine/cable/free-weight isolation (bench, rows, curls, presses,
 * pulldowns, leg press) and non-lifts (stretches, cardio) contribute 0.
 *
 * Order matters: the most specific rules come first (e.g. "front lever row" is a
 * front lever, not a row; "seated calf raise" is seated, not a standing calf).
 */
export function defaultBwCoeff(exerciseName: string): number {
  const n = exerciseName.toLowerCase();
  const has = (...k: string[]) => k.some((s) => n.includes(s));

  // High-leverage calisthenics — low coeff so added weight dominates.
  if (has("front lever", "planche", "human flag", "maltese", "iron cross")) return 0.1;
  if (has("dragon flag")) return 0.15;
  if (has("l-sit", "l sit", "lsit")) return 0.3;
  if (has("leg raise", "legs raise", "leg pull in", "leg pull-in")) return has("straight") ? 0.1 : 0.15;
  if (has("knee raise", "knee tuck", "hanging knee")) return 0.15;

  // Bodyweight pulling.
  if (has("muscle up", "muscle-up", "muscleup")) return 1.0;
  if (has("pull up", "pullup", "pull-up", "chin up", "chinup", "chin-up")) return 0.95;
  if (has("dead hang", "bar hang", "pull-up hold", "pullup hold")) return 0.9;
  if (has("inverted row", "scapular", "bodyweight row")) return 0.6;

  // Bodyweight pushing.
  if (has("handstand push", "hspu")) return 0.9;
  if (has("handstand", "forearm stand", "headstand")) return 0.8;
  if (has("dip machine", "seated dip")) return 0; // machine: no bodyweight support
  if (has("dip") && has("assisted")) return 0.5;
  if (has("dip")) return 0.9;
  if (has("pike push")) return 0.7;
  if (has("push up", "pushup", "push-up", "pushups", "press up")) return 0.65;

  // Legs — bodyweight is moved through the range of motion.
  if (has("pistol")) return 0.85;
  if (has("split squat", "bulgarian", "lunge", "cossack", "step up", "step-up", "sissy", "balance squat", "balance lunge"))
    return 0.7;
  if (has("calf")) return has("seated") ? 0 : 0.9;
  if (has("nordic")) return 0.6;
  if (has("belt squat")) return 0.5;
  if (has("squat", "wall sit")) return 0.6;
  if (has("hip thrust", "glute bridge", "single leg hip")) return 0.2;
  if (has("deadlift", "good morning", "rdl", "romanian")) return 0.3;
  if (has("back extension", "hyperextension", "hyper extension", "reverse hyper", "back raise"))
    return has("machine") ? 0 : 0.4;

  // Core — torso/leg lever, when not machine/cable-loaded.
  if (has("crunch") && has("cable", "machine")) return 0;
  if (has("sit up", "situp", "sit-up", "crunch", "ab curl", "v-up", "vacuum")) return 0.3;
  if (has("plank", "front support", "hollow")) return 0.5;
  if (has("ab wheel", "rollout", "ab roll")) return 0.4;
  if (has("side bend", "woodchop", "pallof", "oblique", "bicycle", "mountain climber", "leg twist")) return 0.2;

  return 0; // bench/press/row/curl/pulldown/fly/raise/leg press/machine/cable/non-lifts
}
