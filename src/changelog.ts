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
    version: "b.1.13.2",
    title: "compare-lab-thin-months",
    sp: 2,
    note: "Add a safe Compare (lab) copy where the crowded bottom month labels are thinned; real chart untouched.",
    details: [
      "Other → ‘Compare (lab)’: a copy of the Compare graph (lab engine) that shows the athlete's top lifts, with x-axis labels thinned so months don't crowd at wide zoom — gridlines stay at every boundary.",
      "Done in a separate src/svgChartLab.ts + page so the working Compare graph can't break.",
    ],
  },
  {
    version: "b.1.13.1",
    title: "merge-version-history",
    sp: 1,
    note: "Folded the finished b.1.12 run into one expandable group in the version history.",
    details: ["The ten b.1.12.x entries are now a single b.1.12 dropdown (summed SP), like the older grouped minors."],
  },
  {
    version: "b.1.13.0",
    title: "svg-engine-compare",
    sp: 10,
    note: "New from-scratch SVG chart engine; the Compare graph is the first chart moved onto it (Chart.js dropped there).",
    details: [
      "src/svgChart.ts: reusable engine (line + range series, time/linear x, free pan/zoom, inside labels, tooltips) — no Chart.js, fixed axis frame so nothing drifts.",
      "Exercises → Compare graph (trend + per-set) now renders on the engine; tap a point/bar for its values.",
      "Pure axis maths (calendarGridlines + new niceTicks) are unit-tested. Other charts will move over next, one at a time.",
    ],
  },
  {
    version: "b.1.12",
    title: "graph-saga-and-tags",
    sp: 23,
    note: "The graph fix/rewrite saga (ending in the new SVG engine), workout ‘alone’ tags, and the effort-SP dropdown.",
    details: [
      "Long run of graph gridline/scroll fixes — jitter, drifting axes, invisible lines — culminating in the from-scratch SVG demo + advanced charts.",
      "Workouts: tag sessions as ‘alone’ and filter to them; weekday letter on each session.",
      "Effort SP became a dropdown showing each part's exact points + Fibonacci grade.",
    ],
    children: [
      { version: "b.1.12.9", sp: 2, note: "‘Advanced’ graph (wider, values inside); demo kept as the safe fallback." },
      { version: "b.1.12.8", sp: 1, note: "Demo graph: free 2-D pan + both-axis zoom, no limits." },
      { version: "b.1.12.7", sp: 2, note: "Demo graph scrolls; 1RM-trend graphs anchor at zero." },
      { version: "b.1.12.6", sp: 3, note: "Pin axis padding (sides stop drifting) + add the SVG ‘Graph demo’ in Other." },
      { version: "b.1.12.5", sp: 2, note: "Revert the gridlines to the earlier known-good native mechanism." },
      { version: "b.1.12.4", sp: 2, note: "Make the gridline plugin reliably draw (proper plugin-options channel)." },
      { version: "b.1.12.3", sp: 1, note: "Workouts list shows the weekday letter (M T W Th F Sa Su)." },
      { version: "b.1.12.2", sp: 3, note: "Canvas gridline plugin (later reverted); gridlines darkened; chartAxis tests." },
      { version: "b.1.12.1", sp: 2, note: "Compare categories use the multi-category buckets; workout tag renamed ‘alone’." },
      { version: "b.1.12.0", sp: 5, note: "Workout ‘with me/alone’ tags + effort-SP dropdown (exact + Fibonacci)." },
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
