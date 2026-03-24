import { test, expect } from "@playwright/test";

test.use({ storageState: ".auth/admin.json" });

test("team overview shows all members", async ({ page }) => {
  await page.goto("/#/team");
  await expect(page.locator("text=Team Overview")).toBeVisible();
  // Should show at least the team member count stat
  await expect(page.locator("text=Team members")).toBeVisible();
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
});

test("team overview shows individual allowances for each member", async ({ page }) => {
  await page.goto("/#/team");
  await expect(page.locator("text=Individual Allowances")).toBeVisible();
  // All 7 team members should be visible
  const expectedNames = [
    "Pavel Tyle",
    "Charles Thomson",
    "Karen Biesuz",
    "Marco Tirb",
    "Patrycja Porysiak",
    "Piotr Śledziński",
    "Tomáš Ondráček",
  ];
  for (const name of expectedNames) {
    await expect(page.locator(`text=${name}`)).toBeVisible();
  }
});

test("year filter changes displayed data", async ({ page }) => {
  await page.goto("/#/team");
  await page.selectOption("select, [role=combobox]", "2025");
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
});
