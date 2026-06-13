# CEO: a lift and its pattern (DL vs DL pattern) overlap — how to track both without double-counting

- **Asked:** 2026-06-13  ·  **Status:** PLANNING
- **The point it serves:** the planner is the app's "what should I DO" engine (tier ④). If a lift and its pattern fight each other, the one actionable screen becomes confusing — kills trust for tiers ① and ②.

## The question (verbatim-ish)
"DL and DL pattern are related. You can train both — you might want max deadlift AND holistic DL-pattern strength. But doing deadlifts affects DL pattern and vice versa, so there's confusion. Even if we do them separately I still want to see them together, as I won't do both on the same day and volume also combines. Think hard of a solution."

## The core insight (the hard-thinking bit)
A lift and its pattern are **not two priorities** — they are **two AXES of one training goal**:

- **INTENSITY** — push ONE variant (the competition Deadlift) toward a 1RM PR.
- **VOLUME** — accumulate weekly sets across the WHOLE pattern (any hinge variant counts).

A single hard set of the main lift advances **both at once** — which is exactly why "you won't do both on the same day": doing a deadlift *is* doing the pattern. The current model treats them as independent rows, so:
1. **Volume double-counts** — DL's 0.9/wk is already inside DL pattern's 2.3/wk; two separate weekly targets are incoherent (is the pattern's 2/wk on top of, or including, the deadlifts?).
2. **Progress cross-contaminates** — train DL, watch "DL pattern" move, feel like you didn't do what you logged.
3. **Clutter** — DL, DL pattern, Squat, SQ mix, Squat pattern listed as flat peers when they nest.

**The fix direction:** model a priority as `(pattern, optional spearhead variant, intensity target, volume target)` and **count every set exactly once**. The invariant to protect: *a member's sets contribute to its pattern's volume once, and the user never sets two targets that secretly mean the same sets.*

## Four-tier read
- **① Curious/uninterested** — the hook is a clean, bragworthy frame: "pushing my deadlift 1RM **and** building total hinge strength" on one card. Flat duplicated rows with mismatched numbers repel.
- **② Interested (easy controls)** — ONE entry with two obvious knobs (a PR target + a weekly-volume target) beats juggling two overlapping rows. Fewer decisions.
- **③ Nerds** — depth on demand: the volume breakdown per variant, the overlap math, per-facet targets, which variant is the spearhead.
- **④ Actionable** — every priority ends in one unambiguous next action ("do a heavy deadlift — it serves both" / "you're 1 hinge set short this week"). No "should I train DL or DL pattern today?" paralysis.

## The two paths (owner must pick — see Decisions)

**Path A — KEEP separate, but NEST + reconcile (smaller, no schema change).**
Detect member⊂pattern among the user's priorities, render the member nested under its pattern, and show the volume breakdown so overlap is transparent (no double-count in the head). Pattern target = total; member target = "of which ≥N heavy". Low risk, keeps today's entries.

**Path B — COLLAPSE into one "pattern + spearhead" entry with intensity/volume facets (cleaner, schema change).**
One priority = the pattern, with a chosen spearhead variant carrying the intensity (1RM) goal and the pattern carrying the volume goal. Adding both a lift and its pattern offers to merge them. Conceptually correct; more work; richer card.

**Recommendation:** **Path B** is the right long-term model (it matches the insight and the four-tier read), but **start with Path A's Phase 1** since the visibility/reconciliation work is needed either way and ships value immediately.

## The plan (phased; not padded to 100 — this is ~4 phases of real work)

### Phase 1 — Make the overlap VISIBLE & honest (no schema change) — ships value under either path
- [ ] 1. Helper: for a priority name, find which OTHER priorities are its pattern (member→patterns) or its members (pattern→members), via the existing group model.
- [ ] 2. In the planner, NEST related entries: pattern as a light parent, its tracked members indented beneath (keep flat ordering for unrelated lifts).
- [ ] 3. On a pattern row, show the volume breakdown: "2.3/wk done — DL 0.9 + 1.4 others", making clear the member's volume is included, not additive.
- [ ] 4. A subtle link badge (↔) between a member and its pattern so the relationship is legible even when not adjacent.
- [ ] 5. i18n + tests for the member↔pattern detection. Ship.

### Phase 2 — Intensity vs Volume facets (schema change) — Path B
- [ ] 6. Extend the priority record: optional `intensity` (a spearhead variant + optional 1RM target) and `volume` (weekly sets across the pattern). Migrate existing entries losslessly.
- [ ] 7. When the user adds BOTH a lift and its pattern (or a pattern, then a member), offer "merge into one focus (spearhead + volume)".
- [ ] 8. Row UI: the two facets as compact controls (a PR target on the spearhead + the weekly-volume stepper), per #cram.
- [ ] 9. Invariant test: a set counts once; merging never changes total tracked volume. Ship.

### Phase 3 — Reconcile the Live "Train today" plan
- [ ] 10. Treat a merged priority as ONE item in Train-today; doing the spearhead satisfies both facets; show per-facet progress.
- [ ] 11. Stop suggesting a lift and its pattern as two separate things to do. Ship.

### Phase 4 — Generalize & polish (#prune sweep)
- [ ] 12. Sweep every member⊂pattern pair (Squat/Squat pattern, Pull/Pull pattern, SQ mix, bench…), not just DL.
- [ ] 13. Edge cases: a lift in MULTIPLE patterns; a pattern with no separately-tracked member; spectator/user views.
- [ ] 14. Final i18n, tests, docs. Ship.

## Decisions / open questions for the owner
- **D1 (the fork):** Path A (keep separate, nest+reconcile) vs Path B (collapse into one pattern+spearhead entry)? Recommendation: B, but ship Phase 1 first regardless.
- **D2:** Is the intensity goal a real **1RM target** (a kg you're chasing), or just a flag "this variant is the max-effort focus"? (Affects Phase 2 scope.)
- **D3:** Scope for now — just Phase 1 (visibility), or commit to the full B?

## Log
- 2026-06-13 — doc created (Opus 4.8 session); PLANNING, awaiting owner direction on D1–D3.
