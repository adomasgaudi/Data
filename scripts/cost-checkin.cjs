#!/usr/bin/env node
/**
 * Stop hook: periodic COST CHECK-IN for a LOCKED task.
 *
 * Only does anything when a task is locked (`.claude/active-task.json` present & parseable).
 * It tracks how much token cost has accrued since the lock; each time spend crosses the
 * next euro threshold it surfaces a "€X spent — continue?" nudge and advances the threshold.
 * When no task is locked it does nothing. Never throws, always exits 0, silent unless it fires.
 *
 * Cost method mirrors scripts/show-cost.py (rule 34): OUTPUT tokens are the honest meter.
 * We convert cumulative session output tokens -> fraction of the flat weekly fee using the
 * SAME per-model 5h-window anchor show-cost.py uses (OUTPUT_TOKENS_PER_5H_WINDOW_BY_MODEL),
 * so the euro figure matches show-cost.py's `sess_real = real_eur(sess.out, model)`.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

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

// ── Constants copied from scripts/show-cost.py (keep in step if the py file changes) ──
const MONTHLY_SUBSCRIPTION_EUR = 180.0;
const WEEKLY_SUBSCRIPTION_EUR = (MONTHLY_SUBSCRIPTION_EUR * 12) / 52; // ~€41.54 / week
const WEEKLY_WINDOWS = 168 / 5; // ~33.6 rolling 5h windows in a week
const OUTPUT_TOKENS_PER_5H_WINDOW_BY_MODEL = {
  "claude-opus": 5_200_000,
  "claude-sonnet": 26_000_000,
  "claude-haiku": 50_000_000,
  "claude-fable": 3_000_000,
};
function outputPer5h(model) {
  for (const k of Object.keys(OUTPUT_TOKENS_PER_5H_WINDOW_BY_MODEL)) {
    if (model.startsWith(k)) return OUTPUT_TOKENS_PER_5H_WINDOW_BY_MODEL[k];
  }
  return 5_200_000; // safe default = Opus
}
// Honest cost: share of the flat weekly fee this output represents (NOT API list price).
function realEur(outputTokens, model) {
  const fracWeek = outputTokens / outputPer5h(model) / WEEKLY_WINDOWS;
  return fracWeek * WEEKLY_SUBSCRIPTION_EUR;
}

// ── Find the most-recently-modified transcript (same as show-cost.py find_transcript) ──
function findTranscript() {
  try {
    const projects = path.join(os.homedir(), ".claude", "projects");
    if (!fs.existsSync(projects)) return null;
    let best = null;
    let bestM = -1;
    const walk = (dir) => {
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.isFile() && e.name.endsWith(".jsonl")) {
          let m = -1;
          try {
            m = fs.statSync(full).mtimeMs;
          } catch {
            continue;
          }
          if (m > bestM) {
            bestM = m;
            best = full;
          }
        }
      }
    };
    walk(projects);
    return best;
  } catch {
    return null;
  }
}

// ── Cumulative session cost (€) from the transcript's output tokens, per show-cost.py ──
function sessionEur() {
  try {
    const tpath = findTranscript();
    if (!tpath) return null;
    const text = read(tpath);
    if (!text) return null;
    let total = 0;
    let sawAny = false;
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let d;
      try {
        d = JSON.parse(line);
      } catch {
        continue;
      }
      const m = d.message || {};
      if (d.type === "assistant" && m.usage) {
        const model = m.model || "";
        const out = (m.usage.output_tokens || 0);
        total += realEur(out, model);
        sawAny = true;
      }
    }
    return sawAny ? total : null;
  } catch {
    return null;
  }
}

function main() {
  try {
    const root = process.cwd();
    const stateFile = path.join(root, ".claude", "active-task.json");
    const raw = read(stateFile);
    if (!raw) return; // no lock file -> nothing
    let state;
    try {
      state = JSON.parse(raw);
    } catch {
      return; // unparseable -> nothing
    }
    if (!state || typeof state !== "object") return;

    const currentEur = sessionEur();
    if (currentEur == null || !isFinite(currentEur)) return; // best-effort: no number -> silent

    // First Stop after lock (or unknown anchor) just records the baseline, then exits silent.
    const hasBaseline =
      typeof state.baselineEur === "number" && isFinite(state.baselineEur);
    const anchorIsZero =
      !state.startedPctW || Number(state.startedPctW) === 0;
    if (!hasBaseline) {
      if (anchorIsZero) {
        state.baselineEur = currentEur;
        try {
          fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
        } catch {}
        return; // anchored baseline this run; don't fire
      }
      // startedPctW was a real anchor but baseline never set -> treat current as baseline.
      state.baselineEur = currentEur;
      try {
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
      } catch {}
      return;
    }

    const baselineEur = state.baselineEur;
    const spentEur = currentEur - baselineEur;

    let nextCheckin =
      typeof state.nextCheckinEur === "number" && isFinite(state.nextCheckinEur)
        ? state.nextCheckinEur
        : 1;
    const every =
      typeof state.checkinEveryEur === "number" &&
      isFinite(state.checkinEveryEur) &&
      state.checkinEveryEur > 0
        ? state.checkinEveryEur
        : 1;

    if (spentEur >= nextCheckin) {
      // Advance the threshold past the current spend (covers jumps over multiple steps).
      while (nextCheckin <= spentEur) nextCheckin += every;
      state.nextCheckinEur = nextCheckin;
      try {
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
      } catch {}

      let task = typeof state.task === "string" ? state.task : "";
      if (task.length > 50) task = task.slice(0, 47) + "...";
      const msg =
        `💰 Locked-task check-in: ~€${spentEur.toFixed(2)} spent since lock on ` +
        `"${task}". Continue, adjust, or #unlock?`;
      process.stdout.write(JSON.stringify({ systemMessage: msg }));
    }
    // else: silent
  } catch {
    // never throw
  }
}

main();
process.exit(0);
