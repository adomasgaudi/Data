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
 * Scaling/“pattern” groups have been REMOVED at the owner's request — every
 * exercise stands on its own (Bench Press, Dumbbell Bench Press, Incline Bench
 * Press, Shoulder Press, Military Press, … are all separate lifts, never folded
 * into one combined board). The empty list keeps the type/import surface stable
 * for any remaining references; nothing is ever grouped or scaled.
 */
export interface ExerciseGroup {
  name: string; // shown in the exercise picker; usually the reference lift's name
  members: Record<string, number>; // exact exercise name → scaling quotient (0..~1.1)
}

export const EXERCISE_GROUPS: ExerciseGroup[] = [];


/* ======================================================================== *
 * UNIFIED EXERCISE TAG REGISTRY — the single source of truth for grouping.
 *
 * Every way the app groups exercises (fine muscle groups, functional movement
 * patterns, "combinable" lifts merged into one, "comparable" lifts scaled onto
 * one curve) is declared ONCE here, as data. The keyword functions below
 * (muscleGroup, exerciseCategories) READ from these tables instead of carrying
 * their own copies, so there is only one place to edit a keyword set.
 *
 * AI-NOTE: this registry replaced the hand-maintained keyword blocks inside
 * muscleGroup()/exerciseCategories(). To change membership, edit the tables
 * here — the functions follow. Parity is locked by profile.test.ts.
 * ======================================================================== */

export type TagKind =
  | "muscle-group" // fine muscle: Quads, Hams, Glutes, Calves, Chest, Back, Shoulders, Biceps, Triceps, Core, …
  | "functional-pattern" // movement pattern: Hinge, Squat pattern, Deadlift pattern, Deadlift accessory, leg splits
  | "combinable-group" // members merged 1:1 into ONE synthetic lift (e.g. "SQ mix")
  | "comparable-group" // members scaled by a ratio onto ONE synthetic curve (e.g. "DL pattern")
  | "dissolvable"; // SCAFFOLD ONLY (not active): a future split of one entry into variants

export interface TagMember {
  /** Exact exercise name as logged. */
  exerciseName: string;
  /** Scaling quotient toward the group's reference lift. 1 = identical (combinable);
   * 0.8 = "80% of the reference" (comparable). scaleToGroup() DIVIDES by this. */
  ratio: number;
}

export interface RegistryTag {
  /** Stable key, e.g. "muscle.quads", "pattern.hinge", "combine.sq-mix". */
  id: string;
  kind: TagKind;
  /** Display name (also the synthetic exercise name for combinable/comparable). */
  label: string;
  /** Plain-language WHY, shown in the Index inspector. */
  why: string;
  /** Keyword substrings (lowercased) that put a name in this tag. */
  keywords?: string[];
  /** Explicit members for combinable/comparable/dissolvable groups. */
  members?: TagMember[];
  /** The exercise name the synthetic group emits records under (defaults to label). */
  derivedName?: string;
  /** Dissolvable scaffold: the exercise members would fold into (unused for now). */
  dissolveInto?: string;
}

/**
 * Fine muscle-group tags, IN PRIORITY ORDER (first match wins) — the exact
 * ordering and keyword sets that muscleGroup() used to hold inline, so output is
 * unchanged. The leading non-lift entries (Mobility/Cardio/Skill/Core) mirror
 * exerciseCategory()'s precedence so a skill or stretch never falls to a muscle.
 * Two special cases that aren't pure keyword matches stay in muscleGroup():
 * "handstand … push" → Shoulders, and a trailing deadlift/clean/snatch → Back.
 */
