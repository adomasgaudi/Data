# CEO: The coach is the primary user of the live page — make it better for the coach

- **Asked:** 2026-06-09  ·  **Status:** PLANNING (awaiting owner approval of direction)
- **The point it serves:** Colosseum is a competitive strength arena. The owner
  (the coach) opens the live page most — far more than any athlete. Today the
  page is built to analyze ONE athlete's ONE exercise in depth (tier-③ nerd
  view). A coach's daily job is the opposite: scan the whole roster, spot who
  needs attention, and decide what to do. The app should open like a coach's
  cockpit, not an analyst's microscope — without losing the depth that's
  already there.

## The question (in the owner's words)
"Me — the coach — being the primary user of the live page, let's make it better."

## The reframe
The coach is not a fourth audience bolted on; the coach is the LENS. The four
`#CEO` tiers map onto the coach's own daily journey:

- **① Hook (curious / low-effort):** the moment the page opens it must hit the
  coach with something they *want* to see every day — a punchy team digest:
  "🔥 3 PRs this week · ⚠️ Jonas: 11 days no-show · 📈 team volume +12%". A
  reason to open it daily, screenshot-worthy, zero effort to read.
- **② Easy control (interested):** switching athlete, filtering the roster,
  flagging "needs attention", jumping into a lift — all one tap, no menus.
- **③ Depth (nerd):** the coach IS the nerd — the existing ANL / EXR / IDX
  deep analysis stays, but becomes one tap from any signal, with context
  carried in (athlete + exercise pre-selected).
- **④ Actionable:** every signal ends in a verb — "review", "message", "log a
  set", "adjust plan". The page produces a short coaching to-do queue, not just
  charts.

## Strategic thesis (the single big lever)
Add a **Coach Home digest** as the admin's default landing: a roster-level
attention feed that answers "who needs me today?" in 5 seconds, with one-tap
drill-down into the existing deep views. Everything else hangs off this.
(Locked/spectator athlete views — rule 21 — are untouched; this is admin-only.)

## The ~100-prompt plan
> Numbered checkbox steps in ~10 phases. Tick `[x]` + leave version/commit when
> done. Any later AI: read this file, do the next unchecked step, push, update.
> Phases 1–4 are the spine; 5–9 deepen and harden. RE-derive task codes/version
> at commit (CLAUDE.md rule 8). Ship every step (commit + push, rule 3).

### Phase 0 — Frame & measure (decide before building)
- [ ] 1. Lock the coach's #1 daily job with the owner (attention/retention vs PRs/motivation vs programming) — this orders the signals.
- [ ] 2. Confirm roster size & growth (changes strip-vs-table-vs-search design).
- [ ] 3. Confirm whether write-back (notes/messages to athletes) is in scope or the page stays read-only analysis (data comes from a Google Sheet).
- [ ] 4. Decide: new dedicated Coach Home vs enhance ANL landing in place.
- [ ] 5. Write the coach's top 5 questions ("who PR'd? who's slacking? who's stalling? who's hurt? what do I do today?") — these become the digest cards.
- [ ] 6. Add a tiny `CODENAMES.md` entry reserving `COACH` / `COACH-HOME` codes.

### Phase 1 — Coach Home skeleton (admin-only landing)
- [ ] 7. New `COACH-HOME` section, admin-only, shown on open for admins (config flag, default ON for admin, never for locked views — rule 21).
- [ ] 8. Title + date + roster size header; "View as athlete" still reachable.
- [ ] 9. A vertical stack of digest CARDS (pure render from existing computed data — no new data source).
- [ ] 10. Each card = signal + count + a one-tap action target. Empty-state for each.
- [ ] 11. Make it the NAV default for admins; keep ANL one tap away ("Deep dive").
- [ ] 12. i18n (LT) for every new string (rule 13).
- [ ] 13. Snappy: render Coach Home from the already-computed records cache, no app-wide rebuild on open (rule 17).
- [ ] 14. Ship skeleton; owner sanity-check on phone (rule 19).

### Phase 2 — Tier ① Hook cards (the "why I open it daily" signals)
- [ ] 15. **PRs this week** card: who set a new best 1RM / rep PR, per athlete, last 7 days.
- [ ] 16. **Team momentum** card: total volume / sessions this week vs last (the "+12%" line).
- [ ] 17. **Biggest mover** card: athlete with the largest 1RM jump (the bragworthy stat).
- [ ] 18. **Streaks** card: longest active training streaks across the roster.
- [ ] 19. **Shocking-stat rotator**: one surprising fact per open (e.g. "team benched 4.2 tonnes this week").
- [ ] 20. Pure compute functions for each (in `metrics.ts`/`aggregate.ts`), unit-tested.
- [ ] 21. Tasteful visual punch (accent, small spark, no roomy layout — rule 16).
- [ ] 22. Each card tap → the relevant athlete/exercise deep view, pre-selected.
- [ ] 23. i18n + test + ship each card; owner reviews which actually feel useful.

