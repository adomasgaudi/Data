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

/** True for bar pull-up / chin-up movements, where a *negative* logged weight
 * means assistance from a machine (not added load). Excludes pulldowns, pull
 * overs and other cable "pull" work, which are always loaded positively. */
export function isAssistablePullup(exerciseName: string): boolean {
  return /pull[\s-]?ups?|chin[\s-]?ups?/.test(exerciseName.toLowerCase());
}

/**
 * Real assistance weight for a pull-up set. Assisted reps are done on a machine
 * whose counterweight dial reads about twice the help it actually gives, so a
 * negative logged weight is halved (machine −30 kg ≈ −15 kg of real assistance).
 * Positive added weight, zero, null, and non-pull-up movements pass through
 * unchanged. The original logged value is kept elsewhere for display, so the
 * lifter still knows what to set on the machine.
 */
export function realPullupWeight(exerciseName: string, weight: number | null): number | null {
  if (weight === null || weight >= 0) return weight;
  if (!isAssistablePullup(exerciseName)) return weight;
  return weight / 2;
}

/**
 * Groups of closely-related lifts that should share one leaderboard. Each member
 * carries a scaling quotient = the fraction of the GROUP's reference lift you can
 * typically move on it, on the total load (bodyweight share + added). To compare
 * everyone on the reference lift, a member's load is divided by its quotient — so
 * a Romanian Deadlift (people lift ~0.7 of their deadlift) at 100 kg counts as a
 * ~143 kg deadlift-equivalent. The reference lift itself is 1.0. These are sane
 * starting estimates, editable later.
 */
export interface ExerciseGroup {
  name: string; // shown in the exercise picker; usually the reference lift's name
  members: Record<string, number>; // exact exercise name → scaling quotient (0..~1.1)
}

export const EXERCISE_GROUPS: ExerciseGroup[] = [
  {
    name: "Squat",
    members: {
      Squat: 1,
      "Smith Machine Squat": 0.95,
      "Front Squat": 0.8,
      "Belt Squat": 0.9,
      "Hack Squat": 1.0,
      "Overhead Squat": 0.55,
      "Goblet Squat": 0.5,
      "Box Squat": 0.95,
    },
  },
  {
    name: "Deadlift",
    members: {
      Deadlift: 1,
      "Sumo Deadlift": 1.0,
      "Romanian Deadlift": 0.7,
      "Stiff Leg Deadlift": 0.7,
      "Deficit Romanian Deadlift": 0.65,
      "Hex Bar Deadlift": 1.05,
      "Box deadlift": 0.95,
      "Jefferson Deadlift": 0.85,
      "Single Leg Romanian Deadlift": 0.35,
    },
  },
  {
    name: "Bench Press",
    members: {
      "Bench Press": 1,
      "Dumbbell Bench Press": 0.9,
      "Incline Bench Press": 0.82,
      "Incline Dumbbell Bench Press": 0.74,
      "Decline Bench Press": 1.05,
      "Close Grip Bench Press": 0.9,
      "Chest Press": 0.95,
    },
  },
  {
    name: "Shoulder Press",
    members: {
      "Shoulder Press": 1,
      "Seated Shoulder Press": 1,
      "Machine Shoulder Press": 1,
      "Shoulder Press (Machine Plates)": 1,
      "Dumbbell Shoulder Press": 0.85,
      "Seated Dumbbell Shoulder Press": 0.85,
      "Military Press": 1,
      "Behind The Neck Press": 0.9,
    },
  },
  {
    name: "Row",
    members: {
      "Bent Over Row": 1,
      "T Bar Row": 1,
      "Machine Row": 1,
      "Seated Cable Row": 1,
      "Iso-Lateral Low Row": 1,
      "Bent Over Dumbbell Row": 0.55,
      "Dumbbell Row": 0.5,
    },
  },
  {
    name: "Bicep Curl",
    members: {
      "Barbell Curl": 1,
      "EZ Bar Curl": 0.95,
      "Preacher Curl": 0.9,
      "Machine Bicep Curl": 1,
      "Dumbbell Curl": 0.5,
      "Hammer Curl": 0.5,
      "Dumbbell Preacher Curl": 0.45,
    },
  },
];

