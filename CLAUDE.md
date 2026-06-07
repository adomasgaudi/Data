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
11. **Pickable task codes:** whenever you present suggestions / options / a backlog, tag every item with a short code (e.g. `CLN-3`) so the owner can choose by code alone; the real committed `CAT-n` is still derived at commit time (rule 8).

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

## Rules to remember

*Reference / how-to for the one-line HARD RULES above — kept here only because it's too long to scan, NOT extra rules. Detailed rules added via `#remember` land here.*

- **Task codes & SP (detail for rules 5 & 8).** Category = 2–5 letters + a number; current ones: `EXR` exercises, `DATA` data tab, `CHART` graphs, `CALC` calculators, `LIFT` exercise/group/merge logic, `ATH` athlete, `WO` workouts, `META` process — coin a new one when none fits. SP = modified-Fibonacci `1,2,3,5,8,13,20,30,50,80,130,200` (1 trivial → 200 epic); a tiny text/colour one-liner may be `0.5`/`0.1`.
- **Version digits (detail for rule 1).** Normal change → bump the patch (3rd, `b.2.5.x`); a tiny text/colour one-liner → the 4th tweak digit (`b.2.5.x.x`).
- **Shipping a release — `src/changelog.ts`.** `CURRENT_VERSION`/`RELEASES` are the source of truth. To release, prepend ONE `{ version, title, sp, note }` to the flat `RELEASES` array (newest first). The history tree is built by `buildChangelogTree` (leaves → ~30-SP sub-groups → ~100-SP groups; every SP total, incl. `buildSpTimeline`, summed automatically) — never hand-nest groups or hand-total SP. `CURRENT_VERSION` reads the newest leaf.
- **Keep the on-screen version in lockstep.** Update the `<span class="version">` in `index.html` and the top changelog entry to the version you commit, then rebuild so `dist/index.html` carries it.
- **Per-part effort — `COMPONENTS` in `src/changelog.ts`.** Grades each app part's SP as a holistic Fibonacci grade (NOT a release-log sum), plus one `WEBSITE_SP`; re-grade a part up one step when it grows and keep `WEBSITE_SP` in step. Only `WEBSITE_SP` shows under the title; per-part chips live in Settings → Version history.
- **Night/dark mode** lives in the Settings panel (`#themeBtn`), not the header.
- **Section/card code names** live in `CODENAMES.md` (e.g. `IDX-CARD`, `EXR-CMP`, `S-ANL`) — read it first; keep it updated when you rename/add a section.
- **Three tiers for removing code (detail for rule 10).** This is a baked-in mindset for every AI, *especially* refactor / cleanup / meta / senior-tech (project-wide) agents — the AI decides the tier, the owner never invokes it. **Tier 3 · git is the DEFAULT:** most edits can just be deleted; history has them — don't over-ceremony routine work. The attic and warehouse are ONLY for large refactors and pruning legacy code. **Tier 1 · attic** (`attic/<name>/` + a short `NOTE.md`): mid-refactor, when it's not yet clear how much of a chunk goes — moved out of `src/` but kept closest, fastest to return because context is still fresh. **Tier 2 · warehouse** (`warehouse/<YYYY-MM-DD>-<name>/` + `manifest.json`): once *decided* a substantial chunk is out but a quick documented way back is still wanted; the manifest records origin/deps/wiring/`restoreSteps` + `movedAtSp`, and a SessionStart check (`scripts/warehouse-check.cjs`) flags it for trashing once ~100 SP of further work has shipped without it. Both tiers mean the code is **fully gone** from `src/` (no commented-out / flag-gated remnants — `tsconfig` only includes `src`, so neither folder is built/typechecked/tested). Always **restore one piece at a time** and **expect the missing-it friction** — that friction is the test of whether you actually needed it. By a refactor's end the attic is empty: every item restored, warehoused, or deleted. Full spec: `warehouse/README.md`.

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
