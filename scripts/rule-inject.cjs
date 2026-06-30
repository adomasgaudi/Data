#!/usr/bin/env node
/*
 * PreToolUse hook — RULE injector (CLAUDE.md lean-core refactor, b.2.9.31x).
 * Just before the AI edits a keyed file (or runs a git commit/push), inject that
 * area's on-demand ruleset (docs/rules/<topic>.md) — so the design/release/data/git
 * rules arrive at the MOMENT OF ACTION instead of living always-loaded in CLAUDE.md
 * (mini-swe-agent: the environment delivers the rule when it's needed, unforgettable).
 *
 * Deduped per session (each topic injected at most once) so a 10-edit UI session
 * doesn't re-inject ui.md ten times. Silent when the tool doesn't touch a keyed
 * area. Never throws, always exits 0.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };

// file-path substring -> rule doc (first match wins).
const FILE_RULES = [
  [/styles\.css|(^|[\\/])main\.ts/i, "ui.md"],
  [/changelog\.ts|index\.html/i, "release.md"],
  [/i18n\.ts|domain\.ts|metrics\.ts|aggregate\.ts|profile\.ts|supabase\.ts|dataSource\.ts|variationConfig\.ts|variationModel\.ts|handstandLean\.ts|\/data\//i, "data.md"],
];

try {
  let stdin = "";
  try { stdin = fs.readFileSync(0, "utf8"); } catch {}
  let input; try { input = JSON.parse(stdin); } catch { process.exit(0); }
  const tool = input.tool_name || "";
  const ti = input.tool_input || {};
  const sid = String(input.session_id || "nosess");

  let topic = "";
  if (tool === "Edit" || tool === "Write" || tool === "NotebookEdit") {
    const fp = String(ti.file_path || ti.notebook_path || "");
    for (const [re, doc] of FILE_RULES) { if (re.test(fp)) { topic = doc; break; } }
  } else if (tool === "Bash") {
    const cmd = String(ti.command || "");
    if (/\bgit\s+(commit|push)\b/.test(cmd)) topic = "git.md";
  }
  if (!topic) process.exit(0);

  // Per-session dedupe.
  const stateFile = path.join(os.tmpdir(), `claude-rule-inject-${sid}.json`);
  let done = [];
  try { done = JSON.parse(read(stateFile)) || []; } catch {}
  if (Array.isArray(done) && done.includes(topic)) process.exit(0);

  const body = read(path.join("docs", "rules", topic));
  if (!body.trim()) process.exit(0);

  try { fs.writeFileSync(stateFile, JSON.stringify([...(Array.isArray(done) ? done : []), topic])); } catch {}

  const additionalContext =
    `ON-DEMAND RULESET for what you're about to touch (docs/rules/${topic}) — these are the authoritative rules for this area; follow them. Do NOT go read the archived monolith.\n\n` +
    body.trim();
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext } }));
} catch {
  // never throw
}
process.exit(0);
