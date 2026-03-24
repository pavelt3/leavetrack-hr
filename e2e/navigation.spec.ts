/**
 * navigation.spec.ts
 * Smoke test — visit every page and confirm no blank page / crash.
 */
import { test, expect } from "@playwright/test";

test.use({ storageState: ".auth/admin.json" });

const PAGES = [
  { name: "Dashboard",      path: "/#/",            heading: /good (morning|afternoon|evening)/i },
  { name: "Request Leave",  path: "/#/request",     heading: /Request Leave/i },
  { name: "My Requests",    path: "/#/my-requests", heading: /My Requests/i },
  { name: "Approvals",      path: "/#/approvals",   heading: /Pending Approvals/i },
  { name: "Team Overview",  path: "/#/team",        heading: /Team Overview/i },
  { name: "Team Calendar",  path: "/#/calendar",    heading: /Team Calendar/i },
  { name: "People",         path: "/#/people",      heading: /People/i },
  { name: "Audit Log",      path: "/#/audit",       heading: /Audit Log/i },
  { name: "Settings",       path: "/#/settings",    heading: /Settings/i },
];

for (const { name, path, heading } of PAGES) {
  test(`${name} — loads without crash`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("h1").filter({ hasText: heading })).toBeVisible({ timeout: 12_000 });
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();
  });
}

test("unknown route shows 404 page not blank", async ({ page }) => {
  await page.goto("/#/this-route-does-not-exist");
  // Should show some kind of not-found content rather than blank
  const body = await page.locator("body").textContent();
  expect(body?.trim().length).toBeGreaterThan(50);
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
});
