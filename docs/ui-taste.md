# `#ui` — the owner's UI taste profile

> Reference for the one-line `#ui` command in `CLAUDE.md`. Read this when the owner
> types `#ui <control>` (or asks you to rework / place / style any control). Distilled
> from the whole version history (commits, changelog notes, persistent-bugs). It's the
> "how the owner thinks about UI" so a control lands right the FIRST time.

## The one-line instinct
**Maximal density, but finger-friendly, flat, and obviously tappable.** Small footprint
+ generous hit area + clear affordance. When density and tap-size fight, keep the
footprint tight (short pills, no labels) and BUY the height back with vertical padding /
a min tap-height — don't shrink the target.

## What the owner WANTS (each re-asked many times — these are load-bearing)
- **Cram.** ONE horizontally-scrolling row, never a wrapped multi-row block or a big
  labelled menu that eats vertical space. Drop obvious label words ("Settings", "Show
  as", "Include", "View", "Filter by") — context already says it. Match the TIGHTEST
  shipped UI (e.g. the history ⚙ pill grid), not a roomy new one.
- **Toggles only — as pills.** Mutually-exclusive set → ONE pill that CYCLES the values.
  Boolean → an on/off pill. NEVER a checkbox, radio, segmented row ("A | B | C") or a
  row of separate buttons. (Repeatedly ignored by AIs → the owner keeps re-asking.)
- **Flat & sharp.** Small rounding via the `--r-pill` token — NEVER full/`999px`/`50%`
  pills or circles (genuine dots/avatars excepted). No white card-bands, no shadows;
  blend with the page, one clean divider. The athlete chips were deliberately sharpened.
- **Comfortably tappable.** A constant counter-current: "make bigger button", bigger lens
  toggles, bigger view-switcher, bigger compare pills, a min tap-height floor. Tiny
  controls get reported. Dense ≠ tiny.
- **Obvious affordance.** If it's tappable it must LOOK tappable — bare text isn't enough
  (no hover on a phone). The selection-title lift names became soft chips for exactly
  this. Prefer a visible pill/background over relying on hover.
- **Custom `.xdd` dropdowns**, never the native OS `<select>` picker.
- **Snappy.** A tap updates its OWN control instantly; defer the heavy app-wide render to
  the next frame (rAF/debounce). Never block the tap or rebuild everything synchronously.
- **Size & placement ENCODE the hierarchy (the visual grammar).** A control's size, weight
  and where it sits must tell you (a) its reach-level — the primary/most-used control is the
  biggest and gets the most room; rarer ones are visibly smaller and quieter — and (b) which
  FAMILY it belongs to: a control should look like and sit beside its functional siblings
  (a selection-reset belongs with the other selection tools, not glued to the navigation).
  Two UNRELATED controls made the SAME size read as a related pair and flatten the hierarchy
  — a known miss (the b.2.8.107 "Stats + Default twin pills" the owner rejected: same size
  hid that Stats reveals a panel while Default resets the selection, and they're different
  tiers). Give the level-1 control (e.g. the athlete chips) its OWN room to breathe/scroll —
  don't let secondary buttons eat its width. Separate unrelated controls visually; size each
  by its tier; let each echo its family.

## What reliably ANNOYS the owner (recurring pain — avoid proactively)
- **Menus/folds that snap shut when you tap a setting inside them.** THE most-repeated
  bug. Any popout/`<details>`/menu MUST preserve its open state across the re-render its
  own option triggers (read the live DOM's `.open` before rebuilding `innerHTML`). The
  owner loses their place and hates it.
- **A graph that moves, jumps, or goes blank when one control changes.** A whole family of
  bugs (bars overflow, time axis slides, sections collapse, kg⇄×BW empties). The owner is
  very sensitive to chart instability. Lesson logged: trust the screenshot of the ACTUAL
  symptom, trace the data flow (a config MERGE keeps stale keys), fix the root.
- **Redundancy.** One graph not two; killed the Add-set page, the dataset-summary footer,
  redundant folds, duplicate toggles, legacy tabs. Prune, don't accrete.
- **Defaults that don't reflect CURRENT training.** Re-tuned many times; landed on
  "graph = top 5 by frequency, last 3 months; history = all exercises".
- Claiming a visual fix "works" when you can't see it; padded/appeasing lists.

## How the owner thinks (the lenses)
- **Reach ladder (`#joy-of-less`).** Place a control by how often it's used: **1 on-hand**
  (always visible, primary) · **2 pocket** (one tap — toolbar pill) · **3 backpack**
  (behind a fold opened often) · **4 on table** (main Settings) · **5 shelf** (deeper
  Settings) · **6 attic** (advanced corner) · **7 warehouse** (not in the UI / cut).
  More-used = closer to hand. Prefer DEMOTING a rare control down the ladder over
  crowding levels 1–2. (Mirrors the code attic/warehouse tiers and the CEO audience tiers
  — the owner thinks in tiers of access everywhere.)
- **Product-first, gamified arena.** Colosseum is a competitive arena (Espada/Bleach
  codenames). Per `#CEO`: hook the casual with a bragworthy stat, effortless for the
  interested, depth-on-demand for nerds, every view ends in an ACTION.
- **The coach is the real primary user** of the Live page — one client at a time,
  prescription over analysis.
- Fast, iterative, many small deliberate tweaks. The owner ONLY sees the live site, so
  naming, defaults and feel carry the entire experience — get those right.

## Checklist when building/placing a control
1. **Purpose** — the one job it does.
2. **Frequency** — every session / sometimes / rarely / once?
3. **Reach level** — pick 1–7 from the ladder by that frequency; state it + why.
4. **Family & size** — which existing control family is this? Make it look like its
   siblings and SIT WITH THEM (selection-reset → by the selection tools; panel-toggle → by
   the panel). Size it by its tier: smaller/quieter than the primary control, bigger than
   nothing. Don't make two UNRELATED controls the same size (reads as a pair / flattens
   hierarchy). Protect the level-1 control's room — don't let secondary buttons shrink it.
5. **Fit** — match the tightest neighbouring density; `--r-pill`, shared tokens; quiet
   until active; comfortable tap height.
6. **Form** — a pill toggle, not a checkbox/segment/button-row.
7. **Stability** — if it lives in a menu/fold, preserve open state; if it touches the
   graph, don't let the chart move/blank.

## Researched UI fundamentals (`#research ui`, graded — re-judged for this phone-first app)
The owner expects you to DECIDE layout from these, not ask (CLAUDE.md hard rule). Apply,
don't cite, to the owner.
- **Fitts's law — GRADE: High** (foundational HCI, empirically robust). Frequent/important
  targets should be BIGGER and easy to reach; tap targets ≥ ~44px (Apple HIG) / 48dp
  (Material). → The primary control (athlete chips) is largest; even "small" secondary
  pills keep a comfortable tap height (~36–44px), shrink the FONT not the hit area.
- **Visual hierarchy = size/weight means importance — GRADE: High** (typographic scale,
  Gestalt). Biggest/boldest reads as primary. → Encode the reach-level in the SIZE: chips
  big, secondary actions clearly smaller/quieter. Never size a rare action like a primary.
- **Gestalt proximity & similarity — GRADE: High.** Same size+style + close together =
  read as ONE group. → To SEPARATE two unrelated controls, change size/style AND add space
  (or put them in different families/rows). This is exactly why twin "Stats + Default"
  pills failed — similar+adjacent = false pair.
- **Progressive disclosure (Nielsen) — GRADE: High.** Show the few primary actions; tuck
  rare/advanced ones behind a step. → Rare controls (a reset) get demoted; detail panels
  stay collapsed (Stats is off by default).
- **Jakob's law / convention — GRADE: Moderate-High.** Put a control where its kind usually
  lives: a "reset/default" belongs WITH the thing it resets (the selection tools), a
  panel-toggle next to its panel. → Placement should echo the control's family.
- **Hick's law — GRADE: Moderate.** Fewer top-level choices = faster. → Don't crowd the
  always-visible row; give the primary control its own room.
- **Tap-target minimum — GRADE: High** (Apple 44pt / Material 48dp). The taste doc's 30px
  floor is the FLOOR; prefer ~36–44px for anything tapped often.
