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
  sex: "m" | "f"; // used by the Coliseum "men only / women only" filter
}

// AI-NOTE: the `sex` values below were inferred from the (mostly Lithuanian)
// first names — male names end -as/-us/-is, female -a/-ė — not from any logged
// field. They drive the men/women comparison filter. If any is wrong, just fix
// the single letter here and everything downstream updates.
/** Keyed by StrengthLevel username (the key used in the set log). */
export const ATHLETES: Record<string, AthleteProfile> = {
  mantasp: { height: 200, weight: 128, bodyFat: 0.38, age: 15, sex: "m" },
  johannesschut: { height: 190, weight: 85, bodyFat: 0.22, age: 35, sex: "m" },
  andriusp: { height: 185, weight: 111, bodyFat: 0.35, age: 40, sex: "m" },
  adomasgaudi: { height: 180, weight: 97, bodyFat: 0.25, age: 29, sex: "m" },
  bebras: { height: 175, weight: 70, bodyFat: 0.15, age: 15, sex: "m" }, // Laurynas
  natali: { height: 174, weight: 74, bodyFat: 0.35, age: 50, sex: "f" }, // Natalija
  agne_ram: { height: 174, weight: 63, bodyFat: 0.25, age: 31, sex: "f" }, // Agnė
  marijasenkus: { height: 172, weight: 56, bodyFat: 0.2, age: 38, sex: "f" }, // Marija
  indre_ju: { height: 167, weight: 67, bodyFat: 0.28, age: 40, sex: "f" }, // Indrė
  simona: { height: 168, weight: 74, bodyFat: 0.3, age: 39, sex: "f" },
  sandrakri: { height: 168, weight: 72, bodyFat: 0.3, age: 35, sex: "f" }, // Sandra
  dzuljeta: { height: 167, weight: 55, bodyFat: 0.2, age: 32, sex: "f" }, // Džuljeta
  andromeda94: { height: 160, weight: 44, bodyFat: 0.2, age: 31, sex: "f" }, // Kristina
  henrikas: { height: 182, weight: 113, bodyFat: 0.35, age: null, sex: "m" },
  karolisb: { height: 173, weight: 71, bodyFat: 0.18, age: 23, sex: "m" }, // Karolis
  "t.urba": { height: 180, weight: 82, bodyFat: 0.18, age: 30, sex: "m" }, // Tomas
  simonasputrius: { height: 200, weight: 128, bodyFat: 0.35, age: 19, sex: "m" }, // Simonas
  brigita_r: { height: 160, weight: 55, bodyFat: 0.2, age: 30, sex: "f" }, // Brigita
  monika: { height: 165, weight: 52, bodyFat: 0.2, age: 29, sex: "f" }, // Monika
};

/**
 * Body-composition metrics derived from an athlete's profile.
 *
 * FFMI (fat-free mass index) is like BMI but on lean mass only:
 *   lean kg = weight × (1 − bodyFat); FFMI = lean kg ÷ height(m)².
 * nFFMI ("normalised") adjusts FFMI to a 1.8 m reference height so tall and
 * short lifters compare fairly — the standard +6.1 × (1.8 − height_m) term.
 * As a rough read: ~18 untrained, ~20–22 trained, ~25 is near the natural
 * ceiling, >25 suggests exceptional genetics or assistance.
 *
 * Returns null if the inputs can't yield a real number (non-positive height,
 * or a body-fat fraction outside 0–1).
 */
export function bodyComposition(
  p: Pick<AthleteProfile, "height" | "weight" | "bodyFat">,
): { leanMass: number; ffmi: number; nffmi: number } | null {
  const heightM = p.height / 100;
  if (!(heightM > 0) || !(p.weight > 0) || p.bodyFat < 0 || p.bodyFat >= 1) return null;
  const leanMass = p.weight * (1 - p.bodyFat);
  const ffmi = leanMass / (heightM * heightM);
  const nffmi = ffmi + 6.1 * (1.8 - heightM);
  return { leanMass, ffmi, nffmi };
}

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
    // "Squat pattern" is the combined/scaled board for all squat variants. It is
    // a distinct name from the "Squat" exercise on purpose — Squat and Smith
    // Machine Squat stay as their own pure lifts; this only merges them when the
    // grouped/scaled toggle is on.
    name: "Squat pattern",
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
    // "Deadlift pattern" deliberately combines ONLY the conventional Deadlift and
    // the Romanian Deadlift for now (owner will expand it carefully later). Every
    // other deadlift variant stays its own separate exercise. Distinct name from
    // the "Deadlift" exercise; only appears when the grouped/scaled toggle is on.
    name: "Deadlift pattern",
    members: {
      Deadlift: 1,
      "Romanian Deadlift": 0.7,
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
  if (has("run", "bike", "cardio", "stairs", "hike", "sprint", "skateboard", "cycle", "sled", "slege", "erg", "elliptical", "treadmill", "jump rope", "skipping", "stairmaster", "calorie"))
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
 * The category headers used by the Exercises "By category" sort and the Group
 * view's Categories mode. Unlike {@link exerciseCategory} (one PRIMARY bucket
 * for the muscle map / training-mix bar, where a set must count once), this is a
 * MULTI-membership scheme: one lift can land under several headers — a deadlift
 * is Legs, Back AND Core, and also sits in the Deadlift pattern and both leg
 * sub-splits. Movement-pattern and leg-split buckets are added on top of the
 * muscle groups so the owner can slice the list however they think about it.
 */
