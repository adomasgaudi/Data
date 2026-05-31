# Colosseum — Strength Training Dashboard

A website that shows StrengthLevel training data for a group of athletes:
leaderboards, personal records, and estimated 1RMs computed across everyone's
full set log.

The data originates on StrengthLevel and reaches the site through the **existing
Apps Script pipeline** (the scraper is intentionally *not* re-implemented here):
StrengthLevel → Apps Script → a Google Sheet ("UD") → exported to
`src/data/ud.csv`. That CSV is **bundled into the build**, so the dashboard is a
single self-contained `index.html` that validates → computes → renders entirely
in the browser, with no server or network needed at view time.

## How it fits together

```
StrengthLevel ──▶ Apps Script ──▶ Google Sheet "UD" ──▶ src/data/ud.csv
   (scrape)        (unchanged)                            │  bundled at build
                                                          ▼
                                          browser: validate → filter / sort /
                                                   compute → render
```

- **Refreshing the numbers:** drop a fresh export over `src/data/ud.csv` and
  `npm run build`. Everything downstream is derived from the data, so a new CSV
  (new athletes, new exercises) just works — nothing is hardcoded.
- The built `index.html` opens straight from disk (no server) and shows the real
  bundled data. `netlify/functions/` still holds the original server-side fetcher
  for whenever a live StrengthLevel pull is wired back up.

## Why this stack (and how it minimizes AI error rates)

10K set-entries is tiny for JavaScript — filter/sort/max run in milliseconds, so
there is no scaling problem. The only thing that matters is **correctness**,
which is where AI-written code is weakest. The design targets that directly:

| Risk (how AI errors differ from human errors) | Mitigation in this repo |
| --- | --- |
| AI can't *see* runtime data; a human would spot a 2000 kg bench by eye | `sanityCheck()` range-checks every record and surfaces outliers in the UI |
| AI errors are *systematic* — a wrong 1RM formula breaks every leaderboard | `metrics.ts` formulas are unit-tested against hand-computed values |
| Bugs come from data-shape surprises (units, "", missing fields, dropsets) | `domain.ts` parses/validates at the boundary with Zod; bad rows are recorded, not silently coerced |
| The external fetch/flatten could drift from the source shape | `rowsFromWorkout` is unit-tested; `DataEnvelopeSchema` fails loud on bad responses |
| "Reasoning about" results in prose is unreliable | Every computation is a **pure function with a test**; verified by running code |

Property-based tests (`fast-check`) pin invariants that catch whole classes of
bugs: `max(filter(x)) === filter-then-max`, sorting is a permutation, e1RM is
monotonic and never below the weight lifted. During development one of these
tests caught an arithmetic mistake in a fixture — the safety net working.

## Scoring model (how a number on the board is built)

The goal is honest numbers that represent what someone actually trained. Each set
is turned into a comparable strength figure in named steps:

- **Effective load** = `coeff × bodyweight + added weight`. The `coeff` is how much
  bodyweight a movement really loads, and it is **leverage-aware** (`defaultBwCoeff`):
  a front lever or straight-leg raise is ~0.1 (a little weight far from the pivot
  changes everything), a pull-up 0.95, a squat 0.6, a bench 0.
- **Effective 1RM** = the chosen formula (Epley / Brzycki / the bench-specific Nuzzo
  curve) applied to the effective load. Reps are **capped at `MAX_1RM_REPS`** for
  ranking so a 35-rep set can't extrapolate to a phantom max.
- **Added-weight 1RM** = effective 1RM − the bodyweight share, so the reported max is
  comparable to the weight you actually put on the bar. This is what the leaderboard,
  PRs and progress charts all use.
- **Exercise groups** (`EXERCISE_GROUPS`) fold variants into one board with a scaling
  quotient (e.g. an RDL at 0.7 counts as a ~1.43× deadlift-equivalent).
- **Training categories** (`exerciseCategory`) classify each lift (Legs/Chest/Back/…)
  for the "what they train" breakdown; **progression** is a least-squares trend
  (`linearFit`) over the 1RM history; **duplicate detection** (`nearDuplicateExercises`)
  flags typo/plural variants of the same exercise so the data can be cleaned.

All of the above are pure, unit-tested functions in `metrics.ts` / `aggregate.ts` /
`profile.ts`.

## Project layout

```
src/
  strengthlevel.ts   StrengthLevel fetch + flatten (port of the Apps Script)
  domain.ts          types, Zod boundary schemas, parseRows(), sanityCheck()
  metrics.ts         1RM formulas (Epley/Brzycki/Nuzzo bench curve), volume,
                     effectiveLoad, linearFit  (pure, per-set)
  aggregate.ts       maxBy, filter/sort, leaderboard, personalRecords,
                     addedWeight1RM, scaleToGroup, nearDuplicateExercises (pure)
  profile.ts         athletes, bodyweight coeffs (defaultBwCoeff), exercise
                     groups + scaling, exerciseCategory
  dataSource.ts      load + validate the bundled set log (src/data/ud.csv)
  config.ts          default 1RM formula
  main.ts            DOM glue
  *.test.ts          unit, property, integration, and port tests
netlify/functions/   the server-side fetcher (when wired to live StrengthLevel)
netlify.toml         Netlify build config
```

## Develop

```bash
npm install
npm test          # 90+ tests: unit + property + integration + port
npm run typecheck
npm run build     # -> dist/  (one self-contained index.html)
```

`npm run dev` serves the UI with the bundled `ud.csv` — the same real data the
build ships, so local dev and production match. `server.host` is on, so a phone
on the same Wi-Fi can open the printed Network URL.

## Deploy

The site is fully static (data is bundled), so deploy is just publishing `dist`:

1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import an existing project → pick this repo**.
3. Netlify reads `netlify.toml` — build `npm run build`, publish `dist`. Deploy.
4. To update the numbers later: replace `src/data/ud.csv` with a fresh export and
   redeploy (or rebuild locally and open `dist/index.html`).

No environment variables are required.

## Known caveats

- **Units:** StrengthLevel records each athlete's configured unit (kg or lb). The
  dashboard assumes kg and compares within the same athlete, so it stays
  internally consistent; obvious out-of-range values are flagged by the sanity
  check, and likely duplicate exercise names are flagged on the Data Health page.
- **Bodyweight-aware 1RMs are estimates:** the per-exercise bodyweight
  coefficients and the exercise-group scaling quotients are sane defaults, not
  measured truths — they're meant to be eyeballed and tuned.
