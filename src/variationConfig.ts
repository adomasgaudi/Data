/**
 * EDITABLE CONFIG for the factored variation-difficulty model (LIFT-DM1).
 *
 * The same logical exercise (a "family") is done in many variations that are only
 * captured as free-text notes. This config turns those notes into a structured
 * attribute vector: each family has DIMENSIONS (e.g. support, range of motion),
 * each with named LEVELS and a difficulty factor; and a TOKEN table mapping the
 * messy note phrases to one-or-more dimension assignments (a token can IMPLY
 * several attributes — "yoga block" sets the range AND that it's against a wall).
 *
 * The resolver in variationModel.ts is PURE and takes this config as input, so
 * everything here is data the owner calibrates — the numbers are placeholders.
 * Nothing in the resolver hardcodes these names.
 *
 * `CONFIG_VERSION` is bumped whenever this file changes, so any memoised resolve
 * can be invalidated on `(note, CONFIG_VERSION)` (see variationModel.ts).
 */

/** A dimension's levels → difficulty factor (×1 = reference, <1 easier). */
export type Levels = Record<string, number>;
export interface FamilyDef {
  /** dimension name → its levels (level → factor). */
  dims: Record<string, Levels>;
  /** dimension name → the level assumed when no token sets it (inheritance). */
  defaults: Record<string, string>;
}
/** A token's assignments: dimension → level, plus an optional numeric `priority`
 * (higher wins / is applied last when two tokens touch the same dimension). */
export type TokenDef = Record<string, string | number>;
export interface VariationConfig {
  FAMILIES: Record<string, FamilyDef>;
  TOKENS: Record<string, Record<string, TokenDef>>;
}

// Handstand push-up model, derived from the real logged notes. DIMENSIONS are the
// independent ways the lift is made easier/harder; LEVELS each carry a placeholder
// difficulty factor (×1 = the hardest/reference, <1 easier, >1 harder) for the
// owner to calibrate. Vertical depth in centimetres ("15cm", "+3cm") is NOT here —
// it's already captured as a per-set cm LEVEL by the squat-rack/cm system upstream.
export const FAMILIES: Record<string, FamilyDef> = {
  HSPU: {
    dims: {
      // SUPPORT — the wall orientation / overall setup, picked from a dropdown:
      // free (freestanding, ×1 reference), front-to-wall, back-to-wall, or LADDER.
      // The ladder setup then adds two sub-choices below (its own dimensions):
      // a leg GRIP (l-sit / hooked) and a rung HEIGHT — each a separate multiplier
      // that combines with the ladder base. Calibrate the numbers.
      support: {
        free: 1.0,
        front_to_wall: 0.92,
        back_to_wall: 0.82,
        ladder: 0.55,
      },
      // Ladder leg grip (only applies on the ladder). l-sit = legs out front (harder),
      // hooked = legs hooked on a rung (assisted, easier). none = neither.
      ladderGrip: { none: 1.0, lsit: 1.1, hooked: 0.8 },
      // Ladder rung height — how high your feet are (higher rung = more assist =
      // easier). none = unspecified. lad3 lowest … lad9 highest.
      ladderH: { none: 1.0, lad3: 0.72, lad5: 0.6, lad6: 0.55, lad9: 0.42 },
      // Assistance band ("guma") by its NUMBER (1–6). HIGHER number = heavier band =
      // MORE help = lower factor; lower number = lighter = less help. Calibrate.
      band: { none: 1.0, "1": 0.92, "2": 0.85, "3": 0.75, "4": 0.62, "5": 0.56, "6": 0.5 },
      // Range of motion measured as the hand height vs the floor, in cm. 0cm = to
      // the floor (full depth, the ×1 reference); a block/raised hands (+cm) shortens
      // the range → easier (<1); parallettes/brick go below the floor (−cm) → deeper,
      // harder (>1). A yoga block reads as +5 / +15 / +23cm depending on its side.
      rom: { "+25cm": 0.56, "+23cm": 0.6, "+20cm": 0.66, "+15cm": 0.72, "+10cm": 0.8, "+5cm": 0.88, "+2cm": 0.94, "0cm": 1.0, "-3cm": 1.06, "-5cm": 1.1, "-10cm": 1.22, "-15cm": 1.35, "-20cm": 1.5 },
      // Forward lean, in cm. This BASE table is the IMMEDIATE one (free / front-to-
      // wall / banded): lean gets harder from the first cm, ~×1.0 → ×1.2 over 0–23cm.
      // Back-to-wall gets a 15cm "grace" applied in code (the scale shifted down
      // 15cm), so against the wall the first 15cm of lean does nothing.
      lean: { "0cm": 1.0, "3cm": 1.03, "5cm": 1.04, "8cm": 1.07, "10cm": 1.09, "13cm": 1.11, "15cm": 1.13, "18cm": 1.16, "20cm": 1.17, "23cm": 1.2 },
      // Reps done unbroken (no pause at the bottom) reads slightly harder.
      continuity: { paused: 1.0, uninterrupted: 1.05 },
    },
    defaults: { support: "free", ladderGrip: "none", ladderH: "none", band: "none", rom: "0cm", lean: "0cm", continuity: "paused" },
  },
  PUSHUP: {
    // INCLINE (hands raised) is NOT a family dimension — it's how high the hands are,
    // captured per-set by the smith-notch / squat-rack / cm LEVEL system (variants.ts,
    // all converging on one cm incline) so it COMBINES with this. The one family
    // dimension is body POSITION: on the knees is easier than on the feet (floor).
    // Knees ≈ 0.7× a floor push-up (tune it in ⚙ Difficulty multipliers).
    dims: { position: { floor: 1.0, knees: 0.7 } },
    defaults: { position: "floor" },
  },
};

