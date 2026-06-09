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

## PB-8 — Graph jumps vertically when toggling kg ⇄ ×BW

- **Recurrences:** 1 (first log). Same FAMILY as the earlier "graph slides on a control
  change" fixes (b.2.8.81 bars overflow, b.2.8.85 time axis slides, b.2.8.86 sections
  collapse) — two code paths computing "the same" axis that drift apart.
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data), Analysis
  graph, single athlete.
- **Symptom:** the ×BW (kg ⇄ bodyweight-multiples) toggle below the chart is meant to only
  relabel the y-axis, not move the points. kg→BW looked fine, but BW→kg shifted everything
  vertically. (Reported "going to BW works, going back doesn't.")
- **Root cause:** ×BW (1) divides the left-axis data by bodyweight AND (2) pins the y-axis
  to `forceLeftRange` (= kg range ÷ bodyweight) so the main athlete shouldn't move. The pin
  was supposed to equal the kg view ÷ bw, but its TOP PADDING didn't match: the kg auto-fit
  pads 8% **from zero** (begin-at-zero → `kgMax × 1.08`), while the pin padded 8% of the
  **data spread** (`(kgMax − kgMin) × 0.08`). When lifts sit high (e.g. 30–65 kg) those
  differ a lot, so the BW axis ≠ kg axis ÷ bw and the points landed at different heights.
  Two independent computations of the same axis with mismatched padding.
- **Root fix (PB-8):** make `forceLeftRange.max` use the SAME pad as the kg view —
  `(kgMax + kgMax×0.08) / mainBw` — so BW = kg ÷ bw exactly and the toggle never moves the
  main athlete in either direction. Per-athlete division (each compare series ÷ its OWN
  bodyweight) is unchanged — that's what makes multi-user overlays comparable, and a single
  relabeled axis couldn't express it. Fix site: `analyticsGraph.ts` `forceLeftRange`.
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
