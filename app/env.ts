import { z } from "zod";

/**
 * Typed, validated runtime env — the "secrets management" boundary for the app.
 * Only `VITE_`-prefixed vars reach the browser (Vite rule); real secrets stay in
 * `.env` (encrypted at rest via dotenvx — see package.json `env:encrypt`) and in
 * the serverless functions, never here. Parsing fails loud on a malformed value.
 */
const EnvSchema = z.object({
  VITE_DATA_URL: z.string().default("/api/data"),
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_LD_CLIENT_ID: z.string().optional(),
});

export const env = EnvSchema.parse({
  VITE_DATA_URL: import.meta.env.VITE_DATA_URL,
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  VITE_LD_CLIENT_ID: import.meta.env.VITE_LD_CLIENT_ID,
});
