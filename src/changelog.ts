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
  /** Planned/not-yet-built: shown at the top with a "soon" tag, excluded from
   * the shipped release count, the SP total and the on-screen version. */
  soon?: boolean;
}

export const CHANGELOG: Release[] = [
  {
    version: "next",
    title: "github-auto-save",
    sp: 0,
    soon: true,
    note: "Coming soon: added sets save to GitHub automatically — no Export/Import needed.",
    details: [
      "Hand-logged sets will sync to the repo so they're there on any phone or browser.",
      "Pending a safe way to authorise writes (the site is public): paste-a-token in the browser, or a small private helper.",
    ],
  },
  {
    version: "b.1.12.7",
    title: "demo-scroll-and-1rm-zerobase",
    sp: 2,
    note: "Demo graph now pans/zooms; 1RM-trend graphs anchor at zero instead of auto-zooming.",
    details: [
      "Graph demo: starts zoomed-in (room to pan) and the drag is driven from window listeners, so scrolling/zooming actually works.",
      "1RM trend (drill-in + compare) now begins at zero, so small week-to-week changes aren't exaggerated by a tight auto-scale.",
    ],
  },
  {
    version: "b.1.12.6",
    title: "axis-pin-and-graph-demo",
    sp: 3,
    note: "Pin the graph axis padding so the sides can't shift on pan; add a from-scratch SVG ‘Graph demo’ in Other to test a clean replacement.",
    details: [
      "timeXAxis pins its horizontal padding (afterFit) so the plot area / y-axis stay fixed while panning — fixes the sides drifting sideways.",
      "New Other → ‘Graph demo (test)’ page: a self-contained SVG chart (no Chart.js) with fixed axes and drag/wheel pan-zoom, to evaluate replacing the chart tech.",
    ],
  },
  {
    version: "b.1.12.5",
    title: "revert-graph-gridlines",
    sp: 2,
    note: "Revert the graph gridlines to the earlier, known-good mechanism (no experimental canvas plugin).",
    details: [
      "Removed the custom gridline plugin added this session; Chart.js draws the vertical lines natively again at calendar-boundary ticks computed once from the data range.",
      "Kept the genuinely-good fixes: visible gridline colour and time-only panning (so the y-axis can't drift).",
    ],
  },
  {
    version: "b.1.12.4",
    title: "gridline-plugin-optin",
    sp: 2,
    note: "Make the gridline plugin reliably draw (it was gated on a marker Chart.js may drop).",
    details: [
      "The calendar-gridline plugin now opts in through the standard plugin-options channel and reads its options from the hook arg, instead of a custom scale marker that wasn't guaranteed to survive — so the vertical lines actually render.",
    ],
  },
  {
    version: "b.1.12.3",
    title: "workout-dow-letter",
    sp: 1,
    note: "Workouts list shows the weekday letter (M T W Th F Sa Su) on each session.",
    details: ["Each day-view session now reads e.g. ‘Sa May 2’ so the day of week is clear at a glance."],
  },
  {
    version: "b.1.12.2",
    title: "graph-gridlines-fixed",
    sp: 3,
    note: "Properly fix the graph background lines — visible at any zoom, steady while scrolling.",
    details: [
      "Vertical month/week gridlines are now drawn on the canvas from the live view, so they show at every zoom level and slide smoothly with the data (no more vanishing or jitter).",
      "All graph gridlines darkened so they're actually visible.",
      "Gridline maths pulled into a tested module (src/chartAxis.ts) with unit tests.",
    ],
  },
  {
    version: "b.1.12.1",
    title: "compare-cats-alone-tag",
    sp: 2,
    note: "Compare-graph categories use the current multi-category buckets; workout tag is now ‘alone’.",
    details: [
      "Compare graph ‘By category’ picks now match the By-category list / Group view buckets (Squat pattern, Legs (all), …), with multi-membership.",
      "The workout session tag is now ‘alone’ (filter: ‘Only alone’) instead of ‘with me’.",
    ],
  },
  {
    version: "b.1.12.0",
    title: "with-me-tags-effort-sp",
    sp: 5,
    note: "Tag workouts as ‘done with me’ and filter to them; effort SP moves to a dropdown showing exact + Fibonacci values.",
    details: [
      "Each session has a ‘+me’ tag — turn on ‘Only with me’ to see just those workouts (saved on this device).",
      "Per-part effort is now a dropdown under the title; each part shows its exact SP and the Fibonacci grade (≈) it snaps to.",
      "The whole-site grade shows both too — exact total and its 10/20/30… Fibonacci rank.",
    ],
  },
  {
    version: "b.1.11.0",
    title: "compare-group-list-polish",
    sp: 5,
    note: "Searchable compare chips, no list pagination, combined Group view, alternating month colours, remembered people.",
    details: [
      "Compare graph: a search box + ‘+ N more’ so a long lift list isn't a wall of pills.",
      "List & stats: no pagination — the Period filter scopes the whole list in one scroll.",
      "Group view: one combined table of every exercise with each person's 1RM side by side (shared rows highlighted); the people you pick are remembered next time.",
      "Year heatmap: alternating months are tinted (instead of a divider line) so each month reads as its own band.",
    ],
  },
  {
    version: "b.1.10",
    title: "group-view-and-effort-sp",
    sp: 15,
    note: "Group view, effort-SP chips, list Best-set column, progress-graph fix, month + list-default tweaks.",
    details: [
      "New Group view to train people together; previous pattern/category page renamed ‘Stats view’.",
      "Part chips show effort (SP) on the 1·2·3·5·10·20·30·50·100 scale + a whole-site grade.",
      "List & stats: single editable rep-max, a real ‘Best set’ column, opens on last 3 months.",
    ],
    children: [
      { version: "b.1.10.4", sp: 2, note: "Year heatmap month dividers; List & stats defaults to 3 months / 50 per page." },
      { version: "b.1.10.3", sp: 1, note: "Fix progress graph drifting vertically on scroll (time-only pan)." },
      { version: "b.1.10.2", sp: 2, note: "List & stats ‘Best set’ column — real top weight×reps behind the 1RM." },
      { version: "b.1.10.1", sp: 5, note: "Part chips show effort (SP) instead of versions; list calculator removed." },
      { version: "b.1.10.0", sp: 5, note: "New Group view; old view renamed ‘Stats’; single editable rep-max." },
    ],
  },
  {
    version: "b.1.9",
    title: "categories-best-sets-soon",
    sp: 8,
    note: "Multi-category buckets, real best-sets in the drill-in, and a ‘soon’ tag for planned work.",
    details: [
      "‘By category’ gains pattern + leg-split buckets and multi-membership (a deadlift is Legs, Back AND Core).",
      "Drill-in shows your 5 best sets (real weight×reps) from the last 3 months.",
      "Version history can flag planned-but-unbuilt work with a ‘soon’ tag.",
    ],
    children: [
      { version: "b.1.9.2", sp: 1, note: "Version history ‘soon’ tag for planned work (GitHub auto-save queued)." },
      { version: "b.1.9.1", sp: 2, note: "Drill-in: 5 best sets (real weight×reps) from the last 3 months." },
      { version: "b.1.9.0", sp: 5, note: "Multi-category ‘By category’: pattern + leg-split buckets, lifts under every category they fit." },
    ],
  },
  {
    version: "b.1.8.0",
    title: "other-nav-group-view",
    sp: 5,
    note: "App-style bottom nav: Workouts | Exercises | Other — plus a new Group view.",
    details: [
      "The bottom bar is now the whole app's navigation; the old top tab row is gone.",
      "‘Other’ opens a sheet holding Colosseum, Add, Data, Test, Merges/body parts, Guide and the new Group view.",
      "Group view: each movement pattern / muscle group with the best estimated 1RM — per athlete (best lift in each) or everyone (a mini leaderboard).",
    ],
  },
  {
    version: "b.1.7",
    title: "add-tab-and-exercise-list",
    sp: 9,
    note: "Hand-logged ‘Add’ tab with export/import, and the codes/rep-max exercises list.",
    details: [
      "New ‘Add’ tab: log sets by hand, merged into every view; manage/delete them in a list.",
      "Export/Import backs up and moves your added sets between browser/phone.",
      "Exercises list shows 3-letter codes with editable rep-max columns; many owner-chosen codes.",
    ],
    children: [
      { version: "b.1.7.2", sp: 4, note: "Export/Import backup + custom exercise codes (BE, HT, Dip, Pull, PU, dSU, mCR, rcSB, H-ABD…)." },
      { version: "b.1.7.1", sp: 2, note: "Exercises list: 3-letter codes, no wrapping, editable rep-max columns." },
      { version: "b.1.7.0", sp: 3, note: "New ‘Add’ tab to log sets by hand, merged with the StrengthLevel data." },
    ],
  },
  {
    version: "b.1.6",
    title: "navigation-and-version-tracking",
    sp: 9,
    note: "Bottom nav bar, Exercises redesign, grouped version history, per-section chips.",
    details: [
      "Athlete tabs became a bottom nav bar; the Records tab was removed.",
      "Version history folds every minor into one expandable group with summed SP.",
      "Per-section version chips under the title (and listed in this page).",
    ],
    children: [
      { version: "b.1.6.4", sp: 1, note: "Workouts year heatmap outlines today's cell." },
      { version: "b.1.6.3", sp: 3, note: "Exercises redesign: Compare-graph/List tabs, kebab filters, floating search, records-style list; b.1.0–b.1.5 grouped." },
      { version: "b.1.6.2", sp: 1, note: "Removed the Records tab; section versions also listed in Settings." },
      { version: "b.1.6.1", sp: 1, note: "Per-section version chips under the title." },
      { version: "b.1.6.0", sp: 3, note: "Athlete bottom nav bar + version history grouped by minor/era." },
    ],
  },
  {
    version: "b.1.0–b.1.5",
    title: "graphs-compare-hosting",
    sp: 23,
    note: "The b.1.0–b.1.5 run: version history, compare graph, per-set views, live hosting.",
    details: [
      "Version history page + the b.x versioning scheme.",
      "Compare-on-one-graph with category/tier picks and per-set + 1RM-trend views.",
      "Per-set range graphs (every set, range per set), calendar gridlines, smooth pan/zoom.",
      "Workouts 'Sets over time' graph and GitHub Pages auto-deploy.",
    ],
    children: [
      { version: "b.1.5", sp: 7, note: "Workouts sets-over-time graph, smoother charts, and live hosting." },
      { version: "b.1.4", sp: 3, note: "Time-axis gridlines on clean week/month boundaries." },
      { version: "b.1.3", sp: 5, note: "Per-set range in the compare graph; expandable version history." },
      { version: "b.1.2", sp: 3, note: "Category & tier quick-picks for the compare graph." },
      { version: "b.1.1", sp: 3, note: "Per-set range graph shows every set, one bar per set." },
      { version: "b.1.0", sp: 2, note: "Version history page + version-scheme reset." },
    ],
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
const TOP = CHANGELOG.find((r) => !r.soon)!;
export const CURRENT_VERSION = TOP.children?.length ? TOP.children[0]!.version : TOP.version;

/** The modified-Fibonacci SP scale — the only allowed grades, no in-between. */
export const SP_SCALE = [1, 2, 3, 5, 10, 20, 30, 50, 100] as const;

/** Snap an exact story-point count to the nearest value on {@link SP_SCALE}
 * (so a fib-SP is only ever 10, 20, 30, … never an in-between number). */
export function fibSp(n: number): number {
  let best = SP_SCALE[0] as number;
  for (const v of SP_SCALE) if (Math.abs(v - n) < Math.abs(best - n)) best = v;
  return best;
}

/**
 * Per-section EFFORT shown under the title — the EXACT story points spent on each
 * part (estimated by reading the whole history). Each part also carries a
 * Fibonacci grade ({@link fibSp}) so it reads both precisely and on the scale.
 */
export interface Component {
  name: string;
  /** Exact story points spent on this part. */
  sp: number;
}
export const COMPONENTS: Component[] = [
  { name: "Exercises", sp: 34 }, // drill-ins, categories, tiers, merges, codes, rep-max, best-sets, compare
  { name: "Athlete", sp: 22 }, // per-athlete pages, chips, muscle map, momentum, training mix
  { name: "Graphs", sp: 21 }, // compare/per-set graphs, gridlines, smooth pan/zoom, curves
  { name: "Workouts", sp: 20 }, // day/week list, rest days, year heatmap, sets-over-time, "with me" tags
  { name: "Data", sp: 12 }, // raw+processed CSV tab, every computed variable, search
  { name: "Leaderboard", sp: 11 }, // boards, rank/sex/BW/axis filters, pattern-lift toggle
  { name: "Group", sp: 9 }, // train people together: combined comparison table, remembered picks
  { name: "Add", sp: 7 }, // hand-log sets, merge, export/import
  { name: "Calculator", sp: 6 }, // multi-row reps↔weight calc + Test-tab curve
  { name: "Stats", sp: 6 }, // pattern / category cards (was Groups)
  { name: "Navigation", sp: 5 }, // bottom nav + Other sheet
];

/** Whole-site EXACT story points (sum of every part) and its Fibonacci grade. */
export const WEBSITE_EXACT_SP = COMPONENTS.reduce((s, c) => s + c.sp, 0);
export const WEBSITE_SP = fibSp(WEBSITE_EXACT_SP);
