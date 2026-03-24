import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsEmployee, ADMIN_PASSWORD, EMPLOYEE_PASSWORD } from "./helpers";

test.describe("Dashboard", () => {
  test("admin sees dashboard with stats", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/");
    await expect(page.getByText(/remaining/i)).toBeVisible();
    await expect(page.getByText(/annual leave taken/i)).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard shows allowance ring", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/");
    // SVG ring should be present
    await expect(page.locator("svg circle").first()).toBeVisible();
  });

  test("dashboard shows navigation links", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/");
    // Admin-only nav items
    await expect(page.getByTestId("nav-approvals")).toBeVisible();
    await expect(page.getByTestId("nav-people")).toBeVisible();
    await expect(page.getByTestId("nav-audit")).toBeVisible();
    await expect(page.getByTestId("nav-calendar")).toBeVisible();
  });

  test("employee cannot see admin-only nav items", async ({ page }) => {
    test.skip(!EMPLOYEE_PASSWORD, "EMPLOYEE_PASSWORD not set");
    await loginAsEmployee(page);
    await page.goto("/#/");
    await expect(page.getByTestId("nav-people")).not.toBeVisible();
    await expect(page.getByTestId("nav-audit")).not.toBeVisible();
    await expect(page.getByTestId("nav-approvals")).not.toBeVisible();
    await expect(page.getByTestId("nav-calendar")).toBeVisible();
  });

  test("quick action button navigates to request leave", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/");
    await page.getByRole("link", { name: /request leave|new request/i }).first().click();
    await expect(page).toHaveURL(/#\/request/);
  });
});
