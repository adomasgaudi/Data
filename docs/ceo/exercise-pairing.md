# CEO: exercise pairing — gym-shared, good/bad, per-user — without the spreadsheet feel

- **Asked:** 2026-06-15  ·  **Status:** PLAN (Phase-1 shipped b.2.8.419, this is the vision beyond it)
- **The point it serves:** pairing turns the planner from "what to train" into "what to train *together, here, today*" (tier ④). The hook is social — flags are gym knowledge other people left for you (tiers ① + ②). Done wrong it becomes a data-entry chore (the failure mode the owner already hit: "the exercises I flag just disappear").

## The question (owner, 2026-06-15, paraphrased)
"I need to manage exercise pairing. The exercises I flag just disappear — I need to SEE the flagged ones, search/group better in the picker, flag GOOD combos not only bad. These choices depend on the GYM — I can mark that a pairing only belongs to 'Lemon gym Skraja' — and ALL users at that gym should see them (gym-specific, not user-specific). But different users may disagree, so a user needs to override a shared flag with their own."

Owner steer: **"CEO should be max ~10 prompts, more creativity/experience-oriented than technical."**

## The core insight (the hard-thinking bit)
A pairing flag is **not a per-user preference** — it's a **piece of gym-local knowledge with a personal veto**. Two layers:

- **GYM layer (shared truth):** "At Lemon Skraja, Leg Press + Calf Raise are next to each other → easy superset (★). The cable station is across the floor from the squat rack → hard (⚑)." This is *physical fact about a room*, true for everyone there. It's the bragworthy, social, screenshot-worthy layer — knowledge the gym's lifters built together.
- **PERSONAL layer (the veto):** "Everyone here supersets bench + row, but I hate it → I avoid it (✕)." A thin override on top of the shared truth, never replacing it for others.

The invariant to protect: **a personal flag shadows the gym flag for that one user only; clearing the personal flag falls back to the gym flag — it never deletes shared knowledge.** Resolution is always `personal ?? gym ?? auto-ease-guess`.

Today's `pairPrefs.v1` is flat `{exercise → state}` and **device-local** — it has neither layer. Phase-1 (shipped) made the flat model visible and added the ★ "prefer" state; this plan adds the two layers + the gym entity.

## Four-tier read
- **① Curious/uninterested** — the hook is SOCIAL proof: "12 lifters at your gym superset these." A flag left by someone else is more interesting than one you set yourself. Surface a count ("★ by 8 here").
- **② Interested (easy controls)** — flagging stays one tap (the cycle pill already does this). The gym is picked ONCE (a profile setting), not per-flag. Defaults to "my gym", never asks per action.
- **③ Nerds** — the override mechanics, the per-gym layer, "show only my overrides vs gym defaults", reasons/notes on a flag.
- **④ Actionable** — the planner's "Pair with" ends in a verb: "superset Calf Raise (★ easy here, next machine over)". Every flag feeds the one suggestion.

## Decisions the owner must make (BEFORE Phase 2 code)
1. **Gym entity now, or fake it?** A real `gyms` registry + per-athlete "home gym" is the honest model but adds a picker + a store. Cheaper: a single implicit "shared" layer (no named gyms yet), name-gyms later. — *Recommend: start single-shared-layer, add named gyms only once a 2nd gym exists.*
2. **Where does "shared" live?** Per rule 41, shared config syncs via Supabase mirroring of a `colosseum.*` key (like sets do). Gym flags are SHARED data → must sync; personal overrides are SHARED-per-user too (they're data, not a device pref). Both sync; only the "which gym am I at" could be device-or-shared. — *Recommend: both layers sync; home-gym is a synced profile field.*
3. **Pairing = directional or symmetric?** "A pairs with B" — is B↔A automatic? Physically yes (machines don't move). — *Recommend: symmetric, store one edge, read both ways.*

## The plan (~10 steps, creativity/experience first — NOT padded)

### Phase 1 — Visibility + good flags (SHIPPED, b.2.8.419)
- [x] 1. Add ★ "prefer" as a 4th flag state (empty→prefer→hard→avoid). — b.2.8.419
- [x] 2. Remove the 8-candidate cap in "Pair with" so all pairs are visible. — b.2.8.419
- [x] 3. "⇄ Pair flags" manager in the Plan popup: see all flags grouped + search to flag any lift. — b.2.8.419

### Phase 2 — The two-layer model (gym truth + personal veto)
- [ ] 4. **Reshape the store** to `{ gym: {edge→state}, personal: {edge→state} }` (keyed by an unordered exercise-pair edge), with a migration from flat `pairPrefs.v1` → personal layer. Resolution helper `pairState(a,b) = personal ?? gym ?? autoEase`. Keep it a pure tested function (SSOT for every read).
- [ ] 5. **Home-gym profile field** (one synced setting per athlete; default a single implicit "shared" gym). The flag a user sets writes to the gym layer for their home gym; a long-press / second control writes a personal override.
- [ ] 6. **Show the layer in the chip:** a gym-sourced flag looks shared (e.g. a small 👥 + the count "★ ·8"); a personal override shows it's yours (and offers "clear → back to gym default"). Experience goal: you always know whose flag you're looking at.

### Phase 3 — Social hook + picker polish (tiers ① ②)
- [ ] 7. **Social count on each flag** — "starred by N lifters here" — the bragworthy, curiosity layer. Even a count of 1 ("you") reads better than a bare glyph.
- [ ] 8. **Picker grouping** in the Pairs manager: group candidates by body-part / by "easy here vs hard here", not one flat list (owner asked for "more grouping abilities"). Reuse the Index group-mode idea, don't rebuild it.
- [ ] 9. **Reasons (optional):** a one-tap reason on a flag ("far apart", "always busy", "bad pump") — opt-in, tier-③ depth, never required.

### Phase 4 — Close the loop (tier ④)
- [ ] 10. **Planner uses it:** the "Pair with" suggestion leads with gym-★ pairs and annotates WHY ("next machine over · starred by 8"), so every plan ends in one concrete superset to do today.

## Sync note (rule 41 / rule 42)
Gym + personal pairing layers are SHARED data → they must mirror to Supabase like `sets` do (today only `manualSets` syncs; this rides the same goal). The AI does the backend wiring via the existing GitHub Action + secrets — the owner never touches SQL.

## Why this is ~10 prompts, not 100
The hard part is the **two-layer model + migration** (steps 4–6, one careful effort); the rest is UI polish reusing patterns the app already has (chips, group-modes, the manager shipped in Phase-1). It is NOT a from-scratch feature — it's layering shared/personal onto an existing, now-visible flag system.
