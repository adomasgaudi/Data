# Attic — code parked mid-refactor (tier 1 of 3)

The closest, fastest-to-return holding spot. Code here was pulled out of `src/`
**during an in-progress large refactor** when it wasn't yet clear how much of it
stays or how it folds back in. Not built/typechecked/tested (root folder, outside
`tsconfig` `include`). Context is still fresh, so each item only needs a short
`NOTE.md` — not the full warehouse manifest.

This folder is **transient**. By the time a refactor closes, the attic should be
empty: every item has been **restored** to `src/`, **moved down to `warehouse/`**
(decided out, keep a while), or **deleted** (confident — git has it). A SessionStart
check flags anything left lingering here.

## Layout
```
attic/
  <short-name>/
    NOTE.md          # where it came from + the open question
    <the moved code, verbatim>
```

## `NOTE.md` template
```markdown
# <name> — parked mid-refactor
from:          <src path + functions/lines it came out of>
removed:       <YYYY-MM-DD>, during <refactor task code>
open question: <what's undecided — how much stays / how to fold it in>
depends on:    <imports / shared state / els it used>
```

## Discipline
Restore **one piece at a time** and **expect the missing-it friction** — that
feeling that the code "belongs" where it sat is not evidence you need it back.
Try to survive without it; bring back only what genuinely proves necessary.

See `../warehouse/README.md` for the full three-tier model.
