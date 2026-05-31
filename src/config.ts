/**
 * Runtime configuration. The data URL is the one wiring point between this
 * static site and the StrengthLevel fetcher.
 *
 * Default is the same-origin "/api/data" serverless function, which fetches
 * StrengthLevel server-side (the same way the Apps Script does) and returns the
 * flattened set log. Override with VITE_DATA_URL at build/deploy time if needed.
 * When opened as a bare local file (no server, so no /api/data), the app falls
 * back to the bundled sample fixture so it still renders.
 */
export const DATA_URL: string = import.meta.env.VITE_DATA_URL ?? "/api/data";

/** Default estimated-1RM formula. */
export const DEFAULT_FORMULA = "epley" as const;
