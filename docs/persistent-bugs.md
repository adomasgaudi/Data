# Persistent bugs (recurring — learn from these)

Bugs that came back after being "fixed". Logged via the **`#persistent`** command
(CLAUDE.md). Each is a standing reminder to fix the ROOT, not the symptom — and a
record so the next AI doesn't repeat the same shallow patch.

For every entry note: the **device + browser** it was seen on (persistent bugs are
often device-specific — a fix that holds on one engine can fail on another), the
symptom, every prior fix that DIDN'T hold, the suspected root cause, and a
recurrence count. Leave a `PB-n` comment at the fix site.

---

---

## PB-11 — "I added a set but it didn't add" — specifically when logging to a CUSTOM date

- **Recurrences:** 3+ as a CLASS ("added a set, don't see it"). Each prior fix closed ONE
  way the new set could be hidden; the next surfaced through a different hider.
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data), Workouts
  history inline add — the 📅 "pick a date" (custom date) path. (HS-Push Up was the example
  lift, but the cause is date-, not lift-, specific.)
- **Symptom:** logging a set via the inline "+ set" / "+ exercise" form with the 📅 custom
  date picker appears to do nothing — the set never shows. Logging to Today / the session
  day works fine.
- **Prior fixes that each only closed ONE hider:**
  - b.2.8.165 — after an add, force-INCLUDE the lift past the app-wide Index filter
    (`activeSet`) and add it to the Analysis SELECTION scope (`waSelected`). Closed the
    *filter* and *selection* hiders, so a today-add always shows.
  - …but the history list is also PAGINATED (`S.workoutsPage`, ~50 sessions/page). A custom
    PAST date is a session on a DIFFERENT page than the one on screen, so the set was logged
    correctly but rendered off-screen — invisible. The add path only called
    `renderWorkoutsPage()`, which keeps the current page.
- **REAL ROOT:** there are SEVERAL independent ways a freshly-logged set can be off-screen —
  the Index filter, the Analysis selection scope, AND the history's page window / view mode.
  Patching them one at a time is why it recurs. The true invariant is simply: **after
  logging a set, that set is visible.** Today-adds happened to satisfy all three by luck
  (current page, usually unfiltered), so only the custom-date case kept failing.
- **ROOT FIX (b.2.8.x, PB-11):** route a custom-date add through `jumpToWorkoutDate(date)` —
  the same helper the calendar uses — which sets `S.workoutsPage` to the page CONTAINING that
  date, switches to day view, renders, then opens + scrolls + flashes the row. So the logged
  set is guaranteed on screen regardless of how far back the date is. Fix site:
  `onInlineAddGo` in `src/main.ts` (tagged `PB-11`); `jumpToWorkoutDate` now returns whether
  the day was found.
- **If it recurs:** a set is logged but unseen → don't patch the new hider in isolation; ask
  "what's hiding it THIS time" (filter / selection / page / view / date range) and make the
  add path *land the user on the set* rather than enumerate hiders.
- **Recurrence 4 (b.2.8.167 did NOT hold) — Android phone, Brave.** Owner reports the
  custom-date add STILL doesn't show the set after the pagination jump. So pagination was
  NOT the (only) cause. Inspection ruled out: the date-capture logic (`form.dataset.pickdate`
  is set by `openDatePicker`'s callback and read by `onInlineAddGo` off the same element), the
  picker z-index (`.dp-pop` z 60 > `.cmd-bar` 55, flips above the anchor), and the page window
  (now jumped). REMAINING SUSPECTS, device-specific (Brave/Android touch): (a) the `.dp-day`
  tap never fires `onPick` on this touch engine, so `pickdate`/`activate()` never run → the
  📅 seg isn't `is-active` → `when` resolves to the session day, set logged THERE not the
  picked date; (b) a synthetic touch→click closes the picker before a day registers. NEXT:
  needs an owner diagnostic to localise (does the picker open? does the 📅 chip relabel to the
  picked date after tapping a day? after Go, does the set appear on the SESSION day instead?).
  Do NOT blind-patch again until the failing step is known (rule: stop guessing after a fix
  fails — give the owner something testable).

## PB-10 — The selector ⚙ settings popout opens off-screen ("out of bounds")

- **Recurrences:** 2+ (each prior fix held only until the cog MOVED). Same FAMILY as PB-1
  (a floating menu clipped/covered) and the `b.2.8.93` "menu off the LEFT edge" fix.
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data), Analysis
  graph-selector ⚙ popout (Match / Show missing / Original·Combined·Comparison toggles).
