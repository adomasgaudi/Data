# Project memory & guidelines

This file is read automatically at the start of every session. It's where we
keep standing rules so you don't have to repeat yourself. To add a rule, just
tell me "remember: …" and I'll append it under **Rules to remember** below.

## Rules to remember

<!-- Add durable instructions here. Newest at the bottom is fine. -->

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
  one-liner) are a tweak (D, `0.0.0.1`).** Reserve **B** (minor) for genuinely
  substantial new features and **A** for major/breaking work — do NOT bump the
  minor for an ordinary feature or fix. When unsure, prefer the smaller bump.
  Keep the longer detail in the commit body as before.
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
- **Version scheme is `b.MAJOR.MINOR.PATCH`** (reset at `b.1.0.0`). **Only bump
  the minor (`b.1.x`) when a meaningful batch of work / a real feature is
  finished — NOT for every small fix.** Routine fixes, tweaks and follow-up
  adjustments bump the **patch** (`b.1.x.1`, `b.1.x.2`, …); reserve the major
  (`b.x`) for big/breaking work. When unsure, prefer the patch. The single source
  of truth is `CURRENT_VERSION`/`CHANGELOG` in `src/changelog.ts`. **Releases are
  NOT separate top-level rows — each new version is prepended as the first child
  of the current group** (right now the **`b.2`** group): add the
  child `{ version, sp, note }` at the top of its `children[]`. **The group's `sp`
  total is computed automatically (sum of its children) — do NOT hand-maintain it;
  SP totals are functionally calculated wherever possible.** `CURRENT_VERSION` reads that first child, so the on-screen
  `<span class="version">` follows automatically. Each minor is its own folded
  group (`b.1.13`, `b.1.12`, `b.1.10–b.1.11`, `b.1.6–b.1.9`, `b.1.0–b.1.5`, the
  eras). Start a new group when a new minor (`b.1.14`, …) begins.
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
- **Always weigh effort against the owner's real velocity in every tech/architecture
  decision.** Before recommending or estimating work, check the **version tree and SP
  points** (`CHANGELOG`/`COMPONENTS` in `src/changelog.ts` and the git log) to see how
  hard comparable past tasks actually were. **Calibration: the owner does ~50–100 SP
  per day; a few SP is usually ~5–10 minutes.** So translate any recommendation into
  that scale — e.g. an `SP:0.5` task is minutes, an `SP:13` task is a chunk of a day,
  and anything above ~100 SP is multi-day and should be broken up or reconsidered.
  Frame "is this worth it?" answers in **days/SP the owner will actually spend**, not
  abstract effort, and prefer plans that fit inside a day's budget.
- **Most coding advice is written for humans — re-judge it for an AI editor.** When
  researching best practices, remember the codebase is built and maintained mainly by
  an AI, not a human team. Many classic rules exist to work around *human* limits that
  don't bind an AI: mechanical refactors (rename, extract strings, restructure) are
  slow and risky for humans but fast and reliable for an AI; whole-repo search is
  instant, so "scattered code is hard to find" matters less; bulk transforms/translation
  can be redone cheaply on demand. So **don't import human best practices wholesale** —
  for each one, ask "is the cost this avoids a *human* cost?" and say which assumptions
  still hold. **What still bites an AI:** runtime correctness, subtle/unreviewed output
  (e.g. machine translations, edge cases), big noisy diffs that the human owner must
  review, and anything that needs real-world judgement or external truth. Grade advice
  on whether it survives the human→AI translation, not just on its source quality.
- **Back answers with graded research.** When answering a question that turns on
  facts, best practices, or a tech/architecture decision (not trivial lookups),
  **go find real research/sources** rather than asserting from memory, and **rate
  the quality of each source using a GRADE-style evaluation** — `High`,
  `Moderate`, `Low`, or `Very Low` — with a one-line reason for the grade (study
  type, sample/scale, recency, independence, how directly it answers the
  question). List the sources with their grades (links at the very bottom per the
  links rule), and let the overall confidence of the recommendation follow the
  best available evidence. Prefer primary/peer-reviewed or large, independent
  sources over blog hearsay; say so honestly when the best available evidence is
  only `Low`/`Very Low`.
- **`#senior` — reason as the architect, not a junior.** When the owner tags
  `#senior` (and by default for any non-trivial change), work on the *system*, not
  the line. For any bug/feature: name the **single source of truth** for each piece
  of state and make everything else a read-only **projection/derived view** (never a
  second copy that can drift — that's the "derived-state" stale-UI bug class);
  protect **system invariants**; fix the **root cause, not the symptom**; and prefer
  the smallest change that removes a whole *class* of bugs. Question unnecessary
  layers rather than defend them, be pragmatic over dogmatic, and answer
  RECOMMENDATION → TRADEOFFS → CONSTRAINTS. Trivial wiring/connection work may be
  named and handed off as "junior" tasks — but lead with the architecture decision.
- **`#research` — research best practices inline, AI-first.** When the owner tags
  `#research` (or the question turns on best practice), go find real sources *as part
  of answering* and grade them (see the GRADE rule), but **re-judge every practice for
  an AI editor in a no-build/no-team, single-file context** (see the human→AI rule):
  prefer solutions fit for an AI-maintained app over advice written for large human
  teams and heavy tooling, and say which human assumptions don't apply here.
- **Always deploy after finishing a change (no need to ask).** The live site is
  **GitHub Pages**, published by `.github/workflows/deploy.yml`, which runs on every
  push to **`claude/strength-training-dashboard-SdAlT`** (the repo's default/deploy
  branch) and on manual `workflow_dispatch`. So once work is committed on the working
  branch, also **merge it into `claude/strength-training-dashboard-SdAlT` and push** —
  that triggers the build (`npm run build`) + publish, and the live URL refreshes a
  minute or two later. No manual build/upload. **Ignore `netlify.toml` — it's stale;
  deployment is GitHub Pages, not Netlify.** This standing rule is the explicit
  permission to push to the deploy branch for deploys.
- **Night/dark mode lives in the Settings panel** (the `#themeBtn` button), not in
  the header bar.

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
- Keep correctness logic in pure functions with tests; run `npm test` and
  `npm run typecheck` before considering a change done.
