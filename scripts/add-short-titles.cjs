#!/usr/bin/env node
/**
 * Adds shortTitle and code fields to every leaf release in RELEASES.
 * Run: node scripts/add-short-titles.cjs
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../src/changelog.ts");
const raw = fs.readFileSync(filePath, "utf8");

// Map of cat → sequential counter (we'll assign from oldest → newest, i.e. reverse order)
const catCounters = {};

function nextCode(cat) {
  if (!cat) cat = "META";
  catCounters[cat] = (catCounters[cat] || 0) + 1;
  return `${cat}-${catCounters[cat]}`;
}

// Generate a 2-5 word shortTitle from a longer title string.
function makeShortTitle(title) {
  let t = title;

  // If title is "Prefix: rest" where prefix is 1-4 words, use the prefix as shortTitle
  const colonIdx = t.indexOf(": ");
  if (colonIdx > 0 && colonIdx < 40) {
    const prefix = t.slice(0, colonIdx).trim();
    const prefixWords = prefix.split(/\s+/).length;
    if (prefixWords <= 4 && prefixWords >= 1) {
      // Good short prefix — use it (strip trailing colon-word from later processing)
      t = prefix;
    }
  } else {
    // Remove leading action words that add noise
    t = t.replace(/^(Fix|New|Added|Removed|Moved|Renamed|Dropped|Cleaned|Decluttered|Upgraded|Improved|Enabled|Disabled|Tweaked|Polished|Replaced|Reverted|Restored):\s*/i, "");
    // Remove trailing clause starting with " — " or " – "
    t = t.split(/\s[—–]\s/)[0];
    // Remove text in parentheses at end
    t = t.replace(/\s*\([^)]+\)\s*$/, "").trim();
  }

  // Split into words, take up to 5
  const words = t.split(/\s+/).filter(Boolean);
  const kept = words.slice(0, 5);
  // Strip trailing punctuation from last word
  const last = kept[kept.length - 1];
  if (last && /[,:;.!?]$/.test(last)) kept[kept.length - 1] = last.slice(0, -1);
  return kept.join(" ");
}

// We need to process entries in OLDEST-FIRST order to assign sequential codes.
// The RELEASES array is newest-first in the file.
// Strategy: collect all entries, reverse, assign codes, then rewrite.

// Parse entries using a regex that finds each { version: ... } object in RELEASES.
// We'll do a simple line-by-line approach: find lines that start with `  { version:`
// and track their positions.

const lines = raw.split("\n");

// Find the RELEASES array start
const releasesStart = lines.findIndex(l => l.includes("export const RELEASES: Release[]"));

// Collect entry ranges: each entry starts with `  { version:` and ends with `},`
// We'll identify them by looking for lines matching the pattern.
// Each entry is a single long line (they're all one-liners in this file).
const entryLines = [];
for (let i = releasesStart + 1; i < lines.length; i++) {
  const l = lines[i].trim();
  if (l.startsWith("{ version:") && l.endsWith("},")) {
    entryLines.push({ lineIdx: i, content: lines[i] });
  } else if (l === "];") {
    break; // end of RELEASES
  }
}

console.log(`Found ${entryLines.length} release entries`);

// Parse each entry to extract fields
function parseEntry(content) {
  // Extract version
  const ver = content.match(/version:\s*"([^"]+)"/)?.[1] ?? "";
  // Extract title
  const titleMatch = content.match(/title:\s*"((?:[^"\\]|\\.)*)"/);
  const title = titleMatch ? titleMatch[1].replace(/\\"/g, '"') : "";
  // Extract sp
  const sp = parseFloat(content.match(/sp:\s*([\d.]+)/)?.[1] ?? "0");
  // Extract note
  const noteMatch = content.match(/note:\s*"((?:[^"\\]|\\.)*)"/);
  const note = noteMatch ? noteMatch[1].replace(/\\"/g, '"') : "";
  // Extract cat
  const cat = content.match(/cat:\s*"([^"]+)"/)?.[1] ?? null;
  // Check if already has shortTitle
  const hasShortTitle = content.includes("shortTitle:");
  return { ver, title, sp, note, cat, hasShortTitle };
}

// Process in REVERSE order (oldest first) to assign sequential codes
const updates = []; // { lineIdx, shortTitle, code }
for (let i = entryLines.length - 1; i >= 0; i--) {
  const { lineIdx, content } = entryLines[i];
  const { title, cat, hasShortTitle } = parseEntry(content);
  if (hasShortTitle) continue; // skip if already done
  const code = nextCode(cat);
  const shortTitle = makeShortTitle(title);
  updates.push({ lineIdx, shortTitle, code });
}

console.log(`Assigning shortTitle+code to ${updates.length} entries`);

// Apply updates
const updatedLines = [...lines];
for (const { lineIdx, shortTitle, code } of updates) {
  const original = updatedLines[lineIdx];
  // Insert shortTitle and code after `{ version: "..."`
  // Pattern: `  { version: "xxx",` → `  { version: "xxx", shortTitle: "yyy", code: "zzz",`
  const updated = original.replace(
    /(\{ version:\s*"[^"]*",)/,
    `$1 shortTitle: "${shortTitle.replace(/"/g, '\\"')}", code: "${code}",`
  );
  if (updated === original) {
    console.warn(`  WARNING: no change at line ${lineIdx + 1}: ${original.slice(0, 80)}`);
  }
  updatedLines[lineIdx] = updated;
}

const output = updatedLines.join("\n");
fs.writeFileSync(filePath, output, "utf8");
console.log("Done. Written to", filePath);

// If run with --regen-titles, regenerate shortTitle for existing entries
if (process.argv.includes('--regen-titles')) {
  const raw2 = fs.readFileSync(filePath, "utf8");
  const updated = raw2.replace(/shortTitle:\s*"([^"]*)",/g, (match, oldTitle) => match); // noop placeholder
  // Actually do a proper line-by-line regen
  const lines2 = raw2.split("\n");
  let changed = 0;
  for (let i = 0; i < lines2.length; i++) {
    if (lines2[i].includes('shortTitle:') && lines2[i].includes('title:')) {
      const titleMatch = lines2[i].match(/title:\s*"((?:[^"\\]|\\.)*)"/);
      if (titleMatch) {
        const title = titleMatch[1].replace(/\\"/g, '"');
        const newShort = makeShortTitle(title);
        lines2[i] = lines2[i].replace(/shortTitle:\s*"(?:[^"\\|\\.)*)"/, `shortTitle: "${newShort.replace(/"/g, '\\"')}"`);
        changed++;
      }
    }
  }
  fs.writeFileSync(filePath, lines2.join("\n"), "utf8");
  console.log(`Regenerated ${changed} shortTitles`);
}
