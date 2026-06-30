# UI space-efficiency rubric — score the SCREENSHOT, not the code

> Ported from the sister `vz` repo's `UI.md`. Read this on every UI change (pairs with
> `docs/ui-taste.md`). Purpose: stop shipping *ugly-but-functional* layouts that pass a
> "looks correct" glance but waste space / overflow the phone — the recurring class behind
> the add-modal "out of bounds" family (PB-24 / PB-48 / PB-49 / PB-52).

## Process (do this first, every UI change)
1. **Ask for / use a screenshot before editing.** You can't see the live site — score the
   RENDER, not the code (CONV: "I changed X, please check", never "it's fixed").
2. **Run the rubric against that render out loud.** Score *proportion*, not just correctness.
3. **render → critique → refine, never one-shot.** Build, rebuild, re-screenshot, re-score.

## The rubric (each line; any "no" is a 🔴/🟠 to fix)
1. **Nothing exceeds the viewport.** On a ~360px phone, no row, control or the CARD ITSELF
   may be wider than the screen. The cap belongs on the CONTAINER (`max-width: min(Xrem,
   100vw)` + `overflow-x` clip), and EVERY flex/grid child in the chain needs `min-width: 0`
   so one unshrinkable item (a fixed weight box, a long tag block) can't force the parent
   wider. A "scroll the inner row" patch does NOT help if the card grows to its widest child.
2. **Column-vs-content width.** No element gets width/height out of proportion to its info
   (a 40px column for one digit; a wide empty metadata column beside cramped content). Tables
   on a phone almost always fail — prefer STACKED CARDS over columns.
3. **No atomic-token wrapping.** Dates, version strings, numbers, kg values must not break
   mid-value across two lines. If they wrap, the column is too narrow.
4. **Content gets the most room.** The value that matters gets the width; short metadata
   doesn't get a fixed column sitting in a sea of whitespace. Don't invert the ladder.
5. **Redundant labels dropped (#cram).** Match the tightest shipped UI; one scrolling row
   where possible; drop "Settings / Show as / Include / View / Filter by".
6. **Reach ladder (#joy-of-less).** More-used controls closer to hand; graded values open a
   popup (rule 47), toggles are pressable pills (#toggle), not checkboxes/segmented rows.
7. **Tokens, not ad-hoc.** Colours from the shared palette, small radius (`--r-pill`) not
   full-pill, a loading state on every async op.

## Why AIs miss it (root cause)
Models weight *text present* over *space wasted*, have no felt sense of pixel cost, and when
asked to "analyse" hunt for *broken* things — so they pass ugly-but-functional layouts. The
fix is structural: a render→critique→refine loop scored against THIS fixed rubric. "The case
is gone" is not "the class is gone" — fix the space-wasting / overflow CLASS, not the one
shown case (a removed thin column just relocates the wasted space elsewhere).
