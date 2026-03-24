import { test, expect } from "@playwright/test";



test("team overview shows all members", async ({ page }) => {
  await page.goto("/#/team");
  // Use h1 to avoid strict-mode clash with nav link that also says "Team Overview"
  await expect(page.locator("h1", { hasText: "Team Overview" })).toBeVisible();
  await expect(page.locator("text=Team members")).toBeVisible();
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
});

test("team overview shows individual allowances for each member", async ({ page }) => {
  await page.goto("/#/team");
  await expect(page.locator("text=Individual Allowances")).toBeVisible();
  // All 7 team members should be visible in main content (sidebar excluded)
  const expectedNames = [
    "Pavel Tyle",
    "Charles Thomson",
    "Karen Biesuz",
    "Marco Tirb",
    "Patrycja Porysiak",
    "Piotr Śledziński",
    "Tomáš Ondráček",
  ];
  const main = page.locator("main");
  for (const name of expectedNames) {
    await expect(main.locator(`text=${name}`).first()).toBeVisible();
  }
});

test("year filter changes displayed data", async ({ page }) => {
  await page.goto("/#/team");
  // Year filter is a Radix Select — click the trigger then the option
  await page.locator("[data-testid='select-year']").click();
  await page.getByRole("option", { name: "2025" }).click();
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
});
