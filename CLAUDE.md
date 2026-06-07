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
4. **Owner is non-technical:** plain language, click-by-click, no jargon.
5. **Reply format:** end with a short **Summary**, then one ALL-CAPS line; links only at the very bottom.
6. **Commit subject:** `CODE (SP:n) version kebab` (e.g. `EXR-3 (SP:3) b.2.5.24 tier-list`).
7. **Two AIs at once:** each gets its own folder + branch — never share a branch.
8. **Done = merge into the canonical branch, publish (deploy), then DELETE your own working branch** — standing permission, never wait to be asked.
9. **No number clashes:** pick the task code (`CAT-n`) and version LAST, just before commit, as highest-in-history + 1; after any rebase, RE-derive both — never reuse a number already in the log.
10. **No-code project — optimise code/docs for AI, NOT humans:** owner never reads code, only AIs touch it; favour what's easiest for an AI to parse/verify/change safely (small files, tests, machine-readable structure) over human conventions/readability. (Owner *chat* stays plain-language — rule 4.)

## Rules to remember

<!-- Add durable instructions here. Newest at the bottom is fine. -->

- **Always push.** After finishing any change, commit and push to the working
  branch (`claude/strength-training-dashboard-SdAlT`) without being asked — never
  leave work only committed locally.
- The repo owner is **not a programmer**. Explain things in plain language,
  avoid jargon, and when something needs to be opened/run, give click-by-click
  steps (and a double-clickable file where possible) rather than terminal
  commands.
- **Answer format, every time:** after the full answer, add a short
  **Summary** of only what the owner really needs to see. Then, on its own line
  in ALL CAPS, the single most burning thing to pay attention to, in 2–10 words.
- **Links go at the very bottom** of the message only — never inline in the
  middle of text.
- **Commit message names start with a version** then a 1–2 word kebab
  explainer, e.g. `0.0.2 athlete-pages`. Versioning is SemVer plus a 4th
  "tweak" digit: `A.B.C.D` = major.minor.patch.tweak. **Default to a small
  bump — most changes are a patch (C, `0.0.1`); smaller ones (text, colour,
  one-liner) are a tweak (D, `0.0.0.1`).** **The owner — not the AI — bumps B
  (minor) and A (major); an AI only ever changes C (patch) or D (tweak).** When
  unsure, prefer the smaller bump. Keep the longer detail in the commit body.
- **Give every task a code + size.** Each task the owner gives gets a code:
  a 2–5 letter **category** + a number (e.g. `EXR-3`, `DATA-1`, `CHART-2`), plus
  a Scrum **story-point** estimate on the **modified-Fibonacci scale: `1, 2, 3, 5,
  8, 13, 20, 30, 50, 80, 130, 200`** (1 trivial → 200 epic) — prefer a value from
  that set. **For a genuinely tiny change a fractional `0.5` or `0.1` SP is
  allowed** (a one-line text/colour tweak can be `SP:0.1`), even when it's
  relevant work. Put `CODE (SP:n)` at the **start of the commit subject, before the
  version**, e.g. `EXR-3 (SP:3) 0.36.0 tier-list`, and lead the chat reply with
  the same `CODE (SP:n)`. Recorded in commit + chat only (no separate file).
  Reuse a category for related areas — current ones: `EXR` exercises view,
  `DATA` data tab, `CHART` graphs/diagrams, `CALC` calculators, `LIFT`
  exercise/group/merge logic, `ATH` athlete view, `WO` workouts, `META`
  process/versioning. Coin a new 2–5 letter category when none fits.
- **Version scheme is `b.MAJOR.MINOR.PATCH`** (reset at `b.1.0.0`). **AIs bump
  ONLY the patch (`b.2.5.x`) or a 4th tweak digit (`b.2.5.x.x`) — NEVER the minor
  (`b.2.x`) or major (`b.x`). The owner makes minor/major bumps by hand; if you
  think one is due, STOP and ask.** Every fix, tweak, feature or follow-up an AI
  ships is a patch/tweak, no matter how big it feels. The single source
  of truth is `CURRENT_VERSION`/`RELEASES` in `src/changelog.ts`. **To ship a
  release, prepend ONE `{ version, title, sp, note }` to the flat `RELEASES`
  array** (newest first) — that's it. The nested history tree is BUILT
  automatically by `buildChangelogTree`: leaves bucket into ~30-SP sub-groups,
  those into ~100-SP groups (group → sub-group → release), every SP total summed
  up the tree and each group titled by its biggest release + version span. **Do
  NOT hand-nest groups or hand-maintain any `sp` total — it's all functionally
  calculated**, including the SP-over-time graph (`buildSpTimeline`).
  `CURRENT_VERSION` reads the newest leaf, so the on-screen
  `<span class="version">` follows automatically.
- **Always keep the on-screen version in lockstep with the commit version.** The
  static `<span class="version">` in `index.html` and the top `CHANGELOG` entry
  must both show the version you're committing; update both in the same commit,
  then rebuild so `dist/index.html` carries it.
- **Per-section effort (SP, not versions):** `COMPONENTS` in `src/changelog.ts`
  lists the **story points spent on each app part** (Exercises, Athlete, Workouts,
  Graphs, Leaderboard, Data, Calculator, Add, Navigation, Stats, Group), plus a
  single `WEBSITE_SP` whole-site grade. The SP is a **holistic grade on the
  modified-Fibonacci scale** (`1,2,3,5,8,13,20,30,50,80,130,200`), NOT a sum of the
  release log. When a part grows materially, **re-grade it up one step** (e.g.
  `10 → 20`) in the same commit; keep `WEBSITE_SP` in step too. **Under the title
  only the whole-site SP is shown — the per-part chips are NOT duplicated there;
  they live in Settings → Version history.**
- **Night/dark mode lives in the Settings panel** (the `#themeBtn` button), not in
  the header bar.
- **Section/card code names live in `CODENAMES.md`** — the shared vocabulary for
  pointing at any screen or card (e.g. `IDX-CARD`, `EXR-CMP`, `S-ANL`). Read it first;
  keep it updated when you rename/add a section.

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

- Develop on branch `claude/strength-training-dashboard-SdAlT`. Commit and push
  when work is complete. Don't open a PR unless asked.
- **Always merge, publish & delete — standing permission, never ask.** When a
  change is done: merge your working branch into the canonical branch
  `claude/strength-training-dashboard-SdAlT`, push so it deploys live, then
  **delete your own working branch** (local + remote). For THIS repo that
  permission is already granted here — it overrides any generic "don't push to
  another branch without asking" default a session may start with.
- Keep correctness logic in pure functions with tests; run `npm test` and
  `npm run typecheck` before considering a change done.
