import { test, expect } from "@playwright/test";

test.use({ storageState: ".auth/admin.json" });

test("dashboard loads with allowance stats", async ({ page }) => {
  await page.goto("/#/");
  await expect(page.locator("text=Your 2026 Allowance")).toBeVisible();
  await expect(page.locator("text=Pending Approvals")).toBeVisible();
  await expect(page.locator("text=Sick Days")).toBeVisible();
  await expect(page.locator("text=Home Office")).toBeVisible();
  await expect(page.locator("text=Accrued Days")).toBeVisible();
  await expect(page.locator("text=Upcoming Leave")).toBeVisible();
  // No crash
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
});

test("dashboard recent requests section visible", async ({ page }) => {
  await page.goto("/#/");
  await expect(page.locator("text=Recent Requests")).toBeVisible();
});
