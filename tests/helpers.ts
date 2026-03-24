import { Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "ptyle@lucentrenewables.com";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
export const MANAGER_EMAIL = process.env.MANAGER_EMAIL || "cthomson@lucentrenewables.com";
export const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD || "";
export const EMPLOYEE_EMAIL = process.env.EMPLOYEE_EMAIL || "tondracek@lucentrenewables.com";
export const EMPLOYEE_PASSWORD = process.env.EMPLOYEE_PASSWORD || "";

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/#/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/#(?!.*login)/);
}

export async function loginAsAdmin(page: Page) {
  return loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
}

export async function loginAsManager(page: Page) {
  return loginAs(page, MANAGER_EMAIL, MANAGER_PASSWORD);
}

export async function loginAsEmployee(page: Page) {
  return loginAs(page, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD);
}

/** Format a date offset from today as YYYY-MM-DD */
export function futureDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}
