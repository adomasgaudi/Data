<!-- Loaded when: editing data / metrics / supabase / lift code -->

# Data, SSOT & domain rules

## Core pattern: SSOT → pure compute → thin DOM

Data → pure, tested functions in `src/metrics.ts` / `src/aggregate.ts` → `src/main.ts` is thin DOM glue. Every fact lives in exactly ONE place; every other view is a READ-ONLY projection derived from it — never a second copy that can drift. The `colosseum.*` localStorage store keys are the truth. If a fix adds a parallel copy of state, re-derive instead. Keep correctness logic in pure tested functions; run `npm test` and `npm run typecheck` before a change is done.

Data flow: StrengthLevel → existing Apps Script → Google Sheet "UD" → `doGet` JSON → website (validate → compute → render). The scraper is NOT re-implemented on purpose. CSV (`ud.csv`) is swapped frequently — derive everything from data, degrade gracefully, NEVER hardcode roster/exercises.

## Rule 13 — Translate everything (i18n)

Any new/changed user-facing text MUST get its Lithuanian entry in `src/i18n.ts` (`LT` dict) in the SAME change — the site must never show English when LT is selected.

## Rule 21 — Locked/spectator views (DETAIL)

Core 1-line invariant: locked/spectator views never leak a NON-public athlete.

Full detail: User/Spectator (locked, non-admin) views show ONLY the logged-in athlete PLUS any PUBLIC profiles (spectatable read-only) — never NON-public athletes' chips, never the M/W sex menu, never admin-only tabs. A user marks their own profile public in Settings (`colosseum.publicProfiles.v1`, synced); a public athlete's chip then shows for everyone (tap = spectate read-only — the `canEditAthlete` write-gates still block edits to anyone but yourself). Non-public others stay hidden entirely (not just disabled); anything admin-only is still admin-only.

## Rule 23 — Grouped-lift LENS (store)

Grouped lifts use the per-lift LENS — pick the ORIGINAL lift, then ⊕ Combine / ⇄ Compare it. The picker shows ORIGINAL lifts (built-in registry synthetics like "Squat pattern"/"SQ mix" are hidden — reached via the lens; user-made mixes stay pickable). Each selected lift carries REMEMBERED, per-scope (graph & history INDEPENDENT) toggles — ⊕ Combine (fold into its combinable group's merged lift) and ⇄ Compare (split into its comparable group's members) — shown only for the relations it has; both if it has both. A merged member keeps its OWN per-set scaling (Smith-incline push-ups auto-scale by incline note, unrecognised → flagged), never a flat ratio. Store: `colosseum.exerciseLens.v1`.

## Rule 30 — Supabase `sets` table schema

Supabase `sets` table MUST use composite natural PK `(user_id, date, exercise_name, set_number)` — NO uuid `id` column; PostgREST upsert without an id field in the payload will try to cast `user_id` to uuid and fail with 400. GRANT SELECT/INSERT/UPDATE/DELETE to `anon, authenticated` separately (RLS disable alone is NOT enough). Confirmed working 2026-06-11.

## Rule 41 — localStorage = SSOT, Supabase MIRRORS it

Supabase = the BROWSER CACHE for multiple users — NOT a separate model: localStorage (`colosseum.*`) is each device's SSOT; Supabase just MIRRORS those same keys so every user/device shares ONE copy. Sync = push local→cloud + merge cloud→local (the full-backup export/import is the manual form of the exact same thing).

- DEVICE/display prefs stay local-only (NOT synced): theme, lang, nameMode, view toggles, open/closed states, lastAthlete…
- SHARED data/config SYNCS: sets, setOverrides, deletedSets, manualAthletes, priorities, metaOverrides, exerciseCodes/shortNames, worldRecords, athleteStats, coaching, exerciseLens, groupMembers, variation*, setupNotes…

Today only `colosseum.manualSets.v1`→`sets` syncs; mirroring the rest is the goal.

## Rule 49 — EFFECTIVE-load maths, ADDED-weight display (bodyweight lifts)

Every CALCULATION — %1RM, warm-up %, rep-maxes, the Nuzzo fit — uses the EFFECTIVE load = added weight + bodyweight share (`coeff × bodyweight`); every KG number SHOWN to the owner is the ADDED weight (the plate / −assistance). So a pull-up with a 20 kg-added 1RM at 90 kg bodyweight has "20% of 1RM" = 20% of (20+90) = 22 kg effective (−68 kg added), NOT 20% of 20. Bar-only lifts have share 0, so added = effective (unchanged). `warmupRamp` takes `bodyweightLoad` and peels it back for display; `worksetRows`/`warmupValueCell` take `bodyShare` the same way — keep every new load path bodyweight-aware. 1RM estimates always use the Nuzzo formula (default in `config.ts`).

## Rule 58 — Growth/decay model runs on EFFECTIVE load

Strength GROWTH/DECAY model maths run on EFFECTIVE load (rule 49) — incl. the growth CAP — and the cap is a per-WEEK rate that SHRINKS with training age (a 1/age, log-derivative / phases shape), NEVER a flat per-SET % (a per-set cap lets 3 sets in one day compound ~60%; a fixed % is too loose for a beginner and too tight for an advanced lifter). TODAY `decayedStrengthSeries`/`strength`/`projection` feed on `addedWeight1RM` (bodyweight PEELED OFF) — that's the bug: compute the model on the EFFECTIVE 1RM (bodyweight folded in, `effectiveE1RM`), only convert to the ADDED weight for what's SHOWN.

## Rule 55 — Custom set strength persists

Custom set strength = the hand-set Nuzzo-fit 1RM is the canonical strength estimate, and it PERSISTS: when the owner drags the Nuzzo fit (the card Curve graph's "1RM" line OR the analysis reps×kg green curve) the dialed-in EFFECTIVE 1RM is the lift's "custom set strength" — the most-accurate per-`(athlete,exercise)` estimate — stored device-local in `colosseum.rvwFit.v1` (key `athlete|exercise`). ONE SSOT shared by both fits (`rvwFitOf`/`setCustomStrength`/`setCustomStrengthAdded`); the card defaults its 1RM to it (over the auto best-fit). No redundant slider — drag the line or type the number.

## Rule 62 — Notes are USER-ONLY

NOTES ARE USER-ONLY — never generate a note from a tag/variation/ROM/anything (owner). A variation (support, band, lean, ROM %/cm, incline…) is a per-set ATTRIBUTE (per-set vec, level override, or `setOverrides[id]`) shown as a CHIP — NEVER written into `notes`. The set's note field holds ONLY what the user typed. (ROM was wrongly stored as a "ROM X%" note; fixed in WO-251 — stored on `setOverrides[id].rom`, rendered via `romOfSet`.)