export const LIST_CATEGORIES: string[] = [
  "Squat pattern",
  "Deadlift pattern",
  "Deadlift accessory",
  "Legs (all)",
  "Legs (quads/glutes/hams)",
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Core",
  "Skill",
  "Mobility",
  "Cardio",
  "Other",
];

/** Every {@link LIST_CATEGORIES} bucket an exercise belongs to (one or more). */
export function exerciseCategories(exerciseName: string): string[] {
  const n = exerciseName.toLowerCase();
  const has = (...k: string[]) => k.some((s) => n.includes(s));
  const cats: string[] = [];
  const add = (c: string) => {
    if (!cats.includes(c)) cats.push(c);
  };

  // Non-strength buckets first (same precedence as exerciseCategory) — when one
  // hits, it's the only sensible bucket, so return early.
  if (has("stretch", "split", "pancake", "pose", "tailor", "meditation", "breath", "cold shower", "mobility", "ankle", "posture", "head aware"))
    return ["Mobility"];
  if (has("run", "bike", "cardio", "stairs", "hike", "sprint", "skateboard", "cycle", "sled", "slege", "erg", "elliptical", "treadmill", "jump rope", "skipping", "stairmaster", "calorie"))
    return ["Cardio"];
  if (has("front lever", "planche", "human flag", "maltese", "dragon flag", "handstand", "headstand", "forearm stand", "l-sit", "l sit", "lsit", "balance", "muscle up", "iron cross"))
    return [n.includes("push") ? "Shoulders" : "Skill"];

  // Movement patterns (a squat/deadlift can belong to a pattern AND muscle groups).
  if (n.includes("squat")) add("Squat pattern");
  if (has("deadlift", "rdl", "romanian deadlift")) add("Deadlift pattern");
  // Posterior-chain work that supports the deadlift (not the main lift itself).
  if (has("back extension", "hyperextension", "reverse hyper", "good morning", "glute ham", "ghr", "hip thrust", "rack pull", "snatch grip deadlift", "deficit deadlift", "block pull", "romanian deadlift", "rdl", "nordic"))
    add("Deadlift accessory");

  // Leg splits: broad (everything leg-ish) vs the big three quads/glutes/hams.
  const legBroad = has("squat", "deadlift", "lunge", "leg press", "leg curl", "leg extension", "calf", "hip thrust", "glute", "rdl", "romanian", "good morning", "hamstring", "ham ", "quad", "pistol", "step up", "step-up", "hack", "belt squat", "cossack", "sissy", "hip abduction", "hip adduction", "abductor", "adductor", "nordic", "wall sit", "clean", "snatch", "kettlebell");
  if (legBroad) add("Legs (all)");
  const legBig = has("squat", "deadlift", "lunge", "leg press", "leg curl", "leg extension", "hip thrust", "glute", "rdl", "romanian", "good morning", "hamstring", "ham ", "quad", "pistol", "step up", "step-up", "hack", "belt squat", "cossack", "sissy", "nordic", "wall sit");
  if (legBig) add("Legs (quads/glutes/hams)");

  // Muscle groups — independent keyword sets, so big compounds match several.
  if (has("bench", "chest", "push up", "pushup", "push-up", "pushups", "fly", "pec", "dip", "press up")) add("Chest");
  if (has("row", "pulldown", "pull up", "pullup", "pull-up", "chin up", "chinup", "lat ", "lat pull", "pull over", "pullover", "face pull", "inverted row", "scapular", "back extension", "hyperextension", "reverse hyper", "deadlift", "shrug", "rack pull", "good morning"))
    add("Back");
  if (has("shoulder press", "overhead press", "lateral raise", "front raise", "rear delt", "upright row", "military press", "behind the neck", "arnold", "shrug", "delt", "handstand push"))
    add("Shoulders");
  if (has("curl", "tricep", "triceps", "pushdown", "preacher", "hammer", "wrist", "forearm", "finger", "skull", "jm press", "kickback")) add("Arms");
  if (has("crunch", "sit up", "situp", "sit-up", "plank", "leg raise", "legs raise", "ab ", "ab wheel", "ab curl", "oblique", "side bend", "hollow", "knee raise", "knee tuck", "woodchop", "pallof", "rollout", "twist", "leg pull", "bicycle", "mountain climber", "flag", "vacuum", "deadlift", "good morning"))
    add("Core");

  if (cats.length === 0) add("Other");
  return cats;
}

