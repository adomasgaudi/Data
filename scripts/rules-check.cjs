#!/usr/bin/env node
/*
 * Stop-hook RULE CHECK — the automated backstop for the HARD RULES that AIs
 * (especially Haiku) keep FORGETTING. Prose rules get skipped; this runs every
 * time the AI stops and surfaces a {"systemMessage": ...} when a rule was
 * broken. Silent when clean. Never blocks (exit 0).
 *
 * EVERY turn (reads the session transcript, so it works regardless of files):
 *   0. REPLY FORMAT — the reply the AI just sent must follow the "Talking to the
 *      owner" rules (CLAUDE.md): NO retired ALL-CAPS line (rule 4); a Summary must
 *      open with a `User: <task recap>` line (rule 44); Summary points are
 *      TITLE-ONLY (no description after the **bold** label — rule 4/43); and a
 *      substantive reply must end with the token block (`…%5h - …%W`, rule 39) and
 *      the model+version line (`… v.<n>`, rule 40). Kept getting dropped by AIs.
 *
 * The rest run only when THIS session touched the relevant files, so they never
 * nag on unrelated turns:
 *   When a RELEASE was touched (src/changelog.ts or index.html):
 *     1. the newest RELEASES entry has a `model:` stamp (rule: STAMP YOUR MODEL);
 *     2. index.html <span class="version"> matches the newest release (lockstep);
 *     3. the newest version is a clean patch bump b.X.Y.Z — no 4th digit (rule 1).
 *   When the UI was touched (src/main.ts or src/styles.css):
 *     4. every class the Coach UI catalogue documents still has a rule in
 *        styles.css — so the "UI page" can't silently drift from the real
 *        components (the recurring class of bug that hit .subtab-btn → .ex-tab).
 *
 * Add the next forgotten rule here rather than only writing prose in CLAUDE.md.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const sh = (cmd) => {
  try { return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString(); }
  catch { return ""; }
};
const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };
const violations = [];

// ── Conflict-marker guard (runs EVERY turn) ────────────────────────────────────
// An unresolved git conflict marker in a source file is a broken push waiting to
// happen — it has happened twice (a bad b.2.8.1 and stray markers in src/main.ts both
// reached opus during a rebase). `<<<<<<<` / `>>>>>>>` are never legitimate in these
// files, so flag them loudly so the marker is fixed before the next push.
for (const f of ["src/main.ts", "src/styles.css", "src/changelog.ts", "index.html", "src/i18n.ts"]) {
  if (/^(<<<<<<<|>>>>>>>)/m.test(read(f))) {
    violations.push(`${f} has an UNRESOLVED git conflict marker (<<<<<<< / >>>>>>>) — do NOT push; resolve it, rebuild, and re-verify first.`);
  }
}

// ── Reply-format check (rules 4/39/40/44 — runs EVERY turn) ────────────────────
// Read the newest session transcript (same source as show-cost.py) and inspect the
// LAST assistant text reply — the one the owner just saw — for the reply-format rules.
function newestTranscript() {
  const dir = path.join(os.homedir(), ".claude", "projects");
  let newest = null, newestM = 0;
  const walk = (d) => {
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".jsonl")) { const m = fs.statSync(p).mtimeMs; if (m > newestM) { newestM = m; newest = p; } }
    }
  };
  walk(dir);
  return newest;
}
function lastAssistantText(file) {
  const lines = read(file).split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    let obj; try { obj = JSON.parse(lines[i]); } catch { continue; }
    const msg = obj.message || obj;
    if ((obj.type === "assistant" || msg.role === "assistant") && Array.isArray(msg.content)) {
      const text = msg.content.filter((p) => p && p.type === "text").map((p) => p.text).join("\n").trim();
      if (text) return text;
    }
  }
  return "";
}
function checkReplyFormat(text) {
  if (!text) return;
  // (a) RETIRED ALL-CAPS line (rule 4 retired it). Flag a standalone line that's ≥4
  // words and ≥85% uppercase letters — the old "PUSHED TO OPUS-4.8" summary line.
  let inFence = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```")) { inFence = !inFence; continue; }
    if (inFence || !line || line.startsWith("#") || line.startsWith("|") || line.includes("`")) continue;
    const letters = line.replace(/[^A-Za-z]/g, "");
    const words = line.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
    if (letters.length >= 15 && words.length >= 4 && (line.match(/[A-Z]/g) || []).length / letters.length >= 0.85) {
      violations.push(`reply has a RETIRED ALL-CAPS line ("${line.slice(0, 36)}…") — rule 4 retired it; end with the title-recap Summary, no ALL-CAPS line.`);
      break;
    }
  }
  // (b) A Summary must OPEN with a `User: <task recap>` line (rule 44).
  const sumIdx = text.search(/(^|\n)\s*(\*\*Summary\*\*|#+ *Summary\b|Summary:)/i);
  if (sumIdx >= 0 && !/(^|\n)\s*(\*\*)?User:/.test(text)) {
    violations.push("the Summary doesn't open with a `User: <task recap>` line (rule 44).");
  }
  // (b2) Summary points are TITLE-ONLY (2–5 words) — the 5–50-word description belongs
  // in the detail body ABOVE, never on the Summary bullet (rule 4/43). Flag a Summary
  // bullet that has real text AFTER its **bold** label.
  if (sumIdx >= 0) {
    for (const raw of text.slice(sumIdx).split("\n")) {
      const m = raw.trim().match(/^[-*]\s+\*\*[^*]+\*\*\s*(.*)$/);
      if (m && /[A-Za-z]{2,}/.test(m[1])) {
        violations.push("a Summary point has a description after its title — Summary points must be TITLE-ONLY (2–5 words); put the 5–50-word description in the detail body above (rule 4/43).");
        break;
      }
    }
  }
  // (c) A substantive reply (≥200 chars) must end with the token block + version line.
  if (text.length >= 200) {
    if (!/%5h/.test(text)) violations.push("reply has NO token block — end every reply with the show-cost.py output (Tokens / Prompt … / …%5h - …%W), rule 39.");
    if (!/v\.\d+/.test(text)) violations.push("reply has NO model+version line (e.g. `Los Lobos v.x -> v.y`), rule 40.");
  }
}
const transcript = newestTranscript();
if (transcript) checkReplyFormat(lastAssistantText(transcript));

// Which files did this session touch? uncommitted + commits ahead of deployed.
const DEPLOYED = "origin/claude/strength-training-dashboard-SdAlT";
const changed = new Set();
for (const line of sh("git status --porcelain").split("\n")) {
  const f = line.slice(3).trim();
  if (f) changed.add(f);
}
for (const f of sh(`git diff --name-only ${DEPLOYED}...HEAD`).split("\n")) {
  if (f.trim()) changed.add(f.trim());
}
const touchedRelease = changed.has("src/changelog.ts") || changed.has("index.html");
const touchedUi = changed.has("src/main.ts") || changed.has("src/styles.css");

// ── Release checks (rules: model stamp, version lockstep, patch-only) ──────────
if (touchedRelease) {
  const changelog = read("src/changelog.ts");
  const indexHtml = read("index.html");

  // Balanced scan for the first {...} entry after `export const RELEASES`.
  const firstEntry = (src) => {
    const from = src.indexOf("export const RELEASES");
    if (from < 0) return "";
    let depth = 0, start = -1;
    for (let i = from; i < src.length; i++) {
      const c = src[i];
      if (c === "{") { if (depth === 0) start = i; depth++; }
      else if (c === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
    }
    return "";
  };
  const entry = firstEntry(changelog);

  if (entry && !/\bmodel\s*:/.test(entry)) {
    violations.push("the newest RELEASES entry has NO `model:` field — stamp it with the model you are running as (Haiku 4.5 on haiku-4.5, Opus 4.8 on opus-4.8, …).");
  }

  const newestVer = (entry.match(/version\s*:\s*["']([^"']+)["']/) || [])[1] || "";
  const spanVer = ((indexHtml.match(/class="version">([^<]+)</) || [])[1] || "").trim();

  if (newestVer && spanVer && newestVer !== spanVer) {
    violations.push(`index.html <span class="version"> is ${spanVer} but the newest release is ${newestVer} — keep the on-screen version in lockstep.`);
  }
  if (newestVer && !/^b\.\d+\.\d+\.\d+$/.test(newestVer)) {
    violations.push(`version ${newestVer} is not a clean patch bump b.X.Y.Z — bump the PATCH digit only, never a 4th digit or minor/major.`);
  }
  // dist must match the on-screen version too — a rebase that resolves dist with
  // `git checkout --theirs` leaves a STALE deployed build (it shipped b.2.8.424 once
  // while source was .425). The owner only sees the live build, so this matters.
  const distVer = ((read("dist/index.html").match(/class="version">([^<]+)</) || [])[1] || "").trim();
  if (distVer && spanVer && distVer !== spanVer) {
    violations.push(`dist/index.html is built at ${distVer} but index.html is ${spanVer} — the DEPLOYED build is STALE; rebuild it (\`npm run build\`) and commit dist (never resolve dist with --theirs).`);
  }
}

// ── UI check (rule 9/UIC-7: the Coach catalogue must not drift from real CSS) ──
// Each catalogue item is `sec("Title", "prompt", "<classfield>", example)`; the
// 3rd arg names the component's class(es). If a class no longer has a rule in
// styles.css, the UI page is documenting a component that doesn't exist.
if (touchedUi) {
  const main = read("src/main.ts");
  const css = read("src/styles.css");
  const m = main.match(/function renderCoachUiCatalogue\([\s\S]*?\n}/);
  const body = m ? m[0] : "";
  if (body && css) {
    const re = /sec\(\s*"[^"]*"\s*,\s*"[^"]*"\s*,\s*"([^"]*)"/g;
    const seen = new Set();
    let mm;
    while ((mm = re.exec(body))) {
      for (const cls of (mm[1].match(/\.[a-z][a-z0-9-]*/g) || [])) {
        if (seen.has(cls)) continue;
        seen.add(cls);
        const esc = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // the class appears as a selector token, not as a prefix of a longer class
        if (!new RegExp(esc + "(?![a-z0-9-])").test(css)) {
          violations.push(`the Coach UI catalogue documents ${cls} but it has NO rule in src/styles.css — the UI page is drifting from the real components. Fix the catalogue entry (point it at the real class) or restore the class.`);
        }
      }
    }
  }
}

if (violations.length) {
  const msg = "RULE CHECK (CLAUDE.md) — fix before deploying:\n- " + violations.join("\n- ");
  process.stdout.write(JSON.stringify({ systemMessage: msg }));
}
