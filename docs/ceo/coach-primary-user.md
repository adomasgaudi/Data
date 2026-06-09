# CEO: The coach is the primary user of the live page — make it better for the coach

- **Asked:** 2026-06-09  ·  **Status:** PLANNING (direction set by owner; one architectural fork open — see Decisions)
- **The point it serves:** Colosseum is a competitive strength arena, but the
  person on the page most is the COACH, working **one client at a time**. The
  coach's job isn't analysis for its own sake — it's **prescription**: decide
  what this client should train next and hand it to them. The live page should
  become the coach's session-building cockpit, with the existing deep analysis
  feeding the decisions underneath.

## The question (in the owner's words)
"Me — the coach — being the primary user of the live page, let's make it better."

## What the coach actually does (owner's answer — the spec)
Working one client at a time, the coach needs to:
- **Figure out the client's PRIORITY exercises** (what matters for this client now).
- Decide the **progression lever** per exercise:
  - needs **more weight**, or
  - needs **more volume**, or
  - needs **more stamina** → longer sets or **dropsets**.
- Add **auxiliary / safety** exercises.
- **Remember left-out body parts** (coverage gaps).
- **Remember maintenance exercises** (lifts that must be kept up, not progressed).
- **Calculate working weights for hard sets.**
- **Calculate warmups.**
- And (owner) the resulting plan should **reach the athlete** (their locked view).

## The reframe (four `#CEO` tiers, coach-as-lens)
- **① Hook:** open the page on a client and immediately see **"here's today's
  session draft for [client]"** — priorities, gaps, and a ready prescription. A
  reason to open it before every session.
- **② Easy control:** one-tap to set each lift's lever (weight ↑ / volume ↑ /
  stamina ↑ / add auxiliary), recalc weights, swap an exercise.
- **③ Depth:** every recommendation is backed by the existing deep analysis
  (1RM trend, volume, stalls) — one tap to inspect why.
- **④ Actionable:** the output IS the action — a finished session prescription
  **sent to the client**, not just charts.

## Strategic thesis (the single big lever)
Turn the live page (for the admin/coach, one client selected) into a **Session
Prescription Cockpit**: it reads the client's data, flags priorities + coverage
gaps, recommends a progression lever per lift, computes hard-set weights and
warmups, lets the coach assemble today's session, and **delivers it to the
client's locked view**. Read-analysis stays underneath; prescription is the new
top layer.

