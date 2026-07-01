---
name: run-stacked-app
description: Build, run, drive, and screenshot the "stacked" React app (app/) — the modern-stack scaffold (React + Vite + Tailwind + Radix + i18next). Use to launch, start, smoke-test, verify, or screenshot the new app.
---

# Run the `stacked` React app (`app/`)

The repo holds two apps. This skill drives the **new** one: a React 19 + Vite
SPA in `app/` (Tailwind v4, Radix/shadcn components, React Router, Zustand,
i18next, PapaParse). It is **browser-driven** — the handle is a committed
Playwright driver that spawns the Vite dev server, drives it in headless
Chromium, screenshots every surface, and tears the server down.

(The legacy single-file dashboard — `src/`, `index.dev.html` — is a different
unit and not what this skill runs.)

All paths below are relative to the repo root.

## Prerequisites

- Node 22, pnpm 10 (`corepack enable` provides pnpm).
- Chromium for Playwright. In sandboxes that pre-provision it (this container:
  `/opt/pw-browsers/chromium-*/chrome-linux/chrome`) the driver auto-detects it.
  On a normal machine, install once: `pnpm exec playwright install chromium`.
- No `apt-get` packages were needed — headless Chromium ran as-is.

## Build

```bash
pnpm install          # installs deps + approves native builds (esbuild, biome)
pnpm build:app        # tsc -p tsconfig.app.json --noEmit && vite build -> dist-app/
```

## Run (agent path) — the driver

One command builds nothing extra, launches the server, drives the app, and
writes screenshots:

```bash
node .claude/skills/run-stacked-app/driver.mjs
```

Expected tail (this container):

```
✅ leaderboard renders 10 rows of parsed CSV
✅ rows sorted by weight desc (250 >= 225)
✅ data-health shows computed total sets (12822)
✅ Radix dialog opens
✅ dialog closes on Escape
✅ i18next toggles to Lithuanian
✅ language persists across reload
🔍 PROBE unknown route → React Router error boundary shown=true (no custom 404 route)
7/7 core checks passed
```

Screenshots land in `/tmp/colosseum-app-run/` (`01-leaderboard.png` …
`05-badroute.png`). Override with `RUN_SHOT_DIR=/some/dir`. Exit code is 0 only
when all core checks pass. Env knobs: `PW_CHROMIUM_PATH` (explicit browser),
`BASE_URL` (drive an already-running server instead of spawning one), `PORT`.

## Run (human path)

```bash
pnpm dev:app          # Vite dev server on http://localhost:5174 (Ctrl-C to stop)
```

Open the URL in a browser. Useless headless — use the driver above instead.

## Test

```bash
pnpm test             # legacy Vitest suite (735 tests) — unrelated to app/
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm test:e2e
```

`test:e2e` is the Playwright spec (`tests/e2e/smoke.spec.ts`); it boots
`dev:app` itself. The driver above is the richer handle and needs no test runner.

## Gotchas

- **Playwright's pinned browser ≠ the pre-provisioned one.** `@playwright/test`
  1.61 wants `chromium_headless_shell-1228`; this sandbox ships `chromium-1194`.
  Do **not** run `playwright install` here (the sandbox forbids downloads). The
  driver sidesteps it by launching the full `chrome` binary via `executablePath`
  (auto-detected, or `PW_CHROMIUM_PATH`).
- **Run Playwright scripts from the repo root.** A `.mjs` run from elsewhere
  fails with `Cannot find package '@playwright/test'` — module resolution needs
  the repo's `node_modules`.
- **The driver spawns `node_modules/.bin/vite` directly**, not `pnpm dev:app` —
  killing the pnpm wrapper can orphan the vite child and leave port 5174 held.
- **pnpm skips native build scripts by default.** `package.json` lists
  `pnpm.onlyBuiltDependencies` for `esbuild` + `@biomejs/biome`; without them
  `vite build` and `biome` fail. `pnpm approve-builds` if they were skipped.
- **Unknown routes hit React Router's dev error boundary** (no catch-all route
  is defined). The `/does-not-exist` probe deliberately triggers it — that's the
  source of the 3 console errors in the run; happy paths are error-free.

## Troubleshooting

- `spawn .../vite ENOENT` → deps not installed; run `pnpm install`.
- Playwright `Executable doesn't exist at …chrome-headless-shell` → set
  `PW_CHROMIUM_PATH` to a real `chrome` binary, or `pnpm exec playwright install chromium`.
- Port 5174 already in use → an orphaned vite; `pkill -f 'vite --config vite.app.config.ts'`.
