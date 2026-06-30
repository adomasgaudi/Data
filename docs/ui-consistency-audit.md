# UI consistency audit (single-origin sweep)

Branch `claude/ui-consistency-audit-*`. Goal: find where the live site uses a
**different UI than the declared reference** (the admin **Coach → UI components**
catalogue, `renderCoachUiCatalogue` in `src/main.ts`) for no good reason, match it,
and move matching components toward a **single origin**.

**Method.** Extracted the real CSS of ~80 component classes (`.‑btn`/`.‑pill`/
`.‑chip`/`.‑toggle`/`.‑fold`/`.‑tab` families) from `src/styles.css` and clustered
by visual properties (padding, radius, border, bg, colour, font-size, states).

**Headline finding (be honest).** The codebase is **not badly inconsistent**. The
~80 classes collapse to ~6 base shapes, but most share their look through design
tokens (`--r-pill`, `--fs-xs`, `--line`, `--accent`) and differ only in genuinely
different *behaviour/state*. So the look already has a de-facto single origin: the
CSS class + the tokens. What's missing is a single origin for **markup** — every
component is an inline template string typed once per call site and AGAIN in the
catalogue, so they can drift. Closing that fully = the deferred builder refactor
(UIC-7), a CEO-scale change the owner chose not to start this session.

Severity: 🔴 burning · 🟠 worth-it · 🟢 nice-to-have. Disposition: ✅ fixed now ·
🔧 needs builder refactor (deferred) · ✋ intentional, leave.

---

## Findings

### UIC-1 🟠 ✅ Segmented toggle duplicated — `.cal-mode-btn` ≡ `.seg-btn`
The same segmented control (container + adjacent-border buttons + `:hover` +
`.is-active`) exists twice: `.seg-toggle`/`.seg-btn` (Workouts "By day / By week")
and `.cal-mode`/`.cal-mode-btn` (year calendar "single / all"). Identical pattern,
differ only by `padding 6px 12px`/`--fs-md` vs `5px 14px`/`--fs-sm` — **no reason
to differ**. **Fixed:** `.cal-mode`/`.cal-mode-btn` now share the `.seg-toggle`/
`.seg-btn` rules (single origin = the segmented-toggle component). Visible: the
calendar toggle adopts the standard segmented size — *needs an eyeball on device.*

### UIC-2 🟢 ✅ Column stat-chips — `.target-chip` ≡ `.wk-chip`, `.stat-chip` cousin
`.target-chip` and `.wk-chip` are byte-identical except `.wk-chip` adds
`min-width:70px` — both are `column / panel-bg / --r-pill` label-over-value chips.
`.stat-chip` is the same shape but `accent-soft` bg + `gap:1px` (deliberate
emphasis, left distinct). **Fixed (UIC-2 ✅):** `.target-chip, .wk-chip` now share
one base rule; only the per-context `min-width` (84/70px) differs. Zero visual
change — pure CSS dedup.

### UIC-3 🟢 ✋ Dead `.tab` styling duplicates `.ex-tab`
`.tab` is byte-identical to `.ex-tab`, but `.tabs { display:none }` — the old top
tab bar is **retired**; the buttons survive only as the `is-active` source of truth.
So this "duplicate" never renders. Leave (harmless); could delete the `.tab`
*visual* rules in a future cleanup. **Not a real consistency bug** (blast-radius
check — the kind of false positive a naive class-count audit would "fix" wrongly).

### UIC-4 🟢 ✋ `.wa-metric` vs `.gp-chip` — same shape, different behaviour
Both are `3px 9px / --fs-xs / --r-pill` chips. But `.wa-metric` is a 2-state on/off
toggle; `.gp-chip` is a 4-level cycling approval chip (`gp-l1/l2/l3` colour states)
with `inline-flex` for its badge. Same base look by design; **intentionally
different**. Would only collapse via a shared base in the builder refactor (UIC-7).

