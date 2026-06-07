# Cleanup / refactor backlog (pickable codes)

A standing menu of organise / simplify / delete ideas, graded from low-level
(redundant code) to high-level (re-present or cut whole features). **Awareness, not
a mandate** — no AI has to do these, but every AI should know they exist and may
pick them up (or propose more). The owner selects by code (e.g. "do CLN-1, CUT-1").

Conventions: each item has a short pickable code (CLAUDE.md rule 11). The real
committed `CAT-n` is derived at commit time (rule 8). Risky deletions go via the
attic/warehouse tiers (rule 10). Keep this file updated — mark items done, add new
ones, re-grade as the code changes.

## ▶ Recommended order (chronology for the CUT-/ARCH- work)

Principles: **subtract before you restructure** (every cut = less to split later);
**build the test safety-net before risky moves**; **docs last** (they re-drift while
the architecture moves). The ROI items are pointers, not separate work
(ROI-1→ARCH-1, ROI-2→CLN-1+CUT-1, ROI-3→CUT-2). Critical path: **2→3→4→8→9**.

1. **CLN-1** — untrack `dist` (free, ROI-2).
2. **CUT-2 Stage 3** — warehouse the now-invisible legacy chart code (lowest-risk removal; shrinks main.ts; finishes ROI-3).
3. **DEL-1** — warehouse dead scaffolding (unused → safe; shrinks profile/domain/main).
4. **ARCH-0 (safety net)** — jsdom smoke tests (ARCH-1 step 1; also de-risks 5–8). Build once, here.
5. **CUT-1** — 3D handstand: decide lazy-load vs cut, then execute (biggest weight win, ROI-2). *owner decision*
6. **CUT-3** — move the Guide tab out of the app (~35% of index.html). *owner decision*
7. **CUT-4** — taxonomy: commit-or-cut; if cut, must precede ARCH-3. *owner decision*
8. **ARCH-2** — move untested coupled compute (strength-fade, world-record, difficulty) into tested modules.
9. **ARCH-1** — split main.ts (`let`→state-object → ~7 feature modules). Highest ROI; now small + net-covered.
10. **ARCH-3** — merge over-split clusters (after CUT-4 + ARCH-1).
11. **CUT-5** — externalise changelog data (independent; slot anytime).
12. **DOC-1** — reconcile drifted docs (last, once stable).

Steps 5–7 are subtraction that should land before ARCH-1 but each needs an owner
decision; 11 is parallelizable; 12 is last.

## 🟢 Junior — safe, do-now
- **CLN-1** — Untrack `dist/index.html` (6.1 MB; CI rebuilds it).
- **CLN-2** — Fix the `var(--card)` bug (undefined, used 5× → transparent login card / sitemap / RPE buttons).
- **CLN-3** — Delete dead CSS (`.effort-inline`, `.team-col*`, `.login-link`, dead mobile `.tabs` block).
- **CLN-4** — Delete dead pipeline `spHistory.ts` + `scripts/gen-sp-history.cjs` (unreferenced).
- **CLN-5** — Fold stray `tasks.md` into CLAUDE.md.

## 🟡 Mid — dedup & helpers
- **DUP-1** — Collapse triplicated leg/chest/back keyword lists in `profile.ts`.
- **DUP-2** — Auto-escaping `` html`` `` template to kill 227 manual `escapeHtml` calls.
- **CSS-1** — CSS tokens: `--shadow-menu`, a `.chip` base, one `:focus-visible` (~15 dupes gone).
- **CSS-2** — Route hardcoded reds through `--danger` / `--warn`.
- **TOOL-1** — Add ESLint + Prettier.

## 🟠 Senior — architecture & tests
- **ARCH-1** — Split `main.ts` (jsdom smoke tests → `let`→state-object → ~7 feature modules).
- **ARCH-2** — Move untested compute (strength-fade, world-record, difficulty maths) into tested modules.
- **ARCH-3** — Merge over-split clusters (`exercise*` + `profile`; `variation*`).
- **DEL-1** — Warehouse/delete speculative scaffolding (`DISSOLVABLE_TAGS`, empty `EXERCISE_GROUPS`, unused identity model, 8 dead exports).
- **DOC-1** — Reconcile drifted docs (README/CLAUDE "Chart.js", stale Netlify steps).

## 🔵 CEO — cost / risk / ROI
- **ROI-1** — Prioritise ARCH-1 (the untested 10.7k-line file is the bus-factor risk).
- **ROI-2** — Shed dead repo weight (CLN-1 `dist`, CUT-1 3D).
- **ROI-3** — Stop paying for two graph systems (= CUT-2).

## 🟣 Creative Director — cut or re-present whole features
- **CUT-1** — Cut / 2D-replace / lazy-load the 3D handstand (3 MB + heaviest dependency).
- **CUT-2** — One graph, not two: finish the unified-graph migration, retire the legacy charts. *(in progress — Stage 1 DONE: `GRAPH-2` CSS already hides the legacy drill-in/compare/workout-sets charts in Analysis, and the standalone Exercises/Compare/Workouts tabs are no longer in the More menu, so the legacy charts are invisible dead weight. Remaining = Stage 3: warehouse/delete the dead chart code — `exerciseSvg`/`compareSvg`/`workoutSetsSvg` + `renderExerciseProgressChart`/`renderCompareChart` + their containers — WITHOUT touching the still-visible panels/tables they sit beside. Stage 2 parity is moot: legacy-only chart features are already not shown.
  Stage-3 surgery map (do ONE subsystem per turn, warehouse each, keep shared bits):
  (a) drill-in `exerciseSvg` `renderExerciseProgressChart` — 5 call sites; KEEP
  `#exerciseProgressNote` (reused by rename-validation) + controls only if unshared;
  (b) compare `compareSvg` `renderCompareChart`/`renderCompareSection` — ~35 refs,
  most woven; (c) workout-sets `workoutSetsSvg` `renderWorkoutSetsChart` — 6 call
  sites, KEEP the `#workoutSets` wrapper (it's the calendar's relocation anchor),
  remove only the inner `#workoutSetsChart`.)*
- **CUT-3** — Move the Guide tab (410 lines, 35% of `index.html`) out of the app.
- **CUT-4** — Commit to or cut the half-built taxonomy (16 joints / 27 movements, ~10 lifts seeded).
- **CUT-5** — Externalise the changelog data (180 KB, 85% data).

## 🔒 Security
- **SEC-1** — Commits show as **Unverified** on GitHub (unsigned). The env's SSH signing key `/home/claude/.ssh/commit_signing_key.pub` is **empty (0 bytes)** with no private key, so `commit.gpgsign` silently fails for *every* AI (canonical commits are unsigned too). Committer identity is already correct (`Claude <noreply@anthropic.com>`). Fix = provision a real signing key in the environment (platform/setup change, not fixable from inside the container), or accept as cosmetic. Do NOT rewrite the deployed branch's history to chase the badge.

## ✅ Done (no need to pick)
- Extracted + tested pure helpers from `main.ts`: `format`, `colorScale`, `html`, `storage`, `frequencyTier`, `defaultLeanTable`. Duplicate JSDoc removed. (REF rounds, on the cleanup branch.)
