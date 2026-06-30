# Exercise-picker tiers — the standard (one look, three levels of power)

**Why.** The app has **7 places you pick an exercise**, and each grew its own UI — the
worst being the Focus-lifts "Add another" (a bare chip row, "too simple"). Owner ask:
*standardise the picker UIs into consistent tiers — not all identical, because not every
place needs maximum flexibility* — and document them on the UI page (Coach catalogue).

**The principle.** **One visual language, three tiers of capability.** Every tier is built
from the SAME shared primitives, so they look like the same family; tiers differ only in
which *controls* wrap those primitives. NOT one god-function — small shared builders the
pickers compose (the UIC-7 single-origin approach).

## Shared primitives (every tier uses these — the "one look")
- **`.wa-ex-chip`** — the canonical exercise chip (toggle / add). The single chip shape.
- **`.wa-sel-pill`** — a selected exercise as a pill with a ✕ remove.
- **`.wa-chip-search`** — the search input (whole-catalogue filter, LT placeholder).
- Data comes from **`waSelectorExercises()`** (identity-tagged) or `selectableExercises()`.

## The three tiers

### Tier 1 — **Pick one** (dropdown)
Single exercise, no multi-select, no search UI — just "choose one". Always the custom
`.xdd` dropdown (rule 20), never a native `<select>` look.
- **Use when:** one slot, low frequency. **Today:** Leaderboard (#exercise), the Compare
  tab "Add another" (`.xdd.ex-combine-dd`), the add-set inline form (datalist → should
  move to `.xdd` for consistency).

### Tier 2 — **Pick a few** (search + chips)
A `.wa-chip-search` box over a single scrolling row/grid of `.wa-ex-chip`s; multi-select
or add-from-suggestions. No category pills, no grouping, no drawer.
- **Use when:** a handful of picks, moderate frequency. **Today:** the Compare picker
  (`.compare-chip` → should adopt `.wa-ex-chip`), and the **Focus-lifts "Add another"
  (the upgrade target)** — give it the search + fuller chip list it's missing.

### Tier 3 — **Full picker** (drawer)
Everything: `.wa-chip-search` + category/muscle pills (`.wa-cat-pill`) + group headers +
sort + per-group counts + ⓘ info + identity filters, in a sliding `.wa-pick-card` drawer.
- **Use when:** the primary analysis surface. **Today:** the Analysis selector (the
  reference implementation) and the Variant/group create picker (`.wa-create-picker`).

## Mapping (current → tier) and the standardization work
| Picker | Today | Tier | Action |
|---|---|---|---|
| Analysis selector | full drawer | **3** | reference — leave |
| Variant/create picker | search + chips + pills | **3** | already aligned (shares `.wa-ex-chip`/`.wa-sel-pill`) |
| Compare picker | `.compare-chip` + search + quick-picks | **2** | DONE-ish: shape (border/radius/padding) already matches `.wa-ex-chip`; its muted/none unselected colour is KEPT — it's functional (contrasts the colour-coded *chosen* chips), so not forced solid |
| Focus-lifts "Add another" | bare suggestion chips | **2** | DONE: search + fuller list + can now **create a brand-new focus** on no-match |
| Leaderboard | native `<select>`→`.xdd` | **1** | already `.xdd` |
| Compare "Add another" | `.xdd` dropdown | **1** | already `.xdd` |
| Add-set inline | native `<datalist>` | **1** | move to `.xdd` for consistency |

## On the UI page
Add a "Exercise pickers" group to the Coach catalogue with one live example per tier
(T1 dropdown · T2 search+chips · T3 drawer link), so the standard is visible + drift-
checked by the rules-check hook.

## Risk note (rule 19 + the UI-bug research)
These are floating-menu UIs (Tier 3 is the drawer from the z-index research). There's no
jsdom net yet, so each migration is typecheck+tests+build-verified but the *visuals need
an on-device eyeball*. Tier 3's drawer should ride on the overlay-SSOT fix once that lands.
