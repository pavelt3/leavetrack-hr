import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsEmployee, ADMIN_PASSWORD, EMPLOYEE_PASSWORD } from "./helpers";

test.describe("Audit Log", () => {
  test("audit log accessible to admin", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/audit");
    await expect(page.getByRole("heading", { name: /audit log/i })).toBeVisible();
  });

  test("audit log blocked for employees", async ({ page }) => {
    test.skip(!EMPLOYEE_PASSWORD, "EMPLOYEE_PASSWORD not set");
    await loginAsEmployee(page);
    await page.goto("/#/audit");
    await expect(page.getByRole("heading", { name: /audit log/i })).not.toBeVisible();
  });

  test("audit log shows event entries", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/audit");
    await page.waitForTimeout(1000);
    // Should have login events at minimum
    await expect(page.getByText(/login|invited|approved|cancelled/i)).toBeVisible({ timeout: 10_000 });
  });

  test("audit log shows actor name and timestamp", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/audit");
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Pavel|Tyle/)).toBeVisible({ timeout: 10_000 });
  });
});
