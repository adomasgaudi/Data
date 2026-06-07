# Cleanup backlog (5-level)

Senior-level cleanup/refactor backlog. Each item is graded by **Level** — the
*architectural scope* of the work, not how urgent it feels:

| Level | Scope | Who owns it |
|-------|-------|-------------|
| **L5** | System-wide architecture / single source of truth / data model | Senior |
| **L4** | Cross-cutting refactor touching several views | Senior |
| **L3** | One feature / view end-to-end | Mid |
| **L2** | Local component / function cleanup | Mid |
| **L1** | Trivial wiring / connection | Junior |

This backlog tracks **big tasks only** (L4–L5). Trivial wiring (L1–L2) is named
inside a task as a hand-off, not given its own row. Story points use the
project's modified-Fibonacci scale.

Status legend: `Backlog` · `In progress` · `Done`

---

## ARCH-1 — Workouts: one resolved dataset as single source of truth

- **Level:** L5 · **SP:** 13 · **Status:** Backlog
- **Reported:** 2026-06-07 — "simple Workouts view doesn't show set edits made in
  the advanced view."

**Symptom.** Edit sets in the advanced view; the simple Workouts list (the
"Plate lifts ×N" rows) keeps showing the old counts.

**Root cause (not a wiring slip — a bug *class*).** There are two sources of
truth. The simple view re-derives from the raw sheet data every render
(`buildWorkoutGroups` → `workoutsForUser(data.records, …)`, `src/main.ts:2496`,
`:1100`), while user edits are written into *separate overlay stores* that the
simple view never reads (`rpeGrades` / `RPE_STORE_KEY` `src/main.ts:441–457`,
plus `coeffOverrides`, `manualEntries`). Raw data and edit overlays drift apart
→ stale UI. This is the classic **derived-state anti-pattern**.

**Senior fix.** Establish one canonical dataset and make every view a read-only
projection of it:

1. **One owner of truth:** `resolvedRecords = applyEdits(data.records, edits)` —
   raw data with *all* overlays (RPE, manual sets, coefficient edits,
   additions/deletions) applied. This is the only thing views may read.
2. **Every view derives from it:** simple Workouts, advanced view, charts,
   leaderboard — none reads `data.records` or an overlay store directly.
3. **Edit → recompute → render in one path:** on any edit, write the edit store,
   invalidate the resolved dataset, re-render. No derived value (e.g.
   `workoutGroups`) outlives the data it came from ("read-your-writes").

**Why it's worth it.** This is a *data-integrity* app; a silently wrong number is
worse than a visual glitch. The fix removes the whole "edited here, missing
there" class for every present and future view, not just this screen.

**AI-first constraint.** Skip the React-Query/SWR/Apollo tooling the web
recommends — that assumes a React app + server + human team. Here it's *one
resolver function* + the rule that all views call it. The principle transfers;
the tooling does not.

**Junior hand-off (L1, do first):** trace which overlay store the advanced view
writes when a *set count* changes (RPE alone wouldn't change "×N"). ~10 min;
the architecture above holds regardless of the answer.

---
