/**
 * Release log shown in Settings → Version history. The app is a static build
 * with no git at runtime, so the log is kept here as data and updated alongside
 * each release (the on-screen <span class="version"> must match the top entry).
 *
 * Versioning is `b.MAJOR.MINOR.PATCH` (reset at b.1.0.0). Releases are folded
 * into grouped entries (children = their patches, sp = the sum). Groups are kept
 * to roughly 20–30 story points each — a big minor is split into several ranged
 * groups rather than one giant one. Every entry (group and child) carries a
 * 2–5 word title.
 */
export interface Release {
  version: string;
  /** 2–5 word title for the group. */
  title: string;
  /** Scrum story points (a grouped entry's sp is the sum of its children). */
  sp: number;
  /** One-line plain-language summary, shown collapsed. */
  note: string;
  /** Bullet points, shown when the row is expanded. */
  details: string[];
  /** Sub-versions folded under this one; expands into a dropdown list. Each has
   * its own 2–5 word title. */
  children?: { version: string; title: string; sp: number; note: string }[];
  /** Planned/not-yet-built: shown at the top with a "soon" tag, excluded from
   * the shipped release count, the SP total and the on-screen version. */
  soon?: boolean;
}

export const CHANGELOG: Release[] = [
  {
    version: "next",
    title: "GitHub auto-save",
    sp: 0,
    soon: true,
    note: "Coming soon: added sets save to GitHub automatically — no Export/Import needed.",
    details: [
      "Hand-logged sets will sync to the repo so they're there on any phone or browser.",
      "Pending a safe way to authorise writes (the site is public): paste-a-token in the browser, or a small private helper.",
    ],
  },
  {
    version: "b.2.1",
    title: "Version 2 polish",
    sp: 0, // auto-computed below = sum of children
    note: "The b.2.1 run (current): continued polish on the version-2 app. New releases land here.",
    details: [
      "Trimmed version-history notes, a Browse-groups panel on the Index, and a 2–5 word title on every release.",
    ],
    children: [
      { version: "b.2.1.28", title: "Compact settings panel", sp: 0.5, note: "Settings panel tightened up: smaller padding and gaps, and the checkboxes now sit inline with their labels instead of stacked above them — so the whole ⚙ menu is much more compact and needs less scrolling." },
      { version: "b.2.1.27", title: "Sit-up arm position", sp: 2, note: "Decline sit-ups can now be logged by arm position, not just weight: typing “decline sit ups” in Add a set reveals an “Arm position” dropdown (arms on stomach → straight by sides → hands on head → overhead bent → overhead straight, easiest to hardest). The pick is folded into the exercise name so each position tracks as its own variant — how you make the movement harder without adding weight." },
      { version: "b.2.1.26", title: "Compacted-time graph toggle", sp: 8, note: "Every time-based graph (exercise progress, the compare overlay, workout sets-over-time and the version-history SP line) now has a “⇄ Realistic / Compacted time” toggle in its legend. Realistic keeps the real calendar spacing with the empty gaps; compacted squeezes the rest weeks and layoffs so every session is evenly spaced and all your sets fit — dates still show on the axis and tooltips. One app-wide switch: flip it on any graph and they all follow; remembered on your device." },
      { version: "b.2.1.25", title: "Today session label", sp: 0.5, note: "Workouts “By day” list now labels today's session “Today” instead of its date (e.g. instead of “W Jun 3”), so the most recent session is easy to spot." },
      { version: "b.2.1.24", title: "User view toggle", sp: 1, note: "Settings has a “Switch to user view” button that flips the dashboard between admin (default) and a user view; in user view a “👤 User view” badge shows next to the title. For now that's all it does — the switch a later step will hang user-facing limits on. Remembered on your device." },
      { version: "b.2.1.23", title: "Index Group-by picker", sp: 8, note: "Index page gained a “Group by” picker — slice every exercise by Category, Muscle group, Function (movement pattern), Combinable or Comparable group — and it respects the app-wide filter: each group shows the active lifts and tucks the rest, greyed, under a “Show hidden” sub-dropdown so nothing disappears without trace." },
      { version: "b.2.1.22", title: "Compare period tidy", sp: 0.5, note: "Compare graph period picker tidied: dropped the “Showing period:” label (the dropdown already shows the period, e.g. “Last 3 months”) and moved the dropdown to the right of its row." },
      { version: "b.2.1.21", title: "Current-strength line now fades", sp: 2, note: "Fix: the green “Current strength” line on the exercise graph (and the compare graph) was a running best that never dropped, so the decay never showed. It now applies the fade — sagging through layoffs, popping back up when you train, and running all the way to today — so the “use it or lose it” curve is visible on your real lifts, not just the Settings explainer." },
      { version: "b.2.1.20", title: "Strength-fade graph", sp: 1, note: "The Test / calculators tab now has a “Strength fade — use it or lose it” chart: % of your peak 1RM kept vs days without training, with milestone dots (2 weeks, +1 month, 3 / 6 months, 1 year) so the decay curve behind the Current-strength setting is visible." },
      { version: "b.2.1.19", title: "Strength decay (use it or lose it)", sp: 5, note: "New Settings toggle “Current strength (fade with time off)”. Off = your all-time best 1RM (unchanged). On = a detraining estimate: a lift holds for two weeks, then fades — about 10% down a month later, slowing logarithmically after that, never below half. Each set fades by its own age, so a fresh solid lift can overtake a stale old PR. Drives the leaderboard, personal records and exercise cards; pure tested model in metrics.ts (strengthRetention)." },
      { version: "b.2.1.18", title: "Add a new exercise to a session", sp: 1, note: "Each session now has a “+ exercise” button (part of the quick-add UI) that opens an inline form with a searchable exercise picker — type to filter every known exercise (or enter a new name) and log a set for it on that day or today, without leaving the Workouts screen." },
      { version: "b.2.1.17", title: "Toggle the + set buttons", sp: 0.5, note: "A new “+ set buttons” checkbox in the Workouts controls shows or hides all the inline quick-add (+ set) buttons, so the list can stay clean when you're just reading it. Off by default and remembered on this device." },
      { version: "b.2.1.16", title: "Workouts default to By day", sp: 0.1, note: "The Workouts list now opens grouped By day instead of By week — flip to By week any time with the toggle." },
      { version: "b.2.1.15", title: "Edit hand-logged sets", sp: 1, note: "In Add → “Your added sets” each row now has a ✎ Edit button: tap it to change the exercise, weight, reps or date in place, then Save (or × to cancel). Fix a typo without deleting and re-adding. (Only hand-logged sets are editable — StrengthLevel data is read-only.)" },
      { version: "b.2.1.14", title: "Add to that day or today", sp: 0.5, note: "The inline “+ set” form now has a little day / Today toggle when you're looking at a past session, so you can browse what you did then but log the new set against today (or still backdate it to that day). Defaults to the day you tapped." },
      { version: "b.2.1.13", title: "Inline add on workouts", sp: 2, note: "The “+ set” buttons in the Workouts view (both the session summary and inside an expanded week/day) now open a small inline form right there — type weight, reps and how many sets and tap Add — instead of jumping to the Add page. The view updates in place and stays expanded." },
      { version: "b.2.1.12", title: "Multiple sets, custom athlete dropdown", sp: 1, note: "Add-set has a Sets box — type a number to log several identical sets at once. The Athlete picker on Add is now the app's own HTML/CSS dropdown (no native OS chrome) so it matches every other picker." },
      { version: "b.2.1.11", title: "Add remembers, quick + set", sp: 1, note: "The Add-set form now keeps the athlete, exercise, weight, reps and date after you add a set, so logging another set is one tap. And every exercise in the Workouts exercise view has a “+ set” button that jumps to Add pre-filled with that athlete, exercise and date." },
      { version: "b.2.1.10", title: "Code/full name toggle", sp: 0.5, note: "Workouts exercise view has a Code / Full toggle to switch between short exercise codes and full names." },
      { version: "b.2.1.9", title: "Codes and note difficulty", sp: 1, note: "Workouts session lines now show short exercise codes (full name on hover) instead of long names, and a bodyweight/placeholder set (weight 0 or 1) that has a note shows the note as its difficulty with the reps as a superscript." },
      { version: "b.2.1.8", title: "Exercise vs group toggle", sp: 1, note: "Workouts “Show” is now a clear Exercises / Groups toggle; in Groups mode a small picker chooses the dimension (muscle / functional / combined / compared). Defaults to the written-out exercise view." },
      { version: "b.2.1.7", title: "Sets written out, no zero", sp: 2, note: "Bodyweight sets no longer show a meaningless “0” — just the reps as a superscript. And the Workouts session line (Show: Exercises) writes out every set as weight^reps (e.g. 40¹⁵ 40¹²) instead of only the set count." },
      { version: "b.2.1.6", title: "Heatmap category filter", sp: 2, note: "The year-heatmap filter now lets you colour by any of the new categories — body part, fine muscle group (Quads, Lats (rows)…) or functional pattern — not just the coarse ones, plus a quick toggle to flip between the chosen group and all exercises." },
      { version: "b.2.1.5", title: "Workouts grouping controls", sp: 2, note: "Workouts “View” is now a By day / By week toggle (not a dropdown), and “Show” is the app's own dropdown that can group each session by Exercises, Muscle group, Functional group, Combined lift or Compared lift." },
      { version: "b.2.1.4", title: "Back split and deadlift fix", sp: 5, note: "Split the Back muscle group into Lower back, Upper back (traps), Lats (pulls) and Lats (rows). Fixed the deadlift groups: holds & the one-arm side deadlift are accessories, good mornings / back extensions / plain RDLs are the deadlift pattern, and the inverted deadlift is a lats row. Registry now supports per-exercise include/exclude overrides." },
      { version: "b.2.1.3", title: "Re-graded effort SP", sp: 0.5, note: "Re-graded the per-part effort up to current scope (Graphs & Exercises to 80, Workouts/Calculator/Navigation/Leaderboard a step higher): the whole-site total moves from 214 to 293 SP." },
      { version: "b.2.1.2", title: "Titles, groups and SP fix", sp: 3, note: "Every release now has a 2–5 word title; big version groups are split into 20–30 SP chunks; fixed the group SP total showing a long decimal tail." },
      { version: "b.2.1.1", title: "Browse groups panel", sp: 3, note: "New “Browse groups” panel on the Index: pick a dimension (Muscle / Functional / Combined) then a group to read what it means and the lifts under it; inspector chips jump to a group's explanation." },
      { version: "b.2.1.0", title: "Trimmed version history", sp: 0.5, note: "Started the b.2.1 minor and trimmed every version-history note to one short line." },
    ],
  },
  {
    version: "b.2.0.34–b.2.0.42",
    title: "Combined lifts and filter",
    sp: 0, // auto-computed below = sum of children
    note: "Combinable/comparable lifts become their own selectable exercises, an app-wide active-exercises filter, and a richer Index inspector.",
    details: [
      "“SQ mix” and “DL pattern” go from groundwork to selectable, surfaced lifts; the Index inspector and Calculator graph get an upgrade.",
    ],
    children: [
      { version: "b.2.0.42", title: "Combine picker dropdown", sp: 1, note: "The drill-in “＋ combine with…” picker now uses the app's own dropdown, so it looks the same on every phone." },
      { version: "b.2.0.41", title: "Compare bars and combined group", sp: 1, note: "Fixed Compare-graph bars that wouldn't hide, and moved the ✦ combined lifts (SQ mix, DL pattern) to a group at the top of the leaderboard picker." },
      { version: "b.2.0.40", title: "Selectable combined lifts", sp: 3, note: "“SQ mix” and “DL pattern” (marked ✦) are now selectable in the leaderboard and Compare graph, so you can rank or chart them like any lift." },
      { version: "b.2.0.39", title: "Index inspector upgrade", sp: 5, note: "Index inspector: tap an exercise to see its tags, its combine/compare group, and its active status — plus “Always show / hide” toggles." },
      { version: "b.2.0.38", title: "Calculator bar-weight axis", sp: 1, note: "Calculator's Nuzzo graph now plots bar weight (kg) on the x-axis — “at this weight you can do N reps” — with your set as the gold dot." },
      { version: "b.2.0.37", title: "App-wide active filter", sp: 8, note: "New app-wide “active exercises” filter: pick a frequency tier and the whole app narrows to your most-trained lifts (off by default)." },
      { version: "b.2.0.36", title: "Derived combined lifts", sp: 5, note: "“SQ mix” and “DL pattern” now exist as their own derived lifts (the real lifts are untouched). Groundwork — selectable next." },
      { version: "b.2.0.35", title: "Tag-alone batch button", sp: 1, note: "Year heatmap “Tag alone” button: tap many days at once to add/remove the red “alone” ring without scrolling." },
      { version: "b.2.0.34", title: "Shared research chart", sp: 2, note: "The reps-at-%1RM research page and Calculator graph share one scroll/zoom chart, with your set as a gold dot." },
    ],
  },
  {
    version: "b.2.0.13–b.2.0.33",
    title: "RIR and heatmap tags",
    sp: 0, // auto-computed below = sum of children
    note: "Per-set difficulty moves to RIR, the year heatmap gains day numbers and alone-tags, and lift grouping moves into one registry.",
    details: [
      "The merged drill-in graph, sets/week bars, the sign-in gate and the single-source exercise registry all land in this run.",
    ],
    children: [
      { version: "b.2.0.33", title: "Exercise tag registry", sp: 5, note: "Groundwork: all the ways the app groups lifts now live in one registry (no visible change, locked by tests)." },
      { version: "b.2.0.31", title: "Removed test graph pages", sp: 1, note: "Removed the three throwaway graph test-pages from the Other menu." },
      { version: "b.2.0.30", title: "Workouts page size 50", sp: 0.1, note: "Workouts list now shows 50 entries per page (was 20)." },
      { version: "b.2.0.29", title: "Custom RIR dropdown", sp: 2, note: "The per-set RIR picker is now a custom dropdown that looks the same on every phone." },
      { version: "b.2.0.28", title: "Cycling alone filter", sp: 1, note: "Workouts “alone” filter is now one cycling button (Both → Only alone → Not alone)." },
      { version: "b.2.0.27", title: "Heatmap alone ring", sp: 0.5, note: "Year heatmap rings any “trained alone” day with a red outline; updates live." },
      { version: "b.2.0.26", title: "RPE to RIR", sp: 1, note: "Per-set difficulty switched from RPE to RIR (Reps In Reserve), with 11 descriptive bands. Old RPE values don't carry over." },
      { version: "b.2.0.25", title: "Fainter heatmap numbers", sp: 0.1, note: "Year heatmap day numbers turned down further (barely-there)." },
      { version: "b.2.0.24", title: "Centred heatmap numbers", sp: 0.1, note: "Year heatmap day numbers centred and much fainter." },
      { version: "b.2.0.23", title: "Heatmap day numbers", sp: 0.5, note: "Year heatmap squares show a tiny day number; Workouts defaults to By week + Muscle groups, heatmap to Legs." },
      { version: "b.2.0.22", title: "Remembered sign-in", sp: 0.5, note: "Sign-in is remembered: skip the landing gate on later visits (no flash)." },
      { version: "b.2.0.21", title: "Landing sign-in gate", sp: 0.5, note: "Decorative landing gate with a “Sign in as admin” button (no real auth)." },
      { version: "b.2.0.20", title: "Rescaled heatmap colours", sp: 0.5, note: "Year heatmap heat colours re-scaled — blue for 1–5 sets, gold for 6+." },
      { version: "b.2.0.19", title: "Monthly rest-day shading", sp: 0.5, note: "Year heatmap rest days now alternate by month (white vs light gray) instead of a warm tint." },
      { version: "b.2.0.18", title: "Per-set RPE picker", sp: 3, note: "Grade how hard each set felt: an RPE (1–10) picker on every set, saved on the device, shown in the tooltip." },
      { version: "b.2.0.17", title: "Translucent week bars", sp: 1, note: "Sets/week bars: translucent fill and squished further so they don't overlap the 1RM data." },
      { version: "b.2.0.16", title: "Thinner week bars", sp: 1, note: "Sets/week bars 30% thinner, outline-only, sitting low so they don't tower over the 1RM data." },
      { version: "b.2.0.15", title: "Combine lifts drill-in", sp: 5, note: "Combine lifts in a drill-in: a “＋ combine with…” picker views e.g. Squat + Smith Squat as one. Moved “Center” into the controls." },
      { version: "b.2.0.14", title: "Histogram week bars", sp: 1, note: "Sets/week bars are as wide as the week (histogram-style); muscle-group view reads “Quads — 4 sets”." },
      { version: "b.2.0.13", title: "Merged drill-in graph", sp: 5, note: "Drill-in graph merged into ONE chart — every view is a legend toggle (1RM dots, current strength, per-set, sets/week, trend)." },
    ],
  },
  {
    version: "b.2.0.0–b.2.0.12",
    title: "Strength line and site map",
    sp: 0, // auto-computed below = sum of children
    note: "The start of version 2: a current-strength line on every 1RM graph, legend toggles, the Index info panel, and a Site map tab.",
    details: [
      "Rolled b.1.x up to b.2, then added current-strength, legend show/hide, the SP-over-time line and per-exercise Index info.",
    ],
    children: [
      { version: "b.2.0.12", title: "Scatter 1RM trend", sp: 1, note: "1RM-trend graph: each week's est-1RM is a scatter of dots, not a line. The current-strength line stays." },
      { version: "b.2.0.11", title: "Index exercise info", sp: 2, note: "Index: tap an exercise to expand its info — category, muscle, tier, total sets, who trains it, best 1RM and dates." },
      { version: "b.2.0.10", title: "Visible active period", sp: 1, note: "Exercises list: the active period is always shown above the list and tappable to change." },
      { version: "b.2.0.9", title: "Renamed to Index", sp: 1, note: "Renamed the all-exercises / body-parts page to “Index”; added a one-line explainer." },
      { version: "b.2.0.8", title: "Sticky athlete chips", sp: 1, note: "The athlete chip row sticks to the top while scrolling, and the selected athlete scrolls into view." },
      { version: "b.2.0.7", title: "Legend toggle series", sp: 3, note: "Graphs with 2+ lines: tap a legend key to show/hide that series. Keeps your pan/zoom." },
      { version: "b.2.0.6", title: "Current strength line", sp: 5, note: "“Current strength” line on every 1RM graph — the best est-1RM reached so far (never drops)." },
      { version: "b.2.0.5", title: "Exercise info jump", sp: 2, note: "Exercise drill-in: an “ℹ Exercise info” button jumps to that lift's row on the Exercises page." },
      { version: "b.2.0.4", title: "Site map tab", sp: 3, note: "New “Site map” tab: a colour-coded mind map of every tab and what's inside it." },
      { version: "b.2.0.3", title: "SP-over-time line", sp: 3, note: "Version history shows a “story points over time” line on a real time axis." },
      { version: "b.2.0.2", title: "Compare sets list", sp: 2, note: "Compare graph lists the actual sets behind it (date · exercise · weight×reps · est 1RM)." },
      { version: "b.2.0.1", title: "Muscle-group session view", sp: 2, note: "Workouts: a “Show” toggle to list each session by muscle group with set counts." },
      { version: "b.2.0.0", title: "Version 2 milestone", sp: 1, note: "Version 2 milestone — rolled the b.1.x line up to b.2 to mark the self-updating, real-time-chart app." },
    ],
  },
  {
    version: "b.1.14",
    title: "Real time axis and pickers",
    sp: 0, // auto-computed below = sum of children
    note: "Per-set graph on a real time axis with calendar bands, dashed rep lines, a best-set-only toggle, a By-category picker, and every exercise on its own.",
    details: [
      "Per-set drill-in chart now uses genuine calendar time with alternating year/month/week bands; same-day sets fan out within the day; each set's line is dashed, one dash per rep; optional best-set-only view.",
      "By-category list: chips to choose which categories you see; rep-max reps moved into the column header; scaling/pattern groups removed so each lift is separate.",
    ],
    children: [
      { version: "b.1.14.7", title: "Live refresh status", sp: 2, note: "Refresh shows live status (reads the GitHub Action via its API): ⏳ running — keep waiting (auto-updates), ✓ succeeded, or ✗ failed — so you know whether to wait." },
      { version: "b.1.14.6", title: "One-click data refresh", sp: 5, note: "“Refresh data” button (Data tab): one click runs a GitHub Action that scrapes the newest StrengthLevel workouts, commits ud.csv and auto-redeploys — no local setup, no CORS." },
      { version: "b.1.14.5", title: "Tidied chrome", sp: 1, note: "Tidy chrome: only the whole-site SP under the title (per-part chips live in Version history), night mode moved into Settings, and group SP totals are now auto-summed from their releases." },
      { version: "b.1.14.4", title: "Ungrouped exercises", sp: 5, note: "Removed scaling/“pattern” groups — Bench Press, Shoulder Press, Row, etc. are each their own exercise (no more ‘(also: …)’ merging); Group view is category-only. Queued a ‘fetch live data’ task." },
      { version: "b.1.14.3", title: "Fixed time axis", sp: 3, note: "Time axis fixed: alternating year/month/week background bands; labels adapt to zoom (never blank, never duplicate ‘Jan 1’)." },
      { version: "b.1.14.2", title: "Best-set-only toggle", sp: 1, note: "Per-set graph: ‘Best set only’ toggle — show just each day's top set (highest estimated 1RM) instead of every set." },
      { version: "b.1.14.1", title: "Dashed rep lines", sp: 2, note: "Per-set lines are dashed — one dash per rep — so reps read at a glance (50→59 over 5 reps = 5 dashes)." },
      { version: "b.1.14.0", title: "Real time axis", sp: 5, note: "Per-set graph on a REAL time axis (each day once, sets fanned within the day); By-category show/hide chips; rep-max reps chosen in the column header." },
    ],
  },
  {
    version: "b.1.13.7–b.1.13.16",
    title: "Drill-in charts and zoom",
    sp: 0, // auto-computed below = sum of children
    note: "Dark mode, the leaderboard on the SVG engine (Chart.js removed), per-axis zoom, and drill-in/list polish.",
    details: [
      "The second half of the b.1.13 run: dark mode, Chart.js fully dropped, per-axis pinch zoom, and the new Fibonacci SP scale.",
    ],
    children: [
      { version: "b.1.13.16", title: "Fibonacci SP scale", sp: 3, note: "New Fibonacci SP scale (…8,13,…80,130,200); version history split into b.1.13 / b.1.12 / b.1.10–b.1.11; By-tier collapsed by default." },
      { version: "b.1.13.15", title: "Vertical 1RM zoom", sp: 2, note: "Drill-in 1RM trend zooms vertically too (both y-axes together); per-set range already free-pans." },
      { version: "b.1.13.14", title: "All daily sets", sp: 3, note: "Per-set graph shows EVERY set of each day (high-rep sets as a marker); ‘Legs (all)’ category hidden from lists with a Settings toggle." },
      { version: "b.1.13.13", title: "Per-set bars", sp: 2, note: "Drill-in per-set graph: one bar per set (own weight → own 1RM), not a merged day range." },
      { version: "b.1.13.12", title: "Per-axis pinch zoom", sp: 2, note: "Per-axis pinch (X-only / Y-only stretch) on every chart; Shift/Alt+wheel on desktop." },
      { version: "b.1.13.11", title: "By-category defaults", sp: 2, note: "List & stats defaults to By-category (collapsed); rep-max moved to a visible bar." },
      { version: "b.1.13.10", title: "History in dropdowns", sp: 1, note: "Merge version history into range dropdowns." },
      { version: "b.1.13.9", title: "Per-axis pinch test", sp: 2, note: "Per-axis pinch test (X-only / Y-only) in Graph (advanced)." },
      { version: "b.1.13.8", title: "Leaderboard on SVG", sp: 5, note: "Leaderboard → SVG; Chart.js removed entirely (~84 KB lighter)." },
      { version: "b.1.13.7", title: "Dark mode", sp: 5, note: "Dark mode — header toggle, charts themed too." },
    ],
  },
  {
    version: "b.1.13.0–b.1.13.6",
    title: "New SVG chart engine",
    sp: 0, // auto-computed below = sum of children
    note: "The from-scratch SVG chart engine and the first charts migrated onto it: Compare, drill-in, and touch pan/zoom.",
    details: [
      "The first half of the b.1.13 run: built the in-house SVG engine and moved the Compare, drill-in and Workouts charts onto it.",
    ],
    children: [
      { version: "b.1.13.6", title: "Weight-reps curve test", sp: 2, note: "Test weight↔reps curve on the SVG engine." },
      { version: "b.1.13.5", title: "Drill-in charts migrated", sp: 5, note: "Drill-in 1RM-trend + per-set charts migrated to the engine." },
      { version: "b.1.13.4", title: "Compare picker redesign", sp: 3, note: "Compare picker redesign: selected-only chips + search-to-add." },
      { version: "b.1.13.3", title: "Touch pan and zoom", sp: 5, note: "Touch pan + pinch-zoom fixed; Workouts chart migrated." },
      { version: "b.1.13.2", title: "Compare lab page", sp: 2, note: "Compare (lab) page with thinned month labels." },
      { version: "b.1.13.1", title: "Merged b.1.12 history", sp: 1, note: "Merged the b.1.12 run into one dropdown." },
      { version: "b.1.13.0", title: "SVG engine from scratch", sp: 10, note: "New from-scratch SVG chart engine; Compare graph migrated." },
    ],
  },
  {
    version: "b.1.12",
    title: "Graph saga and tags",
    sp: 23,
    note: "The b.1.12 run: the graph fix/rewrite saga (→ the from-scratch SVG demo), workout ‘alone’ tags, and the effort-SP dropdown.",
    details: [
      "Long run of gridline/scroll fixes culminating in the SVG demo + advanced charts.",
      "Workout ‘alone’ tags + weekday letter; effort-SP dropdown (exact + Fibonacci).",
    ],
    children: [
      { version: "b.1.12.9", title: "Advanced graph", sp: 2, note: "‘Advanced’ graph (wider, values inside)." },
      { version: "b.1.12.8", title: "Free pan and zoom", sp: 1, note: "Demo graph: free 2-D pan + both-axis zoom." },
      { version: "b.1.12.7", title: "Scrolling demo graph", sp: 2, note: "Demo scrolls; 1RM-trend anchors at zero." },
      { version: "b.1.12.6", title: "SVG graph demo", sp: 3, note: "Pin axis padding; add the SVG graph demo." },
      { version: "b.1.12.5", title: "Reverted gridlines", sp: 2, note: "Revert gridlines to the native mechanism." },
      { version: "b.1.12.4", title: "Gridline plugin fix", sp: 2, note: "Make the gridline plugin reliably draw." },
      { version: "b.1.12.3", title: "Weekday letters", sp: 1, note: "Workouts weekday letter (M T W Th F Sa Su)." },
      { version: "b.1.12.2", title: "Canvas gridline plugin", sp: 3, note: "Canvas gridline plugin (later reverted) + chartAxis tests." },
      { version: "b.1.12.1", title: "Multi-bucket compare", sp: 2, note: "Compare categories multi-bucket; workout ‘alone’ tag." },
      { version: "b.1.12.0", title: "Alone tags and effort SP", sp: 5, note: "Workout alone tags + effort-SP dropdown." },
    ],
  },
  {
    version: "b.1.10–b.1.11",
    title: "Group view and effort SP",
    sp: 20,
    note: "The b.1.10–b.1.11 run: Group/Stats views, effort-SP chips, multi-category buckets, and List/Workouts polish.",
    details: [
      "New Group view (+ old view renamed ‘Stats’); effort-SP chips; combined Group comparison.",
      "List ‘Best set’ column, single rep-max, no pagination; year-heatmap month dividers.",
    ],
    children: [
      { version: "b.1.11.0", title: "Searchable compare chips", sp: 5, note: "Searchable compare chips, no list pagination, combined Group view." },
      { version: "b.1.10.4", title: "Heatmap month dividers", sp: 2, note: "Year heatmap month dividers; list defaults 3 months / 50." },
      { version: "b.1.10.3", title: "Fixed graph drift", sp: 1, note: "Fix progress graph vertical drift." },
      { version: "b.1.10.2", title: "Best set column", sp: 2, note: "List & stats ‘Best set’ column." },
      { version: "b.1.10.1", title: "Effort SP chips", sp: 5, note: "Effort-SP chips; list calculator removed." },
      { version: "b.1.10.0", title: "New Group view", sp: 5, note: "New Group view; old view → ‘Stats’; single editable rep-max." },
    ],
  },
  {
    version: "b.1.6–b.1.9",
    title: "Bottom nav and Add tab",
    sp: 31,
    note: "The b.1.6–b.1.9 run: bottom-nav redesign, the ‘Add’ tab, the Other umbrella + Group view, and multi-category buckets.",
    details: [
      "Athlete bottom nav + ‘Other’ umbrella; the ‘Add’ tab for hand-logged sets with Export/Import.",
      "Multi-category ‘By category’ buckets; drill-in best-sets; exercise codes; year-heatmap polish.",
    ],
    children: [
      { version: "b.1.9.2", title: "Soon tag", sp: 1, note: "Version-history ‘soon’ tag for planned work." },
      { version: "b.1.9.1", title: "Drill-in best sets", sp: 2, note: "Drill-in: 5 best sets from the last 3 months." },
      { version: "b.1.9.0", title: "Multi-category buckets", sp: 5, note: "Multi-category ‘By category’ buckets." },
      { version: "b.1.8.0", title: "Other menu and Group", sp: 5, note: "Other bottom-nav umbrella + new Group view." },
      { version: "b.1.7.2", title: "Export and import", sp: 4, note: "Export/Import backup + custom exercise codes." },
      { version: "b.1.7.1", title: "Exercise codes", sp: 2, note: "Exercises list: 3-letter codes + editable rep-max." },
      { version: "b.1.7.0", title: "Add tab", sp: 3, note: "New ‘Add’ tab to log sets by hand." },
      { version: "b.1.6.4", title: "Heatmap outlines today", sp: 1, note: "Workouts year heatmap outlines today." },
      { version: "b.1.6.3", title: "Exercises redesign", sp: 3, note: "Exercises redesign: tabs, kebab filters, floating search." },
      { version: "b.1.6.2", title: "Removed Records tab", sp: 1, note: "Removed the Records tab." },
      { version: "b.1.6.1", title: "Per-section version chips", sp: 1, note: "Per-section version chips under the title." },
      { version: "b.1.6.0", title: "Bottom nav", sp: 3, note: "Athlete bottom nav + grouped version history." },
    ],
  },
  {
    version: "b.1.0–b.1.5",
    title: "Graphs, compare and hosting",
    sp: 23,
    note: "The b.1.0–b.1.5 run: version history, compare graph, per-set views, live hosting.",
    details: [
      "Version history page + the b.x versioning scheme.",
      "Compare-on-one-graph with category/tier picks and per-set + 1RM-trend views.",
      "Per-set range graphs (every set, range per set), calendar gridlines, smooth pan/zoom.",
      "Workouts 'Sets over time' graph and GitHub Pages auto-deploy.",
    ],
    children: [
      { version: "b.1.5", title: "Sets-over-time and hosting", sp: 7, note: "Workouts sets-over-time graph, smoother charts, and live hosting." },
      { version: "b.1.4", title: "Time-axis gridlines", sp: 3, note: "Time-axis gridlines on clean week/month boundaries." },
      { version: "b.1.3", title: "Per-set range compare", sp: 5, note: "Per-set range in the compare graph; expandable version history." },
      { version: "b.1.2", title: "Category and tier picks", sp: 3, note: "Category & tier quick-picks for the compare graph." },
      { version: "b.1.1", title: "Per-set range graph", sp: 3, note: "Per-set range graph shows every set, one bar per set." },
      { version: "b.1.0", title: "Version history page", sp: 2, note: "Version history page + version-scheme reset." },
    ],
  },
  {
    version: "0.30s",
    title: "Charts and correctness era",
    sp: 34,
    note: "The 0.30–0.39 era: muscle map, tiers, momentum, and big correctness audits.",
    details: [
      "Athlete muscle map, momentum chips, exercise frequency tiers.",
      "Compare-on-one-graph, weight-vs-reps diagram, tap-a-1RM formula reveal.",
      "Major correctness work: bodyweight-aware 1RM everywhere, the rep-cap rule, Smith/deadlift separation.",
    ],
    children: [
      { version: "0.36.1", title: "Momentum chips", sp: 3, note: "Athlete 'Momentum' trend chips." },
      { version: "0.36.0", title: "Design and logic audit", sp: 3, note: "Design/logic audit fixes." },
      { version: "0.35.5", title: "1RM consistency audit", sp: 4, note: "1RM-consistency audit + regression tests." },
      { version: "0.35.4", title: "By-tier sort", sp: 3, note: "'By tier' sort on the Exercises view." },
      { version: "0.35.3", title: "Strength muscle map", sp: 2, note: "Muscle map shaded by strength, not sets." },
      { version: "0.35.2", title: "Deadlift pattern fix", sp: 1, note: "Deadlift pattern = Deadlift + RDL only." },
      { version: "0.35.1", title: "High-rep 1RM cap", sp: 2, note: "Sets above 15 reps show '—' for 1RM." },
      { version: "0.35.0", title: "Collapsible muscle map", sp: 3, note: "Collapsible front/back muscle map." },
      { version: "0.34.0", title: "Overlay 1RM trends", sp: 3, note: "Overlay several exercises' 1RM trends." },
      { version: "0.33.0", title: "Weight-vs-reps curve", sp: 2, note: "Test-tab weight-vs-reps curve." },
      { version: "0.32.0", title: "Bodyweight in 1RM", sp: 3, note: "Workouts 1RM now includes bodyweight." },
      { version: "0.31.0", title: "Smith squat separated", sp: 3, note: "Smith Machine Squat separated; origin badges." },
      { version: "0.30.0", title: "Tap a 1RM", sp: 2, note: "Tap a 1RM to see its formula." },
    ],
  },
  {
    version: "0.20s",
    title: "Data tab era",
    sp: 18,
    note: "The 0.20–0.29 era: the Data tab, records heatmap, editable calculator.",
    details: ["New Data tab (raw + processed CSV), records codes & year heatmap, multi-row calculator, workout→exercise links."],
    children: [
      { version: "0.29.0", title: "All computed variables", sp: 3, note: "Data tab exposes every computed variable." },
      { version: "0.26.0", title: "Multi-row calculator", sp: 3, note: "Per-exercise calculator is a multi-row table." },
      { version: "0.25.0", title: "New Data tab", sp: 5, note: "New Data tab (original + processed CSV)." },
      { version: "0.24.0", title: "Tap workout exercise", sp: 2, note: "Tap an exercise in a workout to open it." },
      { version: "0.23.0", title: "Records and heatmap", sp: 5, note: "Records codes, year heatmap, custom dropdowns." },
    ],
  },
  {
    version: "0.10s",
    title: "Charts and categories era",
    sp: 11,
    note: "The 0.10–0.19 era: progress charts, exercise categories, athlete chips.",
    details: ["Per-exercise progress charts + rep targets, category dropdowns, and quick athlete switching."],
    children: [
      { version: "0.17.0", title: "Athlete chips", sp: 3, note: "Athlete chips and weekly-progress popups." },
      { version: "0.14.0", title: "Progress charts", sp: 5, note: "Per-exercise progress charts + rep targets." },
      { version: "0.13.0", title: "Category dropdowns", sp: 3, note: "Exercise category dropdowns." },
    ],
  },
  {
    version: "0.0s",
    title: "Foundations",
    sp: 28,
    note: "The earliest builds: first dashboard through athlete pages.",
    details: ["From the first CSV dashboard to leaderboards, workouts/records, exercise drill-ins and per-athlete pages."],
    children: [
      { version: "0.8.0", title: "Per-athlete pages", sp: 5, note: "Per-athlete pages." },
      { version: "0.5.0", title: "Exercise drill-in", sp: 5, note: "Drill into a single exercise's history." },
      { version: "0.3.0", title: "Workouts and records", sp: 5, note: "Workouts list, records, bodyweight-parts." },
      { version: "0.1.0", title: "Leaderboard and Colosseum", sp: 5, note: "Leaderboard, settings filters, light theme — renamed to Colosseum." },
      { version: "0.0.1", title: "First dashboard", sp: 8, note: "First dashboard: load the CSV and render leaderboards/PRs/1RMs." },
    ],
  },
];