### Phase 3 — Tier ② Easy-control roster
- [ ] 24. **Roster strip** at top of Coach Home: every athlete as a chip (horizontal scroll, like the athlete strip — rule 16), tap = switch into their deep view.
- [ ] 25. Per-chip status dot (PR'd / stalled / no-show / fine) at a glance.
- [ ] 26. Sort/filter the roster: by attention, by recency, by name (one cycling pill — rule 15, not a button row).
- [ ] 27. "Needs attention" flag toggle per athlete (coach-set), persisted locally.
- [ ] 28. Quick search box for big rosters (custom `.xdd`, not native — rule 20).
- [ ] 29. Sex / cohort filter only if owner manages mixed groups (admin-only — rule 21).
- [ ] 30. One-tap "log a set for this athlete" from a chip → ADD prefilled.
- [ ] 31. Snappy per-tap feedback; defer heavy re-render (rule 17).
- [ ] 32. i18n + test + ship.

### Phase 4 — Tier ④ Actionable: the coaching to-do queue
- [ ] 33. **Attention queue** card: ranked list of athletes who need the coach today.
- [ ] 34. Rule: no-show (N+ days since last session) → "check in".
- [ ] 35. Rule: stalled lift (no 1RM progress in N weeks on a primary lift) → "review program".
- [ ] 36. Rule: form/data flag (unrecognised variation, review-tagged set) → "verify data".
- [ ] 37. Rule: deload/overreach signal (volume spike or crash) → "watch".
- [ ] 38. Each queue item carries a concrete action button (review / message / log / dismiss).
- [ ] 39. "Mark reviewed" / dismiss, persisted so the queue clears as the coach works it.
- [ ] 40. Tunable thresholds (N days, N weeks) in settings, sane defaults.
- [ ] 41. Pure, tested rule functions; queue is a projection, no duplicated state.
- [ ] 42. i18n + test + ship; owner tunes thresholds against real roster.

### Phase 5 — Tier ③ Depth wiring (carry context into the microscope)
- [ ] 43. Every Coach Home tap deep-links: set athlete + exercise + metric, then open ANL/EXR.
- [ ] 44. A persistent "back to Coach Home" affordance from deep views (admin).
- [ ] 45. Pre-select the lift that triggered a signal (e.g. the stalled bench).
- [ ] 46. Keep deep-view state when bouncing back to the digest (don't lose scroll/selection — rule 24 / snappy recipe).
- [ ] 47. Verify no regression to the existing ANL/EXR/IDX flows for non-admin/locked users.
- [ ] 48. i18n + test + ship.

### Phase 6 — Roster comparison & cohort leverage
- [ ] 49. Surface GRP (compare people) as a one-tap "compare these athletes" from the roster.
- [ ] 50. Surface STATS per-category leaderboards as a coach lens (who leads each lift).
- [ ] 51. "Cohort progress" mini-view: the whole roster's trend on a chosen lift.
- [ ] 52. Reuse existing LB/GRP/STATS compute — projection, not a rewrite (rule 12).
- [ ] 53. i18n + test + ship.

### Phase 7 — Data trust (a coach must trust the numbers)
- [ ] 54. Surface Data-health (SET-HEALTH) flags relevant to the roster on Coach Home.
- [ ] 55. "Sets to review" feed: review-tagged / unrecognised-variation sets, per athlete.
- [ ] 56. One-tap fix-in-place from a flag (jump to the set's variation chip / IDX-CARD).
- [ ] 57. Freshness indicator: last data refresh from StrengthLevel (DATA), nudge if stale.
- [ ] 58. i18n + test + ship.

### Phase 8 — Motivation loop (what the coach shares back)
- [ ] 59. A "share-worthy" snapshot per PR (clean card the coach can screenshot for an athlete).
- [ ] 60. Weekly team recap the coach can show the group (PRs, movers, streaks).
- [ ] 61. Optional per-athlete "highlight" the coach pins for them to see in their locked view.
- [ ] 62. i18n + test + ship.

### Phase 9 — Harden, polish, perf, verify
- [ ] 63. Full LT i18n sweep of all new strings (rule 13).
- [ ] 64. `#design` pass: small rounding, dense layout, cramped labels (rules 16, 22).
- [ ] 65. `#prune` pass for any pattern this introduced repeated wrong.
- [ ] 66. Snappy audit: Coach Home open + every tap stays <1 frame heavy work (rule 17).
- [ ] 67. Memoise any new N×-per-render compute (snappy recipe).
- [ ] 68. Full `npm run typecheck` + `npm test` + build green.
- [ ] 69. Owner verifies the whole flow on phone (rule 19); iterate on what doesn't feel right.
- [ ] 70. Update `CODENAMES.md`, `docs/roadmap.md`, and this file's Log; mark Status DONE.

> ~70 concrete steps; the count grows as phases 2–4 spawn per-card sub-steps in
> their own commits. Not padded to 100 — the real work is here (rule 11); we add
> steps as the build reveals them, never invent busywork to hit a number.

## Decisions / open questions for the owner (BEFORE we build)
1. **Coach Home vs enhance-in-place?** New admin landing digest, or improve the
   existing ANL landing where it stands?
2. **Coach's #1 daily job?** Attention/retention · PRs/motivation · programming
   — orders which signals lead.
3. **Roster size?** Handful vs dozens vs hundreds — changes the roster UI.
4. **Write-back in scope?** Notes/messages/flags that persist & reach athletes,
   or keep the live page read-only analysis (data is sheet-sourced)?

## Log
- 2026-06-09 — Plan drafted (PLANNING). Awaiting owner answers to the 4 questions
  above before any code.
