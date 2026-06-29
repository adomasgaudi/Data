#!/usr/bin/env node
/*
 * UserPromptSubmit hook — COMMAND injector (CLAUDE.md lean-core refactor, b.2.9.31x).
 * When the owner's prompt contains a `#command` trigger, inject that command's
 * on-demand playbook (docs/commands/<name>.md) so the full procedure arrives
 * exactly when invoked — instead of living always-loaded in CLAUDE.md. Silent when
 * no known trigger is present. Never throws, always exits 0.
 *
 * This is the mechanism that lets CLAUDE.md keep only a one-line trigger INDEX:
 * the environment delivers the heavy procedure on demand (mini-swe-agent style).
 */
const fs = require("fs");
const path = require("path");
const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };

// #trigger (lowercased, without the leading #) -> doc file under docs/commands/.
const MAP = {
  "?": "triage.md",
  careful: "careful.md",
  senior: "senior.md",
  prune: "prune.md",
  "co-work": "co-work.md",
  ui: "ui-place.md",
  debug: "debug.md",
  "super-persistent": "super-persistent.md",
  persistent: "persistent.md",
  repeating: "persistent.md",
  ceo: "ceo.md",
  tokens: "tokens.md",
  research: "research.md",
};

try {
  let stdin = "";
  try { stdin = fs.readFileSync(0, "utf8"); } catch {}
  let prompt = "";
  try { const j = JSON.parse(stdin); prompt = String(j.prompt || j.user_prompt || ""); } catch { prompt = stdin; }
  if (!prompt) process.exit(0);

  const lower = prompt.toLowerCase();
  const hit = new Set();
  // Match #<trigger> as a token. #? is special (not a word char).
  for (const key of Object.keys(MAP)) {
    const tok = "#" + key;
    if (key === "?") { if (lower.includes("#?")) hit.add(key); continue; }
    // word-boundary-ish: # followed by the key, not part of a longer word.
    const re = new RegExp("#" + key.replace(/[-]/g, "\\-") + "(?![a-z0-9-])", "i");
    if (re.test(lower)) hit.add(key);
  }
  if (!hit.size) process.exit(0);

  const parts = [];
  const seen = new Set();
  for (const key of hit) {
    const file = MAP[key];
    if (seen.has(file)) continue;
    seen.add(file);
    const body = read(path.join("docs", "commands", file));
    if (body.trim()) parts.push(`=== #${key} playbook (docs/commands/${file}) ===\n${body.trim()}`);
  }
  if (!parts.length) process.exit(0);

  const additionalContext =
    "ON-DEMAND COMMAND PLAYBOOK (the owner typed a #command — follow this, it is the authoritative procedure; do NOT go read the archived monolith):\n\n" +
    parts.join("\n\n");
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext } }));
} catch {
  // never throw
}
process.exit(0);
