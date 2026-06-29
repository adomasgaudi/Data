# Session log

Mechanical, append-only record of what each AI session shipped — written by the
`scripts/session-log.cjs` Stop hook whenever a reply closes a task with a
`===TASK-DONE===` block. Newest first. This is the cross-session continuity log
(the owner only sees the live site; this is how a later AI sees what happened).

Each entry: `## <timestamp> · <branch> · <version> · <sha>` then shipped /
verified / cost / files lines. Not hand-edited.
