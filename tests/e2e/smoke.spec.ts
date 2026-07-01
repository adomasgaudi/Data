import { expect, test } from "@playwright/test";

test("renders the shell and leaderboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Colosseum")).toBeVisible();
  // Leaderboard table header is present.
  await expect(page.getByRole("columnheader", { name: /athlete/i })).toBeVisible();
});

test("navigates to data health", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /data health/i }).click();
  await expect(page.getByText(/total sets/i)).toBeVisible();
});

test("toggles language to Lithuanian", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "LT" }).click();
  await expect(page.getByRole("link", { name: /Lyderių lentelė/i })).toBeVisible();
});
