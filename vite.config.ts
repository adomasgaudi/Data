import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { execSync } from "node:child_process";
// Node `process` / `node:child_process` typed minimally in src/build-env.d.ts (no
// @types/node in this project), and __BUILD_BRANCH__ declared there too.

/** The branch this build came from, so the title can show which MODEL works it (each
 * model has its own branch: opus-4.8, sonnet-4.6…). Deploy envs expose the branch as
 * an env var; locally we fall back to the current git HEAD. "" if nothing is found. */
function buildBranch(): string {
  const env =
    process.env.BRANCH ||              // Netlify
    process.env.GITHUB_REF_NAME ||     // GitHub Actions
    process.env.CF_PAGES_BRANCH ||     // Cloudflare Pages
    process.env.VERCEL_GIT_COMMIT_REF; // Vercel
  if (env) return env;
  try { return execSync("git rev-parse --abbrev-ref HEAD").toString().trim(); } catch { return ""; }
}

export default defineConfig({
  // Inline JS/CSS/data into a single dist/index.html that opens with no server.
  plugins: [viteSingleFile()],
  // Bake the build branch in so the title can show the working model (see modelName.ts).
  define: { __BUILD_BRANCH__: JSON.stringify(buildBranch()) },
  // Expose the dev server on the local network so a phone on the same Wi-Fi can
  // open it. `host: true` binds every interface and prints the current Network
  // URL on each `npm run dev`, so it keeps working when the Wi-Fi/IP changes.
  server: {
    host: true,
    port: 5173,
    // HMR off: don't auto-reload the phone while editing. Refresh manually to see changes.
    hmr: false,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
