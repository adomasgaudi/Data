# Why are there more UI bugs now than at the start? (#research)

**The question (owner, 2026-06-15):** "it seems there are a lot more UI bugs than at
the beginning — research why and come up with a solution." Trigger: a body-part pill's
menu rendered *behind* the sliding picker drawer (a z-index / stacking bug).

**TL;DR.** It's not that the code got "worse" — it's that the UI **surface grew ~10×
while its safety net stayed at zero**, and three specific multipliers (no DOM tests, no
single source of truth for stacking, a hot 19k-line monolith edited by many fast
unverified AIs) turn that growth into a rising bug count. The fix is to add the missing
safety nets, not to chase each bug.

---

## Evidence (measured on b.2.8.380, not guessed)

- **Zero UI test coverage.** **0 of 35** test files touch the DOM — all 526 tests are
  pure functions. Every render/menu/stacking regression ships **unverified** (compounded
  by the standing rule that AIs can't see the live site).
- **Stacking has no enforced SSOT.** A `--z-*` token scale exists (`--z-drop:40`,
  `--z-modal:60`, `--z-top:200`) but is **bypassed by ~20 ad-hoc raw z-index values**
  (3, 30, 35, 49, 55, 61, 90, 100, 203…). A new menu guesses a number and stacks wrong.
- **59 floating elements, 7 use the safe helper.** `position:fixed`×25 +
  `position:absolute`×34 ≈ 59 positioned overlays; only **7** call the shared
  `clampMenuIntoView`. The rest hand-position — the exact PB-10/PB-17 root.
- **Stacking-context traps.** Floating parents use `transform` (e.g.
  `.wa-pick-card.is-pick-drawer { transform: translateX(100%) }`). A `transform` creates a
  **new stacking context**, so a child menu's z-index is powerless against elements
  outside that context — this is precisely the "menu behind the drawer" bug.
- **A 18,933-line monolith.** `src/main.ts` is one file. No module owns "menus" or
  "overlays", so each is reinvented.
- **Extreme velocity, many authors.** 1037 logged releases; ~20 versions shipped in a
  single afternoon during this very session, by several concurrent AIs (default model
  Haiku). Fast + unverified + unguarded = accumulation.

## Root causes (ranked by leverage)

1. **No UI safety net (the #1 driver).** Logic is tested and even hook-guarded; UI is
   not. As menus/tabs multiplied, the thing most likely to break got *zero* automated
   coverage. At the start there were few screens, so eyeballing sufficed; now there are
   dozens and no human or test checks them.
2. **Stacking is ad-hoc, not a system.** Partial token scale + 59 hand-rolled overlays +
   transform-induced stacking contexts. Z-index/stacking is famously the hardest CSS to
   get right by guessing, and AIs guess.
3. **Monolith + concurrency + velocity, unverified.** A 19k-line file edited by many
   fast AIs who *cannot see the result* ships visual regressions blind. The known fixes
   (ARCH-0 jsdom tests, ARCH-1 split) are **deferred because the file is too hot** — a
   vicious cycle: too risky to refactor → stays monolithic → more bugs.

## Solution (concrete, re-judged for an AI-maintained single-file app — rule 9)

Ordered by ROI. Each is small and independently shippable.

1. **One overlay layer + one menu builder (kills the bug *class* by construction).**
   All popout menus render into a single top-level overlay container at `--z-top`,
   positioned by `clampMenuIntoView`. A menu **physically cannot** sit behind a sibling
   panel because it is no longer *nested inside* one — escaping the transform/stacking
   trap entirely. Make `openFloatingMenu(anchor, html)` the ONLY way to open a menu
   (ties into the UIC-7 single-origin builder work already underway). *Fixes PB-10,
   PB-17, and the body-part bug at the root.*  🔴 SP:8
2. **Enforce the z-index scale with a Stop-hook check.** Extend `scripts/rules-check.cjs`
   (the rule-38 pattern, already guards model-stamp/lockstep/catalogue-drift) to flag any
   **raw numeric `z-index`** in `styles.css` — it must use a `--z-*` token. Cheap machine
   guard so the sprawl can't regrow. 🟠 SP:1
3. **jsdom UI smoke tests — the missing net (ARCH-0).** A small suite that renders each
   tab + opens each menu in jsdom and asserts invariants (renders without throwing, the
   menu lands in the overlay layer, key elements exist). Catches the "render path broke"
   regressions that currently ship blind. Already a planned backlog item; this is the
   moment to build it. 🔴 SP:8
4. **Then unblock ARCH-1 (split main.ts).** Once the jsdom net exists, splitting the
   monolith into feature modules (incl. a `menus`/`overlay` module that owns #1) becomes
   safe. The net must come first. 🟠 SP:30 (separate effort)
5. **Process, not code:** the velocity × unverified × many-authors multiplier is real.
   The above reduce reliance on human eyes; also worth the owner knowing that "ship a
   visual change every few minutes, unseen, from 4 models" is itself a bug source.

**Recommended first move:** #1 + #2 together (one overlay/menu SSOT + the z-index hook) —
they kill the most common, most-recurring bug class and prevent its regrowth, in ~1 day.
#3 (jsdom net) next as the durable safety net; #4 follows once the net exists.

---

## Research — best practices, graded for THIS app (not human teams)

- **Single overlay/portal layer for popovers** (React Portal, the HTML `<dialog>` /
  popover API, "render menus at the root"). **GRADE: High** — the canonical fix for
  stacking-context traps; applies directly (we have no framework but the same DOM truth:
  render at root, not nested). The new CSS `position-anchor`/popover API is even purpose-
  built, but browser support is uneven → use the JS-clamp approach we already have.
- **A small, ordered z-index token scale + lint against raw values.** **GRADE: High** —
  exactly our gap; we have the tokens, just not the enforcement. The hook is the
  AI-appropriate "lint".
- **jsdom render/smoke tests for a no-build app.** **GRADE: High** — the single biggest
  ROI here; Vitest already runs jsdom-capable. Not full visual regression (overkill, no
  human team), just "does it render + wire up". Matches rule-9 "tests are the AI's eyes".
- **Visual-regression snapshots (Percy/Playwright screenshots).** **GRADE: Low** for now —
  heavy infra for a solo no-build app; the owner is the visual check. Revisit only if
  jsdom tests prove insufficient.
- **Splitting a god-file into modules.** **GRADE: Moderate** — real long-term win
  (ARCH-1) but high-churn on a hot branch; gated behind the jsdom net, so Moderate-now /
  High-later.

Cross-refs: `docs/persistent-bugs.md` (PB-10/PB-17 are this class), `docs/cleanup-backlog.md`
(ARCH-0 jsdom net, ARCH-1 split — both already listed, now justified as bug-prevention).
