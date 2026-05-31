# SL Podium — Strength Training Dashboard

A website that shows StrengthLevel training data for a group of athletes:
leaderboards, personal records, and estimated 1RMs computed across everyone's
full set log.

It fetches data **directly from StrengthLevel, the same way the original Apps
Script does** (load each athlete's profile → read their `user_id` → page through
`/api/workouts` → flatten every set). That fetch runs **server-side** in a
serverless function, because StrengthLevel — like most sites — refuses
cross-site calls from a browser. (That is the same reason the original logic ran
inside Apps Script on Google's servers rather than in a web page.)

## How it fits together

```
                         (runs on the server — no CORS / no browser limits)
StrengthLevel  ──▶  Netlify function /api/data  ──▶  browser
   profiles +        port of the Apps Script         validate → filter / sort /
   /api/workouts     (src/strengthlevel.ts)          compute → render
```

- The function result is cached on Netlify's edge (~6h), so the heavy scrape
  runs at most occasionally, not for every visitor.
- Open the built `index.html` as a bare local file (no server) and it shows
  bundled **sample** data instead — handy for a quick look, but not real data.

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

## Project layout

```
src/
  strengthlevel.ts   StrengthLevel fetch + flatten (port of the Apps Script)
  domain.ts          types, Zod boundary schemas, parseRows(), sanityCheck()
  metrics.ts         epley/brzycki 1RM, volume  (pure, per-set)
  aggregate.ts       maxBy, filter/sort, leaderboard, personalRecords (pure)
  dataSource.ts      fetch /api/data + validate; falls back to bundled sample
  config.ts          data-URL config (defaults to /api/data)
  main.ts            DOM glue
  fixtures/sample.json   demo data so the site renders with zero config
  *.test.ts          unit, property, integration, and port tests
netlify/functions/data.mts   the server-side fetcher, served at /api/data
netlify.toml                 Netlify build config
```

## Develop

```bash
npm install
npm test          # 42 tests: unit + property + integration + port
npm run typecheck
npm run build     # -> dist/  (one self-contained index.html)
```

`npm run dev` serves the UI, but `/api/data` only exists on Netlify, so local
dev shows the sample data. To exercise the real function locally, install the
Netlify CLI and run `netlify dev`.

## Deploy (this is what makes real data show)

The site needs a server for the fetch, so it must be deployed. Easiest:

1. Push this repo to GitHub (already done on the working branch).
2. In Netlify: **Add new site → Import an existing project → pick this repo**.
3. Netlify reads `netlify.toml` automatically — build `npm run build`, publish
   `dist`, function in `netlify/functions`. Click **Deploy**.
4. Open the site URL. First load runs the scrape (a few seconds); after that the
   edge cache makes it instant. The leaderboard now shows real data.

No environment variables are required.

## Known caveats

- **Units:** StrengthLevel returns weights in each athlete's configured unit
  (kg or lb). The dashboard assumes kg and compares within the same athlete, so
  it stays internally consistent; obvious out-of-range values are flagged by the
  sanity check.
- **First-load time / function limits:** a full scrape of ~20 athletes runs
  concurrently to fit a serverless time budget. If a cold scrape ever exceeds
  the function timeout, the fix is a scheduled pre-fetch into a cache — ask and
  it can be added.