/** Reverse lookup: exercise name → its group and scaling quotient, if grouped. */
export function groupOf(exerciseName: string): { group: string; scale: number } | null {
  for (const g of EXERCISE_GROUPS) {
    const scale = g.members[exerciseName];
    if (scale !== undefined) return { group: g.name, scale };
  }
  return null;
}

/**
 * Isometric / timed exercises where the "reps" column is really seconds (holds,
 * hangs, supports, planks, L-sits). A rep-based 1RM is meaningless for these, so
 * they're kept out of leaderboards/PRs/progress — a `Deadlift hold 120 kg "16"`
 * must not become a phantom 190 kg deadlift.
 */
export function isIsometric(exerciseName: string): boolean {
  const n = exerciseName.toLowerCase();
  return (
    /\b(hold|hang|support)\b/.test(n) ||
    n.includes("plank") ||
    n.includes("l-sit") ||
    n.includes("lsit") ||
    n.includes("l sit")
  );
}

/** The training categories shown in the "what they train" breakdown, in order. */
export type TrainingCategory =
  | "Legs"
  | "Chest"
  | "Back"
  | "Shoulders"
  | "Arms"
  | "Core"
  | "Skill"
  | "Mobility"
  | "Cardio"
  | "Other";
export const TRAINING_CATEGORIES: TrainingCategory[] = [
  "Legs", "Chest", "Back", "Shoulders", "Arms", "Core", "Skill", "Mobility", "Cardio", "Other",
];

/**
 * Best-guess muscle/movement category for an exercise, by keyword — so the athlete
 * page can show what someone has actually been training. Order matters: skills and
 * non-lifts are matched before the muscle groups so "front lever row" is a Skill,
 * not Back, and a "hamstring stretch" is Mobility, not Legs.
 */
export function exerciseCategory(exerciseName: string): TrainingCategory {
  const n = exerciseName.toLowerCase();
  const has = (...k: string[]) => k.some((s) => n.includes(s));

  if (has("stretch", "split", "pancake", "pose", "tailor", "meditation", "breath", "cold shower", "mobility", "ankle", "posture", "head aware"))
    return "Mobility";
  if (has("run", "bike", "cardio", "stairs", "hike", "sprint", "skateboard", "cycle", "sled", "slege"))
    return "Cardio";
  if (has("front lever", "planche", "human flag", "maltese", "dragon flag", "handstand", "headstand", "forearm stand", "l-sit", "l sit", "lsit", "balance", "muscle up", "iron cross", "pancake"))
    return n.includes("push") ? "Shoulders" : "Skill"; // handstand PUSH-up trains shoulders

  if (has("crunch", "sit up", "situp", "sit-up", "plank", "leg raise", "legs raise", "ab ", "ab wheel", "ab curl", "oblique", "side bend", "hollow", "knee raise", "knee tuck", "woodchop", "pallof", "rollout", "twist", "leg pull", "bicycle", "mountain climber", "flag", "vacuum"))
    return "Core";
  if (has("shoulder press", "overhead press", "lateral raise", "front raise", "rear delt", "upright row", "military press", "behind the neck", "arnold", "shrug", "shoulder raise", "delt"))
    return "Shoulders";
  if (has("curl", "tricep", "triceps", "pushdown", "preacher", "hammer", "wrist", "forearm", "finger", "skull", "jm press", "kickback"))
    return "Arms";
  if (has("bench", "chest", "push up", "pushup", "push-up", "pushups", "fly", "pec", "dip", "press up"))
    return "Chest";
  if (has("row", "pulldown", "pull up", "pullup", "pull-up", "chin up", "chinup", "lat ", "lat pull", "pull over", "pullover", "face pull", "inverted row", "scapular", "back extension", "hyperextension", "reverse hyper"))
    return "Back";
  if (has("squat", "deadlift", "lunge", "leg press", "leg curl", "leg extension", "calf", "hip thrust", "glute", "rdl", "romanian", "good morning", "hamstring", "ham ", "quad", "pistol", "step up", "step-up", "hack", "belt squat", "cossack", "sissy", "hip abduction", "hip adduction", "abductor", "adductor", "nordic", "wall sit", "clean", "snatch", "kettlebell"))
    return "Legs";
  return "Other";
}

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
