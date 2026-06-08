# Persistent bugs (recurring — learn from these)

Bugs that came back after being "fixed". Logged via the **`#persistent`** command
(CLAUDE.md). Each is a standing reminder to fix the ROOT, not the symptom — and a
record so the next AI doesn't repeat the same shallow patch.

For every entry note: the **device + browser** it was seen on (persistent bugs are
often device-specific — a fix that holds on one engine can fail on another), the
symptom, every prior fix that DIDN'T hold, the suspected root cause, and a
recurrence count. Leave a `PB-n` comment at the fix site.

---

## PB-1 — "History lifts" sticky selector covers open floating menus

- **Recurrences:** 2+ (Graph-options menu reported covered; earlier the Exercises
  chip menu had the same, "fixed" by bumping it to z-index 55).
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data).
- **Symptom:** with the Analysis "Graph options" (or Legend / ⚙ / Group) dropdown
  OPEN, the sticky **History-lifts selector** from the section below paints ON TOP
  of the menu — the menu's controls and the selector's pills overlap.
- **Prior fixes that didn't hold (the escalation war):** each new floating menu was
  given an ever-higher z-index to "beat" the sticky selector — `.wa-sel-tools
  .wa-fe-menu` and `.wa-sel-cog-menu` were pushed to **55** to clear the sticky's
  **50**. But every NEW menu added later (e.g. `.wa-graph-menu` at 41) starts below
  50 and regresses. Symptom-patching, not root.
- **Root cause:** the sticky selector's z-index was set ABOVE the menus (50). A
  sticky bar only needs to sit above *scrolling content* (auto/0) and the athlete
  row (30) — NOT above floating dropdowns. Sitting above them guarantees it covers
  any menu whose z-index is lower, and there's always a lower one.
- **Root fix (b.2.7.x, PB-1):** lowered `.wa-selector-sticky` to **z-index 35**
  (above content 0 and athlete-row 30, below every floating menu at 40+). Reset the
  escalated menus from 55 → 40. **Invariant: sticky selector 35 < every floating
  menu (≥40). Never raise the sticky above the menus.**
- **If it recurs:** a new floating menu was added with z-index < 36, OR a new
  stacking-context ancestor traps a menu below the sticky — check the menu's
  positioned ancestors, don't just bump its number.

---

## PB-2 — per-day "hidden N/M" unhides ALL days + scrolls the page

- **Recurrences:** 2+ (owner has reported the "reveal hidden" scope/scroll more than once).
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data),
  Analysis → workout history.
- **Symptom:** tapping a single day's grey **"hidden 1/3"** line (meant to reveal
  just THAT day's filter-hidden lifts) instead unhid **every** day's hidden lifts
  app-wide, and **jumped the page** (scrolled to the top of the history).
- **Prior shallow wiring:** the per-day button carried `data-woshowall="1"` → the
  SAME handler as the global head-row "⚑ hidden" toggle → `setWoShowAll(true)`,
  which flips the global `woShowAllExercises` flag, resets `S.workoutsPage = 0`,
  and full-re-renders `renderWorkoutsPage()`. So a per-DAY control ran a GLOBAL
  action + a page-reset re-render (the scroll jump).
- **Root cause:** wrong scope + wrong mechanism. A per-item reveal must be LOCAL
  (this day only) and must NOT re-render the list (re-render = lost scroll). It was
  reusing a global toggle because both just said "show hidden".
- **Root fix (b.2.7.x, PB-2):** the per-day button now carries `data-woshowday=<date>`;
  its day's hidden lifts are pre-rendered greyed + `hidden` inline, and the button
  is a **pure DOM toggle** (show/hide that one `.wo-hidden-day-lines`) — no global
  flag, no `renderWorkoutsPage()`, no page reset, no scroll. The head-row toggle
  stays the only GLOBAL "show all hidden". **Invariant: a per-item "reveal" toggles
  only its own pre-rendered DOM; never call a list re-render or a global flag from
  a per-row control.**
- **If it recurs:** someone re-wired the per-day button to a global toggle again, or
  added a `renderWorkoutsPage()`/`workoutsPage = 0` into its path. Keep it DOM-only.

---

## PB-3 — athlete picker: M/W toggle and name chips drift in size + misalign

- **Recurrences:** 3+ (each resize of one — "match the chips", "50% bigger" — re-broke
  the other; owner has flagged "misaligned / too big" repeatedly).
- **Device/browser seen on:** Android phone, Brave (adomasgaudi.github.io/Data),
  Analysis top athlete row.
- **Symptom:** the left **M/W toggle** and the scrolling **athlete name chips** end up
  different heights and vertically off from each other (and lately too big).
- **Why it keeps coming back:** TWO separately-styled elements (`.ath-sex-toggle` and
  `.athlete-chip`) with their own font-size/padding. Every time one is resized the
  other isn't, so they drift. PLUS the chips' container had an asymmetric
  `padding-bottom: 6px` (scrollbar space) which, under the row's `align-items:center`,
  pushed the chips ~3px ABOVE the toggle even when heights matched.
- **Root fix (b.2.7.x, PB-3):** (1) both pills now derive font-size + vertical padding
  + line-height from SHARED tokens `--athpill-fs` / `--athpill-py` (same border too),
  so they're guaranteed the same height. (2) the chips container uses SYMMETRIC
  vertical padding (`3px 0`) + `align-items:center` so the chips centre-align with the
  toggle. **Invariant: never give the toggle or a chip its own font-size/padding —
  change `--athpill-*`; keep the chip container's vertical padding symmetric.**
- **If it recurs:** someone hard-coded a font-size/padding on `.ath-sex-toggle` or
  `.athlete-chip` again, or re-introduced an asymmetric `padding-bottom` on
  `.athlete-chips`. Route sizing through the tokens.
