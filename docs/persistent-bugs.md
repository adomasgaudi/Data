# Persistent bugs (recurring — learn from these)

Bugs that came back after being "fixed". Logged via the **`#persistent`** command
(CLAUDE.md). Each is a standing reminder to fix the ROOT, not the symptom — and a
record so the next AI doesn't repeat the same shallow patch.

For every entry note: the **device + browser** it was seen on (persistent bugs are
often device-specific — a fix that holds on one engine can fail on another), the
symptom, every prior fix that DIDN'T hold, the suspected root cause, and a
recurrence count. Leave a `PB-n` comment at the fix site.

---

## PB-28 — Calendar (custom-date) picker won't open from the add-exercise popup

- **First seen / reported:** 2026-06-15, mobile (Brave, Android), Analysis → "+ exercise" popup → tapping the 📅 (pick a date) button. Owner: "I can't press the calendar icon to enter a custom date it's not working." Same CLASS as PB-17 / PB-32 (floating thing in the wrong layer / bounds).
- **Root cause:** a z-index stacking bug. `.dp-pop` (the date picker, appended to `<body>`) used `z-index: var(--z-modal)` (= 60), but the add-set popup `.addm-overlay` uses a RAW `z-index: 120` (it bypasses the semantic z-token scale `--z-drop 40 / --z-modal 60 / --z-top 200`). Since the picker is launched from INSIDE that modal, it opened at 60 — behind the 120 overlay — so it was covered by the modal's backdrop + card: invisible and unpressable.
- **Fix (b.2.8.x):** `.dp-pop` → `z-index: var(--z-top)` (200), clearing the add modal (120). Comment `PB-28` at the rule. Flagged the deeper inconsistency (the add overlay's raw 120 sits off the token scale) for a later cleanup — any popup launched from the add modal that uses `--z-modal`/`--z-drop` will fall behind it the same way.
- **Watch:** a popup/menu launched from WITHIN the add modal must use a z-index above the add overlay's 120 — `--z-modal`/`--z-drop` are not enough. Better long-term: bring `.addm-overlay` onto the token scale so the layers compose.
- **Recurrences:** 0 (first report; sibling of the PB-17/PB-32 floating-layer class).

---

## PB-27 — "Add another" exercise search lags — rebuilds the pills on every letter

- **First seen / reported:** 2026-06-15, mobile (Brave, Android), Focus-lifts plan → "Add another (search)". Owner: "add another exercise search lagging because with each letter it's changing the pills." Tagged #persistent #repeating #2process — same lag CLASS as PB-22 (a heavy re-render where a targeted one would do).
- **Root cause:** the `.prio-add-search` input lives INSIDE `els.planBody`, and its `input` handler called `renderWorkoutPlan()` — which rebuilds `planBody.innerHTML` (the summary + EVERY focus-lift row + all pills) on EVERY keystroke. Because that also destroyed & recreated the input, the handler had to restore focus + caret each time. Rebuilding the whole plan per letter is the lag. (Rule 17 violation: heavy app-wide rebuild synchronously on input.)
- **Fix (b.2.8.460):** follow the SAME good pattern the other four searches already use — `s-wo-search`→`renderSWoList` (only `#sWoList`), `waNewSearch`→`renderVariantPicker` (only `#waNewChips`/pills), `wa-chip-search`→`renderWaChipsScope`, `compareSearch`→`renderCompareChips`: refill ONLY the sub-container. Extracted `buildAddChips(query)` and exposed a `planAddChipsRefill` closure (set by `renderWorkoutPlan`, captures the stable `searchPool`/`suggestions`); the input handler now refills just `.prio-add-chips` + the summary count, leaving the live input — and its focus/caret — untouched. No whole-plan rebuild, no focus-restore hack.
- **#prune note:** swept all `addEventListener("input")` search handlers — the plan search was the ONLY anti-pattern (input destroyed by its own full re-render); the other four already refill a dedicated sub-container, and `els.exerciseSearch`/`els.dataSearch` are fixed elements outside their rebuilt result lists. The lesson is now uniform: a filter box must sit OUTSIDE the region it refilters.
- **Watch:** never put a search input inside a container that its own keystroke handler re-renders wholesale — refill a dedicated `#…chips` child instead.
- **Recurrences:** 1 (PB-22 was the analysis-filter snapshot dimension; this is the per-keystroke-rebuild dimension of the same "do the targeted render, not the whole-view render" lesson).

---

## PB-26 — Deleting a set lags and moves you away from the expanded view

- **First seen / reported:** 2026-06-15, mobile (Brave, Android), Analysis tab → workout history with a set expanded (the FREE/B2W variation chips showing). Owner: "when i delete a set the app lags and move me away from the expanded view. use two process and loading hydration and keep me in the expanded view #senior". Same CLASS as PB-12 (a control inside the set view collapsing it), now via the toast-delete path.
- **Root cause:** `deleteSetsWithUndo` (the toast/Undo delete) re-rendered with `deferRender(renderWorkoutAnalysis); if (workoutsTable) renderWorkoutsPage();` — two problems: (1) `renderWorkoutsPage()` ran SYNCHRONOUSLY, outside `deferRender`'s `scrollY` capture/restore, so the page jumped; (2) `renderWorkoutAnalysis` (the Analysis-tab path) rebuilds the history `innerHTML` but — unlike `renderWorkoutsPage` (which calls `reopenSetEdit` at its end) — never re-applied the open set panel, so the expanded view was destroyed. Net: on the Analysis tab a delete collapsed the expanded set AND jumped scroll. (The editor/swipe delete `deleteSetById` was already correct — it captures+restores `scrollY`.)
- **Fix — Part 1 (b.2.8.x, the "keep me in the expanded view" half):** rewrote the rerender closure to one DEFERRED pass — `deferRender(() => { if (workoutsTable) renderWorkoutsPage(); if (analysis visible) renderWorkoutAnalysis(); reopenSetEdit(); })`. `deferRender` restores `scrollY` (twice, for async chart reflow); rendering only the VISIBLE view avoids the double rebuild; `reopenSetEdit()` LAST keeps the expanded set open across the rebuild (PB-12 idiom). Code comment `PB-26` at `deleteSetsWithUndo`.
- **Fix — Part 2 (b.2.8.x, the "two process" half):** phase 1 (instant) hides the deleted set's run of rows on tap — `.set-main[data-setid]` + its trailing `.set-note-row`/`.set-edit-row` — so the deletion registers immediately even while phase 2 (the part-1 deferred rebuild) catches up a frame later; the rebuild replaces `innerHTML`, clearing the inline `display:none` for free. Covers editor 🗑 + swipe (shared `deleteSetsWithUndo`). Code comment `PB-26 part 2`.
- **Fix — Part 3 (b.2.8.x, the "loading hydration" half):** a small `showHydrating()`/`hideHydrating()` busy pill ("Updating…", reusing the `gh-spin` keyframe) shown while the deferred rebuild runs, with a ~320ms min-visible so it's perceptible even when the synchronous rebuild is sub-frame. NOTE for future AIs: with Part 2's optimistic instant-hide the action is already instant, and a CSS spinner cannot animate during a *synchronous* render (the thread is blocked) — so this pill is mostly a brief confirmation flash, not a true progress spinner. The real cure for any lingering freeze is a lighter/incremental rebuild (SNAP backlog), not a spinner. Code comment `PB-26 part 3`.
- **Standing rule (`#remember`):** any mutate-then-rebuild handler should (1) optimistically update the tapped DOM instantly, (2) re-render through ONE deferred, scroll-preserving pass that calls `reopenSetEdit()` last, (3) show `showHydrating()` for the rebuild — never a synchronous full rebuild that bypasses `deferRender`.
- **Watch:** any mutate-then-rebuild handler (delete, undo, edit) must go through ONE deferred, scroll-preserving render and call `reopenSetEdit()` last — never a synchronous `renderWorkoutsPage()`/`renderWorkoutAnalysis()` that bypasses `deferRender`.
- **Recurrences:** 0 (first report; sibling of the PB-12 class).

## PB-25 — A "created" new exercise doesn't appear (exercise list is data-only)

- **First seen / reported:** 2026-06-15, mobile (Brave, Android), Index + Analysis → add-exercise. Owner asked to "create a new exercise knee raise" with variations; the AI added it only to the variation-model config (`variationConfig.ts` FAMILIES + EXERCISE_FAMILY). Owner: "i dont see it in index (only str level exercises 'hanging knee raise'), i dont see it as an option when adding exercise in history #persistent".
- **Prior failed fix (EXR-142, b.2.8.449):** added `KNEERAISE` family + `EXERCISE_FAMILY["Knee Raise"]` + a bodyweight coeff. None of these make an exercise VISIBLE — they're metadata that only activates for an exercise that ALREADY appears via logged data. So "Knee Raise" (zero logged sets anywhere) stayed invisible everywhere.
- **Root cause:** the entire exercise list is **purely record-derived** — `distinctExercises(records)` builds names FROM logged `SetRecord`s, and every picker/index list flows from it. A lift with no sets can therefore NEVER appear, no matter how much metadata references its name. There was no registry of "exercises the owner intends to track but hasn't logged yet". The variation/family/coeff maps are name-keyed metadata, NOT a visibility source — adding a key there is a silent no-op until data exists.
- **Fix (b.2.8.x):** added `EXTRA_EXERCISES` catalog in `aggregate.ts` and UNIONED it into `selectableExercises` (appended last = 0 sets). Switched the two surfaces that derived names directly — the Index "not-trained" list and the graph/analysis picker (`populateExercisePicker`) — from `distinctExercises` to `selectableExercises`, so a catalog lift shows in the index (as a not-trained gap), the add-exercise datalist, and the graph picker; the existing "is this a known exercise?" checks already use `selectableExercises`, so logging the first set against it is recognised. Once a set is logged, it's a normal data-derived exercise and the catalog entry is a no-op dedupe. Also fixed the sibling gap: the quick-add form only renders dims listed in `AF_DIM_ORDER`, so `backrest`/`obstacle` were added there (the family had them but they never showed). Code comment `PB-25` at the fix sites.
- **Watch:** "create exercise X" needs X in `EXTRA_EXERCISES` (or a logged set) — adding it ONLY to `EXERCISE_FAMILY`/`EXERCISE_BW_COEFF`/`FAMILIES` does nothing visible. New family dims must ALSO be added to `AF_DIM_ORDER` (+ labels) or they won't appear in the quick-add form.
- **Recurrences:** 1 (EXR-142 wired the metadata; this makes the exercise actually exist in the UI).

---

## PB-24 — Add-set popup overflows / scrolls horizontally (inner flex children won't shrink)

- **First seen / reported:** 2026-06-15, mobile (Brave, Android), Analysis → Workouts → "+ set" / "+ exercise" popup. Owner: "@image not fitting fix", then after the card-level fix "still not fixed #cowork #persistent — popup out of bounds shouldnt scroll horizontaly". The popup's content (weight/reps/sets inputs, Add button) extends past the card's right edge / lets the row scroll sideways.
- **Prior failed fix (WO-184, b.2.8.443):** added `min-width: 0` + `overflow: hidden auto` to `.addm-card` so the CARD shrinks to the overlay width. Didn't hold — that only stops the card itself from growing; the flex ROWS *inside* it (`.addm-inputs` with three `flex: 1 1 0` number inputs) still defaulted to `min-width: auto`, so each input kept its ~170px browser-intrinsic width (~510px total) and overflowed the card. The card clipped/scrolled it → "out of bounds".
- **Root cause:** the SAME flex `min-width: auto` trap as the card bug, one level deeper. Fixing the outer flex item (card) doesn't make its flex children shrink — every nested flex item needs `min-width: 0` (or it floors at content width). The inputs row had `flex: 1 1 0; width: auto` but no `min-width: 0`, so `flex-shrink` couldn't take effect below intrinsic input width.
- **Fix (b.2.8.x):** `min-width: 0` on `.wo-addform--modal .addm-inputs input` (and the row container) so the three inputs actually share the row width and shrink to fit — no overflow, nothing to scroll. The intentionally-scrollable rows (`.addm-sugg-row` chips, `.wo-af-dims` variant pickers) are unaffected. Code comment `PB-24` at the fix site.
- **Watch:** a `min-width: 0` fix on a flex container does NOT propagate — re-apply it to EVERY nested flex item that holds intrinsically-wide content (inputs, long text, `<select>`). When a popup "doesn't fit", check the inner rows, not just the card.
- **Recurrence 2 (WO-186, b.2.8.451):** owner #persistent #debug — STILL out of bounds after WO-185. Re-reading the screenshot: the date-toggle row, the inputs AND the Add button all run off the SAME right edge → the CARD itself is wider than the screen, not one row. The CSS was already provably correct (viewport meta fine, no transformed ancestor, card `width:100%` inside a `position:fixed` overlay), so the leading suspect is a **stale cached build on the device** (Brave/Android) — the screenshot shows pre-WO-184 behaviour. Two-pronged per #debug (measure, stop guessing): (a) HARDEN — inputs row → CSS grid `repeat(3, minmax(0,1fr))` (no flex min-content floor at all) + card capped at `min(26rem, calc(100vw − 1.25rem))` so it can never exceed the viewport even on visual-viewport desync (keyboard open). (b) MEASURE — a temporary `.addm-diag` readout in the popup prints the running version + live measured widths (innerWidth/visualViewport, card, inputs, date toggle): a stale version ⇒ cache (hard-refresh); a current version that still overflows ⇒ the widths name the culprit. Remove the diagnostic once confirmed in-bounds on-device.
- **CONFIRMED FIXED (WO-187, b.2.8.452):** owner confirmed b.2.8.451 in-bounds on-device. The diagnostic readout settled the root: it showed `v2.8.451 · vw411/vv411 · card379 · in349 · when349` — card 379px inside the 411px viewport, inner rows 349px within it, version current. So the recurring overflow was a **stale cached build** on the device (Brave/Android serving the pre-fix bundle), NOT a layout bug the per-row flex patches kept missing; the grid + viewport-cap hardening holds once the latest build loads. Diagnostic removed in WO-187. **Lesson:** when a CSS bug "won't die" but the CSS is provably correct, suspect device cache BEFORE shipping another speculative patch — and add a version+state readout (the `#debug` move) to confirm what the device is actually running.
- **Recurrences:** 2 (WO-184 card min-width; WO-185 input min-width; WO-186 grid + viewport-cap + on-screen measurement) — root was device cache, confirmed via the readout (WO-187). Closed.

---

## PB-23 — Graph data dots jammed against the plot frame (no side margin)

- **First seen / reported:** 2026-06-15, mobile (Brave, Android), Analysis → Graph (Marija "Pull Up", and earlier "Hip AD"). Owner: "fitting the graph should leave about 10px margin so the side dots are not so completely against the side" — then "nope #persistent" when the first fix didn't hold. The first/last data points (and the trend-line ends) sit right on the left/right frame, sometimes in the corners.
- **Prior failed fix (CHART-112, b.2.8.434):** padded the X DOMAIN in `resetView()` by ~10px-equivalent (`xPad = range × 10/plotW`). Didn't hold — `resetView` only runs on **Fit / double-tap / mount**. The owner was looking at a **paginated/zoomed window** (the ‹ › pager / pinch / drag), whose view bounds are set by `zoomXY` / pan / pagination, NONE of which add padding. So edge points still landed on the frame on every non-Fit view.
- **Root cause:** the margin was being added at the wrong LAYER — the data DOMAIN (`view.xMin/xMax`), which has many independent writers (resetView, zoomXY, pan, pinch, pager). The single chokepoint every view funnels through is the COORDINATE TRANSFORM `xPix`, which mapped `view.xMin → M.l` and `view.xMax → W-M.r` exactly — so whenever a data point coincides with a view edge it touches the frame. Padding one writer can't fix a property that belongs to the transform.
- **Fix (b.2.8.x):** bake a fixed ~10px gutter into the X transform itself: `xPix` now maps the view into `[M.l+padX, W-M.r-padX]`, and the same inset is applied to the horizontal gridlines, the calendar bands, the bar step width, `clampX`, and EVERY inverse transform (tooltip / crosshair / pan-zoom pixel→value) so hit-testing stays aligned. The earlier `resetView` domain pad was reverted to its original tiny value. Now the margin holds on Fit, pan, zoom AND pagination — it's a property of the plot geometry, not of one view-setter. Code comment `PB-23` at `xPix`.
- **Watch:** never add a "visual margin / inset" by nudging `view.*` — do it in the transform, the one place all view states share. Any new pixel↔value conversion must use the same `padX` (`xL`/`xW`) bounds as `xPix`, or tooltips/pan will drift.
- **Recurrences:** 1 (CHART-112 was the domain-pad attempt; this is the transform-level root fix).

---
## PB-22 — Added exercise lags / shows only after a delay (Analysis history)

- **First seen / reported:** 2026-06-15, mobile (Brave, Android), Analysis → Workouts ("All Exercises"). Owner added "v-squats" via "+ exercise" and it didn't appear at first ("not adding"), then "shows now, so it's a lagging issue". Tagged #persistent #prune — same CLASS as PB-11 ("I added a set but don't see it").
- **Root cause:** the Analysis history list is scoped by `waListExerciseFilter`, a NAME-SNAPSHOT computed in `renderWorkoutAnalysis` (`historyFilterWithSearch(histFilterNames(waSelected))`). The add-set/exercise commit updates `waSelected` but did NOT recompute that snapshot, and on the analysis tab it only re-rendered the GRAPH (not a fresh-filter list). So a just-logged, often brand-NEW exercise was excluded by the stale filter until the next analysis render re-derived it — the perceived "lag".
- **Fix (b.2.8.x):** after the commit updates `waSelected`, when the analysis tab is visible it now recomputes `waListExerciseFilter = historyFilterWithSearch(histFilterNames(waSelected))` BEFORE `renderWorkoutsPage`, so the new exercise is in scope immediately. Invariant (shared with PB-11): after logging, that lift is visible NOW, on every view. Covers both "+ set" and "+ exercise" (same shared commit).
- **#prune note:** the other lift-add paths (priorities Add-another, command-bar create, compare-combine) don't use the analysis history filter, so they're unaffected by this snapshot; this commit was the one place the stale scope bit.
- **Watch:** any view scoped by a cached name-list must refresh that cache when a set/exercise is added, not rely on the next interaction.
- **Recurrences:** 1 (PB-11 was the set-row / date dimension; this is the analysis-filter dimension of the same invariant).

---

## PB-21 — Exercise card ↔ calculator feature parity (recurring "the card should have what the calc has")

- **First seen / reported:** 2026-06-15, mobile (Brave, Android), exercise-info card. Recurring request: the card keeps lacking features the Formulas calculator has (WR/benchmarks/stats were moved over in EXR-139; now the warm-up + hard-set plan pickers / full workout table). Owner: "exercise card should have everything a calculator has."
- **Why it recurs (root):** the warm-up / working-weight prescription is rendered by TWO separate code paths — `renderWarmup` (Formulas, into `#rxOut`) and `liftTrainingHtml` (the card) — each with its own markup. So every calculator improvement has to be re-applied to the card by hand, and gets forgotten → the parity gap keeps reopening. Same class as the card already pulling in WR/benchmarks/percentiles.
- **Fix (b.2.8.x — ongoing):** extracted a SHARED `warmupTableHtml()` (the warm-up ramp continuing into the hard sets) + `planPillsHtml()` (the warm-up & hard-set plan pills) that BOTH `renderWarmup` and the card now call — one source, so they can't drift. The plan popups (`openPlanPopup`) work from either view via `lastWuCalc` + `lastWuRerender` (the popup refreshes whichever view owns the warm-up). Remaining gap: the card still has no manual weight/reps INPUT for a never-logged lift (the 🧮 Calc button opens the prefilled calculator for that). Root cure = keep sharing components rather than duplicating; never add a calc feature to one path only.
- **Watch:** any new Formulas/warm-up feature must go through the shared helpers, not a card-only or calc-only copy.
- **Recurrences:** 2 (EXR-139 moved WR/benchmarks/stats; this turn shares the warm-up + plan pickers).

---

## PB-20 — Can't pick exercises after clearing all (empty Graph/multi view)

- **First seen / reported:** 2026-06-15, mobile (Brave, Android / Samsung), Analysis → Graph in the empty (nothing-picked) state, esp. the multi/full graph view.
- **Symptom:** Tapping ✕ (remove all) on the selection title clears every lift, and then there is no visible way to pick new ones — the graph title collapses and the picker is unreachable.
- **Prior fixes that didn't hold:**
  - **SEL-49 (b.2.8.380):** made the empty-state selection TITLE still render its `+ / ✕ / =` toolbar and Pick tab. This fixed the **History** title (confirmed working), but NOT the **Graph**: the graph summary collapses to a thin eyebrow-height strip when empty (`:not(.is-bigtitle)`), so the absolutely-positioned toolbar/Pick tab clip or vanish. Made worse by **SEL-48 (b.2.8.378)**, which removed the inline `#waExerciseSelector` picker — so the Pick tab/drawer is now the ONLY way in, and when it's clipped you're stranded.
- **Root cause:** the empty-state pick affordance depended on absolutely-positioned elements (toolbar at `bottom:0`, Pick tab at the right edge) inside a `<summary>` whose height collapses when there are no names — fragile, and it clips inside the card. Relying on a positioned overlay for a primary action in a collapsible container is the design flaw.
- **Fix (b.2.8.386, refined b.2.8.390):** first the bottom-of-graph "No lifts picked" note became the picker button. The owner then asked to **move it INTO the empty title** so the title itself doesn't collapse — so the final fix is: when a selection is empty, the graph/history TITLE renders a full-width in-flow `.wa-title-pickcta` button ("No lifts picked — tap to pick.", `data-titlepicker` → `openPickDrawer`) as its content. The in-flow button FILLS the title (giving it height, so it can't collapse) AND is the tap target — replacing the fragile absolutely-positioned toolbar/Pick tab in the empty state. The bottom note is cleared. Comment at the fix site points here.
- **Watch:** never make a PRIMARY action reachable ONLY via an absolutely-positioned element inside a collapsible/clipping container — always keep an in-flow fallback.
- **Recurrences:** 1

