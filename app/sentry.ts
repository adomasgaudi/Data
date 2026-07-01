import * as Sentry from "@sentry/react";
import { env } from "./env";

/**
 * Initialise Sentry ONLY when a DSN is configured (`VITE_SENTRY_DSN`).
 * Dormant otherwise, so the app builds and runs with no account or key. Set the
 * DSN in `.env` to activate error + performance reporting.
 */
export function initSentry(): void {
  if (!env.VITE_SENTRY_DSN) return;
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  });
}
