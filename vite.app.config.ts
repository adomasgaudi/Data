import path from "node:path";
import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Vite config for the NEW React app (`app/`) — the modern-stack scaffold that
 * coexists with the legacy single-file dashboard (built by the root vite.config.ts).
 * Kept separate so the two builds never interfere: `pnpm build:app` → dist-app/.
 */
export default defineConfig({
  root: path.resolve(__dirname, "app"),
  plugins: [react(), tailwind()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "app"),
      "@src": path.resolve(__dirname, "src"),
      "@api": path.resolve(__dirname, "api"),
      "@db": path.resolve(__dirname, "db"),
    },
  },
  // The app imports the bundled CSV + shared contract/schema from outside app/,
  // so let the dev server read the repo root.
  server: { port: 5174, fs: { allow: [path.resolve(__dirname)] } },
  build: { outDir: path.resolve(__dirname, "dist-app"), emptyOutDir: true },
});