---

## PB-18 — Swipe-to-delete a SET ROW drags a few mm then snaps back

- **First seen / reported:** 2026-06-12, mobile (Brave, Android / Samsung), expanded-history set table: swiping a set row left→right to delete it moves a couple of mm then "loses the drag" and snaps back.
- **Prior fixes that didn't hold:** the swipe handler relied on `.set-main { touch-action: pan-y }` to keep horizontal drags for JS while letting vertical scroll the page (same pattern the collapsed `.wo-ex-line` swipe uses — and THAT one works).
- **Root cause:** `touch-action` is **not reliably honoured on `<tr>`/`<td>`** elements on Chromium-on-Android (Brave / Samsung Internet). The set rows are table rows, so the browser ignored `pan-y`, claimed the horizontal swipe as a scroll, fired **`pointercancel`** → the drag reset. The collapsed exercise line is a `<div>`, which DOES honour `touch-action`, so its swipe was fine — the difference was `<tr>` vs `<div>`.
- **Fix (b.2.8.287):** a **non-passive `touchmove`** listener `preventDefault()`s a clearly-horizontal move while a set-row swipe is armed (touch started on a `.set-main`, not a control), BEFORE the browser commits to scrolling — so the gesture stays with our JS drag. Pointer-event logic unchanged; `touch-action: pan-y` also added to `.set-main > td` as belt-and-suspenders. Comment at the fix site points here.
- **Watch:** any future swipe/drag built on a `<table>`/`<tr>`/`<td>` needs the same touchmove backstop — don't trust `touch-action` on table elements.
- **Recurrences:** 1

