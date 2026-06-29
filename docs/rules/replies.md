<!-- Loaded when: composing a reply to the owner -->

# Reply format & cost reporting

## What the Stop hook (`scripts/rules-check.cjs`) already enforces

The Stop checker mechanically verifies parts of these rules, so you don't have to remember them all — but write to pass it: the Summary `User:` recap line, title-only Summary bullets (Summary titles must repeat the body titles WITHOUT descriptions), the `%5h` cost block, the `v.N` model+version line, NO ALL-CAPS line, and an overclaim regex that flags assertive "it's fixed"/"now snappy"/"lag is gone" phrasings. It also checks the model stamp, on-screen-version lockstep, patch-only version shape, and the newest `shortTitle` ≤5 words.

## Rule 4 — Reply shape: DETAILS FIRST, Summary at the very bottom

Lead with the full detailed body (the rule-43 bold-label points WITH their descriptions). The **Summary** comes AFTER all the detail, near the end (a recap/TL;DR, reads last). The Summary:
1. OPENS with a one-line `User: <summarised prompt/task>` recap (rule 44).
2. THEN repeats the SAME 2–5-word titles as the body's points (rule 43) WITHOUT their descriptions — a title-only recap, NEVER a new or reworded set of labels.
3. THEN any open-loops + a missing-functionality suggestion count (rule 45).

NO ALL-CAPS line (retired). Then the bottom lines: the token-usage line (rule 39) and the model+version-shift line (rule 40); links last.

## Rule 44 — Summary leads with a one-line task recap

The Summary block STARTS with `User: <summarised prompt/task>` — a compact paraphrase (not verbatim) of what the owner asked this turn — so the owner sees at a glance which request the reply answers; the point-title recap (rule 4) follows it.

## Rule 45 — Summary ends with open-loops + missing-only suggestions

After the point-title recap, list any UNFINISHED / deferred tasks as 2–5-word titles (`Unfinished: …`), then — ONLY when a genuine GAP exists (MISSING functionality, NEVER extra/gold-plated features, rule 11) — a `Suggestions: <n>` count whose items are detailed ABOVE in the body (severity-tagged, rule 11). Nothing unfinished and no real gaps → omit both; never invent suggestions to fill the line (padding is the rule-11 tell). Also: show any pending/unfinished tasks as real markdown checkboxes.

## Rule 43 — Up to 3 NESTED levels per bullet (for everything the OWNER reads)

Applies to chat (esp. Summary) AND owner-facing text files (CLAUDE.md, handoffs, READMEs, `docs/*.md`, changelog notes, PR/commit bodies). Each point =
- **bold 2–5-word label that is INFORMATIVE** — the actual takeaway/conclusion, self-sufficient so the owner can SKIP the description if the label says enough; NEVER a vague teaser or category (banned: "Done this session", "Real gap", "One false alarm", "More consistent than it looks" — they convey nothing; instead "Site already token-consistent", "`.tab` is dead code")
- then *5–15-word description inline*
- then (ONLY if needed) a 15–50-word detail nested below.

Use only as many levels as the point needs (15 words → just label + inline desc). **Real markdown checkboxes (`- [ ]` to-do / `- [x]` done) ONLY for actual tasks** — never decorative ✅/icons; non-task points are plain bullets. (Pure AI-only artifacts — code, tests, machine config — stay AI-optimised per rule 9; this is for anything a human reads.)

## Rule 26 — NEVER cite a rule by NUMBER to the owner

No "per rule 19", "rule 8 says…" — the owner didn't write the numbers and doesn't track them. QUOTE the rule's wording instead (e.g. "I can't see the live site, so I've verified the build/tests but please check the visuals"). Numbers are for AI scanning only.

## Sig-figs display

Never show >3 sig figs in product numbers: show 2, but 3 if the leading digit is 1/2/3.

## Rule 34 — Cost hook format (full method: `docs/cost-model.md` — read it before quoting any cost)

After every turn print the cost. **Lead with the REAL cost (the rate limits you actually pay for), NOT API list price** — API list € is a retail CEILING ~100× the real flat-plan cost, shown only as a labelled ceiling. Real cost uses OUTPUT tokens (cache-reads inflate raw counts ~100× but barely touch limits) against a measured anchor (~52k Opus output ≈ 1% of a 5h window ≈ ~0.03% of weekly → a turn ≈ €0.01). `scripts/show-cost.py` auto-picks a PER-MODEL anchor (`OUTPUT_TOKENS_PER_5H_WINDOW_BY_MODEL`) so it just works on any model branch; Opus is measured, others are estimates — re-measure your model's row once (method in the doc).

## Rule 39 — END EVERY REPLY with the token block (HALLUCINATION-FREE, NEVER LLM-GUESSED)

RUN `scripts/show-cost.py` (Bash) and quote its REAL printed block VERBATIM — never estimate, round-guess, or do arithmetic yourself ("~3k tok" with no run = banned hallucination). Python does ALL the math (% to 2 sig figs, the 5h & weekly limits). SINGLE-PROMPT only — NO session line. CLEAN format, each metric on its OWN line: `Tokens` / `Prompt  - <out> · €<cost>` / `<%5h>%5h - <%W>%W` — no API-ceiling clutter, no session. Every figure traces to a value the script parsed (output tokens from transcript `usage`) or computed. Can't run it → say so, don't invent.

## Rule 40 — END EVERY REPLY with the model + version line (shows the shift)

The script prints `<Model>` on its own line, then the version line; codename read from `index.html` via the `versionName.ts` tables, NEVER guessed. Bump happened this turn → `<Codename> v.<start> -> v.<current>` (start = version at the END of your LAST reply, so the owner sees x→y; `scripts/show-cost.py` computes it from a per-session sidecar keyed by prompt number). NO bump this turn → just `<Codename> -> v.<current>`. NO "(bumped)"/"(no bump)" text, NO separate "Branch:/Version:" line. Sits above the token block, after the Summary.

## Rule 50 — Session scientist code-name (END EVERY REPLY with it)

PICK A SESSION CODE-NAME = the next FAMOUS SCIENTIST (math / physics / chemistry) in CHRONOLOGICAL order (multiple AIs share this branch). At the START of each chat take the NEXT scientist (by surname) AFTER the most-recent `ai:` chip already in `src/changelog.ts` — ordered by era/birth-year:

Thales · Pythagoras · Euclid · Archimedes · al-Khwarizmi · Fibonacci · Copernicus · Galileo · Kepler · Descartes · Fermat · Pascal · Newton · Leibniz · Bernoulli · Euler · Lagrange · Lavoisier · Laplace · Dalton · Gauss · Avogadro · Faraday · Maxwell · Mendeleev · Boltzmann · Curie · Planck · Rutherford · Einstein · Bohr · Schrödinger · Heisenberg · Dirac · Fermi · Pauling · Turing · Feynman · Hawking … (continue chronologically past the list).

The latest chip is still an OLD animal name (Kestrel/Marlin/Vega) → the scheme RESTARTS at the top, so the first scientist chat is **Thales**. Then:
(a) set `ai: "<surname>"` on EVERY `RELEASES` entry you add in `src/changelog.ts` (shown as a chip in the version history beside the model, so the owner can tell which AI made each version); and
(b) END EVERY REPLY with your scientist name on its own line (the owner can only see WHICH AI you are from that line — `model` alone can't, since many AIs run the same model here).
