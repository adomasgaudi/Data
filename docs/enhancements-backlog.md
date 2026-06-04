# Future enhancements backlog

Ideas captured during the migration but intentionally NOT built. This is the
**wishlist** — distinct from bugs (none open here) and from paid-down debt
(`technical-debt.md`, which is about *how* the current code is built). Roughly
prioritised: P1 (high value, likely next) → P3 (nice-to-have).

## P1 — high value
1. **Universal graph as the single graph.** Fold the legacy drill-in / compare /
   sets-over-time charts into the universal graph (range overlay, scaled-effort,
   best-set framing as metrics/options), then retire them.
2. **Editable metadata everywhere.** Let body part / muscle / function be
   user-overridden like joints/movements/planes, with the bulk migration tool.
3. **Aggregation everywhere.** Apply the config's aggregation/interval to the kg
   metrics too (max/avg per week), with a clear per-metric default.
4. **Cross-device sync.** Persist exercise defs, taxonomy assignments and graph
   state to the repo/GitHub so they aren't device-bound (on the "coming soon" list).
5. **Shareable URLs.** Two-way hash/URL state so a selection/mode is bookmarkable
   and shareable, not just openable.

## P2 — strong follow-ups
6. **Taxonomy coverage to 100%** of the library (keyword inference + manual
   review), with a coverage dashboard.
7. **Saved graph presets** ("My strength view": chosen metrics + config) per user.
8. **Per-metric axes / unit groups** instead of one shared right axis.
9. **Selector ↔ panel single selection store** (drill-in name switch + compare
   chips write back to the analysis selection).
10. **PR/record annotations** on the graph (label the lift, reps, date at each PR).
11. **Goal lines / targets** on the graph (e.g. a target 1RM) and progress to them.

## P3 — nice-to-have
12. **Exercise relationship builder UI** (visualise dissolved/combined/comparison
    trees; drag to attach).
13. **Smart suggestions** ("you haven't trained X in N weeks", stalling lifts).
14. **Export** a graph/table as image or CSV.
15. **Virtualised chip list** for libraries in the thousands.
16. **Plane/joint diagram** mini-figure illustrating an exercise's taxonomy.
17. **AI summaries** of an athlete / exercise / session (already teased in
    "coming soon").

_Captured after Tasks 1–55 (b.2.2.x)._