> PARKED IDEA (owner: "mark this as an idea"): a roster-level **Coach Home
> digest** (scan all athletes: who PR'd / stalled / vanished). Not now — the
> coach works one client at a time. Recorded as `FEAT-20` in `docs/roadmap.md`.

## The ~100-prompt plan
> Numbered checkbox steps in phases. Tick `[x]` + leave version/commit when done.
> Any later AI: read this file, do the next unchecked step, push, update it.
> RE-derive task codes/version at commit (CLAUDE.md rule 8). Ship every step
> (commit + push, rule 3). Phases 1–4 are the spine (coach-side value with NO
> backend); Phase 5 is the write-back to athletes (needs the architectural
> decision below); 6–8 deepen and harden. Not padded — steps grow as the build
> reveals sub-steps (rule 11).

### Phase 0 — Frame & decide
- [ ] 1. Resolve the write-back fork (Decisions Q1) — how a prescription reaches the athlete (data is one-way today). Blocks Phase 5 only; Phases 1–4 proceed regardless.
- [ ] 2. Define the **Prescription model** (typed): client, date, list of items {exercise, lever, target sets×reps, working weight, warmup ramp, note}, plus auxiliary + maintenance flags. Pure types in a new `src/prescription.ts`.
- [ ] 3. Confirm "hard set" definition with owner (target reps + RIR? % of 1RM?) and the warmup scheme (ramp steps, %s) — drives the calculators.
- [ ] 4. Reserve codes in `CODENAMES.md`: `RX` (prescription cockpit) + sub-cards.
- [ ] 5. Record the parked roster-digest idea as `FEAT-20` (done in this commit).

### Phase 1 — Coverage & priorities (per selected client, READ-only, no backend)
- [ ] 6. **Coverage map**: which muscle groups / body parts the client trained in the last N days vs not (reuse IDX taxonomy + recent sets). Pure + tested in `aggregate.ts`.
- [ ] 7. **Gaps card**: surface LEFT-OUT body parts (trained least / not at all recently).
- [ ] 8. **Maintenance-due card**: lifts the client used to do but hasn't recently (should be maintained), with "days since".
- [ ] 9. **Priority exercises**: rank the client's lifts by tier (Primary/Secondary/Tertiary) × recency × stall, into a "focus today" shortlist.
- [ ] 10. Render these as compact cards in a new `RX` section, admin-only, when a single client is selected (locked views never see it — rule 21).
- [ ] 11. i18n (LT) all strings (rule 13); snappy render from the records cache (rule 17).
- [ ] 12. Ship; owner sanity-checks the priorities/gaps feel right for a real client.

### Phase 2 — Progression-lever recommendation (per priority lift)
- [ ] 13. Pure rule: detect **stalled weight** (no 1RM progress in N weeks) → suggest a lever.
- [ ] 14. Lever **more weight**: when reps/RIR show headroom on a progressing lift.
- [ ] 15. Lever **more volume**: when weight is maxing but work capacity is low.
- [ ] 16. Lever **more stamina** (longer sets / **dropset**): when the goal is endurance / high-rep lifts.
- [ ] 17. Lever **add auxiliary / safety**: suggest related antagonist / prehab lifts for an at-risk or unbalanced pattern.
- [ ] 18. Each lift shows a recommended lever as a one-tap pill the coach can override (cycling pill — rule 15).
- [ ] 19. Pure, tested recommendation functions (`metrics.ts`/new module); explain WHY in one line.
- [ ] 20. i18n + test + ship; owner tunes the rules against real clients.

### Phase 3 — Weight & warmup calculators (concrete, high-value)
- [ ] 21. **Hard-set weight**: from the client's current 1RM (existing FORM curve) + target reps/RIR → working weight. Reuse `formulas`, don't re-derive.
- [ ] 22. **Warmup ramp**: generate ramp sets (e.g. empty bar → ~50/70/85% → working weight) per lift, rounded to plate/loadable increments.
- [ ] 23. Per-exercise loadable-increment awareness (barbell vs dumbbell vs bodyweight/level lifts — reuse the level/variant logic).
- [ ] 24. Bodyweight & level lifts (push-ups etc.): express "harder/easier" as the technique level (incline cm / squat-rack hole) instead of kg.
- [ ] 25. Pure, property-tested calculators (fast-check) — these must be trustworthy.
- [ ] 26. i18n + test + ship; owner verifies the weights/warmups match what they'd prescribe.

### Phase 4 — Prescription builder (assemble today's session)
- [ ] 27. Assemble the selected lifts + levers + weights + warmups into one editable **session draft** for the client + date.
- [ ] 28. Add/remove/reorder exercises; pull from priorities, gaps, maintenance, or search (custom `.xdd` — rule 20).
- [ ] 29. Per-item edit: sets×reps, weight (auto from calc, overridable), dropset toggle, note.
- [ ] 30. Auxiliary + maintenance sections clearly grouped.
- [ ] 31. Save the draft locally (persists on the coach's device) so it survives reloads.
- [ ] 32. Cramped, dense layout; small rounding (rules 16, 22); snappy edits (rule 17).
- [ ] 33. i18n + test + ship; this is usable by the coach even before delivery exists.

### Phase 5 — Reaches the athlete (write-back — needs Decisions Q1)
- [ ] 34. Implement the chosen delivery channel (see Decisions Q1) — store the prescription somewhere the athlete's session can read.
- [ ] 35. Athlete LOCKED view shows **"Today's plan from your coach"** (read-only) — never the cockpit (rule 21).
- [ ] 36. Athlete can see warmups + working weights + notes for each lift.
- [ ] 37. Status: sent / seen / done (as far as the channel allows).
- [ ] 38. Handle no-plan and stale-plan empty states gracefully.
- [ ] 39. i18n + test + ship; owner + a test client verify delivery end-to-end.

### Phase 6 — Close the loop (did they do it?)
- [ ] 40. After the client logs sets, compare prescribed vs actual (adherence) on the cockpit.
- [ ] 41. Surface "did less / more than prescribed" to inform next session's levers.
- [ ] 42. Feed adherence back into Phase-2 recommendations.
- [ ] 43. i18n + test + ship.

### Phase 7 — Depth wiring & data trust
- [ ] 44. Every cockpit lift → one tap into its deep ANL/EXR analysis, pre-selected, with a way back.
- [ ] 45. Surface data-health flags for the client (review-tagged / unrecognised sets) so the coach trusts the inputs (SET-HEALTH).
- [ ] 46. Freshness: warn if the client's data is stale before prescribing.
- [ ] 47. i18n + test + ship.

### Phase 8 — Harden, polish, perf, verify
- [ ] 48. Full LT i18n sweep (rule 13); `#design` pass (rules 16, 22); `#prune` pass for new repeated patterns.
- [ ] 49. Snappy audit + memoise any new N×-per-render compute (rule 17 recipe).
- [ ] 50. `npm run typecheck` + `npm test` + build green; property tests for all calculators.
- [ ] 51. Owner verifies the whole flow on phone (rule 19); iterate on feel.
- [ ] 52. Update `CODENAMES.md`, `docs/roadmap.md`, this Log; mark Status DONE.

> ~52 backbone steps; Phases 1–4 each spawn per-card/per-lever sub-steps in their
> own commits as we build, growing toward ~100. We add steps as work reveals
> them — never invent busywork to hit a round number (rule 11).

## Decisions / open questions for the owner
1. **How should a prescription REACH the athlete?** (the one hard constraint —
   data is currently one-way: sheet → site). Options:
   - (a) Same Google Sheet: a new "prescriptions" tab the Apps Script also
     serves via `doGet`; coach writes to it (needs a write path / `doPost` or a
     small form). Keeps one data home.
   - (b) A lightweight separate store (e.g. a tiny key-value / paste link / its
     own endpoint) just for prescriptions.
   - (c) Phase it: build the whole coach-side cockpit first (Phases 1–4, no
     backend), deliver prescriptions manually (screenshot/share) until we pick a
     real channel. **(Recommended — fastest value, defers the hard part.)**
2. **"Hard set" definition?** Target reps + RIR (e.g. 5 reps @ RIR 2), or % of
   1RM? Drives the weight calculator.
3. **Warmup scheme preference?** Default ramp (empty bar → ~50/70/85% → working)
   or your own percentages/step count?

## Log
- 2026-06-09 — Plan v1 drafted (roster digest). Owner answers reframed it.
- 2026-06-09 — Plan v2: pivoted to per-client **Session Prescription Cockpit**;
  roster digest parked as `FEAT-20`. Awaiting owner answers to Decisions Q1–Q3
  before code (Phase 0).