- **Symptom:** opening the ⚙ popout shows it half off the RIGHT edge of the screen — the
  right column of options ("Match hi…", "Comparis…") is clipped and unreachable.
- **The escalation war (why it kept coming back):** the popout was `position:absolute`
  anchored to the cog, and each fix assumed WHERE the cog sits. `right:0` (opens left) broke
  when the cog wrapped to the LEFT edge → `b.2.8.93`/ANL-33 switched to `left:0` + a JS
  `--menu-shift` transform clamp, assuming the cog sits on the LEFT. Then the controls moved
  INTO the picker header (`b.2.8.111/112`), putting the cog on the RIGHT → `left:0` opens
  rightward off-screen again, and the transform-clamp didn't save it. Every fix chased the
  cog's current position instead of being position-independent — the classic escalation war.
- **REAL ROOT:** an absolute popout's on-screen-ness DEPENDS on its anchor's position in the
  layout, which keeps changing as the toolbar is rearranged. Any anchor-relative scheme is
  one refactor away from clipping again.
- **ROOT FIX (b.2.8.x, PB-10):** the popout is now **`position:fixed`** and
  `clampMenuIntoView()` PLACES its `left/top` from the cog's LIVE `getBoundingClientRect()`,
  clamped to the viewport (flips above the cog if it'd run off the bottom). Fixed +
  viewport-clamped = no ancestor's position/overflow can clip it and it no longer cares where
  the cog wraps — the same proven pattern as `.lift-menu`. Fix sites: `clampMenuIntoView` and
  `.wa-sel-cog-menu` CSS (both tagged `PB-10`).
- **If it recurs:** check (1) a NEW ancestor gained a `transform`/`filter`/`will-change`
  (that makes `position:fixed` resolve against the ancestor, not the viewport — re-clips it),
  or (2) a new popout copied the OLD absolute+`--menu-shift` pattern instead of this one.

## PB-9 — Coming back from an exercise's info card wipes the analysis selection to just that one lift

- **Recurrences:** 1 (logged now; owner reports it "always" happens — a standing behaviour, not a one-off).
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data). Flow: Index → tap an exercise → its "More info" / metadata card (Discipline / Muscle group / Tier editor) → press Back (←).
- **Symptom:** the Analysis graph + history selection (a curated multi-lift view, e.g. 5 lifts) collapses to JUST the single exercise whose card you opened. Opening a card merely to read/edit its metadata and pressing Back silently destroys the whole multi-lift view. "When coming back from index of exercise it always becomes just that one exercise."
- **Root cause:** `closeExerciseInfo()` (the Back button) was hard-coded to ALWAYS call `openWorkoutAnalysis({ exercises: [name] })`, which overwrites BOTH `waSelected` and `waGraphSel` (the selection SSOT) with the inspected lift. Merely *viewing* a card mutated the persistent selection — the design flaw is that a transient "look at this lift" was implemented by destroying the multi-lift SSOT, with no snapshot/restore. The view-origin (`exInfoOrigin`, captured on open) was already tracked but only used in a dead fallback branch.
- **Root fix (b.2.8.x, PB-9):** Back now returns to the view it was opened FROM (`switchTopTab(exInfoOrigin || "analysis")`) and **never touches the selection**. Viewing a card is read-only w.r.t. the SSOT. Deliberate single-lift focusing is still available via the header **"Analysis"** button (`gotoAnlFromInfo`) and the Index "↗" jump — those are explicit "show this lift" actions; Back is not. Fix site: `closeExerciseInfo` in `src/main.ts`, tagged `PB-9`.
- **Invariant to keep:** simply opening/closing an exercise card must NOT mutate `waSelected`/`waGraphSel`. Only explicit focus actions (header "Analysis", Index ↗, deep-link `#single=`/`#compare=`) may set the selection.
- **If it recurs:** check whether a NEW navigation/back path calls `openWorkoutAnalysis({ exercises })` on a non-deliberate action, or whether `exInfoOrigin` stopped being captured on open.

