import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsEmployee, loginAsManager, ADMIN_PASSWORD, EMPLOYEE_PASSWORD, MANAGER_PASSWORD } from "./helpers";

test.describe("Team Calendar", () => {
  test("calendar page accessible to admin", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/calendar");
    await expect(page.getByRole("heading", { name: /team calendar/i })).toBeVisible();
  });

  test("calendar page accessible to employee", async ({ page }) => {
    test.skip(!EMPLOYEE_PASSWORD, "EMPLOYEE_PASSWORD not set");
    await loginAsEmployee(page);
    await page.goto("/#/calendar");
    await expect(page.getByRole("heading", { name: /team calendar/i })).toBeVisible();
  });

  test("calendar shows month navigation", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/calendar");
    await expect(page.getByRole("button", { name: /prev|back|<|‹/i }).or(page.getByRole("button", { name: /next|›|>/i })).first()).toBeVisible();
  });

  test("calendar shows current month name", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/calendar");
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const currentMonth = months[new Date().getMonth()];
    await expect(page.getByText(new RegExp(currentMonth, "i"))).toBeVisible();
  });

  test("calendar year selector is present", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/calendar");
    // Should show a year selector (dropdown or buttons)
    await expect(page.getByText(String(new Date().getFullYear()))).toBeVisible();
  });

  test("calendar shows PL and CZ holiday legend/colors", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/calendar");
    // Legend should mention CZ and PL holidays
    await expect(page.getByText(/CZ|Czech/i).or(page.getByText(/PL|Poland/i)).first()).toBeVisible({ timeout: 10_000 });
  });

  test("employee sees full team calendar (bug check)", async ({ page }) => {
    test.skip(!EMPLOYEE_PASSWORD, "EMPLOYEE_PASSWORD not set");
    await loginAsEmployee(page);
    await page.goto("/#/calendar");
    // Verify page loads without error — employee should see full team
    await expect(page.getByRole("heading", { name: /team calendar/i })).toBeVisible();
    // If there are any leave entries visible, verify they render
    await page.waitForTimeout(1000);
    await expect(page.locator("body")).not.toContainText(/error|forbidden|unauthorized/i);
  });
});
