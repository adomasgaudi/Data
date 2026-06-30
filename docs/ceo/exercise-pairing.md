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

### Phase 2 — The two-layer model (gym truth + personal veto) — SHIPPED b.2.8.427 (WO-179)
- [x] 4. **Reshape the store** — DIRECTIONAL edge model in pure tested `src/pairing.ts` (12 tests): `pairShared` (gym) + `pairPersonal` (per-user), resolution `personal ?? shared ?? neutral`, specific edge beating a `*→to` wildcard. Migrates the old flat `pairPrefs.v1` into the shared layer as wildcard baselines. — b.2.8.427
- [x] 5. **Single shared layer (no named gyms yet, per owner decision).** The flag a user sets writes to the GYM layer by default; the grade menu's 👤 Just-me toggle writes a personal override instead. (Home-gym profile field deferred until a 2nd gym exists.) — b.2.8.427
- [x] 6. **Show the layer in the chip** — a 👤 badge marks YOUR override; the grade menu titles the directional edge and its Gym/Just-me toggle shows which layer you're editing. — b.2.8.427
- [x] (sync) **Both layers sync to every user** automatically — `colosseum.pairShared.v1` + `colosseum.pairPersonal.v1` ride the existing cacheSync kv mirror (no backend wiring; rule 41/42). — b.2.8.427

### Phase 3 — Social hook + picker polish (tiers ① ②)
- [ ] 7. **Social count on each flag** — "starred by N lifters here". DEFERRED: the chosen single-shared-VALUE model has no per-user votes to count; a count needs a votes map (`edge → {user: grade}`), a bigger change. Worth doing once there are real multiple users at one gym.
- [x] 8. **Picker grouping** — the Pairs manager now groups flagged pairs by their FROM-lift ("Any lift →" for wildcards, then per lift). (Body-part grouping not added — from-grouping is the more useful axis for directional pairs.) — b.2.8.427
- [ ] 9. **Reasons (optional):** a one-tap reason on a flag ("far apart", "busy", "bad pump"). DEFERRED — tier-③ depth, additive (a `reason` field on the edge), easy to bolt on later; left out to keep this pass focused.

### Phase 4 — Close the loop (tier ④)
- [x] 10. **Planner uses it (lite):** the exercise card's "top pairs" strip surfaces the SUPER/GOOD directional pairs (from this lift → candidate) near the numbers, so the plan leads with the best supersets. The WHY annotation ("next machine over · starred by N") waits on steps 7/9. — b.2.8.427

## Sync note (rule 41 / rule 42) — DONE
Both layers are `colosseum.*` keys and NOT in cacheSync's exclude/local-only lists, so they already mirror to every user via the 3-way kv merge — no dedicated table or SQL needed. (Confirmed by reading `src/cacheSync.ts`: any `colosseum.*` key auto-syncs.)

## Why this is ~10 prompts, not 100
The hard part is the **two-layer model + migration** (steps 4–6, one careful effort); the rest is UI polish reusing patterns the app already has (chips, group-modes, the manager shipped in Phase-1). It is NOT a from-scratch feature — it's layering shared/personal onto an existing, now-visible flag system.

## Phase 5 — Practicality (equipment / mobility), owner decisions 2026-06-15
The owner wants pairings ranked by PRACTICALITY, not just non-overlapping muscle:
equipment mobility + setup cost + gym etiquette (can't hog more than 2–3 stations).

- [x] 11. **Sort + Hide on the "Pair with" list (ship first).** A Sort cycle pill
  (Practical / Muscle / A–Z / Trained) + a Hide-avoid toggle that drops the
  no-way-graded pairs. Device-local view prefs (`colosseum.pairSort`,
  `colosseum.pairHideAvoid`); apply only on render so a grade tap never re-sorts
  (rule 47). — b.2.8.476 (SEL-58)
- [x] 12. **Equipment + practicality tags — FULL SEPARATE TAGS (owner's chosen depth).**
  Station + Setup + Occupancy per lift, in pure tested `src/practicality.ts` (12 tests).
  Seeded by name-keyword inference across the WHOLE library (deadlift→Platform+Heavy,
  dumbbell→Free portable, leg press→Machine no-setup…) with an equipment-tag fallback —
  no hand-entry. `pairPracticalityScore(A,B)` replaces the deleted name-regex
  `pairEaseScore()`. — b.2.8.478 (SEL-60)
- [x] 13. **Wire practicality into suggestions** — the "Practical" sort now ranks by the
  real (A,B) station/setup/occupancy score; each chip's tooltip shows the cost via
  `pairPracticalityHint`. — b.2.8.478 (SEL-60)
- [ ] 14. **Manage-tags UI (deferred).** A small editor to hand-override any lift's
  Station/Setup/Occupancy (only the UI is missing). Also optional: auto-DEMOTE / flag
  pairs needing >2 busy stations rather than only sorting them down. Owner to confirm
  the etiquette threshold when wanted.

Steps 11–13 are SHIPPED (sort/hide + the real practicality model + wiring). Step 14
(hand-edit UI + hard etiquette demotion) waits on owner input on the threshold.
