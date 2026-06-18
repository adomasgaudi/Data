# Plan — ROM-in-cm tag for handstands (from-head / from-floor + yoga-block units)

Owner spec (2026-06-18), to build in a FRESH session (this one ran long). Items 5–7 of the
handstand-tag overhaul. Items 1–4 already shipped (gray model b.2.9.219; config cleanup
b.2.9.218). The owner approved the design points below via AskUserQuestion.

## What the owner wants
- **A ROM tag measured in CM** for handstand exercises — separate from the universal ROM%
  passive tag. "ROM cm … very common and important for handstands, so it should be an
  ACTIVATED tag for these exercises" (i.e. promoted/active by default for handstands, not
  hidden).
- The lean (forward-lean) tag and this ROM tag should open a **unit popup** (like the incline
  ↕ picker already built — `openInclinePicker`) that lets you set the value in:
  - **cm**, or
  - **yoga-block lengths** — block sizes **6 / 15 / 23 cm** (confirmed; same as the obstacle
    S/M/L sizes in `variationConfig.ts`). Both convert to cm.
- **ROM has two reference points: from the FLOOR and from the HEAD.** Owner: "rom can be
  calculated from the floor or from the head … so I can see they're comparable, like the
  push-up incline cm." Only handstand exercises have this dual-reference ROM.
  - Approved interaction: **"show both, set in one"** — you enter the depth in ONE reference
    (e.g. from the floor); the popup shows the equivalent from-the-head value beside it (a
    read-only conversion), like the incline picker's `= Ncm · ×mult` readout.
  - Need an offset to convert floor↔head: head-travel + remaining-gap = total stack height.
    Pick a sensible default constant (the inverted body's shoulder-to-floor span) and make it
    tunable (a famFactor-style override). Confirm the number with the owner from the live site.

## The "multiple cm tags are unclear" problem (owner item 5)
There are now THREE cm-based things on a handstand and they must be clearly distinguished in
the picker (clear dim labels + hints):
1. **shoulder gap** (`shoulderDist`) — how far the shoulders sit OFF the wall. (Relabelled +
   hinted already in b.2.9.218.)
2. **fwd lean** (`lean`) — forward lean in cm. Needs the cm/yoga unit popup.
3. **ROM cm** (NEW) — depth of the press/skill in cm, from floor or head. Activated for
   handstands.

## Build notes / reuse
- Reuse `openInclinePicker` as the template for the unit popup (cm ↔ other-unit conversion +
  live readout). Generalise it or clone it: `openRomPicker` / `openLeanPicker`.
- The incline cm system (`levelCm`, `cmToLevel`, `inclineScaleFor`, INCLINE_TOOLS) is the
  precedent for unit↔cm conversion with a difficulty ×. ROM-cm likely wants its OWN cm→×
  curve (deeper = harder, >1) — handstands already have a `rom` dim with cm levels
  (+25cm…-20cm) in `variationConfig.ts` HSPU; reconcile NEW ROM-cm with that existing `rom`
  dim rather than duplicating (HSPU already has rom; HANDSTAND does not — owner wants it for
  the skill lifts too).
- "Activated tag for these exercises" = promote it by default for handstands. The passive-tag
  promotion store is `addmPassivePromoted` (`colosseum.addmPassive.v1`); either seed handstands
  with ROM promoted, or make ROM-cm a first-class active dim for the HANDSTAND family.
- Yoga-block unit: 6/15/23 cm; a block value of N blocks = N×(chosen block) cm? Or pick a
  block size then it's that height. Clarify the exact semantics on first build (likely: choose
  which block S/M/L, that IS the cm height — matching how obstacle works).

## Open questions for the build session
- The floor↔head offset constant (ask owner, default ~the shoulder-height of their inverted
  body, e.g. ~60–70cm — confirm).
- Does NEW ROM-cm REPLACE the universal ROM% passive tag for handstands, or coexist? (Owner
  implied ROM-cm is the handstand-specific one; ROM% stays the generic passive tag.)
- Exact yoga-block semantics (pick a block = that cm, vs stack N blocks).