export const MUSCLE_GROUP_TAGS: RegistryTag[] = [
  { id: "muscle.mobility", kind: "muscle-group", label: "Mobility",
    why: "Stretching, splits, poses, breathwork — not a loaded muscle.",
    keywords: ["stretch", "split", "pancake", "pose", "mobility", "ankle", "posture", "breath", "cold shower", "meditation"] },
  { id: "muscle.cardio", kind: "muscle-group", label: "Cardio",
    why: "Conditioning / calorie work — not a strength muscle group.",
    keywords: ["run", "bike", "cardio", "stairs", "hike", "sprint", "cycle", "sled", "slege", "erg", "elliptical", "treadmill", "jump rope", "skipping", "stairmaster", "calorie"] },
  { id: "muscle.skill", kind: "muscle-group", label: "Skill",
    why: "Calisthenic skills (levers, planche, handstands, flags) — whole-body skill, not one muscle. A handstand PUSH-up is the exception: it trains shoulders.",
    keywords: ["front lever", "planche", "human flag", "maltese", "dragon flag", "handstand", "headstand", "forearm stand", "muscle up", "iron cross", "balance"] },
  { id: "muscle.core", kind: "muscle-group", label: "Core",
    why: "Trunk work: crunches, planks, leg/knee raises, rotation. Checked before legs/arms so an 'ab' or 'leg raise' doesn't read as legs.",
    keywords: ["crunch", "sit up", "situp", "sit-up", "plank", "leg raise", "legs raise", "knee raise", "knee tuck", "ab ", "ab wheel", "ab curl", "oblique", "side bend", "hollow", "woodchop", "pallof", "rollout", "twist", "bicycle", "mountain climber", "vacuum", "l-sit", "l sit", "lsit"] },
  { id: "muscle.calves", kind: "muscle-group", label: "Calves",
    why: "Calf raises and the like.",
    keywords: ["calf", "calves"] },
  { id: "muscle.hams", kind: "muscle-group", label: "Hamstrings",
    why: "Knee-flexion / hip-hinge posterior chain: leg curls, RDLs, good mornings, nordics.",
    keywords: ["leg curl", "romanian", "rdl", "stiff leg", "stiff-leg", "good morning", "nordic", "hamstring", "ham "] },
  { id: "muscle.glutes", kind: "muscle-group", label: "Glutes",
    why: "Hip-extension dominant: thrusts, bridges, abduction/adduction, back extensions.",
    keywords: ["hip thrust", "glute", "hip extension", "bridge", "hip abduction", "abduction", "abductor", "hip adduction", "adduction", "adductor", "back extension", "hyperextension", "reverse hyper"] },
  { id: "muscle.quads", kind: "muscle-group", label: "Quads",
    why: "Front-thigh dominant: squats, presses, extensions, lunges drive the knee.",
    keywords: ["squat", "leg press", "leg extension", "lunge", "hack", "sissy", "step up", "step-up", "pistol", "wall sit", "split squat", "bulgarian", "cossack", "belt squat", "quad"] },
  { id: "muscle.shoulders", kind: "muscle-group", label: "Shoulders",
    why: "Overhead and lateral delt work; shrugs. Checked before chest/back so a press isn't misread.",
    keywords: ["shoulder press", "overhead press", "lateral raise", "front raise", "rear delt", "upright row", "military", "behind the neck", "arnold", "shrug", "delt"] },
  { id: "muscle.triceps", kind: "muscle-group", label: "Triceps",
    why: "Elbow-extension: pushdowns, skulls, JM press, close-grip bench. Before chest so close-grip bench reads triceps.",
    keywords: ["tricep", "triceps", "pushdown", "skull", "jm press", "close grip bench", "close-grip bench"] },
  { id: "muscle.biceps", kind: "muscle-group", label: "Biceps",
    why: "Elbow-flexion: curls, preacher, hammer.",
    keywords: ["curl", "preacher", "hammer"] },
  { id: "muscle.chest", kind: "muscle-group", label: "Chest",
    why: "Horizontal push: bench, flyes, push-ups, dips.",
    keywords: ["bench", "chest", "fly", "pec", "push up", "pushup", "push-up", "pushups", "press up", "dip"] },
  { id: "muscle.back", kind: "muscle-group", label: "Back",
    why: "Pulling: rows, pulldowns, pull-ups, face pulls. (Deadlifts/cleans/snatches are added as posterior-chain pulls.)",
    keywords: ["row", "pulldown", "pull up", "pullup", "pull-up", "chin up", "chinup", "chin-up", "lat ", "lat pull", "pullover", "pull over", "face pull", "inverted row", "scapular"] },
];

/**
 * Functional movement-pattern tags. These overlay the muscle groups in
 * exerciseCategories() (a deadlift is a Hinge AND a Deadlift pattern AND Back…).
 * The "Squat pattern" / "Deadlift pattern" / "Deadlift accessory" / leg-split
 * keyword sets are the ones exerciseCategories() used to hold inline.
 */
