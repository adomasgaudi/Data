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
      // How much help from the wall (further from wall ≈ freestanding ≈ harder).
      support: { free: 1.0, wall: 0.85 },
      // Assistance band ("guma"); higher number = more assistance here (calibrate).
      band: { none: 1.0, light: 0.85, medium: 0.75, heavy: 0.62 },
      // Range of motion measured as the hand height vs the floor, in cm. 0cm = to
      // the floor (full depth, the ×1 reference); a block/raised hands (+cm) shortens
      // the range → easier (<1); parallettes/brick go below the floor (−cm) → deeper,
      // harder (>1). A yoga block reads as +5 / +15 / +23cm depending on its side.
      rom: { "+23cm": 0.6, "+15cm": 0.72, "+5cm": 0.88, "0cm": 1.0, "-5cm": 1.1, "-10cm": 1.22, "-15cm": 1.35 },
      // Leg shape: an L-sit is harder; hooked/tucked legs take some load off.
      legs: { straight: 1.0, tucked: 0.95, lsit: 1.1, hooked: 0.8 },
      // Forward lean, measured in cm (e.g. the block height used to lean). 0cm =
      // straight/neutral (×1); leaning further forward shifts toward a pike → easier
      // here (calibrate). Same 5/15/23cm steps as a yoga block's sides.
      lean: { "0cm": 1.0, "5cm": 0.96, "15cm": 0.9, "23cm": 0.85 },
      // Reps done unbroken (no pause at the bottom) reads slightly harder.
      continuity: { paused: 1.0, uninterrupted: 1.05 },
    },
    defaults: { support: "free", band: "none", rom: "0cm", legs: "straight", lean: "0cm", continuity: "paused" },
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
    // band assistance — "guma N"; longest-match-first means "guma 5" beats "guma"
    "guma 3": { band: "heavy" },
    "guma 4": { band: "medium" },
    "guma 5": { band: "light" },
    "guma 6": { band: "light" },
    guma: { band: "light" },
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
    // legs
    "l sit": { legs: "lsit" },
    "l-sit": { legs: "lsit" },
    lsit: { legs: "lsit" },
    "užkabintos kojos": { legs: "hooked", support: "wall" }, // hooked legs (assisted)
    // lean / continuity
    "forward lean": { lean: "15cm" },
    uninterupted: { continuity: "uninterrupted" }, // (owner's spelling)
    uninterrupted: { continuity: "uninterrupted" },
  },
  PUSHUP: {
    /* token → { incline: "lN" } — the owner fills this in. */
  },
};

/** The bundled config (passed by default to the resolver; callers may pass their
 * own, e.g. a user-edited copy from storage, for the future token editor). */
export const DEFAULT_VARIATION_CONFIG: VariationConfig = { FAMILIES, TOKENS };

/** Bump on ANY edit to FAMILIES/TOKENS so caches keyed on (note, version) drop. */
export const CONFIG_VERSION = 1;

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
