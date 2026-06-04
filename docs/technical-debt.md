# Technical debt report — WorkoutAnalysisView migration (Tasks 1–54)

A candid record of the shortcuts taken while building the unified
WorkoutAnalysisView, the known limitations, and the refactors worth doing later.
Companion docs: `feature-parity-audit.md`, `graph-migration-audit.md`,
`unified-view-parity.md`.

---

## Shortcuts taken during migration

1. **Migration by relocation, not reimplementation.** The unified view hosts the
   *live* legacy panels (Workouts / Single / Compare / List) by moving their DOM
   nodes into itself and back out on exit (`setAnalysisMainPanel`,
   `restoreAnalysisPanels`). This reused 100% of the existing logic with zero
   duplication, but means the old panels are still load-bearing — they can't be
   deleted, and a node can only be in one place at a time.
2. **Universal graph runs in parallel, not as the sole graph.** The new
   `analyticsGraph` + metric registry coexist with the legacy drill-in/compare
   charts rather than replacing them. So a single exercise can show *two* graphs
   (the relocated drill-in chart and the universal one).
3. **Seeded — not exhaustive — taxonomy.** Joint/Movement/Plane/Equipment/etc.
   assignments (`exerciseMeta.ts`) are populated for a handful of representative
   lifts; everything else resolves to "no values" until assigned in the editor.
4. **Body-part / muscle / function / tier are derived, not stored.** They come
   from the existing `profile.ts` registry via the provider, so they can't be
   edited per-exercise the way joints/movements/planes can.
5. **Config flags partially wired.** `GraphConfig.aggregation`/`interval` only
   affect the count metrics (per-day/-week); kg metrics ignore them. `prediction`
   is a flag; projection lives in the `predicted` metric itself.
6. **Mock data in the graph** when nothing is selected (a deliberate "always
   alive" choice, but it can read as real data to a new user).
7. **Identity classification is name-based.** Dissolving an *existing* name is
   blocked (duplicate guard), so a user def always introduces a new name; the
   "dissolved" type is otherwise reserved/under-exercised.
8. **Deep-links are additive, not a real router.** Hash routes (`#single=…`,
   `#compare=…`, …) open the view but the app never *writes* the hash, so state
   isn't reflected back into the URL/bookmarks automatically.
9. **In-panel ↔ selector desync.** Switching a lift via the drill-in's own name
   dropdown, or editing the compare chips, doesn't update the analysis selection
   chips (and mode readout) until the analysis chips are next touched.

## Known limitations

- **List View virtualisation:** the selector is a scroll box + search; fine for
  hundreds of lifts, not virtualised for thousands.
- **Aggregation/interval** bucketing missing for weight/1RM/strength metrics.
- **Per-formula** 1RM follows the app-wide setting; no per-graph override, and the
  legacy "best set only / center" framings aren't universal-graph options.
- **Scaled-effort / squat-rack-hole** series (technique scaling) aren't a
  universal-graph metric yet.
- **Compare per-set range** as a universal metric exists only as "Weight Range";
  the multi-exercise range overlay still uses the legacy panel.
- **User data is per-device** (localStorage): exercise defs, taxonomy assignments,
  graph state and selections don't sync across devices.
- **Right-axis sharing:** all count/volume metrics share one right axis, so mixing
  e.g. Volume (thousands) and Sets (single digits) squashes one of them.

## Future refactor opportunities

1. **Retire the legacy panels** by reimplementing their controls natively inside
   the unified view, then delete `#sub-workouts` / `#sub-exercises` relocation.
2. **Make the universal graph the only graph** (remove the drill-in/compare/
   sets-over-time charts once their features — range overlay, scaled-effort,
   best-set framing — are universal-graph metrics/options).
3. **Apply aggregation/interval** uniformly (a single `aggregate(points, cfg)`
   step in `analyticsGraph`) so every metric respects the config.
4. **Move derived metadata into the editable taxonomy** so body part / muscle /
   function can be user-overridden like joints/movements.
5. **Sync selector ↔ in-panel selection** (one selection store the drill-in name
   dropdown and compare chips also write to).
6. **Two-way URL state** (write the hash on selection/mode change) for real
   shareable links.
7. **Persist user data to the repo/GitHub** (already on the "coming soon" list)
   so defs/taxonomy/assignments aren't device-bound.
8. **Per-metric axes / unit grouping** instead of one shared right axis.
9. **Expand taxonomy coverage** (seed joints/movements/planes for the full
   exercise library, or infer from keywords like the muscle/function tags do).

_Authored after Tasks 1–54 (b.2.2.x)._
