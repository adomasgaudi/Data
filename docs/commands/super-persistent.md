<!-- Loaded when: owner types #super-persistent -->
Purpose: a bug that has defied MULTIPLE fix attempts AND multiple AI sessions — stop patching, reproduce + bisect, fix the root.

# #super-persistent <bug>

A higher-stakes escalation of `#persistent`: the bug has defied MULTIPLE fix attempts AND multiple AI sessions without resolution.

**Core HARD RULE:** stop patching, bisect + reproduce first. NEVER add another symptom patch — instead binary-search history (`git bisect`) for the introducing commit, add a PERMANENT on-screen diagnostic banner, and fix the root.

## Required moves, in order
1. **Stop guessing** — do NOT add more symptom patches; each one makes the root harder to find.
2. **Build a reproduction** — add a PERMANENT, always-visible on-screen diagnostic (fixed-position banner, NOT a console.log) that reports the EXACT runtime state at the moment of failure; leave it in until the root is confirmed.
3. **Binary-search the history** — `git bisect` to find the EXACT commit that introduced the regression; read that diff in full.
4. **Read the full render path** from `init()` to the blank/broken output, tracing every function that touches the affected DOM element, noting every early-return and every conditional that could short-circuit.
5. **Check device cache** — the live site may be serving stale JS/CSS; confirm the version number matches what's deployed before any further debugging.
6. **Fix the ROOT** (the design flaw, not the symptom), add a comment at the fix site with the `PB-n` code, and bump the PB entry's recurrence count.

The diagnostic banner stays until the fix is confirmed working on the owner's device.

(Lighter everyday version of this discipline: `#debug`. Log the recurrence in `docs/persistent-bugs.md` as with `#persistent`.)