## PB-8 — Graph breaks when toggling kg ⇄ ×BW (BW→kg)

- **Recurrences:** 2 (the b.2.8.96 padding fix below addressed only the small "jump"; the
  REAL fault was bigger — BW→kg left the graph EMPTY, axis stuck at the BW range, kg points
  clipped off the top). Same FAMILY as the "graph slides on a control change" fixes
  (b.2.8.81 bars overflow, b.2.8.85 time axis slides, b.2.8.86 sections collapse).
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data), Analysis
  graph, single athlete (also with several athletes overlaid).
- **Symptom:** the ×BW (kg ⇄ bodyweight-multiples) toggle below the chart should only
  relabel the y-axis. kg→BW worked, but **BW→kg left the chart EMPTY** — the y-axis stayed
  pinned to the BW scale (0–1.4) so the kg points (30–70) sat far above it and were clipped.
  (Reported repeatedly: "kg to bw works, bw to kg doesn't.")
- **REAL ROOT (recurrence 2) — "think more broadly":** the chart's `update()` MERGES the
  new config over the old (`cfg = {...cfg, ...next}`), but `analyticsGraph` SPREAD the
  per-bodyweight `forceLeftRange` CONDITIONALLY (`...(forceLeftRange ? {forceLeftRange} :
  {})`). So turning ×BW OFF omitted the key entirely → the merge KEPT the stale BW range →
  axis pinned to 0–1.4 → kg data clipped → empty graph. Setting it worked (key present),
  clearing it didn't (key absent). A whole CLASS: any optional key omitted-when-off goes
  stale (`yBands` WR-shading, `legendGroupLabels` had the same latent bug).
- **REAL FIX (b.2.8.x, recurrence 2):** the producer now ALWAYS passes every toggleable key
  EXPLICITLY (set to `undefined` when off) — `forceLeftRange`, `yBands`, `legendGroupLabels`
  — so `undefined` overwrites the stale value through the merge and the axis re-fits to the
  kg data. Widened those config types to `… | undefined` (exactOptionalPropertyTypes) and
  left a note at the merge site so future keys follow the rule. Partial callers
  (`update({series:[]})`) still rely on the merge — that's why the fix is at the producer,
  not by replacing the merge. Fix sites: `analyticsGraph.ts` config, `svgChart.ts` types +
  `update()` note.
- **Prior partial fix (b.2.8.96, recurrence 1):** the ×BW pin's TOP PADDING didn't match the
  kg auto-fit (8% from zero vs 8% of `(kgMax − kgMin)`), so even when the axis DID re-fit the
  points landed at slightly different heights — a small jump. Kept (it's still needed so
  BW = kg ÷ bw exactly), but it did NOT fix the empty-graph; the stale-key bug above did.
- **CONFIRMED FIXED (b.2.8.100):** owner verified ×BW → kg now shows the kg points again on
  Android/Brave (was the same env it failed on). **Why it worked:** passing `forceLeftRange:
  undefined` (instead of omitting the key) makes the config merge actually CLEAR the pin, so
  `resetView`'s `if (cfg.forceLeftRange)` is now falsy and the y-axis re-fits to the kg data
  range — the kg points come back into view.
