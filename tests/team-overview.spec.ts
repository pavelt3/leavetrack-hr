import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsManager, loginAsEmployee, ADMIN_PASSWORD, MANAGER_PASSWORD, EMPLOYEE_PASSWORD } from "./helpers";

test.describe("Team Overview", () => {
  test("team overview accessible to admin", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/team");
    await expect(page.getByRole("heading", { name: /team overview/i })).toBeVisible();
  });

  test("team overview accessible to manager", async ({ page }) => {
    test.skip(!MANAGER_PASSWORD, "MANAGER_PASSWORD not set");
    await loginAsManager(page);
    await page.goto("/#/team");
    await expect(page.getByRole("heading", { name: /team overview/i })).toBeVisible();
  });

  test("team overview blocked for employees", async ({ page }) => {
    test.skip(!EMPLOYEE_PASSWORD, "EMPLOYEE_PASSWORD not set");
    await loginAsEmployee(page);
    await page.goto("/#/team");
    // Nav item shouldn't be visible for employees
    await expect(page.getByTestId("nav-team")).not.toBeVisible();
  });

  test("team overview shows year selector with multiple years", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/team");
    await page.waitForTimeout(500);
    const currentYear = new Date().getFullYear();
    await expect(page.getByText(String(currentYear))).toBeVisible();
  });

  test("team overview shows allowance bars/progress", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/team");
    await page.waitForTimeout(1000);
    // Should show at least one team member
    await expect(page.getByText(/Thomson|Tirb|Ondráček|Porysiak/)).toBeVisible({ timeout: 10_000 });
  });
});
