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

## List View ("List & stats")  →  not yet migrated

| Feature | Source View | Migrated? | New Location | Notes |
|---|---|---|---|---|
| Exercise list (by category, with 1RM + best set) | List | 🟡 | WorkoutAnalysis selector (partial) | Selector chips let you pick a lift, but the full sortable list/table is not migrated. |
| Sort: By sets / By tier / By category | List | ❌ | — | Lives only in the old List & stats tab. |
| Show not-trained toggle | List | ❌ | — | |
| Show cardio/mobility toggle | List | ❌ | — | |
| Search exercises box | List | 🟡 | WorkoutAnalysis selector (partial) | Chips are tappable but there's no text search in the analysis selector yet. |
| Editable rep-max column (working weight for N reps) | List | ❌ | — | |
| Category show/hide chips | List | ❌ | — | |
| Period filter | List | ❌ | — | The analysis selector has no period filter of its own yet. |
| Tap exercise → drill-in | List | ✅ | WorkoutAnalysis selector | Tapping a chip enters single mode (the drill-in). |

---

## Gaps / follow-ups (what's still missing)

- **List View** is the main un-migrated surface. The analysis **Exercise selector**
  is only a partial substitute (no sort, no search box, no not-trained / cardio
  toggles, no editable rep-max column, no period filter, no category show/hide).
- The analysis view's own **Filters** section is still a placeholder (only the mode
  readout) — date/period and other cross-cutting filters aren't wired into it yet;
  in `all`/`single`/`compare` the relocated panels carry their own filters.
- **In-panel vs analysis-selector desync:** changing the lift via the drill-in's
  own name dropdown, or the compare chips, doesn't update the analysis selection
  chips (and so the mode readout) until the analysis chips are next touched.
- Old views (**Workouts / Single / Compare / List**) are intentionally **not deleted**
  yet — they remain reachable via the athlete tab bar and must keep working.

_Last updated for b.2.2.14 (after Tasks 1–5)._
