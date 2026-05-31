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
  "tweak" digit: `A.B.C.D` = major.minor.patch.tweak. Bump **D** for tiny
  edits (text, colour, one-liner) and write it 4-segment (`0.0.1.1`); bump
  **C** for a normal self-contained feature/fix, written 3-segment
  (`0.0.2`). **B**/**A** for substantial/major work. Keep the longer detail
  in the commit body as before.
- **Always keep the on-screen version in lockstep with the commit version.**
  The `<span class="version">` next to the title in `index.html` must show
  the same number as the commit you're about to make (e.g. commit
  `0.0.8.1 version-sync` → header `v0.0.8.1`). Update it in the same commit,
  then rebuild so `dist/index.html` carries it.

## Project at a glance

Strength-training dashboard (**SL Podium**). A static website that reads
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
