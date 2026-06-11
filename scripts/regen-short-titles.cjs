#!/usr/bin/env node
/**
 * Regenerates shortTitle for all existing entries in changelog.ts
 * using the improved makeShortTitle logic.
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../src/changelog.ts");

function makeShortTitle(title) {
  let t = title;
  // If title is "Prefix: rest" where prefix is 1-4 words, use the prefix
  const colonIdx = t.indexOf(": ");
  if (colonIdx > 0 && colonIdx < 40) {
    const prefix = t.slice(0, colonIdx).trim();
    const prefixWords = prefix.split(/\s+/).length;
    if (prefixWords <= 4 && prefixWords >= 1) {
      t = prefix;
    }
  } else {
    t = t.replace(/^(Fix|New|Added|Removed|Moved|Renamed|Dropped|Cleaned|Decluttered|Upgraded|Improved|Enabled|Disabled|Tweaked|Polished|Replaced|Reverted|Restored):\s*/i, "");
    t = t.split(/\s[—–]\s/)[0];
    t = t.replace(/\s*\([^)]+\)\s*$/, "").trim();
  }
  const words = t.split(/\s+/).filter(Boolean);
  const kept = words.slice(0, 5);
  const last = kept[kept.length - 1];
  if (last && /[,:;.!?]$/.test(last)) kept[kept.length - 1] = last.slice(0, -1);
  return kept.join(" ");
}

const raw = fs.readFileSync(filePath, "utf8");
const lines = raw.split("\n");
let changed = 0;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('shortTitle:') && lines[i].includes('title:')) {
    const titleMatch = lines[i].match(/(?:^|,\s*)title:\s*"((?:[^"\\]|\\.)*)"/);
    if (titleMatch) {
      const title = titleMatch[1].replace(/\\"/g, '"');
      const newShort = makeShortTitle(title);
      const escaped = newShort.replace(/"/g, '\\"');
      lines[i] = lines[i].replace(/shortTitle:\s*"(?:[^"\\]|\\.)*"/, `shortTitle: "${escaped}"`);
      changed++;
    }
  }
}

fs.writeFileSync(filePath, lines.join("\n"), "utf8");
console.log(`Updated ${changed} shortTitles`);
