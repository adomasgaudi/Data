# Project memory & guidelines

This file is read automatically at the start of every session. It's where we
keep standing rules so you don't have to repeat yourself. To add a rule, just
tell me "remember: …" and it gets added as **one short line** (see below).

## ⛔ HARD RULES — read before you touch anything

Keep every rule to **one line**. This block is the fast scan no AI may miss;
detail lives in the sections below. A new owner rule is added here as a **single
line, never a paragraph** (that's how this file stays small as rules pile up).
**Scope:** every rule here applies to **adomasgaudi/\* GitHub repos only** — they live inside the repo, so they never touch other projects.

1. **Version:** AIs change ONLY the patch or 4th digit (`b.2.5.x`, `b.2.5.x.x`). **NEVER the minor or major (`b.2.x`, `b.x`) — the owner does those by hand.** Unsure → patch, or ask.
2. **Canonical branch:** this file on `claude/strength-training-dashboard-SdAlT` is the single source of truth — **start every new AI from this branch** (don't trust rules on stale side-branches).
3. **Save = commit + push** after every change (the owner only ever sees the live GitHub Pages site).
4. **Reply format:** end with a short **Summary**, then one ALL-CAPS line; links only at the very bottom.
5. **Commit subject:** `CODE (SP:n) version kebab` (e.g. `EXR-3 (SP:3) b.2.5.24 tier-list`).
6. **Two AIs at once:** each gets its own folder + branch — never share a branch.
7. **Done = merge into the canonical branch, publish (deploy), then DELETE your own working branch** — standing permission, never wait to be asked.
8. **No number clashes:** pick the task code (`CAT-n`) and version LAST, just before commit, as highest-in-history + 1; after any rebase, RE-derive both — never reuse a number already in the log.
9. **No-code project — optimise code/docs for AI, NOT humans:** owner never reads code, only AIs touch it; favour what's easiest for an AI to parse/verify/change safely (small files, tests, machine-readable structure) over human conventions/readability. (Owner *chat* stays plain-language.)
10. **Removing code — 3 tiers, default is just DELETE (git is the net):** for ordinary changes, delete freely — history has it. Only in big refactors / legacy pruning: park *undecided* chunks in **`attic/`** (closest, fastest back) and *decided-out* chunks in **`warehouse/`** (+ restore manifest, trashed after ~100 SP of further work unused). Restore ONE piece at a time; expect friction. The AI judges the tier — no owner command. See `warehouse/README.md`.
11. **Pickable, severity-tagged, UNPADDED task lists:** whenever you present suggestions / options / a backlog, tag every item with a short code (e.g. `CLN-3`) AND a severity (🔴 burning = real bug/blocker · 🟠 worth-it · 🟢 nice-to-have). List the REAL items, however many — **never pad to a round count** (5-per-level = a tell you're appeasing, not thinking). Say when a "task" isn't worth doing, and question the premise rather than generating busywork. (Committed `CAT-n` still derived at commit time, rule 8.)
12. **S-ANL is its own view:** write `S-ANL` code fresh, using full-`ANL` as *inspiration* not copy-paste/relocation — prefer rewriting over sharing, to avoid "creeping in" coupled code.
13. **Translate everything:** any new/changed user-facing text MUST get its Lithuanian entry in `src/i18n.ts` (`LT` dict) in the SAME change — the site must never show English when LT is selected.
14. **Velocity check:** weigh every estimate against the owner's real pace (~50–100 SP/day, a few SP ≈ 5–10 min) and the SP/version log — answer "worth it?" in days/SP actually spent, prefer plans that fit a day.
15. **Toggles only — NO checkboxes or button rows:** every option is a compact pressable pill/toggle (cycling for mutually-exclusive, on/off pill for booleans) that shows its state — never a checkbox, radio, or a row of separate buttons.
16. **Cram hard, tight labels:** UI is maximally compact (short labels, tight spacing, no wrapping, no essay/paragraph text on the site) AND drop obvious/redundant label words ("Include", "Show", "View", "Filter by"…) — the context already says it. **E.g. many pills/chips → ONE horizontally-scrolling row (swipe sideways, like the athlete strip), beside its button — NEVER a wrapped multi-row block that eats vertical space.**
17. **Snappy clicks:** a tap updates ITS OWN control instantly; defer heavy/app-wide re-renders to the next frame, COALESCED (rAF/debounce) — never block the tap or rebuild the whole UI synchronously on click.
18. **Version code-names (DISPLAY only):** on screen the minor shows as a Bleach zanpakutō name + `v.<patch>` (no `b.2`); internal version string stays `b.MAJOR.MINOR.PATCH`. Tables/logic in `src/versionName.ts` — major 2 = Espada (reverse rank, minor 9 = Aizen's Kyōka Suigetsu), major 3 = Gotei-13 captains.
19. **Never claim a UI/visual/scroll fix "works" — you can't see the live site.** Verified = build + tests pass (say that). UNVERIFIED = whether it actually looks/scrolls/behaves right on the owner's phone — for those, say "I changed X, please check," never "it's fixed." Repeating "fixed" on something you can't observe is hallucination; when a fix fails twice, stop guessing and give the owner something testable instead.

## Commands the owner types (act on these even with no other context)

Shortcuts the owner may type in any session. **A new command is added here as ONE line.**

- **`#remember <rule>`** — persist `<rule>` durably, then commit + push, then confirm what you saved and where. Choose its home:
  - a behaviour/preference the AI should follow → **ONE line in ⛔ HARD RULES above** (or under *Rules to remember* if it needs detail);
  - something that must happen **automatically on an event, even with no AI watching** ("always / whenever / before / after …") → a **hook** in `.claude/settings.json` (`SessionStart` / `UserPromptSubmit` / `Stop`), not just prose;
  - a large reference → its **own `.md` file**, linked from here.
- **`#careful <task>`** — for risky or many-part work; go slow, lose nothing:
  1. **Split** the task into small parts and **list every connected/affected piece** — a meta-check: *what else does this touch?* (other files, data, other COs, the live site, backups, versions).
  2. **Show the owner the numbered plan FIRST** — don't start executing yet.
  3. **Do ONE part per turn**, verify it, report, then go to the next — **never all at once** (that's what drops parts). Expect this to span several prompts.
  4. **Safety first:** before anything hard to undo (delete / overwrite / deploy), back up or confirm.
- **`#senior <task>`** — reason as architect not junior: name the single source of truth, keep other views read-only projections (no drifting copies), protect invariants, fix root cause not symptom, hand trivial wiring to "juniors"; answer RECOMMENDATION → TRADEOFFS → CONSTRAINTS.
- **`#research <topic>`** — research best practices inline and grade each source (GRADE: High/Moderate/Low/Very Low + one-line reason), but re-judge every practice for this AI-maintained no-build single-file app (rule 9), not human teams.
- **`#co-work <task>`** — other AIs are editing this repo at the SAME time; don't interfere, but never strand finished work:
  1. **Don't camp on hot files:** `git fetch` + merge the canonical branch OFTEN, keep changes small and focused, prefer files/areas the others aren't in, and RE-derive the version + task code at commit (rule 8) so numbers never clash.
  2. **Always close the loop — DEPLOY:** the moment a piece is done and verified (typecheck + tests + build), merge it into the canonical branch and push so it goes LIVE — never leave verified work sitting un-merged on a side branch, because the owner only sees the live site and will forget a stranded branch.
  3. **Expect churn:** many small clean merges beat one big risky one; on a conflict, take theirs in their area and yours in yours.
- **`#prune <mistake-type>`** — the reported case is the TIP, never the whole bug: the same class is almost always lurking in features you haven't opened and in bugs nobody has reported yet. So do NOT just fix the shown instance — that's a FAIL. **Hunt the WHOLE codebase exhaustively for every sibling:** grep every call/handler/pattern of that shape, walk every tab/feature/render path, and assume more exist until your search proves otherwise. Spend real effort *discovering problems you don't yet know exist*. Then present the full severity-tagged find-list (rule 11) and fix them in BROAD batches (the root/shared fix that kills many at once beats one-offs), verifying each. Keep going across many turns until the class is genuinely gone. **ALWAYS record every find (done + still-open, with codes) in `docs/cleanup-backlog.md`** so the sweep compounds across sessions and every AI can extend it.

## Rules to remember

*Reference / how-to for the one-line HARD RULES above — kept here only because it's too long to scan, NOT extra rules. Detailed rules added via `#remember` land here.*

- **Task codes & SP (detail for rules 5 & 8).** Category = 2–5 letters + a number; current ones: `EXR` exercises, `DATA` data tab, `CHART` graphs, `CALC` calculators, `LIFT` exercise/group/merge logic, `ATH` athlete, `WO` workouts, `META` process — coin a new one when none fits. SP = modified-Fibonacci `1,2,3,5,8,13,20,30,50,80,130,200` (1 trivial → 200 epic); a tiny text/colour one-liner may be `0.5`/`0.1`.
- **Version digits (detail for rule 1).** Normal change → bump the patch (3rd, `b.2.5.x`); a tiny text/colour one-liner → the 4th tweak digit (`b.2.5.x.x`).
- **Version code-names (detail for rule 18).** The numbers are unchanged; only the DISPLAY is renamed via `src/versionName.ts`: the minor → a Bleach zanpakutō code-name, shown small + gold, and the AI-bumped patch → grey `v.<patch>` (the `b.2` prefix is dropped on screen). Major 2 = Espada zanpakutō in REVERSE rank (`ESPADA_NAMES`: minor 0 = Glotonería … minor 7 = Arrogante … minor 9 = **Aizen's Kyōka Suigetsu**, the finale above the Espada); major 3 = Gotei-13 captain zanpakutō, reverse squad order (`CAPTAIN_NAMES`). `versionParts()` feeds the title; `displayVersion()` feeds the changelog (and handles span ranges). Add a name to the table when the owner adds a minor — never invent numbers.
- **Shipping a release — `src/changelog.ts`.** `CURRENT_VERSION`/`RELEASES` are the source of truth. To release, prepend ONE `{ version, title, sp, note, cat }` to the flat `RELEASES` array (newest first). The history tree is built by `buildChangelogTree` (leaves → ~30-SP sub-groups → ~100-SP groups; every SP total, incl. `buildSpTimeline`, summed automatically) — never hand-nest groups or hand-total SP. `CURRENT_VERSION` reads the newest leaf.
- **Keep the on-screen version in lockstep.** Update the `<span class="version">` in `index.html` and the top changelog entry to the version you commit, then rebuild so `dist/index.html` carries it.
- **Per-part effort — `COMPONENTS` in `src/changelog.ts`.** Grades each app part's SP as a holistic Fibonacci grade (NOT a release-log sum), plus one `WEBSITE_SP`; re-grade a part up one step when it grows and keep `WEBSITE_SP` in step. Only `WEBSITE_SP` shows under the title; per-part chips live in Settings → Version history.
- **Night/dark mode** lives in the Settings panel (`#themeBtn`), not the header.
- **Section/card code names** live in `CODENAMES.md` (e.g. `IDX-CARD`, `EXR-CMP`, `S-ANL`) — read it first; keep it updated when you rename/add a section.
- **Cleanup/refactor backlog** lives in `docs/cleanup-backlog.md` — a coded menu (CLN-/CUT-/ARCH-…) of organise/simplify/cut ideas across all levels. Awareness, not a mandate: be aware of it, pick items by code when asked, add/mark-done/re-grade as you go. **Feature wishlist** (things to ADD, `FEAT-` codes) lives in `docs/roadmap.md`. **Cache/backup log** (plain-language history of what each backup snapshot held, split KEEP vs CACHE) lives in `docs/cache-log.md` — add a dated entry, newest first, when a backup is reviewed.
- **Three tiers for removing code (detail for rule 10).** This is a baked-in mindset for every AI, *especially* refactor / cleanup / meta / senior-tech (project-wide) agents — the AI decides the tier, the owner never invokes it. **Tier 3 · git is the DEFAULT:** most edits can just be deleted; history has them — don't over-ceremony routine work. The attic and warehouse are ONLY for large refactors and pruning legacy code. **Tier 1 · attic** (`attic/<name>/` + a short `NOTE.md`): mid-refactor, when it's not yet clear how much of a chunk goes — moved out of `src/` but kept closest, fastest to return because context is still fresh. **Tier 2 · warehouse** (`warehouse/<YYYY-MM-DD>-<name>/` + `manifest.json`): once *decided* a substantial chunk is out but a quick documented way back is still wanted; the manifest records origin/deps/wiring/`restoreSteps` + `movedAtSp`, and a SessionStart check (`scripts/warehouse-check.cjs`) flags it for trashing once ~100 SP of further work has shipped without it. Both tiers mean the code is **fully gone** from `src/` (no commented-out / flag-gated remnants — `tsconfig` only includes `src`, so neither folder is built/typechecked/tested). Always **restore one piece at a time** and **expect the missing-it friction** — that friction is the test of whether you actually needed it. By a refactor's end the attic is empty: every item restored, warehoused, or deleted. Full spec: `warehouse/README.md`.
- **Snappy UI recipe (detail for rule 17) — the proven fix for tap lag / scroll-jump.** Never run a heavy app-wide rebuild synchronously on a tap. (1) **Instant feedback:** update the tapped control's OWN dom now — toggle its class / `aria-pressed`, or `.remove()` the pill. (2) **Defer the heavy render** with the helpers in `main.ts`: `scheduleRender(after?)` / `deferRender(fn)` (one rAF, coalesced to one render/frame, restores `window.scrollY`) for one-off taps; a `setTimeout` **debounce** (~200ms — see `debounceWaRender`) for controls tapped in BURSTS (e.g. the exercise selector) so the thread stays free between taps and the heavy view catches up once you pause. (3) **Memoise expensive PURE derivations** called many times per render — `computedRecords()` is cached per synchronous pass and cleared on the next microtask (no staleness, but list+graph+calendar share ONE compute instead of ~10); hunt the same N×-per-render recompute elsewhere (`applyHardSetsFilter`, `exerciseCountsForUser`). (4) **Preserve scroll/open-state across `innerHTML` rebuilds** — they destroy it: window scroll (in `deferRender`) and a scroll container's `scrollTop` (capture before, restore on the rebuilt node, e.g. `.wa-chips-wrap`). A **Web Worker does NOT help** — the cost is DOM rendering, which workers can't touch. Root cure = targeted/incremental rendering so nothing is destroyed (backlog `SNAP-5`); the above is the pragmatic single-thread version. Sweep log + open items: `docs/cleanup-backlog.md` → `SNAP-*`.

## Project at a glance

Strength-training dashboard (**Colosseum**). A static website that reads
StrengthLevel data and shows leaderboards, personal records and estimated 1RMs.

- Data flow: StrengthLevel → existing Apps Script → Google Sheet "UD" →
  `doGet` JSON → website (validate → compute → render). The scraper is **not**
  re-implemented on purpose.
- Stack: TypeScript + Vite + Zod + Vitest/fast-check + Chart.js.
- All filter/sort/compute logic lives in pure, tested functions
  (`src/metrics.ts`, `src/aggregate.ts`); `src/main.ts` is thin DOM glue.
- See `README.md` for full architecture, the AI-error-reduction rationale, and
  deploy/data-wiring steps.

## Working agreements

- Don't open a PR unless asked.
- Keep correctness logic in pure, tested functions; run `npm test` and `npm run typecheck` before a change is done.
