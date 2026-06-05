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

export const FAMILIES: Record<string, FamilyDef> = {
  HSPU: {
    dims: {
      support: { free: 1.0, wall: 0.85, band_light: 0.78, band_heavy: 0.62 },
      lean: { neutral: 1.0, fwd_small: 0.95, fwd_big: 0.88 },
      rom: { full: 1.0, to_block: 0.7, partial: 0.6 },
      elevation: { floor: 1.0, deficit_15: 1.15 },
    },
    defaults: { support: "free", lean: "neutral", rom: "full", elevation: "floor" },
  },
  PUSHUP: {
    dims: { incline: { l0: 1.0, l1: 0.92, l2: 0.85, l3: 0.78, l4: 0.7, l5: 0.62, l6: 0.55 } },
    defaults: { incline: "l0" },
  },
};

export const TOKENS: Record<string, Record<string, TokenDef>> = {
  HSPU: {
    wall: { support: "wall" },
    freestanding: { support: "free" },
    "yoga block": { rom: "to_block", support: "wall" }, // implication: also against the wall
    limited: { rom: "partial" },
    "15kg elev": { elevation: "deficit_15" },
    "guma heavy": { support: "band_heavy" },
    guma: { support: "band_light" },
    "forward lean": { lean: "fwd_big" },
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