- **WHAT I MISSED last time (the lesson):** I fixed recurrence 1 from the WORD "jump" and
  assumed a small vertical shift → patched the padding, the most visible suspect. I never
  confirmed the ACTUAL visual (the graph was EMPTY, not jumped) and never traced HOW the
  config reaches the chart (a MERGE, so a turned-off feature's key persists). Two misses:
  (1) didn't verify the real symptom (clipped/empty vs moved) — the owner's screenshots, not
  my mental model, held the answer; (2) treated the symptom (axis padding) instead of the
  data flow (config merge / stale key). **Rule for next time:** when a "graph moved" report
  SURVIVES a fix, first check whether data is actually MISSING/clipped (an axis-range/refit
  problem, not a padding one), and trace whether config is applied by MERGE or REPLACE — an
  omitted key under a merge is a stale-ghost, the same class as the cache-skip in PB-6.
- **Not covered (known):** if you've PANNED/ZOOMED then toggle, the held view doesn't refit
  so the divided data still shifts under it. Fixing that fully needs ×BW to become a
  label-only transform (no data division) — rejected here because it can't normalise
  multiple athletes' differing bodyweights on one axis. If it recurs in the zoomed case,
  that's the trade-off, not a regression of this fix.

## PB-7 — Can't edit Tier from an exercise's info card

- **Recurrences:** 2 (b.2.8.63 "fixed" it by converting the multi-toggle to a
  single-select with its OWN dedicated `data-tierset-*` handler — but tapping a Tier
  chip in the info card STILL did nothing; reported again).
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data),
  exercise info overlay (e.g. "Barbell Lunge").
- **Symptom:** in a lift's info card the TIER row (Primary/Secondary/Tertiary/Ugly + ↺)
  renders fine, but tapping a tier doesn't change it — the highlight stays put. The
  sibling Discipline / Muscle-level chips DO edit, so it's tier-specific.
- **Prior failed fix (b.2.8.63):** gave tier its OWN click handler + its OWN data
  attributes (`data-tierset-ex/-val`), separate from the shared `.ex-meta-chip`
  (`data-meta-ex/-kind/-val`) handler that Discipline uses and that works. That parallel
  path was either never wired into the live build correctly or got clobbered, and there
  was no way to observe it — a textbook "claimed fixed but unverifiable" patch.
- **Root cause (wrong abstraction):** tier was special-cased onto a parallel code path.
  Discipline's chip→handler path demonstrably works; duplicating it for tier created a
  second thing to drift/break, with no shared guarantee. The earlier metaDefault/autoTier
  mismatch (taps "accumulated") was a real but secondary cause.
- **Root fix (b.2.8.x, PB-7):** DELETE the parallel tier handler + attributes. Tier now
  renders as a normal `.ex-meta-chip` with `data-meta-kind="tier"` (identical to
  Discipline) and is handled by the ONE meta-chip listener; `toggleMetaOverride`
  single-selects when `kind === "tier"`. One path → if Discipline edits, Tier edits.
- **If it recurs:** the shared `.ex-meta-chip` handler itself is broken (then Discipline
  fails too — test that first), or something between the chip and `document` calls
  `stopPropagation` on bubble, or the overlay refresh (`reopenIndexDetail` →
  `refreshExerciseInfo`, gated on `currentExInfo`) isn't running. Do NOT re-add a
  tier-only handler.

## PB-6 — A lift's history is empty / partial when it belongs to a combinable group

- **Recurrences:** 4 (b.2.8.38 "fixed" the empty combined history by expanding the
  synthetic name; b.2.8.40 fixed Squat's COMPARE view showing only Front Squat; b.2.8.48
  fixed a COMPARABLE group set to **Merged** going blank; then "Smith Squat" set to
  **Merged** STILL showed "546 rest days" — the previous three fixes all patched
  `remapRegistryCombined`, but the DAY view never even ran it. This was the real root.).
- **Device/browser seen on:** Android phone, Brave/Samsung (adomasgaudi.github.io/Data).
- **Symptom:** select Squat in the history; with the ⇄ Compare lens on it should show
  Squat + Front Squat (its comparable "Squat pattern"), but only Front Squat appears.
  Earlier: with Combine on it showed "546 rest days" (empty). b.2.8.45: setting a
  COMPARABLE group to **Merged** (its combine-slot lens) showed "546 rest days" too —
  the merged synthetic name ("Squat pattern") was the filter, but no record carried it.
