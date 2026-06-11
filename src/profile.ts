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

/**
 * Body fat is never known exactly, so we carry it as a small DISTRIBUTION rather
 * than one number: a 50% confidence band, a 95% band, and the average. All are
 * fractions (0.35 = 35%). low95 ≤ low50 ≤ avg ≤ high50 ≤ high95.
 */
export interface BodyFatDist {
  low95: number;
  low50: number;
  avg: number;
  high50: number;
  high95: number;
}

/** Clamp a body-fat fraction to a sane range (0–75%). */
const clampBf = (x: number): number => Math.max(0, Math.min(0.75, x));

/**
 * A sensible DEFAULT body-fat distribution around a single estimate: a symmetric
 * ±3 points at 50% and ±6 points at 95% confidence (so the error margins are
 * equal either side of the average). Only a starting point — the owner edits the
 * five numbers on the stats page.
 */
export function defaultBodyFatDist(bodyFat: number): BodyFatDist {
  const avg = clampBf(bodyFat);
  return {
    low95: clampBf(avg - 0.06),
    low50: clampBf(avg - 0.03),
    avg,
    high50: clampBf(avg + 0.03),
    high95: clampBf(avg + 0.06),
  };
}

/** Order + clamp five raw body-fat inputs into a valid distribution (sorted, so
 * the bands never cross even if typed out of order). */
export function normalizeBodyFatDist(d: BodyFatDist): BodyFatDist {
  const [low95, low50, avg, high50, high95] = [d.low95, d.low50, d.avg, d.high50, d.high95]
    .map(clampBf)
    .sort((a, b) => a - b);
  return { low95: low95!, low50: low50!, avg: avg!, high50: high50!, high95: high95! };
}

export interface NffmiRange {
  avg: number; lo50: number; hi50: number; lo95: number; hi95: number; leanAvg: number;
}

/**
 * nFFMI as a RANGE, propagating the body-fat distribution's uncertainty. nFFMI
 * falls as body fat rises (less lean mass), so the HIGH-fat end gives the LOW
 * nFFMI and vice-versa — the band is flipped and returned already ascending
 * (lo ≤ avg ≤ hi). Returns null if the base inputs can't yield a real number.
 */
export function nffmiRange(weight: number, height: number, dist: BodyFatDist): NffmiRange | null {
  const at = (bf: number) => bodyComposition({ weight, height, bodyFat: bf });
  const a = at(dist.avg);
  const lo95 = at(dist.high95), lo50 = at(dist.high50), hi50 = at(dist.low50), hi95 = at(dist.low95);
  if (!a || !lo95 || !lo50 || !hi50 || !hi95) return null;
  return { avg: a.nffmi, lo50: lo50.nffmi, hi50: hi50.nffmi, lo95: lo95.nffmi, hi95: hi95.nffmi, leanAvg: a.leanMass };
}

export interface MassRange { avg: number; lo50: number; hi50: number; lo95: number; hi95: number; }
export interface BodyMass { lean: MassRange; fat: MassRange; }
/**
 * Lean mass and fat mass (kg) as RANGES, propagating the body-fat band's
 * uncertainty. fat = weight × bf, lean = weight × (1 − bf). Fat rises with body
 * fat; lean falls — so lean's band is flipped (the high-fat end gives the least
 * lean mass) and both are returned already ascending (lo ≤ avg ≤ hi).
 */
export function bodyMassRanges(weight: number, dist: BodyFatDist): BodyMass {
  const fat = (bf: number) => weight * bf;
  const lean = (bf: number) => weight * (1 - bf);
  return {
    fat: { avg: fat(dist.avg), lo50: fat(dist.low50), hi50: fat(dist.high50), lo95: fat(dist.low95), hi95: fat(dist.high95) },
    lean: { avg: lean(dist.avg), lo50: lean(dist.high50), hi50: lean(dist.low50), lo95: lean(dist.high95), hi95: lean(dist.low95) },
  };
}

export interface NaturalPotential {
  /** Likely lifetime natural LEAN mass (kg) at the drug-free nFFMI ceiling band. */
  leanLimit: MassRange;
  /** Ideal bodyweight (kg) at that lean ceiling, carried at a sport-typical body
   * fat: lean & light for calisthenics, a bit heavier for power/weightlifting. */
  idealCalisthenics: MassRange;
  idealPower: MassRange;
  /** The assumed sport body-fat fractions (so the UI can explain them). */
  caliBf: number;
  powerBf: number;
  /** The nFFMI ceiling used (avg of the band). */
  ceilingNffmi: number;
}
/**
 * A likely LIFETIME NATURAL ceiling, from the well-documented drug-free nFFMI
 * cap (~25 for men, ~21.5 for women; Kouri et al.) applied at this person's
 * height. Lean limit = (nFFMI − 6.1·(1.8−h))·h² across a small ceiling band
 * (exceptional genetics sit a touch higher). The "ideal" sport weights put that
 * same lean ceiling at the body fat those athletes typically carry — leaner for
 * calisthenics (better strength-to-weight), a bit fuller for power/weightlifting.
 * Estimates only: genetics, frame and training history all move the real number.
 */
