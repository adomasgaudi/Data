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
      // SUPPORT — one combined dimension for "how the body is held / assisted":
      // wall help, leg shape (L-sit harder, tucked/hooked easier) and ladder-rung
      // assistance all live here (merged from the old support / legs / ladder dims,
      // since you pick ONE setup). free = freestanding straight legs (×1 reference).
      support: {
        free: 1.0,
        wall: 0.85,
        tucked: 0.95,
        hooked: 0.8,
        lsit: 1.1,
        lad3: 0.72,
        lad5: 0.6,
        lad6: 0.55,
        lad9: 0.42,
      },
      // Assistance band ("guma") by its NUMBER (1–6). Lower number = thicker band =
      // more help = lower factor; higher number = thinner = less help. Calibrate.
      band: { none: 1.0, "1": 0.5, "2": 0.56, "3": 0.62, "4": 0.75, "5": 0.85, "6": 0.92 },
      // Range of motion measured as the hand height vs the floor, in cm. 0cm = to
      // the floor (full depth, the ×1 reference); a block/raised hands (+cm) shortens
      // the range → easier (<1); parallettes/brick go below the floor (−cm) → deeper,
      // harder (>1). A yoga block reads as +5 / +15 / +23cm depending on its side.
      rom: { "+23cm": 0.6, "+15cm": 0.72, "+5cm": 0.88, "0cm": 1.0, "-5cm": 1.1, "-10cm": 1.22, "-15cm": 1.35 },
      // Forward lean, measured in cm. 0cm = straight against the wall (×1, the
      // easiest); leaning further forward demands more balance/strength toward a
      // freestanding/planche line → HARDER (>1). Same 5/15/23cm steps as a block.
      lean: { "0cm": 1.0, "5cm": 1.08, "15cm": 1.18, "23cm": 1.3 },
      // Reps done unbroken (no pause at the bottom) reads slightly harder.
      continuity: { paused: 1.0, uninterrupted: 1.05 },
    },
    defaults: { support: "free", band: "none", rom: "0cm", lean: "0cm", continuity: "paused" },
  },
  PUSHUP: {
    dims: { incline: { l0: 1.0, l1: 0.92, l2: 0.85, l3: 0.78, l4: 0.7, l5: 0.62, l6: 0.55 } },
    defaults: { incline: "l0" },
  },
};

export const TOKENS: Record<string, Record<string, TokenDef>> = {
  HSPU: {
    // support / wall (a higher-priority "no wall" beats a bare "wall" in the note)
    wall: { support: "wall" },
    "no wall": { support: "free", priority: 5 },
    freestanding: { support: "free" },
    "navel to wall": { support: "wall" },
    "close to wall": { support: "wall" },
    // assistance band — "guma N" by number; longest-match-first means "guma 5"
    // beats "guma". Bare "guma" assumes a mid band (5).
    "guma 1": { band: "1" },
    "guma 2": { band: "2" },
    "guma 3": { band: "3" },
    "guma 4": { band: "4" },
    "guma 5": { band: "5" },
    "guma 6": { band: "6" },
    guma: { band: "5" },
    // range of motion in cm (a raised block shortens it; parallettes/brick deepen
    // it). A block implies you're also against the wall. The yoga side = +5/15/23cm.
    "l yoga": { rom: "+23cm", support: "wall" },
    "m yoga": { rom: "+15cm", support: "wall" },
    "yoga block": { rom: "+15cm", support: "wall" },
    yoga: { rom: "+15cm", support: "wall" },
    paraletes: { rom: "-10cm" },
    parallettes: { rom: "-10cm" },
    brick: { rom: "-5cm" },
    limited: { rom: "+5cm" },
    // legs → now part of SUPPORT
    "l sit": { support: "lsit" },
    "l-sit": { support: "lsit" },
    lsit: { support: "lsit" },
    "užkabintos kojos": { support: "hooked" }, // hooked legs (assisted)
    // lean / continuity
    "forward lean": { lean: "15cm" },
    uninterupted: { continuity: "uninterrupted" }, // (owner's spelling)
    uninterrupted: { continuity: "uninterrupted" },
    // ladder / wall-bar assist level → now part of SUPPORT ("lad5", "9lygis", …)
    "lad3": { support: "lad3" },
    "lad5": { support: "lad5" },
    "lad6": { support: "lad6" },
    "6lad": { support: "lad6" },
    "9lygis": { support: "lad9" },
    "5 level": { support: "lad5" },
    "5 lygis": { support: "lad5" },
  },
  PUSHUP: {
    /* token → { incline: "lN" } — the owner fills this in. */
  },
};

/** The bundled config (passed by default to the resolver; callers may pass their
 * own, e.g. a user-edited copy from storage, for the future token editor). */
export const DEFAULT_VARIATION_CONFIG: VariationConfig = { FAMILIES, TOKENS };

/** Bump on ANY edit to FAMILIES/TOKENS so caches keyed on (note, version) drop. */
export const CONFIG_VERSION = 2;

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
};

export function familyOf(
  exerciseName: string,
  map: Record<string, string> = EXERCISE_FAMILY,
): string | null {
  return map[exerciseName] ?? null;
}
