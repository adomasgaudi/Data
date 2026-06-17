# Custom graph dashboard — build plan

**Owner's ask (verbatim intent):** instead of one fixed multigraph + one single graph
(where the single graph has swipeable "bubbles") each with their own type tabs — let me
build **my own setup**: as many **tabs** as I want, and within each tab as many **bubbles**
as I want, where **each bubble can be any graph** (single lift / multi-lift / reps×weight /
weight×time). Whatever I make it, it **persists across refreshes**.

**Chosen layout (owner):** within a tab, bubbles are a **horizontal swipe reel** (one graph
at a time, dots show how many) — the current "bubbles" interaction, generalised so each slide
is any configured graph.

## Why the last attempt (haiku CHART-109) was reverted — the lesson
It **deleted the working `renderWaGraph` path** and replaced the real chart engine with
**placeholder stubs** ("…N sets" grey boxes). The `analyticsGraph.ts` engine was never wired
in, so every graph died. Its *data model was fine*; its execution was a big-bang stub swap.

**So this rebuild's rule: keep the proven `analyticsGraph.ts` engine, replace only the layout
shell, build ALONGSIDE the working graph, and cut the old path over only once the new one
demonstrably draws REAL charts.** Never stub the renderer.

## SSOT — the data model (`src/graphDash.ts`)
Tabs → bubbles (the reel) → each bubble is one self-contained graph config. Persisted at
`colosseum.graphDash.v1`, Zod-validated at load (invalid → default). Local-only display pref
(like the other `wa*` view toggles, rule 41) for now.

```
GraphBubble = { id, type: "time"|"rvw", view: "single"|"multi",
                exercises: string[], athletes: string[], perBodyweight, metrics: string[] }
GraphTab    = { id, name, bubbles: GraphBubble[] }
GraphDashboard = { tabs: GraphTab[], activeTabId }
```
The 4 owner-named kinds fall out of (type × view): single = time+single · multigraph =
time+multi · reps×weight = rvw · weight×time = time. Pure immutable transforms
(add/remove/rename tab, add/remove/update bubble, cycle type/view) + load/save.

## The reuse seam
`renderAnalyticsGraph(container, input)` is already PURE (config in → SVG into the passed
container, reads no globals). The job: a `buildBubbleInput(bubble)` that assembles an
`AnalyticsGraphInput` from a bubble config (the same assembly `renderWaGraph` does from
globals), then `renderAnalyticsGraph(bubbleEl, input)` per slide.

## Phases (each shippable; old path stays working until cutover)
- [x] **P0 — plan** (this doc) + harvest haiku ideas.
- [ ] **P1 — data model + persistence + tests** (`graphDash.ts`, dead code, zero behaviour change). ← current
- [ ] **P2 — input-assembly seam**: extract `buildAnalyticsInputFor(cfg)` from `renderWaGraph`; verify the EXISTING graph still renders through it (refactor in place, no behaviour change).
- [ ] **P3 — render one real bubble**: `renderBubble(el, bubble)` → real chart (NOT a stub). New dashboard view behind a toggle; prove charts draw.
- [ ] **P4 — tabs + bubble reel + controls**: tab reel (add/rename/delete), bubble swipe reel + dots, add/remove bubble, per-bubble config (cycle type, cycle view, exercise picker, athlete compare, ×BW) reusing the existing picker drawer.
- [ ] **P5 — cutover**: make the dashboard the default Analysis graph; seed a default dashboard from the current selection; retire old `renderWaGraph` (→ attic if large).
- [ ] **P6 — polish**: loading states (rule 46), snappy/scroll-preserving re-render (rules 17/24), locked/spectator views show only the logged-in athlete + hide customization (rule 21).

## Carry-forward checklist (must survive cutover — what CHART-109 silently dropped)
metric-permission gating · multi-athlete overlay + colour key · kg/×BW toggle · fullscreen ·
reps×weight 2-week pager + draggable Nuzzo fit markers · blocked/no-data review notes ·
i18n (LT) · pan/zoom preservation across re-render (`#waGraphChart` kept, rule 24).
