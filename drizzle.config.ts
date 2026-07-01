import { defineConfig } from "drizzle-kit";

/** drizzle-kit config. DATABASE_URL is the Postgres connection string (from the
 * Supabase project settings) — provided via .env at migration time, never here. */
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
