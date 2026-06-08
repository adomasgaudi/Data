# Restore points (known-good git commits)

Durable record of "last-known-good" commits to revert to if an **experimental**
or risky feature breaks things later. (Remote tag pushes are blocked on this repo,
so we record SHAs here instead of `git tag`.)

To roll back a single experiment, prefer reverting its commit(s); to hard-reset
the whole app to a point, `git reset --hard <sha>` on the canonical branch (then
re-deploy). Always check what's changed since first.

| Date | Version | Commit | Why it's a safe point / what came after |
|------|---------|--------|------------------------------------------|
| 2026-06-08 | b.2.7.123 | `e34bf66` | Last commit **before** the experimental **Horizontal history** view (a new "Horizontal history" dropdown that scrolls periods sideways). If that experiment destabilises the history/analysis view, revert its commit(s) or reset here. |
| 2026-06-08 | b.2.7.129 | `5589764` | Last commit **before** the graph **pan/zoom-preserve** change (`svgChart.ts`: a `userAdjusted` flag so a series UPDATE keeps the view instead of `resetView()` — toggling graph metrics no longer resets pan/zoom). Graph changes have historically caused lasting bugs; if pan/zoom misbehaves (stuck/blank/won't-refit, or an exercise change shows an empty view), revert the next commit or reset here. Double-tap still force-refits (resetView clears the flag). Touch points: `userAdjusted` set in `zoomXY` + the pan-move handler, cleared in `resetView`, gated in `update()`. KNOWN TRADEOFF: an exercise change also keeps the view now (not just metric toggles) — double-tap to re-fit. |
| 2026-06-08 | b.2.7.168 | `8d450ae` | Last commit **before** the **same-day-set fan / compacted-time** change (`graphMetrics.ts setTimes` + `chartAxis.ts buildCompactor`): same-day sets now fan evenly across the day-slot, and the compactor preserves each set's intra-day offset at full slot width (instead of compressing it by the gap to the next session) so all of a day's sets stay separated in compacted ("non-real-time") view. If the analysis graph's per-set scatter/range/dots look mis-placed, dates in tooltips shift by a day, or the compacted axis misbehaves, revert the next commit or reset here. Touch points: `setTimes` fan window `[0.05,0.49]` of the day; `buildCompactor.to/from` intra-day-offset-preserving branch (still `round`-buckets to keep a centred fan on one slot). |
| 2026-06-08 | b.2.8.1 | `e7551fa` | Last commit **before** the **per-origin marker shapes** change (`graphMetrics.ts perSet` + `svgChart.ts` scatter draw): a combined/comparison lift's scatter dots are now SHAPED per member-origin (circle/diamond/triangle/… same colour) so the mixed sources are tellable apart. If the graph's dots render wrong (wrong shape, missing dots, multi-athlete shape encoding broken), revert the next commit or reset here. Touch points: `GraphPoint.shape` + `originShapeOf`/`distinctOrigins` in graphMetrics (set in `perSet`), `SvgPoint.shape`, and the scatter branch `s.shape ?? p.shape` (series shape still wins for the multi-athlete overlay). Scatter only — range bars unchanged. |
