# Plan — surface "active" exercise settings into the main Add view (unilateral, machine, R/L)

Owner request 2026-06-19 (Add-exercise screenshot, "Plate lifts", b.2.9.224). Deferred to a
FRESH chat (this session ran very long + heavy co-work rebase churn). Same active/passive idea
as WO-245: a setting that's SET shows in the main add view; if unset it stays in the ⚙ cog.

## What the owner wants
1. **Unilateral pill in the add view.** When an exercise is marked unilateral (in the ⚙ cog /
   `isUni(ex)`), show a SMALL distinct button/tag in the main add view (under the exercise name,
   in the tag-row area — the owner's arrows point there) that says it's unilateral. NOT styled
   like the variation `.wo-af-dimpill` tags — a little plain button (its own look). Tapping it
   could toggle uni off (or open the cog) — confirm in build.
2. **Right/left dual inputs for a unilateral set.** Each set line should have TWO weight inputs
   (right + left) instead of one, but SMALLER so they don't eat space (the owner drew two small
   boxes left of the weight on each line). Reps likely stay shared (confirm). On Add, store the
   per-side divergence (there's already `setSideDivergence` / `setSidesStore` + the expanded
   set-edit `.set-side-input` path — reuse that storage: rWeight/lWeight/rReps/lReps).
3. **Machine weight + multiplier surface when SET.** If an exercise has a machine base weight
   (`machineWeightFor(ex)`) or an assisted multiplier (`isAssistedMachine` / `machineMultFor`)
   that's non-default, show it as a small control/indicator in the main add view; if NOT set, it
   stays only in the ⚙ cog. (Generalises the cog → "active settings promote to the surface".)

## Reuse / pointers
- Add modal: `afLine(ex)` builds each set line (`.addm-line` → `.addm-line-vars` tags | `.addm-line-main` weight/reps/RIR/✕). `addmVariantField(ex)` builds the tag row.
- Add-form header cog: `.addm-cog` opens `.addm-set-cog` popup (placeCogPop) — the uni / machine
  settings already live there (`addmSettingsPanelInner`).
- Uni state: `isUni(ex)` / `setUnilateralOverride`. Machine: `machineWeightFor`, `machineMultFor`,
  `isAssistedMachine`, `equipSettingsCurrent(ex)`. Per-set sides: `setSideDivergence(id, {...})`,
  `setSidesStore`, and the read path `applySetOverride`/side handling.
- Read on Add: `onInlineAddGo` builds `setLines` per `.addm-line`; add per-side weight reads and
  call setSideDivergence on each created set's id (same id formula `${user}|${ex}|${date}|${100000+i}`).
- The existing live formula preview `syncAddmReal` already shows machine `base+dial` / `−20/2`.
- The set chip in history already supports per-side (unilateral) via the expanded editor — mirror its inputs, smaller, on the add line.

## Open questions for the build session
- Unilateral pill: tapping it = toggle uni off, or just an indicator (edit in cog)? (Recommend:
  small toggle that flips uni, mirroring the cog.)
- R/L: does reps also split per side, or only weight? (Owner drew weight boxes; default to weight
  per-side, reps shared — confirm.)
- Layout: with R/L + reps + RIR + ✕ the line is tight on mobile — the owner explicitly wants the
  inputs SMALLER; keep one row, shrink the R/L boxes (≈2.4rem each).
- Machine surface: a tiny read-only chip ("base 20" / "÷2") that opens the cog on tap, or editable
  inline? (Recommend: small chip → opens cog, to avoid crowding.)
