import { defineConfig, devices } from "@playwright/test";

/** Playwright E2E — boots the new app via Vite and drives Chromium.
 * On a normal machine Playwright manages its own browsers. In sandboxes that
 * pre-provision Chromium, set PW_CHROMIUM_PATH to that binary to skip downloads. */
const exe = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:5174", trace: "on-first-retry" },
  webServer: {
    command: "pnpm dev:app",
    url: "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(exe ? { launchOptions: { executablePath: exe } } : {}),
      },
    },
  ],
});
