# Project memory & guidelines (LEAN CORE)

This is the **always-loaded core** — only the rules that fire on *every* turn or
are invariants that can be broken from anywhere. Area detail (UI, release, git,
data, replies, process) is **injected on demand** by hooks when you act in that
area; command playbooks (`#careful`, `#senior`, …) are injected when you type the
trigger. **Rule numbers are STABLE IDs** — gaps are normal (that rule lives in an
on-demand doc or the archive, not deleted). To add a rule: `#remember`.

> Refactored b.2.9.31x from a 182-line monolith. The FULL original is archived
> verbatim at `docs/archive/claude-md-full-b.2.9.310.md` — a **last resort only**:
> do NOT read it by default. The lean core + the on-demand docs (below) are
> authoritative. Consult the archive ONLY if you suspect a rule existed that the
> new system dropped — then port it into the right place (core / doc / hook),
> never just follow it from the archive.

## ⛔ CORE RULES — every turn

**Talking to the owner (the owner barely reads prose — be terse, structured):**
- 4. **Reply = details first, Summary LAST.** Summary opens `User: <task recap>`, then TITLE-ONLY 2–5-word points (same labels as the body), then unfinished/suggestions. No ALL-CAPS line.
- 11. **Lists are severity-tagged & UNPADDED** (🔴 burning · 🟠 worth-it · 🟢 nice) — list the REAL items, never pad to a round count; question the premise over busywork.
- 19. **Never claim an unobservable (visual/scroll/perf) fix "works"** — you can't see the live site. "Verified" = build+tests pass; visuals = "I changed X, please check."
- 25. **Unknown `#tag` → SEARCH first** (grep CLAUDE.md, docs/*, the archive) for the closest rule/command, act on that, say which you matched. Never silently skip it.
- 26. **NEVER cite a rule by NUMBER to the owner** — quote its wording instead. Numbers are for AI scanning only.
- 50. **End EVERY reply with your session scientist name** on its own line (pick the next scientist after the newest `ai:` chip in `src/changelog.ts`; set `ai:` on every release you add). Detail: `docs/rules/replies.md`.
- 52. **Every question/decision/ask = an `AskUserQuestion` popup**, dead-simple & jargon-free, recommended option first — never a question buried in prose. But NOT just to ask "what next" when nothing blocks.
- 39/40/34. **End every substantive reply with the cost block + model/version line** — RUN `scripts/show-cost.py` and quote it VERBATIM; never guess numbers.

**Always true:**
- 9. **No-code project — optimise code/docs for AI, not humans** (small files, tests, machine-readable). Owner never reads code; owner *chat* stays plain-language.
- 36. **Default model = Haiku** for routine work; escalate to Sonnet only if Haiku fails; Opus/Fable only if the owner asks.
- 14. **Velocity check** — weigh estimates against the owner's ~50–100 SP/day; prefer plans that fit a day.
- 38. **A forgotten rule → enforce with a HOOK, not more prose** (`scripts/rules-check.cjs`, Stop). 61. **Prune as you go** — every change deletes the dead code it orphans (git is the net); never net-only growth.
- 70. **Lock-in / done-contract (mechanical):** close shipped work with a `===TASK-DONE===` block (shipped/verified/cost/files) → auto-logged to `docs/session-log.md`. `#lock <task> [€]` / `#unlock` = focus mode (re-anchor each turn + €-spend check-in). See `scripts/lock-task.cjs`.

**Invariants — breakable from ANY file, so they stay here:**
- 2/3/7/8. **Branch & save:** authoritative branch = **`opus-4.8`** (old `claude/strength-training-dashboard-SdAlT` DEPRECATED); **save = commit + push** every change; **done = deploy + propagate**; pick task code + version LAST and re-derive after a rebase (no clashes). Detail: `docs/rules/git.md`.
- 29. **Every change bumps the patch version** + updates `index.html` `<span class="version">` + prepends a `src/changelog.ts` RELEASES entry (model-stamped) — all three, together. Detail: `docs/rules/release.md`.
- 13. **Translate everything** — any new/changed user-facing text gets its LT entry in `src/i18n.ts` the SAME change (site must never show English in LT).
- 21. **Locked/spectator (non-admin) views show ONLY the logged-in athlete** + public profiles — never other athletes' chips, the M/W menu, or admin tabs. Privacy invariant.
- 49. **Strength maths:** calc on the EFFECTIVE 1RM, display the ADDED-weight number; a wrong formula breaks every board silently. Detail: `docs/rules/data.md`.
- 42. **`#ai-only` — never hand the owner a backend/SQL/code chore;** the AI does all code/DB work, the owner only reads the live site + chat.

## On-demand docs (injected automatically by hooks — this is the index)

**Area rulesets** (`docs/rules/`) — injected by the PreToolUse hook when you edit that area, also read them yourself if you work there:
- **ui.md** — editing `src/styles.css` / `src/main.ts`: #toggle, #cram, rounding, tap size, menus, colours, dropdowns, loading, snappy clicks (rules 15–17, 20, 22–24, 27, 28, 31, 32, 46, 47, 60, 66, 67).
- **release.md** — editing `src/changelog.ts` / `index.html`: version digits, commit subject+body, code-names, changelog shipping (rules 1, 5, 18, 29, 37, 48).
- **git.md** — committing/pushing/branching: branches, deploy+propagate, task codes & SP (rules 2, 3, 6, 7, 8, 59).
- **data.md** — data/metrics/supabase/lift code: SSOT, Supabase PK, effective-load, notes-are-user-only, lens (rules 21, 23, 30, 41, 49, 58, 62).
- **replies.md** — composing a reply: nested label format, summary tail, cost block, scientist list (rules 34, 43, 45, 50).
- **process.md** — refactor/remove/debug-tooling: 3-tier removal, S-ANL, one-component, on-screen dbg (rules 10, 12, 51, 65, 68, 69).

**Command playbooks** (`docs/commands/`) — injected by the UserPromptSubmit hook the moment the owner types the trigger:
`#?` (triage gate) · `#careful` · `#senior` · `#prune` · `#co-work` · `#ui` · `#debug` · `#super-persistent` · `#persistent`/`#repeating` · `#CEO` · `#tokens` · `#research`.

**Core commands** (act on these directly):
- **`#remember <rule>`** — persist durably: a behaviour → one CORE line here; an event-driven "always/whenever" → a hook in `.claude/settings.json`; a big reference → its own doc. Then commit + push, confirm where.
- **`#design <choice>`** — a forever look/feel choice: add to `docs/rules/ui.md`, prefer a `:root` token, sweep the codebase for violations (a `#design` is a `#prune`).
- **`#lock <task> [€]` / `#unlock`** — focus mode (rule 70).

## Project at a glance

Strength-training dashboard (**Colosseum**) — a static site reading StrengthLevel
data, showing leaderboards, PRs and estimated 1RMs. Data flow: StrengthLevel →
Apps Script → Google Sheet "UD" → `src/data/ud.csv` (bundled) → browser
validate → compute → render. Stack: TypeScript + Vite + Zod + Vitest/fast-check +
Chart.js. All compute lives in pure, tested functions (`src/metrics.ts`,
`src/aggregate.ts`); `src/main.ts` is thin DOM glue. Full architecture: `README.md`.

## Working agreements

- Don't open a PR unless asked. Keep correctness in pure tested functions; run
  `npm test` + `npm run typecheck` before a change is done.
- Reference docs: `CODENAMES.md` (section names), `docs/persistent-bugs.md` (PB-n),
  `docs/cleanup-backlog.md` (CLN/CUT), `docs/roadmap.md` (FEAT), `docs/ui-taste.md`,
  `docs/cost-model.md`, `warehouse/README.md` (code removal tiers).
