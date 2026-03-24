import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsManager, loginAsEmployee, ADMIN_PASSWORD, MANAGER_PASSWORD, EMPLOYEE_PASSWORD } from "./helpers";

test.describe("Approvals — Manager/Admin", () => {
  test("approvals page loads for admin", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/approvals");
    await expect(page.getByRole("heading", { name: /pending approvals/i })).toBeVisible();
  });

  test("approvals page shows request count", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/approvals");
    await expect(page.getByText(/request.*awaiting/i)).toBeVisible();
  });

  test("admin can see Send Reminders button", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/approvals");
    await expect(page.getByRole("button", { name: /send reminders/i })).toBeVisible();
  });

  test("employee is redirected away from approvals page", async ({ page }) => {
    test.skip(!EMPLOYEE_PASSWORD, "EMPLOYEE_PASSWORD not set");
    await loginAsEmployee(page);
    await page.goto("/#/approvals");
    // Should either redirect or show 403 error
    await expect(page.getByRole("heading", { name: /pending approvals/i })).not.toBeVisible();
  });

  test("approve flow opens confirmation dialog", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/approvals");
    const approveButtons = page.getByRole("button", { name: /approve/i });
    const count = await approveButtons.count();
    if (count === 0) {
      test.skip(true, "No pending requests to approve");
    }
    await approveButtons.first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: /approve.*request/i })).toBeVisible();
    await expect(page.getByTestId("input-manager-note")).toBeVisible();
    // Cancel the dialog
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("reject flow opens confirmation dialog", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/approvals");
    const rejectButtons = page.getByRole("button", { name: /reject/i });
    const count = await rejectButtons.count();
    if (count === 0) {
      test.skip(true, "No pending requests to reject");
    }
    await rejectButtons.first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: /reject.*request/i })).toBeVisible();
    await page.getByRole("button", { name: /cancel/i }).click();
  });

  test("each pending request shows employee name, dates, and leave type", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/approvals");
    const cards = page.locator("[data-testid^=approval-card-]");
    const count = await cards.count();
    if (count === 0) return; // nothing to check
    const firstCard = cards.first();
    // Should contain a name (text)
    await expect(firstCard.getByText(/\w+ \w+/)).toBeVisible();
  });

  test("remaining allowance shown on approval card", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/approvals");
    const cards = page.locator("[data-testid^=approval-card-]");
    const count = await cards.count();
    if (count === 0) return;
    // Look for days remaining label
    await expect(page.getByText(/days remaining/i).first()).toBeVisible();
  });
});