/**
 * Importance tier of an exercise — the owner's core compound lifts ("main") vs
 * everything else ("second"). This is a curated list, NOT keyword logic, so close
 * variants the owner didn't name (e.g. Front Squat, Incline Bench) stay "second".
 * Matching is on a normalised name (lowercased, punctuation/spacing stripped) so
 * "Pull-Ups" / "Pull Ups" / "Pullups" all resolve to the same lift.
 *
 * AI-NOTE: created on request to tag main vs second lifts; not yet wired into any
 * view. Edit MAIN_EXERCISES (canonical names) to change the set.
 */
export type ExerciseTier = "main" | "second" | "third";

const normalizeExerciseName = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const MAIN_EXERCISES = new Set(
  [
    "Squat",
    "Deadlift",
    "Smith Machine Squat", "Smith Squat",
    "Romanian Deadlift", "RDL",
    "Bench Press",
    "Dumbbell Bench Press",
    "Shoulder Press",
    "Dumbbell Shoulder Press",
    "Push Ups", "Push Up",
    "Pull Ups", "Pull Up",
    "Chin Ups", "Chin Up",
    "Lat Pulldown", "Lat Pulldowns",
  ].map(normalizeExerciseName),
);

/**
 * Three importance tiers:
 *  - "main": the owner's core compound lifts (the MAIN_EXERCISES list).
 *  - "third": NOT really strength training — cardio, calorie/conditioning work,
 *    mobility/stretches, and warm-ups (so they can be folded away).
 *  - "second": everything else (accessory & isolation strength work).
 */
export function exerciseTier(exerciseName: string): ExerciseTier {
  if (MAIN_EXERCISES.has(normalizeExerciseName(exerciseName))) return "main";
  const cat = exerciseCategory(exerciseName);
  if (cat === "Cardio" || cat === "Mobility") return "third";
  if (/\bwarm[\s-]?up/.test(exerciseName.toLowerCase())) return "third";
  return "second";
}

/**
 * A short exercise code for cramped spots (chart ticks, tight tables) where the
 * full name won't fit. The owner's scheme: an UPPERCASE movement core (SQ, DL,
 * BP, CP, SP…) with one or more LOWERCASE modifier prefixes glued on for the
 * equipment/variant (d = dumbbell, f = front, h = hex bar, i = incline, …). So
 * a dumbbell bench press reads "dBP", a front squat "fSQ", a hex-bar deadlift
 * "hDL". Sumo deadlift is the owner's explicit exception: "S-DL".
 *
 * Anything without a recognised core falls back to a deterministic initials
 * derivation so new exercises still get a code without being hardcoded. Codes
 * are paired with the full name in a title/tooltip, but exerciseCodesFor() makes
 * the displayed set unique (a rare collision gets a numeric suffix).
 *
 * AI-NOTE: codes are owner-specified. Edit MOVEMENT_CORES / MODIFIER_PREFIXES /
 * EXACT_CODE_OVERRIDES below to tune; keep prefixes lowercase, cores uppercase.
 */

// Exact, owner-named codes that bypass the prefix+core derivation entirely.
const EXACT_CODE_OVERRIDES: Record<string, string> = {
  sumodeadlift: "S-DL", // explicit exception: uppercase S + dash
  backextension: "BE",
  hipthrust: "HT",
  dips: "Dip", // owner prefers the short word over a code
  dip: "Dip",
  pullups: "Pull",
  pullup: "Pull",
  pushups: "PU",
  pushup: "PU",
  romanchairsidebend: "rcSB",
  onearmdumbbellpreachercurl: "dPCurl",
  machinecalfraise: "mCR",
  hipabduction: "H-ABD",
  hipadduction: "H-ADD",
  declinesitup: "dSU",
};

