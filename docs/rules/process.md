<!-- Loaded when: refactoring / removing code / multi-part work -->

# Process: removing code, components & debugging tooling

## Rule 10 — Removing code: 3 tiers, default is just DELETE (git is the net)

For ordinary changes, delete freely — history has it. Only in big refactors / legacy pruning park *undecided* chunks in `attic/` (closest, fastest back) and *decided-out* chunks in `warehouse/` (+ restore manifest, trashed after ~100 SP of further work unused). Restore ONE piece at a time; expect friction. The AI judges the tier — no owner command. See `warehouse/README.md`.

Full detail — a baked-in mindset for every AI, *especially* refactor / cleanup / meta / senior-tech (project-wide) agents; the AI decides the tier, the owner never invokes it:
- **Tier 3 · git is the DEFAULT:** most edits can just be deleted; history has them — don't over-ceremony routine work. Attic & warehouse are ONLY for large refactors and pruning legacy code.
- **Tier 1 · attic** (`attic/<name>/` + a short `NOTE.md`): mid-refactor, when it's not yet clear how much of a chunk goes — moved out of `src/` but kept closest, fastest to return because context is still fresh.
- **Tier 2 · warehouse** (`warehouse/<YYYY-MM-DD>-<name>/` + `manifest.json`): once *decided* a substantial chunk is out but a quick documented way back is still wanted; the manifest records origin/deps/wiring/`restoreSteps` + `movedAtSp`, and a SessionStart check (`scripts/warehouse-check.cjs`) flags it for trashing once ~100 SP of further work has shipped without it.

Both tiers mean the code is **fully gone** from `src/` (no commented-out / flag-gated remnants — `tsconfig` only includes `src`, so neither folder is built/typechecked/tested). Always **restore one piece at a time** and **expect the missing-it friction** — that friction is the test of whether you actually needed it. By a refactor's end the attic is empty: every item restored, warehoused, or deleted. Full spec: `warehouse/README.md`.

## Rule 61 — PRUNE AS YOU GO (delete the dead code your change orphans)

Owner: "always ~10× more lines added than removed." Every change should DELETE the dead/outdated code it orphans, not only ADD: before committing, hunt the now-unused functions/vars/CSS/branches your change left behind (and adjacent rot) and delete them (rule 10's default tier — git is the net); a net-only-growth diff is a smell — leave the file smaller where you can, and call out dead code you find even if it's not strictly in scope.

## Rule 12 — S-ANL is its own view

Write `S-ANL` code fresh, using full-`ANL` as *inspiration* not copy-paste/relocation — prefer rewriting over sharing, to avoid "creeping in" coupled code.

## Rule 65 — ONE parameterised component, NEVER twin components for variants of the SAME thing

Owner: "edit and add should be a single source/component that does different things, not two separate entities." When two UIs are the same KIND of thing differing only by mode/settings — add-set vs edit-set, a picker vs the tag it sets, etc. — build ONE component that takes a mode/param, never two that silently drift (PB-46 was exactly two parallel add/edit editors). The TEST: "same thing, different setting" → unify; "genuinely different purpose" (S-ANL vs ANL, rule 12) → separate. Before adding a `renderXEdit`/`openYEditor` beside an existing `renderX`/`openY`, make the existing one take the new mode instead.

## Rule 51 — On-screen `dbg()` console = THE mobile-debug tool

(`src/main.ts`; full guide `docs/onscreen-debug.md`) — PROVEN (`#super-persistent` + `#max-debug` cracked PB-38 in one round). Phones have NO devtools console, so when a fix keeps failing, STOP guessing and instrument EVERY step of the failing flow with `dbg('area ACTION detail ✓/✗')` (green overlay, bottom-left; tap to clear; `window.dbg` too) — the line that's MISSING or contradicts your mental model in the owner's screenshot is the bug. PB-38's root (a `panel`-scoped delegated click handler can't see a `<body>`-appended popup) was invisible until logged. KEEP the green console (owner); silence via `localStorage colosseum.dbg=off`.

## Rule 68 — "CSS box-viewer" (locate a layout culprit you can't see)

To find an empty space / overflow / which container owns a gap, OUTLINE the candidate containers in DISTINCT colours and ship it, so ONE screenshot reveals the box (owner: "this is very good, like a css viewer"). When blind to the live DOM and a width/height/gap fix keeps missing, stop guessing — add a TEMPORARY `#a,#b { outline: 2px solid red/green/blue… !important }` over the few suspects (state the colour→box map to the owner), read the offending box from the returned screenshot, then REMOVE the diagnostic and fix only that box. The visual twin of rule 51's `dbg()` (instrument-then-screenshot), but for box-model/space bugs. Shipped as the reusable 📦 Boxes admin toggle — outline-all + long-press to measure.

## Rule 69 — `#image`: ANALYSE THE SCREENSHOT VISUALLY, never reason from OCR'd text alone

Owner: "analyse the image not just text." When the owner sends a screenshot, actually LOOK at the pixels — which element is cut off / overflowing past an edge, where the empty space sits, alignment/spacing, what's clipped or off-screen — don't just read the words in it and guess. Pair with the 📦 Boxes outline (rule 68): if the shot has the coloured outlines on, read which box crosses the bound. The text is the least useful part of a layout screenshot; the geometry is the point.
