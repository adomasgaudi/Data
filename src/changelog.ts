/**
 * Release log shown in Settings → Version history. The app is a static build
 * with no git at runtime, so the log is kept here as data and updated alongside
 * each release (the on-screen <span class="version"> must match the newest leaf).
 *
 * The log is a TREE, nested three levels deep:
 *   Chapter (≈80–130 SP)  →  Group (≈20–30 SP)  →  Release (a single version).
 * `sp` is summed up the tree automatically; only leaf releases carry a real
 * number. Every node (chapter, group and release) has a 2–5 word title, and the
 * UI renders every node collapsed by default so the page stays short.
 */
export interface Release {
  version: string;
  /** 2–5 word title. */
  title: string;
  /** Story points. For a node with children this is the (auto-summed) total. */
  sp: number;
  /** One-line plain-language summary, shown only when the row is expanded. */
  note: string;
  /** Optional extra bullet points, shown when expanded. */
  details?: string[];
  /** Nested child nodes (groups, or the leaf releases). */
  children?: Release[];
  /** Planned/not-yet-built: shown at the top with a "soon" tag, excluded from
   * the shipped release count, the SP total and the on-screen version. */
  soon?: boolean;
}

export const CHANGELOG: Release[] = [
  {
    version: "next",
    title: "Coming soon",
    sp: 0,
    soon: true,
    note: "Planned features, not built yet — expand to see what's coming.",
    children: [
      {
        version: "",
        title: "GitHub auto-save",
        sp: 0,
        soon: true,
        note: "Added sets save to GitHub automatically — no Export/Import needed.",
        details: [
          "Hand-logged sets will sync to the repo so they're there on any phone or browser.",
          "Pending a safe way to authorise writes (the site is public): paste-a-token in the browser, or a small private helper.",
        ],
      },
      {
        version: "",
        title: "AI summaries",
        sp: 0,
        soon: true,
        note: "AI-written plain-language summaries across the app — your training read back to you at a glance.",
        details: [
          "Auto recaps of what you trained, what's progressing, what's stalling, and a suggested next step.",
          "Likely on a per-athlete overview, an exercise drill-in, and a workout recap — generated from your logged data.",
        ],
      },
    ],
  },
  {
    version: "b.2.1",
    title: "Fades, roles and per-set editing",
    sp: 0,
    note: "The big b.2.1 run: strength-fade modelling, predicted RIR, a roles/login system, technique scaling, exercise codes, and dozens of category fixes.",
    children: [
      {
        version: "b.2.1.56–b.2.2.0",
        title: "Edits, timeline, nested history",
        sp: 0,
        note: "Per-set editing, the timeline heatmap, multi-category codes, section cards, and the nested/collapsed version history.",
        children: [
          { version: "b.2.2.30", title: "Unified selector: search + group by", sp: 22, note: "The Workout-analysis exercise selector is now the full unified picker: a live Search box, the identity Include toggles, the metadata Filters (body part, muscle, joint, movement, plane, function, equipment, difficulty, tier) and a new Group by control that re-buckets the chips under headers (by any of those dimensions) without changing any data. It's scrollable and search-narrowed, so it scales to hundreds of lifts. Every display mode and the graph read one shared data source, and empty/insufficient-data states (no selection, no matches, too little history for prediction/decay, empty compare) now show a clear message instead of breaking. Parity with the old Workouts/List/Single/Compare views is verified in docs/unified-view-parity.md." },
          { version: "b.2.2.29", title: "Volume, reps, PRs, trend + rules", sp: 22, note: "The rest of the graph metrics are live: Volume and Volume load (summed per day, safe on bodyweight/missing-weight sets), Reps (per day), Sets (per day) and Frequency (training days per week) — all on a right-hand axis so they don't squash the kg scale; PR markers (a dot on each new estimated-1RM record); a logarithmic Trend line; and a Moving Average (window = the Smoothing setting). Plus compatibility rules: the graph now explains unavailable combinations (e.g. “Predicted needs ≥3 points”, “Decay only affects Strength/1RM”) instead of drawing nothing — and never crashes on thin data." },
          { version: "b.2.2.28", title: "Graphs migrated into universal", sp: 24, note: "The Universal Analytics Graph metrics now carry the real calculations: Weight (with tooltips), Weight Range (a low→high bar per set, weight up to its estimated 1RM), Estimated 1RM (using your chosen formula), Strength Score (best-so-far, never drops), Strength Score With Decay (the use-it-or-lose-it fade) and Predicted Strength (a logarithmic projection — and it shows “not enough data” instead of breaking when there are fewer than 3 points). Toggle any of them, alone or together, for one or many exercises. The old graphs are untouched and still work." },
          { version: "b.2.2.27", title: "Universal analytics graph", sp: 24, note: "Foundation for one graph to eventually replace them all. The Workout-analysis “Graph” section is now a reusable Universal Analytics Graph: a central registry of 14 metrics (Weight, Est. 1RM, Strength, Strength-with-decay, Volume, Volume load, Reps … and registered-for-later Trend, Prediction, PRs, Frequency, Sets, Weight range), metric on/off chips (combine several at once), and a config row — aggregation, interval, smoothing (moving average), prediction and decay toggles. It plots a line per exercise × metric, handles single / multiple / combined / comparison selections, and draws sample data when nothing's picked. Still foundation — not every legacy graph's logic is migrated; the gaps are catalogued in docs/graph-migration-audit.md." },
          { version: "b.2.2.26", title: "M/W toggle, not 3 buttons", sp: 0.5, note: "The athlete sex filter is now a 2-state M / W toggle instead of three All/M/W buttons: tap M or W to narrow, tap the lit one again to go back to all (off = everyone). It's opaque and pinned at the start of the name row, so the scrolling name chips clip beside it and never slide behind it." },
          { version: "b.2.2.25", title: "Exercise taxonomy + filters", sp: 23, note: "Big groundwork batch. New exercise metadata taxonomies — Joints (16), Movements (27, with joint-specific display aliases like ankle Flexion → Dorsiflexion), and Planes (movements carry planes; exercises inherit them) — plus Equipment / Load type / Difficulty / Unilateral-Bilateral. A reusable filter engine combines any of 11 dimensions (Body part, Muscle, Joint, Movement, Plane, Function, Equipment, Difficulty, Load, Laterality, Tier) — OR within a dimension, AND across — and is identity-agnostic, so it filters original/dissolved/combined/comparison alike. In Workout analysis the selector gains a 🔎 Filters panel (multi-select per dimension) and, for one selected lift, a 🏷 Taxonomy editor to assign joints/movements/planes (saved on this device, and the filters use them). All additive — existing exercises with no metadata still work." },
          { version: "b.2.2.24", title: "Sex filter joins the name row", sp: 1, note: "The All / Men / Women athlete filter no longer takes its own line — it's a compact All · M · W toggle pinned at the start of the same row as the scrolling name chips, which scroll beside it. The whole row stays sticky while you scroll. Saves a line of height at the top." },
          { version: "b.2.2.23", title: "Create variants and groups", sp: 8, note: "A “➕ Create variant / group” form in the Workout-analysis selector lets you make your own exercises, saved on this device: a Dissolved variant (a more specific version of one parent, e.g. Pull Ups → Assisted Pull Up), a Combined group (members folded into one, e.g. Squat + Smith + Front Squat) or a Comparison group (several lifts to compare). Each is its own selectable exercise tagged with the right identity + relationship (parent or member lifts), appears under its matching Include toggle, and behaves like a normal exercise — while the parent/member lifts and the original stay completely unchanged. Duplicate names are rejected; aggregation comes later." },
          { version: "b.2.2.22", title: "Selector inclusion toggles", sp: 4, note: "The Workout-analysis exercise selector gains four independent “Include …” checkboxes — Original, Dissolved, Combined, Comparison groups — that filter which exercise types the chips offer. Defaults to Original only; tick Combined or Comparison groups to also pick the synthetic merged/compared lifts you have. De-duplicated (an original never doubles up with a variant) and your current selection is untouched when you flip them." },
          { version: "b.2.2.21", title: "Originals stay selectable", sp: 2, note: "Guarantee (groundwork for the upcoming variant/merge work): making a combined, comparison or dissolved variant of a lift never replaces or hides the original — the original and its variants are always selectable together (Pull Ups stays, and Assisted Pull Up / Gravity Machine Pull Up sit alongside it). Codified as a pure, tested selectableExercises() contract and locked with tests so a future feature can't quietly drop an original." },
          { version: "b.2.2.20", title: "Scale cm levels too", sp: 2, note: "Technique scaling now works for heights logged in centimetres, not just squat-rack holes. A note like “43cm” (a height that made the lift easier) is read into a per-set level, shown as a “43cm” tag on the set, and listed in the exercise's ⚙ Technique scaling panel (renamed from “Squat-rack holes”) with its own Scale box — so you can finally line up cm sets with the rest. The real weight and 1RM are never touched; only the separate scaled-effort number. cm defaults to ×1 (the direction is yours to set); ≈100 historical cm sets across push-ups, handstands and more are picked up automatically." },
          { version: "b.2.2.19", title: "Exercise relationship fields", sp: 3, note: "More groundwork (no visible change): set records gain relationship links — parentExerciseId (the original a dissolved lift folds into), includedExerciseIds (the member lifts of a combined or comparison group) and relationshipType (none / dissolved_into / combined_from / comparison_of). Combined and comparison synthetics now record their members automatically; plain lifts have none. Optional fields, so existing data is untouched. Pure tested helpers (exerciseRelationship, includedExercises)." },
          { version: "b.2.2.18", title: "Exercise identity model", sp: 3, note: "Groundwork (no visible change): every set record can now carry an “identity” — original (the default for all real lifts), combined or comparison_group (the synthetic merged/compared lifts, tagged automatically), and a reserved dissolved for upcoming merge/split work. A safe, optional field: existing data needs no migration and reads as original, and nothing uses it for logic yet — it's there for future tasks. Pure tested helper (exerciseIdentity)." },
          { version: "b.2.2.17", title: "Nuzzo full rep range", sp: 1, note: "The Nuzzo 1RM formula now works across its whole study range instead of being cut off at 15 reps. It's data-derived (Nuzzo et al.) down to 15% of 1RM (≈127 reps), so unlike Epley/Brzycki — which extrapolate to nonsense on high-rep sets and are still capped at 15 reps — Nuzzo now estimates a 1RM for any rep count, clamped to the study's 15% floor. So high-rep sets finally get a 1RM when you pick the Nuzzo formula." },
          { version: "b.2.2.16", title: "Analysis layout toggle", sp: 3, note: "WorkoutAnalysis gains a Layout toggle — Overview / Table / Charts / Stats — that instantly re-lays-out whatever's showing (workouts, single, compare or the list): Charts hides the tables, Table hides the graphs, Stats shows just the stat blocks, Overview shows everything. It's presentation only — a CSS switch on the content, so your exercise selection and all filters stay exactly as they were, with no reload." },
          { version: "b.2.2.15", title: "Exercise list in analysis view", sp: 4, note: "The Workout-analysis “all” mode (nothing selected) now has a Workouts / Exercise list toggle — “Exercise list” hosts the full List & stats view: the category-grouped table with 1RM and best-set, sort (by sets/tier/category), search, show not-trained / cardio toggles, the editable rep-max column, category show/hide and the period filter. Tapping a lift drills into it (single mode) and updates the selection. So all four legacy views now live inside the unified view; the old pages remain untouched." },
          { version: "b.2.2.14", title: "Compare in analysis view", sp: 5, note: "Pick two or more exercises in the Workout-analysis view and it now drops into the full Compare view for them — the overlay chart with its Current-strength / Per-set-range toggle, the comparison chips and quick-add, and the compared-sets table — by seeding the live Compare view from your selection. So the analysis view is complete: none = workouts, one = single drill-in, two-plus = compare. The old Compare page is untouched; panels return home when you leave." },
          { version: "b.2.2.13", title: "Single exercise in analysis view", sp: 4, note: "Pick exactly one exercise in the Workout-analysis view and it now shows the full single-exercise drill-in for that lift — its set history, the progression chart, personal records, the stats block and the per-exercise settings (period, combine, hole scaling) — by hosting the live drill-in there. Pick none for the workout history, two-plus for compare (next step). The old single-exercise page is untouched; panels return home when you leave." },
          { version: "b.2.2.12", title: "Hole scaling into settings", sp: 1, note: "The squat-rack “holes” scaling table no longer sits inline in an exercise's List & stats — it's tucked into a collapsed “⚙ Squat-rack hole scaling” disclosure, so the stats view stays clean and the per-hole Scale tuning is opened only when you want to adjust it. Same table and live editing, just folded away by default." },
          { version: "b.2.2.11", title: "Tidier exercise-graph controls", sp: 2, note: "The drill-in exercise graph is decluttered. The three rarely-used views (Per-set range, Sets/week, logarithmic Trend) are gone, so the legend is just Est. 1RM and Current strength (plus Scaled effort when a lift has squat-rack holes) — no more scrolling a cramped row. The view settings (Best set only, Center, Realistic/Compacted time) move off the legend into a single ⚙ Settings dropdown above the graph." },
          { version: "b.2.2.10", title: "Workouts inside analysis view", sp: 4, note: "The Workout-analysis view (Other → Workout analysis) now shows the full Workouts page in its Table/list area — the session history, day/week and alone/rest filtering, the sets-over-time chart and calendar, per-page and every toggle — by hosting the live Workouts panel there while the view is open and returning it to the athlete Workouts tab when you leave. Reuses all the existing logic with no duplication; the old Workouts page is untouched." },
          { version: "b.2.2.9", title: "Hard / mid / warm-up sets", sp: 2, note: "Every set now shows an effort tag read from its RIR (your logged grade, else the predicted RIR): HARD (under 3 reps in reserve), MID (working but not to failure), or WARM (well short). Big compound leg lifts (squats, deadlifts, leg press) keep a wider “mid” band — up to 8 RIR before it's a warm-up — vs up to 6 for other muscles, since they fatigue more. Pure tested classifier (effortClass)." },
          { version: "b.2.2.8", title: "Analysis selection + mode", sp: 3, note: "The Workout-analysis view now has working exercise selection: tap chips of the athlete's lifts to pick them, and the view's MODE follows automatically — none = all, one = single, two-plus = compare — shown in a live readout (with a Clear button). It's the shared state the graph/stats/table will read later; nothing else is wired in yet and existing pages are untouched." },
          { version: "b.2.2.7", title: "Muscle map by strength feats", sp: 2, note: "The Muscle map now reads each region off a specific STRENGTH FEAT and shows your best estimated 1RM for it, instead of a vague percentile: squat → quads & glutes, deadlift → hamstrings/lower back, pull-ups → back (and biceps), push-ups → chest, shoulder press → shoulders, dips → triceps, decline sit-ups → core. Darker = stronger (relative to your best feat); hover any region for the kg. Grey means you haven't logged that lift yet." },
          { version: "b.2.2.6", title: "Editable stats + body-fat band", sp: 5, note: "A new “Edit athlete stats” page (Other menu, or the ✎ Edit button on the Stats card): change anyone's weight, height, age and sex, and your edits flow everywhere (1RM, bodyweight ratios, leaderboard). Body fat is now a RANGE, not one number — you set a 95% band, a 50% band and an average — so every value built from it carries an equal error margin: the nFFMI badge shows its ±, and the stats line shows the 95% body-fat spread. Saved on this device; StrengthLevel data is never touched. Pure, tested maths (nffmiRange) flips the body-fat band into an ascending nFFMI band (more fat ⇒ lower nFFMI)." },
          { version: "b.2.2.5", title: "Workout-analysis shell", sp: 3, note: "Groundwork for a unified Workout-analysis view: a new page (Other → “Workout analysis”) with labelled placeholder sections — Filters, Exercise selector, Graph, Stats, Table/list. It's an empty shell for now; nothing is wired in yet and every existing view is untouched." },
          { version: "b.2.2.4", title: "Tap a set to edit it", sp: 2, note: "Editing a set is simpler: the ✎ pencil is gone — just tap anywhere on a set's row to open its edit panel (Weight, Reps, Bodyweight, Scale). The 1RM, pRIR, note and RIR controls inside the row still work as their own taps. Edited sets now carry a small gold stripe on the left so your overrides are easy to spot. And the blue colour is now reserved for things you can actually tap through to (links): the squat-rack-hole tag (SQ8…) that used to look blue is now plain grey, so blue reliably means “clickable”." },
          { version: "b.2.2.3", title: "Coming-soon AI + total + graph", sp: 1, note: "Added an “AI summaries” item to the Coming-soon list (alongside GitHub auto-save). The front-page Effort total now uses the SAME auto-summed figure as the version history (so they can't disagree) and sits smaller, closer under the title. The SP-over-time graph is regenerated to include every release." },
          { version: "b.2.2.2", title: "Descriptive chapter titles", sp: 0.1, note: "Chapter titles no longer repeat the version number (it's already shown on the left); they now describe the work — e.g. “Current strength and combined lifts”, “Bottom nav, Add and compare”." },
          { version: "b.2.2.1", title: "Renumbered history chapters", sp: 0.1, note: "Renamed the version-history chapter labels into a clean sequence — b.1.0 (was “0.x”), b.1.1, b.1.2, then b.2.0 / b.2.1 — so the chapters read as tidy version numbers." },
          { version: "b.2.2.0", title: "Nested collapsed history", sp: 3, note: "Version history is now three nested levels — releases under 20–30 SP groups under 80–130 SP chapters — and every row starts collapsed, showing just its title, so the page stays short." },
          { version: "b.2.1.61", title: "Timeline heatmap + sex filter", sp: 5, note: "Three things. (1) The Workouts heatmap has a new “Timeline” view — now the default — that draws your whole history as ONE continuous strip flowing across years (2025 → 2026 → 2027) instead of jumping one calendar year at a time; every January is labelled with its year so you can see where each year begins. “Single year” (with ‹ › nav) and “All years” (stacked) are still there. (2) The athlete picker gains an All / Men / Women filter above the name chips — pick a sex to narrow who shows, then choose the person. (3) Removed the redundant “Workouts” button from the bottom bar: it opened the very same heatmap as the “Workouts” tab in the athlete tab row, so the bottom bar is now just Exercises · Other (the heatmap still lives on the athlete “Workouts” tab)." },
          { version: "b.2.1.60", title: "Collapsible code sections", sp: 1, note: "The category sections in the Exercise-codes list now collapse — tap a coloured header (▾/▸) to fold a whole group away, so you can hide the categories you're not editing. Which sections are folded is remembered on your device, and searching temporarily opens everything so no match hides in a collapsed group." },
          { version: "b.2.1.59", title: "Edit any set", sp: 8, note: "Every set of every exercise is now editable — tap the ✎ in its weight cell to open an edit row and change the Weight, Reps, a per-set Bodyweight (just for that set, overriding the profile default) and the technique Scaling factor; RIR stays the dropdown in the row. The StrengthLevel data is never touched — your tweaks are saved on this device as a per-set override and flow everywhere (1RM, volume, leaderboard, graphs). “Reset set” clears a set's edits." },
          { version: "b.2.1.58", title: "Multi-category + skills + statics", sp: 5, note: "Exercises can now appear under MORE THAN ONE category in the Exercise-codes list — a deadlift shows under Legs, Back and Core. Calisthenics skills count as both: a front lever is Skill + Back + Core, a muscle-up is Skill + Back + Arms, planche is Skill + Shoulders + Chest + Core, dragon flag is Skill + Core, handstand/L-sit map to Shoulders/Core — just like a squat isn't merely a “skill”. And isometric holds (handstand hold, L-sit, planche/front-lever holds, planks, wall sits, dead hangs) get a small “static” tag, while their dynamic versions (front-lever raise, handstand walk) don't. The muscle mapping is a starting point — tell me any you'd move." },
          { version: "b.2.1.57", title: "More category fixes + auto SP total", sp: 3, note: "The version-history total now COMPUTES itself — a function sums every release's story points, so it updates on its own instead of waiting to be hand-edited. Plus a batch of category fixes: crunches were reading as Cardio (because “crunch” contains “run”) — now Core; Sled Leg Press and Bulgarian Split Squats are Legs (no longer Cardio/“sled” or Mobility/“split”); POS… drills are Posture (matching POST…), while STRETCH… stays Mobility; Cold shower and Meditation leave Mobility for Other; Lower-back machine is Back (erector spinae); Leg hops are Dynamic. (Kong → Skill and the Leg-angle raises → Core are best guesses — say if they're wrong.)" },
          { version: "b.2.1.56", title: "Sections read as cards", sp: 1, note: "The page now has a faint off-white background so every panel reads as a distinct card (they were white-on-white before). “Stats & training mix” is its own bordered, collapsible card, and the athlete tab bar (Workouts | List & stats | Compare | Single) now joins the content beneath it into one clearly-outlined tabbed card. Dark mode keeps the same card pop." },
        ],
      },
      {
        version: "b.2.1.41–b.2.1.55",
        title: "Roles, login and variants",
        sp: 0,
        note: "A view-as roles system with a login page, technique scaling for the squat rack, and tidier settings.",
        children: [
          { version: "b.2.1.55", title: "Technique scaling factor", sp: 8, note: "Reworked the squat-rack holes from a bodyweight-% into a technique SCALING FACTOR. The hole no longer changes your real logged weight or its 1RM — those stay exactly as recorded everywhere. Instead each hole carries a plain multiplier (default ×1, tuneable in the holes table) and the exercise graph gains a “Scaled effort” line = each set's real 1RM × its hole's factor, so sets done at different difficulties can be lined up for comparison while the originals are untouched. Groundwork for tagging other technique changes the same way." },
          { version: "b.2.1.54", title: "Category fixes + two new", sp: 3, note: "Re-categorised a batch of exercises and added two categories. New “Dynamic” (long jump, wall climbs) and “Posture” (the POST… posture drills). Stretches (POS…) now read as Mobility. Grip / forearm / loaded-carry / rotator-cuff work and a set of hand-marked holds (Plate lifts, Front support, Overhead hold, Person lift, Carry hold, Dead hang, Farmers Walk, Suitcase Carry, Grip, Hang…) are now Arms; Bent Knee Hip Raise is Core. These are curated, highest-priority fixes, so an olympic “hang clean” still reads Legs, not Arms." },
          { version: "b.2.1.53", title: "Tap the name to switch lift", sp: 1, note: "In the Single (drill-in) view the exercise name is now a dropdown — tap it to switch straight to another of that athlete's lifts (most-trained first) without going back to the list. Uses the app's own dropdown styling and closes when you tap elsewhere." },
          { version: "b.2.1.52", title: "Athlete view: four tabs", sp: 3, note: "The athlete view now has four tabs above both panels: Workouts | List & stats | Compare | Single. Workouts is the sessions view (same as the bottom-nav Workouts), List & stats and Compare are the old exercise tabs, and Single is the one-exercise drill-in — it reopens the last lift you looked at (or your most-trained). The tabs stay visible whichever panel shows and stay in step with the bottom nav." },
          { version: "b.2.1.51", title: "Admin login password", sp: 0.5, note: "Logging in as admin now needs a password; the wrong one shows “Wrong password” and won't let you in. “View as spectator” stays open (no password). It's a soft gate only — the site is public and the check runs in the browser, so it's not real security." },
          { version: "b.2.1.50", title: "Codes grouped by category", sp: 0.5, note: "The Exercise codes list is now split into category sections (Legs, Chest, Back, Shoulders, Arms, Core…) with a coloured header for each, instead of one mixed list — much easier to find a lift. Still most-trained first within each category, and search still filters across all of them." },
          { version: "b.2.1.49", title: "Always per-set bodyweight", sp: 0.5, note: "Removed the “Bodyweight source” setting. The 1RM now always uses the bodyweight recorded with each set, falling back to your profile weight only when a set didn't record one — no toggle to get wrong. Also removed the “Log in” button next to the title (it lives in the sign-in screen / Settings)." },
          { version: "b.2.1.48", title: "Tidier settings menu", sp: 0.5, note: "Settings is decluttered: the calculation/display options (1RM formula, Bodyweight source, Current strength fade, Show “Legs (all)”) are tucked under a “Calculations & display” dropdown, and Dark mode now sits in a row next to the Log in/out button — grouped with the View-as security control." },
          { version: "b.2.1.47", title: "Top Log in when spectating", sp: 0.5, note: "When you're logged out (spectator), a “Log in” button now sits up top next to the “Adomas (logged out)” badge — so you can jump back to the sign-in screen without opening Settings." },
          { version: "b.2.1.46", title: "Compacted time actually compacts", sp: 2, note: "Fix: “Compacted time” barely changed because it counted every workout day (even exercises you'd hidden in the legend) and only trimmed gaps to the median. Now it drops empty days entirely — every distinct training day becomes one evenly-spaced slot — and it only counts the VISIBLE series, so filtering the legend to Bench Press compacts the bench days and the days you didn't bench just vanish (the graph version of hiding rest days). Re-frames live when you toggle exercises on/off." },
          { version: "b.2.1.45", title: "Log out to the sign-in screen", sp: 0.5, note: "“Log out” now takes you to the sign-in screen instead of silently switching views, and that screen has a big “👁 View as spectator” button — tap it to browse logged-out (Adomas only), or log in for admin. Still decorative: no real sign-in." },
          { version: "b.2.1.44", title: "Logged-out view + login page", sp: 3, note: "A third view type alongside Admin and User: “Logged out”, which shows only Adomas. Settings → “View as” now offers Admin / each athlete / Logged out, plus a Log in / Log out button. There's a decorative login page (username, password, “Log in”, or “Continue without logging in”) reachable on first visit or via Log in. Nothing is enforced yet — no real sign-in or validation; it's all view state, remembered on your device." },
          { version: "b.2.1.43", title: "Badge wraps under the title", sp: 0.1, note: "The “👤 Name (user view)” badge now sits on its own line under the Colosseum title instead of widening the title row, so the Guide and ⚙ buttons stay up top next to the title instead of being pushed to a second line." },
          { version: "b.2.1.42", title: "Choose who user view shows", sp: 1, note: "Settings now has a “View as” dropdown: pick Admin (full access to everyone) or any single athlete. Choosing an athlete drops the dashboard into user view locked to that person — only their chip is pressable, the Other menu collapses to the Guide, and a “👤 Name (user view)” badge shows by the title. Replaces the fixed “Switch to user view” button; the choice is remembered on your device." },
          { version: "b.2.1.41", title: "User view is locked to Adomas", sp: 1, note: "In user view the user IS Adomas: the athlete is forced to him and every other athlete chip is greyed out and unclickable, so a user can only ever see Adomas's data. Switch back to admin view (Settings) to pick anyone again." },
        ],
      },
      {
        version: "b.2.1.29–b.2.1.40",
        title: "pRIR and exercise codes",
        sp: 0,
        note: "Predicted reps-in-reserve per set, a learning-curve strength decay, the squat-rack hole level, and an editable exercise-codes tab.",
        children: [
          { version: "b.2.1.40", title: "Edit exercise codes", sp: 3, note: "New “Exercise codes” tab (Other menu): rename the short code shown for any lift in the Workouts list, graphs and tables — type a new code (e.g. make “dSU” read “Sit”), or clear the box to snap back to the default. Most-trained lifts first, searchable, saved on this device and used everywhere the code appears." },
          { version: "b.2.1.39", title: "User view hides Other menu", sp: 1, note: "User view now actually restricts: the “Other” menu shows only the Guide, while admin still sees everything (Colosseum, Group, Stats, Add, Index, Data, Test, Site map). Switching to user view from an admin-only screen drops you back to Workouts. Toggle and choice still live in Settings and are remembered on your device." },
          { version: "b.2.1.38", title: "Squat-rack hole as a level", sp: 8, note: "Incline push-ups stay ONE exercise. The squat-rack hole is now a per-set selection — like the weight on a bar, but instead of added kilos it picks a bodyweight-part (lower hole = nearer the floor = harder = more of your weight). The hole you logged in the note (SQ8) is read automatically and shown as a tag on the set; Add-a-set has a “Squat-rack hole” field. Each hole gets a starting bodyweight-% and a “Squat-rack holes” panel in the exercise view lists every hole with its best set and effort 1RM and an editable %, so you can scale the heights onto one curve. (Replaces the earlier approach that wrongly split each height into its own exercise.)" },
          { version: "b.2.1.36", title: "RIR menu fits on screen", sp: 0.1, note: "Fix: the per-set RIR picker is the rightmost column, so its dropdown menu opened off the right edge of the phone and the band descriptions were cut off. It now anchors to the cell's right edge and grows leftward (capped to the screen width), so the full list is readable." },
          { version: "b.2.1.35", title: "pRIR vs current strength", sp: 2, note: "Predicted RIR is now measured against your CURRENT strength on the day of the set — your best estimated 1RM faded for time off the lift (the same Ebbinghaus curve as the green line), rather than an all-time peak from a stronger era. So a light or detrained set no longer reads as 19 reps in reserve: it's compared to what you could actually do that day. A set that matches your current best reads ~0; an easier one shows the reps you held back. Tap the number for the full chain." },
          { version: "b.2.1.34", title: "Decay: curved + aggressive", sp: 2, note: "The fade looked too linear and gentle. Switched from an exponential to a logarithmic loss curve — genuinely curved (steep early, flattening later, like a learning curve in reverse) and tuned harder: a fresh lift loses ~10% a month past the grace, ~27% by six months, ~36% by a year. Training still makes a lift more durable, but only modestly (low cap) so even well-trained lifts keep a clear curved fade instead of flattening to a straight line." },
          { version: "b.2.1.33", title: "Tap a pRIR to see the maths", sp: 1, note: "The predicted-RIR (pRIR) number in the sets tables is now tappable, just like the 1RM: it opens a plain-language line showing the strength anchor used (your strongest logged set's estimated 1RM), the reps the curve predicts at that weight, and predicted − actual = the reps in reserve. Makes it clear why a number is what it is — note the anchor is your all-time best, so lighter or detrained sets read as many reps in reserve." },
          { version: "b.2.1.32", title: "Decay is now a learning curve", sp: 3, note: "Rebuilt the fade on the spaced-repetition / Ebbinghaus forgetting curve: strength fades as exp(−time/stability), and each training session GROWS that stability — so the more you've drilled a lift, the flatter its decay. Fixes the nonsense where frequent training made it drop faster; now extra training can only make the fade weaker. The Settings explainer graph shows both a fresh-PR curve and a well-trained (flatter) one." },
          { version: "b.2.1.31", title: "Predicted RIR per set", sp: 3, note: "Every set in the Workouts and Exercises sets tables gains a “pRIR” (predicted reps in reserve) column: your peak estimated 1RM for that lift says how many reps you should manage at that weight, and pRIR is that minus the reps you actually did. High = the set was easy with plenty left; ~0 = taken near failure; negative = you beat the estimate (a sign your 1RM is stale). Sits next to the manual RIR so you can compare what the maths expects with how it felt. Pure tested function in metrics.ts (predictedRir)." },
          { version: "b.2.1.30", title: "Compact settings panel", sp: 0.5, note: "Settings panel tightened up: smaller padding and gaps, and the checkboxes now sit inline with their labels instead of stacked above them — so the whole ⚙ menu is much more compact and needs less scrolling." },
          { version: "b.2.1.29", title: "Sit-up arm position", sp: 2, note: "Decline sit-ups can now be logged by arm position, not just weight: typing “decline sit ups” in Add a set reveals an “Arm position” dropdown (arms on stomach → straight by sides → hands on head → overhead bent → overhead straight, easiest to hardest). The pick is folded into the exercise name so each position tracks as its own variant — how you make the movement harder without adding weight." },
        ],
      },
      {
        version: "b.2.1.15–b.2.1.28",
        title: "Strength fade and compaction",
        sp: 0,
        note: "A use-it-or-lose-it strength-decay model, the compacted-time graph toggle, the Index group-by picker, and a user-view switch.",
        children: [
          { version: "b.2.1.28", title: "Compacted-time graph toggle", sp: 8, note: "Every time-based graph (exercise progress, the compare overlay, workout sets-over-time and the version-history SP line) now has a “⇄ Realistic / Compacted time” toggle in its legend. Realistic keeps the real calendar spacing with the empty gaps; compacted squeezes the rest weeks and layoffs so every session is evenly spaced and all your sets fit — dates still show on the axis and tooltips. One app-wide switch: flip it on any graph and they all follow; remembered on your device." },
          { version: "b.2.1.27", title: "Today session label", sp: 0.5, note: "Workouts “By day” list now labels today's session “Today” instead of its date (e.g. instead of “W Jun 3”), so the most recent session is easy to spot." },
          { version: "b.2.1.26", title: "User view toggle", sp: 1, note: "Settings has a “Switch to user view” button that flips the dashboard between admin (default) and a user view; in user view a “👤 User view” badge shows next to the title. For now that's all it does — the switch a later step will hang user-facing limits on. Remembered on your device." },
          { version: "b.2.1.25", title: "Index Group-by picker", sp: 8, note: "Index page gained a “Group by” picker — slice every exercise by Category, Muscle group, Function (movement pattern), Combinable or Comparable group — and it respects the app-wide filter: each group shows the active lifts and tucks the rest, greyed, under a “Show hidden” sub-dropdown so nothing disappears without trace." },
          { version: "b.2.1.24", title: "Compare period tidy", sp: 0.5, note: "Compare graph period picker tidied: dropped the “Showing period:” label (the dropdown already shows the period, e.g. “Last 3 months”) and moved the dropdown to the right of its row." },
          { version: "b.2.1.23", title: "Any set resets the fade clock", sp: 1, note: "Fix: the current-strength line kept sliding down through your training because it faded from the all-time peak. Now it's a forward simulation — every set restarts the two-week grace, even a lighter one (you're still training the lift), so the line holds flat while you keep training and only sags through real gaps over two weeks. A fresh set can lift the line, never lower it." },
          { version: "b.2.1.22", title: "Proof the fade works", sp: 0.5, note: "Pulled the current-strength line out into a pure, unit-tested builder (decayedStrengthSeries): tests confirm it holds flat for two weeks, is ~10% down a month later, sags strictly through a layoff, pops back up on the next training day, and never exceeds your all-time peak. No behaviour change — just proof." },
          { version: "b.2.1.21", title: "Current-strength line now fades", sp: 2, note: "Fix: the green “Current strength” line on the exercise graph (and the compare graph) was a running best that never dropped, so the decay never showed. It now applies the fade — sagging through layoffs, popping back up when you train, and running all the way to today — so the “use it or lose it” curve is visible on your real lifts, not just the Settings explainer." },
          { version: "b.2.1.20", title: "Strength-fade graph", sp: 1, note: "The Test / calculators tab now has a “Strength fade — use it or lose it” chart: % of your peak 1RM kept vs days without training, with milestone dots (2 weeks, +1 month, 3 / 6 months, 1 year) so the decay curve behind the Current-strength setting is visible." },
          { version: "b.2.1.19", title: "Strength decay (use it or lose it)", sp: 5, note: "New Settings toggle “Current strength (fade with time off)”. Off = your all-time best 1RM (unchanged). On = a detraining estimate: a lift holds for two weeks, then fades — about 10% down a month later, slowing logarithmically after that, never below half. Each set fades by its own age, so a fresh solid lift can overtake a stale old PR. Drives the leaderboard, personal records and exercise cards; pure tested model in metrics.ts (strengthRetention)." },
          { version: "b.2.1.18", title: "Add a new exercise to a session", sp: 1, note: "Each session now has a “+ exercise” button (part of the quick-add UI) that opens an inline form with a searchable exercise picker — type to filter every known exercise (or enter a new name) and log a set for it on that day or today, without leaving the Workouts screen." },
          { version: "b.2.1.17", title: "Toggle the + set buttons", sp: 0.5, note: "A new “+ set buttons” checkbox in the Workouts controls shows or hides all the inline quick-add (+ set) buttons, so the list can stay clean when you're just reading it. Off by default and remembered on this device." },
          { version: "b.2.1.16", title: "Workouts default to By day", sp: 0.1, note: "The Workouts list now opens grouped By day instead of By week — flip to By week any time with the toggle." },
          { version: "b.2.1.15", title: "Edit hand-logged sets", sp: 1, note: "In Add → “Your added sets” each row now has a ✎ Edit button: tap it to change the exercise, weight, reps or date in place, then Save (or × to cancel). Fix a typo without deleting and re-adding. (Only hand-logged sets are editable — StrengthLevel data is read-only.)" },
        ],
      },
      {
        version: "b.2.1.0–b.2.1.14",
        title: "Trim, browse groups, inline add",
        sp: 0,
        note: "Trimmed history notes, the Browse-groups panel, 2–5 word titles, the back-muscle split, workouts grouping controls, and inline add-a-set.",
        children: [
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
    ],
  },
  {
    version: "b.2.0",
    title: "Current strength and combined lifts",
    sp: 0,
    note: "The version-2 foundation: a current-strength line, the merged drill-in graph, RIR difficulty, the year-heatmap tags, combinable lifts and an app-wide active filter.",
    children: [
      {
        version: "b.2.0.34–b.2.0.42",
        title: "Combined lifts and filter",
        sp: 0,
        note: "Combinable/comparable lifts become their own selectable exercises, an app-wide active-exercises filter, and a richer Index inspector.",
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
        sp: 0,
        note: "Per-set difficulty moves to RIR, the year heatmap gains day numbers and alone-tags, and lift grouping moves into one registry.",
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
        sp: 0,
        note: "The start of version 2: a current-strength line on every 1RM graph, legend toggles, the Index info panel, and a Site map tab.",
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
    ],
  },
  {
    version: "b.1.2",
    title: "Charts engine and live data",
    sp: 0,
    note: "The in-house SVG chart engine, dark mode, a real time axis with calendar bands, and one-click live data refresh.",
    children: [
      {
        version: "b.1.14",
        title: "Real time axis and pickers",
        sp: 0,
        note: "Per-set graph on a real time axis with calendar bands, dashed rep lines, a best-set-only toggle, a By-category picker, and every exercise on its own.",
        children: [
          { version: "b.1.14.7", title: "Live refresh status", sp: 2, note: "Refresh shows live status (reads the GitHub Action via its API): ⏳ running, ✓ succeeded, or ✗ failed — so you know whether to wait." },
          { version: "b.1.14.6", title: "One-click data refresh", sp: 5, note: "“Refresh data” button (Data tab): one click runs a GitHub Action that scrapes the newest StrengthLevel workouts, commits ud.csv and auto-redeploys — no local setup, no CORS." },
          { version: "b.1.14.5", title: "Tidied chrome", sp: 1, note: "Tidy chrome: only the whole-site SP under the title, night mode moved into Settings, and group SP totals auto-summed from their releases." },
          { version: "b.1.14.4", title: "Ungrouped exercises", sp: 5, note: "Removed scaling/“pattern” groups — Bench Press, Shoulder Press, Row, etc. are each their own exercise; Group view is category-only." },
          { version: "b.1.14.3", title: "Fixed time axis", sp: 3, note: "Time axis fixed: alternating year/month/week background bands; labels adapt to zoom (never blank, never duplicate ‘Jan 1’)." },
          { version: "b.1.14.2", title: "Best-set-only toggle", sp: 1, note: "Per-set graph: ‘Best set only’ toggle — show just each day's top set (highest estimated 1RM) instead of every set." },
          { version: "b.1.14.1", title: "Dashed rep lines", sp: 2, note: "Per-set lines are dashed — one dash per rep — so reps read at a glance (50→59 over 5 reps = 5 dashes)." },
          { version: "b.1.14.0", title: "Real time axis", sp: 5, note: "Per-set graph on a REAL time axis (each day once, sets fanned within the day); By-category show/hide chips; rep-max reps chosen in the column header." },
        ],
      },
      {
        version: "b.1.13.7–b.1.13.16",
        title: "Drill-in charts and zoom",
        sp: 0,
        note: "Dark mode, the leaderboard on the SVG engine (Chart.js removed), per-axis zoom, and drill-in/list polish.",
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
        sp: 0,
        note: "The from-scratch SVG chart engine and the first charts migrated onto it: Compare, drill-in, and touch pan/zoom.",
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
        sp: 0,
        note: "The b.1.12 run: the graph fix/rewrite saga (→ the from-scratch SVG demo), workout ‘alone’ tags, and the effort-SP dropdown.",
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
        sp: 0,
        note: "The b.1.10–b.1.11 run: Group/Stats views, effort-SP chips, multi-category buckets, and List/Workouts polish.",
        children: [
          { version: "b.1.11.0", title: "Searchable compare chips", sp: 5, note: "Searchable compare chips, no list pagination, combined Group view." },
          { version: "b.1.10.4", title: "Heatmap month dividers", sp: 2, note: "Year heatmap month dividers; list defaults 3 months / 50." },
          { version: "b.1.10.3", title: "Fixed graph drift", sp: 1, note: "Fix progress graph vertical drift." },
          { version: "b.1.10.2", title: "Best set column", sp: 2, note: "List & stats ‘Best set’ column." },
          { version: "b.1.10.1", title: "Effort SP chips", sp: 5, note: "Effort-SP chips; list calculator removed." },
          { version: "b.1.10.0", title: "New Group view", sp: 5, note: "New Group view; old view → ‘Stats’; single editable rep-max." },
        ],
      },
    ],
  },
  {
    version: "b.1.1",
    title: "Bottom nav, Add and compare",
    sp: 0,
    note: "Bottom-nav redesign, the Add tab, the compare graph, per-set views, live hosting, and the b.x versioning reset.",
    children: [
      {
        version: "b.1.6–b.1.9",
        title: "Bottom nav and Add tab",
        sp: 0,
        note: "The b.1.6–b.1.9 run: bottom-nav redesign, the ‘Add’ tab, the Other umbrella + Group view, and multi-category buckets.",
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
        sp: 0,
        note: "The b.1.0–b.1.5 run: version history, compare graph, per-set views, live hosting.",
        children: [
          { version: "b.1.5", title: "Sets-over-time and hosting", sp: 7, note: "Workouts sets-over-time graph, smoother charts, and live hosting." },
          { version: "b.1.4", title: "Time-axis gridlines", sp: 3, note: "Time-axis gridlines on clean week/month boundaries." },
          { version: "b.1.3", title: "Per-set range compare", sp: 5, note: "Per-set range in the compare graph; expandable version history." },
          { version: "b.1.2", title: "Category and tier picks", sp: 3, note: "Category & tier quick-picks for the compare graph." },
          { version: "b.1.1", title: "Per-set range graph", sp: 3, note: "Per-set range graph shows every set, one bar per set." },
          { version: "b.1.0", title: "Version history page", sp: 2, note: "Version history page + version-scheme reset." },
        ],
      },
    ],
  },
  {
    version: "b.1.0",
    title: "Before the reset",
    sp: 0,
    note: "The 0.x era: first dashboards, athlete pages, the Data tab, muscle map, tiers, and big correctness audits.",
    children: [
      {
        version: "0.30s",
        title: "Charts and correctness era",
        sp: 0,
        note: "The 0.30–0.39 era: muscle map, tiers, momentum, and big correctness audits.",
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
        sp: 0,
        note: "The 0.20–0.29 era: the Data tab, records heatmap, editable calculator.",
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
        sp: 0,
        note: "The 0.10–0.19 era: progress charts, exercise categories, athlete chips.",
        children: [
          { version: "0.17.0", title: "Athlete chips", sp: 3, note: "Athlete chips and weekly-progress popups." },
          { version: "0.14.0", title: "Progress charts", sp: 5, note: "Per-exercise progress charts + rep targets." },
          { version: "0.13.0", title: "Category dropdowns", sp: 3, note: "Exercise category dropdowns." },
        ],
      },
      {
        version: "0.0s",
        title: "Foundations",
        sp: 0,
        note: "The earliest builds: first dashboard through athlete pages.",
        children: [
          { version: "0.8.0", title: "Per-athlete pages", sp: 5, note: "Per-athlete pages." },
          { version: "0.5.0", title: "Exercise drill-in", sp: 5, note: "Drill into a single exercise's history." },
          { version: "0.3.0", title: "Workouts and records", sp: 5, note: "Workouts list, records, bodyweight-parts." },
          { version: "0.1.0", title: "Leaderboard and Colosseum", sp: 5, note: "Leaderboard, settings filters, light theme — renamed to Colosseum." },
          { version: "0.0.1", title: "First dashboard", sp: 8, note: "First dashboard: load the CSV and render leaderboards/PRs/1RMs." },
        ],
      },
    ],
  },
];

// SP rolls UP the tree: a node with children is the (rounded) sum of its
// children, computed here so the totals can never drift from the leaf numbers.
// Rounded to one decimal so fractional SP (0.1, 0.5) can't show a binary
// floating-point tail like 90.30000000000001.
function rollupSp(r: Release): number {
  if (r.children?.length) {
    r.sp = Math.round(r.children.reduce((s, c) => s + rollupSp(c), 0) * 10) / 10;
  }
  return r.sp;
}
for (const r of CHANGELOG) rollupSp(r);

/** Count the leaf releases (the actual shipped versions) under a node. */
export function countReleases(r: Release): number {
  if (r.soon) return 0;
  if (!r.children?.length) return 1;
  return r.children.reduce((n, c) => n + countReleases(c), 0);
}

/**
 * TOTAL story points across the whole shipped log — summed from the top-level
 * chapters (each already the rounded sum of everything beneath it), so it's
 * never hand-maintained and updates on its own when a release is added.
 */
export const TOTAL_LOG_SP = Math.round(
  CHANGELOG.filter((r) => !r.soon).reduce((sum, r) => sum + r.sp, 0) * 10,
) / 10;

/** The on-screen version: the newest actual leaf — descend the first child of
 * the newest shipped chapter until there are no more children. */
let newest = CHANGELOG.find((r) => !r.soon)!;
while (newest.children?.length) newest = newest.children[0]!;
export const CURRENT_VERSION = newest.version;

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
  { name: "Athlete", sp: 22 }, // per-athlete pages, sticky chips, muscle map, momentum, training mix, four-tab view
  { name: "Data", sp: 20 }, // raw+processed CSV tab, every computed variable, search, live refresh from StrengthLevel + status
  { name: "Leaderboard", sp: 13 }, // boards, rank/sex/BW/axis filters, combined lifts in the picker
  { name: "Calculator", sp: 13 }, // multi-row reps↔weight calc + the Nuzzo research scatter/best-fit chart (shared with the explainer page), bar-weight axis
  { name: "Navigation", sp: 13 }, // bottom nav + Other sheet, Site map, version history (nested chapters) + SP-over-time
  { name: "Group", sp: 9 }, // train people together: combined comparison table, remembered picks
  { name: "Add", sp: 7 }, // hand-log sets, merge, export/import
  { name: "Stats", sp: 6 }, // per-category cards (was Groups)
];

/** Whole-site EXACT story points (sum of every part) and its Fibonacci grade. */
export const WEBSITE_EXACT_SP = COMPONENTS.reduce((s, c) => s + c.sp, 0);
export const WEBSITE_SP = fibSp(WEBSITE_EXACT_SP);
