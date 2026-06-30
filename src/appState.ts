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
/** How the workout heatmap colours each day. The core dims (discipline / muscle
 * group / function / tier) match the picker + Index; "ex" colours per exercise. */
export type HeatColorDim = "none" | "discipline" | "muscleGroup" | "function" | "tier" | "ex";
/** Index grouping dimension: the shared core (discipline / muscle group / function
 * / tier) + Index-only extras (the taxonomy dims) + the merge groupings. */
export type IndexGroupMode =
  | "discipline" | "muscleGroup" | "function" | "tier"
  | "bodyPart" | "joint" | "movement" | "plane" | "difficulty" | "equipment"
  | "combinable" | "comparable";

export const S: {
  // Analysis view (Workout Analysis) — local UI flags.
  waCompareView: "trend" | "perset";
  waChipsFoldOpen: boolean;
  waCogOpen: boolean;
  waGraphFoldOpen: boolean;
  waPerBodyweight: boolean;
  /** Graph "Reps versus weight" scatter mode + its per-exercise best-fit line. */
  waRepsVsWeight: boolean;
  waRepsVsWeightFit: boolean;
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
  // Workouts list view.
  workoutsPage: number;
  workoutsPageSize: number;
  workoutViewMode: "day" | "week" | "2week" | "month" | "3month";
  workoutShowMode: "exercises" | "groups";
  showAddSets: boolean;
  showVariants: boolean;
  showAllScale: boolean;
  machineReal: boolean;
  showAloneTags: boolean;
  showRestDays: boolean;
  restCompact: boolean;
} = {
  waCompareView: "trend",
  waChipsFoldOpen: false,
  waCogOpen: false,
  waGraphFoldOpen: false,
  waPerBodyweight: false,
  waRepsVsWeight: false,
  waRepsVsWeightFit: true,
  heatYear: 2026,
  heatScope: "ribbon",
  heatFilters: [],
  heatFiltersSaved: null,
  aloneTagMode: false,
  heatColorBy: "discipline",
  bwOpenCats: null,
  bwGroupMode: "discipline",
  dataView: "processed",
  dataSearch: "",
  workoutsPage: 0,
  workoutsPageSize: 50,
  workoutViewMode: "day",
  workoutShowMode: "exercises",
  // initialised from localStorage in main.ts after import.
  showAddSets: false,
  showVariants: false,
  showAllScale: false, // collapsed-line ×N mode: false = variation (hide ×N a chip implies), true = show every ×N
  machineReal: false, // assisted-machine weight: false = logged dial (m-20), true = real halved effort (-10)
  showAloneTags: false,
  showRestDays: true, // rest-day slivers shown by default (the gaps between sessions read as the timeline)
  restCompact: false, // when showRestDays is on, shrink the slivers to a 3px hairline (the Rest button's 3rd state)
};