// Movement cores (UPPERCASE), matched on the longest phrase first so "bench
// press" wins over a bare "bench". Keys are normalised (lowercased, stripped).
const MOVEMENT_CORES: { match: string; core: string }[] = [
  { match: "romaniandeadlift", core: "RDL" },
  { match: "deadlift", core: "DL" },
  { match: "benchpress", core: "BP" },
  { match: "chestpress", core: "CP" },
  { match: "shoulderpress", core: "SP" },
  { match: "overheadpress", core: "OHP" },
  { match: "latpulldown", core: "LPD" },
  { match: "pulldown", core: "PD" },
  { match: "bentoverrow", core: "BOR" },
  { match: "row", core: "ROW" },
  { match: "pushups", core: "PU" },
  { match: "pushup", core: "PU" },
  { match: "pullups", core: "PL" },
  { match: "pullup", core: "PL" },
  { match: "chinups", core: "CH" },
  { match: "chinup", core: "CH" },
  { match: "legpress", core: "LP" },
  { match: "legcurl", core: "LC" },
  { match: "legextension", core: "LE" },
  { match: "squat", core: "SQ" },
  { match: "dips", core: "DIP" },
  { match: "dip", core: "DIP" },
  { match: "situps", core: "SU" },
  { match: "situp", core: "SU" },
  { match: "calfraise", core: "CR" },
  { match: "sidebend", core: "SB" },
  { match: "preachercurl", core: "PCurl" },
  { match: "curl", core: "CRL" },
];

// Variant/equipment prefixes (lowercase), checked longest-first so "single
// dumbbell" beats "single"/"dumbbell". Each contributes a lowercase letter or
// two; multiple can stack (e.g. an incline dumbbell press → "idBP").
const MODIFIER_PREFIXES: { match: string; prefix: string }[] = [
  { match: "singledumbbell", prefix: "sd" },
  { match: "singleleg", prefix: "sl" },
  { match: "dumbbell", prefix: "d" },
  { match: "smithmachine", prefix: "sm" },
  { match: "hexbar", prefix: "h" },
  { match: "hex", prefix: "h" },
  { match: "front", prefix: "f" },
  { match: "incline", prefix: "i" },
  { match: "decline", prefix: "e" },
  { match: "seated", prefix: "s" },
  { match: "standing", prefix: "t" },
  { match: "overhead", prefix: "o" },
  { match: "barbell", prefix: "b" },
  { match: "cable", prefix: "c" },
  { match: "machine", prefix: "m" },
  { match: "belt", prefix: "b" },
  { match: "hack", prefix: "h" },
  { match: "sumo", prefix: "s" },
  { match: "box", prefix: "x" },
];

/** Old-style initials fallback for names with no recognised movement core. */
function deriveInitials(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter(Boolean);
  let code = words.map((w) => w[0]).join("").slice(0, 3); // word initials, capped at 3
  const first = words[0] ?? "";
  for (let i = 1; i < first.length && code.length < 3; i++) code += first[i]; // pad from word 1
  while (code.length < 3) code += "X"; // ultra-short names (rare)
  return code.slice(0, 3);
}

/**
 * Build the code for one exercise: lowercase modifier prefix(es) + UPPERCASE
 * movement core. Falls back to initials when no core is recognised. Not
 * guaranteed unique on its own — exerciseCodesFor() resolves collisions.
 */
export function exerciseCode(exerciseName: string): string {
  const norm = normalizeExerciseName(exerciseName);
  const exact = EXACT_CODE_OVERRIDES[norm];
  if (exact) return exact;

  const coreEntry = MOVEMENT_CORES.find((c) => norm.includes(c.match));
  if (!coreEntry) return deriveInitials(exerciseName);

  // Collect modifier prefixes that appear BEFORE the core word, longest match
  // first, skipping ones whose letters are already covered, so order in the name
  // is roughly preserved (e.g. "incline dumbbell" → "id").
  let prefix = "";
  let remaining = norm.slice(0, norm.indexOf(coreEntry.match));
  for (const m of MODIFIER_PREFIXES) {
    if (remaining.includes(m.match)) {
      prefix += m.prefix;
      remaining = remaining.replace(m.match, "");
    }
  }
  return prefix + coreEntry.core;
}

/**
 * Codes for a set of exercise names, made UNIQUE: when two distinct names would
 * share a code, later ones get a numeric suffix ("dBP", "dBP2", "dBP3") so each
 * row in a table reads distinctly. Order in determines suffix order, so pass the
 * names in their display order for stable codes. Returns a name→code map.
 */
export function exerciseCodesFor(names: Iterable<string>): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Map<string, number>(); // base code → how many times seen
  for (const name of names) {
    if (out.has(name)) continue; // same name → same code, only assign once
    const base = exerciseCode(name);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    out.set(name, seen === 0 ? base : `${base}${seen + 1}`);
  }
  return out;
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
