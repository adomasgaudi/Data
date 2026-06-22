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

## 🎨 UI consistency (UIC — see docs/ui-consistency-audit.md)
- 🟠 **CLN-VEC-LABELS** [main.ts variant editor] (SP:3) — The per-set "Change variant"
  vector editor (`vecSelect`, ~main.ts:13734) still keeps its OWN level-label maps
  (`SUPPORT_LBL`, `SHD_LBL`, `GRIP_LBL`, `HT_LBL`) instead of the shared `AF_LEVEL_LBL`
  SSOT (rule 60). They match for support today, but `shoulderDist` already drifts
  ("0cm (wall)"/"blue 6cm" vs the picker's "none"/"blue"+hint), and `ladderGrip`/
  `ladderH` aren't in the shared map at all. Fold these dims into `AF_LEVEL_LBL` +
  route `vecSelect` through `afLevelText`/`afLevelHint`, keeping the ×factor display.
  Found during the WO-233..235 variation-UI prune (tag + add-preview already unified
  on `variationChipsFromVec`; this editor is the remaining sibling).
- 🟠 **CLN-DEAD-EXPORTS** [several modules] (SP:2) — Dead-code sweep (owner: "always ~10×
  more lines added than removed", rule 61). `noUnusedLocals` already guarantees no unused
  LOCALS, so the dead code is unused EXPORTS. Confirmed unreferenced across all src (incl
  tests + scripts + html), READY to delete (typecheck/tests are the safety net):
  **safe / superseded** — `DEFAULT_BW_COEFF`, `JOINT_MOVEMENTS`+`JOINT_KEYWORDS`+`jointMovements`
  (the whole unused joint-movement taxonomy, ~38 lines, `profile.ts`); `GRAPH_DASH_KEY` (v1,
  superseded by `GRAPH_DASH_KEY_V2`, `graphDash.ts`); `loadHistoryDashboard`+`saveHistoryDashboard`
  +`HISTORY_DASH_KEY` (v1, superseded by the `…For` per-athlete v2, `historyDash.ts`);
  `costForSp`+`COST_PER_SP_EUR` (superseded by the model-aware `costForNode`/`EUR_PER_WEIGHTED_SP`,
  `changelog.ts`). **Verify-before-cut → VERDICT: KEEP (verified, not rot).** `fetchFromSupabase`
  (+ its only consumer `fetchSets` + `dbSetToRawRow`, `dataSource.ts`), `fetchAllRows`
  (`strengthlevel.ts`) and `isAdmin`/`ADMIN_EMAIL` (`supabase.ts`) are DORMANT INFRASTRUCTURE
  for the stated multi-user/cloud goal (rule 41 "mirroring the rest is the goal") + the
  website-side scraper that's deliberately not wired YET — deleting them would erase progress,
  not trim rot. Leave them unless the owner abandons the cloud/scraper plans. The CLEARLY-DEAD
  set above was removed in CLN-1 (b.2.9.209, −70 lines); sweep closed.
  NOTE: a naive CSS-class sweep flagged ~288 "unused" classes but most are
  FALSE POSITIVES from dynamically-built names (e.g. `cl-model--${…}`, `eff-${…}`) — a CSS
  prune needs per-class verification against template strings, not bulk grep.
- ✅ **UIC-DEAD-CSS (DONE)** [CSS] (SP:0.5) — Deleted the unused bottom-nav classes
  `.subtabs` / `.subtab` / `.subtab-ico` (+ `:hover`/`.is-active`) in `src/styles.css`:
  the bottom tab bar was replaced by the `.ex-tab` tabs, so these were dead. The retired
  `.tab`/`.tabs` top-bar CSS is left (it's still the `is-active` source). Plus added a
  Stop-hook guard (`scripts/rules-check.cjs`) that flags any catalogued class missing
  from CSS, so this drift class can't recur. Found during the UIC-7 catalogue-drift audit.

## 🔁 Duplicated / redundant UI (DEDUP — #prune sweep, Euclid)

Owner #prune on "there shouldn't be two separate set-editing views" + "don't show the
×N multiplier on the collapsed view." The sweep (Explore agent) mapped the whole class:

- ✅ **DEDUP-1 (DONE, b.2.9.130)** `[history/collapsed]` (SP:1) — **Redundant ×N on the
  collapsed set line.** `setDisplay()` (`src/main.ts` ~7574) showed `wo-scale` ×N on every
  scaled set even when a variation CHIP (B2W/LEAN…) already conveyed it. Now ×N shows ONLY
  when CUSTOM: a manual per-set `Scale ×` override, or no chip at all (then ×N is the only
  indicator). The expanded row (`set-scale` in `setRowsHtml`) KEEPS ×N — it's the detail view.
- ✅ **DEDUP-2 (DONE, b.2.9.132)** `[set-editor]` (SP:13) — **TWO parallel per-set editors → ONE.**
  The old floating "scale editor" popover (Support / Band / Depth×Lean 2D pad / Tempo / Hands /
  Range) now renders INLINE inside the set-edit card. `renderScaleEditor()` gained an in-card
  host mode (`scaleEditInCard`): when the card opens, `renderCardVarModel()` sets `scaleEditState`
  off the container's `data-scaleedit-*` and renders the model BODY (level + `notePickerHtml`)
  into `.set-edit-varmodel`; the card supplies the frame (✕, machine, not-comparable). `afterModelPick()`
  keeps the in-card model open on a pick (the standalone popover still closes); the dirty sync is
  deferred a frame on card-close (avoids detaching the row mid-toggle). The EXPANDED row's ×N chip
  now falls through to open the card (one editor). The standalone popover stays ONLY for the
  collapsed `wo-set-variant` chip (no card there). `refreshPoseViz` is a no-op so the pad is static
  HTML + delegated handlers — they read `scaleEditState` and work in either host.
- 🟢 **DEDUP-3 (note, mostly moot)** `[set-editor]` — the card's own `set-edit-nc` (not-comparable)
  + the popover `scale-edit-nc` are no longer both visible at once (the in-card model omits the
  popover's nc/mach, the card supplies them). Standalone popover still has its own for the
  collapsed path. Nothing urgent.

## 🧩 One-component-not-two (rule 65 — found in the 2026-06-22 app-wide scan)

- 🟠 **DEDUP-4** `[main.ts floating pickers]` (SP:5) — **Four near-identical floating-picker
  functions → ONE factory.** `openRomPicker` / `openLeanPicker` / `openInclinePicker` /
  `openCustomMultPicker` (plus their `close…` + `…PickerClose` state) all share the exact same
  skeleton: create div, `place()` (clamp into view), `commit()` (write the pill's dataset),
  `render()` (rebuild innerHTML), click/input/Esc + outside-tap handlers, append, deferred
  listener attach. They differ ONLY in the popover's inner HTML, which dataset keys they
  read/write, and the commit logic. Parameterise as `openFloatingPicker(pill, config)` where
  config = { className, initialState, render(state), onClick, onInput, commit }. HIGH confidence;
  pure refactor (no behaviour change), good test-by-build candidate. Biggest line-count win.
- 🟠 **DEDUP-5** `[set-editor / add-modal]` (SP:8) — **Collapsed-set quick-edit still opens the OLD
  popover, not the add/edit modal (rule 65, owner: "edit == add").** PB-46/DEDUP-2 routed the
  EXPANDED-card edit through `openAddModal` edit-mode, but the COLLAPSED-set quick-edit chip
  (`wo-set-variant`) still calls the legacy `openScaleEditor`/`renderScaleEditor` popover. So two
  edit UIs survive for the same thing. Retire the popover and route the collapsed quick-edit to
  the same `openAddModal` edit-mode. Verify nothing else still calls `openScaleEditor`/
  `toggleScaleEditor` before deleting. HIGH confidence it should unify; medium effort.
- 🟡 **DEDUP-6** `[set-editor / add-modal]` (SP:8) — **Two render paths for the SAME variation
  picker.** The per-set card builds its dim dropdowns / ROM·lean·band pills via
  `renderCardVarModel` → `renderScaleEditor` (driven by the `scaleEditState` global, re-renders on
  every change), while `openAddModal` builds the same controls inline as HTML via `afLine` and
  reads them at save. The chips/labels are already unified (`variationChipsFromVec`/`afLevelText`,
  rule 60), but the FORM markup is emitted twice. Extract one `variationFormHtml(mode)` both call.
  Medium confidence (real but larger); do AFTER DEDUP-5 (which may absorb it).
- ℹ️ **Not duplication (excluded):** `renderSAnalysis` vs `renderWorkoutAnalysis` (rule 12, S-ANL
  stays its own), the Curve/Volume/Map charts (different visualizations), and the generic
  `open*/close*` menu pairs (`openLiftMenu`, `openHistTabMenu`… — same close idiom, genuinely
  different content). The leaderboard vs compare charts/tables are different data shapes, not twins.

## ✅ Done sweeps (recent)

- **Synthetic-lift inheritance prune (DONE)** `[exercises/grouping]` — synthetic
  combined/comparable lifts (SQ mix, Pull/Chin, DL pattern…) keyword-match NOTHING, so
  they fell to default categories ("Other"/"Strength"/BW-part 0) and were absent from
  the Index. Made them inherit from their MEMBERS at every read-point in `main.ts`:
  `coeffBase` (BW part = the reference member's — combinable = same lift, comparable =
  ratio-1.0 reference), `catsFor` / `mgsFor` / `mgLevelOf` / `discsFor` (union of
  members), `tiersFor` (reference's), and `waMeta` (union for non-muscle dims). New
  single-source helpers `syntheticMembers` / `referenceMemberFor` / `inheritUnion`.
  `renderBwParts` now lists synthetics as rows (set count = members summed). Synthetic
  lifts no longer offer Combinable/Comparable editors (can't nest a group).
  FOLLOW-UP (DONE, b.2.8.38): `expandToRawExercises` ignored BUILT-IN groups (only
  user-defined), so a lens-combined lift filtered the history on a synthetic name that
  matches no logged set → empty history ("no squats for Kristina"). Now uses
  `syntheticMembers` (built-in + user). Audit any other synthetic→raw expansion for the
  same built-in gap.
  STILL-OPEN: (a) the PURE `profile.ts` functions (`muscleGroup`, `exerciseCategory`…)
  still keyword-fail for synthetic names if called DIRECTLY rather than via the main.ts
  wrappers — fine today (app paths use the wrappers) but a trap; (b) `waMissingExercises`
  excludes synthetic names (intended — they're never "missing"); (c) deeper: comparable
  members with DIFFERING bodyweight-parts may need the ratio to also account for the
  BW-part gap in the 1RM compare, not just added load — revisit if numbers look off.
- **Floating-menu open-state prune (DONE)** `[selector/menus]` — swept every floating
  (`position:absolute` body) `<details>`/popout that re-renders on an inner option tap,
  to ensure each preserves its OPEN state across the rebuild (else "clicking a setting
  closes the menu"). Only `wa-sel-cog` (selector ⚙) was missing it — fixed by reading the
  prev `.open` before rebuild. `cal-settings`, `wa-graph-fold` already preserved (via
  `calSettingsOpen` / `S.waGraphFoldOpen`). Codified as CLAUDE.md HARD RULE 24. Re-audit
  any NEW floating menu against rule 24.
- **`#design` rounding prune (DONE)** — replaced every full/pill rounding
  (`border-radius: 999px` ×69, `99px` ×1) in `src/styles.css` with the new small
  `--r-pill` token (8px). Genuine circular dots/avatars (`50%`) left as-is. Rule 21
  + the `#design` command added to CLAUDE.md. Re-grep `999px|99px` before declaring clean.

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
- ✅ **DUP-1** [Data] (SP:2) — DONE (#co-work): extracted the duplicated leg list (`LEG_KW_ALL` / `LEG_KW_BIG3`) and chest list (`CHEST_KW`) in `profile.ts` to module constants — the verbatim copies at the category & muscle/discipline guessers now share one source (back lists genuinely differ, left inline). 501 tests unchanged.
- 🟠 **DUP-2** [Code] (SP:5) — Auto-escaping `` html`` `` template to kill 227 manual `escapeHtml` calls.
- 🟢 **CSS-1** [CSS] (SP:2) — CSS-token consolidation: `--shadow-menu`, `.chip` base, one `:focus-visible`, route reds through `--danger`/`--warn`. *(merged the old CSS-1+CSS-2.)*
- ✅ Pure-helper extraction + `storage` dedup — DONE (REF rounds, b.2.6.50).

## 🟠 Senior — architecture & tests
- 🔴 **ARCH-1** [Architecture] (SP:30) — Split `main.ts` (jsdom net → `let`→state-object → ~7 feature modules). The one big-ticket item that genuinely matters: you edit with AIs and a 10k-line file blocks that. *(IN PROGRESS: `appState` container + 2 state clusters migrated — b.2.6.60/61, ~11/95 globals on `S`. Paused while `main.ts` is hot with concurrent edits, per #co-work.)*
- 🟠 **ARCH-2** [Architecture] (SP:8) — Test + move untested compute (strength-fade, world-record, difficulty maths) into tested modules.
- 🟠 **DEL-1** [Code] (SP:3) — Warehouse/delete speculative scaffolding (`DISSOLVABLE_TAGS`, empty `EXERCISE_GROUPS`, unused identity model, 8 dead exports).
- ✅ **DOC-1** [Docs] (SP:2) — DONE (b.2.9.x): fixed CLAUDE.md's stack line ("+ Chart.js" → in-house SVG engine `svgChart.ts`); the only genuinely misleading claim. README's Netlify steps verified ACCURATE (the site runs on Netlify — `netlify.toml`, `coloseum.netlify.app`), and README has no Chart.js. Other "Chart.js" mentions in src/changelog are correct (they describe the *replacement* engine or are historical removal notes).
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

### GRAPH-TECH — "a data graph hand-rolled as inline SVG instead of the shared svgChart engine" (owner: "all graphs should use the same tech")
The class: a chart drawn by bespoke `<svg>`/`<path>` string-building rather than `mountSvgChart` (the one engine behind Analysis / compare / calculator / decay / SP-timeline). Non-graph SVGs (muscle map `body-svg`, instructional sketches `ex-shd-svg`/`ex-pad-scene`, legend glyphs `lift-shape`) are NOT this class — leave them.
- ✅ **GRAPH-TECH-1** [ExInfo] (b.2.8.x) — the exercise-card **reps→%1RM (Nuzzo)** mini-curve (`nuzzoSvg`, `.nz-*` CSS) → converted to `mountSvgChart` (line curve + study-dot scatter + gold suggested-set dot), mounted via a new `paintExInfo` chokepoint that all 6 card-render paths now share. Dead `.nz-*` CSS removed.
- 🟠 **GRAPH-TECH-2** [Leaderboard] — the leaderboard bar chart (`lb-svg`, in the leaderboard render) is still hand-rolled inline SVG. It's a CATEGORICAL horizontal-bar ranking (one bar per athlete), not an x/y series, so the time/linear pan-zoom engine doesn't fit it cleanly — converting is a real refactor (the engine would need a categorical-bar mode) or a deliberate "not worth it". Decide before touching; the owner's "all graphs" rule applies, but this one is a different shape.

### POSE — leftover dead handlers after the 3-D/pose engine was warehoused (b.2.8.187)
The visual pose editor was warehoused (`warehouse/2026-06-10-pose-3d-engine/`) and its three.js + frames dropped, but the *handlers* that drove it remain in `main.ts` as dead code — they reference `.pose-ctl` / `.pose-scrub` / `.ex-var-pose` / `.pose-photo` containers that are emitted NOWHERE (the driving UI was removed earlier). They compile and never fire.
- 🟢 **POSE-1** [Index] (SP:1) — remove the dormant pose handlers in `main.ts`: the `.pose-ctl` click handler, the `.pose-scrub` `onScrub` input + change handlers, the empty `.pose-photo-scrub` change handler, and the no-op `refreshPoseViz()` + its ~11 dormant call sites (e.g. `scheduleRender(() => { reopenIndexDetail(ex); refreshPoseViz(); })`). Verify by grepping that no `.pose-*`/`.ex-var-*` class is ever emitted before deleting. Left in place during the warehouse change to keep that diff focused on the load win.

### CRAMP — "roomy menu / labelled segmented control instead of a compact cycling pill" (rules 15 & 16)
The class: an options menu that isn't as dense as the tightest shipped UI (the history-list ⚙ pill grid) — a mutually-exclusive choice rendered as a labelled segmented row ("Show as: Code | Short | Full") instead of ONE cycling pill, or a section header ("Settings") + roomy padding that eats vertical space.
- ✅ **CRAMP-1** [Selector] — the exercise-selector menu (BOTH Graph & History via `renderSelector`): "Show as: Code|Short|Full name" segmented row → ONE cycling `Code/Short/Full` pill; dropped the "Settings" header; settings now a tight wrapping pill row; menu padding 0.7→0.45rem, pills 0.76→0.72rem. (b.2.7.x)
- 🟠 **CRAMP-2** [Workouts] — machine-type `seg-toggle` (cable/gravity) and the add-form Day/Today `seg-toggle` are segmented button rows; per rule 15 a 2-state one could be a single cycling pill. Borderline (small, contextual) — judge before changing.
- 🟢 **CRAMP-3** — sweep other `.seg-toggle` / `*-mode` button rows in `main.ts` for the same; most value-`-lbl` chips are NOT this class (they're data, leave them).

### SNAP — "synchronous heavy re-render / imperative scroll on tap" (rule 17)
The root cause of both UI lag and scroll/close jank: interaction handlers rebuild whole view subtrees (`renderAll` / `renderWorkoutAnalysis`, ~31 `renderAll()` sites) synchronously, then patch scroll/open-state back. Tool: `deferRender(fn)` / `scheduleRender(after?)` — rAF-coalesced, scroll-preserving (in `main.ts`).
- ✅ **SNAP-1** [Perf] — `scheduleRender()` + `deferRender()` helpers; 11 last-statement `renderAll()` handler calls coalesced; `scrollIntoView` center→nearest ×3. (b.2.7.2)
- ✅ **SNAP-2** [Index] — Index taxonomy/group pills (Disciplina / muscle group / combinable / ratio): were `renderAll(); reopenIndexDetail()` sync with no scroll keep → now `scheduleRender(() => reopenIndexDetail())`; fixes "lag + scrolls down a lot".
- ✅ **SNAP-3** [Analysis] — Pratimai selector chips (remove ✕ / toggle / select-all / clear): deferred `renderWorkoutAnalysis` + instant pill feedback (remove the pill / toggle `is-on` on tap).
- 🟠 **SNAP-4** [Perf] — ~20 remaining `renderAll()` sites whose following code reads the just-built DOM stay synchronous; convert case-by-case to `scheduleRender(after)` over future turns.
- 🟢 **SNAP-5** [Perf] — root fix: targeted/incremental rendering so the DOM isn't destroyed (scroll/focus/open-state survive for free, nothing heavy to defer). Big; overlaps ARCH-1.
- ✅ **SNAP-6** [Perf] — `computedRecords()` (called ~10× per render, re-derived every logged set each time) now memoised per synchronous pass (cleared on next microtask, no staleness) — the dominant cost behind chip/pill lag. Look for the same redundant-recompute pattern elsewhere (`computeRecord`, `applyHardSetsFilter`, `exerciseCountsForUser`).
- ✅ **SNAP-7** [Analysis] — selector picks were one blocking `renderWorkoutAnalysis` per tap (graph+history+chips), so the thread locked until it finished before the next chip could go. Now **debounced** (`debounceWaRender`, 200ms): the tapped pill/chip updates itself instantly and the heavy rebuild fires once you pause — rip through chips, graph catches up. Also preserved the picker's own `.wa-chips-wrap` scrollTop across rebuilds (menu no longer snaps to top after a pick).
- 🟠 **SNAP-8** [Analysis] — even one debounced rebuild still blocks for the graph's duration (SVG mount of hundreds of points). Next: make `renderWaGraph` update the chart in place / chunk it, or render pills+list first and the graph in a later frame.
- ✅ **SNAP-9** [Analysis] — page-shift class swept whole-file, not just the reported "Hard sets only": every interaction that re-rendered with no scroll-preserve now pins scroll. `scheduleWaGraph` (covers metric/config/perBw/smoothing) made scroll-preserving at the root; `waHardOnly`, `#waFiltersClear`, `#waSearchClear`, `.wa-inc-btn`, `.wa-fchip` → `deferRender`; global change-handlers `formula`/`excludeDropsets` → `scheduleRender`, `rank`/`athlete`/`workoutGrouping`/`groupsAthlete` and the leaderboard `axisMin`/`axisMax` sliders → `deferRender`.
- 🟢 **SNAP-10** [Perf] — remaining ~12 direct `renderWorkoutAnalysis()` calls are post-edit refreshes / tab-switches / command-bar nav (scroll-reset there is fine), not the shift class — left as-is; revisit only if one is reported.
- ✅ **SNAP-11** [CSS] — `touch-action` scroll-trap class (a touch swipe over an element froze page scroll). `.svgc-plot`/`.svgc-svg` → `pan-y` (b.2.7.28); then swept the horizontal scrollers → `pan-x`. **CORRECTION (b.2.7.72):** `pan-x` ALONE is itself the trap — it disables vertical entirely, so a vertical swipe over the strip does nothing instead of chaining to the page. The right token is **`pan-x pan-y`** (sideways scrolls the strip; vertical it can't consume chains to the page). Corrected to `pan-x pan-y`: `.hm-year` (calendar), `.sitemap-box`, `.data-table-wrap`, the athlete strip. **The `.wa-sel-pills` selector strip was missed by that pass (it was `.wa-sel-pills--scroll` then, later renamed) and kept `pan-x` → reported again; fixed to `pan-x pan-y`.** Whole-file re-swept: no `touch-action: pan-x;`-alone left. Left `touch-action:none` on genuinely-interactive canvases (`.ex-pad` draw pad, `.pose3d` 3D, freepan analysis chart). **Rule:** a horizontal-scroll strip must use `pan-x pan-y`, never `pan-x` alone.
- ✅ **DROP-1** [CSS/UI] — native `<select>` pickers leaked through the app (reported: Index "Group by"). Pruned the WHOLE class: the static selects were already `enhanceSelect`-ed at init, but every DYNAMICALLY-rendered menu was left native — Index **Group by** (`#bwGroupBy`), **Show app-wide** cutoff (`#activeCutoff`) and Strength **sub-group** (`.bw-substrat`); the **calendar** Group-by (`.hm-groupby-sel`); the picker **Group by** (`#waGroupBy`); the graph-options **Aggregate**/**Interval** (`.wa-cfg`); **Create-variant** type (`#waNewType`); the **stats editor** (`#seAthlete`, `.se-sex`). Fix is class-killing + future-proof: `enhanceSelectTree()` + a `MutationObserver` on `document.body` auto-enhance every native single `<select>` added now or later into the `.xdd` dropdown (multi-selects, `#athlete`/`#viewAsSelect`, `[data-no-xdd]` exempt). New rule 20 in CLAUDE.md enforces it. If any native picker reappears, it's a select that's `display:none`-hidden before the observer sees it or one explicitly exempted — check those first.
- ✅ **POP-1** [UI] — floating popup `<details>` menus didn't close on outside-click (reported: ⚙ display options). Class was patched per-menu (`els.exerciseRange`, the svgChart legend, RIR dropdowns each had their own handler) so every new popup regressed. Root fix (PB-4): ONE global capture-phase `document` click handler closes any open `details[open]` whose first non-summary child is `position:absolute` (detected by computed position → covers all current + future floating menus; inline disclosures with static bodies are left open). Non-`<details>` popups (`.xdd`/`.xdd-rpe` divs with `.open`) keep their own close logic. See docs/persistent-bugs.md PB-4.
