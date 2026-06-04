# Unified WorkoutAnalysisView — feature parity verification (TASK 48)

Verifies the unified **WorkoutAnalysisView** (Other → "Workout analysis") against
the four legacy views, per `docs/feature-parity-audit.md`. Companion docs:
`feature-parity-audit.md` (per-feature matrix) and `graph-migration-audit.md`.

Legend: ✅ at parity · 🟡 partial · ❌ missing (→ follow-up).

## Workouts View → `all` mode
- Session history, day/week, alone/rest, grouping, names, per-page, +set, sets
  chart, calendar, expand/edit — all present via the relocated live panel. ✅

## List View → `all` → "Exercise list"
- Category table, sort, search, not-trained/cardio, rep-max column, category
  chips, period — present via the relocated live List panel. ✅
- The **unified selector** also offers its own search (TASK 43), metadata filters
  (TASK 44) and Group By (TASK 45) over the same exercises. ✅

## Single Exercise View → `single` mode
- Drill-in: history, progression chart, PRs, stats, calculator, period, combine,
  hole scaling, name switch — present via the relocated drill-in. ✅
- The **universal graph** additionally plots that exercise's metrics. ✅

## Compare View → `compare` mode
- Overlay chart (trend / per-set range), chips, quick-add, compared-sets table —
  present via the relocated Compare view. ✅
- The **universal graph** also overlays the picked exercises (multi-series). ✅

---

## New capabilities the legacy views did NOT have
- **Unified selector** with identity-inclusion toggles (original / dissolved /
  combined / comparison), live **search**, **metadata filters** (11 dimensions)
  and **Group By** — scales to hundreds of exercises (scrollable, search-narrowed).
- **Universal Analytics Graph**: 14 metrics (weight, range, 1RM, strength, decay,
  predicted, volume, volume-load, reps, sets, frequency, PRs, trend, moving avg),
  multi-exercise, with a metric-compatibility note system.
- **Layout toggle** (Overview / Table / Charts / Stats) — presentation only.
- **Create variant / group** and a per-exercise **taxonomy editor**.

## One source of truth (TASK 46)
All modes read the SAME data: logged sets → `activeRecords()` →
`computedRecords()` (bodyweight folded in + synthetic groups + user-def identity
tags). The selector, the hosted legacy panels and the universal graph all draw
from it; nothing re-queries or re-derives a separate copy. The four **layout
modes** (Overview/Table/Charts/Stats) flip a CSS class only — switching changes
presentation, never the data.

## Empty-state / missing-data handling (TASK 47)
- No exercises selected → selector prompt; the universal graph shows **sample
  data** with a "pick exercises" note.
- No exercises match search/filters → "No exercises match the search / filters."
- No workouts / no sets → the hosted Workouts / drill-in panels show their own
  "No workouts"/empty messages.
- Not enough history for **prediction** (<3 points) or **trend** (<2) → compute
  returns empty and the graph notes it ("Predicted strength needs ≥3 points").
- **Decay** with no strength metric enabled → "Decay only affects Strength/1RM".
- Empty comparison group → the Compare view renders with no lines (no crash).
- None of these throw — the graph/selector degrade to a message.

---

## Remaining gaps → follow-up tasks
1. **Aggregation/interval bucketing** for kg metrics (max/avg per week) — config
   exists; only the count metrics aggregate per day so far.
2. **Per-formula** 1RM in the universal graph honours the app formula, but the
   legacy per-day "best set only" framing isn't a universal option yet.
3. **Scaled-effort / squat-rack-hole** series not in the universal graph.
4. **Compare per-set range** as a universal metric variant (range exists for
   Weight Range; the compare-style overlay still uses the legacy panel).
5. **Retiring the legacy panels**: the unified view still *relocates* them rather
   than fully reimplementing every control natively — final cleanup is a later
   task (the old pages are intentionally still present).
6. **Virtualised chip list** if libraries grow into the thousands (currently a
   scroll box + search; fine for hundreds).

_Verified at b.2.2.x (Tasks 43–48)._