export const FUNCTIONAL_PATTERN_TAGS: RegistryTag[] = [
  { id: "pattern.squat", kind: "functional-pattern", label: "Squat pattern",
    why: "Knee-dominant: anything with 'squat' in the name.",
    keywords: ["squat"] },
  { id: "pattern.deadlift", kind: "functional-pattern", label: "Deadlift pattern",
    why: "The deadlift family — conventional, Romanian, sumo, etc.",
    keywords: ["deadlift", "rdl", "romanian deadlift"] },
  { id: "pattern.deadlift-accessory", kind: "functional-pattern", label: "Deadlift accessory",
    why: "Posterior-chain work that supports the deadlift but isn't the main lift.",
    keywords: ["back extension", "hyperextension", "reverse hyper", "good morning", "glute ham", "ghr", "hip thrust", "rack pull", "snatch grip deadlift", "deficit deadlift", "block pull", "romanian deadlift", "rdl", "nordic"] },
  { id: "pattern.hinge", kind: "functional-pattern", label: "Hinge",
    why: "Hip-hinge movements (push the hips back, flat-ish back): deadlifts, RDLs, good mornings, back extensions, thrusts.",
    keywords: ["deadlift", "rdl", "romanian", "good morning", "back extension", "hyperextension", "reverse hyper", "nordic", "hip thrust"] },
];

/** Combinable groups: members are the SAME lift, merged 1:1 into one staple. */
export const COMBINABLE_GROUPS: RegistryTag[] = [
  { id: "combine.sq-mix", kind: "combinable-group", label: "SQ mix", derivedName: "SQ mix",
    why: "Back squat and Smith-machine squat are the same pattern at the same loading — combined into one staple for volume / frequency / progress. The pure lifts stay untouched; in the active-set filter each member still passes or fails on its own count.",
    members: [
      { exerciseName: "Squat", ratio: 1 },
      { exerciseName: "Smith Machine Squat", ratio: 1 },
    ] },
];

/**
 * Comparable groups: members are RELATED but lift different loads for the same
 * effort, so each is scaled by a ratio onto the reference lift's curve, creating
 * a NEW synthetic exercise (e.g. "DL pattern"). The pure lifts (Deadlift, RDL…)
 * are never changed. ratio = fraction of the reference: RDL ≈ 0.8 of a deadlift.
 */
export const COMPARABLE_GROUPS: RegistryTag[] = [
  { id: "compare.dl-pattern", kind: "comparable-group", label: "DL pattern", derivedName: "DL pattern",
    why: "Deadlift variants move different loads for the same effort. Each is scaled to a conventional-deadlift equivalent (RDL/stiff-leg ≈ 80%) so they sit on one curve. This is a NEW synthetic lift — Deadlift and RDL themselves are never altered.",
    members: [
      { exerciseName: "Deadlift", ratio: 1.0 },
      { exerciseName: "Romanian Deadlift", ratio: 0.8 },
      { exerciseName: "Straight Leg Deadlift", ratio: 0.8 },
      { exerciseName: "Stiff Leg Deadlift", ratio: 0.8 },
    ] },
];

/**
 * SCAFFOLD ONLY (not wired into anything yet): "dissolvable" tags describe an
 * entry that StrengthLevel logs as one exercise but is really several with very
 * different paths/loads (e.g. lat pulldown = cable vs gravity machine). The
 * future "dissolve" mode would split member sets out of the lumped entry.
 */
export const DISSOLVABLE_TAGS: RegistryTag[] = [
  { id: "dissolve.lat-pulldown", kind: "dissolvable", label: "Lat Pulldown (split soon)",
    why: "SCAFFOLD — not active yet. Lat pulldown is logged as one exercise but cable vs gravity-machine versions have very different paths and weights, so they should become separate exercises. Planned for a future task.",
    dissolveInto: "Lat Pulldown",
    members: [
      { exerciseName: "Cable Lat Pulldown", ratio: 1 },
      { exerciseName: "Machine Lat Pulldown", ratio: 1 },
    ] },
];

/** Every tag in the registry, all kinds concatenated. */
export const EXERCISE_REGISTRY: RegistryTag[] = [
  ...MUSCLE_GROUP_TAGS,
  ...FUNCTIONAL_PATTERN_TAGS,
  ...COMBINABLE_GROUPS,
  ...COMPARABLE_GROUPS,
  ...DISSOLVABLE_TAGS,
];