export function naturalPotential(height: number, sex: "m" | "f", ceilingOverride?: number): NaturalPotential | null {
  const h = height / 100;
  if (!(h > 0)) return null;
  // Default drug-free nFFMI cap (Kouri et al.); the owner may override it per athlete
  // (e.g. exceptional genetics) — the ±1 band is kept around the chosen centre.
  const ceil = ceilingOverride && ceilingOverride > 0
    ? { lo: ceilingOverride - 1, avg: ceilingOverride, hi: ceilingOverride + 1 }
    : sex === "f" ? { lo: 20.5, avg: 21.5, hi: 22.5 } : { lo: 24, avg: 25, hi: 26 };
  const lean = (nffmi: number) => Math.max(0, (nffmi - 6.1 * (1.8 - h)) * h * h);
  const leanLimit: MassRange = {
    lo95: lean(ceil.lo),
    lo50: lean((ceil.lo + ceil.avg) / 2),
    avg: lean(ceil.avg),
    hi50: lean((ceil.avg + ceil.hi) / 2),
    hi95: lean(ceil.hi),
  };
  const caliBf = sex === "f" ? 0.16 : 0.08;
  const powerBf = sex === "f" ? 0.22 : 0.14;
  const atBf = (r: MassRange, bf: number): MassRange => ({
    lo95: r.lo95 / (1 - bf), lo50: r.lo50 / (1 - bf), avg: r.avg / (1 - bf), hi50: r.hi50 / (1 - bf), hi95: r.hi95 / (1 - bf),
  });
  return { leanLimit, idealCalisthenics: atBf(leanLimit, caliBf), idealPower: atBf(leanLimit, powerBf), caliBf, powerBf, ceilingNffmi: ceil.avg };
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

/** True for bar pull-up / chin-up / dip movements, where a *negative* logged weight
 * means assistance from a machine (not added load). Excludes pulldowns, pull
 * overs and other cable "pull" work, which are always loaded positively. */
export function isAssistablePullup(exerciseName: string): boolean {
  return /pull[\s-]?ups?|chin[\s-]?ups?|dips?/.test(exerciseName.toLowerCase());
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
 * Real assistance after a per-exercise override is taken into account. `assisted`
 * is the caller's effective decision (a manual on/off toggle, defaulting to the
 * name auto-detect). When the lift is assisted and the logged weight is negative
 * (a machine counterweight that reads ~2× the real help), it's halved; otherwise
 * the value passes through. Keeps the override logic out here so it's unit-tested.
 */
export function assistedRealWeight(weight: number | null, assisted: boolean): number | null {
  if (weight === null || weight >= 0) return weight;
  return assisted ? weight / 2 : weight;
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
  /** Exact exercise names (case-insensitive) ALWAYS in this tag, even without a
   * keyword match — for hand-curated membership the keywords can't express. */
  include?: string[];
  /** Exact exercise names (case-insensitive) NEVER in this tag, even if a keyword
   * matched — overrides a too-broad keyword. */
  exclude?: string[];
  /** Explicit members for combinable/comparable/dissolvable groups. */
  members?: TagMember[];
  /** The exercise name the synthetic group emits records under (defaults to label). */
  derivedName?: string;
  /** Dissolvable scaffold: the exercise members would fold into (unused for now). */
  dissolveInto?: string;
  /** Default display for a combine/comparison group: "combined" shows ONLY the
   * merged lift (members hidden), "members" shows only the members, "both" shows
   * all. Combine (1:1 merge) groups default "combined" — they ARE one lift; the
   * owner overrides per group. Omitted = "both". */
  defaultDisplay?: "combined" | "members" | "both";
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
  { id: "muscle.core", kind: "muscle-group", label: "Core",
    why: "Trunk work: crunches, planks, leg/knee raises, rotation. Checked before legs/arms so an 'ab' or 'leg raise' doesn't read as legs.",
    keywords: ["crunch", "sit up", "situp", "sit-up", "plank", "leg raise", "legs raise", "knee raise", "knee tuck", "ab ", "ab wheel", "ab curl", "oblique", "side bend", "hollow", "woodchop", "pallof", "rollout", "twist", "bicycle", "mountain climber", "vacuum", "l-sit", "l sit", "lsit"] },
  { id: "muscle.calves", kind: "muscle-group", label: "Calves",
    why: "Calf raises and the like.",
    keywords: ["calf", "calves"] },
  { id: "muscle.hams", kind: "muscle-group", label: "Hamstrings",
    why: "Knee-flexion / hip-hinge posterior chain: leg curls, RDLs, good mornings, nordics.",
    keywords: ["leg curl", "romanian", "rdl", "stiff leg", "stiff-leg", "good morning", "nordic", "hamstring", "ham "] },
  // Hip abductors / adductors before Glutes, so an abduction/adduction lift reads
  // as its own muscle rather than being lumped into the glutes.
  { id: "muscle.abductors", kind: "muscle-group", label: "Abductors",
    why: "Hip abduction — driving the leg out to the side: hip-abduction machine, cable/band abductions, clamshells.",
    keywords: ["hip abduction", "abduction", "abductor", "clamshell", "clam shell"] },
  { id: "muscle.adductors", kind: "muscle-group", label: "Adductors",
    why: "Hip adduction — drawing the leg in toward the midline: adductor machine, cable/band adductions, Copenhagen plank.",
    keywords: ["hip adduction", "adduction", "adductor", "copenhagen"] },
  { id: "muscle.glutes", kind: "muscle-group", label: "Glutes",
    why: "Hip-extension dominant: thrusts, bridges, hip extension.",
    keywords: ["hip thrust", "glute", "hip extension", "bridge"] },
  { id: "muscle.quads", kind: "muscle-group", label: "Quads",
    why: "Front-thigh dominant: squats, presses, extensions, lunges drive the knee.",
    keywords: ["squat", "leg press", "leg extension", "lunge", "hack", "sissy", "step up", "step-up", "pistol", "wall sit", "split squat", "bulgarian", "cossack", "belt squat", "quad"] },
  { id: "muscle.shoulders", kind: "muscle-group", label: "Shoulders",
    why: "Overhead and lateral delt work. Checked before chest/back so a press isn't misread. (Shrugs/traps go to Upper back.)",
    keywords: ["shoulder press", "overhead press", "lateral raise", "front raise", "rear delt", "upright row", "military", "behind the neck", "arnold", "delt", "handstand push", "handstand pushup", "handstand push-up", "hspu"] },
  { id: "muscle.triceps", kind: "muscle-group", label: "Triceps",
    why: "Elbow-extension: pushdowns, skulls, JM press, close-grip bench. Before chest so close-grip bench reads triceps.",
    keywords: ["tricep", "triceps", "pushdown", "skull", "jm press", "close grip bench", "close-grip bench"] },
  { id: "muscle.forearms", kind: "muscle-group", label: "Forearms",
    why: "Grip & wrist work: wrist curls, dead hangs, farmer's carries, pinch/finger and forearm work. Before biceps so a 'wrist curl' isn't read as a biceps curl.",
    keywords: ["forearm", "wrist", "grip", "dead hang", "farmer", "suitcase", "pinch", "finger", "reverse curl"] },
  { id: "muscle.biceps", kind: "muscle-group", label: "Biceps",
    why: "Elbow-flexion: curls, preacher, hammer.",
    keywords: ["curl", "preacher", "hammer"] },
  { id: "muscle.chest", kind: "muscle-group", label: "Chest",
    why: "Horizontal push: bench, flyes, push-ups, dips.",
    keywords: ["bench", "chest", "fly", "pec", "push up", "pushup", "push-up", "pushups", "press up", "dip"] },
  // "Back" is split into finer regions (the owner's anatomy). Lower back and the
  // upper-upper back (traps/rhomboids) come before the lats, then the lats split
  // by movement: vertical pulls vs horizontal rows.
  { id: "muscle.lower-back", kind: "muscle-group", label: "Lower back",
    why: "Erector spinae / lower back: back extensions, hyperextensions, good mornings — and the bracing of a heavy deadlift.",
    keywords: ["back extension", "hyperextension", "reverse hyper", "erector", "lower back", "good morning", "jefferson", "superman"] },
  { id: "muscle.upper-back", kind: "muscle-group", label: "Upper back",
    why: "The 'upper-upper' back — traps and rhomboids: shrugs, rack pulls, face pulls, scapular work. Sits above the lats.",
    keywords: ["shrug", "trap ", "rhomboid", "face pull", "scapular", "rack pull", "high pull"] },
  { id: "muscle.lats", kind: "muscle-group", label: "Lats",
    why: "Lats / mid-back: vertical pulls (pull-ups, chin-ups, pulldowns, pullovers) and horizontal rows (barbell, dumbbell, cable, machine, inverted).",
    keywords: ["pulldown", "pull up", "pullup", "pull-up", "chin up", "chinup", "chin-up", "pull over", "pullover", "lat pull", "lat ", "row", "inverted row", "seal row"],
    include: ["Inverted deadlift"] },
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
    why: "The deadlift family and the main hip-hinge lifts — conventional/sumo/RDL deadlifts, good mornings and back extensions.",
    keywords: ["deadlift", "rdl", "romanian deadlift", "good morning", "back extension"],
    // Holds and the one-arm side deadlift are accessories; the inverted deadlift is a lats row.
    exclude: ["Deadlift hold", "Barbell One Arm Side Deadlift", "Inverted deadlift"] },
  { id: "pattern.deadlift-accessory", kind: "functional-pattern", label: "Deadlift accessory",
    why: "Posterior-chain support work — hip thrusts, glute-ham / nordic curls, reverse hypers, rack pulls and the odd deadlift variants — not the main hinge.",
    keywords: ["rdl", "romanian deadlift", "glute ham", "ghr", "hip thrust", "rack pull", "snatch grip deadlift", "deficit deadlift", "block pull", "nordic", "reverse hyper", "hyperextension"],
    include: ["Deadlift hold", "Barbell One Arm Side Deadlift"],
    // The plain RDLs are the deadlift pattern, not accessories (variant RDLs stay).
    exclude: ["Romanian Deadlift", "Single Leg Romanian Deadlift"] },
  { id: "pattern.hinge", kind: "functional-pattern", label: "Hinge",
    why: "Hip-hinge movements (push the hips back, flat-ish back): deadlifts, RDLs, good mornings, back extensions, thrusts.",
    keywords: ["deadlift", "rdl", "romanian", "good morning", "back extension", "hyperextension", "reverse hyper", "nordic", "hip thrust"],
    exclude: ["Inverted deadlift"] },
  // Push / pull split by plane (vertical vs horizontal) + core. (Calisthenics is a
  // DISCIPLINE, not a movement pattern, so it's not a function here.)
  { id: "pattern.vpull", kind: "functional-pattern", label: "Vertical pull",
    why: "Pulling DOWN to you / yourself UP: pull-ups, chin-ups, lat pulldowns, muscle-ups.",
    keywords: ["pull up", "pullup", "pull-up", "chin up", "chinup", "chin-up", "pulldown", "lat pull", "muscle up", "muscleup"] },
  { id: "pattern.hpull", kind: "functional-pattern", label: "Horizontal pull",
    why: "Pulling toward you on the horizontal: barbell/dumbbell/cable rows, inverted rows, face pulls.",
    keywords: ["row", "inverted row", "australian", "face pull", "rear delt"],
    exclude: ["Upright Row"] }, // upright row is a vertical shoulder pull
  { id: "pattern.vpush", kind: "functional-pattern", label: "Vertical push",
    why: "Pressing overhead: shoulder/overhead/military press, handstand & pike push-ups.",
    keywords: ["shoulder press", "overhead press", "military", "handstand push", "handstand pushup", "pike push", "push press", "arnold", "hspu", "behind the neck"] },
  { id: "pattern.hpush", kind: "functional-pattern", label: "Horizontal push",
    why: "Pressing away on the horizontal: bench press, push-ups, dips, chest flyes.",
    keywords: ["bench", "push up", "pushup", "push-up", "dip", "chest press", "fly", "pec"],
    exclude: ["Handstand Push Ups", "Handstand Push Up", "Pike Push Up", "Pike Push Ups"] }, // those are vertical
  { id: "pattern.core", kind: "functional-pattern", label: "Core",
    why: "Trunk work: crunches, sit-ups, planks, leg/knee raises, hollows, rotation, L-sits, levers.",
    keywords: ["crunch", "sit up", "situp", "sit-up", "plank", "leg raise", "legs raise", "knee raise", "knee tuck", "ab ", "ab wheel", "ab curl", "oblique", "side bend", "hollow", "woodchop", "pallof", "rollout", "twist", "bicycle", "mountain climber", "l-sit", "lsit", "toes to bar", "hanging leg", "hanging knee", "dragon flag", "front lever", "windshield"] },
];

