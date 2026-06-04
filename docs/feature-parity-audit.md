# Feature parity audit — migration into WorkoutAnalysisView

Inventory of every feature in the four legacy athlete views, and whether it has
been migrated into the unified **WorkoutAnalysisView** (Other → "Workout analysis").

**How migration works (Tasks 3–5):** WorkoutAnalysisView does not re-implement the
old views — it **relocates the live panels** into itself by mode and returns them
to their home tabs when you leave:

- **0 exercises selected → `all`** → hosts the live **Workouts** panel.
- **1 selected → `single`** → hosts the live **Single-exercise drill-in**.
- **2+ selected → `compare`** → hosts the live **Compare** view.

Because the real panels move (same DOM nodes + handlers), every sub-feature of a
migrated view comes along automatically. "Migrated? = yes (relocated)" therefore
means the feature is present and fully functional inside WorkoutAnalysisView.

Legend: ✅ migrated · 🟡 partial · ❌ not yet · (R) = via live-panel relocation.

---

## Workouts View  →  `all` mode

| Feature | Source View | Migrated? | New Location | Notes |
|---|---|---|---|---|
| Session history list (expandable rows) | Workouts | ✅ (R) | WorkoutAnalysis · all | Whole Workouts panel hosted in the "Workout history" area. |
| By day / By week toggle | Workouts | ✅ (R) | WorkoutAnalysis · all | Live control moves with the panel. |
| Show: Exercises / Groups toggle | Workouts | ✅ (R) | WorkoutAnalysis · all | |
| Grouping dimension (muscles/functional/combined/compared) | Workouts | ✅ (R) | WorkoutAnalysis · all | |
| Names: Code / Full toggle | Workouts | ✅ (R) | WorkoutAnalysis · all | |
| Per-page (20 / 50) + pager | Workouts | ✅ (R) | WorkoutAnalysis · all | |
| Show rest days toggle | Workouts | ✅ (R) | WorkoutAnalysis · all | |
| Alone filter (both / alone / not) | Workouts | ✅ (R) | WorkoutAnalysis · all | |
| "+ set buttons" toggle + inline add (+ set / + exercise) | Workouts | ✅ (R) | WorkoutAnalysis · all | Day/Today choice preserved. |
| Sets-over-time chart (per-exercise overlay, compactable) | Workouts | ✅ (R) | WorkoutAnalysis · all | |
| Calendar / heatmap (Timeline / Single year / All years) | Workouts | ✅ (R) | WorkoutAnalysis · all | |
| Expanded sets table (W / 1RM / Vol / RIR, effort tags) | Workouts | ✅ (R) | WorkoutAnalysis · all | |
| Tap-to-edit a set (weight/reps/bw/scale) | Workouts | ✅ (R) | WorkoutAnalysis · all | |
| Per-set RIR picker · 1RM formula reveal · note toggle | Workouts | ✅ (R) | WorkoutAnalysis · all | |

## Single Exercise View (drill-in)  →  `single` mode

| Feature | Source View | Migrated? | New Location | Notes |
|---|---|---|---|---|
| Exercise set history (sets table) | Single | ✅ (R) | WorkoutAnalysis · single | Live drill-in hosted in the content area. |
| Progression chart (Est 1RM · Current strength · Scaled effort) | Single | ✅ (R) | WorkoutAnalysis · single | |
| Graph settings (Best set only · Center · Realistic/Compacted) | Single | ✅ (R) | WorkoutAnalysis · single | The ⚙ graph-settings dropdown. |
| Personal record card | Single | ✅ (R) | WorkoutAnalysis · single | |
| Top sets | Single | ✅ (R) | WorkoutAnalysis · single | |
| Weekly stats | Single | ✅ (R) | WorkoutAnalysis · single | |
| Rep-max targets | Single | ✅ (R) | WorkoutAnalysis · single | |
| Reps↔weight calculator | Single | ✅ (R) | WorkoutAnalysis · single | |
| Bodyweight-part readout | Single | ✅ (R) | WorkoutAnalysis · single | |
| "Combine with…" (view several lifts together) | Single | ✅ (R) | WorkoutAnalysis · single | |
| Squat-rack hole scaling (settings) | Single | ✅ (R) | WorkoutAnalysis · single | Collapsed ⚙ disclosure. |
| Period filter (last 3 months / all time …) | Single | ✅ (R) | WorkoutAnalysis · single | |
| Switch-exercise dropdown (tap the name) | Single | ✅ (R) | WorkoutAnalysis · single | Plus the analysis selector chips. |
| Exercise info jump (ℹ) | Single | ✅ (R) | WorkoutAnalysis · single | |
| Exercise selection (which lift) | Single | ✅ | WorkoutAnalysis selector | Pick via the analysis exercise chips. |

