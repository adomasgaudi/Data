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
/** How the workout heatmap colours each day. */
export type HeatColorDim = "none" | "cat" | "mus" | "fun" | "ex";
/** Index / bodyweight-parts grouping dimension. */
export type IndexGroupMode = "discipline" | "muscle" | "function" | "combinable" | "comparable";

export const S: {
  // Analysis view (Workout Analysis) — local UI flags.
  waCompareView: "trend" | "perset";
  waChipsFoldOpen: boolean;
  waCogOpen: boolean;
  waGraphFoldOpen: boolean;
  waPerBodyweight: boolean;
  // Workouts heatmap (year analysis) state.
  heatYear: number;
  heatScope: "ribbon" | "single" | "all";
  heatFilters: string[];
  heatFiltersSaved: string[] | null;
  aloneTagMode: boolean;
  heatColorBy: HeatColorDim;
  // Index / bodyweight-parts view.
  bwOpenCats: Set<string> | null;
  bwGroupMode: IndexGroupMode;
  // Data tab.
  dataView: "processed" | "original";
  dataSearch: string;
} = {
  waCompareView: "trend",
  waChipsFoldOpen: false,
  waCogOpen: false,
  waGraphFoldOpen: false,
  waPerBodyweight: false,
  heatYear: 2026,
  heatScope: "ribbon",
  heatFilters: [],
  heatFiltersSaved: null,
  aloneTagMode: false,
  heatColorBy: "cat",
  bwOpenCats: null,
  bwGroupMode: "discipline",
  dataView: "processed",
  dataSearch: "",
};
