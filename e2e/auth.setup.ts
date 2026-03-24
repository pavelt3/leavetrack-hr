/**
 * auth.setup.ts
 * Logs in once and saves the session to .auth/admin.json so all
 * other tests can re-use it without repeating the login flow.
 */
import { test as setup, expect } from "@playwright/test";
import fs from "fs";

const AUTH_FILE = ".auth/admin.json";

setup("authenticate as admin", async ({ page }) => {
  const email    = process.env.TEST_EMAIL    || "ptyle@lucentrenewables.com";
  const password = process.env.TEST_PASSWORD || "Lucent2026!";

  // Ensure .auth directory exists
  fs.mkdirSync(".auth", { recursive: true });

  await page.goto("/#/");
  await page.waitForSelector("input[type=email], input[name=email]");

  await page.fill("input[type=email], input[name=email]", email);
  await page.fill("input[type=password]", password);
  await page.click("button[type=submit]");

  // Wait for dashboard to confirm login succeeded
  await expect(
    page.locator("text=Good morning, Pavel")
      .or(page.locator("text=Good afternoon, Pavel"))
      .or(page.locator("text=Good evening, Pavel"))
  ).toBeVisible({ timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
