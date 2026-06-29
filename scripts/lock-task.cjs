#!/usr/bin/env node
const fs = require("fs");
const { execSync } = require("child_process");

const sh = (c) => {
  try {
    return execSync(c, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
};

const FILE = ".claude/active-task.json";

function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return null;
  }
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === "lock") {
    const task = args[1] || "";
    const checkinEveryEur = parseFloat(args[2]) || 0.05;
    fs.mkdirSync(".claude", { recursive: true });
    const state = {
      task,
      startedSha: sh("git rev-parse --short HEAD"),
      startedPctW: 0,
      nextCheckinEur: checkinEveryEur,
      checkinEveryEur,
      ts: new Date().toISOString(),
    };
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
    console.log(`🔒 locked: ${task}  (check-in every €${checkinEveryEur})`);
    return;
  }

  if (cmd === "unlock") {
    if (fs.existsSync(FILE)) {
      try {
        fs.unlinkSync(FILE);
      } catch {}
      console.log("🔓 unlocked");
    } else {
      console.log("🔓 no task was locked");
    }
    return;
  }

  if (cmd === "status") {
    const state = read();
    if (state) {
      console.log(`task: ${state.task}`);
      console.log(`ts: ${state.ts}`);
      console.log(`nextCheckinEur: ${state.nextCheckinEur}`);
    } else {
      console.log("no task locked");
    }
    return;
  }

  console.log('usage: node scripts/lock-task.cjs lock "<task>" [eurPerCheckin] | unlock | status');
}

try {
  main();
} catch {
  console.log("usage: node scripts/lock-task.cjs lock \"<task>\" [eurPerCheckin] | unlock | status");
}
