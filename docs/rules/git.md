<!-- Loaded when: git commit / push / branching -->

# Git, branches, saving & deploy

This file loads when you commit, push, or branch. It carries the full detail
behind the core stubs for branches (rule 2) and saving (rule 3), plus the
deploy/task-code rules.

## Rule 2 — authoritative branch = `opus-4.8` (detail)

`opus-4.8` is the single source of truth — start new work from it. The other
model branches (`main`, `haiku-4.5`, `sonnet-4.6`, `fable-5.0`) SYNC FROM opus
and opus WINS on conflict. The old `claude/strength-training-dashboard-SdAlT`
canonical is DEPRECATED (don't trust it).

## Rule 3 — Save = commit + push (detail)

**Save = commit + push** after every change — the owner only ever sees the live
GitHub Pages site, so unpushed work is invisible to them.

## Rule 6 — two AIs at once: own folder + branch (DESKTOP/VSCode only)

Each desktop-editor AI gets its own folder + branch — never share a branch.
**Claude Code / web-session AIs are EXEMPT** — they work on model branches per
rule 2, not local folders.

## Rule 7 — Done = deploy + propagate

Push verified work to `opus-4.8` (authoritative), publish (deploy), then SYNC
the other model branches to it — never leave verified work stranded on a side
branch. Opus wins on conflict.

## Rule 59 — ALWAYS DEPLOY ON OPUS (reinforces rule 7)

Even when a harness/task pins you to a feature branch: the owner ONLY sees
`opus-4.8` / the live site, so work left on a side branch is INVISIBLE to them
(*"i dont see this change on opus"*). After pushing the feature branch, bring
the work onto opus too — cherry-pick/rebase your commits on, RE-DERIVE the
version + every task code as opus-highest+1 (rule 8 — both branches drift and
reuse numbers), resolve conflicts, and push opus so it goes live.

## Rule 8 — pick task code + version LAST, no clashes

Pick the task code (`CAT-n`) and version LAST, just before commit, as
**highest-in-history + 1**; after any rebase, RE-derive both — never reuse a
number already in the log.

## Task codes & SP (detail for rules 5 & 8)

- **Task code** = category (2–5 letters) + a number. Current categories:
  `EXR` exercises, `DATA` data tab, `CHART` graphs, `CALC` calculators,
  `LIFT` exercise/group/merge logic, `ATH` athlete, `WO` workouts,
  `META` process — coin a new one when none fits.
- **SP** = modified-Fibonacci `1,2,3,5,8,13,20,30,50,80,130,200` (1 trivial →
  200 epic); a tiny text/colour one-liner may be `0.5` / `0.1`.

(The commit subject format `CODE (SP:n) version kebab` and the version-bump
rules live in `docs/rules/release.md`.)
