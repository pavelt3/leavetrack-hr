import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,         // Render cold-start can be slow
  expect: { timeout: 15_000 },
  fullyParallel: false,    // run sequentially so login state is predictable
  retries: 1,
  reporter: "html",

  use: {
    baseURL: process.env.BASE_URL || "https://leavetrack-hr.onrender.com",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // Step 1: log in and save session to .auth/admin.json
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },
    // Step 2: run all specs using the saved session
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/admin.json",
      },
      dependencies: ["setup"],
    },
  ],
});