## Compare View  →  `compare` mode

| Feature | Source View | Migrated? | New Location | Notes |
|---|---|---|---|---|
| Overlay comparison chart | Compare | ✅ (R) | WorkoutAnalysis · compare | Seeded from the analysis selection. |
| Chart view toggle (Current strength / Per-set range) | Compare | ✅ (R) | WorkoutAnalysis · compare | |
| Comparison chips (add / remove) | Compare | ✅ (R) | WorkoutAnalysis · compare | Shares `compareSelected` state. |
| Search-to-add an exercise | Compare | ✅ (R) | WorkoutAnalysis · compare | |
| Quick add by category & tier | Compare | ✅ (R) | WorkoutAnalysis · compare | |
| Selected count + Clear | Compare | ✅ (R) | WorkoutAnalysis · compare | |
| Compared-sets table | Compare | ✅ (R) | WorkoutAnalysis · compare | |
| Comparison note | Compare | ✅ (R) | WorkoutAnalysis · compare | |
| Compacted-time on the overlay | Compare | ✅ (R) | WorkoutAnalysis · compare | |

## List View ("List & stats")  →  `all` mode → "Exercise list" toggle (TASK 7)

In `all` mode the content area has a **Workouts | Exercise list** toggle; "Exercise
list" hosts the live List view (the floating search bar travels with it).

| Feature | Source View | Migrated? | New Location | Notes |
|---|---|---|---|---|
| Exercise list (by category, with 1RM + best set) | List | ✅ (R) | WorkoutAnalysis · all → Exercise list | Whole List panel hosted. |
| Sort: By sets / By tier / By category | List | ✅ (R) | WorkoutAnalysis · all → Exercise list | In the ⋯ filters menu. |
| Show not-trained toggle | List | ✅ (R) | WorkoutAnalysis · all → Exercise list | |
| Show cardio/mobility toggle | List | ✅ (R) | WorkoutAnalysis · all → Exercise list | |
| Search exercises box | List | ✅ (R) | WorkoutAnalysis · all → Exercise list | Floating search bar relocated with the panel. |
| Editable rep-max column (working weight for N reps) | List | ✅ (R) | WorkoutAnalysis · all → Exercise list | |
| Category show/hide chips | List | ✅ (R) | WorkoutAnalysis · all → Exercise list | |
| Period filter | List | ✅ (R) | WorkoutAnalysis · all → Exercise list | |
| Tap exercise → drill-in | List | ✅ | WorkoutAnalysis | Drills into single mode; the selection chip syncs so the mode readout follows. |
| Bulk selection | List | n/a | — | The List view has no bulk selection. |

---

## Gaps / follow-ups (what's still missing)

- All four legacy views (Workouts, Single, Compare, List) are now reachable inside
  WorkoutAnalysisView via relocation. The old pages remain as well (not deleted).
- The analysis view's own **Filters** section holds the mode readout + the
  `all`-mode Workouts/Exercise-list toggle; broader cross-cutting filters aren't
  wired into it yet — in each mode the relocated panel carries its own filters.
- **In-panel vs analysis-selector desync:** changing the lift via the drill-in's
  own name dropdown, or the compare chips, doesn't update the analysis selection
  chips (and so the mode readout) until the analysis chips are next touched.
- Old views (**Workouts / Single / Compare / List**) are intentionally **not deleted**
  yet — they remain reachable via the athlete tab bar and must keep working.

_Last updated for b.2.2.15 (after Tasks 1–7)._
