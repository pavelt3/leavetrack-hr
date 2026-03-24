import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false, // run sequentially so login state is predictable
  retries: 1,
  reporter: "html",

  use: {
    baseURL: process.env.BASE_URL || "https://leavetrack-hr.onrender.com",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