- **Root cause:** `remapRegistryCombined` relabels a combinable group's member records
  to the combined name whenever the group's GLOBAL display (`groupDisplayFor`) is
  "combined" — which is the DEFAULT (rule 23). So a logged "Squat" set became "SQ mix"
  in the history regardless of the lens. But "Squat" is in BOTH a combinable group
  (SQ mix) and a comparable group (Squat pattern); the Compare-lens filter looks for
  raw "Squat", which no longer exists (it's "SQ mix") → the reference lift vanishes.
  The OLD global combine-display default fights the NEW per-lift lens model (b.2.8.30).
- **Root fix:** the per-lift LENS is the single source of truth for combining. Make
  `remapRegistryCombined` remap a group ONLY when a selected history lift in it has its
  COMBINE lens on (default off → raw lifts). Then make the history FILTER match the
  remap: combine → the synthetic name (records are relabelled to it), compare → the raw
  members, none → the raw lift (expanded if it's itself a synthetic). The calendar
  keeps RAW member names (its records aren't remapped). Fix site tagged `PB-6`.
- **Root fix (b.2.8.45, recurrence 3):** the "Merged" toggle writes the COMBINE lens
  slot for ANY group — combinable OR comparable — but `remapRegistryCombined` only swept
  `effectiveCombinableGroups()`, so a Merged comparable group's records never got the
  synthetic name while `histFilterNames` filtered on it → empty. Fix: sweep BOTH kinds
  and remap a group only when a selected lift's combine lens RESOLVES to that exact group
  (`chosenGroup("hist", m, "combine")?.id === g.id`) — which also tightens the old loose
  "has any combine lens" check. Raw weights are kept (scaling stays a graph-only concern).
- **REAL ROOT (b.2.8.51, recurrence 4) — why it kept coming back.** All three earlier
  fixes lived in `remapRegistryCombined`, but `buildWorkoutGroups` only called it for the
  PERIOD (week/month) view. The DAY view (the default) read the CACHED `athleteWorkouts`,
  which is remapped ONLY in `renderAthlete()` / after adding a set — NEVER when a lens
  toggles. So: the history FILTER (`waListExerciseFilter` = `histFilterNames`) is recomputed
  live every render with the current lens → "SQ mix"; the day-view RECORDS came from the
  stale cache → still "Smith Machine Squat". Filter ≠ data → every set dropped → "546 rest
  days". Two sources of truth that drift apart on a lens toggle — the classic stale-cache
  bug, which is exactly why patching the remap never held: the day view skipped the remap.
- **REAL FIX:** build the day view from the FRESHLY remapped `recs` too
  (`const base = workoutsForUser(recs, …)`), so the data and its filter both derive from the
  CURRENT lens in the SAME render pass — no drifting cached copy. The `athleteWorkouts`
  cache stays for its other consumers (calendar/heatmap, latest-date, counts). Fix site at
  `buildWorkoutGroups`, tagged `PB-6 ROOT`. Lesson: when a fix to a transform "doesn't
  take", check the consumer actually RUNS the transform — a cache upstream can skip it.

## PB-5 — Tapping a lift name in a fold-title removes it on the graph but NOT the history

- **Recurrences:** 2 (added the history-title removal in b.2.8.31; user reports it
  STILL doesn't work — the graph title's identical removal does).
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data).
- **Symptom:** the graph and "Calendar & history" titles both list the picked lift
  NAMES; tapping a name in the GRAPH title removes it from the graph, but tapping a
  name in the HISTORY title appears to do nothing (or collapses the section).
- **Prior fix that didn't hold:** added a `data-histremove` button + a bubble-phase
  handler in the `#tab-analysis` click listener, mirroring `data-graphremove`
  (b.2.8.31). Both buttons live inside a `<summary>`; both handlers `preventDefault`
  to stop the `<details>` toggling. The graph one works, the history one didn't.
- **Suspected root cause:** the buttons are children of a `<summary>`, so the click's
  DEFAULT action is to toggle the `<details>`. A bubble-phase `preventDefault` on an
  ancestor is meant to stop it, but on this touch engine the toggle (and/or another
  listener) can win for the history title, so the remove either doesn't register or
  the section just collapses. Relying on bubble-phase ordering for a summary-child is
  fragile (same family as PB-4: capture beats bubble).
- **Root fix:** handle BOTH title removals in a CAPTURE-phase document listener that
  runs before the summary's default toggle, with `preventDefault` + `stopPropagation`
  — so a name tap always removes and never toggles, identically for graph and history.
  Fix site tagged `PB-5`.

## PB-1 — "History lifts" sticky selector covers open floating menus

- **Recurrences:** 2+ (Graph-options menu reported covered; earlier the Exercises
  chip menu had the same, "fixed" by bumping it to z-index 55).
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data).
- **Symptom:** with the Analysis "Graph options" (or Legend / ⚙ / Group) dropdown
  OPEN, the sticky **History-lifts selector** from the section below paints ON TOP
  of the menu — the menu's controls and the selector's pills overlap.
- **Prior fixes that didn't hold (the escalation war):** each new floating menu was
  given an ever-higher z-index to "beat" the sticky selector — `.wa-sel-tools
  .wa-fe-menu` and `.wa-sel-cog-menu` were pushed to **55** to clear the sticky's
  **50**. But every NEW menu added later (e.g. `.wa-graph-menu` at 41) starts below
  50 and regresses. Symptom-patching, not root.
- **Root cause:** the sticky selector's z-index was set ABOVE the menus (50). A
  sticky bar only needs to sit above *scrolling content* (auto/0) and the athlete
  row (30) — NOT above floating dropdowns. Sitting above them guarantees it covers
  any menu whose z-index is lower, and there's always a lower one.
- **Root fix (b.2.7.x, PB-1):** lowered `.wa-selector-sticky` to **z-index 35**
  (above content 0 and athlete-row 30, below every floating menu at 40+). Reset the
  escalated menus from 55 → 40. **Invariant: sticky selector 35 < every floating
  menu (≥40). Never raise the sticky above the menus.**
- **If it recurs:** a new floating menu was added with z-index < 36, OR a new
  stacking-context ancestor traps a menu below the sticky — check the menu's
  positioned ancestors, don't just bump its number.

---

## PB-2 — per-day "hidden N/M" unhides ALL days + scrolls the page

- **Recurrences:** 2+ (owner has reported the "reveal hidden" scope/scroll more than once).
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data),
  Analysis → workout history.
