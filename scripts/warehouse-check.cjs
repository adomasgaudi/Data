/**
 * SessionStart check for the code-storage tiers (CLAUDE.md rule 10).
 * - Flags warehouse items whose ~100-SP budget of further shipped work has passed
 *   (currentSp - movedAtSp >= expiresAfterSp) — confirm with owner, then trash.
 * - Flags any attic items still lingering (the attic should be empty between
 *   refactors).
 * Flags only; never deletes. Emits a SessionStart additionalContext block when
 * there is something to report, otherwise prints nothing.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/** Cumulative shipped SP = sum of (SP:n) across all commit subjects. */
function cumulativeSp() {
  try {
    const subjects = execSync("git log --pretty=%s", { encoding: "utf8" });
    let total = 0;
    for (const m of subjects.matchAll(/\(SP:([\d.]+)\)/g)) total += parseFloat(m[1]);
    return total;
  } catch {
    return null;
  }
}

const root = path.join(__dirname, "..");
const whDir = path.join(root, "warehouse");
const atticDir = path.join(root, "attic");
const cur = cumulativeSp();
const notes = [];

if (fs.existsSync(whDir)) {
  for (const name of fs.readdirSync(whDir)) {
    if (name.startsWith("_") || name === "README.md") continue;
    const mf = path.join(whDir, name, "manifest.json");
    if (!fs.existsSync(mf)) continue;
    try {
      const m = JSON.parse(fs.readFileSync(mf, "utf8"));
      // Expiry as an ABSOLUTE shipped-SP target (expiresAtSp) when set, else the
      // legacy relative budget (movedAtSp + expiresAfterSp, default 100).
      const after = typeof m.expiresAfterSp === "number" ? m.expiresAfterSp : 100;
      const expiresAt = typeof m.expiresAtSp === "number"
        ? m.expiresAtSp
        : (typeof m.movedAtSp === "number" ? m.movedAtSp + after : null);
      if (cur != null && expiresAt != null && cur >= expiresAt) {
        const from = m.movedAtVersion ? ` (stored at ${m.movedAtVersion})` : "";
        notes.push(
          `warehouse/${m.id || name}${from}: shipped SP ${Math.round(cur)} ≥ expiry ${expiresAt} — confirm with owner, then trash.`,
        );
      }
    } catch {
      /* ignore malformed manifest */
    }
  }
}

if (fs.existsSync(atticDir)) {
  for (const name of fs.readdirSync(atticDir)) {
    if (name.startsWith("_") || name === "README.md") continue;
    if (fs.statSync(path.join(atticDir, name)).isDirectory()) {
      notes.push(`attic/${name}: still parked — resolve it (restore / warehouse / delete) before the refactor closes.`);
    }
  }
}

if (notes.length) {
  const ctx = "CODE-STORAGE CHECK (CLAUDE.md rule 10):\n- " + notes.join("\n- ");
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ctx } }),
  );
}