---

## PB-17 — Popup/floating menus go out of viewport bounds

- **First seen:** 2026-06-12, mobile (Brave, Android), workout ⚙ console pill strip bleeding off left edge
- **Prior cases:** PB-10 — same class of bug on `.wa-sel-cog-menu` (exercise selector ⚙); fixed with `position:fixed` + `clampMenuIntoView`. The workout ⚙ `.wo-controls` was still `position:absolute` with static `left`/`right` CSS, so it kept escaping bounds.
- **Root cause:** `position:absolute` menus anchored with hardcoded `right:0` or `left:0` always fail when the anchor moves (e.g. ⚙ sitting left vs right on the row). Only `position:fixed` + JS clamping to viewport (`clampMenuIntoView`) is robust.
- **Fix (b.2.8.285):** `.wo-controls` switched to `position:fixed; left:0; top:0` + toggle-event handler calls `clampMenuIntoView` — same as the PB-10 fix. Removed all the old `left`/`right` CSS overrides.
- **Rule added:** CLAUDE.md — before shipping any floating/popout menu, verify it can't go out of bounds (use `position:fixed` + `clampMenuIntoView`).
- **Recurrences:** 1

---

## PB-13 — The exercise-picker OPENER keeps getting reworked (discoverability of "swipe to open")

