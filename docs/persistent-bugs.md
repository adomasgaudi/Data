# Persistent bugs (recurring — learn from these)

## PB-55 — Add-set tag dropdown opens as an unusable sliver (a CSS MASK clips a position:fixed popup)

- **First seen / reported:** 2026-06-26, mobile (Brave, Android, b.2.9.302), Add set — Handstand Push Ups. Owner: "cannot use the ROM tag — it opens but it's hidden in the CSS, I can only see a small section of it." Screenshot showed the ROM dim dropdown open but clipped to the row's height (only the legend line visible, the option rows cut off).
- **Why it's the recurring "floating menu clipped/escapes" class (PB-10 / PB-17 lineage):** the add-set tag rows (`.addm-line-vars`) scroll horizontally and carry a right-edge fade `-webkit-mask-image` / `mask-image` (added UI-53/PB-49 so the last chip clears the swipe cue). The dim pills' dropdowns live INSIDE that row. Even though the dropdown is `placeXddFixed`'d to `position:fixed` (which escapes ancestor `overflow`), a CSS **mask clips the element's ENTIRE descendant subtree to its box — including fixed-position children** (Chromium). The popup, placed BELOW the row, falls outside the masked box → sliced to the strip that overlaps the row. So `overflow` was handled (fixed escapes it) but the MASK was the hidden second clipper.
- **Fix attempt 1 (b.2.9.303, UI-56) — INSUFFICIENT:** disabled the `.addm-line-vars` fade-mask while open + broadened the fixed-popup trigger to `.wo-af-dimpill`. Still clipped — so the mask was not the (only) clipper.
- **Diagnostic (b.2.9.304, UI-57):** rather than guess a 3rd time (rule 54), added a temporary on-screen banner reporting the open menu's real state. It returned: `dim=rom pos=fixed top=317 h=484 fixHit=true inDdw=true clip=addm-card`. So the menu WAS `position:fixed` at full height with the row-mask already off — and the true clipper was **`.addm-card`** (the modal card, `overflow: hidden auto`), one level above the row.
- **ROOT FIX (b.2.9.305, UI-58):** extended the same open/close `.dd-open-within` toggle to ALSO drop `.addm-card`'s overflow clip (`overflow: visible`) while a dropdown opened from inside it is showing; `close()` restores it. Removed the diagnostic banner.
- **Watch / lesson:** in THIS modal a `position:fixed` popup is NOT immune to an ancestor's `overflow`/`mask` clip — so when a popup is sliced, check EVERY clipping ancestor up to `<body>` (overflow, mask, filter, transform, clip-path, contain), not just the nearest one. The cheapest way to find the real clipper is the on-screen diagnostic (instrument, don't guess). Fix by disabling the clip on the offending ancestor while open, or portal the menu to `<body>`.
- **Recurrences:** 1 (new CSS variant of the PB-10/PB-17 floating-menu-clipping class; took a diagnostic to pin the right ancestor).

## PB-54 — Unilateral set: the EDIT menu drops the second side (add ≠ edit)

- **First seen / reported:** recurring; latest 2026-06-25, mobile (Brave, Android, b.2.9.295), Edit set — One Arm Dumbbell Preacher Curl. Owner #persistent: the ADD menu shows the two-sided unilateral layout (`R 9×10 · L W×reps`) but the EDIT menu shows only ONE pair (`8×8`) — you can't see or edit the left side. "the add and edit menus should be made from the same base component, single source, why are they different?"
- **Why it keeps recurring (the repeated-failure analysis):** the add and edit set menus LOOK unified (both open `openAddModal`), but they were only sharing the SHELL — the behaviour forked through mode conditionals and two save paths:
  - **Reveal forked:** `syncAddmReal` computed `const uni = isUni(ex) && !form.dataset.editsid` — explicitly hiding the left-side inputs in edit mode (a leftover from when unilateral sets were edited via the old per-side table editor).
  - **Save forked:** ADD ran `onInlineAddGo` (which read the left inputs + stored a per-side divergence via `setSideDivergence` + set the weaker side as the base); EDIT branched to `applySetEdit`, which never touched the sides at all.
  So every time the modal was "unified" again, these two `editsid`-gated forks survived and the second side silently vanished on edit. The root is rule 65: a SHARED shell with mode-conditional internals is still two components.
- **Fix (b.2.9.296, PB-54):** extracted the side maths into ONE pure function `resolveSides(rW,rR,lW,lR)` in `unilateral.ts` (returns the divergence to store + the weaker-side base); `applyUnilateralSides` wraps it with persistence. BOTH paths now call it: `syncAddmReal` reveals the sides in add AND edit (dropped the `editsid` gate); `openAddModal`'s edit branch prefills both sides from `sideValues`; `applySetEdit` reads the left inputs and stores the divergence through the same helper. Pure-function tests lock the behaviour (`unilateral.test.ts`), and a Stop-hook guard (`scripts/rules-check.cjs`) flags any re-introduction of `isUni(...) && !…editsid` or an `applyUnilateralSides` that stops calling `resolveSides`.
- **Watch:** any future "edit ≠ add" for a set attribute is THIS class — search for `dataset.editsid` / `isEdit` conditionals that hide or skip a field, and route the logic through one shared (ideally pure) function instead. A shared shell is not a shared component.
- **Recurrences:** 3+ (the unilateral edit/add divergence has been reported and patched multiple times; this is the first ROOT fix — one shared resolver + a hook, not another mode-patch).

---

## PB-53 — Add-set: the WHOLE modal card spills off the right edge (out-of-bounds, the real root)

