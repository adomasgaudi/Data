<!-- Loaded when: owner types #co-work -->
Other AIs are editing this repo at the SAME time: don't interfere, never strand finished work.

**`#co-work <task>`** — other AIs are editing this repo at the SAME time; don't interfere, but never strand finished work:

1. **Don't camp on hot files:** `git fetch` + merge the canonical branch OFTEN, keep changes small and focused, prefer files/areas the others aren't in, and RE-derive the version + task code at commit (rule 8) so numbers never clash.
2. **Always close the loop — DEPLOY:** the moment a piece is done and verified (typecheck + tests + build), merge it into the canonical branch and push so it goes LIVE — never leave verified work sitting un-merged on a side branch, because the owner only sees the live site and will forget a stranded branch.
3. **Expect churn:** many small clean merges beat one big risky one; on a conflict, take theirs in their area and yours in yours.

(rule 8 = no number clashes: pick the task code `CAT-n` and version LAST, just before commit, as highest-in-history + 1; after any rebase, RE-derive both — never reuse a number already in the log.)
