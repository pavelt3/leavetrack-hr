/**
 * request-leave.spec.ts
 * Covers the TDZ bug that was fixed (picking dates must not crash the page)
 * and general form behaviour.
 */
import { test, expect } from "@playwright/test";



test.beforeEach(async ({ page }) => {
  await page.goto("/#/request");
  await expect(page.locator("h1", { hasText: "Request Leave" })).toBeVisible();
});

test("page loads without crash", async ({ page }) => {
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
  await expect(page.locator("text=Leave Details")).toBeVisible();
  await expect(page.locator("text=Remaining:")).toBeVisible();
});

test("picking start date does not crash the page (TDZ regression)", async ({ page }) => {
  // This previously threw: Cannot access 'D' before initialization
  await page.fill("#start-date", "2026-08-03");
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
  await expect(page.locator("text=Leave Details")).toBeVisible();
});

test("picking both dates shows working-day preview", async ({ page }) => {
  await page.fill("#start-date", "2026-08-03");
  await page.fill("#end-date", "2026-08-07");
  // Should show the day-count info banner
  await expect(page.locator("text=/approximately \\d+ working day/")).toBeVisible();
  // Should show individual working days list
  await expect(page.locator("text=Working days included")).toBeVisible();
});

test("half-day toggle hides end date and updates banner", async ({ page }) => {
  // Enable half-day
  await page.click("button[role=switch]");
  await expect(page.locator("#end-date")).not.toBeVisible();
  await page.fill("#start-date", "2026-08-03");
  await expect(page.locator("text=half a day (0.5)")).toBeVisible();
});

test("switching to Sick Leave keeps half-day option", async ({ page }) => {
  // Radix Select renders options as [role="option"] in a floating portal
  await page.click("[data-testid=select-leave-type]");
  await page.getByRole("option", { name: "Sick Leave" }).click();
  await expect(page.locator("button[role=switch]")).toBeVisible();
});

test("switching to Unpaid Leave hides half-day toggle", async ({ page }) => {
  await page.click("[data-testid=select-leave-type]");
  await page.getByRole("option", { name: "Unpaid Leave" }).click();
  await expect(page.locator("button[role=switch]")).not.toBeVisible();
});

test("submit is disabled when no dates selected", async ({ page }) => {
  await expect(page.locator("[data-testid=button-submit-request]")).toBeDisabled();
});

test("warns when requesting more days than remaining allowance", async ({ page }) => {
  // Request a huge range — more than 25 days remaining
  await page.fill("#start-date", "2026-09-01");
  await page.fill("#end-date", "2026-12-31");
  await expect(page.locator("text=You only have")).toBeVisible();
});
