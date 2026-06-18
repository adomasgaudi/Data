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

- [ ] **2 · Picker == tag (unified variation control)** — the original
  `#remember`/`#prune` build. Sub-parts:
  - [ ] **2a SSOT label source** — collapse the tag's `SUP`/`POS` maps and the
    picker's `AF_LEVEL_LBL` into ONE level→label map so picker and tag can't drift.
  - [ ] **2b Rename** the picker's `floor (on feet)` → `free` (one canonical name).
  - [ ] **2c Picker default selection** = the user's most-frequent variation over
    the last ~3 months for that exercise; first option if no data.
  - [ ] **2d Restyle** the picker pill to match the tag pill (`.wo-var-chip`) look;
    explanations allowed as small gray subtext.
  - [ ] **2e `#prune` sweep** every family/dimension for baseline-as-tag + label
    drift; log finds in `docs/cleanup-backlog.md`.
  - [ ] **2f Close-out** — LT i18n for any new label; `#remember` the UI rule
    (picker must look like the final tag; a default/free level is not a tag; one
    canonical name per variation).

- [ ] **3 · Set context-menu redesign** (the popup when you tap a collapsed set):
  - [ ] Duplicate + Change-variant become **icon-only** (no text), crammed at top.
  - [ ] Add a **delete ✕** icon.
  - [ ] Replace "+1 rep" with a bigger inline block: **two scrollable rulers**
    (reps + weight) + an **Add** button that logs a new set like the tapped one
    at the chosen reps/weight.

- [ ] **4 · Graph dot tooltip** — tapping a point also shows the **original logged
  weight**, the **variants**, the **date(s) logged**, and a small **link button to
  the history entry** it came from (alongside the realistic + 1RM values).

- [ ] **5 · Merged-pattern title + switcher** (LAST, owner said do after all else) —
  when a lift is viewed as a Merged/Separated member of a pattern group (e.g. Belt
  Squat → squat pattern), the title should read the GROUP ("Squat pattern"), not
  the single lift, and offer a way to pick any single member exercise of the group.

## NOTES
- Heavy concurrent churn on `opus-4.8` (3 rebase collisions on task 1). Re-derive
  version + task code at every commit; reset-onto-opus + re-apply is cleaner than
  fighting changelog merges.
- All UI items are UNVERIFIABLE by the AI — each ships "I changed X, please check."
