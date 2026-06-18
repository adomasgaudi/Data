# Variation / set-card / graph UI build — master checklist

Owner asked (Jun 18, multiple screenshots): "do everything, don't miss a single
one." This is the live tracker — every AI working this thread updates the boxes
and reports the remaining count each turn. Tasks are deployed to `opus-4.8` one
at a time (rule 7/59). Codes are re-derived at commit (rule 8).

## TASKS

- [x] **1 · Free isn't a tag** — `WO-233` `b.2.9.180` (deployed). A free push-up /
  free pull-up is just the exercise → no chip; the always-on "FREE" pill is gone.
  Tags now emit only when a dimension deviates from `FAMILIES[fam].defaults[dim]`;
  added the `position` dimension so on-knees shows "knees". Root for the
  "baseline shown as a tag" class.

- [x] **2 · Picker == tag (unified variation control)** — DONE (`WO-234` v181 +
  `WO-235`). Sub-parts:
  - [x] **2a SSOT label source** — `AF_LEVEL_LBL` is now the single `{label,hint}`
    map; tag + add-preview both render via `variationChipsFromVec`/`afLevelText`.
  - [x] **2b Rename** — `floor (on feet)` → `free`; support shows short `b2w`/`f2w`.
  - [x] **2c Picker default selection** — `frequentLevelFor` pre-selects the athlete's
    most-used level over the last 3 months, else the config default.
  - [x] **2d Restyle** — picker pill restyled to the `.wo-var-chip` tag look; hints in
    `.xdd-opt-hint` gray menu text.
  - [x] **2e `#prune` sweep** — unified the 3rd renderer (`syncAddmVtags`); logged the
    remaining `vecSelect` editor sibling as `CLN-VEC-LABELS` in cleanup-backlog.
  - [x] **2f Close-out** — `#remember`ed as CLAUDE.md rule 60. (LT i18n: the compact
    variation codes — b2w/knees — were never in `i18n.ts`; left as codes per existing
    convention, noted not forgotten.)

- [x] **3 · Set context-menu redesign** — DONE. Tap a collapsed set:
  - [x] Duplicate (⧉) + Change-variant (✎) are **icon-only**, crammed in a top row.
  - [x] Added a **delete ✕** icon (terracotta `--remove`, calls `deleteSetsWithUndo`).
  - [x] Replaced the "+1 rep" suggestions with **two scroll-snap rulers** (reps +
    weight, centred on the set's values, live readout) + an **＋ Add set** button
    (`addManualSetLike`, shared with the old suggestions).

- [x] **4 · Graph dot tooltip** — DONE. The pinned point popup now shows the date,
  original **logged** weight×reps, the **effective** load when it differs, the
  **variants** (note), RIR, and a **"→ in history"** link button (`onPointHistory`
  → `openExerciseInfo`). Wired on the reps×weight scatter and the time-series dots
  via a new `SvgPoint.histEx` + `SvgChartConfig.onPointHistory`.

- [x] **5 · Merged-pattern title + switcher** — DONE. When a lift is MERGED into a
  group, the graph/history title now shows the GROUP name (e.g. "Squat pattern") via
  `chosenGroup(...,"combine")` in `liftSelectionTitle`. And the lift-menu's group
  members are now TAPPABLE buttons (`data-lm="member"`) that isolate the selection to
  that single exercise — so from the merged pattern you can pick any one member.

## ALL FIVE TASKS COMPLETE — deployed to opus-4.8 (b.2.9.180 → 188).

## NOTES
- Heavy concurrent churn on `opus-4.8` (3 rebase collisions on task 1). Re-derive
  version + task code at every commit; reset-onto-opus + re-apply is cleaner than
  fighting changelog merges.
- All UI items are UNVERIFIABLE by the AI — each ships "I changed X, please check."
