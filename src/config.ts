/**
 * Runtime configuration. The data URL is the one wiring point between this
 * static site and your existing StrengthLevel -> Google Sheet pipeline.
 *
 * Set it at build/deploy time via the VITE_DATA_URL env var (e.g. in a .env
 * file or the Cloudflare/Netlify dashboard). It can point at either:
 *   1. the Apps Script web-app `doGet` JSON endpoint directly, or
 *   2. the `/api/data` proxy function (recommended — avoids any CORS surprises).
 * If unset, the app loads the bundled sample fixture so it always renders.
 */
export const DATA_URL: string | undefined = import.meta.env.VITE_DATA_URL;

/** Default estimated-1RM formula. */
export const DEFAULT_FORMULA = "epley" as const;
