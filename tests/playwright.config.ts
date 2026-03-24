import { defineConfig, devices } from "@playwright/test";

/**
 * Lucent Renewables HR Platform — Playwright E2E Test Suite
 *
 * Setup:
 *   npm install --save-dev @playwright/test
 *   npx playwright install chromium
 *
 * Run against live app:
 *   ADMIN_EMAIL=ptyle@lucentrenewables.com ADMIN_PASSWORD=<your_password> npx playwright test
 *
 * Run against local dev server:
 *   npm run dev &   (in another terminal)
 *   BASE_URL=http://localhost:5000 ADMIN_EMAIL=ptyle@lucentrenewables.com ADMIN_PASSWORD=<your_password> npx playwright test
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // Run sequentially — tests share state on the live DB
  retries: 1,
  reporter: [["html", { outputFolder: "playwright-report" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL || "https://leavetrack-hr.onrender.com",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