export const TOKENS: Record<string, Record<string, TokenDef>> = {
  HSPU: {
    // wall orientation. Bare "wall" = back-to-wall (the common one); chest/face
    // cues ("navel to wall", "close to wall") = front-to-wall. "no wall" wins.
    wall: { support: "back_to_wall" },
    "back to wall": { support: "back_to_wall", priority: 4 },
    "b2 wall": { support: "back_to_wall", priority: 4 },
    "front to wall": { support: "front_to_wall", priority: 4 },
    "navel to wall": { support: "front_to_wall", priority: 4 },
    "close to wall": { support: "front_to_wall", priority: 4 },
    ladder: { support: "ladder" },
    "no wall": { support: "free", priority: 5 },
    freestanding: { support: "free" },
    // assistance band — "guma N" by number (higher N = heavier = more help);
    // longest-match-first means "guma 5" beats "guma". Bare "guma" assumes a mid band.
    "guma 1": { band: "1" },
    "guma 2": { band: "2" },
    "guma 3": { band: "3" },
    "guma 4": { band: "4" },
    "guma 5": { band: "5" },
    "guma 6": { band: "6" },
    guma: { band: "5" },
    // range of motion in cm (a raised block shortens it; parallettes/brick deepen
    // it). A block implies you're also against the wall. The yoga side = +5/15/23cm.
    "l yoga": { rom: "+23cm", support: "back_to_wall" },
    "m yoga": { rom: "+15cm", support: "back_to_wall" },
    "yoga block": { rom: "+15cm", support: "back_to_wall" },
    yoga: { rom: "+15cm", support: "back_to_wall" },
    paraletes: { rom: "-10cm" },
    parallettes: { rom: "-10cm" },
    brick: { rom: "-5cm" },
    limited: { rom: "+5cm" },
    // legs → a ladder GRIP (and they imply the ladder setup)
    "l sit": { support: "ladder", ladderGrip: "lsit" },
    "l-sit": { support: "ladder", ladderGrip: "lsit" },
    lsit: { support: "ladder", ladderGrip: "lsit" },
    hooked: { support: "ladder", ladderGrip: "hooked" },
    "užkabintos kojos": { support: "ladder", ladderGrip: "hooked" }, // hooked legs (assisted)
    // lean / continuity
    "forward lean": { lean: "15cm" },
    uninterupted: { continuity: "uninterrupted" }, // (owner's spelling)
    uninterrupted: { continuity: "uninterrupted" },
    // ladder / wall-bar rung height → ladder SUPPORT + a HEIGHT ("lad5", "9lygis", …)
    "lad3": { support: "ladder", ladderH: "lad3" },
    "lad5": { support: "ladder", ladderH: "lad5" },
    "lad6": { support: "ladder", ladderH: "lad6" },
    "6lad": { support: "ladder", ladderH: "lad6" },
    "9lygis": { support: "ladder", ladderH: "lad9" },
    "5 level": { support: "ladder", ladderH: "lad5" },
    "5 lygis": { support: "ladder", ladderH: "lad5" },
  },
  PUSHUP: {
    // On the knees (easier) → the POSITION dimension. LT "ant kelių" / "nuo kelių".
    // NB a plain "ant <number>" is an incline NOTCH (read by the level system) — only
    // "ant kelių" (on the KNEES) is this variation, so the two never collide.
    "from knees": { position: "knees" },
    "on knees": { position: "knees" },
    kneeling: { position: "knees" },
    knees: { position: "knees" },
    knee: { position: "knees" },
    "ant kelių": { position: "knees" },
    "ant keliu": { position: "knees" },
    "nuo kelių": { position: "knees" },
    "nuo keliu": { position: "knees" },
  },
};

