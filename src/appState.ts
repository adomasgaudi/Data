/**
 * Shared mutable app state (ARCH-1). Extracted from main.ts's module-level `let`
 * globals so the planned feature modules can read/write the same state across
 * files — in ES modules you can't reassign an imported binding, so shared mutable
 * state must live on an object. main.ts and the view modules use `S.<field>`.
 *
 * Migrated INCREMENTALLY: not every global lives here yet. Each ARCH-1 increment
 * moves another cohesive cluster of `let`s onto S (tsc catches any missed ref).
 * Keep this a plain data bag — no logic.
 */
export const S: {
  // Analysis view (Workout Analysis) — local UI flags.
  waCompareView: "trend" | "perset";
  waChipsFoldOpen: boolean;
  waCogOpen: boolean;
  waGraphFoldOpen: boolean;
  waPerBodyweight: boolean;
} = {
  waCompareView: "trend",
  waChipsFoldOpen: false,
  waCogOpen: false,
  waGraphFoldOpen: false,
  waPerBodyweight: false,
};