// A grouped minor's `sp` is the SUM of its children — computed here, never
// hand-maintained, so the totals can't drift from the per-release numbers. The
// literal `sp` on a group with children is just a placeholder; this overwrites
// it. Rounded to one decimal so fractional SP (0.1, 0.5) can't show a binary
// floating-point tail like 83.30000000000001.
for (const r of CHANGELOG) {
  if (r.children?.length) {
    r.sp = Math.round(r.children.reduce((s, c) => s + c.sp, 0) * 10) / 10;
  }
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
  { name: "Exercises", sp: 80 }, // drill-ins, categories, tiers, merges, rep-max header, best-sets, compare+sets, Index info + inspector + browse groups, active-exercises filter, combinable/comparable lifts
  { name: "Graphs", sp: 80 }, // SVG engine; real time axis + calendar bands, dashed reps, current strength, scatter, legend toggles, merged drill-in graph, sets/week bars, log trend
  { name: "Workouts", sp: 30 }, // day/week list, muscle-group view, rest days, year heatmap + day numbers + alone-tags, sets-over-time, RIR difficulty
  { name: "Athlete", sp: 22 }, // per-athlete pages, sticky chips, muscle map, momentum, training mix
  { name: "Data", sp: 20 }, // raw+processed CSV tab, every computed variable, search, live refresh from StrengthLevel + status
  { name: "Leaderboard", sp: 13 }, // boards, rank/sex/BW/axis filters, combined lifts in the picker
  { name: "Calculator", sp: 13 }, // multi-row reps↔weight calc + the Nuzzo research scatter/best-fit chart (shared with the explainer page), bar-weight axis
  { name: "Navigation", sp: 13 }, // bottom nav + Other sheet, Site map, version history (titles, 20–30 groups) + SP-over-time
  { name: "Group", sp: 9 }, // train people together: combined comparison table, remembered picks
  { name: "Add", sp: 7 }, // hand-log sets, merge, export/import
  { name: "Stats", sp: 6 }, // per-category cards (was Groups)
];

/** Whole-site EXACT story points (sum of every part) and its Fibonacci grade. */
export const WEBSITE_EXACT_SP = COMPONENTS.reduce((s, c) => s + c.sp, 0);
export const WEBSITE_SP = fibSp(WEBSITE_EXACT_SP);
