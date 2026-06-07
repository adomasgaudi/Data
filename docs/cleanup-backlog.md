# Cleanup / refactor backlog (pickable codes)

A standing menu of organise / simplify / delete ideas, graded from low-level
(redundant code) to high-level (re-present or cut whole features). **Awareness, not
a mandate** — no AI has to do these, but every AI should know they exist and may
pick them up (or propose more). The owner selects by code (e.g. "do CLN-1, CUT-1").

Conventions: each item has a short pickable code (CLAUDE.md rule 11) plus a
`[part]` chip (which area of the app it touches) and an `(SP:n)` effort estimate on
the Fibonacci scale — those are AI estimates for sizing, tweak freely. The real
committed `CAT-n` is derived at commit time (rule 8). Risky deletions go via the
attic/warehouse tiers (rule 10). Keep this file updated — mark items done, add new
ones, re-grade as the code changes.

## ▶ Recommended order (chronology for the CUT-/ARCH- work)

Principles: **subtract before you restructure** (every cut = less to split later);
**build the test safety-net before risky moves**; **docs last** (they re-drift while
the architecture moves). The ROI items are pointers, not separate work
(ROI-1→ARCH-1, ROI-2→CLN-1+CUT-1, ROI-3→CUT-2). Critical path: **2→3→4→8→9**.

1. ✅ **CLN-1** — untrack `dist` (b.2.6.54).
2. ✅ **CUT-2** — all 3 legacy charts retired (b.2.6.72/81/83).
3. **DEL-1** — warehouse dead scaffolding (unused → safe; shrinks profile/domain/main). ← next safe item
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