- **Symptom:** tapping a single day's grey **"hidden 1/3"** line (meant to reveal
  just THAT day's filter-hidden lifts) instead unhid **every** day's hidden lifts
  app-wide, and **jumped the page** (scrolled to the top of the history).
- **Prior shallow wiring:** the per-day button carried `data-woshowall="1"` → the
  SAME handler as the global head-row "⚑ hidden" toggle → `setWoShowAll(true)`,
  which flips the global `woShowAllExercises` flag, resets `S.workoutsPage = 0`,
  and full-re-renders `renderWorkoutsPage()`. So a per-DAY control ran a GLOBAL
  action + a page-reset re-render (the scroll jump).
- **Root cause:** wrong scope + wrong mechanism. A per-item reveal must be LOCAL
  (this day only) and must NOT re-render the list (re-render = lost scroll). It was
  reusing a global toggle because both just said "show hidden".
- **Root fix (b.2.7.x, PB-2):** the per-day button now carries `data-woshowday=<date>`;
  its day's hidden lifts are pre-rendered greyed + `hidden` inline, and the button
  is a **pure DOM toggle** (show/hide that one `.wo-hidden-day-lines`) — no global
  flag, no `renderWorkoutsPage()`, no page reset, no scroll. The head-row toggle
  stays the only GLOBAL "show all hidden". **Invariant: a per-item "reveal" toggles
  only its own pre-rendered DOM; never call a list re-render or a global flag from
  a per-row control.**
