import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "ptyle@lucentrenewables.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const EMPLOYEE_EMAIL = process.env.EMPLOYEE_EMAIL || "tondracek@lucentrenewables.com";
const EMPLOYEE_PASSWORD = process.env.EMPLOYEE_PASSWORD || "";

test.describe("Authentication", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/#/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("login rejects wrong credentials", async ({ page }) => {
    await page.goto("/#/login");
    await page.getByLabel(/email/i).fill("invalid@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("admin can log in and sees dashboard", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD env var not set");
    await page.goto("/#/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/#\/(dashboard)?$/);
    await expect(page.getByText(/Pavel/i)).toBeVisible();
  });

  test("forgot password hint is shown", async ({ page }) => {
    await page.goto("/#/login");
    await expect(page.getByText(/forgot.*password|contact.*admin/i)).toBeVisible();
  });

  test("logout works", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD env var not set");
    await page.goto("/#/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/#/);
    // Click user avatar / logout
    await page.getByRole("button", { name: /Pavel|logout|sign out/i }).first().click();
    await page.getByRole("button", { name: /sign out|logout/i }).last().click();
    await expect(page).toHaveURL(/#\/login/);
  });

  test("rate limiting activates after many failed attempts", async ({ page }) => {
    test.skip(true, "Skip to avoid polluting rate-limit state on live app");
    await page.goto("/#/login");
    for (let i = 0; i < 11; i++) {
      await page.getByLabel(/email/i).fill("test@example.com");
      await page.getByLabel(/password/i).fill(`wrong${i}`);
      await page.getByRole("button", { name: /sign in/i }).click();
    }
    await expect(page.getByText(/too many/i)).toBeVisible();
  });
});
