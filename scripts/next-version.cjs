#!/usr/bin/env node
/*
 * next-version — print the next clean PATCH version (and optionally the next task
 * code for a category), derived from the changelog. Use this instead of hand-rolling
 * a shell grep: a bad bash derivation once pushed a broken `b.2.8.1` with conflict
 * markers (it stripped the trailing quote and computed 0+1). This is the one safe way.
 *
 * Reads BOTH the local changelog AND origin/opus-4.8's (so it won't clash with a
 * version another session already pushed) — run `git fetch origin opus-4.8` first.
 *
 *   node scripts/next-version.cjs          → b.2.8.<max+1>
 *   node scripts/next-version.cjs SEL      → b.2.8.<max+1> SEL-<max+1>
 *
 * Rule 1: bump the PATCH only. Rule 8: derive at commit time, highest-in-history+1.
 */
const fs = require("fs");
const { execSync } = require("child_process");

const safe = (cmd) => { try { return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString(); } catch { return ""; } };
const local = (() => { try { return fs.readFileSync("src/changelog.ts", "utf8"); } catch { return ""; } })();
const remote = safe("git show origin/opus-4.8:src/changelog.ts");
const cl = local + "\n" + remote;

// Highest version tuple → bump its patch.
const vers = [...cl.matchAll(/"b\.(\d+)\.(\d+)\.(\d+)"/g)].map((m) => [+m[1], +m[2], +m[3]]);
if (!vers.length) { console.error("next-version: no b.X.Y.Z versions found in changelog"); process.exit(1); }
vers.sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);
const [ma, mi, pa] = vers[0];
let out = `b.${ma}.${mi}.${pa + 1}`;

// Optional: next task code for a category, e.g. "SEL" → SEL-<max+1>.
const cat = process.argv[2];
if (cat) {
  const re = new RegExp(`code:\\s*["']${cat}-(\\d+)["']`, "g");
  const nums = [...cl.matchAll(re)].map((m) => +m[1]);
  out += ` ${cat}-${(nums.length ? Math.max(...nums) : 0) + 1}`;
}
process.stdout.write(out + "\n");
