#!/usr/bin/env node
/**
 * Adds / replaces shortTitle and code fields on every entry in RELEASES.
 * - shortTitle: 2-5 key words from the title
 * - code: PREFIX-N, where prefix is mapped from cat, and N is sequential within
 *   the prefix (oldest entry = 1, newest = highest)
 *
 * Run: node scripts/add-fields.cjs
 */

'use strict';
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/changelog.ts');
const raw = fs.readFileSync(filePath, 'utf8');

// ---------------------------------------------------------------------------
// Cat → code prefix mapping
// ---------------------------------------------------------------------------
const CAT_PREFIX = {
  META: 'META', DATA: 'DATA', CHART: 'CHART', CALC: 'CALC', LIFT: 'LIFT',
  ATH: 'ATH', WO: 'WO', NAV: 'NAV', ANL: 'ANL', SEL: 'SEL', SET: 'SET',
  STATS: 'STATS', PERF: 'PERF', SEC: 'SEC', UNI: 'UNI', LOGIN: 'LOGIN', EXR: 'EXR',
  // remapped
  IDX: 'EXR', DSGN: 'ANL', DESIGN: 'ANL', CLN: 'META', CUT: 'META',
  ARCH: 'META', REF: 'META', CAL: 'WO', GPERM: 'EXR', TAX: 'EXR',
  NOTE: 'WO', AUTH: 'META', ADD: 'WO', BAK: 'META', 'LIFT-DM': 'LIFT',
  WAV: 'META', MIG: 'META', ROLE: 'NAV', STAT: 'ATH', MACH: 'WO',
  GRAPH: 'ANL', WR: 'EXR', VAR: 'LIFT', CSS: 'META', UI: 'META',
  UX: 'META', MERGE: 'META', RIR: 'CALC', NAME: 'EXR', CAT: 'EXR',
  SORE: 'CALC', LIVE: 'NAV', SANL: 'ANL', IDN: 'META', CODE: 'META',
  DOC: 'META', CACHE: 'META', EDIT: 'WO', I18N: 'META', PROF: 'ATH',
  TEST: 'META',
};

function catToPrefix(cat) {
  if (!cat) return 'META';
  const upper = cat.toUpperCase();
  return CAT_PREFIX[upper] || CAT_PREFIX[cat] || 'META';
}

// ---------------------------------------------------------------------------
// Short-title generation
// ---------------------------------------------------------------------------

// Stop-words to skip when choosing key words (common filler)
const STOP = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
  'it', 'its', 'this', 'that', 'as', 'by', 'from', 'into', 'via',
  'so', 'not', 'no', 'now', 'then', 'just', 'only', 'also', 'can',
  'will', 'would', 'should', 'may', 'might', 'has', 'have', 'had',
  'does', 'did', 'do', 'up', 'out', 'if', 'when', 'than', 'more',
  'all', 'any', 'each', 'both', 'after', 'before', 'over', 'under',
  'about', 'long', 'back', 'still', 'way', 'even', 'new', 'old',
  'same', 'other', 'how', 'what', 'while', 'where', 'your', 'you',
]);