/** The bundled config (passed by default to the resolver; callers may pass their
 * own, e.g. a user-edited copy from storage, for the future token editor). */
export const DEFAULT_VARIATION_CONFIG: VariationConfig = { FAMILIES, TOKENS };

/** Bump on ANY edit to FAMILIES/TOKENS so caches keyed on (note, version) drop. */
export const CONFIG_VERSION = 9;

/**
 * Which family's model an exercise uses (decision: family = exercise). Many
 * spellings can share one family. Returns null when an exercise has no model yet,
 * in which case the caller falls back to the flat per-note scalar (×1 default).
 * The owner extends this map.
 */
export const EXERCISE_FAMILY: Record<string, string> = {
  "Handstand Push Ups": "HSPU",
  "Handstand Push Up": "HSPU",
  "Push Ups": "PUSHUP",
  "Push Up": "PUSHUP",
  // Smith-machine incline push-ups are the SAME push, just on the smith bar — people
  // log incline variations under either name — so they share the push-up model (and
  // its position/knees variation). Incline scaling already covers it by name pattern.
  "Smith Machine Incline Close Grip Push Up": "PUSHUP",
};

export function familyOf(
  exerciseName: string,
  map: Record<string, string> = EXERCISE_FAMILY,
): string | null {
  const exact = map[exerciseName];
  if (exact) return exact;
  // Pattern fallback so EVERY handstand push-up uses the HSPU model — however it's
  // spelled or wherever it came from (StrengthLevel CSV, created here, renamed) —
  // and so gets the full variation-multiplier math AND its "needs review" flags for
  // unknown notes. Matches "handstand push up(s)" in any spacing/hyphen/plural form,
  // and the "HSPU" code. (Holds / walks / kicks have no "pushup", so they're excluded.)
  const n = exerciseName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (n.includes("handstandpushup") || n.startsWith("hspu")) return "HSPU";
  return null;
}

/** Centimetres encoded in a lean-level key (e.g. "15" → 15); 0 when unparseable. */
const leanCm = (key: string): number => { const n = parseInt(key, 10); return Number.isFinite(n) ? n : 0; };

/** Default lean table for a support. Back-to-wall gets a 15cm "grace": forward
 * lean does nothing for the first 15cm (you're against the wall), so the scale is
 * shifted DOWN 15cm — b2w factor(X) = base factor(X−15). Free / front-to-wall /
 * ladder use the base table (immediate, harder from the first cm). */
export function defaultLeanTable(family: string, support: string): Record<string, number> {
  const base = FAMILIES[family]?.dims.lean ?? {};
  if (support !== "back_to_wall") return base;
  const keys = Object.keys(base);
  const factorAtCm = (cm: number): number => {
    let bestKey = keys[0] ?? "";
    for (const k of keys) if (leanCm(k) <= cm && leanCm(k) >= leanCm(bestKey)) bestKey = k; // largest key ≤ cm
    return base[bestKey] ?? 1;
  };
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = factorAtCm(Math.max(0, leanCm(k) - 15));
  return out;
}
