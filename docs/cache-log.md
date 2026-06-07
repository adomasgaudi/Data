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

## 2026-06-07 · app b.2.7.53 · exported 19:44

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
