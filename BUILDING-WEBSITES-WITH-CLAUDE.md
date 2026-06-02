# Building Websites with Claude — a complete playbook

A practical guide to building correct, cheap-to-change websites with an AI pair.
This is a rewrite of an earlier one-page version. The original was good but had one
blind spot: it described a single stack (Vite + TypeScript + Zod + Vitest) as if it
were universal. Most of its advice is universal; some of it only pays off at a
certain size. **This version sorts every rule by when it applies** so you don't pay
for machinery you don't need — or skip a safety net you do.

---

## 0. How to read this guide

Two meta-rules sit above everything else:

- **Match the effort to the stakes and the scale.** A personal tracker, a client
  dashboard, and a multi-user product are three different problems. The same rule
  can be essential for one and waste for another. Every section below is tagged:
  - 🟢 **Universal** — do this in every project, even a 100-line one.
  - 🟡 **Scales up** — worth it once there's real computation or more than one user.
  - 🔵 **Stack-specific** — only relevant if you adopt a build toolchain.
- **The simplest thing that can possibly work is a real answer, not a cop-out.**
  Adding a framework has a permanent cost (build step, deps, churn). Add it when the
  project earns it, not preemptively.

> The fastest way to misuse this guide is to adopt all of it for a tiny site.

---

## 1. The core idea (mostly) holds 🟢

**AI is weakest at correctness, not speed.** It will confidently produce a wrong
formula, an off-by-one filter, or a mis-shaped object. So the strategy is:

- Push every "is this number/shape right?" decision into small, **named, isolated
  functions** you can check directly.
- Keep the visual/DOM layer thin, so there's less surface where logic can hide.

**The nuance the original missed:** "a tested function is verified by running code,
not by reasoning" is only half true. Tests verify *what you thought to test*. A
wrong invariant passes green; an untested edge case fails silently in production.
Tests are **necessary, not sufficient**. Treat a passing suite as "no known
regressions," not "proven correct." Pair tests with sanity checks (§5) and your own
spot-reading of outputs.

---

## 2. Choose your architecture by case 🟢

Pick the row that matches your project. You can move down a row later; you rarely
need to start lower than you are.

| Case | Examples | Architecture | Tests | Build |
|---|---|---|---|---|
| **A. Personal / throwaway** | a tracker for you, a one-off viz, a demo | One hand-written `index.html`, inline JS, CDN libs | Extract math into named functions; eyeball + sanity-check | None — double-click to open |
| **B. Growing / shared** | a tool a few people use, a client deliverable | Split files; pure core + thin glue; maybe a tiny build | Unit-test the computations; typecheck if using TS | Optional (esbuild/Vite) |
| **C. Production / multi-user** | a real product, anything money or safety touches | Full pure-core/thin-glue; schema at the boundary | Unit + property + typecheck, run in CI | Yes — Vite/TS or equivalent |

The original playbook is **Case C advice**. It's excellent there and overkill for
Case A. Don't migrate a working Case A app to Case C just to "follow best practice" —
that trades away its biggest asset (radical simplicity) for a correctness story a
single-user tool may not need. Migrate when you cross into the next row's examples.

---

## 3. Architecture principles

### Pure core, thin glue 🟢
Put filter/sort/compute logic in named functions with no DOM or I/O inside them.
Keep wiring (event handlers, DOM updates, storage) dumb. In a single-file app this
just means *functions at the top, wiring at the bottom* — you don't need separate
files to get the benefit.

**Correction to the original:** it claimed "bugs hide in glue far less than in
logic." That's misleading. Logic bugs are *systematic* (a wrong formula breaks every
result), which makes them scary — but glue bugs are *more common*: state desync,
storage keys, async ordering, event leaks, library config. Don't let "keep glue
dumb" lull you into not checking it. **Dumb glue still needs to be exercised** — by
actually running the app, not just trusting it.

### Derive from data, but hardcode what's genuinely fixed 🟢
"Derive everything, hardcode nothing" is too absolute. The right rule:

- **Derive** anything that varies with the data (categories, people who *appear* in
  rows, ranges, units seen).
- **Hardcode** things that are genuinely fixed and known (a closed 5-person roster, a
  list of valid roles, app constants). Forcing these to be data-driven adds
  indirection for no benefit.

Ask: "if I add a row tomorrow, should this change automatically?" If yes, derive it.
If it's a fixed fact about the app, hardcoding is correct.

---

## 4. Data at the boundary 🟡

Untrusted/external data (a CSV, an API response, localStorage from an old version)
is where shape bugs enter. Validate it once, at the edge.

- **Parse, don't assume.** With a build: a schema library (Zod) gives you a typed,
  validated object and doubles as living documentation of the shape. Without a build:
  a hand-written `parseRows()` that checks types and ranges does the same job.
