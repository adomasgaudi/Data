<!-- Loaded when: owner types #persistent (alias #repeating) -->
Purpose: a bug that has RECURRED (fixed before, it's back) — treat as a standing failure to learn from, log it, fix the root.

# #persistent <bug>  (alias #repeating)

A bug that has RECURRED (fixed before, it's back). Treat it as a STANDING failure to learn from, not a one-off. `#repeating` and `#persistent` are the SAME — one doc, `docs/persistent-bugs.md`.

## Moves
1. **ALWAYS log it in `docs/persistent-bugs.md`** (code `PB-n`):
   - date,
   - the **DEVICE + browser** it was seen on (persistent bugs are often device-specific — pay extra attention to which device, and whether a past "fix" only held on one),
   - the symptom,
   - EVERY prior fix that didn't hold,
   - the suspected real root cause.
2. **Research WHY it keeps coming back** — usually a wrong abstraction, an escalation war, a CSS stacking-context, or a device/engine quirk — and fix the ROOT. Symptom-patching is what made it recur.
3. **Bump the entry's recurrence count** each return; the more it recurs, the harder you dig.
4. **Leave a code-comment at the fix site** pointing to its `PB-n`.

Read `docs/persistent-bugs.md` before touching an area that has a `PB-n`. If the bug has defied multiple fix attempts across multiple AI sessions, escalate to `#super-persistent`.
