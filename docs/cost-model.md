# Cost model — how to report the real cost of an AI session

**Read this before quoting any cost.** Every AI working this repo prints a cost line
at the end of a turn (the `scripts/show-cost.py` Stop hook + CLAUDE.md rule 34). The
numbers are easy to get catastrophically wrong, so here is the one true method.

## Method version — **this is `cost-v.2`** (commits tag the figure `cost-v.2`)

The current estimate method is **v.2**: real cost = OUTPUT tokens (from the transcript
`usage` objects) measured against a per-model 5h-window anchor, € via the flat-plan
formula below. Commit bodies tag their cost figure **`cost-v.2`** so a future, better
method (v.3+) can re-price old updates and we'll know which estimate produced which
number. When the method changes, bump this label and note what changed.
(History: v.1 = the early API-list-price guess, retired as ~100× too high.)

## The core truth

The plan is a **flat-fee subscription** (currently €180/mo, the Max "4x/20x" tier),
**not pay-per-token**. So:

1. **API list price is a retail CEILING, ~100× the real cost.** Quoting "$120 this
   session" as if it were spend is wrong by two orders of magnitude. Show it only as a
   clearly-labelled ceiling, never as the headline.
2. **OUTPUT tokens are the only honest meter.** Cache-read tokens inflate the *raw*
   token count ~100× (a turn can show 20M "tokens" that are 99% cache reads) but they
   **barely move the real rate limits**. Measure cost off OUTPUT tokens.
3. **What you actually pay for is the rate limits**, not tokens: a rolling **5-hour
   window** and a **weekly** cap. The real "cost" of a turn is its share of those.

## The measured anchor (ground truth, 2026-06-13)

On **Opus** (Max 20x / €180 plan), the owner watched ~18 min of heavy work:
- output ≈ **52k tokens**
- moved the **5-hour Opus limit by ~1%** (7% → 8%)
- moved the **weekly limit by ~0%** (stayed 6%)

So for Opus: **~52k output ≈ 1% of a 5h window → `OUTPUT_TOKENS_PER_5H_WINDOW ≈ 5.2M`.**
A normal turn is therefore **≈ €0.01**, *not* the €15 the list price implies.

## The formula (identical for every model)

```
pct_of_5h_window = output_tokens / OUTPUT_TOKENS_PER_5H_WINDOW * 100
real_cost_eur    = (output_tokens / OUTPUT_TOKENS_PER_5H_WINDOW) / WEEKLY_WINDOWS
                   * WEEKLY_SUBSCRIPTION_EUR
```
where `WEEKLY_WINDOWS = 168/5 ≈ 33.6`, `WEEKLY_SUBSCRIPTION_EUR = 180 × 12/52 ≈ 41.54`.

## Per-model anchors — **the one thing that differs per model**

The cheaper the model, the more generous the 5h window, so **each model needs its own
`OUTPUT_TOKENS_PER_5H_WINDOW`.** The table lives in `scripts/show-cost.py`
(`OUTPUT_TOKENS_PER_5H_WINDOW_BY_MODEL`) and the hook auto-picks the row for the model
that's running, so normally **you don't touch anything** — it just works.

| model  | output ≈ 1% of 5h | `OUTPUT_TOKENS_PER_5H_WINDOW` | status |
|--------|-------------------|------------------------------|--------|
| Opus   | ~52k              | 5,200,000                    | **measured** |
| Sonnet | ~260k             | 26,000,000                   | estimate (~5× Opus) |
| Haiku  | ~500k             | 50,000,000                   | estimate (~10× Opus) |
| Fable  | ~30k              | 3,000,000                    | estimate (pricier than Opus) |

### Re-measuring your model's anchor (do this once if you're not Opus)

The estimates above are guesses. To make yours exact:
1. Do one solid chunk of work.
2. Read how many **percentage points your 5-hour limit moved** (Claude UI).
3. `OUTPUT_TOKENS_PER_5H_WINDOW = your_output_tokens / pct_5h_moved * 100`.
4. Update your model's row in `scripts/show-cost.py`, flip its status to "measured",
   and note the date.

**Sanity check:** a normal turn should read ~€0.00x and a *fraction* of a percent of a
5h window. If it's more than a few cents or more than a couple percent, your anchor is
too small — re-measure.

## What to print (rule 34)

Lead with the **real** cost (€ + ~% of a 5h window + ~% of weekly). Show the API list €
**only** as a labelled "retail ceiling (~100× real)". Never lead with list price, never
quote raw/cache token counts as if they were cost.

## Constants & where they live

All in `scripts/show-cost.py`: `MONTHLY_SUBSCRIPTION_EUR` (€180), `WEEKLY_WINDOWS`,
`OUTPUT_TOKENS_PER_5H_WINDOW_BY_MODEL`, `PRICING` (API list, for the ceiling line only).
Bump `MONTHLY_SUBSCRIPTION_EUR` if the plan changes. The version-history per-update €
cost (`PROJECT_COST_EUR` / `COST_PER_SP_EUR` in `src/changelog.ts`) uses the same
"real, not list price" philosophy — amortised spend spread across story points.

## Version-history cost: recency multiplier (cost-v.2 refinement)

The version-history € per update is distributed across story points, **model-weighted**
(an Opus version costs ~5× a Haiku one of equal SP) and now **recency-weighted**: the
most-recent `RECENT_SP_WINDOW` SP (default **100**, walking the log newest-first) are
valued at `RECENCY_EFFORT_MULT`× (default **2**) — the owner's call that recent work has
been "slower and harder" than its raw SP grade suggests. The grand total stays pinned to
`PROJECT_COST_EUR`, so this only shifts the per-version € **share** toward recent work
(a recent update reads ~2× the € it otherwise would; older work proportionally less). The
SP grades themselves are unchanged. Constants `RECENCY_EFFORT_MULT` / `RECENT_SP_WINDOW`
live in `src/changelog.ts`; widen the window or drop the multiplier to 1 to retire it.
