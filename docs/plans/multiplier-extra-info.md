# Plan — flaky (handstand) multiplier → tap-only extra info, never a tag

Owner spec confirmed via /grill-me (2026-06-29). **Build in a FRESH session** —
this was captured while the add-set-modal-overflow task is `#lock`'d, so it is
PLAN-ONLY. Do not start until that lock clears.

## Why
The handstand difficulty multiplier (×N) currently shows in history both as a
variation **tag/chip** and **inline ×N**. Its computed value is often a
wrong/nonsense number (cm→× lean curve is unreliable). Treating it as a tag makes
it look authoritative when it isn't. The owner does NOT want the math fixed now
(too big) — only the *display* demoted so it can't mislead.

## What the owner wants (confirmed)
1. **Flaky lifts** = auto-detected as any lift whose multiplier comes from the
   **cm→× lean curve** (handstand-style; `handstandLean.ts` / `interpCmFactor`).
2. For flaky lifts: the multiplier is **never** a tag/chip and **never** shown
   inline on the main history line. It is reachable **only on tap/hover
   (tooltip)**, clearly presented as supplementary info — not a score.
3. For all OTHER (reliable) lifts: inline ×N is **unchanged**.
4. The multiplier value is still *shown* (demoted), not removed.

## Scope
**In:**
- History rendering: detect cm/lean-curve-sourced multipliers; route them to
  tap/tooltip only; suppress their tag-chip form. Pin BOTH render sites exactly
  (tag-chip site + inline ×N site) in `historyDash.ts` / `main.ts` during impl —
  they were not located in the grill (plan-only).
- Add a `docs/persistent-bugs.md` PB entry for the wrong/nonsense multiplier
  **MATH** (handstand cm→× producing bad numbers) — tracked, not fixed now.
- i18n entries for any new/changed user-facing text; version bump + changelog;
  translate to LT.

**Out:**
- Fixing the multiplier MATH (only logged as PB).
- Reliable lifts' inline ×N (untouched).
- Any backend / data / CSV change.

## Constraints
- Tooltip must NOT trigger a browser-modal/alert.
- Visuals unverifiable from here → verify build+tests; owner eyeballs the
  tooltip on-device.
- `npm test` + `npm run typecheck` green before done.

## Open assumptions
- a. The `interpCmFactor` / `handstandLean` path is the single signal for
  "flaky" — any lift using it = tooltip-only.
- b. "Tag chip" and "inline ×N" are two distinct render sites — pin both at impl.
- c. Multiplier value stays visible (demoted), not deleted.
