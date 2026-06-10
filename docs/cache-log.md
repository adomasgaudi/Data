# Cache / backup log

A plain-language history of Colosseum backup snapshots, so we can see at a glance
what was stored at any point in time. Each backup file is a copy of the ~45
browser-storage "boxes" (`colosseum.*` keys) the app saves on your device.

Every entry groups the contents into two tiers (the same split the app's
**Clear cache** button uses — see `src/backup.ts` → `CACHE_KEYS`):

- 🟢 **KEEP** — hand-authored data. Irreplaceable; a cache-clear never touches it.
- ⚙️ **CACHE** — settings, filters and session. Disposable; regenerates from defaults.

> Add a new dated section at the TOP whenever a backup is reviewed (newest first).

---

## 2026-06-10 · app b.2.8.144 · exported 06:20 — **seeded into `defaultCache.json`**

Refreshed the bundled default seed (`src/data/defaultCache.json`) from this backup so a
fresh / no-cache device shows the owner's current state. **Verbatim refresh: ALL 53 backup
keys copied exactly** (owner's request — including the UI-open-state keys), so a no-cache
page matches the device exactly. The ONLY deviation: `lastAthlete`/`viewUser` pinned to
**adomasgaudi** so a fresh visitor lands on the owner. Seeding is fill-only — no existing
device is overwritten.

### 🆕 since the last seed (what changed)
- **4 new authored keys added:** `exerciseLens` (per-lift Combine/Compare picks — Squat/Belt Squat→squat-pattern, Deadlift/slRDL→dl-pattern, Pull/Push-mix, SQ mix…), `manualAthletes` (hand-made athlete "IndreB"), `variationScales` (slRDL landmine ×1.3), `tierSeed`.
- **Manual sets** grew to ~22 (HSPU 2026-06-08 session, Plate lifts, v-squat/Squat, Indre & Marija squats/DL/pulls).
- **Set notes / overrides** expanded (HSPU 06-08 fknuckle/ROM notes, Plate-lift cm, marijasenkus Pull Ups −35), and `metaOverrides` widened (more tier/discipline/muscle reclassifications + mgLevel weights).
- **Code/short-name renames** extended; **athleteStats** now adomasgaudi + indreb; display: nameMode "short", hard-sets-only on, dataTags on.

### 🟢 KEEP — authored data in this snapshot
World records (Bench 200/140, Pull Ups 100/60, Squat 360/260); body stats (adomasgaudi 29 m 90.5 kg 180 cm; indreb 29 f 70 kg 160 cm); exercise codes + short names; muscle/tier/discipline overrides incl. mgLevel; user groups (Shoulder mix, Single leg RDL +) + group-member ratios; world-record approvals (allowedGraphs); HSPU difficulty tuning (famFactors, variationVecs); ~22 manual sets; 3 deleted sets; not-comparable "HSPU | static from bottom"; new exerciseLens / manualAthletes / variationScales / tierSeed.

### ⚙️ CACHE — settings / session
signedIn 1, viewMode admin, viewUser/lastAthlete pinned to adomasgaudi (public default); lang en, theme light, nameMode short, hard-sets-only on, simplified off; active-set cutoff "none", no include/exclude/solo.



**🆕 since the 13:18 snapshot** (what you added/changed):
- **App-wide filter is now SOLO (only-these)** — cutoff "S" plus a big hand-picked list of ~250 lifts pinned as the active set (was empty before).
- **Bodyweight-part ranges set**: Dumbbell Lunge 0.6, Hip Thrust 0.3.
- **More renames** — short names +3 (Push Ups→"Push Up", Dumbbell Lunge→"dLunge", Smith Machine Incline Close Grip Push Up→"smPush Up"); codes +3 (Dumbbell Lunge→"dLunge", Smith Machine Incline Close Grip Push Up→"smPU", Standing abductor→"standH-AB").
- **More category overrides** — Push Ups→Chest(+Triceps); Dumbbell Lunge→Quads(+Glutes); Smith Machine Incline Close Grip Push Up→Chest(+Triceps); Hip Thrust→Glutes(+Quads, Hamstrings, Lower back) and promoted to **main** tier.
- **Allowed-graphs review widened** (now a per-metric review state, not a flat list): Pull Ups, Bench Press, Deadlift, Push Ups fully enabled; Lat Pulldown, Romanian Deadlift, Dumbbell Bench/Shoulder Press, Smith Machine Squat, Squat, Dumbbell Lunge reviewed at state 1; Shoulder Press at 3.
- Hard-sets-only turned **off**; last-viewed athlete now "dzuljeta" (you're still signed in as adomasgaudi).

**🟢 KEEP — unchanged from 13:18**: the 3 hand-logged sets; body stats (29 m, 90.5 kg, 180 cm, bf ~13–23%); 2 HSPU set-note edits; 3 deleted sets; world records (Bench 200/140, Pull Ups 100/60, Squat 360/260); HSPU multiplier tuning + ~11 per-note variation picks; not-comparable "HSPU | static from bottom".

---

## 2026-06-07 · app b.2.7.16 · exported 13:18

### 🟢 KEEP — your data
- **Hand-logged sets** (3, exist only here): HSPU 2026-06-06 ×5; HSPU 2026-06-06 ×45; Pull Ups 2026-06-07 15 kg ×5.
- **Body stats**: 29 y, male, 90.5 kg, 180 cm, body-fat ~13–23 % (avg 18 %).
- **Edited sets** (2): HSPU 2026-06-01 #1 & #2 — notes added (B2W / L-yoga setups).
- **Deleted sets** (3): HSPU 2023-09-13, 2026-03-17, 2026-06-06.
- **Short-name renames** (11): e.g. Handstand Push Ups→"HS-Push Up", Bench Press→"BPress", Deadlift→"DL", Lat Pulldown→"LAPD".
- **Code renames** (7): e.g. Handstand Push Ups→"HS-PU", Decline Sit Up→"decSU".
- **Category/muscle/tier/discipline overrides**: Squat→Quads(+Glutes, Lower back); Deadlift→Lower back(+Quads, Hamstrings, Glutes); Pull Ups→Lats(+Biceps, Forearms); Pull Ups & Push Ups→Calisthenics; a few lifts demoted to 2nd/3rd tier.
- **World records set**: Bench 200 m / 140 f; Pull Ups 100 / 60; Squat 360 / 260 kg.
- **Handstand difficulty tuning**:
  - Multiplier edits (`famFactors`): HSPU paused 0.9, supports 0.9, ladder-6 0.7.
  - Per-note variation picks (`variationVecs`): ~11 HSPU notes mapped to support / ROM / lean.
  - Not-comparable: "Handstand Push Ups | static from bottom".
- **Allowed graphs reviewed**: Pull Ups & Squat — all 15 graphs enabled.

### ⚙️ CACHE — settings / session (disposable)
- Display: name mode "full", language "en", simplified view off, hard-sets-only on, show body-comp range on, compact time off, show add-sets off.
- Filter: active-set tier cutoff "S"; no include / exclude / solo; no alone-tags.
- Session: signed in, view mode "admin", viewing as / last athlete "adomasgaudi".
