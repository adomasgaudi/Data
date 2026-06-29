<!-- Loaded when: editing src/changelog.ts or index.html (releasing) -->

# Releasing — version, changelog & model stamp

This file loads when you touch `src/changelog.ts` or `index.html`. It is the
full ruleset for shipping a release. **Rules 1, 29, 37 and 48 below are ALSO
auto-checked by `scripts/rules-check.cjs` (the Stop hook) — the hook backstops
you, but get them right yourself; don't rely on it.**

## The release trinity (rule 29 — HOOK-CHECKED)

**Every change MUST do all three, or it is not shipped:**
1. **Bump the version** (whole-number patch per rule 1, below).
2. **Update `<span class="version">` in `index.html`** to the new version.
3. **Prepend a release entry to `RELEASES` in `src/changelog.ts`.**

NEVER ship without all three done. The Stop hook verifies on-screen-version
lockstep when a release was touched.

## Rule 1 — patch-only version bump (HOOK-CHECKED)

AIs bump ONLY the patch — the 3rd digit, WHOLE-NUMBER increments
(`b.2.5.x` → `b.2.5.x+1`), for **every** change including tiny ones.
- **NO 4th tweak digit** — never `b.2.5.x.x`.
- **NEVER** the minor or major (`b.2.x`, `b.x`) — the owner does those by hand.

**Version digits (detail for rule 1).** EVERY change → bump the patch (3rd
digit, `b.2.5.x` → next whole number), tiny one-liners included. The owner wants
whole-number increments only — NO 4th tweak digit (`b.2.5.x.x` is retired; old
ones in history stay as-is).

## Rule 5 — commit subject + body

**Commit subject** = `CODE (SP:n) version kebab`
(e.g. `EXR-3 (SP:3) b.2.5.24 tier-list`).

The commit **BODY MUST include:**
- the **model** that did the work, AND
- the update's **`cost-v.2`** figure — the cost from the current *v.2* estimate
  method (may be superseded by a better method later; method logged in
  `docs/cost-model.md`).

Date is git-logged automatically — don't add it.

(Task-code / SP derivation detail lives in `docs/rules/git.md`.)

## Rule 37 — STAMP YOUR MODEL on every release (HOOK-CHECKED)

The new `RELEASES` entry in `src/changelog.ts` MUST set `model` to the model
YOU are running as — the deploy branch's model:
- `Haiku 4.5` on `haiku-4.5`
- `Opus 4.8` on `opus-4.8`
- `Sonnet 4.6` on `sonnet-4.6`
- `Fable 5` on `fable-5.0`

So the version-history chip records who actually made it. NEVER leave a new
version to the breakpoint default (that's only a guess for un-recorded history).
Unsure which model you are → it's the one in your system prompt / the branch
you're committing to. The Stop hook verifies the model stamp.

## Rule 48 — `shortTitle` is a 2–5-word LABEL (HOOK-CHECKED)

A release `shortTitle` is a 2–5-WORD scannable LABEL, never a sentence. The
version-history tree shows it; long ones make the list read as paragraphs
(owner: *"names are starting to become long again"*). Put detail in
`title`/`note`. Enforced by the Stop hook — `scripts/rules-check.cjs` flags the
newest entry over 5 words.

## Rule 18 — version code-names (DISPLAY only)

On screen the minor shows as a Bleach zanpakutō name + `v.<patch>` (no `b.2`);
the internal version string stays `b.MAJOR.MINOR.PATCH`. Tables/logic in
`src/versionName.ts` — major 2 = Espada (reverse rank, minor 9 = Aizen's Kyōka
Suigetsu), major 3 = Gotei-13 captains.

**Version code-names (detail for rule 18).** The numbers are unchanged; only the
DISPLAY is renamed via `src/versionName.ts`: the minor → a Bleach zanpakutō
code-name, shown small + gold, and the AI-bumped patch → grey `v.<patch>` (the
`b.2` prefix is dropped on screen).
- Major 2 = Espada zanpakutō in REVERSE rank (`ESPADA_NAMES`: minor 0 =
  Glotonería … minor 7 = Arrogante … minor 9 = **Aizen's Kyōka Suigetsu**, the
  finale above the Espada).
- Major 3 = Gotei-13 captain zanpakutō, reverse squad order (`CAPTAIN_NAMES`).
- `versionParts()` feeds the title; `displayVersion()` feeds the changelog (and
  handles span ranges). Add a name to the table when the owner adds a minor —
  never invent numbers.

## Shipping a release — `src/changelog.ts`

`CURRENT_VERSION`/`RELEASES` are the source of truth. To release, prepend ONE
`{ version, title, sp, note, cat }` to the flat `RELEASES` array (newest first).
The history tree is built by `buildChangelogTree` (leaves → ~30-SP sub-groups →
~100-SP groups; every SP total, incl. `buildSpTimeline`, summed automatically) —
never hand-nest groups or hand-total SP. `CURRENT_VERSION` reads the newest leaf.

**Keep the on-screen version in lockstep.** Update the `<span class="version">`
in `index.html` and the top changelog entry to the version you commit, then
rebuild so `dist/index.html` carries it.

## Per-part effort — `COMPONENTS` in `src/changelog.ts`

Grades each app part's SP as a holistic Fibonacci grade (NOT a release-log sum),
plus one `WEBSITE_SP`; re-grade a part up one step when it grows and keep
`WEBSITE_SP` in step. Only `WEBSITE_SP` shows under the title; per-part chips
live in Settings → Version history.
