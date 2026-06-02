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
  /** Scrum story points for the work (Fibonacci 1/2/3/5/8). */
  sp: number;
  /** One-line plain-language summary, shown collapsed. */
  note: string;
  /** Bullet points of what changed, shown when the row is expanded. */
  details: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: "b.1.4.0",
    title: "calendar-gridlines",
    sp: 3,
    note: "Time-axis gridlines only on week/month boundaries.",
    details: [
      "Vertical gridlines now land only on clean calendar points, not arbitrary spots.",
      "Long ranges mark the 1st of each month; short ranges mark Mondays.",
      "Applied to the progress graph and both compare views via one shared axis helper.",
    ],
  },
  {
    version: "b.1.3.2.1",
    title: "compare-perset-thinner",
    sp: 1,
    note: "Per-set compare bars thinned to a quarter (16 → 4 px).",
    details: ["Bar thickness reduced 75% after the previous bump made them too thick."],
  },
  {
    version: "b.1.3.2",
    title: "compare-perset-thicker-scroll",
    sp: 1,
    note: "Compare per-set bars thicker and pan/zoom scrollable.",
    details: [
      "Per-set range bars in the compare graph are noticeably thicker.",
      "Added drag-to-pan and wheel/pinch-to-zoom (x), like the other graphs.",
    ],
  },
  {
    version: "b.1.3.1",
    title: "changelog-expandable-sp",
    sp: 1,
    note: "Version history rows are expandable, with bullets and SP.",
    details: [
      "Each release is a collapsible row — tap to expand its detail bullets.",
      "Detail is shown as bullet points instead of one paragraph.",
      "Each release shows its Scrum story-point (SP) value, with a total at the top.",
    ],
  },
  {
    version: "b.1.3.0",
    title: "compare-per-set-range",
    sp: 2,
    note: "Per-set range view in the compare graph.",
    details: [
      "New 'Per-set range' toggle next to '1RM trend' in the compare tool.",
      "Overlays every set of each picked exercise as a weight → own-1RM bar.",
      "Bars are colour-coded per exercise on a shared time axis.",
      "Reuses the same same-set range logic as the single-exercise graph.",
    ],
  },
  {
    version: "b.1.2.0",
    title: "compare-tier-category-picks",
    sp: 3,
    note: "Category & tier quick-picks for the compare graph.",
    details: [
      "Tap a category (Legs, Chest, Back…) to overlay all its exercises at once.",
      "Tap a frequency tier (S/A/B/C/D) to overlay that whole tier.",
      "Category buttons are colour-keyed to the training-mix palette.",
      "Added a Clear button; individual chips still fine-tune the selection.",
    ],
  },
  {
    version: "b.1.1.0",
    title: "per-set-range-all-sets",
    sp: 3,
    note: "Per-set range graph shows every set, range per single set.",
    details: [
      "Bug: same-day sets collided at one x position and merged into one bar.",
      "Now each set gets its own column (sorted by date then set number).",
      "Each bar spans that one set's weight → its own 1RM — no cross-set mixing.",
    ],
  },
  {
    version: "b.1.0.0",
    title: "version-history-page",
    sp: 2,
    note: "Version history page + version-scheme reset.",
    details: [
      "Added this Settings → Version history page from a single CHANGELOG source.",
      "On-screen version tag is now set from CURRENT_VERSION at runtime.",
      "Reset versioning to the b.MAJOR.MINOR.PATCH scheme, starting at b.1.0.0.",
    ],
  },
  {
    version: "0.36.1",
    title: "momentum-row",
    sp: 3,
    note: "Athlete 'Momentum' trend chips.",
    details: [
      "Chips show ±kg/week estimated-1RM trend for the biggest-moving lifts.",
      "Only lifts with ≥3 data weeks get a chip, so a slope isn't read off noise.",
      "Green up / terracotta down; built from the same tested linearFit as charts.",
    ],
  },
  {
    version: "0.36.0",
    title: "consistency-fixes",
    sp: 3,
    note: "Design/logic audit fixes.",
    details: [
      "Fixed an undefined CSS variable on the exercise-sort buttons.",
      "Replaced an off-theme hardcoded red with a palette --danger variable.",
      "Unified number formatting via pct() and bwMult() helpers everywhere.",
    ],
  },
  {
    version: "0.35.5",
    title: "audit-1rm-consistency",
    sp: 4,
    note: "1RM-consistency audit + regression tests.",
    details: [
      "Verified every view computes 1RM the bodyweight- and cap-aware way.",
      "Fixed the Test-tab prefill that picked a top set with a raw estimate.",
      "Added regression tests locking the rep-cap rule into bestSet/leaderboard.",
    ],
  },
  {
    version: "0.35.4",
    title: "exercise-frequency-tiers",
    sp: 3,
    note: "'By tier' sort on the Exercises view.",
    details: [
      "Groups the athlete's exercises into S/A/B/C/D by how often each is logged.",
      "Each tier sits under a labelled banner with a coloured badge.",
      "Compare-graph diagram also made 30% shorter in the same release.",
    ],
  },
  {
    version: "0.35.3",
    title: "muscle-map-by-strength",
    sp: 2,
    note: "Muscle map shaded by strength, not sets.",
    details: [
      "Each region shades by the athlete's best StrengthLevel percentile there.",
      "Comparable across muscles since percentile is population-relative.",
    ],
  },
  {
    version: "0.35.2",
    title: "deadlift-pattern",
    sp: 1,
    note: "Deadlift pattern = Deadlift + RDL only.",
    details: [
      "Other deadlift variants kept as separate exercises.",
      "Pattern groups appear only under the 'Show pattern lifts' toggle.",
    ],
  },
  {
    version: "0.35.1",
    title: "no-1rm-above-rep-cap",
    sp: 2,
    note: "Sets above 15 reps show '—' for 1RM.",
    details: [
      "Above the rep cap an estimate is guesswork, so no value is shown.",
      "Propagates through bestSet/leaderboard/PRs/progress; no fallback formula.",
    ],
  },
  {
    version: "0.35.0",
    title: "athlete-muscle-map",
    sp: 3,
    note: "Collapsible front/back muscle map.",
    details: ["SVG body silhouettes in the athlete stats, with a legend and hover detail."],
  },
  {
    version: "0.34.0",
    title: "compare-on-one-graph",
    sp: 3,
    note: "Overlay several exercises' 1RM trends.",
    details: ["Tick exercises to compare their estimated-1RM trends on one graph."],
  },
  {
    version: "0.33.0",
    title: "weight-vs-reps-diagram",
    sp: 2,
    note: "Test-tab weight-vs-reps curve.",
    details: ["Plots the predicted bar weight across rep counts for the current 1RM."],
  },
  {
    version: "0.32.0",
    title: "fix-workouts-1rm-bodyweight",
    sp: 3,
    note: "Workouts 1RM now includes bodyweight.",
    details: [
      "Per-set tables ignored the bodyweight share (e.g. belt squat's 50%).",
      "Now match the bodyweight-aware number every other view uses.",
    ],
  },
  {
    version: "0.31.0",
    title: "separate-smith-squat",
    sp: 3,
    note: "Smith Machine Squat separated; origin badges.",
    details: [
      "Smith Machine Squat kept its own exercise (combined only in Squat pattern).",
      "Merged names and groups show their source names as '(also: …)' everywhere.",
    ],
  },
  {
    version: "0.30.0",
    title: "workouts-1rm-formula-reveal",
    sp: 2,
    note: "Tap a 1RM to see its formula.",
    details: ["Reveals the exact Epley/Brzycki/Nuzzo maths with your numbers plugged in."],
  },
  {
    version: "0.29.0",
    title: "data-tab-tracking-table",
    sp: 3,
    note: "Data tab exposes every computed variable.",
    details: ["Processed view shows coeff, effective load, each formula and the headline 1RM."],
  },
  {
    version: "0.25.0",
    title: "data-tab",
    sp: 5,
    note: "New Data tab (original + processed CSV).",
    details: [
      "See the raw CSV and the processed table all numbers come from.",
      "Filter by exercise/athlete; grouped by athlete · exercise · date.",
    ],
  },
  {
    version: "0.26.0",
    title: "calculator-as-table",
    sp: 3,
    note: "Per-exercise calculator is a multi-row table.",
    details: ["Collapsible reps↔weight table; add/delete rows; edit either cell."],
  },
  {
    version: "0.24.0",
    title: "workout-exercise-links",
    sp: 2,
    note: "Tap an exercise in a workout to open it.",
    details: ["Jumps to the same exercise detail the Exercises list opens."],
  },
  {
    version: "0.23.0",
    title: "records-heatmap-dropdowns",
    sp: 5,
    note: "Records codes, year heatmap, custom dropdowns.",
    details: ["Short exercise codes, a training-days heatmap, and OS-consistent dropdowns."],
  },
  {
    version: "0.17.0",
    title: "athlete-chips-progress",
    sp: 3,
    note: "Athlete chips and weekly-progress popups.",
    details: ["Quick athlete switching and per-week progress detail."],
  },
  {
    version: "0.14.0",
    title: "progress-charts",
    sp: 5,
    note: "Per-exercise progress charts + rep targets.",
    details: ["1RM-over-time charts and estimated working weights for rep targets."],
  },
  {
    version: "0.13.0",
    title: "exercise-categories",
    sp: 3,
    note: "Exercise category dropdowns.",
    details: ["Group and browse exercises by training category."],
  },
  {
    version: "0.8.0",
    title: "athlete-pages",
    sp: 5,
    note: "Per-athlete pages.",
    details: ["A dedicated view per athlete with their stats and history."],
  },
  {
    version: "0.5.0",
    title: "exercise-drill-in",
    sp: 5,
    note: "Drill into a single exercise's history.",
    details: ["Weeks, sets, records and a calculator for one exercise."],
  },
  {
    version: "0.3.0",
    title: "workouts-and-records",
    sp: 5,
    note: "Workouts list, records, bodyweight-parts.",
    details: ["Session list, records-per-exercise, and editable bodyweight coefficients."],
  },
  {
    version: "0.1.0",
    title: "leaderboard-settings",
    sp: 5,
    note: "Leaderboard, settings filters, light theme.",
    details: ["First Colosseum leaderboard with filters; light theme; renamed to Colosseum."],
  },
  {
    version: "0.0.1",
    title: "initial-dashboard",
    sp: 8,
    note: "First dashboard.",
    details: ["Load the CSV, validate it, and compute/render leaderboards, PRs and 1RMs."],
  },
];

/** The current (top) version — single source for the on-screen tag and the page. */
export const CURRENT_VERSION = CHANGELOG[0]!.version;

/** Sum of all story points shipped — a small headline stat for the page. */
export const TOTAL_SP = CHANGELOG.reduce((s, r) => s + r.sp, 0);