- **Recurrences (this is the pattern):** full-width "▸ Picker & settings" bar → title-row "▦ Pick"
  pill (b.2.8.177) → slide-in white sticky-note DRAWER, no close button (b.2.8.179) → now a
  white sticky-note TAB poking out the right edge you drag left to open (PB-13). The opener has
  changed ~4× because each form hid HOW to open it.
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data), Analysis view,
  graph + history selectors. Smartphone is the priority surface.
- **Symptom (the real one):** the open gesture isn't DISCOVERABLE. A plain "Pick" pill doesn't
  say "drag me"; the swipe-left-to-open was invisible. The owner keeps asking for a clearer
  affordance — most recently "make it a white paper sticky note sticking out of the right side".
- **Root cause:** the picker is a *drawer* (a right-edge slide-in), but its OPENER was styled as
  an ordinary inline button, so the spatial metaphor (pull it in from the right) wasn't shown.
  An affordance that doesn't look like its gesture gets re-requested forever.
- **Root fix (b.2.8.x, PB-13):** the opener IS the drawer's visible edge — `.wa-title-picker` is
  now a white paper sticky-note TAB pinned to the card's right edge (`position:absolute; right:
  -0.7rem`), vertical "▦ Pick", peel-shadow on the free left side. Dragging it left (existing
  swipe handler, `touch-action:pan-y`) or tapping pulls out the same drawer. The handle now
  LOOKS like the thing it opens, so the gesture is implied. Fix site: `.wa-title-picker` /
  `.wa-seltitle-box` in `src/styles.css` (tagged `PB-13`); opener swipe in `src/main.ts`.
- **Follow-up (b.2.8.194):** acted on the "if it recurs" notes *proactively*, before a re-report.
  Added the missing drag affordance — a "‹" pull-hint + a peel-out hover animation — so the tab
  visibly says "drag me left". Also fixed a real cross-selector bug: the flat `right:-0.7rem`
  was correct only in the graph's padded card; in the unpadded history fold it pushed the tab
  ~0.7rem PAST the screen edge. Now bled per-fold via `--wa-pick-bleed` (0.7rem on `.wa-card-fold`,
  0 elsewhere) so BOTH tabs sit flush with the same edge. Tab content moved to child spans
  (`.wa-pick-pull` + `.wa-pick-tab-txt`); right-edge reserve gated behind `.wa-seltitle-box.has-pick`.
- **If it recurs:** the tab still isn't read as draggable (consider a one-time nudge animation),
  or it collides with the title text / fold caret on a narrow screen — re-check the reserved
  `padding-right` on `.wa-seltitle-box.has-pick` and the tab's vertical extent vs the 2-line clamp.

## PB-12 — The inline SET-EDIT panel closes when you press a button inside it

- **Recurrences:** 2 (+ part of the long-running rule-24 CLASS — "tapping a setting closes
  the menu", see PB-4, the graph-options sections fix b.2.8.86/99, the picker-drawer fix
  b.2.8.159/b.2.8.177). Same root, new surface.
  - **Recurrence 2 (b.2.8.x):** the ⚖ machine pill, in the SINGLE-LIFT Analysis view, still
    collapsed the panel even though it used the exact same synchronous render+`reopenSetEdit`
    sequence as ⇄/⌁/⊘ (which held in the plain Workouts tab). Real cause: the Analysis view
    rebuilds the history table AGAIN on the next frame (a deferred / Chart-driven re-render),
    AFTER the synchronous `reopenSetEdit` — so the one-shot reopen lost the race. Fix: make
    `reopenSetEdit` reopen EVERY matching row and re-assert once on the next animation frame
    (`requestAnimationFrame`). Device: Android, Brave, adomasgaudi.github.io/Data, Analysis →
    LAPD single-lift → expand a set → tap ⚖.
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data). Workout
  history → tap a set row to expand its edit panel (Weight/Reps/Bodyweight/Scale/Note +
  ⇄ unilateral / ⌁ assisted ½ / ⊘ not comparable / 🗑 Delete). Pressing any of the toggle
  buttons collapses the whole panel.
- **Symptom:** the set-edit panel snaps shut the instant you press ⇄ unilateral, ⌁ assisted,
  ⊘ not comparable (or edit a field) — so you can't make two changes without re-opening it.
- **Root cause:** the panel's open state lived ONLY in the DOM — the `edit-open` class on the
  set-main row + the `hidden` attribute toggled off the `.set-edit-row`. Every control in the
  panel calls a FULL table re-render (`renderWorkoutsPage` / `renderAll` via `toggleAssisted‌Exercise`, `toggleUnilateralExercise`, `toggleSetNotComparable`, `onSetEditInput`…), which
  rebuilds the rows fresh (hidden by default) — wiping the open state. Symptom-patching each
  button would never end; the real flaw is "open state not preserved across the rebuild its
  own controls trigger."
- **Root fix (b.2.8.x, PB-12):** the open set is now an SSOT module var `openSetEditId`
  (set/cleared by `toggleSetEdit`), and `renderWorkoutsPage` calls `reopenSetEdit()` at the
  end of every rebuild — re-un-hiding that set's `.set-edit-row` (tagged `data-seteditid`) and
  re-marking its set-main row. One fix covers ALL the panel's buttons. Cleared in
  `deleteSetById` when that set is removed. Fix sites: `toggleSetEdit` / `reopenSetEdit` /
  `renderWorkoutsPage` in `src/main.ts` (tagged `PB-12`).
- **If it recurs:** a NEW set-table render path (e.g. the single-mode `setsByDateTableHtml`)
  rebuilt the rows without calling `reopenSetEdit()`, or a new control re-renders via a path
  that doesn't end in `renderWorkoutsPage`.

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

## PB-5 — "everything is broken / no buttons work" (whole-app dead on load)

- **Seen:** 2026-06-11, Samsung Android phone, Brave browser, live GitHub Pages site.
- **Recurrence count:** 3 reports in one day (b.2.8.265 → b.2.8.268) before the root was found.
- **Symptom:** the page renders but NOTHING responds — tabs, Settings, section
  folds all dead. No visible error.
- **Failed fixes (symptom-patching):** auth-gate tweaks (b.2.8.267 signed-in class,
  b.2.8.268 no-forced-gate) — plausible-looking but NOT the cause.
- **Real root cause:** the Data-tab HTML block (added in b.2.8.265) used CURLY
  quotes for attributes (`id=”refreshStatusBtn”`), so `getElementById` found
  nothing and the strict `$()` helper threw `missing #refreshStatusBtn` while
  building the module-level `els` object → the WHOLE bundle died before any
  event listener was attached. One bad character = total app failure.