- **If it recurs:** someone re-wired the per-day button to a global toggle again, or
  added a `renderWorkoutsPage()`/`workoutsPage = 0` into its path. Keep it DOM-only.

---

## PB-3 — athlete picker: M/W toggle and name chips drift in size + misalign

- **Recurrences:** 3+ (each resize of one — "match the chips", "50% bigger" — re-broke
  the other; owner has flagged "misaligned / too big" repeatedly).
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data),
  Analysis top athlete row.
- **Symptom:** the left **M/W toggle** and the scrolling **athlete name chips** end up
  different heights and vertically off from each other (and lately too big).
- **Why it keeps coming back:** TWO separately-styled elements (`.ath-sex-toggle` and
  `.athlete-chip`) with their own font-size/padding. Every time one is resized the
  other isn't, so they drift. PLUS the chips' container had an asymmetric
  `padding-bottom: 6px` (scrollbar space) which, under the row's `align-items:center`,
  pushed the chips ~3px ABOVE the toggle even when heights matched.
- **Root fix (b.2.7.x, PB-3):** (1) both pills now derive font-size + vertical padding
  + line-height from SHARED tokens `--athpill-fs` / `--athpill-py` (same border too),
  so they're guaranteed the same height. (2) the chips container uses SYMMETRIC
  vertical padding (`3px 0`) + `align-items:center` so the chips centre-align with the
  toggle. **Invariant: never give the toggle or a chip its own font-size/padding —
  change `--athpill-*`; keep the chip container's vertical padding symmetric.**
- **If it recurs:** someone hard-coded a font-size/padding on `.ath-sex-toggle` or
  `.athlete-chip` again, or re-introduced an asymmetric `padding-bottom` on
  `.athlete-chips`. Route sizing through the tokens.

---

## PB-4 — floating menus don't close on outside click

- **Recurrences:** 2+ (reported on the ⚙ display-options menu; earlier the same
  was patched per-element, e.g. the exercises period dropdown `els.exerciseRange`).
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data),
  Analysis — the ⚙ workout display-options popup stayed open over the table.
- **Symptom:** opening a floating popup menu (a native `<details>` whose body is an
  absolutely-positioned overlay) and then tapping elsewhere left it OPEN — it only
  closed by tapping its own ⚙/summary again. Native `<details>` has no
  outside-click close.
- **Prior shallow wiring:** outside-close was added PER MENU (a dedicated
  `document` click handler for `els.exerciseRange`, the svgChart legend's own
  handler, the RIR dropdowns…). Every NEW floating `<details>` (graph options,
  Exercises, ⚙ display options, identity cog, Group, progress settings…) shipped
  WITHOUT one and stayed stuck-open — the class kept reappearing.
- **Root cause:** no shared behaviour — each popup had to remember to wire its own
  outside-close, so new ones regressed by default.
- **Root fix (b.2.7.x, PB-4):** ONE global capture-phase `document` click handler
  closes any open `details[open]` whose first non-summary child is
  `position:absolute` (a floating overlay) when the click is outside it. Detected by
  COMPUTED POSITION, so it auto-covers every such menu now and any added later — no
  per-menu wiring. Inline disclosures (graph/calendar sections, changelog rows)
  push content (static position) and are left alone. Capture phase so a bubble
  `stopPropagation` elsewhere can't suppress it. The old per-element handlers are
  now redundant (harmless).
- **If it recurs:** a new popup is NOT a `<details>` (e.g. a div with an `.open`
  class — those need the same treatment, see the `.xdd`/RIR dropdowns), or its
  menu body isn't a direct `:scope > :not(summary)` child, or it's not
  `position:absolute`. Check those three before adding a one-off handler.
