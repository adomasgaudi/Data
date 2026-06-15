#!/usr/bin/env node
/*
 * Stop-hook RULE CHECK — the automated backstop for the HARD RULES that AIs
 * (especially Haiku) keep FORGETTING. Prose rules get skipped; this runs every
 * time the AI stops and surfaces a {"systemMessage": ...} when a rule was
 * broken. Silent when clean. Never blocks (exit 0).
 *
 * Runs each check only when THIS session touched the relevant files, so it
 * never nags on unrelated turns:
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

const sh = (cmd) => {
  try { return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString(); }
  catch { return ""; }
};

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
if (!touchedRelease && !touchedUi) process.exit(0);

const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };
const violations = [];

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
