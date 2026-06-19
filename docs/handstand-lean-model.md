# Handstand lean — hand-to-wall distance model + wall-tap rest tag (PLAN)

Owner spec (Jun 19, long voice note). A big, multi-part enrichment of the
handstand `lean` variation + a new wall-tap contact tag. **Plan first — build in a
focused fresh session** (the variation-tag area is hot, b.2.9.226–230 just shipped
`rom-percent-or-cm-with-reference` / tag work; sync to latest before coding). This
doc is the SSOT for the build — any AI updates the boxes + open questions.

---

## What the exercise is

**Handstand Wall Touch (wall tap):** kick to a handstand by a wall / shoulder
support, move the hands AWAY from the wall, then reach back to touch it. The
**difficulty = how far the hands are from the support** — i.e. the forward LEAN.
This is the same `lean` axis HSPU already has; the spec makes HOW you measure it
richer, and adds a contact tag specific to wall taps.

**Applies to (anything with a lean):** Handstand Wall Taps (lean IS the point),
HSPU (when leaning), Handstand Kicks (can lean then kick). Wherever a lean amount
exists, difficulty is the cm from the palm-base to the support.

---

## Tag 1 — the lean DISTANCE (hand → wall), enriched

### Canonical stored value
- **Canonical = centimetres from the BASE OF THE PALM to the wall/support.** The
  palm-base is where the hand actually pivots — the torque/lever origin — so it's
  the physically correct reference. Everything converts to this; the `lean` factor
  table is read on this canonical cm.

### Input flexibility (reference point on the hand)
You may measure from any of **4 hand points**, because a tape/block lands wherever
is convenient:
- fingertips
- **finger knuckles** ← owner's usual; the default input reference (MENTIONED in
  the picker, but it is NOT a separate tag — it only changes the conversion)
- knuckles
- base of palm (= canonical, offset 0)

An input of "`X` from `<point>`" converts to canonical: `canonical_cm = X +
offset(point)`, where `offset(point)` is that point's distance back to the palm-base.

### Per-person hand calibration (NEEDED — varies by person)
Offsets differ per person (owner's fingertips→base ≈ 16 cm). So we need a per-person
input of the hand offsets. **OPEN Q1** — model:
- (a) store ONE length (fingertips→base) per person + fixed ratios for the
  intermediate points (finger-knuckle ≈ ?, knuckle ≈ ?), or
- (b) store all THREE offsets (fingertips, finger-knuckles, knuckles; base = 0) per
  person. ← more accurate, a touch more input.
- Where it lives: a profile/Settings field per athlete (it's a body measurement,
  like bodyweight), synced. Default to the owner's numbers as a starting point.

### Unit: cm OR yoga block
Distance can be entered in **cm**, or as a **yoga block** placed against a hand
point. **OPEN Q2** — the existing `rom` comment says one block reads +5 / +15 / +23
cm by its SIDE; is the owner's "small / medium / large block" the **3 sides of one
block** (≈5 / 15 / 23 cm) or **3 different blocks**? Confirm the cm of each. A block
entry then converts: `canonical_cm = block_side_cm + offset(point)`.

### Display
- The tag shows the canonical distance compactly (e.g. `18cm`), like today's lean/cm
  tags. The input reference + unit are a convenience on entry, surfaced in the
  picker menu (small-grey hint), not as extra tags (owner: don't tag the reference).

---

## Tag 2 — wall-tap CONTACT (what touches + rest vs tap)

Wall-tap specific. Two independent attributes → 4 variations, ONE tag, SHORT label
(code) with the full explanation in the picker menu (owner: the wording is too long
for the chip).

- **WHAT contacts the wall:** shoulders only · hips+shoulders (hips also reach the
  wall → more support, easier).
- **CONTACT type:** light **tap** (harder) · **rest** / lean on it (easier).

**OPEN Q3 — confirm the 4 variations, their short codes, and the difficulty order.**
Proposed (easiest → hardest), short codes TBD:
| variation | proposed code | rel. difficulty |
|---|---|---|
| hips+shoulders, rest | `HS·rest` | easiest |
| shoulders, rest | `Sh·rest` | |
| hips+shoulders, tap | `HS·tap` | |
| shoulders, tap | `Sh·tap` | hardest |

(Owner hinted hips+shoulders is easier than shoulders-only, and rest easier than
tap — so the table orders by support then contact. Confirm codes + whether all 4 are
real / the exact ordering.)

---

## Open questions (lock before building)
1. **Hand calibration model** — one length + ratios, or three measured offsets? Where stored?
2. **Yoga block** — 3 sides of one block (≈5/15/23 cm) or 3 blocks? Exact cm of each?
3. **Wall-tap contact tag** — confirm the 4 variations, short codes, difficulty order.
4. Canonical = palm-base ✅ (owner stated). Default input reference = finger-knuckles ✅ (owner stated).

## Build sketch (after sign-off — one box at a time, deploy on opus)
- [ ] Per-person hand-offset input (profile/Settings, synced).
- [ ] Lean tag entry: reference-point picker (4) + unit (cm / block) → convert to canonical palm-base cm; store canonical; show canonical chip + entry hints in the menu.
- [ ] Wire the lean axis for Handstand Wall Taps + Kicks (HSPU lean already exists), so the canonical cm feeds the existing `lean` factor table.
- [ ] Wall-tap contact tag: a new family dimension (2×2 → 4 levels) with short codes + menu explanation + calibrated factors.
- [ ] i18n (LT) for every new label; tests for the conversion (pure fn) + the tag.
