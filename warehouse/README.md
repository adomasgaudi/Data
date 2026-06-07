# Warehouse — code in temporary storage (tier 2 of 3)

Code here has been **removed from the live app** (`src/`). It is not built,
typechecked, bundled, or tested — `tsconfig.json` only includes `src`, so nothing
here ships. It's kept in git so it can be brought back. Think *Transfer pile*, not
*Trash*.

## The three tiers for removing code (see CLAUDE.md rule 10)
The AI decides which tier — the owner never invokes it.

- **Tier 3 · git — the DEFAULT.** Ordinary edits, small changes, anything you're
  reasonably sure about: just delete it. History has it. Don't ceremony-wrap
  routine work. Slowest to restore (dig through history), but that's fine — it's
  rarely needed.
- **Tier 2 · warehouse (this folder).** Big-refactor / legacy code you've
  **decided** is out, but want a fast, documented way back for a while. Medium
  restore speed (follow the manifest). Trashed after **~100 SP of further shipped
  work** with it still unused.
- **Tier 1 · attic (`../attic/`).** Mid-refactor code whose fate is **undecided**
  — sitting close by while you see if you can live without it. Fastest to return
  (context still fresh). Lives only until the refactor ends.

Warehouse and attic are **only** for large refactors and legacy pruning. For
everything else, delete (tier 3).

## Layout
```
warehouse/
  _TEMPLATE/manifest.json     # copy this for each new item
  <YYYY-MM-DD>-<short-name>/
    manifest.json             # how to understand + restore this item
    <the moved files / code, verbatim>
```

## Moving something in
1. Cut the code **and all its wiring** out of `src/` (imports, UI/menu entry,
   event handlers). No commented-out leftovers, no inline feature flags — from the
   live app it must be truly gone.
2. Put the removed code here verbatim + fill in `manifest.json` (copy `_TEMPLATE`).
   Set `movedAtSp` to the current cumulative shipped SP (sum of `(SP:n)` across
   `git log` subjects — `scripts/warehouse-check.cjs` uses the same number).
3. Verify the app survives **without** it: `npm run typecheck && npm test && npm run build`.
4. Commit. Expect it to "feel missing" — that friction is the point.

## Bringing something back — ONE AT A TIME
Follow the manifest's `restoreSteps`, re-wire, then `typecheck` + `test` + `build`.
**Never** restore multiple items at once — if everything comes back, the exercise
was pointless. You're meant to survive without it; only pull back what genuinely
proves necessary.

## Trashing (after ~100 SP of further work unused)
The SessionStart check flags items where `currentSp − movedAtSp ≥ expiresAfterSp`
(default 100). Deleting is deliberate: confirm, then remove the folder. (A real
delete — git history still has it as the final safety net.)