function makeShortTitle(title) {
  let t = title;

  // 1. If title has a colon-prefix of 1-5 words, prefer that as the label
  //    e.g. "Dark mode: Added night theme support" → "Dark mode"
  //    e.g. "Fix: the whole app was dead" → don't use "Fix" alone
  const colonIdx = t.indexOf(': ');
  if (colonIdx > 0 && colonIdx < 50) {
    const prefix = t.slice(0, colonIdx).trim();
    const words = prefix.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 5) {
      // Clean prefix of special chars
      return words.slice(0, 5).join(' ').replace(/["""'']/g, '').trim();
    }
    // Single-word prefix like "Fix" — drop it, use rest
    if (words.length === 1) {
      t = t.slice(colonIdx + 2).trim();
    }
  }

  // 2. Split on em-dash / en-dash; take the first part
  t = t.split(/\s[—–]\s/)[0].trim();

  // 3. Strip leading action verb if it's one word followed by a colon or comma
  t = t.replace(/^(Fix|Add|Added|Remove|Removed|Move|Moved|Rename|Renamed|Drop|Dropped|Clean|Upgrade|Improve|Enable|Disable|Tweak|Polish|Replace|Revert|Restore|Update|Updated|Show|Hide)[:,]?\s+/i, '');

  // 4. Remove emoji, special chars (keep letters, numbers, spaces, basic punctuation)
  t = t.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').replace(/["""''→←↑↓⤢⛶☰]/g, '').trim();

  // 5. Split into words and take meaningful ones (not stop-words), up to 5
  const words = t.split(/\s+/).filter(Boolean);
  const kept = [];
  for (const w of words) {
    const clean = w.replace(/[^a-zA-Z0-9'/-]/g, '');
    if (!clean) continue;
    if (kept.length === 0 || !STOP.has(clean.toLowerCase())) {
      kept.push(clean);
    }
    if (kept.length >= 5) break;
  }

  // If filtering left us with < 2 words, fall back to first 4 raw words
  if (kept.length < 2) {
    const raw4 = words.slice(0, 4).map(w => w.replace(/["""'']/g, '')).join(' ');
    return raw4 || title.slice(0, 30);
  }

  // Strip trailing punctuation from last word
  const last = kept[kept.length - 1];
  if (last && /[,:;.!?]$/.test(last)) kept[kept.length - 1] = last.slice(0, -1);

  return kept.join(' ');
}

// ---------------------------------------------------------------------------
// Parse the RELEASES array (all entries are single-line)
// ---------------------------------------------------------------------------
const lines = raw.split('\n');
const releasesStart = lines.findIndex(l => l.includes('export const RELEASES: Release[]'));
if (releasesStart === -1) {
  console.error('Could not find RELEASES array');
  process.exit(1);
}

// Collect entry lines
const entryLines = []; // { lineIdx, content }
for (let i = releasesStart + 1; i < lines.length; i++) {
  const l = lines[i].trim();
  if (l.startsWith('{ version:') && l.endsWith('},')) {
    entryLines.push({ lineIdx: i, content: lines[i] });
  } else if (l === '];') {
    break;
  }
}

console.log(`Found ${entryLines.length} release entries`);

// ---------------------------------------------------------------------------
// Parse each entry for cat field
// ---------------------------------------------------------------------------
function parseCat(content) {
  return content.match(/cat:\s*"([^"]+)"/)?.[1] ?? null;
}

function parseTitle(content) {
  const m = content.match(/title:\s*"((?:[^"\\]|\\.)*)"/);
  return m ? m[1].replace(/\\"/g, '"') : '';
}

// ---------------------------------------------------------------------------
// Two-pass: first collect all entries with their cat+prefix, reversed (oldest→newest)
// to assign sequential numbers per prefix
// ---------------------------------------------------------------------------
const prefixCounters = {};

// Process oldest first (reverse of array) to assign numbers 1,2,3...
// Then we'll store the results by lineIdx
const assignments = new Map(); // lineIdx → { shortTitle, code }

for (let i = entryLines.length - 1; i >= 0; i--) {
  const { lineIdx, content } = entryLines[i];
  const cat = parseCat(content);
  const prefix = catToPrefix(cat);
  prefixCounters[prefix] = (prefixCounters[prefix] || 0) + 1;
  const code = `${prefix}-${prefixCounters[prefix]}`;
  const title = parseTitle(content);
  const shortTitle = makeShortTitle(title);
  assignments.set(lineIdx, { shortTitle, code });
}

// ---------------------------------------------------------------------------
// Apply: replace or insert shortTitle + code in each entry line
// ---------------------------------------------------------------------------
const updatedLines = [...lines];

for (const [lineIdx, { shortTitle, code }] of assignments) {
  let line = updatedLines[lineIdx];

  // Escape double-quotes in shortTitle for embedding in a JS string
  const escapedShort = shortTitle.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const escapedCode = code.replace(/"/g, '\\"');

  // Remove existing shortTitle and code fields if present
  line = line.replace(/,?\s*shortTitle:\s*"(?:[^"\\]|\\.)*"/g, '');
  line = line.replace(/,?\s*code:\s*"(?:[^"\\]|\\.)*"/g, '');

  // Insert shortTitle + code right after `version: "..."` (with its trailing comma)
  line = line.replace(
    /(version:\s*"[^"]*",)/,
    `$1 shortTitle: "${escapedShort}", code: "${escapedCode}",`
  );

  updatedLines[lineIdx] = line;
}

// ---------------------------------------------------------------------------
// Write back
// ---------------------------------------------------------------------------
const output = updatedLines.join('\n');
fs.writeFileSync(filePath, output, 'utf8');

console.log(`Done — wrote ${assignments.size} entries with shortTitle + code`);
console.log('Prefix distribution:');
const sorted = Object.entries(prefixCounters).sort((a, b) => b[1] - a[1]);
for (const [p, n] of sorted) console.log(`  ${p}: ${n}`);
