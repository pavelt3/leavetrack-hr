import { test, expect } from "@playwright/test";



test.beforeEach(async ({ page }) => {
  await page.goto("/#/people");
  await expect(page.locator("h1", { hasText: "People" })).toBeVisible();
});

test("people page lists all active team members", async ({ page }) => {
  await expect(page.locator("text=7 Active Team Members")).toBeVisible();
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
});

test("search filters the member list", async ({ page }) => {
  await page.fill("input[placeholder*='Search']", "Karen");
  await expect(page.locator("text=Karen Biesuz")).toBeVisible();
  // "Reports to Pavel Tyle" still appears in Karen's row, so scope to the
  // name span specifically — not the sub-text details line
  await expect(page.locator("span.font-medium.text-sm", { hasText: "Pavel Tyle" })).not.toBeVisible();
});

test("leave history dialog opens and closes", async ({ page }) => {
  // Click the history (clock) icon on the first member row
  const historyButtons = page.locator("button[title*='history' i], button[aria-label*='history' i]");
  if (await historyButtons.count() > 0) {
    await historyButtons.first().click();
  } else {
    // Fallback: find all row action buttons and click the second one (history)
    const rows = page.locator("[data-testid*='person-row'], .divide-y > div");
    const firstRow = rows.first();
    const buttons = firstRow.locator("button");
    await buttons.nth(1).click();
  }
  await expect(page.locator("text=Leave History")).toBeVisible();
  await page.click("button:has-text('Close')");
  await expect(page.locator("text=Leave History")).not.toBeVisible();
});

test("invite person dialog opens", async ({ page }) => {
  await page.click("button:has-text('Invite Person')");
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
  // Dialog or form should appear
  await expect(page.locator("[role=dialog]")).toBeVisible();
  await page.keyboard.press("Escape");
});
