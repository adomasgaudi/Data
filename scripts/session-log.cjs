#!/usr/bin/env node
// Stop hook: mechanical cross-session session logging.
// When the AI's final reply contains a ===TASK-DONE===...===END=== block,
// append a structured entry to docs/session-log.md (newest-first). Silent
// otherwise. Never throws, always exits 0.

const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const sh = (c) => {
  try {
    return execSync(c, { stdio: ["ignore", "pipe", "ignore"] }).toString();
  } catch {
    return "";
  }
};
const read = (p) => {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
};

function newestTranscript() {
  const dir = path.join(os.homedir(), ".claude", "projects");
  let newest = null,
    newestM = 0;
  const walk = (d) => {
    let ents;
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".jsonl")) {
        const m = fs.statSync(p).mtimeMs;
        if (m > newestM) {
          newestM = m;
          newest = p;
        }
      }
    }
  };
  walk(dir);
  return newest;
}

function lastAssistantText(file) {
  const lines = read(file).split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    let obj;
    try {
      obj = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const msg = obj.message || obj;
    if (
      (obj.type === "assistant" || msg.role === "assistant") &&
      Array.isArray(msg.content)
    ) {
      const text = msg.content
        .filter((p) => p && p.type === "text")
        .map((p) => p.text)
        .join("\n")
        .trim();
      if (text) return text;
    }
  }
  return "";
}

try {
  const file = newestTranscript();
  if (!file) process.exit(0);
  const reply = lastAssistantText(file);
  if (!reply) process.exit(0);

  // 1. Extract the DONE block (tolerant of surrounding markdown / code fences).
  const blockMatch = reply.match(/===TASK-DONE===([\s\S]*?)===END===/);
  if (!blockMatch) process.exit(0);
  const block = blockMatch[1];

  // 2. Parse fields (best-effort; missing -> "").
  const field = (name) => {
    const m = block.match(new RegExp("^\\s*" + name + ":\\s*(.*)$", "im"));
    return m ? m[1].trim() : "";
  };
  const shipped = field("shipped");
  const verified = field("verified");
  const cost = field("cost");
  const files = field("files");

  // 3. Mechanical facts.
  const sha = sh("git rev-parse --short HEAD").trim();
  const branch = sh("git rev-parse --abbrev-ref HEAD").trim();
  const verMatch = read("index.dev.html").match(/class="version">([^<]+)</);
  const version = verMatch ? verMatch[1].trim() : "";
  const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");

  // 4. Dedupe via short hash of sha + shipped.
  const hash = require("crypto")
    .createHash("sha1")
    .update(sha + shipped)
    .digest("hex")
    .slice(0, 12);

  const logPath = path.join("docs", "session-log.md");
  const existing = read(logPath);
  if (existing && existing.includes(hash)) process.exit(0);

  // 5. Build entry (newest-first).
  const HEADER = "# Session log";
  const entryLines = [
    `## ${timestamp} · ${branch} · ${version} · ${sha} <!--${hash}-->`,
    `- shipped: ${shipped}`,
  ];
  if (verified) entryLines.push(`- verified: ${verified}`);
  entryLines.push(`- cost: ${cost}`);
  entryLines.push(`- files: ${files}`);
  const entry = entryLines.join("\n") + "\n";

  let out;
  if (!existing.trim()) {
    out = HEADER + "\n\n" + entry;
  } else if (existing.includes(HEADER)) {
    // Insert right after the header line, before older entries.
    out = existing.replace(HEADER, HEADER + "\n\n" + entry.trimEnd() + "\n");
  } else {
    out = HEADER + "\n\n" + entry + "\n" + existing;
  }

  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
  } catch {}
  fs.writeFileSync(logPath, out, "utf8");

  // 6. Report.
  process.stdout.write(
    JSON.stringify({ systemMessage: "📓 session-log: logged " + version })
  );
} catch {
  // never throw
}
process.exit(0);
