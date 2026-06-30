<!-- Loaded when: owner types #debug -->
Purpose: when a fix keeps failing or a "should-be-trivial" thing keeps breaking — stop guessing, instrument the whole path, and verify ONE thing at a time.

# #debug <problem>

**HALVE the difficulty until you hit something you can be SURE of, then build back up checking each step.** (Owner's framing: you're guessing a 4-digit code — if you can verify ONE digit at a time it's 40 tries; all 4 at once is 10000.) When a fix keeps failing or a "should-be-trivial" thing keeps breaking: STOP shipping a full speculative fix and asking "does it all work now?".

Instead:
1. **Start from the smallest thing you KNOW works.**
2. **Add ONE change / one variable at a time.**
3. **Make the invisible OBSERVABLE** — for anything you can't see yourself (the live site), add a tiny on-screen readout of the real runtime values (widths, version, state) so a single screenshot tells you which "digit" is wrong.
4. **ASK THE OWNER TO CHECK THAT ONE PART** before piling on the next. Incremental + verifiable beats one big bundled guess.
5. **LOG THE WHOLE PATH, extra hard** — don't just shorten steps or reason from "known-good" parts; INSTRUMENT the mechanistic flow: drop a `console.log` / on-screen trace at EVERY step the data passes through (each function entry, each branch taken, each value read/written, every early-return) so you SEE under the hood where the path actually diverges from what you assumed, instead of guessing which step broke. The bug is usually at the step whose real value contradicts your mental model — logging every step is what surfaces that contradiction.

## A fix that FAILS EVEN ONCE → switch here immediately (HARD RULE)
STOP shipping fixes. Log the WHOLE path, smallest increments, one "digit" at a time. **Never re-guess the full 4-digit code (10000 tries)** — re-guessing after a miss is the banned move. Instrument every step of the failing flow with on-screen `dbg()` so ONE screenshot shows which step contradicts your model, THEN fix only that. (Owner: "log more, try smaller increments.")

## DEBUG BY CONTRAST — start from what ALREADY WORKS, never from the whole fix (HARD RULE)
When X (e.g. pan/zoom) won't persist/work:
1. FIRST list the SIBLINGS that DO work in the same situation (e.g. what else survives a bubble-switch — exercises, metrics, type…).
2. Ask "how is the broken one DIFFERENT from those?" and make it work the SAME way.
3. If still unclear, probe how X behaves in OTHER situations (does it fail elsewhere too? how does it differ from neighbours like the graph's points?) to LEARN the bug before touching it.
4. Enumerate working-vs-broken cases one by one — don't try to fix the whole thing at once. (Owner: "#debug #max".)

Pairs with `#super-persistent`'s on-screen diagnostic + device-cache check; `#debug` is the everyday, lighter version of that discipline.
