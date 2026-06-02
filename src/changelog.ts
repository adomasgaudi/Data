/**
 * Release log shown in Settings → Version history. The app is a static build
 * with no git at runtime, so the log is kept here as data and updated alongside
 * each release (the on-screen <span class="version"> must match the top entry).
 *
 * Versioning reset to the `b.MAJOR.MINOR.PATCH` scheme at b.1.0.0: bump the
 * middle digit (`b.1.x`) for normal updates, the last (`b.1.0.x`) for small ones.
 * Pre-reset history is preserved below with its original `0.x` numbers.
 */
export interface Release {
  version: string;
  /** Short kebab title (matches the commit explainer). */
  title: string;
  /** One-line plain-language summary of what changed. */
  note: string;
}

export const CHANGELOG: Release[] = [
  { version: "b.1.0.0", title: "version-history-page", note: "Added this Version history page; reset versioning to the b.x scheme." },
  { version: "0.36.1", title: "momentum-row", note: "Athlete view: 'Momentum' chips showing ±kg/week trend for the biggest-moving lifts." },
  { version: "0.36.0", title: "consistency-fixes", note: "Design/logic audit fixes: undefined CSS var, off-theme colour, and unified number formatting." },
  { version: "0.35.5.2", title: "cap-regression-tests", note: "Locked the rep-cap rule with tests so a >15-rep set never shows a 1RM." },
  { version: "0.35.4", title: "exercise-frequency-tiers", note: "Exercises view: 'By tier' sort grouping lifts S/A/B/C/D by how often they're logged." },
  { version: "0.35.3", title: "muscle-map-by-strength", note: "Muscle map shaded by strength percentile instead of sets trained." },
  { version: "0.35.2", title: "deadlift-pattern", note: "Deadlift pattern = only Deadlift + RDL; other variants kept separate." },
  { version: "0.35.1", title: "no-1rm-above-rep-cap", note: "Sets above 15 reps show '—' for 1RM instead of a clamped value." },
  { version: "0.35.0", title: "athlete-muscle-map", note: "Added a collapsible front/back muscle map to the athlete stats." },
  { version: "0.34.0", title: "compare-on-one-graph", note: "Exercises view: overlay several exercises' 1RM trends on one graph." },
  { version: "0.33.0", title: "weight-vs-reps-diagram", note: "Test tab: a weight-vs-reps curve for the current 1RM." },
  { version: "0.32.0", title: "fix-workouts-1rm-bodyweight", note: "Fixed Workouts/Exercises 1RM to include the bodyweight share like every other view." },
  { version: "0.31.0", title: "separate-smith-squat", note: "Smith Machine Squat kept separate; merged names show '(also: …)' everywhere." },
  { version: "0.30.0", title: "workouts-1rm-formula-reveal", note: "Tap a 1RM in the sets tables to see the exact formula used." },
  { version: "0.29.0", title: "data-tab-tracking-table", note: "Data tab Processed view exposes every per-set variable and function." },
  { version: "0.28.0", title: "data-tab-grouping", note: "Data tab groups rows by athlete · exercise · date." },
  { version: "0.27.0", title: "data-tab-filters", note: "Data tab: Original-CSV toggle fixed; exercise/athlete filters added." },
  { version: "0.26.0", title: "calculator-as-table", note: "Per-exercise calculator became a collapsible multi-row editable table." },
  { version: "0.25.0", title: "data-tab", note: "New Data tab: see the original CSV and the processed table." },
  { version: "0.24.0", title: "workout-exercise-links", note: "Tap an exercise in a workout to open its detail view." },
  { version: "0.23.0", title: "records-heatmap-dropdowns", note: "Records short-codes, a year heatmap, and custom dropdowns." },
  { version: "0.17.0", title: "athlete-chips-progress", note: "Athlete chips and weekly-progress popups." },
  { version: "0.14.0", title: "progress-charts", note: "Per-exercise progress charts and rep-max targets." },
  { version: "0.13.0", title: "exercise-categories", note: "Category dropdowns for exercises." },
  { version: "0.8.0", title: "athlete-pages", note: "Per-athlete pages." },
  { version: "0.5.0", title: "exercise-drill-in", note: "Drill into a single exercise's history." },
  { version: "0.3.0", title: "workouts-and-records", note: "Workouts list, records-per-exercise, bodyweight-parts tab." },
  { version: "0.1.0", title: "leaderboard-settings", note: "Leaderboard, settings filters, light theme — renamed to Colosseum." },
  { version: "0.0.1", title: "initial-dashboard", note: "First dashboard: load the CSV, compute and render leaderboards/PRs/1RMs." },
];

/** The current (top) version — single source for the on-screen tag and the page. */
export const CURRENT_VERSION = CHANGELOG[0]!.version;