/** Combinable groups: members are the SAME lift, merged 1:1 into one staple. They
 * default to showing ONLY the combined lift (the members are hidden) — they ARE one
 * lift; flip to Members/Both per group in the combine settings. */
export const COMBINABLE_GROUPS: RegistryTag[] = [
  { id: "combine.sq-mix", kind: "combinable-group", label: "SQ mix", derivedName: "SQ mix", defaultDisplay: "combined",
    why: "Back squat and Smith-machine squat are the same pattern at the same loading — combined into one staple for volume / frequency / progress. The pure lifts stay untouched; in the active-set filter each member still passes or fails on its own count.",
    members: [
      { exerciseName: "Squat", ratio: 1 },
      { exerciseName: "Smith Machine Squat", ratio: 1 },
    ] },
  { id: "combine.pull-mix", kind: "combinable-group", label: "Pull/Chin", derivedName: "Pull/Chin", defaultDisplay: "combined",
    why: "Pull-ups and chin-ups are the same vertical pull at the same loading — combined into one staple for volume / frequency / progress. The pure lifts stay untouched; in the active-set filter each member still passes or fails on its own count.",
    members: [
      { exerciseName: "Pull Ups", ratio: 1 },
      { exerciseName: "Chin Ups", ratio: 1 },
    ] },
  { id: "combine.pushup-mix", kind: "combinable-group", label: "Push Up", derivedName: "Push Up", defaultDisplay: "combined",
    why: "Floor push-ups and Smith-machine incline close-grip push-ups are merged into one Push Up staple, shown together by default. The Smith-incline sets stay as logged — each is auto-scaled to a floor-equivalent EFFORT by its incline note (a height in cm, a squat-rack hole, or a Smith notch; higher = easier), or flagged for review if the note isn't recognised. Volume / frequency / progress read as one lift.",
    members: [
      { exerciseName: "Push Ups", ratio: 1 },
      { exerciseName: "Smith Machine Incline Close Grip Push Up", ratio: 1 },
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
  { id: "compare.squat-pattern", kind: "comparable-group", label: "Squat pattern", derivedName: "Squat pattern",
    why: "Knee-dominant squats train the same pattern at different loads, so each is scaled to a back-squat equivalent and put on one curve. Smith squat ≈ same load (guided bar); front squat ≈ 85% (front-rack limits load); dumbbell ≈ 60% and goblet ≈ 55% (grip / how the weight's held cap the load well below a barbell). A NEW synthetic lift; the pure squats are never altered. Tune any ratio in the group's settings.",
    members: [
      { exerciseName: "Squat", ratio: 1.0 },
      { exerciseName: "Smith Machine Squat", ratio: 1.0 },
      { exerciseName: "Front Squat", ratio: 0.85 },
      { exerciseName: "Dumbbell Squat", ratio: 0.6 },
      { exerciseName: "Goblet Squat", ratio: 0.55 },
    ] },
  { id: "compare.bench-pattern", kind: "comparable-group", label: "Bench pattern", derivedName: "Bench pattern",
    why: "Barbell and dumbbell bench press train the same push at different loads — dumbbells sit around 90% of the barbell for the same effort, so they're scaled onto one curve. A NEW synthetic lift; the pure presses are never altered.",
    members: [
      { exerciseName: "Bench Press", ratio: 1.0 },
      { exerciseName: "Dumbbell Bench Press", ratio: 0.9 },
    ] },
  // (The push-ups are now a COMBINABLE group — "Push Up" above — not a scaled
  // comparison: the Smith-incline sets fold in scaled per-set by their incline note.)
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
 * Membership of a keyword tag (muscle group / functional pattern) for one name,
 * honouring the hand-curated overrides: an exact `exclude` name forces OUT, an
 * exact `include` name forces IN, otherwise it's the keyword match. `lowerName`
 * is the lowercased exercise name.
 */
const tagMatches = (lowerName: string, tag: RegistryTag): boolean => {
  if (tag.exclude?.some((e) => e.toLowerCase() === lowerName)) return false;
  if (tag.include?.some((i) => i.toLowerCase() === lowerName)) return true;
  return matchesKeywords(lowerName, tag.keywords);
};

/**
 * Every registry tag an exercise belongs to — by keyword/override (muscle/
 * pattern) or by being an explicit member (combinable/comparable/dissolvable).
 * Powers the Index inspector's per-exercise tag list. Muscle groups use
 * first-match-wins ordering (like muscleGroup), so only the prime-mover muscle
 * is returned for that kind.
 */
export function tagsForExercise(exerciseName: string): RegistryTag[] {
  const n = exerciseName.toLowerCase();
  const out: RegistryTag[] = [];
  const prime = MUSCLE_GROUP_TAGS.find((t) => tagMatches(n, t));
  if (prime) out.push(prime);
  for (const t of FUNCTIONAL_PATTERN_TAGS) if (tagMatches(n, t)) out.push(t);
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
 * Every exercise in `names` that belongs to `tag` — by prime muscle (muscle
 * groups), by keyword (functional patterns), or by explicit membership
 * (combinable / comparable / dissolvable). Powers the Index "browse groups"
 * view so you can open a group and see exactly which lifts fall under it.
 */
export function exercisesForTag(tag: RegistryTag, names: Iterable<string>): string[] {
  const out: string[] = [];
  for (const name of names) {
    let inIt: boolean;
    if (tag.kind === "muscle-group") inIt = muscleGroup(name) === tag.label;
    else if (tag.kind === "functional-pattern") inIt = tagMatches(name.toLowerCase(), tag);
    else inIt = !!tag.members?.some((m) => m.exerciseName === name);
    if (inIt) out.push(name);
  }
  return out;
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
  | "Dynamic"
  | "Skill"
  | "Mobility"
  | "Posture"
  | "Cardio"
  | "Other";
export const TRAINING_CATEGORIES: TrainingCategory[] = [
  "Legs", "Chest", "Back", "Shoulders", "Arms", "Core", "Dynamic", "Skill", "Mobility", "Posture", "Cardio", "Other",
];

/**
 * Owner's curated category fixes, highest precedence — exercises the keyword
 * logic gets wrong or that belong to the hand-made buckets. Returns the PRIMARY
 * training category, or null to fall through to the keyword rules. `n` is the
 * lowercased name. Kept in one place so exerciseCategory and exerciseCategories
 * agree.
 *   • Dynamic   explosive locomotion / plyometrics (long jump, wall climbs)
 *   • Posture   posture drills (the "POST …" prefix the owner uses)
 *   • Mobility  stretches (the "POS …" prefix)
 *   • Arms      grip / forearm / loaded-carry / rotator-cuff work + the owner's
 *               hand-marked holds (front support, overhead hold, person lift)
 *   • Core      bent-knee hip raise
 */
export function categoryOverride(n: string): TrainingCategory | null {
  if (/\b(?:long|broad|box) jump\b|wall climb|\bplyo|leg hop|\bhop\b/.test(n)) return "Dynamic";
  if (/\bkong\b/.test(n)) return "Skill";
  if (/^pos\b|^post\b|posture/.test(n)) return "Posture"; // POS/POST = posture (STRETCH… stays Mobility)
  if (/cold shower|meditation/.test(n)) return "Other"; // recovery/mental, not a mobility drill
  if (/crunch/.test(n)) return "Core"; // "crunch" contains "run" → keep it out of Cardio
  if (/split squat|bulgarian/.test(n)) return "Legs"; // "split" must not read as a stretch
  if (/leg press/.test(n)) return "Legs"; // e.g. "Sled Leg Press" — sled ≠ cardio here
  if (/^leg (?:straight )?-?\d/.test(n)) return "Core"; // bodyweight leg-raise angles
  if (/grip|dead hang|\bhang \d|farmer|suitcase|\bcarry\b|plate ?(?:lift|pull|pinch)|pinch|internal rotation|external rotation|forearm|\bwrist\b|finger|front support|overhead hold|person lift/.test(n))
    return "Arms";
  if (/bent knee hip raise/.test(n)) return "Core";
  return null;
}

/**
 * Best-guess muscle/movement category for an exercise, by keyword — so the athlete
 * page can show what someone has actually been training. Order matters: skills and
 * non-lifts are matched before the muscle groups so "front lever row" is a Skill,
 * not Back, and a "hamstring stretch" is Mobility, not Legs.
 */
export function exerciseCategory(exerciseName: string): TrainingCategory {
  const n = exerciseName.toLowerCase();
  const ov = categoryOverride(n);
  if (ov) return ov; // owner's curated fixes win
  const has = (...k: string[]) => k.some((s) => n.includes(s));

  if (has("stretch", "split", "pancake", "pose", "tailor", "meditation", "breath", "cold shower", "mobility", "ankle", "posture", "head aware"))
    return "Mobility";
  if (/\brun/.test(n) || has("bike", "cardio", "stairs", "hike", "sprint", "skateboard", "cycle", "sled", "slege", "erg", "elliptical", "treadmill", "jump rope", "skipping", "stairmaster", "calorie"))
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
  if (has("row", "pulldown", "pull up", "pullup", "pull-up", "chin up", "chinup", "lat ", "lat pull", "pull over", "pullover", "face pull", "inverted row", "scapular", "back extension", "hyperextension", "reverse hyper", "lower back", "erector"))
    return "Back";
  if (has("squat", "deadlift", "lunge", "leg press", "leg curl", "leg extension", "calf", "hip thrust", "glute", "rdl", "romanian", "good morning", "hamstring", "ham ", "quad", "pistol", "step up", "step-up", "hack", "belt squat", "cossack", "sissy", "hip abduction", "hip adduction", "abductor", "adductor", "nordic", "wall sit", "clean", "snatch", "kettlebell"))
    return "Legs";
  return "Other";
}

/**
 * Training DISCIPLINE — the *style* of training a lift belongs to, the dimension
 * the owner edits as "Discipline" (muscle group covers anatomy separately). A lift
 * can fit several (handstand = Balance + Calisthenics), so the editor is
 * multi-select; this returns the single best-guess PRIMARY for a fresh lift.
 * (There is no "Skill" discipline — bodyweight skills are just Calisthenics.)
 */
export type Discipline =
  | "Strength"
  | "Calisthenics"
  | "Statics"
  | "Mobility"
  | "Dynamic"
  | "Posture"
  | "Cardio"
  | "Balance"
  | "Parkour"
  | "Climbing"
  | "Other";
export const DISCIPLINES: Discipline[] = [
  "Strength", "Calisthenics", "Statics", "Mobility", "Dynamic", "Posture",
  "Cardio", "Balance", "Parkour", "Climbing", "Other",
];
/** Best-guess primary discipline by keyword; everything loaded falls to
 * Strength (the owner re-tags from there as needed). */
export function exerciseDiscipline(exerciseName: string): Discipline {
  const n = exerciseName.toLowerCase();
  const has = (...k: string[]) => k.some((s) => n.includes(s));
  if (has("climb", "campus", "hangboard", "fingerboard", "crimp", "boulder")) return "Climbing";
  if (has("parkour", "vault", "kong", "precision jump", "cat leap", "wall run", "wall climb")) return "Parkour";
  if (has("stretch", "split", "pancake", "tailor", "mobility", "ankle", "breath", "cold shower", "meditation", "pose")) return "Mobility";
  if (/^pos\b|^post\b|posture/.test(n)) return "Posture";
  // Cardio — but a "sled LEG PRESS" or a "bicycle CRUNCH" are strength/core moves
  // that merely share a word, so those are excluded and fall through to strength.
  if ((/\brun/.test(n) || has("bike", "cardio", "stairs", "hike", "sprint", "cycle", "sled", "slege", "erg", "elliptical", "treadmill", "jump rope", "skipping", "stairmaster", "calorie")) && !/crunch|leg press|leg-press/.test(n))
    return "Cardio";
  // Statics — TIME-BASED holds (reps logged as seconds): planks, L-sits, dead
  // hangs, supports, wall sits, isometric holds. Checked AFTER Cardio & flexibility
  // (Mobility) above so those time-based styles stay where they belong. Also catch
  // a few inherently-static skills (levers / planche / flag / iron cross) that hold
  // a position even when the name omits "hold".
  if (isIsometric(n) || has("wall sit", "front lever", "planche", "human flag", "iron cross", "maltese") ) return "Statics";
  // Bodyweight SKILLS (handstands, muscle-ups, levers, flags, L-sits…) are just
  // Calisthenics now — there's no separate "Skill" discipline.
  if (has("front lever", "planche", "human flag", "maltese", "dragon flag", "handstand", "headstand", "forearm stand", "muscle up", "iron cross", "l-sit", "l sit", "lsit", "lever", "flag")) return "Calisthenics";
  if (has("balance", "slackline", "beam", "one-leg", "single-leg balance")) return "Balance";
  if (has("jump", "plyo", "hop", "explosive", "clap", "throw", "slam", "ballistic", "bound")) return "Dynamic";
  // Calisthenics = BODYWEIGHT moves; a "machine" anything is strength, not calisthenics.
  if (!n.includes("machine") && has("pull up", "pullup", "pull-up", "chin up", "chinup", "push up", "pushup", "push-up", "pushups", "dip", "ring", "bodyweight", "pistol", "bar muscle", "inverted row", "australian"))
    return "Calisthenics";
  return "Strength";
}
/** All disciplines a lift defaults into (one or more): the primary, plus any extra
 * that clearly also applies — e.g. a wall climb / run-up / vault is also Parkour. */
export function exerciseDisciplines(exerciseName: string): Discipline[] {
  const out: Discipline[] = [exerciseDiscipline(exerciseName)];
  const n = exerciseName.toLowerCase();
  if (/wall climb|wall run|run ?up|vault|\bkong\b|cat leap|precision jump|parkour|rag wall/.test(n) && !out.includes("Parkour"))
    out.push("Parkour");
  return out;
}

/**
 * JOINT MOVEMENTS — the biomechanical action(s) a lift trains, used by the Index
 * "Joint movement" grouping. Multi-membership: a squat is hip + knee extension, a
 * bench is shoulder horizontal adduction + elbow extension. Keyword-based; a lift
 * with no match simply doesn't appear under this grouping.
 */
export const JOINT_MOVEMENTS: string[] = [
  "Shoulder horizontal adduction", "Shoulder horizontal abduction", "Shoulder abduction",
  "Shoulder flexion", "Shoulder extension", "Elbow flexion", "Elbow extension",
  "Hip extension", "Hip flexion", "Hip abduction", "Hip adduction",
  "Knee extension", "Knee flexion", "Spinal flexion", "Spinal extension",
  "Trunk rotation", "Anti-rotation / anti-extension", "Ankle plantarflexion",
];
const JOINT_KEYWORDS: [string, string[]][] = [
  ["Shoulder horizontal adduction", ["bench", "chest press", "chest fly", "pec fly", "pec deck", "push up", "pushup", "push-up", "pushups", "press up", "fly", "dip"]],
  ["Shoulder horizontal abduction", ["row", "rear delt", "reverse fly", "face pull", "inverted row", "seal row"]],
  ["Shoulder abduction", ["lateral raise", "side raise", "upright row"]],
  ["Shoulder flexion", ["front raise", "shoulder press", "overhead press", "military", "ohp", "handstand push"]],
  ["Shoulder extension", ["pullover", "pull over", "straight arm", "pulldown", "lat pull", "pull up", "pullup", "pull-up", "chin up", "chinup"]],
  ["Elbow flexion", ["curl", "chin up", "chinup", "preacher", "hammer"]],
  ["Elbow extension", ["tricep", "triceps", "pushdown", "skull", "jm press", "close grip", "close-grip", "dip", "bench", "overhead press", "shoulder press", "military", "press up", "push up", "pushup"]],
  ["Hip extension", ["squat", "deadlift", "hip thrust", "glute", "lunge", "rdl", "romanian", "good morning", "step up", "step-up", "bridge", "hyperextension", "back extension", "kettlebell swing"]],
  ["Hip flexion", ["leg raise", "legs raise", "knee raise", "knee tuck", "hanging", "l-sit", "l sit", "lsit", "sit up", "situp", "sit-up"]],
  ["Hip abduction", ["hip abduction", "abduction", "abductor"]],
  ["Hip adduction", ["hip adduction", "adduction", "adductor"]],
  ["Knee extension", ["squat", "leg extension", "leg press", "lunge", "step up", "step-up", "sissy", "hack", "pistol", "wall sit"]],
  ["Knee flexion", ["leg curl", "hamstring", "ham ", "nordic"]],
  ["Spinal flexion", ["crunch", "sit up", "situp", "sit-up"]],
  ["Spinal extension", ["back extension", "hyperextension", "reverse hyper", "superman", "good morning"]],
  ["Trunk rotation", ["twist", "woodchop", "russian twist", "oblique", "bicycle"]],
  ["Anti-rotation / anti-extension", ["plank", "pallof", "hollow", "ab wheel", "rollout", "l-sit", "l sit", "lsit", "front lever", "planche", "dragon flag"]],
  ["Ankle plantarflexion", ["calf", "calves"]],
];
/** Every joint movement an exercise trains (one or more), by keyword. */
export function jointMovements(exerciseName: string): string[] {
  const n = exerciseName.toLowerCase();
  const out: string[] = [];
  for (const [bucket, kws] of JOINT_KEYWORDS)
    if (kws.some((k) => n.includes(k)) && !out.includes(bucket)) out.push(bucket);
  return out;
}

/** Finer muscle groups than {@link exerciseCategory} — the legs split into
 * Quads / Hamstrings / Glutes / Calves, and the upper body into Chest / Back /
 * Shoulders / Biceps / Triceps. Used by the Workouts view's "muscle groups"
 * mode. One PRIMARY group per exercise (the prime mover), chosen by keyword. */
// Muscle group = ANATOMY only (no Cardio / Mobility / Skill — those are training
// disciplines now; see {@link Discipline}). The lats are one group (vertical pulls
// and horizontal rows together). "Other" is the internal fallback for a lift with
// no clear prime mover; it is not offered as a pickable option.
export type MuscleGroup =
  | "Quads" | "Hamstrings" | "Glutes" | "Abductors" | "Adductors" | "Calves"
  | "Lower back" | "Upper back" | "Lats"
  | "Chest" | "Shoulders" | "Biceps" | "Triceps" | "Forearms"
  | "Core" | "Other";

export function muscleGroup(exerciseName: string): MuscleGroup {
  const n = exerciseName.toLowerCase();
  // A SCAPULAR handstand push-up (the owner's low-ROM / one-hand variant) is a
  // mix of HSPU and "handstand muscle" — its prime mover is the scapula (traps /
  // upper back), not the delts, so it leads with Upper back (shoulders/triceps
  // come in as secondaries). Guarded so only the scapular variant is affected.
  if (n.includes("scapular") && (n.includes("handstand") || n.includes("hspu"))) return "Upper back";
  // First matching MUSCLE_GROUP_TAGS entry wins (the table is in priority order,
  // the same ordering this function used to hold inline — see the registry).
  const prime = MUSCLE_GROUP_TAGS.find((t) => tagMatches(n, t));
  if (prime) return prime.label as MuscleGroup;
  // A bare deadlift/clean/snatch has no muscle keyword → its erectors brace the
  // load, so it falls to the lower back.
  if (n.includes("deadlift") || n.includes("clean") || n.includes("snatch")) return "Lower back";
  return "Other";
}

/** Secondary muscles a COMPOUND lift also trains, on top of its primary
 * {@link muscleGroup}. Keyword-matched and ACCUMULATED (every matching rule adds),
 * so e.g. a back squat picks up both Glutes and Lower back. Anatomy is approximate
 * — it just decides which sections a lift shows up in; the owner can fine-tune any
 * lift's per-muscle involvement via the muscle editor (mgLevel). */
const SECONDARY_MUSCLE_RULES: { keywords: string[]; add: MuscleGroup[] }[] = [
  // Knee-dominant. Spinally-loaded squats also brace the lower back.
  { keywords: ["back squat", "barbell squat", "front squat", "zercher", "overhead squat", "goblet"], add: ["Glutes", "Lower back"] },
  { keywords: ["squat", "lunge", "split squat", "bulgarian", "step up", "step-up", "pistol", "cossack", "leg press", "hack", "belt squat"], add: ["Glutes"] },
  // Hip-hinge posterior chain.
  { keywords: ["deadlift", "romanian", "rdl", "stiff leg", "stiff-leg", "good morning", "clean", "snatch"], add: ["Glutes", "Hamstrings", "Lower back"] },
  { keywords: ["hip thrust", "glute bridge", "bridge", "hip extension"], add: ["Hamstrings"] },
  // Horizontal push: triceps + front delts assist.
  { keywords: ["bench", "push up", "pushup", "push-up", "pushups", "chest press", "dip"], add: ["Triceps", "Shoulders"] },
  // Vertical / standing press: triceps assist.
  { keywords: ["shoulder press", "overhead press", "military", "arnold", "handstand push", "hspu"], add: ["Triceps"] },
  // Scapular HSPU (Upper-back prime): the delts + triceps still assist the press.
  { keywords: ["scapular handstand", "scapular hspu"], add: ["Shoulders", "Triceps"] },
  // Vertical pulls: biceps + upper back assist.
  { keywords: ["pull up", "pullup", "pull-up", "chin up", "chinup", "chin-up", "lat pulldown", "pulldown"], add: ["Biceps", "Upper back"] },
  // Rows: biceps + upper back assist.
  { keywords: ["row", "pendlay"], add: ["Biceps", "Upper back"] },
];

/** All muscle groups a lift trains by DEFAULT — its primary first, then any
 * secondary muscles for compound lifts. This is the automatic membership the
 * sections fall back to when the owner hasn't set explicit per-muscle levels, so
 * a squat shows up under Quads AND Glutes (AND Lower back) without manual tagging. */
export function autoMuscleGroups(exerciseName: string): MuscleGroup[] {
  const prime = muscleGroup(exerciseName);
  const n = exerciseName.toLowerCase();
  const out: MuscleGroup[] = [prime];
  for (const rule of SECONDARY_MUSCLE_RULES) {
    if (rule.keywords.some((k) => n.includes(k))) {
      for (const m of rule.add) if (!out.includes(m)) out.push(m);
    }
  }
  return out;
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
  "Dynamic",
  "Skill",
  "Mobility",
  "Posture",
  "Cardio",
  "Other",
];

/** Every {@link LIST_CATEGORIES} bucket an exercise belongs to (one or more). */
export function exerciseCategories(exerciseName: string): string[] {
  const n = exerciseName.toLowerCase();
  const ov = categoryOverride(n);
  // Terminal owner-fixes (non-muscle) are the sole, defining bucket.
  if (ov === "Mobility" || ov === "Dynamic" || ov === "Posture" || ov === "Other") return [ov];
  const has = (...k: string[]) => k.some((s) => n.includes(s));
  const cats: string[] = [];
  const add = (c: string) => {
    if (!cats.includes(c)) cats.push(c);
  };

  // Non-strength buckets first (same precedence as exerciseCategory) — when one
  // hits, it's the only sensible bucket, so return early. Skipped when an owner
  // muscle-fix (Arms/Core/Legs…) applies, so e.g. "Bulgarian Split Squat" isn't
  // swallowed by the "split" stretch keyword.
  if (!ov) {
    if (has("stretch", "split", "pancake", "pose", "tailor", "meditation", "breath", "cold shower", "mobility", "ankle", "posture", "head aware"))
      return ["Mobility"];
    if (/\brun/.test(n) || has("bike", "cardio", "stairs", "hike", "sprint", "skateboard", "cycle", "sled", "slege", "erg", "elliptical", "treadmill", "jump rope", "skipping", "stairmaster", "calorie"))
      return ["Cardio"];
  }
  // Calisthenics SKILLS are skills AND the muscles they build (if you're strong
  // enough) — like a squat isn't "just a skill". So a skill adds Skill plus its
  // muscle group(s), then the keyword adds below can pile on more (e.g. a
  // "balance squat" also picks up Legs). A handstand PUSH-up is shoulders.
  if (!ov && has("front lever", "planche", "human flag", "maltese", "dragon flag", "handstand", "headstand", "forearm stand", "l-sit", "l sit", "lsit", "balance", "muscle up", "iron cross")) {
    if (n.includes("push")) add("Shoulders");
    else {
      add("Skill");
      for (const m of skillMuscles(n)) add(m);
    }
  }

  // Movement patterns (a squat/deadlift can belong to a pattern AND muscle
  // groups). Keyword sets come from FUNCTIONAL_PATTERN_TAGS so they live in one
  // place; the labels match LIST_CATEGORIES. (Hinge is a registry tag too but is
  // not a list category, so it isn't emitted here.)
  const pattern = (id: string) => FUNCTIONAL_PATTERN_TAGS.find((t) => t.id === id)!;
  if (tagMatches(n, pattern("pattern.squat"))) add("Squat pattern");
  if (tagMatches(n, pattern("pattern.deadlift"))) add("Deadlift pattern");
  // Posterior-chain work that supports the deadlift (not the main lift itself).
  if (tagMatches(n, pattern("pattern.deadlift-accessory"))) add("Deadlift accessory");

  // Leg splits: broad (everything leg-ish) vs the big three quads/glutes/hams.
  const legBroad = has("squat", "deadlift", "lunge", "leg press", "leg curl", "leg extension", "calf", "hip thrust", "glute", "rdl", "romanian", "good morning", "hamstring", "ham ", "quad", "pistol", "step up", "step-up", "hack", "belt squat", "cossack", "sissy", "hip abduction", "hip adduction", "abductor", "adductor", "nordic", "wall sit", "clean", "snatch", "kettlebell");
  if (legBroad) add("Legs (all)");
  const legBig = has("squat", "deadlift", "lunge", "leg press", "leg curl", "leg extension", "hip thrust", "glute", "rdl", "romanian", "good morning", "hamstring", "ham ", "quad", "pistol", "step up", "step-up", "hack", "belt squat", "cossack", "sissy", "nordic", "wall sit");
  if (legBig) add("Legs (quads/glutes/hams)");

  // Muscle groups — independent keyword sets, so big compounds match several.
  if (has("bench", "chest", "push up", "pushup", "push-up", "pushups", "fly", "pec", "dip", "press up")) add("Chest");
  if (has("row", "pulldown", "pull up", "pullup", "pull-up", "chin up", "chinup", "lat ", "lat pull", "pull over", "pullover", "face pull", "inverted row", "scapular", "back extension", "hyperextension", "reverse hyper", "deadlift", "shrug", "rack pull", "good morning", "lower back", "erector"))
    add("Back");
  if (has("shoulder press", "overhead press", "lateral raise", "front raise", "rear delt", "upright row", "military press", "behind the neck", "arnold", "shrug", "delt", "handstand push"))
    add("Shoulders");
  if (has("curl", "tricep", "triceps", "pushdown", "preacher", "hammer", "wrist", "forearm", "finger", "skull", "jm press", "kickback")) add("Arms");
  if (has("crunch", "sit up", "situp", "sit-up", "plank", "leg raise", "legs raise", "ab ", "ab wheel", "ab curl", "oblique", "side bend", "hollow", "knee raise", "knee tuck", "woodchop", "pallof", "rollout", "twist", "leg pull", "bicycle", "mountain climber", "flag", "vacuum", "deadlift", "good morning"))
    add("Core");

  // The owner's muscle-fix: make sure the override bucket is present (and first)
  // when it's a real list bucket and the keyword logic didn't already add it
  // (e.g. "Front support" → Arms, "Kong" → Skill). For Legs/Back overrides the
  // muscle keywords already added the right sub-buckets, so nothing to force.
  if (ov && LIST_CATEGORIES.includes(ov) && !cats.includes(ov)) {
    const i = cats.indexOf("Other");
    if (i >= 0) cats.splice(i, 1);
    cats.unshift(ov);
  }
  if (cats.length === 0) add("Other");
  return cats;
}

/** The muscle group(s) a calisthenics SKILL also builds (owner's mapping). Labels
 * match LIST_CATEGORIES so exerciseCategories can add them directly. */
function skillMuscles(n: string): string[] {
  const m: string[] = [];
  if (/front lever|back lever/.test(n)) m.push("Back", "Core");
  if (/planche|maltese/.test(n)) m.push("Shoulders", "Chest", "Core");
  if (/muscle ?up/.test(n)) m.push("Back", "Arms");
  if (/dragon flag/.test(n)) m.push("Core");
  if (/human flag/.test(n)) m.push("Core", "Shoulders");
  if (/handstand|headstand|forearm stand/.test(n)) m.push("Shoulders");
  if (/l-?sit|\blsit\b/.test(n)) m.push("Core");
  if (/iron cross/.test(n)) m.push("Shoulders", "Chest", "Arms");
  return m;
}

/** Map a fine LIST_CATEGORIES bucket back to its coarse TrainingCategory. */
const LISTCAT_TO_TRAINING: Record<string, TrainingCategory> = {
  "Squat pattern": "Legs", "Deadlift pattern": "Legs", "Deadlift accessory": "Legs",
  "Legs (all)": "Legs", "Legs (quads/glutes/hams)": "Legs",
  Chest: "Chest", Back: "Back", Shoulders: "Shoulders", Arms: "Arms", Core: "Core",
  Dynamic: "Dynamic", Skill: "Skill", Mobility: "Mobility", Posture: "Posture", Cardio: "Cardio", Other: "Other",
};

/**
 * Every COARSE training category an exercise belongs to — multi-membership, so a
 * lift can appear under several headers (a deadlift is Legs, Back AND Core; a
 * front lever is Skill, Back AND Core). Derived from {@link exerciseCategories}
 * by folding its fine buckets up to the coarse TRAINING_CATEGORIES.
 */
export function trainingCategories(name: string): TrainingCategory[] {
  const out: TrainingCategory[] = [];
  for (const lc of exerciseCategories(name)) {
    const tc = LISTCAT_TO_TRAINING[lc] ?? "Other";
    if (!out.includes(tc)) out.push(tc);
  }
  return out.length ? out : ["Other"];
}

/**
 * A "static" TAG (not a category): true for isometric HOLDS — handstand / L-sit /
 * planche / front-lever holds, planks, wall sits, dead hangs… An exercise with a
 * dynamic action word (raise, row, push, walk, press, kick, curl…) is NOT static
 * even if it names a skill, so "Front lever raise" and "Handstand walk" are out
 * while "Front Lever" and "Handstand hold" are in.
 */
export function isStatic(name: string): boolean {
  const n = name.toLowerCase();
  if (/raise|\brow|push|pull|kick|walk|step|press|curl|climb|hop|jump|muscle ?up|touch|negative|swing|circle|rotation|march|\bto\b/.test(n))
    return false;
  return /\bhold\b|l-?sit|\blsit\b|front lever|back lever|planche|handstand|headstand|forearm stand|wall sit|plank|dead hang|bar hang|iron cross|maltese|hollow|human flag|front support|isometric|\bstatic\b/.test(n);
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
export type ExerciseTier = "main" | "second" | "third" | "ugly";

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
  // Handstand family — give each version a clear, distinct code (the auto-coder
  // read "Handstand Push Ups" as "PU", clashing with regular Push Ups, and two
  // handstand lifts both coded "LC"). All start "HS" so they read as a family.
  handstandpushups: "HSPU",
  handstandpushuptoblock15cm: "HSPU-B",
  handstandtouchshoulders: "HS-TS",
  handstandshouldertouchclosehand: "HS-TSc",
  handstandwalltouch: "HS-WT",
  handstandkicks: "HS-K",
  handstandwalk: "HS-W",
  handstandstepsnexttowall1hand1: "HS-ST",
  handstandclose2flegcurls: "HS-LCc",
  handstandlegcurl: "HS-LC",
  handstandonhead: "HS-OH",
  handstanddancepppp: "HS-D",
  handstandhold: "HS-H",
  handstand: "HS",
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
 *
 * `baseCode` resolves one name's (non-unique) code; it defaults to
 * {@link exerciseCode} but callers can pass a resolver that layers user-set code
 * overrides on top, so a renamed code still gets collision-resolved here.
 */
export function exerciseCodesFor(
  names: Iterable<string>,
  baseCode: (name: string) => string = exerciseCode,
): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Map<string, number>(); // base code → how many times seen
  for (const name of names) {
    if (out.has(name)) continue; // same name → same code, only assign once
    const base = baseCode(name);
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
