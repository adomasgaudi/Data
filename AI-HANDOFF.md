# AI Handoff — standing rules for this project

Give this whole file to any AI working on this project. It combines two sources
that normally live apart:

1. **`CLAUDE.md`** — checked into the repo, read automatically each session.
2. **Local memory** — private to one machine's Claude install (folder
   `~/.claude/projects/.../memory/`); it does **not** travel with the repo, so
   its rules are copied in below to make this file complete.

The owner is **not a programmer**. Default to plain language, click-by-click
steps, and a double-clickable file over terminal commands.

---

## A. How every reply should look

- **Answer format, every time:** after the full answer, add a short **Summary**
  of only what the owner really needs to see. Then, on its own line in ALL CAPS,
  the single most burning thing to pay attention to, in 2–10 words.
- **End with a checkbox list of unfinished/pending tasks** (`- [ ] task`) —
  deferred requests, follow-ups, anything not yet done. Omit only when truly
  nothing is pending. (Owner wants an at-a-glance running list so nothing is lost.)
- **Links go at the very bottom** of the message only — never inline in the
  middle of text.
- **Describe any commands you offer.** When listing commands the owner could run
  (npm scripts, CLI, menu choices), annotate each with a 1–3 word description,
  e.g. `npm run build — rebuild site`.

## B. Versioning & commits

- **Commit message names start with a version**, then a 1–2 word kebab explainer,
  e.g. `0.0.2 athlete-pages`. Versioning is SemVer plus a 4th "tweak" digit:
  `A.B.C.D` = major.minor.patch.tweak.
  - Bump **D** for tiny edits (text, colour, one-liner), written 4-segment (`0.0.1.1`).
  - Bump **C** for a normal self-contained feature/fix, written 3-segment (`0.0.2`).
  - **B**/**A** for substantial/major work. Keep longer detail in the commit body.
- **Keep the on-screen version in lockstep with the commit version.** The
  `<span class="version">` next to the title in `index.html` must show the same
  number as the commit you're about to make (commit `0.0.8.1 version-sync` →
  header `v0.0.8.1`). Update it in the same commit, then rebuild so
  `dist/index.html` carries it.
- **Commit completed work promptly.** A data refresh (see §E) resets the working
  tree and discards uncommitted edits — a full session of work was lost this way
  once. Don't leave finished work staged across a refresh.

## C. How to make changes safely

- **Renames are project-wide.** When asked to change/rename a word (e.g. the app
  name), grep the *entire* repo (code, HTML, README, package.json + lockfile,
  .gitignore, CLAUDE.md) and update every occurrence — then rebuild so `dist/`
  carries it. A half-done rename looks broken.
- **Keep correctness logic in pure, tested functions** (`src/metrics.ts`,
  `src/aggregate.ts`); `src/main.ts` is thin DOM glue. Run **`npm test`** and
  **`npm run typecheck`** before considering any change done.
- **Leave breadcrumbs for other AIs.** Multiple AI sessions edit this repo at
  once and can't talk except through files/git. When something must survive
  another AI's edits (an invariant, a pending fix), leave a short code comment
  prefixed `AI-NOTE (Claude):`. Prefer one-AI-per-file and let a commit land
  between hand-offs.

## D. Product rules

- **No canned AI/auto-written "summary" text in the dashboard UI.** The data
  changes constantly, so any baked-in summary goes stale and misleads. Show only
  values computed live from the data (leaderboards, 1RMs, counts, plain labels).
  A real **in-app AI summarizer** (serverless function calling the Claude API) is
  wanted eventually — only then do dynamic summaries belong in the product. Don't
  fake it with static text.

## E. Data refreshes (`src/data/ud.csv`)

The bundled `ud.csv` is swapped for a fresh export often. Refreshing = replace
the file and `npm run build`; nothing else should need touching. Invariants to
preserve so a refresh never requires code edits or breaks the app:

- Derive everything from the data at load (athletes, exercises, dates). **Never
  hardcode** the current roster or exercise list in logic.
- New exercises default gracefully: bodyweight coefficient falls back to 0
  (`profile.ts` → `EXERCISE_BW_COEFF` + `coeffFor` + `DEFAULT_BW_COEFF`).
- New athletes missing from the profile table (`ATHLETES` in `profile.ts`) must
  not crash: bodyweight lookup returns null, math degrades (0 bodyweight part),
  UI shows "not on file".
- Bad rows are validated at the Zod boundary (`domain.ts`) and surfaced in the
  Data health panel, **not silently coerced**.
- localStorage coeff overrides are keyed by exercise name; renamed/removed
  exercises simply stop matching (harmless).
- The test data is a small fixture independent of `ud.csv`; always run
  `npm test` + `npm run typecheck` after changes.
- **Caution:** the refresh routine resets the working tree — commit first (see §B).

---

## F. Project at a glance

Strength-training dashboard (**Colosseum**). A static website that reads
StrengthLevel data and shows leaderboards, personal records and estimated 1RMs.

- **Data flow:** StrengthLevel → existing Apps Script → Google Sheet "UD" →
  `doGet` JSON → website (validate → compute → render). The scraper is **not**
  re-implemented on purpose.
- **Stack:** TypeScript + Vite + Zod + Vitest/fast-check + Chart.js.
- All filter/sort/compute logic lives in pure, tested functions; `src/main.ts`
  is thin DOM glue. See `README.md` for full architecture, the AI-error-reduction
  rationale, and deploy/data-wiring steps.

## G. Working agreements

- Develop on branch `claude/strength-training-dashboard-SdAlT`. Commit and push
  when work is complete. Don't open a PR unless asked.
- To add a standing rule, the owner says "remember: …" and it gets appended to
  `CLAUDE.md` (or saved to memory). Keep this handoff file in sync if you do.
