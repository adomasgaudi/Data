# SL Podium — Strength Training Dashboard

A static website that displays StrengthLevel training data for a group of
athletes: leaderboards, personal records, and estimated 1RMs computed across the
full set log. It reuses the **existing Apps Script pipeline** (which scrapes
`my.strengthlevel.com` into a Google Sheet) as its data source — the website
just reads, validates, computes and renders.

## How it fits together

```
StrengthLevel  ──(your Apps Script: importDATA/updatePAST)──▶  Google Sheet "UD"
                                                                     │
                                              doGet() web app  ──────┘  (JSON)
                                                                     │
                 ┌───────────────────────────────────────────────────┤
                 │ Option A: browser fetches the Apps Script URL directly
                 │ Option B: browser → /api/data (Cloudflare proxy) → Apps Script
                 ▼
            Static site (Vite + TS): validate → filter/sort/compute → render
```

**The scraper is intentionally not re-implemented.** The Apps Script already
does incremental, cached ingestion and works in production. Rewriting working
logic is one of the most reliable ways to introduce *systematic* bugs, so we
keep it and only add a tiny `doGet` JSON export (`apps-script/Export.gs`).

## Why this stack (and how it minimizes AI error rates)

10K set-entries is tiny for JavaScript — filter/sort/max run in milliseconds, so
there is no scaling problem to solve. The only thing that matters is
**correctness**, which is exactly where AI-written code is weakest. The design
targets that directly:

| Risk (how AI errors differ from human errors) | Mitigation in this repo |
| --- | --- |
| AI can't *see* runtime data; a human would spot a 2000 kg bench by eye | `sanityCheck()` range-checks every record and surfaces outliers in the UI |
| AI errors are *systematic* — a wrong 1RM formula breaks every leaderboard | `metrics.ts` formulas are unit-tested against hand-computed values |
| Bugs come from data-shape surprises (units, "", missing fields, dropsets) | `domain.ts` parses/validates at the boundary with Zod; bad rows are recorded, not silently coerced |
| AI can't tell if the external contract drifted | `DataEnvelopeSchema` validation fails loud on unexpected responses |
| "Reasoning about" results in prose is unreliable | Every computation is a **pure function with a test**; verified by running code |

Property-based tests (`fast-check`) pin the invariants that catch whole classes
of bugs: `max(filter(x)) === filter-then-max`, sorting is a permutation, e1RM is
monotonic and never below the weight lifted. During development one of these
tests caught an arithmetic mistake in the test fixture itself — the safety net
working as intended.

All logic lives in pure modules; `main.ts` is thin glue (read controls → call
pure functions → paint DOM).

## Project layout

```
src/
  domain.ts          types, Zod boundary schemas, parseRows(), sanityCheck()
  metrics.ts         epley/brzycki 1RM, volume  (pure, per-set)
  aggregate.ts       maxBy, filter/sort, leaderboard, personalRecords (pure)
  dataSource.ts      fetch + validate; falls back to the bundled fixture
  config.ts          VITE_DATA_URL wiring point
  main.ts            DOM glue
  fixtures/sample.json   demo data so the site renders with zero config
  *.test.ts          unit, property, and end-to-end fixture tests
functions/api/data.ts    optional Cloudflare Pages proxy (same-origin, cached)
apps-script/Export.gs    doGet() to add to your existing Apps Script project
```

## Develop

```bash
npm install
npm test          # 36 tests: unit + property + integration
npm run typecheck
npm run dev       # http://localhost:5173  (uses sample fixture if no VITE_DATA_URL)
npm run build     # -> dist/
```

## Wire up real data

1. Open your existing StrengthLevel Apps Script project, add `apps-script/Export.gs`.
2. Deploy → New deployment → **Web app**, *Execute as: Me*, *Access: Anyone*. Copy the `/exec` URL.
3. Choose how the site reads it:
   - **Direct:** set `VITE_DATA_URL` to the `/exec` URL.
   - **Proxied (recommended):** set `VITE_DATA_URL=/api/data` and set
     `UPSTREAM_DATA_URL` to the `/exec` URL in your host's env. The
     `functions/api/data.ts` proxy makes it same-origin and edge-caches it.

## Deploy

Static site + one serverless function → **Cloudflare Pages** (recommended:
unlimited free bandwidth, fast edge), or Vercel/Netlify.

- Build command: `npm run build`
- Output directory: `dist`
- Env vars: `VITE_DATA_URL` (and `UPSTREAM_DATA_URL` if using the proxy)

## Known caveat: units

StrengthLevel returns weights in the athlete's configured unit (kg or lb). The
dashboard assumes **kg** and compares within the same athlete/exercise (so it is
internally consistent regardless). If an athlete logs in lb, their numbers will
read high — the sanity warnings will flag obviously out-of-range values.