- **The schema is the AI's "eyes."** Claude can't see your runtime data; an explicit
  shape lets it reason about what's actually there.

**Correction — "fail loud" is a choice, not a law.** The original said "fail loud on
a bad shape." That's right for a pipeline where a bad row means a real bug. It's
*wrong* for a resilient viewer (a personal tracker, a dashboard) where one malformed
row shouldn't blank the whole screen. Decide per project:

- **Fail loud** when bad data means something upstream is broken and you want to know.
- **Fail soft** (skip the row, record it, surface a count) when the app should keep
  working and you'll review the rejects later.

Either way: **never silently coerce.** Record what you dropped and show the count.

---

## 5. Sanity-check the numbers 🟢

The cheapest high-value habit in the whole guide, and it works in every case.

Add a `sanityCheck()` that flags implausible values *in the UI* — a 2000 kg bench, a
5 kg/day weight swing, a negative duration, a date in the future. It's the spot-check
a human eye would do, automated and always-on. It catches bad data *and* bad logic,
and it needs no test harness. If you adopt one thing from this guide for a small app,
adopt this.

---

## 6. Testing strategy, tiered 🟡

Scale the safety net to the amount of real computation, not to fashion.

- **Always (🟢):** extract computations into named functions so they *can* be tested
  or at least exercised in isolation. Even with zero formal tests, this lets you call
  a function with known inputs and read the output.
- **Once there's real math (🟡): unit tests.** Pin each formula against a
  hand-computed value. A wrong formula breaks every result systematically, so even
  one example per function is high-leverage.
- **Once invariants matter (🟡→🔵): property tests** (e.g. `fast-check`). These pin
  rules that catch whole bug classes rather than single cases:
  - `max(filter(xs)) === filterThenMax(xs)`
  - sorting is a permutation (same multiset out)
  - an estimate is never below the measured value it estimates
  Property tests are genuinely underused and worth learning — *where computation
  exists*. For a thin CRUD screen they can cost more than they catch.
- **If using TypeScript (🔵):** strict mode is a free second class of checks. Run
  `typecheck` alongside tests.
- **Before calling any change done (🟢 where a harness exists):** run the tests and
  the typecheck. If there's no harness (Case A), the equivalent is: **open the app
  and watch the thing you changed actually happen.** "It should work" is not a result.

A passing suite tells you what *didn't* break. It never tells you the behavior is
*right* — only your spec, sanity checks, and eyes do that.

---

## 7. Stack options (boring on purpose) 🔵

"Boring" means few moving parts and a self-contained output, at every tier.

- **Case A — no build.** One `index.html`, libraries via CDN (`<script src=…>`),
  state in `localStorage`/IndexedDB. Opens by double-click. No server, no env vars,
  no network at view time beyond the CDN libs. This is often the *most* boring and
  self-contained option — more so than the toolchain below.
- **Case B/C — lightweight bundler.** TypeScript + Vite + Vitest/fast-check +
  Chart.js. Vite bundles to a **single self-contained `index.html`** with data baked
  in, which still opens from disk. You get types, tests, and HMR while developing.

**Tension to resolve honestly:** the original praised "double-click, no server,
simplest thing that works" *and* mandated Vite. Those pull against each other for
small sites. Vite earns its keep when you have tests, types, or multiple source
files to manage — not before. Let the case (§2) decide, not the habit.

---

## 8. Working with Claude 🟢

These are stack-independent and the highest-leverage, lowest-cost part of the guide.

- **Keep a `CLAUDE.md` of standing rules** — style, who the owner is, versioning
  policy, "always run tests / always open the app," domain quirks. It's read every
  session so you stop repeating yourself and the AI stops re-deciding settled things.
- **Version + on-screen label in lockstep.** Bump a version string shown in the UI
  *and* in the commit message on every change (SemVer plus a 4th digit for tiny
  tweaks). The on-screen label means you can *see* which build you're looking at when
  verifying — no guessing whether your change deployed.
- **Small, verifiable steps.** One self-contained change at a time, then build/run and
  report plainly: what passed, what was skipped, what's uncertain. Big speculative
  diffs are where AI correctness fails hardest.
- **Plain-language reporting.** Click-by-click run steps, a double-clickable output
  file, a short summary, and the single most important thing to watch. Write for the
  person who has to verify it, not for yourself.
- **Leave breadcrumbs** (`AI-NOTE:` comments) when multiple agents touch the same code,
  so the next one doesn't undo a deliberate choice.

---

## 9. Working *honestly* with an AI — the suggestibility problem 🟢

This section is new, and it matters as much as the architecture.