Severity tags: 🔴 burning (real bug/blocker) · 🟠 worth-it · 🟢 nice-to-have (fine to never do).
**Honesty rule (CLAUDE.md rule 11): these are the REAL items, not padded to a round
count.** The only 🔴 left is ARCH-1 (and it's already in progress); CLN-2 is fixed.
Everything else is optional. A cleanup backlog regenerates itself — don't grind 🟢s to look busy.

## 🟢 Junior — safe, do-now
- ✅ **CLN-2** [CSS] (SP:0.5) — Fix the `var(--card)` bug — DONE (b.2.6.58). Surfaces now solid in both themes.
- 🟢 **CLN-3** [CSS] (SP:0.5) — Delete dead CSS (`.effort-inline`, `.team-col*`, `.login-link`, dead mobile `.tabs` block).
- ✅ **CLN-4** [Build] (SP:0.5) — Delete dead `spHistory.ts` + `scripts/gen-sp-history.cjs` — DONE (b.2.6.84).
- ✅ **CLN-1** [Build] (SP:0.5) — Untrack `dist/index.html` — DONE (b.2.6.54). *(CLN-5 "fold tasks.md" dropped — filler.)*

## 🟡 Mid — dedup & helpers
- 🟠 **TOOL-1** [Build] (SP:3) — Add ESLint + Prettier (machine guardrail for AI-written code).
- 🟠 **DUP-1** [Data] (SP:2) — Collapse triplicated leg/chest/back keyword lists in `profile.ts`.
- 🟠 **DUP-2** [Code] (SP:5) — Auto-escaping `` html`` `` template to kill 227 manual `escapeHtml` calls.
- 🟢 **CSS-1** [CSS] (SP:2) — CSS-token consolidation: `--shadow-menu`, `.chip` base, one `:focus-visible`, route reds through `--danger`/`--warn`. *(merged the old CSS-1+CSS-2.)*
- ✅ Pure-helper extraction + `storage` dedup — DONE (REF rounds, b.2.6.50).

## 🟠 Senior — architecture & tests
- 🔴 **ARCH-1** [Architecture] (SP:30) — Split `main.ts` (jsdom net → `let`→state-object → ~7 feature modules). The one big-ticket item that genuinely matters: you edit with AIs and a 10k-line file blocks that. *(IN PROGRESS: `appState` container + 2 state clusters migrated — b.2.6.60/61, ~11/95 globals on `S`. Paused while `main.ts` is hot with concurrent edits, per #co-work.)*
- 🟠 **ARCH-2** [Architecture] (SP:8) — Test + move untested compute (strength-fade, world-record, difficulty maths) into tested modules.
- 🟠 **DEL-1** [Code] (SP:3) — Warehouse/delete speculative scaffolding (`DISSOLVABLE_TAGS`, empty `EXERCISE_GROUPS`, unused identity model, 8 dead exports).
- 🟠 **DOC-1** [Docs] (SP:2) — Reconcile docs that actively MISLEAD AIs (README/CLAUDE "Chart.js" gone, stale Netlify steps).
- 🟢 **ARCH-3** [Architecture] (SP:5) — Merge over-split clusters (`exercise*` + `profile`; `variation*`) — the over-split is mild.

## 🔵 CEO / ROI — a priority LENS, not a task bucket
Not its own tasks (this was the padded one). The whole list reduces to: **do CLN-2
(🔴, 5 min) and decide ARCH-1 (🔴, big); the rest is 🟠/🟢 optional.** Weight already
shed via CLN-1; duplicate graphs handled via CUT-2.

## 🟣 Creative Director — cut or re-present whole features
- 🟠 **CUT-1** [3D] (SP:8) — Cut / 2D-replace / lazy-load the 3D handstand (3 MB + heaviest dependency). *owner decision*
- ✅ **CUT-2** [Graphs] (SP:13) — One graph, not two — DONE. All 3 legacy charts retired: workout-sets + drill-in warehoused (b.2.6.72 / b.2.6.81 — see `warehouse/2026-06-07-cut2-*`), compare graph removed by a concurrent AI (b.2.6.83). The universal `#waGraph` is the only trend chart.
- 🟠 **CUT-4** [Taxonomy] (SP:8) — Commit to or cut the half-built taxonomy (16 joints / 27 movements, ~10 lifts seeded). *owner decision*
- 🟢 **CUT-3** [Guide] (SP:3) — Move the Guide tab (410 lines, 35% of `index.html`) out of the app. *(taste, not debt)*
- 🟢 **CUT-5** [Build] (SP:3) — Externalise the changelog data (180 KB, 85% data). *(unwieldy, not harmful)*

## 🔒 Security
- **SEC-1** [Security] (SP:2) — Commits show as **Unverified** on GitHub (unsigned). The env's SSH signing key `/home/claude/.ssh/commit_signing_key.pub` is **empty (0 bytes)** with no private key, so `commit.gpgsign` silently fails for *every* AI (canonical commits are unsigned too). Committer identity is already correct (`Claude <noreply@anthropic.com>`). Fix = provision a real signing key in the environment (platform/setup change, not fixable from inside the container), or accept as cosmetic. Do NOT rewrite the deployed branch's history to chase the badge.

## ✅ Done (no need to pick)
- Extracted + tested pure helpers from `main.ts`: `format`, `colorScale`, `html`, `storage`, `frequencyTier`, `defaultLeanTable`. Duplicate JSDoc removed. (REF rounds, b.2.6.50.)
- **CLN-1** untrack dist (b.2.6.54) · **CLN-2** `--card` bug fix (b.2.6.58) · **CLN-4** delete dead spHistory (b.2.6.84).
- **CUT-2** all 3 legacy charts retired (workout-sets/drill-in warehoused b.2.6.72/81, compare b.2.6.83).
- **ARCH-1** started: `appState` + 2 state clusters migrated (b.2.6.60/61).

## 🧹 Prune sweeps (single-class hunts — see CLAUDE.md `#prune`)
Each `#prune` run records its finds here so the sweep survives across sessions.

### SNAP — "synchronous heavy re-render / imperative scroll on tap" (rule 17)
The root cause of both UI lag and scroll/close jank: interaction handlers rebuild whole view subtrees (`renderAll` / `renderWorkoutAnalysis`, ~31 `renderAll()` sites) synchronously, then patch scroll/open-state back. Tool: `deferRender(fn)` / `scheduleRender(after?)` — rAF-coalesced, scroll-preserving (in `main.ts`).
- ✅ **SNAP-1** [Perf] — `scheduleRender()` + `deferRender()` helpers; 11 last-statement `renderAll()` handler calls coalesced; `scrollIntoView` center→nearest ×3. (b.2.7.2)
- ✅ **SNAP-2** [Index] — Index taxonomy/group pills (Disciplina / muscle group / combinable / ratio): were `renderAll(); reopenIndexDetail()` sync with no scroll keep → now `scheduleRender(() => reopenIndexDetail())`; fixes "lag + scrolls down a lot".
- ✅ **SNAP-3** [Analysis] — Pratimai selector chips (remove ✕ / toggle / select-all / clear): deferred `renderWorkoutAnalysis` + instant pill feedback (remove the pill / toggle `is-on` on tap).
- 🟠 **SNAP-4** [Perf] — ~20 remaining `renderAll()` sites whose following code reads the just-built DOM stay synchronous; convert case-by-case to `scheduleRender(after)` over future turns.
- 🟢 **SNAP-5** [Perf] — root fix: targeted/incremental rendering so the DOM isn't destroyed (scroll/focus/open-state survive for free, nothing heavy to defer). Big; overlaps ARCH-1.
