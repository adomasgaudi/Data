# Graph migration audit — toward the Universal Analytics Graph

Inventory of every existing graph in the app, so the Universal Analytics Graph
(`src/analyticsGraph.ts`, metrics in `src/graphMetrics.ts`, settings in
`src/graphConfig.ts`) can eventually replace them. For each graph: its features,
settings, calculations and filters, and the metric(s) it maps to.

Status: ✅ available now in the universal graph · 🟡 partial · ❌ not migrated yet.

---

## 1. Weight graph (per-set weight over time)
- **Calc:** logged weight (`origWeight ?? weight`) per set.
- **Metric:** `weight` ✅ (computed).
- **Settings/filters:** date range, athlete, exercise; compacted-time axis.
- **Gaps:** none of note.

## 2. Estimated 1RM graph (`renderExerciseProgressChart`)
- **Calc:** `addedWeight1RM` per set (bodyweight peeled off), chosen 1RM formula.
- **Metric:** `e1rm` ✅ (currently Epley only in the universal compute — 🟡 formula选 not wired).
- **Settings:** Best-set-only, Center, Realistic/Compacted time, formula (⚙ Settings).
- **Gaps:** formula choice, best-set-per-day, “center” framing → ❌.

## 3. Strength graph (Current strength line)
- **Calc:** best e1rm reached, carried forward.
- **Metric:** `strength` ✅ (per-set e1rm) / `strengthDecay` 🟡.
- **Gaps:** the “running/forward” shaping vs per-set points → ❌.

## 4. Decay graph (Current-strength fade)
- **Calc:** `decayedStrengthSeries` (Ebbinghaus fade, stability growth).
- **Metric:** `strengthDecay` + config `decay` ✅ (the universal graph applies
  `decayedStrengthSeries` when Decay is on for strength metrics).
- **Gaps:** the standalone Settings “strength fade” explainer curve → ❌ (separate).

## 5. Prediction graph
- **Calc:** logarithmic trend / future projection.
- **Metric:** `predicted` / `trend` ❌ (registered, not computed) + config
  `prediction` (flag only). → future task.

## 6. Volume graph
- **Calc:** `weight × reps` (volume) and volume-load.
- **Metric:** `volume` ✅, `volumeLoad` ✅ (per set). Aggregation (sum/week) 🟡 —
  config exists, summing not yet applied.
- **Gaps:** per-interval aggregation (sum per week) → ❌.

## 7. Compare graph (`renderCompareSection`)
- **Calc:** one current-strength line per exercise; or per-set range bars.
- **Universal:** multi-exercise series ✅ (Task 28 — one series per exercise×metric).
- **Settings:** Current-strength vs Per-set range toggle; search/quick-add chips.
- **Gaps:** per-set RANGE series type, the chips/quick-add UI → 🟡/❌.

## 8. Single-exercise graph (drill-in)
- Same as #2/#3 plus “Scaled effort” (technique scaling) line and squat-rack/cm
  hole series.
- **Gaps:** Scaled-effort metric, per-hole series → ❌ (future metrics).

---

## Universal graph coverage today (foundation)
- **Metrics registered (14):** Weight, Weight Range, Estimated 1RM, Strength
  Score, Strength Score With Decay, Predicted Strength, Volume, Volume Load,
  Reps, Sets, Frequency, Personal Records, Trend Line, Moving Average.
- **Computed now (after TASKS 31–36):** weight (history, tooltips), weightRange
  (range bars), e1rm (formula-aware), strength (running max), strengthDecay
  (Ebbinghaus fade), predicted (log projection, empty under 3 points), volume,
  volumeLoad, reps. **Registered-not-computed:** sets, frequency, pr, trend,
  movingAvg (Moving Average is also available as a config *smoothing*).
- **Config:** aggregation (none/max/avg/sum), interval (day/week/month),
  smoothing (moving-average window), prediction (flag), decay (applied).
- **Multi-exercise / identity:** original, dissolved, combined, comparison all
  plot identically (name-based).

## Missing features → future tasks
1. **Aggregation/interval bucketing** (max/avg/sum per day/week/month) — config
   present, not yet applied in the renderer.
2. **Derived metrics:** Weight Range (range bars), Sets, Frequency, Personal
   Records markers, Trend Line, Predicted Strength.
3. **Per-formula 1RM** (Epley/Brzycki/Nuzzo) in the universal computes.
4. **Series types** beyond line: range bars (per-set range, weight range).
5. **Scaled-effort / squat-rack-hole** series from the single-exercise graph.
6. **Per-graph framing** (best-set-only, center, realistic/compacted is already
   inherited from the SVG engine).

_Last updated for b.2.2.x (Tasks 25–30 foundation)._
