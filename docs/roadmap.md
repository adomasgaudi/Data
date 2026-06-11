# Roadmap — features to ADD

Forward-looking **wishlist** of features not yet built. Distinct from
`cleanup-backlog.md` (which is about *removing/simplifying* existing code) — this
is about *adding*. Awareness, not a mandate; owner picks by code. Per CLAUDE.md
rule 11 each item has a code + severity (🔴 burning · 🟠 worth-it · 🟢 nice-to-have),
plus a `[part]` chip and an `(SP:n)` Fibonacci effort estimate (AI estimate, tweak
freely). Nothing here is 🔴 — these are enhancements, not bugs.

Merged from the old `enhancements-backlog`, `technical-debt`, `graph-migration-audit`
and parity audits (now deleted — they were `b.2.2.x` migration snapshots that have
served their purpose; git has them).

## Graph / analysis
- 🟠 **FEAT-1** [Graphs] (SP:5) — Apply aggregation/interval (max/avg/sum per day/week/month) to ALL metrics, not just the count metrics; one `aggregate(points, cfg)` step in `analyticsGraph`.
- 🟠 **FEAT-2** [Graphs] (SP:5) — Per-formula 1RM (Epley/Brzycki/Nuzzo) in the universal graph + the legacy "best set only / center" framings as options.
- 🟠 **FEAT-3** [Graphs] (SP:3) — Compare per-set RANGE as a universal metric (so the universal graph fully covers the compare overlay — also helps finish CUT-2).
- 🟢 **FEAT-4** [Graphs] (SP:8) — Finish the registered-not-computed metrics: Sets, Frequency, PR markers, Trend line, Predicted strength.
- 🟢 **FEAT-5** [Graphs] (SP:3) — Scaled-effort / squat-rack-hole (technique-scaling) series as universal metrics.
- 🟢 **FEAT-6** [Graphs] (SP:3) — Per-metric axes / unit grouping (instead of one shared right axis squashing e.g. Volume vs Sets).
- 🟢 **FEAT-7** [Graphs] (SP:3) — Saved graph presets ("My strength view": chosen metrics + config).
- 🟢 **FEAT-8** [Graphs] (SP:3) — PR/record annotations and goal/target lines on the graph.

## Metadata / taxonomy
- 🟠 **FEAT-9** [Taxonomy] (SP:5) — Editable body part / muscle / function per-exercise (like joints/movements/planes already are), via the bulk-assign tool.
- 🟢 **FEAT-10** [Taxonomy] (SP:8) — Taxonomy coverage toward 100% (keyword inference + manual review) with a coverage view. *(See cleanup CUT-4: this is the "commit" path; CUT-4's other option is to cut it.)*

## Sync / sharing
- 🟠 **FEAT-11** [Sync] (SP:13) — Cross-device sync: persist exercise defs, taxonomy assignments and graph state to the repo/GitHub instead of per-device localStorage.
- 🟠 **FEAT-12** [Analysis] (SP:3) — Selector ↔ in-panel single selection store (the drill-in name switch and compare chips write back to the analysis selection; fixes the known desync).
- 🟢 **FEAT-13** [Sync] (SP:3) — Shareable URLs: two-way hash/URL state so a selection/mode is bookmarkable.

## Nice-to-have
- 🟢 **FEAT-14** [Export] (SP:3) — Export a graph/table as image or CSV.
- 🟢 **FEAT-15** [Analysis] (SP:5) — Smart suggestions ("you haven't trained X in N weeks", stalling lifts).
- 🟢 **FEAT-16** [Index] (SP:8) — Exercise relationship builder UI (visualise dissolved/combined/comparison trees).
- 🟢 **FEAT-17** [Index] (SP:3) — Virtualised chip list (only needed if the library grows into the thousands).
- 🟢 **FEAT-18** [Taxonomy] (SP:5) — Plane/joint mini-diagram illustrating an exercise's taxonomy.
- 🟢 **FEAT-19** [Analysis] (SP:8) — AI summaries of an athlete / exercise / session.
- 🟢 **FEAT-21** [Data] (SP:5) — Export the app's workout data as a StrengthLevel-importable CSV, so a user can view their data on strengthlevel.com too. *Distant-second priority after the backend/multi-device work.*

## Coach
- 🟢 **FEAT-20** [Coach] (SP:13) — Roster-level **Coach Home digest**: scan all athletes at once (who PR'd this week, who's stalling, who vanished, team momentum) as an admin landing. *Parked idea from the `#CEO` "coach as primary user" review (`docs/ceo/coach-primary-user.md`) — deferred because the coach works one client at a time; revisit if the roster grows.*