- **Fix (b.2.8.269):** straight quotes restored; swept the whole file for `=”`.
- **How it was finally caught:** running the production bundle in jsdom and
  reading the thrown error — NOT by guessing from screenshots.
- **If it recurs (any "nothing works" report):** (1) FIRST reproduce: load
  dist/index.html in jsdom (see the harness pattern in this entry's commit) and
  read the actual exception; never guess. (2) Check `els` — any `$("id")` whose
  element was removed/renamed in index.html kills the app at load. (3) Grep
  `=”` for curly-quote attributes after any AI writes HTML.

---

## PB-14 — Version number not updated when shipping a change

- **First seen:** 2026-06-11, owner reported "i dont see it update to v.275" after multiple commits.
- **Recurrence count:** 2+ times in one session (b.2.8.275 entry added but then wiped by a background agent; version bump forgotten or done inconsistently).
- **Symptom:** the live site still shows an old version number, or the newest release entry is missing from the changelog.
- **Root cause:** the three-step version update (bump `<span class="version">` in `index.html`, prepend entry to `RELEASES` in `src/changelog.ts`, rebuild `dist/`) is easy to forget in parts — especially when background agents rerun scripts or when the AI focuses only on the code change and not the version bookkeeping.
- **Fix:** added as CLAUDE.md rule 29: every change MUST do all three steps before committing. Check with `grep 'span class="version"'` and `head RELEASES` before pushing.
- **If it recurs:** before any commit, assert `index.html` version == newest `RELEASES[0].version` == `CURRENT_VERSION`.

---

## PB-15 — Manual sets with no `seq` are silently filtered out of every Supabase upload

- **First seen:** 2026-06-11, Samsung Android, Brave (usual browser + incognito). No sync indicator, no data in incognito.
- **Recurrence count:** 1 (but affected ALL legacy manual entries from the start).
- **Symptom:** Upload/download buttons show in Settings but nothing is synced. Incognito browser shows no manually-added sets. No error shown.
- **Root cause:** `syncManualToSupabase` filters `manualEntries.filter(m => m.seq !== undefined)`. Any entry added *before* the `seq` field was introduced (b.2.8.274) has `seq: undefined` and is silently dropped. Since ALL of the user's entries predate the seq field, zero rows are ever sent to Supabase.
- **Fix (b.2.8.279):** Back-fill `seq` for entries missing it at upload time (`Date.now() % 2e9 + i`), then save to localStorage so they're stable on next call. Also show status for "nothing to upload" and "nothing new" so silent no-ops are visible.
- **If it recurs:** check `manualEntries.filter(m => m.seq !== undefined).length` in the console — should equal `manualEntries.length`.

---

## PB-16 — Supabase anon key can't INSERT even with RLS disabled

- **First seen:** 2026-06-11, upload fails ("⬆ failed") while download returns "nothing new" (SELECT works).
- **Recurrence risk:** HIGH — this will bite every new Supabase table we create.
- **Symptom:** `syncManualToSupabase` catches an error; download finds 0 rows (table is empty because nothing was ever written).
- **Root cause:** `ALTER TABLE sets DISABLE ROW LEVEL SECURITY` bypasses RLS policies but does NOT grant Postgres-level permissions to the `anon` role. The anon key still gets a permission-denied on INSERT/UPDATE/DELETE because no explicit GRANT was issued.
- **Fix (b.2.8.280.1):** Added `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sets TO anon, authenticated;` to setup-db.yml and re-ran the workflow.
- **Rule for future tables:** every new Supabase table needs BOTH `DISABLE ROW LEVEL SECURITY` AND `GRANT ... TO anon, authenticated` — neither alone is sufficient for the anon key to read and write.

---

## PB-19 — Main content area blank / data page gone

- **First seen:** 2026-06-12, Samsung Android, Brave. Version b.2.8.299+.
- **Recurrence count:** 1 (ongoing — not yet resolved)
- **Device/browser:** Android, Brave browser (same device as all other reports)
- **Symptom:** The main page (Analysis tab) shows completely blank — only the topbar and the pinned search bar are visible. No athlete chips, no graph, no history. No error visible on screen. "No console data nothing."
- **Prior fix attempts:** 
  - (b.2.8.304) Added renderAll() try/catch to show on-screen crash message — no error displayed, confirming renderAll() completes without throwing
  - (b.2.8.305) Added pre-renderAll red banner — not seen, suggesting renderAll runs fast and clears it, or JS runs but produces no visible content
  - (b.2.8.307) Added PERMANENT post-renderAll debug banner (only shows if waAthleteHost has 0 children after render) — awaiting result
- **Suspected root cause:** Unknown. Candidates: (a) els.athlete.value is empty/mismatched → activeRecords() returns [] → no content; (b) tab-analysis is hidden (switchTopTab called with wrong name); (c) CSS issue making content invisible. Debug banner will tell us.
- **Data status:** ud.csv has 12618 rows — data is bundled and correct.
- **RESOLVED (b.2.8.309):** Not a code bug. Debug banner at v.308 confirmed `records=12576, viewMode=admin, tabVisible=true, chips=1` — page renders correctly. Root cause was **stale browser cache** serving v.304 on the user's phone. Hard-refresh resolved it.