**AI is highly suggestible.** How you ask changes the answer. "Are these all good?"
pre-loads *yes*. "Which of these are good?" invites differentiation. "What's wrong
with these?" pre-loads *no*. A model drifts toward whatever the phrasing implies, and
it agrees more readily than it should — the agreement is the path of least
resistance. Confident *source* tone ("the one idea that matters most") is itself a
suggestion, not evidence.

**For the human asking:**
- Ask for verdicts, not validation: "for each item, keep / adapt / drop, and why"
  beats "is this good?"
- Phrase neutrally when you actually want the truth; phrase leadingly only when you
  know you're brainstorming.
- Treat instant, total agreement as a yellow flag, not reassurance.

**For the AI (and a good standing rule in `CLAUDE.md`):** resisting bias isn't
"try to be objective" — that does nothing. Use mechanical steps:
1. Restate any "are these good?" as a per-item keep/adapt/drop with reasons — a
   per-item verdict makes blanket agreement impossible.
2. Force at least one counterpoint to every item, including the ones you like. If you
   can't name a failure mode, you don't understand it yet.
3. Discount the source's assertive tone.
4. Anchor judgments to external invariants — the actual repo, runnable evidence,
   general engineering facts — not to how the question was phrased.
5. Name the leading framing out loud and answer the neutral version anyway.

A blunt heuristic: when asked to evaluate something, the *useful* part of the answer
is usually the disagreement, because the agreement is the default the model slides to.

---

## 10. Run & deploy, by case 🟡

- **Case A (no build):** the file *is* the deploy. Open it from disk, or drop it on
  any static host (GitHub Pages, Netlify drag-and-drop, an S3 bucket). No env vars.
  Update data by editing the file (or its data section) and re-sharing.
- **Case B/C (build):**
  - **Run locally:** `npm install` once, then `npm run dev` → open the printed
    `http://localhost:####/`. The Network URL works from a phone on the same WiFi.
    Port taken? `npm run dev -- --port 8080`.
  - **Build:** `npm run build` → `dist/index.html`, openable from disk.
  - **Deploy:** push to GitHub, point Netlify at the repo (`netlify.toml`: build
    `npm run build`, publish `dist`).
  - **Update data:** drop a fresh CSV in `src/data/`, rebuild/redeploy. No env vars.

---

## 11. Reuse checklists, tiered

**Case A — personal / single file (🟢 minimum viable correctness):**
- [ ] One `index.html`; libraries via CDN; verify it opens from disk.
- [ ] Computations extracted into named functions (testable even without a harness).
- [ ] A `parseRows()` that checks shape and **records** (not silently drops) bad rows.
- [ ] A `sanityCheck()` that flags outliers in the UI.
- [ ] Wiring kept thin; **run the app and watch your change happen** before "done."
- [ ] `CLAUDE.md` with standing rules; version string shown on screen.

**Case B — growing / shared (add the 🟡 layer):**
- [ ] Split into files: pure core vs glue.
- [ ] Decide fail-loud vs fail-soft at the data boundary, and implement it explicitly.
- [ ] Unit tests on every computation; run them before "done."
- [ ] A lightweight build only if files/types/tests justify it.

**Case C — production / multi-user (add the 🔵 layer):**
- [ ] Vite + TypeScript scaffold; strict mode on.
- [ ] Zod schema + `parseRows()` written *first*, at the boundary.
- [ ] Property tests for the invariants you care about.
- [ ] `npm test` + `npm run typecheck` green in CI before merge.
- [ ] One self-contained `index.html` output; verify it opens from disk.

---

## 12. Claims from the original, corrected

Keep these corrections in mind — they're the spots where the confident one-pager
overshoots:

- **"Bugs hide in glue far less than in logic."** → Logic bugs are more *systematic*;
  glue bugs are more *common*. Check both; exercise the glue by running the app.
- **"Hardcode nothing."** → Hardcode what's genuinely fixed; derive what varies with
  data.
- **"Fail loud on a bad shape."** → A choice, not a law. Fail loud for pipelines, fail
  soft for resilient viewers — but never coerce silently.
- **"A tested function is verified by running code, not reasoning."** → Tests verify
  what you thought to test. Necessary, not sufficient. Pair with sanity checks and
  spot-reading.
- **"Vite + the single self-contained file" as one package.** → For small sites a
  hand-written single file is *more* boring and self-contained than a bundler. Adopt
  the toolchain when the project earns it.

---

### The shortest version

> Put correctness in small functions you can check. Validate data where it enters and
> sanity-check it on screen. Keep the visual layer thin but still *run it*. Match the
> stack to the stakes — a single file is a legitimate answer. And remember the AI will
> agree with you too easily, so ask for verdicts, not validation.