### UIC-5 🟢 🔧 Accent toggles — `.vs-toggle` vs `.bc-unit-toggle`
Both: accent border + `accent-soft` bg + accent text pill toggle. Differ only
`2px 11px`/`0.99rem` vs `3px 10px`/`--fs-sm`. Same component, no real reason to
differ. Low value + visible (can't verify on device) → documented, not auto-applied.

### UIC-6 🟢 ✋ `.hm-pill` vs `.wa-sel-pill` — NOT duplicates
Same pill geometry but `.hm-pill` is neutral (`--bg`/`--text`) and `.wa-sel-pill` is
the *selected* state (`accent-soft`/`accent`). These are two states of "pill", both
already token-driven. Leave.

### UIC-7 🔧 Root cause — no single origin for markup (the real "single origin" ask)
~80 component classes, each emitted as an inline template string at its call site
AND re-typed in the Coach catalogue. The catalogue is a hand-maintained *mirror*, so
it can drift from reality. True single origin = extract builder fns (`btn()`,
`pill()`, `fold()`, `segToggle()`…) that the catalogue + every call site share.
**CEO-scale, multi-session, risky on the 18k-line `main.ts`.** Doing it per-family.

**Slice 1 ✅ (segmented toggle):** added `segBtn()` + `segToggle()` builders in
`main.ts`; rewired BOTH real call sites (the add-form date toggle `afWhenToggle`,
the machine-type toggle `machineModeControl`) AND the Coach catalogue example to
render through them — so the toggle markup now has one origin and the catalogue
can't drift from the real component. Zero markup change (verified: 519 tests +
typecheck). **Slice 2 ✅ (coach fold):** added `coachSection()` builder; the
persistent-bugs + app-info Coach-page docs (16 hand-typed `<details class="coach-section">`
blocks) now build through it — 16 copy-pasted folds → one origin. Zero output change.

typecheck). **Slice 3 ✅ (pager):** added `pagerNav()`; both pagers (`pagerHtml`,
`workoutsPagerHtml`) had identical inline `.page-btn` prev/next markup — now one
origin. Bonus: the Coach catalogue example had DRIFTED (showed numbered `‹/2/›`
buttons, but the real pager is `‹ Prev / range / Next ›`) — the catalogue now
renders the real `pagerNav`, so it can't lie about the component anymore.

**Slice 4 ✅ (catalogue drift audit — nav):** checked every catalogued class exists
in CSS. Found the catalogue's nav entries were stale: "Nav tab → `.tab`" points at
the RETIRED top tab bar (`.tabs { display:none }`), and "Bottom nav button →
`.subtab-btn`" references a class that **doesn't exist** — the bottom tab bar was
replaced by the `.ex-tab` tabs (Workouts / List & stats / Compare / Single), which
weren't catalogued at all. Replaced both stale entries with one accurate `.ex-tab`
entry. **Dead-CSS follow-up:** `.subtabs` / `.subtab` / `.subtab-ico` (+ states) in
`styles.css` are now confirmed unused — safe to delete in a cleanup pass (logged in
`cleanup-backlog.md`).

**`#senior` note — remaining slices are lower-value (owner chose to continue):** the
duplication scan shows the clearly copy-pasted components (segmented toggle, coach
fold, pager) are now done. `.wa-cat-pill`/`.athlete-chip` have ONE real builder + a
static catalogue example (no duplication to remove); other components already have
single builder functions, and forcing those data-coupled builders to also drive the
catalogue is impractical (they need live data). Further slices = catalogue-accuracy
fixes (like the pager drift) rather than dedup.

### UIC-8 🟢 ✅ Literal radius — `.wa-cat-pill { border-radius: 12px }`
Used a magic `12px` instead of the `--r-pill` token (the `#design` rule). **Fixed:**
now `var(--r-pill)` (8px), so category pills match every other pill. Visible —
corners slightly less round (12→8px); *needs a device eyeball.*

### UIC-9 🟢 🔧 Catalogue is incomplete (only ~40 of ~80 classes)
"Compare against the UI page" only works if the UI page is complete. Uncatalogued
near-twins (`.gp-chip`, `.target-chip`/`.wk-chip`, `.cal-mode-btn`, `.vs-toggle`,
`.hm-pill`…) aren't shown, so the reference can't catch them. Expand the catalogue
(or, better, generate it from the builders once UIC-7 lands).

---

## Recommendation
1. ✅ Shipped: UIC-1 (segmented toggle), UIC-2 (column stat-chip base), UIC-8
   (cat-pill radius token).
2. Greenlight UIC-7 **per-family** for true markup single-origin (the big one).
3. UIC-5 is low-value; do it only inside the builder pass.
4. UIC-9: expand the catalogue (or generate it from builders once UIC-7 lands).

Cross-ref: `docs/cleanup-backlog.md` → `UIC-*`.
