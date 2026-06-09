# `#CEO` — the zoom-out command

> Detailed spec for the one-line `#CEO` command in `CLAUDE.md`. Read this when
> the owner types `#CEO <problem>` (or asks you to "think like a CEO" about
> something). Everything here is process/strategy — not site code.

## What `#CEO` is for

A normal prompt asks you to fix a bug or add a feature. `#CEO` asks the
opposite: **stop, zoom out, and judge the problem against the whole point of the
app before touching anything.** The owner uses it when a request looks like a
one-line fix but probably hides a bigger product question. Solving the literal
bug would be missing the point.

When you get a `#CEO`, you reason about:

- **The point of the app.** Colosseum is a strength-training dashboard — a
  leaderboard / personal-records / estimated-1RM toy that should make lifting
  feel like a competitive arena (the Bleach/Espada naming, the "Colosseum"
  framing). Every CEO answer is measured against "does this serve that?"
- **Marketing & the curiosity hook.** What about this would make a stranger stop
  scrolling? What's the surprising, screenshot-worthy thing?
- **The focus group / target audience**, split into the **four tiers** below.

## The four audience tiers (think about ALL of them, every time)

Every CEO problem is examined from four viewpoints. A good answer says something
for each tier — or explicitly says "nothing for this tier, here's why."

1. **① Curious-but-uninterested** — people who don't want to dig in. You have to
   *hook* them: surface a **shocking / surprising / bragworthy stat** that makes
   them curious enough to click (e.g. "you out-lifted 92% of men your age", "your
   bench grew 14% this month"). Goal: the click. Failure mode: a blank dashboard
   that demands effort before it rewards.
2. **② Interested** — people who are in, but not nerds. For them, make controls
   **easy**: obvious toggles, sane defaults, one-tap actions, nothing to read.
   Goal: effortless control. Failure mode: power buried behind menus.
3. **③ Nerds** — people who want **detailed tinkering**: the scaling factors, the
   per-set technique levels, the merge/compare lenses, the raw numbers. Goal:
   depth on demand (opt-in, never in tier ①/②'s way). Failure mode: dumbing it
   down so far the nerds leave.
4. **④ Actionable** — orient everything toward a **next action**: what should the
   user DO now? Log a set, beat a number, change a setting, share a screenshot.
   Goal: every view ends in a verb. Failure mode: insight with no "so what".

(The owner originally framed 1–3 as the audience tiers and ④ as the
action-orientation lens laid over all of them — both readings work; the point is
to cover all four lenses.)

## Why this is a ~100-prompt question (and how to handle it)

A real CEO question is too big to answer in one reply — it spans research,
design, many small code changes, copy, and verification. Treat it as a
**~100-prompt project**, not a single turn. The hard constraint is **AI
discontinuity**: the AI that plans it will NOT be the AI that finishes it
(context resets, new sessions, other AIs). So the plan must live on disk, not in
chat.

**The flow:**

1. **Capture** — write the CEO question and a numbered, ~100-step plan into its
   own file `docs/ceo/<slug>.md` (one file per CEO question; `<slug>` is a short
   kebab name, e.g. `docs/ceo/first-open-hook.md`). Use the template below.
2. **Consult** — present the plan to the owner and get approval/adjustments
   **before executing.** Do NOT start building on a `#CEO` prompt; the first
   deliverable is the plan, not code. (This mirrors `#careful`: plan first.)
3. **Execute incrementally** — once approved, work the plan a few steps per
   prompt. Any AI in any later session reads `docs/ceo/<slug>.md`, finds the next
   unchecked step, does it, ticks it off, and pushes. The MD is the single source
   of truth for the project's progress — keep it current the way `#prune` keeps
   `cleanup-backlog.md` current.

Steps are coined with task codes at commit time (rule 8) and shipped the normal
way (commit + push every change, rule 3). A CEO project will span many versions.

## Per-question file template (`docs/ceo/<slug>.md`)

```md
# CEO: <one-line restatement of the question>

- **Asked:** <date>  ·  **Status:** PLANNING | APPROVED | IN-PROGRESS | DONE
- **The point it serves:** <how this ties back to Colosseum's purpose>

## The question (verbatim-ish)
<what the owner actually asked, in their words>

## Four-tier read
- ① Curious/uninterested — <the hook for them>
- ② Interested — <what makes control easy>
- ③ Nerds — <the depth on offer>
- ④ Actionable — <the next action it drives>

## The ~100-prompt plan
> Numbered, checkbox steps. Group into ~10 phases of ~10 steps. Each step small
> enough for one prompt. Tick `[x]` as done; leave a note + commit/version.

### Phase 1 — <name>
- [ ] 1. …
- [ ] 2. …
...

## Decisions / open questions for the owner
- <anything blocking that needs an owner call>

## Log
- <date> — <what shipped, version, who/which session>
```

## Index of CEO questions

*(newest first — add a line when you open a new `docs/ceo/<slug>.md`)*

- 2026-06-09 — [`coach-primary-user.md`](./coach-primary-user.md) — make the live page better for the coach as primary user. **Status: PLANNING.**
