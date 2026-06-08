# Restore points (known-good git commits)

Durable record of "last-known-good" commits to revert to if an **experimental**
or risky feature breaks things later. (Remote tag pushes are blocked on this repo,
so we record SHAs here instead of `git tag`.)

To roll back a single experiment, prefer reverting its commit(s); to hard-reset
the whole app to a point, `git reset --hard <sha>` on the canonical branch (then
re-deploy). Always check what's changed since first.

| Date | Version | Commit | Why it's a safe point / what came after |
|------|---------|--------|------------------------------------------|
| 2026-06-08 | b.2.7.123 | `e34bf66` | Last commit **before** the experimental **Horizontal history** view (a new "Horizontal history" dropdown that scrolls periods sideways). If that experiment destabilises the history/analysis view, revert its commit(s) or reset here. |
