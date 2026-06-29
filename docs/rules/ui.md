<!-- Loaded when: editing src/styles.css or src/main.ts (UI/design) -->
# UI / design / interaction rules — self-contained reference for any UI change

These are the binding UI rules. Apply ALL that touch your change. Many are tagged `#design` (a permanent look/feel choice — also a `#prune`: sweep the whole codebase for violations) or `#cram`/`#toggle`. Never cite a rule by number to the owner — quote its wording.

## `#design` directive (what it means)
A design choice is remembered FOREVER (spacing, rounding, colour, sizing, motion). Apply it everywhere NOW (a `#design` is also a `#prune` — sweep the whole codebase for violators), and prefer a **token in `:root`** (`src/styles.css`) over magic numbers so the choice has one home.

## Controls: toggles, not checkboxes/segmented rows (#toggle)
- Every option is a compact **pressable pill that shows its state**. Mutually-exclusive set → **ONE pill that CYCLES through the values** (e.g. "Short" cycling code→short→full). Booleans → an on/off pill.
- NEVER a checkbox, radio, a labelled segmented row ("Show as: Code | Short | Full"), or a row of separate buttons. (Repeatedly ignored — don't.)
- Exception (rule 47): **graded** or **list-reordering** controls use a popup menu, NOT a cycling toggle (see "Multi-value grades" below). A cycling pill is fine only for a simple 2–3-state boolean.

## Density / cram (#cram, #cramp)
- UI is maximally compact: small pills, tight spacing, no wrapping, no essay/paragraph text on the site. Match the **TIGHTEST existing UI**, not a roomy new one (e.g. the history-list ⚙ pill grid).
- Drop obvious/redundant label words — "Settings", "Show as", "Include", "View", "Filter by" — the context already says it.
- New menus/options must be **as dense as the most compact comparable thing already shipped**.
- **Many pills/chips → ONE horizontally-scrolling row** (swipe sideways, like the athlete strip) — NEVER a wrapped multi-row block or a big labelled menu that eats vertical space.

## Snappy clicks (rule 17 — full recipe)
Never run a heavy app-wide rebuild synchronously on a tap. A tap updates ITS OWN control instantly; defer heavy/app-wide re-renders to the next frame, COALESCED (rAF/debounce). The proven fix for tap lag / scroll-jump:
1. **Instant feedback:** update the tapped control's OWN DOM now — toggle its class / `aria-pressed`, or `.remove()` the pill.
2. **Defer the heavy render** with helpers in `main.ts`: `scheduleRender(after?)` / `deferRender(fn)` (one rAF, coalesced to one render/frame, restores `window.scrollY`) for one-off taps; a `setTimeout` **debounce** (~200ms — `debounceWaRender`) for controls tapped in BURSTS (e.g. the exercise selector) so the thread stays free between taps and the heavy view catches up once you pause.
3. **Memoise expensive PURE derivations** called many times per render — `computedRecords()` is cached per synchronous pass, cleared on next microtask (no staleness; list+graph+calendar share ONE compute instead of ~10). Hunt the same N×-per-render recompute elsewhere (`applyHardSetsFilter`, `exerciseCountsForUser`).
4. **Preserve scroll/open-state across `innerHTML` rebuilds** (they destroy it): window scroll (in `deferRender`) and a scroll container's `scrollTop` (capture before, restore on the rebuilt node, e.g. `.wa-chips-wrap`).
- A **Web Worker does NOT help** — the cost is DOM rendering. Root cure = targeted/incremental rendering (`SNAP-5`); the above is the pragmatic single-thread version. See `docs/cleanup-backlog.md` → `SNAP-*`.

## Loading states (rule 46)
Loading states EVERYWHERE — never a frozen/blank/stale screen (it reads as "buggy", the owner's #1 perceived-quality complaint). Every async op (initial `loadData`, GitHub/Supabase sync, the AI-summarise fetch) AND every heavy DEFERRED re-render (athlete / tab / graph switch) shows an IMMEDIATE shared loading indicator (spinner/skeleton + `aria-busy`) — shown ON the tap, BEFORE the work, cleared when it lands. Extend the lone `gh-sync--busy` ⟳ into ONE app-wide pattern; pairs with the snappy-render recipe.

## Dropdowns: custom `.xdd`, never native `<select>` (rule 20)
- Dropdowns are the custom `.xdd` CSS/HTML dropdown, NEVER the native OS `<select>` picker (native looks different on every device + ignores our styling).
- Every native single-`<select>` is auto-enhanced (`enhanceSelectTree` + a `MutationObserver` in init), so just emit a normal `<select>` and it's converted. Never hand-roll a native picker.
- Exempt only: `<select multiple>`, the hidden mirrors (`#athlete`, `#viewAsSelect`), and anything under `[data-no-xdd]`.

## Corner rounding: small, never pill/full (rule 22, #design)
No `border-radius: 999px` / `99px` / `50%` on buttons, chips, pills or inputs — use the **`--r-pill`** token (small radius) in `src/styles.css`. Genuine circular dots/avatars may stay `50%`.

## Tap target size: no super-small buttons (rule 27b, #design)
Every tappable control (pill, toggle, icon button — incl. on-chart/overlay icon buttons like the graph corner kg/⤢/⛶ `.wa-gov-btn`) is at least **`--tap-min`** in BOTH dimensions (token in `src/styles.css`, currently 30px), with a readable glyph (~1rem). Stay compact HORIZONTALLY (#cram) but never a button so small it's hard to tap. Floor new controls with `min-height: var(--tap-min)` + inline-flex centring, like `.svgc-style-btn`.

## Numeric entry boxes (rules 67 & 66, #design — PB-24/48/49/52)
- **Fill + auto-grow (rule 67):** numeric entry boxes (weight/reps and any number input) FILL SIDE-TO-SIDE and AUTO-GROW. Owner: "why so much padding, numbers should fill the box… box should expand to accommodate triple digits or more". Only 2px horizontal padding (token **`--num-box-pad-x`** in `src/styles.css`), plus `field-sizing: content` + `width: auto` so the box hugs its number and EXPANDS for 3+ digits / decimals instead of clipping. `min-width` keeps it tappable, `max-width` bounds the fallback, the card overflow-scrolls if needed. NEVER a fixed-width number box with fat side padding. Applies to `.addm-set-chip` weight/reps (+ the `-l` unilateral pair); sweep new number inputs to match.
- **Overflow / space-efficiency rubric (rule 66):** SCORE EVERY UI CHANGE against the space-efficiency rubric (`docs/ui-rubric.md`) — the screenshot, not the code — then render→critique→refine, never one-shot. Its hard first line: NOTHING (no row, control, or the CARD itself) may exceed the phone viewport. The width cap belongs on the CONTAINER (`max-width: min(Xrem, 100vw)` + `overflow-x` clip) with `min-width: 0` on EVERY flex/grid child so one unshrinkable item can't force the parent wider (a "scroll the inner row" patch never helps if the card grows to its widest child). This is the root of the add-modal "out of bounds" family (**PB-24/48/49/52**). Fix the overflow CLASS, not the one shown case.

## Floating / popout menus (rules 32 & 24 — PB-10/17)
- **Positioning (rule 32, PB-10/17):** a floating/popout menu (`<details>` or a div with `position:absolute` body) MUST use **`position:fixed` + `clampMenuIntoView()`** — NEVER `position:absolute` with hardcoded `left`/`right` offsets; those always escape bounds when the anchor moves (recurring class of bug).
- **Keep open state across re-render (rule 24):** a floating/popout menu MUST preserve its OPEN state across the re-render its own options trigger — read the previous `.open` from the live DOM before rebuilding `innerHTML` (like `cal-settings` / `wa-sel-cog` / `wa-graph-fold`). Else tapping a setting inside rebuilds the menu CLOSED — the recurring "clicking a setting closes the menu" bug.

## Multi-value grades = popup, not toggle (rule 47)
A tap that cycles a value AND re-orders the list makes the thing you just tapped JUMP (owner: very confusing). For a graded set (e.g. the 5-level pairing grade `super/good/neutral/difficult/no-way`) the flag opens a small floating menu (rule 32) to PICK the grade, and the list does NOT re-sort on change. (Refines #toggle.)

## Picker pill = the tag it sets (rule 60)
A variation PICKER pill and the history TAG it sets are ONE control — SAME label + SAME look. Every level's name comes from the single `AF_LEVEL_LBL` map (`afLevelText`) and every chip from the single `variationChipsFromVec`, so picker and tag can NEVER drift (no private `SUP`/`POS`/`ldr`/`hang` maps). A DEFAULT/baseline level (free / floor / none / 0cm / uninterrupted) is NEVER a tag — it's just the exercise; the picker pre-selects your most-used level over the last ~3 months. One canonical name per variation (a free push-up is "free", not "floor"). Picker explanations go in small-gray MENU text only (`.xdd-opt-hint`); the chosen pill stays a clean uppercase chip.

## Lens / action colours (rule 28, #design)
Lens/action colours are ONE harmonious set from the graph series palette via tokens:
- **`--lens-combine`** = gold (⊕ Combine)
- **`--lens-compare`** = teal (⇄ Compare)
- **`--lens-both`** = amethyst (has both relations)
- **`--remove`** = terracotta (the ✕ / destructive)

Split-complementary, all muted/medium-toned; NEVER ad-hoc green/purple/bright-red. Selection-title lift chips (`.wa-title-lift`) are SUBTLE: plain bg, NO underline/outline (owner removed it), 4px corners, tight padding; the lens state shows via the chip's TEXT colour (gold/teal/amethyst), default text black.

## Grouped-lift lens (rule 23)
Grouped lifts use the per-lift LENS — pick the ORIGINAL lift, then ⊕ Combine / ⇄ Compare it. The picker shows ORIGINAL lifts (built-in registry synthetics like "Squat pattern" / "SQ mix" are hidden — reached via the lens; user-made mixes stay pickable). Each selected lift carries REMEMBERED, per-scope (graph & history INDEPENDENT) toggles — ⊕ Combine (fold into its combinable group's merged lift) and ⇄ Compare (split into its comparable group's members) — shown only for the relations it has; both if it has both. A merged member keeps its OWN per-set scaling (Smith-incline push-ups auto-scale by incline note, unrecognised → flagged), never a flat ratio. Store: `colosseum.exerciseLens.v1`.

## No native tap-highlight (rule 31, #design)
`* { -webkit-tap-highlight-color: transparent }` is set globally in `src/styles.css` — keep it. The browser's grey fill over a tapped element's bounds is the "ugly light-up behind the title" (and everywhere); use our OWN `:hover`/`:active`/`.is-on` feedback, never the native flash. Keyboard focus rings (`:focus-visible`) are separate — leave them.

## UI layout/size/placement is YOURS — don't punt (rule 27a)
UI layout/size/placement is yours to decide — do NOT punt it back with `AskUserQuestion` (the owner finds this "you're bad at UI"). Apply `docs/ui-taste.md` + UI fundamentals (Fitts's law, visual hierarchy = size means importance, Gestalt proximity/similarity, progressive disclosure) and SHIP the best version; the owner corrects from the live site if needed. Ask only about genuine product/data choices, never "where should this button go / how big".

## You can't see the live site (rule 19)
Never claim a UI/visual/scroll fix "works". Verified = build + tests pass (say that). Whether it looks/scrolls/behaves right on the owner's phone is UNVERIFIED — say "I changed X, please check," never "it's fixed." When a fix fails twice, stop guessing and give the owner something testable instead.
