#!/usr/bin/env node
/*
 * Stop-hook RULE CHECK — the automated backstop for the HARD RULES that AIs
 * (especially Haiku) keep FORGETTING. Prose rules get skipped; this runs every
 * time the AI stops and surfaces a {"systemMessage": ...} when a release was
 * shipped without following them. Silent when clean. Never blocks (exit 0).
 *
 * Checks, but only when THIS session touched release files (src/changelog.ts or
 * index.html) so it never nags on unrelated turns:
 *   1. the newest RELEASES entry has a `model:` stamp (rule: STAMP YOUR MODEL);
 *   2. index.html <span class="version"> matches the newest release (lockstep);
 *   3. the newest version is a clean patch bump b.X.Y.Z — no 4th digit (rule 1).
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
if (!touchedRelease) process.exit(0);

const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };
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

const violations = [];

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

if (violations.length) {
  const msg = "RULE CHECK (CLAUDE.md) — fix before deploying:\n- " + violations.join("\n- ");
  process.stdout.write(JSON.stringify({ systemMessage: msg }));
}
