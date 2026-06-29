#!/usr/bin/env node
// UserPromptSubmit hook: task re-injection.
// When a task is LOCKED (.claude/active-task.json present + parseable), re-inject
// the locked task text into the AI's context on every user turn so it re-anchors
// and doesn't drift. No task locked -> output NOTHING, exit 0. Never throws.

const fs = require("fs");
const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };

try {
  const raw = read("./.claude/active-task.json");
  if (!raw || !raw.trim()) process.exit(0);

  let state;
  try { state = JSON.parse(raw); } catch { process.exit(0); }
  if (!state || typeof state !== "object") process.exit(0);

  const task = typeof state.task === "string" ? state.task.trim() : "";
  if (!task) process.exit(0);

  const additionalContext =
    "🔒 LOCKED TASK (re-anchor — do NOT drift onto other work): " + task +
    "\nStay strictly on THIS task. When and only when it is fully done + verified, " +
    "emit a ===TASK-DONE=== block (shipped/verified/cost/files) to close it. " +
    "To switch or stop, the owner says #unlock.";

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext
    }
  }));
} catch {
  // never throw, never exit non-zero
}
process.exit(0);
