/**
 * Release log shown in Settings → Version history. The app is a static build
 * with no git at runtime, so the log is kept here as data and updated alongside
 * each release (the on-screen <span class="version"> must match the top entry).
 *
 * Versioning is `b.MAJOR.MINOR.PATCH` (reset at b.1.0.0). Finished minors are
 * folded into one grouped entry (children = their patches, sp = the sum); the
 * in-progress minor stays a flat entry until it's done. Pre-reset history is
 * grouped by era (the 0.30s, 0.20s, 0.10s and the earliest 0.0s builds).
 */
export interface Release {
  version: string;
  /** Short kebab title (matches the commit explainer). */
  title: string;
  /** Scrum story points (a grouped entry's sp is the sum of its children). */
  sp: number;
  /** One-line plain-language summary, shown collapsed. */
  note: string;
  /** Bullet points, shown when the row is expanded. */
  details: string[];
  /** Sub-versions folded under this one; expands into a dropdown list. */
  children?: { version: string; sp: number; note: string }[];
}

export const CHANGELOG: Release[] = [
  {
    version: "b.1.6.1",
    title: "per-section-version-chips",
    sp: 1,
    note: "Per-section version chips under the title.",
    details: [
      "Each app section (Graphs, Workouts, Data, Athlete…) now shows its own bMAJOR.MINOR version under the title.",
      "These bump independently whenever that section is updated.",
    ],
  },
  {
    version: "b.1.6.0",
    title: "bottom-nav-and-changelog-groups",
    sp: 3,
    note: "Athlete tabs as a bottom nav bar; version history grouped by minor.",
    details: [
      "Workouts / Exercises / Records are now a fixed bottom nav bar with icons, not small pills.",
      "Version history folds every finished minor (and the old 0.x eras) into one expandable entry with summed SP.",
    ],
  },
  {
    version: "b.1.5",
    title: "graphs-and-live-hosting",
    sp: 7,
    note: "Workouts sets-over-time graph, smoother charts, and live hosting.",
    details: [
      "New Workouts 'Sets over time' graph: every set as a weight → own-1RM bar, coloured per exercise.",
      "All time-axis graphs pan/zoom smoothly; calendar gridlines are fixed to the data.",
      "Set up GitHub Pages auto-deploy — refresh the live URL instead of downloading a file.",
    ],
    children: [
      { version: "b.1.5.4", sp: 1, note: "Header version tag opens Version history (live-deploy test)." },
      { version: "b.1.5.3", sp: 1, note: "Graphs no longer jerky — gridlines fixed to the data, not the zoom view." },
      { version: "b.1.5.2", sp: 1, note: "Sets-over-time graph 30% shorter; GitHub Pages auto-deploy added." },
      { version: "b.1.5.1", sp: 1, note: "1RM trend compare graph pans/zooms again." },
      { version: "b.1.5.0", sp: 3, note: "Workouts 'Sets over time' graph + fix for the broken/jerky graphs." },
    ],
  },
  {
    version: "b.1.4",
    title: "calendar-gridlines",
    sp: 3,
    note: "Time-axis gridlines on clean week/month boundaries.",
    details: ["Vertical gridlines land on the 1st of each month (long ranges) or Mondays (short ranges)."],
    children: [{ version: "b.1.4.0", sp: 3, note: "Calendar gridlines on week/month boundaries (refined in b.1.5)." }],
  },
  {
    version: "b.1.3",
    title: "compare-per-set-and-changelog",
    sp: 5,
    note: "Per-set range in the compare graph; expandable version history.",
    details: [
      "Compare graph gained a per-set range view, colour-coded per exercise.",
      "Version history rows became expandable with bullet details + SP.",
      "Per-set bar thickness tuned to taste.",
    ],
    children: [
      { version: "b.1.3.2.1", sp: 1, note: "Per-set compare bars thinned to a quarter (16 → 4 px)." },
      { version: "b.1.3.2", sp: 1, note: "Per-set compare bars thicker + pan/zoom scrollable." },
      { version: "b.1.3.1", sp: 1, note: "Version history rows expandable, with bullets and SP." },
      { version: "b.1.3.0", sp: 2, note: "Per-set range view in the compare graph." },
    ],
  },
  {
    version: "b.1.2",
    title: "compare-tier-category-picks",
    sp: 3,
    note: "Category & tier quick-picks for the compare graph.",
    details: ["Add a whole category (Legs, Chest…) or frequency tier (S/A/B/C/D) to the compare graph at once."],
    children: [{ version: "b.1.2.0", sp: 3, note: "Category & tier quick-picks + Clear button." }],
  },
  {
    version: "b.1.1",
    title: "per-set-range-all-sets",
    sp: 3,
    note: "Per-set range graph shows every set, one bar per set.",
    details: ["Each set is its own bar (weight → its own 1RM) — no cross-set mixing, no hidden sets."],
    children: [{ version: "b.1.1.0", sp: 3, note: "Per-set range graph fixed to show all sets, range per set." }],
  },
  {
    version: "b.1.0",
    title: "version-history-page",
    sp: 2,
    note: "Version history page + version-scheme reset.",
    details: ["Added the Version history page; reset versioning to the b.MAJOR.MINOR.PATCH scheme."],
    children: [{ version: "b.1.0.0", sp: 2, note: "Version history page + reset to the b.x scheme." }],
  },
  {
    version: "0.30s",
    title: "charts-correctness-era",
    sp: 34,
    note: "The 0.30–0.39 era: muscle map, tiers, momentum, and big correctness audits.",
    details: [
      "Athlete muscle map, momentum chips, exercise frequency tiers.",
      "Compare-on-one-graph, weight-vs-reps diagram, tap-a-1RM formula reveal.",
      "Major correctness work: bodyweight-aware 1RM everywhere, the rep-cap rule, Smith/deadlift separation.",
    ],
    children: [
      { version: "0.36.1", sp: 3, note: "Athlete 'Momentum' trend chips." },
      { version: "0.36.0", sp: 3, note: "Design/logic audit fixes." },
      { version: "0.35.5", sp: 4, note: "1RM-consistency audit + regression tests." },
      { version: "0.35.4", sp: 3, note: "'By tier' sort on the Exercises view." },
      { version: "0.35.3", sp: 2, note: "Muscle map shaded by strength, not sets." },
      { version: "0.35.2", sp: 1, note: "Deadlift pattern = Deadlift + RDL only." },
      { version: "0.35.1", sp: 2, note: "Sets above 15 reps show '—' for 1RM." },
      { version: "0.35.0", sp: 3, note: "Collapsible front/back muscle map." },
      { version: "0.34.0", sp: 3, note: "Overlay several exercises' 1RM trends." },
      { version: "0.33.0", sp: 2, note: "Test-tab weight-vs-reps curve." },
      { version: "0.32.0", sp: 3, note: "Workouts 1RM now includes bodyweight." },
      { version: "0.31.0", sp: 3, note: "Smith Machine Squat separated; origin badges." },
      { version: "0.30.0", sp: 2, note: "Tap a 1RM to see its formula." },
    ],
  },
  {
    version: "0.20s",
    title: "data-tab-era",
    sp: 18,
    note: "The 0.20–0.29 era: the Data tab, records heatmap, editable calculator.",
    details: ["New Data tab (raw + processed CSV), records codes & year heatmap, multi-row calculator, workout→exercise links."],
    children: [
      { version: "0.29.0", sp: 3, note: "Data tab exposes every computed variable." },
      { version: "0.26.0", sp: 3, note: "Per-exercise calculator is a multi-row table." },
      { version: "0.25.0", sp: 5, note: "New Data tab (original + processed CSV)." },
      { version: "0.24.0", sp: 2, note: "Tap an exercise in a workout to open it." },
      { version: "0.23.0", sp: 5, note: "Records codes, year heatmap, custom dropdowns." },
    ],
  },
  {
    version: "0.10s",
    title: "charts-and-categories-era",
    sp: 11,
    note: "The 0.10–0.19 era: progress charts, exercise categories, athlete chips.",
    details: ["Per-exercise progress charts + rep targets, category dropdowns, and quick athlete switching."],
    children: [
      { version: "0.17.0", sp: 3, note: "Athlete chips and weekly-progress popups." },
      { version: "0.14.0", sp: 5, note: "Per-exercise progress charts + rep targets." },
      { version: "0.13.0", sp: 3, note: "Exercise category dropdowns." },
    ],
  },
  {
    version: "0.0s",
    title: "foundations",
    sp: 28,
    note: "The earliest builds: first dashboard through athlete pages.",
    details: ["From the first CSV dashboard to leaderboards, workouts/records, exercise drill-ins and per-athlete pages."],
    children: [
      { version: "0.8.0", sp: 5, note: "Per-athlete pages." },
      { version: "0.5.0", sp: 5, note: "Drill into a single exercise's history." },
      { version: "0.3.0", sp: 5, note: "Workouts list, records, bodyweight-parts." },
      { version: "0.1.0", sp: 5, note: "Leaderboard, settings filters, light theme — renamed to Colosseum." },
      { version: "0.0.1", sp: 8, note: "First dashboard: load the CSV and render leaderboards/PRs/1RMs." },
    ],
  },
];

