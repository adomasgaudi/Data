# Handoff — Add-set popup horizontal overflow (PB-53 recurrence 5)

**For:** the next AI (Cursor) picking this up. **From:** Opus 4.8 (Newton), opus-4.8, b.2.9.314, 2026-06-29.
**Status:** ROOT fix shipped in **b.2.9.314 (UI-64)** but **UNVERIFIED on device** — owner handed off before confirming. A temporary on-screen diagnostic is **still live** so you can verify or iterate.

## The bug
On a phone, the Add-set popup's **note input** and **Add button** render off the right edge (out of bounds).

## Ground truth (from the on-screen diagnostic, captured on the owner's device at v313)
Banner read: `vw=522 card=475 cardRight=491` — so the **card fits the viewport** (491 < 522); this is **NOT** a card-too-wide / container bug. The offenders were all \~565px inside the 475px card:
- `.addm-passive-slot w=565 overCard=105`, `.addm-passive w=559`, `.addm-passive-grp w=550`, `.addm-passive-pills w=502`, `.addm-newtag overCard=272`
- victims (stretched to match): `.addm-lines`/`.addm-line`/`.addm-sugg`/the note input/the Add button, all w=565.

## Root cause
The passive **ADD-TAG palette** is a `flex-wrap:nowrap` horizontal scroller (`.addm-passive-pills`, `overflow-x:auto`, ~565px of pills). Per the repo's own PB-24 lesson, **a flex child floors at its min-content width unless EVERY ancestor level has `min-width:0`**. `min-width:0` was present on `.addm-passive-pills` + `.addm-passive-grp` but **missing on the wrappers above them**: `.addm-passive-slot` (a direct flex child of `.wo-addform--modal`, which had *no CSS rule at all*) and `.addm-passive`. So the slot floored at 565px and — because the form is `align-items:stretch` — dragged the whole form (note + Add button included) past the 475px card, where the card's `overflow-x:hidden` clipped it ("off bounds").

## Fix applied (UI-64, b.2.9.314) — `src/styles.css`
Added `min-width:0` to `.addm-passive-slot` (new rule), `.addm-passive` (~line 3075) and `.addm-sugg` (\~line 3303), so the scroller can shrink instead of forcing the form wide.

## Prior FAILED attempt (UI-62, b.2.9.312) — do not repeat
Added `min-width:0` + `flex-wrap` to `.addm-field` / `.addm-actions` / `.wo-addform--modal` / `.wo-af-go` and the note input. These are the **victims**, not the cause — it did **not** fix it. (Harmless, left in place.)

## What's LEFT for you
1. **Verify** (the whole point — don't claim done without it). Open Add set at a ~520px-wide viewport on **b.2.9.314**. The red diagnostic banner at the top should say **"NO element exceeds the card/viewport horizontally"** with no red outlines, and the note input + Add button should sit inside the card.
2. **If it's still overflowing:** read the banner — it lists each offender's `w` (width), `overCard` (px past the card) and `overVw` (px past the viewport). Take the widest unshrinkable element and add `min-width:0` up **every** flex-ancestor level to it (PB-24 rule). The diag is the `diagAddmOverflow` function in `src/main.ts` (search it) — keep iterating fix→redeploy→re-observe.
3. **Once confirmed fixed — REMOVE the diagnostic:** delete the `diagAddmOverflow` function in `src/main.ts` AND its caller `setTimeout(() => diagAddmOverflow(wrap), 450);` inside `openAddModal` (both marked `#super-persistent PB-53 DIAG (TEMPORARY`). Then update `docs/persistent-bugs.md` PB-53 (mark recurrence 5 confirmed-fixed), add a changelog entry, bump the patch version.

## Repo rules you must follow (lean CLAUDE.md + on-demand docs)
- Authoritative branch **opus-4.8**; **save = commit + push** (owner only sees the live site).
- Every change: bump the **patch** digit + update `<span class="version">` in `index.html` + prepend a **model-stamped** entry to `RELEASES` in `src/changelog.ts` — all three together. Run `npm test` + `npm run typecheck` + `npm run build`.
- You **cannot see the live site** — "verified" = build/tests pass; the visual is the owner's (or the on-screen diag's) call. Don't claim it's fixed without the diag/owner confirming.
- Full rules: `CLAUDE.md` + `docs/rules/ui.md` (auto-injected when you edit CSS).

## Key files / locations
- `src/styles.css`: `.addm-passive*` chain (~3075–3083), `.addm-sugg` (~3303), `.wo-addform--modal` (~3160), `.addm-card` (\~3030, the container cap that DOES hold).
- `src/main.ts`: `diagAddmOverflow` + `openAddModal` (~20556); palette built by `passivePaletteHtml`, slot at `<div class="addm-passive-slot">` (\~20638).
- `docs/persistent-bugs.md`: PB-53 (\~line 26), the recurring add-modal overflow family (PB-24/48/49/52/53).
