# `stacked` — modern-stack scaffold

This branch introduces a modern React stack **alongside** the legacy single-file
dashboard. The legacy app (`src/`, `index.dev.html`, 90+ tests) is untouched and
still builds green; the new app lives in `app/` and actually *uses* each tool so
the migration can proceed incrementally (or be lifted into a fresh repo).

## What's wired

| Concern | Tool | Where |
| --- | --- | --- |
| Package manager | **pnpm** | `package.json` (`packageManager`), `pnpm-lock.yaml` |
| Framework | **React 19 + Vite** | `app/`, `vite.app.config.ts` |
| Styling | **Tailwind v4** | `@tailwindcss/vite`, `app/index.css` |
| Design system | **shadcn-style + Radix** | `app/components/ui/*` (`cva`, `tailwind-merge`) |
| Router | **React Router v7** | `app/router.tsx` |
| State | **Zustand** | `app/store/useAppStore.ts` |
| i18n | **i18next** | `app/i18n.ts` (en/lt) |
| CSV parsing | **PapaParse** | `app/lib/csv.ts` |
| API contract | **ts-rest + zod** | `api/contract.ts`, `api/client.ts` |
| ORM | **Drizzle** | `db/schema.ts`, `drizzle.config.ts` |
| Linter/formatter | **Biome** | `biome.json` |
| E2E | **Playwright** | `playwright.config.ts`, `tests/e2e/` |
| Container | **Docker** | `Dockerfile`, `docker-compose.yml` |
| Secrets | **dotenvx** + zod env | `app/env.ts`, `.env.example` |
| Error monitoring | **Sentry** (dormant) | `app/sentry.ts` — needs a DSN to activate |

## Not wired (needs an account / API key)

- **LaunchDarkly** — the SDK can't initialise without an LD account + client-side
  ID, and flags are created in their dashboard. `app/lib/flags.ts` is a
  LaunchDarkly-shaped local stub so swapping to the real SDK later is a drop-in.
- **Sentry** is installed but stays off until `VITE_SENTRY_DSN` is set.
- **Drizzle migrations** need `DATABASE_URL` (the Supabase Postgres password);
  the schema + config are ready, but no live migration is run here.

## Commands

```bash
pnpm install
pnpm dev:app        # Vite dev server on :5174
pnpm build:app      # typecheck + build -> dist-app/
pnpm lint           # Biome
pnpm test:e2e       # Playwright (boots dev:app)
pnpm test           # legacy Vitest suite (unchanged)

docker compose up --build   # serve the built app on :8080
```

## Why React + Vite, not Next.js

The legacy app ships as one self-contained `index.html` via
`vite-plugin-singlefile`. Next.js forces an SSR/app-router restructure and can't
produce that artifact, so React + Vite is the pragmatic path that keeps both apps
in one repo.