/** The on-screen version: always the latest actual sub-version. When the newest
 * entry is a grouped minor, that's its first (newest) child, not the group name. */
const TOP = CHANGELOG[0]!;
export const CURRENT_VERSION = TOP.children?.length ? TOP.children[0]!.version : TOP.version;

/**
 * Per-section versions shown as chips under the title. Each part of the app
 * carries its own `bMAJOR.MINOR` version; bump the relevant one whenever that
 * section changes (minor for a feature/fix, e.g. b1.0 → b1.1). Keep this list in
 * step with the work — it's the at-a-glance "what's been touched" tracker.
 */
export interface Component {
  name: string;
  version: string;
}
export const COMPONENTS: Component[] = [
  { name: "Leaderboard", version: "b1.0" },
  { name: "Athlete", version: "b1.1" }, // bumped: bottom nav bar (b.1.6.0)
  { name: "Workouts", version: "b1.1" }, // bumped: sets-over-time graph (b.1.5)
  { name: "Exercises", version: "b1.0" },
  { name: "Data", version: "b1.0" },
  { name: "Graphs", version: "b1.2" }, // bumped: per-set/compare graphs, calendar gridlines, smoothness
  { name: "Calculator", version: "b1.0" },
  { name: "Records", version: "b1.0" },
];

/** Sum of all story points shipped (grouped entries already total their children). */
export const TOTAL_SP = CHANGELOG.reduce((s, r) => s + r.sp, 0);
