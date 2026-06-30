# Session log

## 2026-06-29 13:04 · opus-4.8 · b.2.9.311 · b3f19ac <!--0d2b7fe5ab98-->
- shipped: CLAUDE.md refactored to a lean ~77-line core + 18 hook-injected on-demand docs (ui/release/git/data/replies/process + 12 commands); full monolith archived verbatim; 2 new injector hooks; rules-check branch fix
- verified: typecheck + 692 tests + build green (b.2.9.311); both injectors tested live (release.md on index.html edit, git.md on push); pushed to opus-4.8
- cost: ~€0.04 (cost-v.2)
- files: CLAUDE.md, .claude/settings.json, scripts/{cmd-inject,rule-inject,rules-check}.cjs, docs/rules/*.md (6), docs/commands/*.md (12), docs/archive/claude-md-full-b.2.9.310.md, index.html, src/changelog.ts


Mechanical, append-only record of what each AI session shipped — written by the
`scripts/session-log.cjs` Stop hook whenever a reply closes a task with a
`===TASK-DONE===` block. Newest first. This is the cross-session continuity log
(the owner only sees the live site; this is how a later AI sees what happened).

Each entry: `## <timestamp> · <branch> · <version> · <sha>` then shipped /
verified / cost / files lines. Not hand-edited.
