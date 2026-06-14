# Plan: strength percentiles (3 populations) + custom benchmarks, per lift

- **Asked:** 2026-06-14  ·  **Status:** Phases 1–3 shipped → next: Phase 4 (lift card, when it cools) + Phase 5 (real data)
- **Owner decisions (#? answers):** show **all 3 populations** (general / StrengthLevel-gym / professional), **estimates OK now, find real data later**; **plan both features first, then build.**

## The two features
1. **Percentile panel** — for a lift, in **bw-relative** terms, what each percentile of three populations can do: **general pop**, **StrengthLevel users (gym pop)**, **professionals**. Shown on the **World Records page** and each lift's **WR section in the Index** (lift card). Also places "you" (the athlete's current 1RM) on the curve → the brag stat ("you out-lift N% of gym-goers").
2. **Benchmarks** — a per-lift store where the owner sets **their own recommendation thresholds** (e.g. labels + bw-ratios/kg), shown alongside the percentile curves and against the athlete's current 1RM.

## Data reality (the linchpin)
- **StrengthLevel/gym standards** ≈ real & known for common lifts (the 5 levels beginner→elite map to ≈ 5th/25th/50th/75th/95th percentiles, as **bw-ratios** by sex). Seed these.
- **General-pop & pro per-lift percentiles** mostly **don't exist as clean data** → seed as **clearly-flagged ESTIMATES** (general = a downward shift of the gym curve; pro = an upward shift anchored on elite/IPF for the big-3). Every entry carries a `confidence: "real" | "est"` so the UI can mark estimates and a later #research pass can replace them.
- bw-scaling: reuse the existing allometric idea (`WR_SCALING_EXP`) where a ratio doesn't fit; default model is a flat **bw-ratio** (kg = ratio × bodyweight) which is what StrengthLevel uses.

## Architecture / SSOT
- **`src/strengthStandards.ts`** (NEW, pure, tested) — the reference data + lookup. SSOT for population curves. No DOM. Easy to swap estimates → real data.
- **Benchmarks store** — `colosseum.benchmarks.v1` (per-lift, device-global config like setup-notes/codes; syncs per rule 41's SHARED-config list). Edited via a small UI; never mixed into the standards module.
- **Renderers** — the WR page (`renderRecords`) and the lift card WR section read both modules; pure compute stays in the modules, thin DOM glue in `main.ts`.

## Phases (incremental, one per turn; #careful)
### Phase 1 — the data module (new file, zero #co-work conflict)
- [x] 1. `src/strengthStandards.ts`: types (`Population`, `StandardCurve`), `PERCENTILES`, a seed for ~8–12 common lifts × sex × 3 populations (bw-ratios, `confidence` flagged), and `percentileFor(lift, sex, bodyweightRatio)` + `standardsFor(lift, sex)` lookups with a name→canonical resolver. — shipped b.2.8.359 (DATA-14).
- [x] 2. `src/strengthStandards.test.ts`: monotonic curves, ratio→percentile round-trips, estimate-flag presence, unknown-lift → null. — 6 tests, b.2.8.359.
- [x] 3. Ship (no UI yet) — pure module, fully tested.

### Phase 2 — percentile panel on the World Records page (quieter view) ✅ DONE (b.2.8.362, DATA-16)
- [x] 4. A compact per-lift "Strength percentiles" panel: the 3 population curves (estimates marked), the athlete's current 1RM placed on it ("≈ Nth %ile of gym pop"). #cram, one horizontally-scrollable strip where it gets wide. — table of bw-ratios + per-athlete placement chips, M↔W toggle, '≈ est' flag.
- [x] 5. i18n + tests; ship.

### Phase 3 — benchmarks store + editor (start on WR page, quiet) ✅ DONE (b.2.8.368, DATA-19)
- [x] 6. `colosseum.benchmarks.v1` store + a small per-lift editor (add/remove labelled threshold rows: label + bw-ratio or kg). — pure `benchmarks.ts` (+7 tests) + admin editor under the percentile table (label · value · ×|kg unit pill · ✕). Owner chose: BOTH units per row, GLOBAL scope.
- [x] 7. Show benchmarks against the athlete's 1RM on the same panel; ship. — each athlete you-chip gains a gold "met" badge = the hardest benchmark they've reached (×bw rows scale by their bodyweight, kg rows absolute). Non-admins see read-only benchmark chips.

### Phase 4 — bring both into the Index lift card (WAIT until that area cools — it's hot now)
- [ ] 8. Same percentile panel + benchmarks in the lift card's WR section, reusing the Phase 2/3 renderers. Ship when #co-work churn there settles.

### Phase 5 — real data + polish (#research)
- [ ] 9. #research pass to replace the general-pop/pro estimates with sourced+graded data where it exists; bump `confidence` to "real".

## Decisions (settled)
- **Benchmark unit:** RESOLVED — each row picks its OWN unit (×bw or kg), owner-chosen.
- **Per-athlete vs global benchmarks:** RESOLVED — GLOBAL per lift (your recommendations apply to everyone), owner-chosen.

## Log
- 2026-06-14 — plan created (Opus 4.8); owner approved 3-pop+estimates & plan-first. Starting Phase 1 (data module).
- 2026-06-14 — Phase 1 shipped (b.2.8.359, DATA-14): pure tested data module.
- 2026-06-14 — Phase 2 shipped (b.2.8.362, DATA-16): percentile panel on the World Records page (3-pop curve table + per-athlete placement chips + M↔W toggle, '≈ est' flagged).
- 2026-06-14 — panel made visible on Total (b.2.8.365, DATA-17): falls back to Squat instead of hiding behind a note.
- 2026-06-14 — Phase 3 shipped (b.2.8.368, DATA-19): personal benchmarks — pure benchmarks.ts module (+7 tests), global per-lift store (colosseum.benchmarks.v1, syncs), admin editor (both units per row), per-athlete 'met' badges on the panel. Owner picked both-units + global scope.
