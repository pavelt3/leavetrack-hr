/**
 * team-calendar.spec.ts
 * Specifically tests month navigation — the original blank-page trigger.
 */
import { test, expect } from "@playwright/test";



test.beforeEach(async ({ page }) => {
  await page.goto("/#/calendar");
  await expect(page.locator("h1", { hasText: "Team Calendar" })).toBeVisible();
});

test("calendar loads showing current month", async ({ page }) => {
  await expect(page.locator("text=March 2026").or(page.locator("text=April 2026"))).toBeVisible();
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
});

test("next month navigation does not crash", async ({ page }) => {
  // The nav buttons are ghost icon buttons (h-8 w-8); next is the 2nd one (index 1)
  const nextBtn = page.locator("button.h-8.w-8").nth(1);
  for (let i = 0; i < 5; i++) {
    await nextBtn.click();
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();
  }
});

test("prev month navigation does not crash", async ({ page }) => {
  // prev is the 1st h-8 w-8 button (index 0)
  const prevBtn = page.locator("button.h-8.w-8").nth(0);
  for (let i = 0; i < 3; i++) {
    await prevBtn.click();
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();
  }
});

test("week view loads without crash", async ({ page }) => {
  await page.click("button:has-text('Week')");
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
});

test("Today button returns to current month", async ({ page }) => {
  // Navigate forward
  const nextBtn = page.locator("button.h-8.w-8").nth(1);
  await nextBtn.click();
  await nextBtn.click();
  // Click Today
  await page.click("button:has-text('Today')");
  await expect(page.locator("text=March 2026").or(page.locator("text=April 2026"))).toBeVisible();
});
