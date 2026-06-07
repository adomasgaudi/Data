# Colosseum — Section & Card Code Names

This is the **shared vocabulary** for the Colosseum dashboard. Use these codes to point
at any screen, section or card precisely. A new AI with zero context should read this
file first, then it will understand requests like "put EXR-CMP into S-ANL" or
"the WR card guesstimate is wrong".

- Format: `CODE` — plain-language name — where it lives / what it is.
- Codes are STABLE. If a section is renamed in the UI, keep its code and update the
  description here.
- Naming: a 2–5 letter **section** prefix, then `-` + a short part name for cards
  inside it (e.g. `EXR-CMP`). Sub-cards add another `-` level when useful.

---

## Top-level navigation (NAV)

- `NAV` — the app chrome: the top bar + the bottom navigation.
- `NAV-TOP` — top bar (title "Colosseum", view badge, ⚙ settings).
- `NAV-BOT` — bottom navigation bar (the two big buttons).
- `NAV-ANL` — the bottom **Analysis** button (opens ANL, or S-ANL in simplified view).
- `NAV-MORE` — the bottom **More** button → opens the MORE sheet.
- `MORE` — the "More" bottom sheet listing the secondary sections (LB, GRP, STATS, ADD,
  IDX, ATHED, DATA, FORM, SMAP, GUIDE).
- `SET` — the **Settings** panel (⚙ in the top bar).

## Major sections (each is a top "tab" / page)

- `ANL` — **Analysis** — the main home; per-exercise graphs, selector, workout history,
  calendar. The default screen.
- `S-ANL` — **Simplified Analysis** — a stripped-down ANL opened by NAV-ANL when
  "Simplified view" is ON in SET.
- `LB` — **Colosseum / Leaderboards** — per-exercise leaderboards.
- `ATH` — **Athlete** — one athlete's profile, training stats and trends.
- `EXR` — **Exercises** — per-exercise analysis (graphs, records, calculator). Lives
  inside ANL now.
- `WO` — **Workouts** — day/week training history + the calendar heatmap. Inside ANL.
- `IDX` — **Index** — the master list of every exercise, grouped & filterable; each row
  expands to the exercise's editable info card (IDX-CARD).
- `GRP` — **Group view** — compare people side by side.
- `STATS` — **Stats view** — per-category leaderboards / charts.
- `DATA` — **Data** — refresh from StrengthLevel, raw CSV vs processed table.
- `ADD` — **Add a set** — hand-log a set; export / import.
- `ATHED` — **Athletes (edit stats)** — edit an athlete's bodyweight/height/sex etc.
- `FORM` — **Formulas** — the weight↔reps 1RM curve & calculators.
- `SMAP` — **Site map** — the mind-map of the whole site.
- `GUIDE` — **Guide** — training plan & benchmarks.

---

## ANL — Analysis (cards)

- `ANL-ATH` — the relocated athlete picker that sits at the very top while ANL is open.
- `ANL-STATS` — the relocated "stats & training mix" block under the picker.
- `EXR-SEL` — the **sticky exercise-selector bar** (Filter · Exercises (N) · ⚙ · +).
- `EXR-SEL-PILLS` — the selected-exercise pills shown inside EXR-SEL.
- `EXR-GRAPH` — the main analytics graph (per exercise × metric).
- `EXR-CMP` — the compare graph + the sets behind it.
- `EXR-METRICS` — the metric chooser (1RM, volume, %WR, …) under ⚙.
- `WO-CAL` — the workout **calendar heatmap** (ribbon / single year / all years).
- `WO-CAL-PILLS` — the "Group by · All · <part>" colour slicer under WO-CAL.
- `WO-HIST` — the workout **history list** (by day / by week) below the calendar.
- `WO-SETROW` — a single set's row (W · 1RM · Vol · pRIR · RIR + the ×variation chip).
- `WO-VARCHIP` — the per-set `×N ▾` variation chip (opens the band/lean/ROM form).

## IDX — Index (cards)

- `IDX-FILTER` — the "Show app-wide" active-set bar (tier cutoff + only/hide overrides).
- `IDX-GROUPBY` — the "Group by" picker (Discipline / Muscle group / Joint movement /
  Combinable / Comparable).
- `IDX-GROUP` — one collapsible group header (with its only · hide · show buttons).
- `IDX-GROUP-FILT` — the per-group **only / hide / show** buttons.
- `IDX-OTHER` — the "Other" parent that nests the minor disciplines.
- `IDX-STR-SUB` — the Strength group's "Sub-group by" (Muscle / Joint movement) picker.
- `IDX-ROW` — one exercise row in a group (tap the name to expand IDX-CARD).
- `IDX-MERGE` — the "Merged exercises" table (spelling merges).
- `IDX-CREATE` — the "＋ Create variant / group" panel (dissolved variant / combined /
  comparison group). Moved here from the Analysis bar.
- `IDX-CARD` — the **expanded exercise info card** (the dropdown under a row). Its parts:
  - `CARD-CODE` — Code input.
  - `CARD-SHORT` — Short-name input.
  - `CARD-DISC` — Discipline chips (multi-select).
  - `CARD-MG` — Muscle-group chips (multi-select).
  - `CARD-TIER` — Tier chips (Primary / Secondary / Tertiary).
  - `CARD-COMBINE` — Combinable-group chips.
  - `CARD-COMPARE` — Comparable-group chips (+ ratio box).
  - `CARD-BW` — Bodyweight-part range (min–max, gold average).
  - `CARD-TAGS` — auto tags (read-only labels).
  - `CARD-MODEL` — Difficulty-model picker + the ⚙ multiplier editor.
  - `CARD-WR` — **World-record** editor (per sex, with the ≈est. guesstimate).
  - `CARD-VARS` — **Note variations & difficulty** list (per-note × + who & when).
  - `CARD-FACTS` — read-only facts (Total sets, Athletes, Best 1RM, Logged, Sources).
  - `CARD-ACTIVE` — the per-exercise "Always show / Always hide" controls.

## LB — Leaderboards (cards)

- `LB-PICK` — the exercise picker.
- `LB-TABLE` — the leaderboard table (best per rep band).
- `LB-RANK` — the "total / ×bodyweight" rank toggle.
- `LB-FILT` — the sex · bodyweight filters.

## ATH — Athlete (cards)

- `ATH-PROF` — profile & training stats.
- `ATH-MIX` — training-mix bar.
- `ATH-MOM` — momentum (weekly trend).
- `ATH-FFMI` — body composition (FFMI).

## SET — Settings (entries)

- `SET-CALC` — Calculations & display group (1RM formula, decay, name mode, …).
- `SET-SIMPLE` — the **Simplified view** toggle (drives S-ANL).
- `SET-THEME` — dark/light mode.
- `SET-BACKUP` — backup & restore (+ auto-backup).
- `SET-MODEL` — ✎ Difficulty multipliers (global editor).
- `SET-HEALTH` — Data health.
- `SET-VER` — Version history (+ the version/SP indicator).

---

_Last structural reference: built from the in-app SITE_MAP and the live tab/menu
layout. When you add or rename a section, add/keep its code here in the same commit._