- **First seen / reported:** 2026-06-24, mobile (b.2.9.280), Add set — Handstand Push Ups. Owner #persistent: "still out of bounds" — and crucially "the width may vary, the fix has to be for ALL sizes". The previous fixes (PB-49, PB-52) targeted INNER rows, but the whole card (NOTE field, SUGGESTED row, the blue Add button — all `width:100%` of the card) ran off the right edge, proving the CARD ITSELF was wider than the viewport, not just one row.
- **Family:** the recurring add-modal "out of bounds" class (PB-24, PB-48, PB-49, PB-52) — recurrence **4** for the class. This is the ROOT the inner-row fixes kept missing: rubric line 1 (`docs/ui-rubric.md`) — *nothing may exceed the viewport; the cap belongs on the CONTAINER*.
- **Root cause:** `.addm-card` had `max-width: min(30rem, 100vw)` while sitting in `.addm-overlay` (a `display:flex; justify-content:center; padding:1rem` box). The overlay's content box is `100vw − 2rem`, but the card's `100vw` cap let it grow to a FULL `100vw` — 1rem wider than the available space on EACH side — so it spilled off both edges. The card's own `overflow-x:hidden` clips its CHILDREN but does nothing about the card overflowing its OVERLAY. The PB-24 comment literally said "100vw−gutter" but the code used a bare `100vw` — the `− gutter` was never in the value. Because the card was over-wide, every `width:100%` descendant inherited the over-wide width too.
- **Fix (b.2.9.281, UI-44):** `max-width: min(30rem, calc(100vw - 2rem))` — gutter-aware, viewport-relative, NO fixed px so it holds at every screen size (owner's "all sizes" requirement). Plus `min-width: 0` added to `.addm-lines` and `.addm-line` (belt-and-suspenders down the flex chain, per rubric line 1) so no unshrinkable child can force width either. Comments PB-53 at the fix site.
- **Watch:** before treating an add-modal "out of bounds" as an INNER-row bug, FIRST check whether the whole card overflows (does the NOTE / SUGGESTED / Add button also run off?). If yes, it's the CONTAINER cap, not a row — fix `.addm-card` max-width against the gutter, not the row. Any container capped to the viewport MUST subtract the overlay padding (`calc(100vw - 2rem)`), never a bare `100vw`. Score every UI change against `docs/ui-rubric.md` line 1.
- **Recurrences:** 4 (class: PB-24 → PB-48 → PB-49 → PB-52 → PB-53; this is the first CONTAINER-level fix — the prior four all patched inner rows).

---

## PB-52 — Add-set: the set line's tag block overflows the card, clipping the weight boxes

- **First seen / reported:** 2026-06-24, mobile (Brave, Android, b.2.9.278), Add set — Handstand Push Ups. Owner #persistent: "css going out of bounds again" — the set line's right-hand boxes (weight / reps) are cut off at the modal's right edge.
- **Family:** the recurring add-modal "out of bounds" class (PB-24 card overflow, PB-49 palette clip). Here the culprit is the per-set TAG block (`.addm-line-vars`), which carried 5 wide tags for handstands (support / height / ROM / fwd-lean / multiplier).
- **Root cause:** `.addm-line` is a nowrap row of `.addm-line-vars` (the tags) + `.addm-line-main` (the fixed ~8.8rem weight/reps/✕ group). The tag block was `flex-wrap: wrap` (PB-48), so its one-line content (~17rem) plus the weight group (~8.8rem) ≈ 26rem exceeded the ~20rem phone card; the wrap-block didn't reflow enough and the weight group was pushed past the card's right edge, which `.addm-card { overflow-x: hidden }` then clipped. A wrapped multi-row tag block ALSO violates rule #cram ("many pills → ONE horizontally-scrolling row, NEVER a wrapped multi-row block").
- **Fix (b.2.9.279, UI-42):** `.addm-line-vars` becomes a contained horizontal SCROLL row — `flex-wrap: nowrap; overflow-x: auto` with a right-edge mask fade (the same "swipe for more" affordance as the tag palette / PB-49), keeping `flex: 0 1 auto; min-width: 0` so the block still HUGS its tags (weight right after them) when few fit, but shrinks and scrolls instead of shoving the weight off when there are many. Comment PB-52 at the fix site.
- **Watch:** any side-by-side "tags + fixed control" row in the add modal must let the tag side SCROLL (basis hug + min-width:0 + overflow-x), never wrap, or the fixed control gets clipped by the card's overflow:hidden. If it recurs, confirm the build stamp in the modal header (`.addm-ver`), then check whether the tag block is actually shrinking (its scrollWidth > clientWidth) — if the weight group is still clipped, the tag block isn't getting `min-width:0`/shrink, so pin it to `flex: 1 1 0` (fill the space after the weight) as the bulletproof fallback.
- **Recurrences:** 0 (first report for the set-LINE; class-sibling of PB-24 / PB-49 in the out-of-bounds family).

---

## PB-51 — Strength-line "best:" window pill does nothing (config never reaches the active chart)

- **First seen / reported:** 2026-06-24, mobile (Brave, Android, b.2.9.276, `?u=dzuljeta`, Hip Thrust). Owner #persistent: with the Options → Strength "best: 1d" pill selected, the Strength line stays FLAT (long plateaus, never drops) instead of jumping per training day. The feature (CHART-216, b.2.9.275) had in fact never worked.
- **Root cause:** the window is stored on `waGraphConfig.strengthWindow`, set in only two places — `renderGraphSlideChart` (the dormant carousel) and the legacy `renderWaGraph` fallback AFTER its `if (useGraphDashboard) { … return; }` early-return. Both are DEAD in normal operation (the active path is the per-bubble dashboard). So when `buildBubbleInput` spreads `...waGraphConfig` to build the chart's config, `strengthWindow` is `undefined` → `windowedMax` falls back to all-time `runningMax` → the line never drops. Same class as the formula handling, which is why `formula` is set DIRECTLY in the `buildBubbleInput` clone and worked — the window was just never given the same treatment.
- **Fix (b.2.9.277, CHART-217):** set `strengthWindow: currentStrengthWindow().ms` directly in the `buildBubbleInput` cfg clone (the choke point that actually feeds the active dashboard chart), exactly like `formula`. No longer depends on a dead path having stamped `waGraphConfig`. Comment `PB-51` at the fix site.
- **Watch:** a graph Option that "does nothing" is almost always this class — the knob writes a value that the ACTIVE render path never reads because it's stamped on `waGraphConfig` by a dead/dormant path (carousel or legacy fallback). The dashboard's `buildBubbleInput` cfg clone is the single source of truth for what the chart draws; any new per-render Option must be set THERE (like `formula`/`strengthWindow`), not merely on `waGraphConfig`. If it recurs, `dbg()` the `cfg.strengthWindow` value inside buildBubbleInput and confirm the build stamp (stale cache).
- **Recurrences:** 0 (first report; the v.275 feature shipped broken — never functioned on the dashboard path).

---

## PB-50 — Page jumps around while it loads/syncs on open (scroll-restore fights the user)

- **First seen / reported:** 2026-06-22, mobile (coloseum.netlify.app, opening via a `?u=` link). Owner #persistent #debug: "it still loads on first open and then jumps; if I try to scroll away while it's loading/synchronising it jumps around." First fix attempt (NAV-71, b.2.9.261) staged the three *background* syncs (GitHub CSV / Supabase manual sets / KV merge) behind a refresh bar so they no longer auto-rebuild or reload — but it still jumped.
- **Root cause (the part NAV-71 missed):** the jump isn't only the background rebuilds — it's the **scroll-preserve idiom itself**. ~20 render paths (`deferRender`, the graph re-plot pin, set-edit rebuilds, …) do `const y = scrollY; …render…; window.scrollTo(0, y)` on a rAF to keep your place across a rebuild. During the heavy first render / async chart reflow, one of these fires *while you are actively scrolling* and `scrollTo(0, y)` yanks you back to the captured position → the "jumps around when I scroll while it's loading" report. The browser's own `history.scrollRestoration` (default `auto`) re-applying a remembered position after the async app finishes building is a second, smaller source.
- **Fix (b.2.9.263, NAV-72):** never fight an active user scroll. A real scroll gesture (`wheel`/`touchstart`/`touchmove`, capture+passive) stamps `lastUserScrollAt`; a new `restoreScrollY(y)` skips the `scrollTo` when the user scrolled within the last 600ms, and EVERY `window.scrollTo(0, y|sy)` restore now routes through it (so no render path can yank a live scroll). Also set `history.scrollRestoration = "manual"` so the browser doesn't re-apply a remembered scroll after the build. Interactive edits (tap → rebuild) are unaffected — the user isn't scrolling then, so the restore still runs.
- **Watch:** the scroll-preserve pattern is correct for a tap-triggered rebuild but WRONG during load/async reflow — it must always yield to a live gesture. If a jump recurs, instrument with `dbg()` at each render path's restore and confirm whether `restoreScrollY` is being skipped as intended; check the build stamp first (a stale Netlify cache can serve old JS). If the FIRST paint itself is slow/heavy (separate from the scroll-yank), that's the next lever — chunk/lazy-render the initial view.
- **Recurrences:** 1 (NAV-71 refresh-bar staging didn't cover the scroll-restore fight; NAV-72 is the root fix).

---

## PB-49 — Add-set TAG palette row reads as "out of bounds" (a chip clipped flush at the right edge)

- **First seen / reported:** 2026-06-19, mobile (Brave, Android, b.2.9.256), Add set — HS-Push Up. Owner #persistent: "css is going out of bounds fix" — the top TAGS palette row (`✓ SUPPORT · + SHOULDER GAP · + FOREARM SUPPORT · + TEM…`) shows its last chip sliced off at the right edge with no scroll cue.
- **Class, not a true overflow:** sibling of PB-24 (add-set popup horizontal overflow). The palette `.addm-passive` is INTENTIONALLY a `flex-wrap:nowrap; overflow-x:auto` scroll row (rule #cram: many tags → ONE horizontally-scrolling row, never a wrapped block), contained by `.addm-card`'s `overflow-x:hidden` + viewport cap (the PB-24 hardening). So nothing actually escapes the card — but a chip clipped HARD at the row's right edge, with no fade / trailing room, reads as broken / out-of-bounds.
- **Root cause (perception, not geometry):** a horizontal scroll row with no "swipe for more" affordance looks like a layout bug. There was no trailing padding and no edge fade, so the cut chip butted the row edge.
- **Fix (b.2.9.257, UI-35):** `.addm-passive` gains `padding-right: 0.6rem` (trailing room at scroll-end) + a right-edge `mask-image: linear-gradient(to right, #000 calc(100% - 1.1rem), transparent)` so the last visible chip fades into a clear scroll cue instead of a hard cut. The mask sits on the element's border box, so it always marks the right VISIBLE edge regardless of scroll position. Comment `PB-49` at the fix site.
- **Watch:** before treating an add-modal "out of bounds" as a layout bug, confirm whether the element is a deliberate scroll row (rule #cram) — if so the fix is a scroll AFFORDANCE (fade + trailing pad), not wrapping or shrinking. A hard-clipped chip with no fade is the tell. If it recurs, FIRST read the `.addm-ver` build stamp in the screenshot (here b.2.9.256) — a stale cache was PB-24's real root.
- **Recurrences:** 0 (first report for this element; class-sibling of PB-24 / the out-of-bounds family).

---

## PB-48 — Add-set: gray "NONE" tags leak next to the weight + tags sit ABOVE the weight

- **First seen / reported:** 2026-06-19, mobile (Brave, Android, coloseum.netlify.app b.2.9.247), Add set — Handstand kicks. Owner #persistent (two annotated screenshots): (1) "the tags are still ABOVE the weight — they should always be on the LEFT of the weight; if more tags than fit, they WRAP but stay left of the weight." (2) "I'm seeing all kinds of tags that are NOT selected in the menu above — if not selected most should be PASSIVE; I should not see any gray tag unless I select it at the top. If I switch OFF forearm support I STILL see the tag next to the weight." Recurrence **2** (WO-253 b.2.9.240, WO-254 b.2.9.243 both tried to hide the gray tags and did NOT hold on device).
- **The recurrence (two failed hide attempts):** WO-253 wrapped each dim in an `.addm-vtag` column and hid a passive one with `setEnhancedSelectHidden` on the xdd TWIN — which RACED the async enhancement (twin didn't exist yet) → leaked. WO-254 moved the hide to a class on the WRAPPER (`.addm-vtag--off`, toggled in `syncAddmVtags` via `!active && gray`). On paper correct, but STILL leaked on device. Differential clue: in the screenshot the ACTIVE tag (b2w) was COLOURED (`is-set`, set DIRECTLY on the select) while the passive grays stayed VISIBLE — i.e. the same loop's `sel.classList.toggle("is-set")` worked but `sel.closest(".addm-vtag").classList.toggle("addm-vtag--off")` did not hide. So the wrapper-hide (whatever the exact cause — closest/enhancement/timing) was the fragile link, twice.
- **Root cause (the design flaw, not the symptom):** passive tags were RENDERED into the DOM and then HIDDEN. Any hide step (enhancement race, `.closest`, CSS, re-render) that fails leaves the gray tag visible — an entire CLASS of leak that two patches couldn't close. The bug was *possible* because the passive pills existed at all.
- **Fix (b.2.9.248, PB-48):** make the bad state UNREPRESENTABLE — render ONLY the tags that should SHOW, so a passive tag is never in the DOM and CAN'T leak. `variantSelectsHtml`'s ADD path now `.filter`s dims to `tagActive(...)` (the SAME SSOT the palette ✓/＋ uses) and builds each via a new extracted `dimVtagHtml`; the palette ＋/✓ handler INSERTS / REMOVES that one pill on promote/demote (no full rebuild, other picks survive); the add-modal EDIT path inserts any dim the set CARRIES at a non-default level so editing still shows it. `syncAddmVtags` drops the hide entirely (keeps only the `is-set` colour). The EDIT-arg call (legacy `scaleEditPop`) still renders every dim so you can add any variation there. Removed dead `.addm-vtag--off` CSS. LAYOUT: `.addm-line` → `flex-wrap: nowrap` so the tag block (`flex:1 1 auto, min-width:0`) wraps WITHIN itself on the left and the weight group (`flex:0 0 auto`) stays on the right — never drops below the tags. Comment `PB-48` at every fix site.
- **Watch:** the lesson is "don't render-then-hide a thing that must not appear" — if visibility has a hard rule (passive ⇒ never shown), gate it at RENDER (don't emit the element), not with a post-hoc hide that any race/selector/CSS quirk can defeat. When a hide "should work" but doesn't on device twice, stop patching the hide and remove the element from the DOM instead.
- **Recurrences:** 2 (WO-253 twin-hide, WO-254 wrapper-class-hide; this is the render-only-active root fix).
- **Follow-up (b.2.9.249, WO-259):** (a) render-only-active exposed that you couldn't DESELECT a tag whose default was meaningful (b2w force-activated it) — reworked `tagActive` to a per-exercise shown/hidden override gated on `famHasGrayLevel` (deselectable iff it has an obvious baseline; a no-baseline tag is locked-on). (b) the `nowrap` layout pinned the weight to the far-right edge ("css too far right", sibling of PB-24) — `.addm-line-vars` flex `1 1 auto`→`0 1 auto` + dropped `.addm-line-main` `margin-left:auto` so the weight follows the tags. Open: a hidden meaningful tag still records the family default, not the obvious baseline (owner to confirm).

---

## PB-46 — Editing a set opens the OLD pills-only popover, not the full add menu

- **First seen / reported:** recurring across many sessions; owner #persistent #debug 2026-06-19 (Handstand kicks, collapsed set → ✎). "Editing a set should open the SAME full menu as adding — weight, reps, note, tags, cog, proper CSS — not the old variation-pills popover with old CSS."
- **The recurrence:** the unify-edit-into-add work was done PARTIALLY several times (the inline set-edit CARD got the same select picker; the set-action menu got an `edit` action that opened openAddModal). But it never fully landed: in the set-action menu the PENCIL (✎) was wired to `act:"variant"` → `openVariantFromAttrs` → `openScaleEditor` (the OLD `#scaleEditPop` pills popover), while the `edit` action sat on the ⚙ icon AND only prefilled weight/reps (no tags) AND created a NEW set on save instead of editing. So the owner kept tapping the pencil and getting the old menu.
- **Root cause:** two parallel editors (old scaleEditor popover + new add modal) and the edit ENTRY POINT (the ✎) still pointed at the old one; the new path was incomplete (no tag prefill, no in-place save).
- **Fix (b.2.9.231, WO-252):** ONE editor. The set-action ✎ now opens openAddModal in a real EDIT mode (`edit: {sid, note, rawNote}`). It prefills the set's note + every variation tag (from `{...rNote(fam,note).vec, ...noteVecOverride}`), incline (setOverrides[sid].levelDim/Value), ROM (setOverrides[sid].rom) and RIR; relabels Add→Save; drops +set/Suggested; and onInlineAddGo branches to `applySetEdit(form)` which UPDATES the set's per-set overrides in place (setSetOverrideField/Note, setNoteVecDim on the set's note key, setSetOverrideLevel, setSetRom, setRpe) instead of creating entries. The old `variant`/scaleEditor path is removed from the set menu.
- **Watch:** when "unifying" two UIs, the recurrence comes from leaving the OLD one reachable from the primary entry point. Repoint the entry (the ✎) AND make the new path complete (prefill ALL fields + save back), or the owner lands on the old one again. The add path's per-set setters are the SSOT — the edit path must reuse them with the existing id, never a parallel write.
- **Recurrences:** several partial attempts before this full landing.

---

## PB-45 — Workout history re-sorts (jumps) when you delete a set in an expanded day

- **First seen / reported:** 2026-06-18, mobile, Athlete → Workouts, day expanded. Owner: "if I delete a set the exercises (sorted by most sets) reshuffle and another jumps to the top; it should wait until I close the expanded view, then resort." Recurrence 1 (the b.2.9.220 fix did not hold).
- **Failed fix (b.2.9.220, WO-246):** added `woSortFreeze` + `applyWoSortFreeze`, but only INSIDE the `if (woSortMode !== "logged")` branch of `renderWorkoutsPage`. The day view's exercise order actually comes from `workoutsForUser` (aggregate.ts) which sorts by **set COUNT** as the BASE order, and the DEFAULT `woSortMode` is `"logged"` (no re-sort) — so the freeze code path never ran for the case that jumps. Classic "fixed the branch I was looking at, not the one that renders."
- **Root cause:** the exercise reorder is the set-COUNT sort in `workoutsForUser`; deleting a set drops a count and reshuffles, and that base order flows straight through `buildWorkoutGroups` → render regardless of `woSortMode`.
- **Fix (b.2.9.221, WO-247):** apply `applyWoSortFreeze` to EVERY group's exercises AFTER the optional metric sort AND for the `logged` default (so the count-order base is frozen too). Re-sort only on sparse events: a freeze-key change (athlete/sort/view), `clearWorkoutSortFreeze()` on page change (`showSubtab`) / data refresh, and now on CLOSING an expanded day (`toggleCollapse` true → clear + `deferRender(renderWorkoutsPage)`) — exactly the owner's "wait until I close, then resort". Added on-screen `dbg()` traces (`WO sort …`, `WO freeze SEED/HOLD …`, `WO collapse → …`) so a green-console screenshot confirms the freeze holds across a delete.
- **Watch:** when freezing/curating a rendered ORDER, freeze it at the point the order is FINALISED for render (the last sort before paint), not in one optional branch — there were TWO sort stages (base count-sort in workoutsForUser + the woSortMode re-sort). Confirm the DEFAULT mode path is covered, not just the configurable one.
- **Recurrences:** 1.

---

## PB-43 — Add-set weight/reps box: the never-ending restyle (escalation war)

- **First seen / reported:** styled & re-styled across 2026-06-16…18, mobile (Add-exercise / + set sheet). The owner kept screenshotting the weight/reps entry asking for a different look; `#super-persistent` invoked 2026-06-18.
- **The war (6 rewrites of the SAME ~10 lines of `.addm-set-chip` CSS in ~2 days):** WO-223 `add-sheet-chip-style-inputs` (b.2.9.167) → WO-225 `add-set-outlined-inputs` (169) → WO-235 `reads-like-the-final-chip` (183) → **WO-238 `add-set-plain-text-inputs`** (189, owner: "remove the input look altogether, let me just edit text" → box deleted) → **UI-26 `add-set-weight-field-visible-box`** (208, owner: "it's invisible" → box re-added) → UI-27 `add-set-weight-box-visible` (210). It ping-ponged between two OPPOSITE complaints: "looks like an input (bad)" ↔ "I can't see/find it (bad)".
- **Root cause (TWO, both process not pixels):** (1) **No single design reconciled both poles**, so each AI patched the latest screenshot and over-corrected to the other extreme. (2) **STALE DEVICE CACHE** — the single-file build is browser-cached; the owner's screenshots showed a state (wide box, ~100px dead margin) that was ALREADY changed on the live build (b.2.9.210 was compact), so AIs "fixed" a box that no longer existed. The header version chip is OUTSIDE the modal, so a modal screenshot never revealed which build it was.
- **Fix (b.2.9.211, UI-28):** ONE reconciling design that answers both complaints at once — TWO small **slightly-shaded** boxes (visible → findable, fixes "invisible") that **don't look like input bars** and **hug their text** (≤9px pad, fit-content, fixes "too wide"), with **W / reps** as the default placeholder labels and the reps raised like the collapsed `65⁵`, a clear gap so each is easy to tap, tap-to-edit accent ring. PLUS a permanent diagnostic: the loaded build is stamped into the modal header (`.addm-ver`) so every future modal screenshot self-identifies its version — kills the stale-cache ambiguity that fed the war.
- **Watch:** before re-styling this element AGAIN, (a) confirm the owner is on the latest build (read the `.addm-ver` stamp in their screenshot — if it's behind, the answer is HARD-REFRESH, not new CSS); (b) one AI owns this element at a time (it's a hot `#co-work` file); (c) a request that contradicts the last "fix" means the design didn't reconcile — find the form that satisfies BOTH, don't bounce to the opposite extreme.
- **Recurrences:** 5 (six total restylings of the same rule).

---

## PB-44 — History tab settings/selection keep RESETTING TO EMPTY (not cached to Supabase)

- **First seen / reported:** 2026-06-18, mobile (Brave, Android), Analysis → History fold. Owner #super-persistent #max-debug #?: "the history tab settings and selections are not cached and saved to supabase, keeps resetting to empty." Screenshot: the History WORKOUTS section shows "Select an exercise" / "No workouts for this athlete" while the graph above is full of data — i.e. the saved history selection (`waSelected` / the active tab's `lensFilter`) came back EMPTY.
- **Prior fix attempts (didn't fully hold):** DASH-1 (b.2.9.178) made the Zod load LOSSLESS (`.catch()` per field so a drifted dashboard is repaired, not wiped). DASH-2 (b.2.9.182) moved the outgoing-athlete save to `renderAthlete` BEFORE the `waSelected` reset and removed the snapshot-and-save from `ensureHistoryTabApplied`. The reset still recurs.
- **Suspected candidates (mapped, NOT yet confirmed — instrument first):**
  1. **`analysisSeeded`-gated default-fill (main.ts ~20593):** `if (waSelected.length === 0) waSelected = defaultHistorySelection()` only runs on the FIRST `renderWorkoutAnalysis` of a session (`if (!analysisSeeded)`). After that an empty `waSelected` is NEVER re-filled — and `saveActiveHistoryTab()` runs at the end of EVERY history render (incl. `renderWorkoutsPage` line ~8333), so an empty selection gets PERSISTED. Empty is a *valid* state (owner can clear all), so the question is what empties it without the owner clearing.
  2. **Cloud merge wipes it (`pullMergeKv` / `merge3Json`):** `colosseum.historyDash.v2` is syncable ('user'). If an empty selection was saved locally then synced, a later 3-way merge where base had lifts but both local+remote are empty resolves to empty across all devices. `pullMergeKv` reloads on any local change, so a sync that shrinks the dashboard wipes the view on reload.
  3. **Save/reset race on athlete switch:** `renderAthlete` resets `waSelected` then renders; a `saveActiveHistoryTab` firing before `ensureHistoryTabApplied` re-applies the incoming athlete's tab could persist the reset default.
- **Diagnostic added (b.2.9.x, DASH-3):** permanent on-screen `dbg()` lines (admin Settings ⚙ → 🐞 Debug console). `HD ensure` (loaded?/tabs/active lens len on athlete-change), `HD apply` (lens len written to `waSelected`), `HD render` (seeded?/waSel len every analysis render), `HD save` (lens+waSel len on every save — RED when it saves EMPTY), `HD sync` (base/local/cloud/merged JSON lengths for the historyDash key — RED when the cloud merge SHRINKS the local value). The sequence in one screenshot localises which step empties it. Remove once root confirmed.
- **Watch:** an empty selection that round-trips through save→sync→load is indistinguishable from an intentional "clear all"; the fix must tell the two apart (e.g. never auto-persist an empty selection that wasn't an explicit clear, or re-seed the default whenever the active selection is empty rather than only once per session).
- **Recurrences:** 2+ (DASH-1, DASH-2 prior; this is the standing reset).

---

## PB-42 — Add-set sheet: variant pills not inline with weight/reps

- **First seen / reported:** 2026-06-18, mobile, History → + set on a variation lift. Owner: "the variants should be before the weight and reps in the same line" → then "still not inline #persistent" (the first fix did not hold).
- **Root cause (two compounding things):** (1) In `.addm-setblock` the variant pills lived inside wrapper boxes (`.addm-variant-slot` → `.wo-af-dims`) that were themselves flex containers, so the whole pill group counted as ONE wide flex item and wrapped the weight/reps `.addm-lines` chip onto the row below it. (2) A leftover equal-specificity rule `.wo-addform .wo-af-dims { display: flex; … }` sat AFTER the v.172 attempt's flatten rule, so by CSS source-order it won and re-boxed the dims back into a single item.
- **Failed fix (b.2.9.172, WO-228):** wrapped the pills + weight/reps in one flex-wrap `.addm-setblock` and made `.addm-variant-slot` `inline-flex` — but the inner `.wo-af-dims` was still a flex box, so the group stayed one wide item and still wrapped. The conflicting `display:flex` rule made it worse.
- **Fix (b.2.9.173, WO-229):** gave BOTH `.addm-variant-slot` and `.wo-af-dims` `display: contents` so their wrapper boxes dissolve and each individual pill joins the `.addm-setblock` flex flow directly, sitting right before the `.addm-lines` weight/reps chip; and DELETED the conflicting `display:flex` base rule (kept only the pill/select styling). Empty slot still `display:none` via `:empty` (higher specificity, wins over the contents rule).
- **Watch:** `display:contents` is the right tool to flatten a wrapper into its grandparent's flex/grid, but it is silently re-boxed by ANY later equal-specificity `display:` rule on the same selector — grep for every `display:` on the selector and ensure the flatten is the LAST word (or higher specificity). `max-width`/`padding` on a `display:contents` element are ignored, so leftover sizing rules on it are dead but harmless.
- **Recurrences:** 1 (v.172 attempt failed → v.173).

---

## PB-41 — "Compare other athletes" button missing from the graph

- **First seen / reported:** 2026-06-17, mobile, Analysis → Graph. Owner: "i don't see the comparison btn to compare with other users #persistent."
- **Root cause:** the "Compare" toggle (`data-wacompare` → reveal the other-athlete pill row + overlay them) was only rendered in the LEGACY full-graph path (`renderWaGraph`'s `graphBarHtml`), which went DORMANT when `useGraphDashboard = true` replaced it with the bubble dashboard (`renderGraphDashboard`). The dashboard's foot only had the bubbles + Options, so the button vanished — and even its DATA path was single-athlete (`buildBubbleInput` filtered records to `r.username === user`).
- **Fix (b.2.9.114, CHART-198):** re-added a `compareBtn` to the dashboard foot beside Options (owner: "next to options just like before"), plus the `graphAthletesPillsHtml()` row above the foot when open. Wired the DATA too: `buildBubbleInput` now uses `athletes = waCompareOpen ? graphAthleteList() : [user]`, filters records to all of them, shrinks the exercise cap so users×lifts ≤ WA_GRAPH_MAX, and passes `users / userLabelOf / bodyweightOf` so each series scales to its own athlete.
- **Watch:** when a feature is REBUILT on a new render path (the bubble dashboard), audit the OLD path's controls — anything only in the dormant branch silently disappears. Grep the dormant code for buttons/handlers the new path forgot.
- **Recurrences:** 0 as PB-41 (the compare feature itself existed before; it was dropped, not broken).

---

## PB-40 — Strength projection doesn't fit the points (floats below the data) / not smooth

- **First seen / reported:** 2026-06-17, mobile (Brave, Android), Analysis → Graph → Predicted Strength (Hip Thrust). Owner #super-persistent #max-debug: "projection is broken. the graph doesnt fit points and is not smooth. remember hard limit is the world record, but the steepness can be much higher it just needs to level out more aggressively too at WR." Iterated several times before (CHART-117 log fit, CHART-121 ceiling approach, CHART-122 fit window, CHART-127 carousel parity) and still wrong.
- **Root cause:** `fitCeiling` modelled `y = ceiling − e^(m·t + b)` and used BOTH the slope `m` AND the intercept `b` from a least-squares regression of `ln(ceiling − y)` on `t`. The log transform minimises error in LOG-GAP space, not real-y space, so the free intercept let the curve settle at a level that DRIFTS below the actual data — the projection floated under the points (screenshot: curve at ~20 while the data sat at ~50–100). With a narrow fit window it fit only old points and extrapolated off the recent cloud entirely.
- **Fix (b.2.9.x, PB-40):** keep the fitted SLOPE (the approach shape) but ANCHOR the level to the most recent point — `gap(t) = gapNow · e^(m·(t − tNow))`, so the curve passes through the lifter's CURRENT strength and projects forward from there, always asymptoting to (never exceeding) the ceiling = world record. Bail (→ log-fit fallback) when `m ≥ 0` (a flat/declining window can't approach the ceiling). Added `dbg('proj …')` (#max-debug) printing `ceil / cur / fit@cur / fit@end` to the on-screen console so the anchor is verifiable on device (`fit@cur` must ≈ `cur`). 2 new tests (anchors on noisy data; null on declining).
- **Watch:** a linearised exponential/log fit (regressing a transformed y) systematically misfits in real-y space — never trust its free intercept for a curve that must pass through the data; anchor the level to a real point and only fit the shape. If the owner wants the flatten EVEN more aggressive near WR, steepen the approach rate `m` (the dbg readout shows it) rather than reverting to a floating fit.
- **Recurrences:** 0 as PB-40 (but the 4th rework of the projection curve overall).

---

## PB-39 — Dashboard graph pan/zoom doesn't persist across view/tab change + refresh

- **First seen / reported:** 2026-06-17, mobile (Brave, Android), Analysis → Graph dashboard. Owner (two screenshots of a Volume bubble at different time-windows): "if i move the graph it should persist with changing views, refresh, tab change etc. #max debug #super persistent."
- **Recurrence count:** 1 (the prior CHART-171 "remember pan/zoom" fix did not hold on device).
- **Prior fix that didn't hold (b.2.9.41, CHART-171):** added `initialView` + debounced `onViewChange` to svgChart, and a per-bubble `savedView = { sig, box }` persisted per-athlete. On a fresh mount the saved box is restored only while a content SIGNATURE (type · view · ×BW · lifts · metrics · time-compaction · athlete) still matches; double-tap/Fit clears it. Owner reports it still reverts to the auto-fit.
- **Investigation (this pass):** read the whole chain — pan commits (`commitView()` → debounced `onViewChange`, svgChart.ts ~1237), the dashboard rebuilds `#gdashStage` every render so the chart always re-mounts fresh and reads `initialView` (main.ts renderGraphDashboard), the Zod schema preserves `savedView` across the localStorage round-trip, and the apply path (`view = {...initialView}` at mount, ResizeObserver only `draw()`s) is sound. By inspection the save + restore look structurally correct, so the failing link is a RUNTIME value — most likely the signature differs between save-time and restore-time (so `initialView` comes back null), or the save never fires on device.
- **Diagnostic added (b.2.9.54):** on-screen `dbg()` lines — `vSAVE box|nul sig=<hash>`, `vMOUNT have=<hash> want=<hash> init=Y|n`, and `vDIFF` on a signature mismatch.
- **ROOT (found from the console screenshots, 2026-06-17):** the logs showed `init=Y` on EVERY mount (the saved view's signature matched and `initialView` was applied) AND `vSAVE box` firing — so save/persist/restore all worked. Yet the displayed graph still reverted to the auto-fit. The cause: the view was committed on a **250ms debounce** (`commitView`), but the dashboard re-mounts the chart on incidental re-renders, and a re-mount landing inside that 250ms window mounts a FRESH chart that restores the PREVIOUS saved view (the auto-fit) before the just-finished pan ever committed. The pan was saved ~250ms too late — after a re-mount had already shown the stale view — so it never appeared to stick.
- **Fix (b.2.9.5x):** added `flushView()` in svgChart and call it from the pointer-up handler when a real pan/zoom (not a tap) ENDS — persisting the new view IMMEDIATELY on release, before any re-mount can read a stale one. The 250ms debounce stays for wheel/pinch zoom mid-gesture. (Restore via `initialView` already worked, so no change there.)
- **Fix attempt 1 that didn't fully hold (b.2.9.59):** added `flushView()` on pointer-up. Owner re-tested on the latest version: "still snaps back." So saving-on-release wasn't enough — the chart was being RE-MOUNTED during/right after the gesture, destroying the live pan before (or regardless of) the save.
- **DEEPER ROOT (b.2.9.63):** `renderGraphDashboard` rebuilt `box.innerHTML` — including a fresh `#gdashStage` — on EVERY render, so every incidental re-render destroyed the chart instance and fresh-mounted a new one, re-applying a (possibly stale) saved view and interrupting any in-progress pan. `init=Y` in the console was a red herring: restore "worked" on each mount, but the mounts themselves were the problem (re-mounting mid-interaction churns the view).
- **Real fix (b.2.9.63):** PRESERVE the `#gdashStage` element across re-renders of the SAME bubble — detach it before rebuilding the header/foot, then slot the same element back, so `analyticsGraph` runs `update()` (which keeps the chart's live pan/zoom) instead of a fresh mount. Only a real bubble SWITCH (tracked by `dashStageBubbleId`) drops the stage so a fresh mount restores that bubble's saved view; refresh still restores from localStorage. So the live view survives incidental re-renders, and cross-switch/refresh restore via `initialView`.
- **CONFIRMED ROOT (b.2.9.70, via full on-screen trace — #debug "one digit at a time"):** instrumented the whole path (renderGraphDashboard `reuse=Y/n`, analyticsGraph `MOUNT|UPDATE`, svgChart `mount`/`update`/`resetView`). Trace showed: bubble SWITCHES (`reuse=n` → fresh mount) restore `init=Y` fine, and a pan DOES save (`vSAVE box`). But a SAME-bubble re-render (`reuse=Y` → `aG UPDATE`) logged `svgc update seriesChg=Y userAdj=n` → `resetView` — `svgChart.update()` re-fit to the data on EVERY re-render. Because the dashboard rebuilds the series array each render, `seriesChanged` is ALWAYS true, and `update()` only honored `initialView` on a fresh MOUNT — on update it blindly `resetView()`'d when the user wasn't mid-pan. So the b.2.9.63 stage-reuse fix actually routed same-bubble re-renders into the one path that discarded the saved view.
- **Real fix (b.2.9.70):** `svgChart.update()` now honors the saved view on the re-fit path too — `if (seriesChanged) { if (userAdjusted) fitRight(); else if (finiteBox(initialView)) restore it; else resetView(); }` — mirroring the mount path. So "remember my view" holds across same-bubble re-renders, not only fresh mounts.
- **Watch:** a "remember my view" feature has SIX links — (1) gesture commits, (2) commit persists, (3) survives reload, (4) restore key matches, (5) don't re-mount out from under the live interaction, and (6) the UPDATE/re-render path must honor the saved view too, not only the initial mount. A "fresh data every render → seriesChanged always true → resetView" loop silently re-fits away any restored view.

---

## PB-38 — Dashboard floating-menu actions don't fire (long-press tab menu: rename/duplicate/add do nothing)

- **First seen / reported:** 2026-06-16, mobile (Brave, Android), Analysis → Graph dashboard. Owner across several msgs: "duplicate bubble doesnt do anything", then "tab rename duplicated add, dont work", "#persistent". The floating menus (tab long-press menu; earlier the bubble ⋯ menu) OPEN fine but tapping an item does nothing.
- **Root cause:** the `dashTabSuppressClick` flag. A long-press opens the menu while the finger is down and sets the flag to swallow the *release-click* (so it neither switches the tab nor closes the just-opened menu). But on mobile a long-press frequently fires **NO release-click** — so the flag stayed stuck `true`, and the capture-phase click listener swallowed the **first menu-item tap** instead. One tap = nothing happened.
- **Prior shallow fix that didn't hold (b.2.9.36):** for the BUBBLE menu I sidestepped it by replacing the ⋯ pop-menu with direct foot buttons (⧉/✕) — but left the TAB long-press menu on the same fragile flag, so it kept failing.
- **Attempt 1 that didn't hold (b.2.9.37):** reset `dashTabSuppressClick = false` on every touchstart + a 600ms auto-clear. Still broken on device — the menu opens UNDER the finger during a long-press, so the SAME continuous press releases onto a menu item with no fresh touchstart to clear the flag.
- **Attempt 2 that didn't hold (b.2.9.46):** made the capture-phase listener bail (`return`) the instant the click target is inside `#dashTabMenu`, so a menu click is never swallowed regardless of the flag. Owner: **"still cant press tab btns"** — still failing on device even with the in-menu bail. The whole long-press → swallow-the-release-click dance was too fragile on this browser.
- **Attempt 3 that didn't hold (b.2.9.47):** removed long-press, added an explicit `⋯` button. The `⋯` opened the menu fine — but its **Duplicate/Rename/Add still did nothing**. Owner: "#super-persistent #max debug !!! tabs btn not working." (All the suppress-flag work was a RED HERRING — the menu items never ran for a deeper reason.)
- **ACTUAL ROOT (found b.2.9.48 via #super-persistent + on-screen logging):** the dashboard's whole click handler is attached to **`panel`** (`panel.addEventListener("click", …)`), NOT `document`. The tab options menu is appended to **`document.body`** — OUTSIDE `panel`'s subtree. So menu-item clicks **never reached the handler**, no matter what — every prior "fix" was tweaking a handler that the click never even hit. The `⋯` button worked only because it lives INSIDE `panel`. This also explains the original bubble-`⋯`-menu failure (same body-appended menu, same panel-scoped handler).
- **Real fix (b.2.9.48):** handle the menu ACTIONS in a **document-level** click listener (which always sees body-level clicks). Removed the dead `data-tabmenu` branch from the `panel` handler. Added a temporary on-screen `dbg()` log overlay (mobile has no console) to confirm on device, to be removed once verified.
- **Watch:** a delegated click handler only sees clicks INSIDE the element it's bound to. NEVER append a floating menu/popup to `document.body` and expect a container-scoped (`panel`/section) delegated handler to catch its clicks — bind the menu's handler to `document`, or append the menu inside the handler's element. (This is the real lesson; the long-press/suppress saga was all downstream noise.)
- **Recurrences:** 4 (bubble menu → tab touchstart-reset → in-menu bail → long-press removal → **the real root: panel-scoped handler can't see a body-appended menu**).

---

## PB-37 — Can't change the graph exercise in the new dashboard (no title toolbar; edits reverted)

- **First seen / reported:** 2026-06-16, mobile (Brave, Android), Analysis → Graph (custom dashboard, CHART-160+). Owner: "i cant change the exercise #persistent #debug with error red logs on screen" then "can add but its not as it was before — no big title, no plus button, no equals button, no delete button."
- **Root cause (two compounding):** (1) The new dashboard replaced the old graph's `liftSelectionTitle` toolbar (big title + `+` add / `=` match / `✕` remove-all + the "Pick" drawer tab + each lift name a tap-to-remove button) with a plain text title — so the only affordances to add/remove/change lifts were gone. (2) The bubble↔`waGraphSel` sync MIRRORED the bubble back into `waGraphSel` on EVERY render, so even when a toolbar/picker edit changed `waGraphSel`, the next render reverted it — the change never stuck.
- **Fix (b.2.9.33):** (1) Render the real `liftSelectionTitle(waGraphSel, "graph")` in the dashboard title row — the same toolbar the old graph had. (2) Track `dashLoadedBubbleId`: a bubble's FIRST paint (id changed) LOADS its lifts into `waGraphSel`; the SAME bubble again means a toolbar/picker edit, so WRITE `waGraphSel` back to the bubble (persist) — never re-mirror over the edit. (3) On athlete change (which resets `waGraphSel` to the athlete default), null `dashLoadedBubbleId` so the dashboard RELOADS the bubble's lifts instead of writing the default over them. Removed the stale PB-36 red on-screen diagnostic banner (its area is reworked; `#waGraphFull` is now always visible in the dashboard, so the picker's hidden-parent failure can't occur).
- **Watch:** any per-bubble field projected onto a shared global (waGraphSel, waMetrics, S.wa*) needs the same load-on-switch / write-on-edit discipline, or edits get reverted. Don't re-mirror SSOT→global every render.
- **Recurrences:** 0 (first log).

---

## PB-36 — Graph exercise picker drawer opens blank/white (no chips visible)

- **First seen / reported:** 2026-06-16, mobile (Brave, Android), Analysis → Graph → tap "▦ Pick". Owner: "can't choose exercises side graph not working / side menu / out of bounds css #persistent". Saw a white rectangle on the right (~307px wide) but it was blank — no controls, no chips.
- **Root cause (confirmed partially, diagnostic in place):** `#waPickCard-graph` is a DOM child of `#waGraphFull`. When `graphFullShown=false` (carousel mode), `#waGraphFull` has the `hidden` attribute → `display:none`. CSS rule: a `position:fixed` child of a `display:none` ancestor generates NO box and is completely invisible. The `[data-titlepicker]` handler that opens the drawer never checked `graphFullShown`, so in the carousel-with-empty-selection state (where the Pick tab IS shown but `#waGraphFull` is hidden), opening the drawer produced an invisible card. A second code path — the athlete-toggle handler — called `renderSelector("graph")` without `applyPickDrawer()`, leaving the picker hidden after re-render. A PB-36 diagnostic banner is included until confirmed fixed on device.
- **Fix (b.2.9.23):** (1) `openPickDrawer("graph")` now checks `!graphFullShown` and calls `graphFullShown=true; renderWaGraph()` first (same pattern CHART-155 applied to the ⇆ switch button). (2) The athlete-toggle handler (`wa-ath-pill` click) now calls `applyPickDrawer()` after `renderSelector("graph")`. (3) On-screen PB-36 diagnostic banner shows `full.hidden`, `card.offsetHeight`, and `chips.length` at the moment the drawer opens — leave it until the fix is confirmed on owner's device.
- **Watch:** ANY code that calls `openPickDrawer("graph")` when `graphFullShown` might be false needs the same guard. ANY standalone `renderSelector("graph")` call (outside `renderWorkoutAnalysis`) needs `applyPickDrawer()` afterward. See CHART-155 (the ⇆ switch path) for the established pattern.
- **Recurrences:** 0 (first log).

---

Bugs that came back after being "fixed". Logged via the **`#persistent`** command
(CLAUDE.md). Each is a standing reminder to fix the ROOT, not the symptom — and a
record so the next AI doesn't repeat the same shallow patch.

For every entry note: the **device + browser** it was seen on (persistent bugs are
often device-specific — a fix that holds on one engine can fail on another), the
symptom, every prior fix that DIDN'T hold, the suspected root cause, and a
recurrence count. Leave a `PB-n` comment at the fix site.

---

## PB-36 — "Can't add variations" for a lift that has no variation MODEL (only the generic ROM% shows)

- **First seen / reported:** 2026-06-16, mobile (Brave, coloseum.netlify.app), the "Add exercise" / "Add set" popup. Owner: "cant add variations for hs wall tap (and hspu) #persistent" (screenshot: the popup for a handstand lift showing only a "Range of motion 90%" picker, no Variant block).
- **Same CLASS as PB-25** ("a created exercise doesn't appear — exercise list is data-only"): adding metadata to `variationConfig.ts` alone is a silent no-op, and a lift only gets the structured Variant pickers if it has a **family** model. The difference here: the handstand skill lifts already HAD logged sets (so they appeared in pickers) but had **no family**, so the add-popup's `addmVariantField` returned "" → only the universal ROM% picker showed. There was no way to log support / ladder / yoga-block / lean as structured variations.
- **Root cause:** structured variation pickers are gated on `familyOf(ex)` being non-null (`afVariationField` → `addmVariantField`). Only HSPU/PUSHUP/PULLUP/etc. had families; `Handstand wall touch` (HS Wall Tap), `Handstand touch shoulders`, `Handstand kicks`, `Handstand hold`, `Handstand walk` and the bare `Handstand` all returned null → no pickers, just a free-text note + ROM%.
- **Fix (b.2.9.20, LIFT-95):** added a shared **`HANDSTAND`** family in `variationConfig.ts` reusing HSPU's SETUP dims (support / ladderGrip / ladderH / obstacle = yoga block S·M·L / lean / shoulderDist) but NONE of the pressing-only dims (band, rom-depth pad, low/full range, one-/two-hand). `familyOf` maps every handstand spelling to it (`n.includes("handstand")`, AFTER the `handstandpush`→HSPU check so push-ups stay HSPU). The per-set editor already renders any family generically (`hasGrid` skips the depth×lean pad when a family has no `rom`), and the quick-add form's `AF_DIM_ORDER` already lists support/obstacle/lean, so the pickers appear with no main.ts change. Comment `PB-36` at the family in `variationConfig.ts`.
- **Watch:** "I can't add variations for lift X" → X needs a **family** in `variationConfig.ts` (`EXERCISE_FAMILY` or the `familyOf` pattern). Adding only a bodyweight coeff / token / changelog line does NOT add pickers. New family dims must also be in `AF_DIM_ORDER` (support/obstacle/lean already are; ladder + shoulderDist are full-editor only, by design).
- **Recurrences:** 0 (first report; sibling of the PB-25 "metadata ≠ visible feature" class).

---

## PB-34 — Bottom search/command bar lifts up / jumps half-screen while scrolling

- **First seen / reported:** 2026-06-16, mobile (Brave, Android), Analysis → Workouts (the always-on bottom "Search exercises…" command bar). Owner: "the search bar lifts up sometimes when scrolling or sometimes unexpectedly jumps half screen height #note #debug".
- **Root cause:** `.cmd-bar` is `position: fixed; bottom: max(safe-area, var(--wa-kb-inset))` and `--wa-kb-inset` was recomputed on EVERY VisualViewport `scroll`/`resize` as `innerHeight − vv.height − vv.offsetTop` — with NO check that a field was focused. On Android the URL bar hides/shows during scroll (and overscroll-bounce moves `vv.offsetTop`), shrinking `vv.height`; that was misread as the keyboard, so the bar rode up mid-scroll — and when the spurious inset crossed the 80px `kb-open` threshold it also dropped the bottom nav, reading as a "half-screen jump".
- **Fix (b.2.8.x):** gate the inset on an actually-focused text field — `const typing = activeElement is INPUT/TEXTAREA/contentEditable; inset = typing ? max(0, …) : 0`. The keyboard cannot be open with nothing focused, so scroll-driven viewport noise now yields 0 and the bar stays pinned to the bottom; it still rides above the keyboard while you type. Added `focusin`/`focusout` listeners so it settles immediately on blur. Comment `PB-34` at the fix site (`updateKbInset`).
- **Watch:** any `position:fixed` bottom element keyed off VisualViewport height MUST gate on input focus — `innerHeight − vv.height` is NOT a clean keyboard signal on Android (URL-bar chrome moves it too).
- **Recurrences:** 0 (first report).

---

## PB-35 — Draggable graph handle invisible/ungrabbable (placed outside the plot domain)

- **First seen / reported:** 2026-06-16, mobile (Brave, Android), Analysis → Reps × kg graph. Owner: "i cant drag it and i should see an indication like the projection graph that its dragable with the small word 'fit' #persistent." The new draggable Nuzzo-fit line (CHART-143) didn't appear at all and couldn't be grabbed. Same CLASS as the floating-element-out-of-bounds family (PB-17/PB-28/PB-32).
- **Root cause:** the fit marker was placed at the curve's **1RM** x (where reps→1), but the rvw curve is only sampled across the LOGGED rep span (~5–30 reps), so its 1-rep point sits well to the RIGHT of every plotted point. The chart auto-fits its x-domain to the series data, so the marker's x was OUTSIDE the visible domain → the vertical line + handle + "fit" label rendered off the right edge (invisible, nothing to grab). A draggable marker must sit at an x the domain actually covers.
- **Fix (b.2.9.x):** anchor the handle at the curve's HEAVIEST DRAWN point (its r0-rep end, `curve[0]` — the rightmost VISIBLE point), not the off-screen 1RM. Dragging maps the new weight back to a 1RM via `nuzzo1RM(newX + bodyShare, r0)` (self-consistent: the re-fit curve's r0 point lands exactly under the finger). Colour switched to the shared teal accent `#2f8f88` (matching the projection markers / "Your lifts") and the label to a plain "fit", so it reads identically to the projection handle. Comment `PB-35` at the fit site.
- **Watch:** any draggable xMarker / handle must be positioned at an x WITHIN the chart's fitted data domain — never at an extrapolated/edge value the auto-domain won't include, or it falls off-screen.
- **Recurrences:** 0 (first report; sibling of the out-of-bounds floating-element class).

---

## PB-33 — Graph axis NAMES not visible ("I don't see the axis names")

- **First seen / reported:** 2026-06-16, mobile (Brave, Android), exercise card "1RM — fit to your lifts" graph (and the reps-vs-weight graph). Owner: "no i dont see the axis names #persistent". The axes show tick NUMBERS but nothing saying what they mean (weight kg / reps).
- **Root cause (two parts):** (1) The card graph config (`cardNuzzoConfig`) never SET `xTitle`/`yTitle`, so it had no axis names at all — even though the engine supports them and the reps-vs-weight config had set them. A fix applied to one graph but not the other = the owner still "doesn't see them". (2) Even where set, the engine rendered titles as a TINY (9.5px) muted footnote crammed into the corners — yTitle top-left over the value column, xTitle bottom-right past the last tick — right against the tick numbers in the tight 26px bottom margin, so they read as noise, not axis names.
- **Fix (b.2.8.x):** (a) `cardNuzzoConfig` now sets `xTitle:"weight (kg)"`, `yTitle:"reps"`. (b) The svgChart engine now gives axis titles their OWN room (only when set: `+16` bottom for x, `+14` left for y — title-less charts unaffected) and CENTRES them along each axis — the x-title centred under the tick row, the y-title rotated −90° up the left edge. (c) `.svgc-axistitle` bumped to 11.5px, bold, `var(--text)`, uppercase so it reads as a label. Comment `PB-33` at the margin + title-render sites.
- **Watch:** axis titles must be set on EVERY weight/reps graph config (card + analytics).
- **Recurrence 1 (b.2.8.x):** the first fix over-corrected — it gave titles their OWN reserved margin (+16px bottom, +14px left) and CENTRED them (x under the tick row, y rotated up the left). Owner: "the axis names are taking up too much space, they should be inline with the values #debug". Re-fixed: reverted to INLINE corner placement in the EXISTING tick margins (y-title top-left above the value column, x-title bottom-right after the last tick) — no reserved space — keeping only the visibility bump (dark `var(--text)`, bold, 10px; dropped the uppercase so it's narrower inline). Lesson: make a label VISIBLE by weight/contrast, not by stealing plot space.
- **Recurrences:** 1.

---

## PB-29 — Removing every lift from the graph/history leaves no placeholder + no add buttons

- **First seen / reported:** 2026-06-16, mobile (Brave, Android), Analysis → Graph/History with all lifts removed. Owner: "when I remove exercises from the history or from the graph there's no placeholder text and I cannot see the buttons to add more exercises." Tagged `#persistent #debug`. Same CLASS as PB-20 (the empty-graph prompt) — it had been "fixed" by moving the prompt INTO the title, but the fix never held because of the bug below.
- **Root cause (an early-return shadowing the empty-state code):** `liftSelectionTitle(sel, remove)` opened with `if (sel.length === 0) return "";` — bailing on EVERY empty selection. But ~80 lines lower the SAME function carefully builds the empty-state markup: the `+/✕/=` toolbar (kept "even when EMPTY"), the "Select an exercise" CTA (`emptyCta`, guarded on `sel.length === 0`), and the Pick tab. The early-out at the top short-circuited all of it, so an empty graph/history rendered an empty string — no title, no placeholder, no add buttons. The history call site even passes `liftSelectionTitle([], "hist")` EXPECTING those controls. A later fix added the empty-state markup but nobody removed the contradicting early-return — the classic "two halves of the function disagree" bug (#debug: the real value at the top contradicts the assumption at the bottom).
- **Fix (b.2.8.x):** narrowed the early-out to `if (sel.length === 0 && !remove) return "";` — only the non-removable PLAIN-TEXT title collapses when empty; the removable graph/hist titles fall through and render their `+/✕/=` tools, the "Select an exercise" placeholder, and the Pick tab. Comment `PB-29` at the fix site.
- **Watch:** when an empty-state branch "doesn't show", grep the function for an EARLY RETURN on the same emptiness condition before assuming the markup is wrong — a guard at the top silently beats the handling at the bottom.
- **Recurrences:** 0 as PB-29 (but it's the second life of PB-20's empty-graph-prompt intent — the prompt existed but was never reachable).

---

## PB-30 — High-rep sets (a 30-rep set) missing from the card's 1RM-fit graph

- **First seen / reported:** 2026-06-16, mobile (Brave, Android), exercise card (Deadlift) → "1RM — fit to your lifts" graph. Owner: "I still don't see the 22×30 dots though they are in the history." The workout history clearly held `DL 22×30`, but the graph's "Real lifts on the graph" list topped out at 20 reps (35×20) — the 30-rep sets silently vanished.
- **Root cause:** `nuzzoRepMaxes()` (metrics.ts) capped reps at `maxReps = 20` and dropped anything past it. But the Nuzzo curve itself is drawn out to ~60 reps (15% of 1RM, `repCap = 60` in `cardNuzzoConfig`), so any real set between 21–60 reps was excluded from the dots while the curve still covered that region — a silent data drop, the worst kind (the set IS in history, just not shown).
- **Fix (b.2.8.x):** raised the `nuzzoRepMaxes` cap from 20 → 60 so it matches the curve's drawn rep range; high-rep sets now plot. Comment `PB-30` + a test asserting a 30-rep set is kept (and a 75-rep one still dropped). Lesson: a render that filters data MUST use the same bounds as what it draws, or it drops points the user can see elsewhere.
- **Recurrences:** 0 (first report).

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

---

## PB-47 — Editing a set opens the OLD popover, not the modern Add-set sheet

- **First seen:** 2026-06-19, Android/Brave. Marked `#super-persistent` by the owner.
- **Recurrence count:** 2 (WO-252 / b.2.9.231 claimed to fix "edit opens the add menu" but only redirected the collapsed set-action ✎; the expanded-table set tap and the ×scale / quick-edit chips still opened the old editor).
- **Symptom:** Tapping a set in the EXPANDED set table (Workouts or Exercises tab) opens the legacy editor — a Scale× box, a plain grid of dim `<select>`s, and unilateral/not-comparable/reset/delete — instead of the modern Add-set sheet (TAGS palette, captioned pills, W/reps boxes). Owner: "the editing menu should look EXACTLY like the menu I have when I add a new set."
- **Prior fix attempts:** WO-252 rewired only `handleSetAct('edit')` (the collapsed pill's ✎) to `openAddModal` edit mode; it left `toggleSetEdit` (the set-row tap → inline `.set-edit-row` card) and `openScaleEditor` (`#scaleEditPop`, reached via the `.set-scale`/`.wo-set-variant` chips) opening the old UI.
- **Root cause:** TWO set editors coexisted. The fix patched one entry point, not the shared design flaw (more than one editor).
- **Fix (WO-255 / b.2.9.244):** Route EVERY set edit through the one modern sheet. `toggleSetEdit` now calls `openAddModal(...edit)` instead of toggling the inline card; `openScaleEditor` redirects to `openAddModal` the moment it has a `setId` (covers the ×scale + quick-edit chips). The add-modal edit mode gained a small footer (⊘ not comparable / ↺ reset / 🗑 delete) so no set-management action is lost. The old `.set-edit-row` card + `#scaleEditPop` render paths are now orphaned (left in place this pass; flagged for a follow-up prune so the deletion is isolated from this behaviour change).
