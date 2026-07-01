#!/usr/bin/env node
/**
 * Run-driver for the "stacked" React app (app/).
 *
 * One command: spawns the Vite dev server, waits for it, drives the app in a
 * real browser (Chromium via Playwright), screenshots every surface, probes a
 * few edges, then tears the server down. Exits 0 iff the core flows render.
 *
 * Usage (from repo root):
 *   node .claude/skills/run-stacked-app/driver.mjs
 *
 * Env:
 *   PW_CHROMIUM_PATH   explicit Chromium binary (sandboxes pre-provision one;
 *                      auto-detected from /opt/pw-browsers/chromium-* if unset)
 *   RUN_SHOT_DIR       screenshot output dir (default: <os tmp>/colosseum-app-run)
 *   BASE_URL           drive an already-running server instead of spawning one
 *   PORT               dev-server port (default 5174, matches vite.app.config.ts)
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../..");
const PORT = process.env.PORT || "5174";
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const SHOTS = process.env.RUN_SHOT_DIR || path.join(os.tmpdir(), "colosseum-app-run");
fs.mkdirSync(SHOTS, { recursive: true });

/** Find a usable Chromium: explicit env → pre-provisioned sandbox → Playwright default. */
function chromiumPath() {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  const base = "/opt/pw-browsers";
  try {
    const dir = fs.readdirSync(base).find((d) => d.startsWith("chromium-") && !d.includes("headless"));
    if (dir) {
      const p = path.join(base, dir, "chrome-linux", "chrome");
      if (fs.existsSync(p)) return p;
    }
  } catch {
    /* not a sandbox — fall through to Playwright's managed browser */
  }
  return undefined;
}

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`server never came up at ${url}`);
}

let server;
const results = [];
const ok = (cond, label) => {
  results.push({ ok: !!cond, label });
  console.log(`${cond ? "✅" : "❌"} ${label}`);
};

async function main() {
  // 1. Launch the dev server (vite directly, so we can kill exactly it).
  if (!process.env.BASE_URL) {
    const vite = path.join(REPO, "node_modules", ".bin", "vite");
    server = spawn(vite, ["--config", "vite.app.config.ts"], { cwd: REPO, stdio: "ignore" });
  }
  await waitForServer(BASE);
  console.log(`server up at ${BASE}`);

  const exe = chromiumPath();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  // 2. Leaderboard — real CSV data, sorted descending.
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SHOTS}/01-leaderboard.png` });
  const rows = await page.locator("tbody tr").count();
  const w1 = Number(await page.locator("tbody tr").first().locator("td").nth(2).innerText());
  const w2 = Number(await page.locator("tbody tr").nth(1).locator("td").nth(2).innerText());
  ok(rows > 0, `leaderboard renders ${rows} rows of parsed CSV`);
  ok(w1 >= w2, `rows sorted by weight desc (${w1} >= ${w2})`);

  // 3. Data Health route + computed stats.
  await page.getByRole("link", { name: /data health/i }).click();
  await page.waitForURL("**/health");
  await page.screenshot({ path: `${SHOTS}/02-datahealth.png` });
  const total = await page.locator("text=Total sets").locator("xpath=preceding-sibling::div").first().innerText();
  ok(Number(total) > 0, `data-health shows computed total sets (${total})`);

  // 4. Design-system dialog (Radix) opens + closes.
  await page.getByRole("button", { name: /about this data/i }).click();
  await page.waitForTimeout(300);
  ok(await page.getByRole("dialog").isVisible(), "Radix dialog opens");
  await page.screenshot({ path: `${SHOTS}/03-dialog.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok(!(await page.getByRole("dialog").isVisible().catch(() => false)), "dialog closes on Escape");

  // 5. i18n toggle + persistence.
  await page.getByRole("button", { name: "LT" }).click();
  await page.waitForTimeout(300);
  ok(await page.getByRole("link", { name: /Lyderių lentelė/i }).isVisible(), "i18next toggles to Lithuanian");
  await page.screenshot({ path: `${SHOTS}/04-lithuanian.png` });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  ok(await page.getByRole("link", { name: /Lyderių lentelė/i }).isVisible(), "language persists across reload");

  // 6. PROBE — unknown route (no catch-all: React Router dev error boundary).
  await page.goto(BASE + "/does-not-exist", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/05-badroute.png` });
  const boundary = await page.getByText(/Unexpected Application Error/i).isVisible().catch(() => false);
  console.log(`🔍 PROBE unknown route → React Router error boundary shown=${boundary} (no custom 404 route)`);

  console.log(`\nconsole errors (happy paths + 404 probe): ${errors.length}`);
  console.log(`screenshots: ${SHOTS}`);
  await browser.close();
}

try {
  await main();
} finally {
  if (server) server.kill("SIGTERM");
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} core checks passed`);
process.exit(failed.length ? 1 : 0);