/** Does a (lowercased) name contain any of the keywords? */
const matchesKeywords = (lowerName: string, keywords: readonly string[] | undefined): boolean =>
  !!keywords && keywords.some((k) => lowerName.includes(k));

/**
 * Every registry tag an exercise belongs to — by keyword (muscle/pattern) or by
 * being an explicit member (combinable/comparable/dissolvable). Powers the Index
 * inspector's per-exercise tag list. Muscle groups use first-match-wins ordering
 * (like muscleGroup), so only the prime-mover muscle is returned for that kind.
 */
export function tagsForExercise(exerciseName: string): RegistryTag[] {
  const n = exerciseName.toLowerCase();
  const out: RegistryTag[] = [];
  const prime = MUSCLE_GROUP_TAGS.find((t) => matchesKeywords(n, t.keywords));
  if (prime) out.push(prime);
  for (const t of FUNCTIONAL_PATTERN_TAGS) if (matchesKeywords(n, t.keywords)) out.push(t);
  for (const t of [...COMBINABLE_GROUPS, ...COMPARABLE_GROUPS, ...DISSOLVABLE_TAGS])
    if (t.members?.some((m) => m.exerciseName === exerciseName)) out.push(t);
  return out;
}

/** Combinable groups this exact exercise name is a member of. */
export function combinableGroupsFor(exerciseName: string): RegistryTag[] {
  return COMBINABLE_GROUPS.filter((t) => t.members?.some((m) => m.exerciseName === exerciseName));
}

/** Comparable groups this exact exercise name is a member of. */
export function comparableGroupsFor(exerciseName: string): RegistryTag[] {
  return COMPARABLE_GROUPS.filter((t) => t.members?.some((m) => m.exerciseName === exerciseName));
}

/** A group's members that are actually present in a given list of exercise names. */
export function membersOfGroup(tag: RegistryTag, names: Iterable<string>): TagMember[] {
  const present = new Set(names);
  return (tag.members ?? []).filter((m) => present.has(m.exerciseName));
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

/** Finer muscle groups than {@link exerciseCategory} — the legs split into
 * Quads / Hamstrings / Glutes / Calves, and the upper body into Chest / Back /
 * Shoulders / Biceps / Triceps. Used by the Workouts view's "muscle groups"
 * mode. One PRIMARY group per exercise (the prime mover), chosen by keyword. */
export type MuscleGroup =
  | "Quads" | "Hamstrings" | "Glutes" | "Calves"
  | "Chest" | "Back" | "Shoulders" | "Biceps" | "Triceps"
  | "Core" | "Cardio" | "Mobility" | "Skill" | "Other";

export function muscleGroup(exerciseName: string): MuscleGroup {
  const n = exerciseName.toLowerCase();
  // First matching MUSCLE_GROUP_TAGS entry wins (the table is in priority order,
  // the same ordering this function used to hold inline — see the registry).
  const prime = MUSCLE_GROUP_TAGS.find((t) => matchesKeywords(n, t.keywords));
  if (prime) {
    // Special case: a handstand PUSH-up trains shoulders, not "skill".
    if (prime.id === "muscle.skill" && n.includes("push")) return "Shoulders";
    return prime.label as MuscleGroup;
  }
  // Posterior-chain pulls have no muscle keyword of their own → Back.
  if (n.includes("deadlift") || n.includes("clean") || n.includes("snatch")) return "Back";
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

  // Movement patterns (a squat/deadlift can belong to a pattern AND muscle
  // groups). Keyword sets come from FUNCTIONAL_PATTERN_TAGS so they live in one
  // place; the labels match LIST_CATEGORIES. (Hinge is a registry tag too but is
  // not a list category, so it isn't emitted here.)
  const pattern = (id: string) => FUNCTIONAL_PATTERN_TAGS.find((t) => t.id === id)!;
  if (matchesKeywords(n, pattern("pattern.squat").keywords)) add("Squat pattern");
  if (matchesKeywords(n, pattern("pattern.deadlift").keywords)) add("Deadlift pattern");
  // Posterior-chain work that supports the deadlift (not the main lift itself).
  if (matchesKeywords(n, pattern("pattern.deadlift-accessory").keywords)) add("Deadlift accessory");

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
