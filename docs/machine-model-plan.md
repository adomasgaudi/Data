# Machine model + add-page settings cog — design plan

Owner asked (Jun 18, screenshot of the Add-exercise sheet): an add-page **⚙ cog**
that opens per-exercise settings (machine weight, weight multiplier, unilateral…);
editing a **machine weight** pops a **"changed for all users with this machine — undo?"**
confirm; and a new **machine** concept — each exercise has a **default machine**, a
user can **switch the machine** (which may have different settings), and the machine
is **hidden from the normal history view**. Owner chose **"full machine model — plan
first"**: nothing ships until this plan is approved.

This doc is the SSOT for the build — any AI working it updates the boxes and the
remaining count. Deploy to `opus-4.8` one task at a time (rule 7/59); re-derive
codes + version at commit (rule 8).

---

## The problem with today's model

Three machine facts are stored **per-exercise**, global + synced:

- `isAssistedMachine(ex)` — bool; assisted (negative counterweight, halved). Store
  `colosseum.assistedHalve.v1`, else pull-up name auto-detect. (`src/main.ts:2325`)
- `machineWeightFor(ex)` — kg base added to the load, e.g. Leg Extension 20; shown
  as the `20+30` prefix. Store `colosseum.machineWeights.v1`. (`src/main.ts:899`)
- `machineMultFor(ex)` — the ÷ divisor (dial over-read), default 2; shown as `-20/2`.
  Store `colosseum.machineMult.v1`. (`src/main.ts:2337`)

The owner wants these to live on a **machine** that exercises *point at*, so (a) one
machine can serve several exercises ("all exercises with this machine"), and (b) a
user can swap an exercise onto a **different** machine with different settings.

---

## Proposed data model (NEEDS OWNER SIGN-OFF — see Open questions)

A **machine** = a named entity owning the machine settings:

```
Machine = {
  id:        string   // stable key, e.g. "m_legext" / a slug of the name
  name:      string   // user-facing, e.g. "Leg Extension machine", "Cable stack A"
  kgBase:    number    // the hidden base resistance (today's machineWeight); 0 = none
  divisor:   number    // the dial over-read ÷ factor (today's machineMult); default 2
  assisted:  boolean   // counterweight reads negative & is halved (today's isAssistedMachine)
}
```

Two link layers:

- **Exercise → default machine** (GLOBAL, synced): `exerciseDefaultMachine[ex] = machineId`.
  The machine an exercise uses unless a user overrides it.
- **(User, exercise) → machine** (PER-USER, synced): `userExerciseMachine[user][ex] = machineId`.
  A user's choice of which machine *they* use for that lift; falls back to the
  exercise default, then to "no machine".

**Settings resolution** (the new choke-point every read goes through):

```
machineForUserExercise(user, ex) -> Machine | null
   = MACHINES[ userExerciseMachine[user]?.[ex] ?? exerciseDefaultMachine[ex] ] ?? null
```

Then the three readers become thin wrappers (keep the names so call-sites don't churn):

- `isAssistedMachine(ex)`  → `machineFor(...)?.assisted ?? <legacy auto-detect>`
- `machineWeightFor(ex)`   → `machineFor(...)?.kgBase ?? 0`
- `machineMultFor(ex)`     → `machineFor(...)?.divisor ?? 2`

**Global vs per-user split** (this is what the confirm wording encodes):

- A machine's **settings** (kgBase/divisor/assisted) are **GLOBAL** — editing them
  changes every exercise + every user on that machine → the "changed for all users —
  undo?" confirm.
- **Which** machine a user uses for an exercise is **PER-USER** — no global confirm,
  it only affects that user.

**Stores** (all `colosseum.*`, auto-synced like the current machine stores):

- `colosseum.machines.v1` — `Record<id, Machine>` (the shared registry).
- `colosseum.exerciseMachine.v1` — `Record<exercise, machineId>` (global default).
- `colosseum.userExerciseMachine.v1` — `Record<user, Record<exercise, machineId>>` (per-user).

**Hidden from history**: the machine name is metadata — never rendered on the
history line. Its kgBase/divisor still feed the `20+30` / `-20/N` formula exactly as
today (the formula is the only place the machine "shows", indirectly).

---

## Open questions for the owner (lock these before Phase 3)

1. **Is a machine shared by MANY exercises?** The wording "all exercises with this
   machine" implies yes — a machine is a pool (e.g. one cable stack serves several
   lifts). Assumed YES. ✅/✏️
2. **Per-user = pick from the shared registry (settings stay global), or per-user
   settings too?** Assumed: a user picks **which** shared machine; its settings are
   global. (So two users on the same machine share settings; a user wanting different
   settings switches to / creates a different machine.) ✅/✏️
3. **Machine choice applies to ALL of a user's sets for that exercise (not per-set)?**
   Assumed YES — it's metadata for the (user, exercise) pair, applied to every set,
   incl. past ones (the formula recomputes). ✅/✏️
4. **Creating machines** — auto-create one per existing exercise on migration (named
   "<Exercise>"), and let the user **add/rename** machines from the cog? Assumed YES. ✅/✏️
5. **Naming** — are machine names free text the owner types, or picked from a list?
   Assumed: a small picker of existing machines + a "new machine…" entry. ✅/✏️

---

## Migration (one-time, lossless)

On first load with the new model, fold today's per-exercise settings into machines:

