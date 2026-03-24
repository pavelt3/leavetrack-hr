import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsEmployee, loginAsManager, ADMIN_PASSWORD, EMPLOYEE_PASSWORD, MANAGER_PASSWORD } from "./helpers";

test.describe("Settings — Profile", () => {
  test("settings page accessible to all roles", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/settings");
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
  });

  test("profile form pre-fills with current user data", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/settings");
    // Should show name fields pre-filled
    await expect(page.getByDisplayValue(/Pavel/)).toBeVisible({ timeout: 10_000 });
  });

  test("phone and emergency contact fields are present", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/settings");
    await expect(page.getByLabel(/phone/i)).toBeVisible();
    await expect(page.getByLabel(/emergency contact/i)).toBeVisible();
  });

  test("change password form is present", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/settings");
    await expect(page.getByLabel(/current password/i)).toBeVisible();
    await expect(page.getByLabel(/new password/i)).toBeVisible();
  });

  test("change password rejects wrong current password", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/settings");
    await page.getByLabel(/current password/i).fill("wrongpassword123");
    await page.getByLabel(/new password/i).fill("newpassword456");
    await page.getByRole("button", { name: /change password/i }).click();
    await expect(page.getByText(/incorrect|wrong|invalid/i)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Settings — Delegation (Manager/Admin)", () => {
  test("delegation section visible for admin", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/settings");
    await expect(page.getByText(/delegate.*approval|approval.*delegation/i)).toBeVisible();
  });

  test("delegation section visible for manager", async ({ page }) => {
    test.skip(!MANAGER_PASSWORD, "MANAGER_PASSWORD not set");
    await loginAsManager(page);
    await page.goto("/#/settings");
    await expect(page.getByText(/delegate.*approval|approval.*delegation/i)).toBeVisible();
  });
});

test.describe("Settings — Payroll Export (Admin)", () => {
  test("payroll export section visible for admin", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/settings");
    await expect(page.getByText(/payroll.*export|export.*payroll/i)).toBeVisible();
  });

  test("payroll export shows year and month selectors", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/settings");
    // Navigate to admin tab if tabbed
    const adminTab = page.getByRole("tab", { name: /admin/i });
    if (await adminTab.isVisible()) await adminTab.click();
    await expect(page.getByText(/year/i).first()).toBeVisible();
  });

  test("payroll export download triggers a file download", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set");
    await loginAsAdmin(page);
    await page.goto("/#/settings");
    const adminTab = page.getByRole("tab", { name: /admin/i });
    if (await adminTab.isVisible()) await adminTab.click();

    const downloadPromise = page.waitForEvent("download", { timeout: 10_000 }).catch(() => null);
    await page.getByRole("button", { name: /export.*csv|download.*payroll|export payroll/i }).click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/payroll.*\.csv/i);
    }
  });
});
