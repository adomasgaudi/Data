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
    version: "b.2",
    title: "v2-milestone",
    sp: 0, // auto-computed below = sum of children
    note: "Version 2 (current): the dashboard graduates to a polished, self-updating app — real-time charts, every lift on its own, one-click data refresh from StrengthLevel, and a clean settings-driven UI. New releases land here.",
    details: [
      "A round-number milestone after the big b.1.14 run: live data refresh, real time-axis charts with calendar bands, ungrouped exercises, and tidied chrome.",
      "Onwards from here, b.2.x patches build on this foundation.",
    ],
    children: [
      { version: "b.2.0.25", sp: 0.1, note: "Year heatmap day-of-month numbers turned down even more (barely-there): 8% black / 16% white on dark days." },
      { version: "b.2.0.24", sp: 0.1, note: "Year heatmap day-of-month numbers are now centred in the square and much more transparent — a faint hint rather than a label." },
      { version: "b.2.0.23", sp: 0.5, note: "Year heatmap squares now show a tiny day-of-month number in the corner; Workouts now defaults to By week + Muscle groups, and the year heatmap defaults to the Legs filter." },
      { version: "b.2.0.22", sp: 0.5, note: "Sign-in is remembered: once you press “Sign in as admin” you skip the landing gate on every later visit (hidden before paint, no flash)." },
      { version: "b.2.0.21", sp: 0.5, note: "Decorative landing gate: a simple sign-in screen with one “Sign in as admin” button that reveals the app (no real auth)." },
      { version: "b.2.0.20", sp: 0.5, note: "Year heatmap heat colours re-scaled: 1 set light blue, 2–3 darker blue, 4–5 dark blue, 6–9 light gold, 10+ dark gold." },
      { version: "b.2.0.19", sp: 0.5, note: "Year heatmap rest squares now alternate by month — white with a thin gray outline vs very light gray with a slightly darker outline — instead of the warm tint (themed for dark mode too)." },
      { version: "b.2.0.18", sp: 3, note: "Grade how hard each set felt: every set in the Workouts and Exercises sets tables gets an RPE (1–10) picker. Saved on the device (the CSV has no difficulty column) and shown in the per-set graph tooltip." },
      { version: "b.2.0.17", sp: 1, note: "Sets/week bars: translucent fill (was outline) and squished further (5× taller right axis, baseline still 0) so they stay low and don't overlap the 1RM data." },
      { version: "b.2.0.16", sp: 1, note: "Sets/week bars are now 30% thinner, outline-only (transparent), and sit low on a 3× taller right axis so they no longer tower over the 1RM data." },
      { version: "b.2.0.15", sp: 5, note: "Combine lifts in a drill-in: a “＋ combine with…” picker views e.g. Squat + Smith Machine Squat as one (records, best sets, weekly and graph all merged). Moved the chart's “Center” button into the controls so it no longer covers the legend toggles." },
      { version: "b.2.0.14", sp: 1, note: "Sets/week bars are now as wide as the week they cover (histogram-style, no thin sticks); the Workouts muscle-group view reads “Quads — 4 sets”." },
      { version: "b.2.0.13", sp: 5, note: "Drill-in graph merged into ONE chart — every view is a legend toggle: Est. 1RM (a dot for EVERY set), Current strength (connected line), Per-set range, Sets/week, and an optional logarithmic Trend. Re-graded the whole-site effort (now ≈200 SP)." },
      { version: "b.2.0.12", sp: 1, note: "1RM-trend graph: each week's est-1RM is now a scatter of dots, not a connected line (it bounces around, so a line implied a trend that isn't there). The current-strength ceiling stays a line." },
      { version: "b.2.0.11", sp: 2, note: "Index: tap any exercise to expand its info — category, muscle group, tier, bodyweight part, total sets, who trains it, the best 1RM ever logged (anyone) and the date span." },
      { version: "b.2.0.10", sp: 1, note: "Exercises list: the active period (e.g. “Last 3 months”) is now always shown above the list and tappable to change — no more forgetting it's filtered." },
      { version: "b.2.0.9", sp: 1, note: "Renamed the all-exercises / body-parts page to “Index” so it's not confused with a person's own Exercises list; added a one-line explainer at its top." },
      { version: "b.2.0.8", sp: 1, note: "The athlete chip row now sticks to the top while you scroll, and the selected athlete scrolls into view — so you always see whose data you're looking at." },
      { version: "b.2.0.7", sp: 3, note: "Graphs with 2+ lines: tap a legend key to show/hide that series (e.g. hide raw 1RM to see just current strength). Legend keys are now toggle buttons; keeps your pan/zoom." },
      { version: "b.2.0.6", sp: 5, note: "“Current strength” line on every 1RM graph — the best estimated 1RM reached up to each date (never drops; a weaker set is just an off day). Added to the drill-in 1RM-trend and per-set charts; the Compare graph's trend line now shows current strength." },
      { version: "b.2.0.5", sp: 2, note: "Exercise drill-in: an “ℹ Exercise info” button jumps to that exercise's row on the Exercises (merges & data) page — the same lift, no specific person — opening its category and flashing the row." },
      { version: "b.2.0.4", sp: 3, note: "New “Site map” tab (Other menu): a mind map of the whole app — every tab and what's inside it, drawn as a colour-coded tree." },
      { version: "b.2.0.3", sp: 3, note: "Version history shows a “story points over time” line — cumulative SP plotted on a real time axis from every release commit's date (generated by scripts/gen-sp-history.cjs)." },
      { version: "b.2.0.2", sp: 2, note: "Compare graph: lists the actual sets behind it underneath (date · exercise · weight×reps · est 1RM, newest first, colour-matched to each line)." },
      { version: "b.2.0.1", sp: 2, note: "Workouts: a “Show” toggle to list each session by muscle group (Quads, Hams, Glutes, Chest, Back, …) with set counts, instead of exercise names." },
      { version: "b.2.0.0", sp: 1, note: "Version 2 milestone — rolled the b.1.x line up to b.2 to mark the self-updating, real-time-chart app." },
    ],
  },
  {
    version: "b.1.14",
    title: "real-time-axis-and-pickers",
    sp: 0, // auto-computed below = sum of children
    note: "The b.1.14 run: per-set graph on a real time axis with calendar bands, dashed rep lines and a best-set-only toggle, a By-category show/hide picker, the rep-max reps chosen in the column header, and every exercise standing on its own (no scaling groups).",
    details: [
      "Per-set drill-in chart now uses genuine calendar time with alternating year/month/week bands; same-day sets fan out within the day; each set's line is dashed, one dash per rep; optional best-set-only view.",
      "By-category list: chips to choose which categories you see; rep-max reps moved into the column header; scaling/pattern groups removed so each lift is separate.",
    ],
    children: [
      { version: "b.1.14.7", sp: 2, note: "Refresh shows live status (reads the GitHub Action via its API): ⏳ running — keep waiting (auto-updates), ✓ succeeded, or ✗ failed — so you know whether to wait." },
      { version: "b.1.14.6", sp: 5, note: "“Refresh data” button (Data tab): one click runs a GitHub Action that scrapes the newest StrengthLevel workouts, commits ud.csv and auto-redeploys — no local setup, no CORS." },
      { version: "b.1.14.5", sp: 1, note: "Tidy chrome: only the whole-site SP under the title (per-part chips live in Version history), night mode moved into Settings, and group SP totals are now auto-summed from their releases." },
      { version: "b.1.14.4", sp: 5, note: "Removed scaling/“pattern” groups — Bench Press, Shoulder Press, Row, etc. are each their own exercise (no more ‘(also: …)’ merging); Group view is category-only. Queued a ‘fetch live data’ task." },
      { version: "b.1.14.3", sp: 3, note: "Time axis fixed: alternating year/month/week background bands; labels adapt to zoom (never blank, never duplicate ‘Jan 1’)." },
      { version: "b.1.14.2", sp: 1, note: "Per-set graph: ‘Best set only’ toggle — show just each day's top set (highest estimated 1RM) instead of every set." },
      { version: "b.1.14.1", sp: 2, note: "Per-set lines are dashed — one dash per rep — so reps read at a glance (50→59 over 5 reps = 5 dashes)." },
      { version: "b.1.14.0", sp: 5, note: "Per-set graph on a REAL time axis (each day once, sets fanned within the day); By-category show/hide chips; rep-max reps chosen in the column header." },
    ],
  },
  {
    version: "b.1.13",
    title: "drillin-charts-and-polish",
    sp: 55,
    note: "The b.1.13 run: every chart on the new SVG engine, Chart.js removed, dark mode, per-axis zoom, and drill-in/list polish.",
    details: [
      "All charts migrated to the in-house SVG engine (pan/pinch-zoom incl. per-axis stretch, tooltips, themed); Chart.js dropped.",
      "Dark mode; compare-picker redesign; per-set & 1RM-trend fixes; list defaults + rep-max bar.",
    ],
    children: [
      { version: "b.1.13.16", sp: 3, note: "New Fibonacci SP scale (…8,13,…80,130,200); version history split into b.1.13 / b.1.12 / b.1.10–b.1.11; By-tier collapsed by default." },
      { version: "b.1.13.15", sp: 2, note: "Drill-in 1RM trend zooms vertically too (both y-axes together); per-set range already free-pans." },
      { version: "b.1.13.14", sp: 3, note: "Per-set graph shows EVERY set of each day (high-rep sets as a marker); ‘Legs (all)’ category hidden from lists with a Settings toggle." },
      { version: "b.1.13.13", sp: 2, note: "Drill-in per-set graph: one bar per set (own weight → own 1RM), not a merged day range." },
      { version: "b.1.13.12", sp: 2, note: "Per-axis pinch (X-only / Y-only stretch) on every chart; Shift/Alt+wheel on desktop." },
      { version: "b.1.13.11", sp: 2, note: "List & stats defaults to By-category (collapsed); rep-max moved to a visible bar." },
      { version: "b.1.13.10", sp: 1, note: "Merge version history into range dropdowns." },
      { version: "b.1.13.9", sp: 2, note: "Per-axis pinch test (X-only / Y-only) in Graph (advanced)." },
      { version: "b.1.13.8", sp: 5, note: "Leaderboard → SVG; Chart.js removed entirely (~84 KB lighter)." },
      { version: "b.1.13.7", sp: 5, note: "Dark mode — header toggle, charts themed too." },
      { version: "b.1.13.6", sp: 2, note: "Test weight↔reps curve on the SVG engine." },
      { version: "b.1.13.5", sp: 5, note: "Drill-in 1RM-trend + per-set charts migrated to the engine." },
      { version: "b.1.13.4", sp: 3, note: "Compare picker redesign: selected-only chips + search-to-add." },
      { version: "b.1.13.3", sp: 5, note: "Touch pan + pinch-zoom fixed; Workouts chart migrated." },
      { version: "b.1.13.2", sp: 2, note: "Compare (lab) page with thinned month labels." },
      { version: "b.1.13.1", sp: 1, note: "Merged the b.1.12 run into one dropdown." },
      { version: "b.1.13.0", sp: 10, note: "New from-scratch SVG chart engine; Compare graph migrated." },
    ],
  },
  {
    version: "b.1.12",
    title: "graph-saga-tags-effort",
    sp: 23,
    note: "The b.1.12 run: the graph fix/rewrite saga (→ the from-scratch SVG demo), workout ‘alone’ tags, and the effort-SP dropdown.",
    details: [
      "Long run of gridline/scroll fixes culminating in the SVG demo + advanced charts.",
      "Workout ‘alone’ tags + weekday letter; effort-SP dropdown (exact + Fibonacci).",
    ],
    children: [
      { version: "b.1.12.9", sp: 2, note: "‘Advanced’ graph (wider, values inside)." },
      { version: "b.1.12.8", sp: 1, note: "Demo graph: free 2-D pan + both-axis zoom." },
      { version: "b.1.12.7", sp: 2, note: "Demo scrolls; 1RM-trend anchors at zero." },
      { version: "b.1.12.6", sp: 3, note: "Pin axis padding; add the SVG graph demo." },
      { version: "b.1.12.5", sp: 2, note: "Revert gridlines to the native mechanism." },
      { version: "b.1.12.4", sp: 2, note: "Make the gridline plugin reliably draw." },
      { version: "b.1.12.3", sp: 1, note: "Workouts weekday letter (M T W Th F Sa Su)." },
      { version: "b.1.12.2", sp: 3, note: "Canvas gridline plugin (later reverted) + chartAxis tests." },
      { version: "b.1.12.1", sp: 2, note: "Compare categories multi-bucket; workout ‘alone’ tag." },
      { version: "b.1.12.0", sp: 5, note: "Workout alone tags + effort-SP dropdown." },
    ],
  },
  {
    version: "b.1.10–b.1.11",
    title: "group-view-effort-sp",
    sp: 20,
    note: "The b.1.10–b.1.11 run: Group/Stats views, effort-SP chips, multi-category buckets, and List/Workouts polish.",
    details: [
      "New Group view (+ old view renamed ‘Stats’); effort-SP chips; combined Group comparison.",
      "List ‘Best set’ column, single rep-max, no pagination; year-heatmap month dividers.",
    ],
    children: [
      { version: "b.1.11.0", sp: 5, note: "Searchable compare chips, no list pagination, combined Group view." },
      { version: "b.1.10.4", sp: 2, note: "Year heatmap month dividers; list defaults 3 months / 50." },
      { version: "b.1.10.3", sp: 1, note: "Fix progress graph vertical drift." },
      { version: "b.1.10.2", sp: 2, note: "List & stats ‘Best set’ column." },
      { version: "b.1.10.1", sp: 5, note: "Effort-SP chips; list calculator removed." },
      { version: "b.1.10.0", sp: 5, note: "New Group view; old view → ‘Stats’; single editable rep-max." },
    ],
  },
  {
    version: "b.1.6–b.1.9",
    title: "nav-add-categories",
    sp: 31,
    note: "The b.1.6–b.1.9 run: bottom-nav redesign, the ‘Add’ tab, the Other umbrella + Group view, and multi-category buckets.",
    details: [
      "Athlete bottom nav + ‘Other’ umbrella; the ‘Add’ tab for hand-logged sets with Export/Import.",
      "Multi-category ‘By category’ buckets; drill-in best-sets; exercise codes; year-heatmap polish.",
    ],
    children: [
      { version: "b.1.9.2", sp: 1, note: "Version-history ‘soon’ tag for planned work." },
      { version: "b.1.9.1", sp: 2, note: "Drill-in: 5 best sets from the last 3 months." },
      { version: "b.1.9.0", sp: 5, note: "Multi-category ‘By category’ buckets." },
      { version: "b.1.8.0", sp: 5, note: "Other bottom-nav umbrella + new Group view." },
      { version: "b.1.7.2", sp: 4, note: "Export/Import backup + custom exercise codes." },
      { version: "b.1.7.1", sp: 2, note: "Exercises list: 3-letter codes + editable rep-max." },
      { version: "b.1.7.0", sp: 3, note: "New ‘Add’ tab to log sets by hand." },
      { version: "b.1.6.4", sp: 1, note: "Workouts year heatmap outlines today." },
      { version: "b.1.6.3", sp: 3, note: "Exercises redesign: tabs, kebab filters, floating search." },
      { version: "b.1.6.2", sp: 1, note: "Removed the Records tab." },
      { version: "b.1.6.1", sp: 1, note: "Per-section version chips under the title." },
      { version: "b.1.6.0", sp: 3, note: "Athlete bottom nav + grouped version history." },
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

// A grouped minor's `sp` is the SUM of its children — computed here, never
// hand-maintained, so the totals can't drift from the per-release numbers. The
// literal `sp` on a group with children is just a placeholder; this overwrites it.
for (const r of CHANGELOG) {
  if (r.children?.length) r.sp = r.children.reduce((s, c) => s + c.sp, 0);
}

/** The on-screen version: always the latest actual sub-version. When the newest
 * entry is a grouped minor, that's its first (newest) child, not the group name. */
const TOP = CHANGELOG.find((r) => !r.soon)!;
export const CURRENT_VERSION = TOP.children?.length ? TOP.children[0]!.version : TOP.version;

/** The modified-Fibonacci SP scale — the only allowed grades, no in-between. */
export const SP_SCALE = [1, 2, 3, 5, 8, 13, 20, 30, 50, 80, 130, 200] as const;

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
  { name: "Exercises", sp: 50 }, // drill-ins, categories, tiers, merges, rep-max header, best-sets, compare+sets, Index info, period bar
  { name: "Graphs", sp: 50 }, // SVG engine; real time axis + calendar bands, dashed reps, current strength, scatter, legend toggles, merged graph, log trend
  { name: "Athlete", sp: 22 }, // per-athlete pages, sticky chips, muscle map, momentum, training mix
  { name: "Workouts", sp: 22 }, // day/week list, muscle-group view, rest days, year heatmap, sets-over-time, "with me" tags
  { name: "Data", sp: 20 }, // raw+processed CSV tab, every computed variable, search, live refresh from StrengthLevel + status
  { name: "Leaderboard", sp: 11 }, // boards, rank/sex/BW/axis filters
  { name: "Group", sp: 9 }, // train people together: combined comparison table, remembered picks
  { name: "Navigation", sp: 9 }, // bottom nav + Other sheet, Site map, version history + SP-over-time
  { name: "Add", sp: 7 }, // hand-log sets, merge, export/import
  { name: "Calculator", sp: 6 }, // multi-row reps↔weight calc + Test-tab curve
  { name: "Stats", sp: 6 }, // per-category cards (was Groups)
];

/** Whole-site EXACT story points (sum of every part) and its Fibonacci grade. */
export const WEBSITE_EXACT_SP = COMPONENTS.reduce((s, c) => s + c.sp, 0);
export const WEBSITE_SP = fibSp(WEBSITE_EXACT_SP);