- For each exercise that has a non-default machineWeight / machineMult / assisted
  flag, create a machine `{ name: ex, kgBase, divisor, assisted }` and set it as that
  exercise's default. Exercises with all-default settings get **no** machine (null).
- Keep the old `colosseum.machineWeights.v1` / `.machineMult.v1` / `.assistedHalve.v1`
  readable as a fallback for one version, then stop writing them.

---

## Read-site sweep (#prune — every place that must route through the machine)

- `machineWeightFor` — `src/main.ts:899`, prefix at `:909`, used `:2692`, `:7744`,
  `:8966`, index card `:13498`.
- `machineMultFor` — `:2337`, formula `:7771` (collapsed) + `:8965` (expanded), real
  weight `:2396`/`:2401`, add-set live conversion `:18237`, index card `:13507`.
- `isAssistedMachine` — `:2325`, `:2375`, real weight `:2396`/`:2401`, `:9026`,
  `:9841`, add conversion `:18237`.
- `isUni` (unilateral) — `:2301` (store `colosseum.unilateralExercise.v1`), used at
  `:2430`, `:2438`, `:8853`, `:8886`, `:9825` — **stays per-exercise** (not a machine
  property; just surfaced in the new cog).
- The missing-1RM / experimental explanation and the `-20/N` titles already read these
  helpers, so re-homing the helpers covers them automatically.

---

## Phased build (deploy one box at a time)

### Phase 1 — add-page settings cog (no model change yet) — DONE `EQUIP-1` `b.2.9.193`
- [x] **1a** ⚙ cog in the add-popup header toggles an inline `.addm-set-cog` panel (inline,
  not a floating popout — sidesteps the rule-32 clamp bug; the card already scrolls).
- [x] **1b** Panel surfaces the EXISTING per-exercise editors via the SSOT getters/setters:
  assisted toggle, machine weight, ÷ multiplier (when assisted), unilateral. (ROM +
  experimental already live inline in the add form, so not duplicated here.)
- [x] **1c** LT i18n for the new labels (also covers the set-edit assisted/unilateral
  toggles); panel re-targets the lift on new-exercise name change.

### Phase 2 — global-change confirm + undo
- [ ] **2a** Wrap machine-weight (and ÷) edits in a confirm/undo toast: "changed for
  all users — undo?" (pre-Phase-3 wording; becomes "…with this machine" after Phase 3).
  Undo restores the previous value. Reuse one shared toast helper.

### Phase 3 — machine entities (architectural — needs the model signed off)
- [ ] **3a** Add the three stores + `Machine` type + `machineForUserExercise()` resolver.
- [ ] **3b** Re-point `machineWeightFor` / `machineMultFor` / `isAssistedMachine` at the
  resolver (thin wrappers); sweep the read-sites above.
- [ ] **3c** Migration: fold existing per-exercise settings into auto-created machines.
- [ ] **3d** Machine **picker** in the cog: choose the machine for this (user,)exercise,
  or "new machine…"; editing a machine's settings is the Phase-2 global confirm.
- [ ] **3e** Hide the machine from the history line (metadata only); confirm the
  formula still reads the resolved machine's kgBase/divisor.
- [ ] **3f** Update the confirm wording to "all exercises with this machine".
- [ ] **3g** Tests for the resolver + migration (pure functions in a testable module).

---

## Owner decisions (Jun 18) — MODEL LOCKED

1. **Shared pool — YES, and it's EQUIPMENT, not just machines.** "some exercises can
   share a machine or dumbbells or bar etc." → the entity is a piece of **equipment**
   (machine / dumbbell / barbell / cable / bodyweight…) that several exercises point at.
   Rename `Machine` → `Equipment` with an optional `kind`; the weight/÷/assisted
   settings are the *machine* kind's fields (a dumbbell/bar mostly just groups
   exercises, no ÷). Settings stay GLOBAL per equipment.
2. **Pick a shared machine; settings global.** Confirmed — a user chooses WHICH shared
   equipment they use; to get different numbers they switch to / create another one.
3. **Only NEW sets — so stamp the equipment PER SET at log time.** A set remembers the
   equipment it was logged on; switching equipment changes only sets logged AFTER the
   switch. Past sets keep their stamped equipment.

### Resulting model refinements

- **Set gains `equipmentId`** stamped when logged (in the set record /
  `colosseum.setOverrides.v1` for imported sets). A set's formula reads ITS stamped
  equipment, NOT a live (user,exercise) lookup.
- **`(user, exercise) → currentEquipmentId`** (per-user, synced) is the DEFAULT stamped
  onto a NEW set — never applied retroactively.
- **Migration** stamps every EXISTING set with its exercise's default equipment (the
  auto-created one carrying today's per-exercise settings) — what they were computed with.
- Stores: `colosseum.equipment.v1` (registry), `colosseum.exerciseEquipment.v1` (global
  default per exercise), `colosseum.userExerciseEquipment.v1` (per-user current choice).
  Set-level `equipmentId` rides in the set record / setOverrides.
- Resolver split: `equipmentForSet(set)` (stamped id, for rendering past sets);
  `currentEquipmentFor(user, ex)` (what a new set will stamp).

## Status

- **Model LOCKED (owner answered the 3 forks Jun 18).** Open Qs 4–5 ride as defaults
  (auto-create equipment on migration; add/rename from the cog).
- **Phase 1 (add-page cog) — STARTING.** Phases 2–3 follow, one box at a time.
