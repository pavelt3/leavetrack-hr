/**
 * API-level smoke tests using fetch (no browser UI).
 * These test all endpoints directly and are faster than UI tests.
 *
 * Run:
 *   ADMIN_EMAIL=ptyle@lucentrenewables.com ADMIN_PASSWORD=<pw> npx playwright test api-smoke
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "https://leavetrack-hr.onrender.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "ptyle@lucentrenewables.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

// Shared cookie jar for session
let sessionCookie = "";

async function apiLogin(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get("set-cookie") || "";
  const match = setCookie.match(/connect\.sid=[^;]+/);
  return match ? match[0] : "";
}

async function api(method: string, path: string, body?: any, cookie?: string) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test.describe("API Smoke Tests", () => {
  test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD not set — skip API tests");

  test.beforeAll(async () => {
    sessionCookie = await apiLogin(ADMIN_EMAIL, ADMIN_PASSWORD);
    expect(sessionCookie).toBeTruthy();
  });

  // ── Auth ──────────────────────────────────────────────────────────────────
  test("GET /api/auth/me returns current user", async () => {
    const res = await api("GET", "/api/auth/me", undefined, sessionCookie);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe(ADMIN_EMAIL);
    expect(data.role).toBe("admin");
    expect(data.passwordHash).toBeUndefined(); // must not leak password hash
    expect(data.inviteToken).toBeUndefined();
  });

  test("GET /api/auth/me returns 401 without auth", async () => {
    const res = await api("GET", "/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("POST /api/auth/login rejects wrong password", async () => {
    const res = await api("POST", "/api/auth/login", { email: ADMIN_EMAIL, password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  // ── Users ─────────────────────────────────────────────────────────────────
  test("GET /api/users returns user list for admin", async () => {
    const res = await api("GET", "/api/users", undefined, sessionCookie);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    // Check no sensitive fields
    data.forEach((u: any) => {
      expect(u.passwordHash).toBeUndefined();
    });
  });

  test("GET /api/users/basic returns minimal user info", async () => {
    const res = await api("GET", "/api/users/basic", undefined, sessionCookie);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    // Each entry has only id, firstName, lastName, country
    data.forEach((u: any) => {
      expect(u.id).toBeDefined();
      expect(u.firstName).toBeDefined();
      expect(u.email).toBeUndefined(); // email not in basic
    });
  });

  test("GET /api/users/all requires manager+ role", async () => {
    const res = await api("GET", "/api/users/all", undefined, sessionCookie);
    expect(res.status).toBe(200);
  });

  // ── Allowances ────────────────────────────────────────────────────────────
  test("GET /api/allowances/me returns allowance for current year", async () => {
    const year = new Date().getFullYear();
    const res = await api("GET", `/api/allowances/me?year=${year}`, undefined, sessionCookie);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalDays).toBeDefined();
    expect(data.usedDays).toBeDefined();
    expect(data.proRataTotalDays).toBeDefined();
    expect(data.totalAccruedDays).toBeDefined();
  });

  test("GET /api/allowances returns team allowances for admin", async () => {
    const year = new Date().getFullYear();
    const res = await api("GET", `/api/allowances?year=${year}`, undefined, sessionCookie);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  // ── Leave Requests ────────────────────────────────────────────────────────
  test("GET /api/leave-requests/me returns array", async () => {
    const res = await api("GET", "/api/leave-requests/me", undefined, sessionCookie);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("GET /api/leave-requests/pending returns admin's pending queue", async () => {
    const res = await api("GET", "/api/leave-requests/pending", undefined, sessionCookie);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    data.forEach((r: any) => {
      expect(r.status).toBe("pending");
      expect(r.employee).toBeDefined();
    });
  });

  test("GET /api/leave-requests/overlap requires dates", async () => {
    const res = await api("GET", "/api/leave-requests/overlap", undefined, sessionCookie);
    expect(res.status).toBe(400);
  });

  test("GET /api/leave-requests/overlap returns array for valid dates", async () => {
    const start = new Date();
    start.setDate(start.getDate() + 10);
    const end = new Date(start);
    end.setDate(end.getDate() + 5);
    const s = start.toISOString().split("T")[0];
    const e = end.toISOString().split("T")[0];
    const res = await api("GET", `/api/leave-requests/overlap?startDate=${s}&endDate=${e}`, undefined, sessionCookie);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("POST /api/leave-requests rejects past dates", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];
    const res = await api("POST", "/api/leave-requests", {
      startDate: dateStr,
      endDate: dateStr,
      leaveType: "annual",
      halfDay: false,
    }, sessionCookie);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/past/i);
  });

  // ── Calendar ──────────────────────────────────────────────────────────────
  test("GET /api/calendar returns leave entries", async () => {
    const res = await api("GET", "/api/calendar", undefined, sessionCookie);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  // ── Holidays ──────────────────────────────────────────────────────────────
  test("GET /api/holidays returns CZ holidays", async () => {
    const year = new Date().getFullYear();
    const res = await api("GET", `/api/holidays?year=${year}&country=CZ`, undefined, sessionCookie);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    data.forEach((h: any) => {
      expect(h.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(h.name).toBeDefined();
    });
  });

  test("GET /api/holidays returns PL holidays", async () => {
    const year = new Date().getFullYear();
    const res = await api("GET", `/api/holidays?year=${year}&country=PL`, undefined, sessionCookie);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);
  });

  // ── Audit Log ─────────────────────────────────────────────────────────────
  test("GET /api/audit-log returns entries for admin", async () => {
    const res = await api("GET", "/api/audit-log", undefined, sessionCookie);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  // ── Payroll Export ────────────────────────────────────────────────────────
  test("GET /api/reports/payroll returns CSV", async () => {
    const year = new Date().getFullYear();
    const res = await api("GET", `/api/reports/payroll?year=${year}`, undefined, sessionCookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const csv = await res.text();
    expect(csv).toContain("Employee Name");
  });

  test("GET /api/reports/payroll rejects missing year", async () => {
    const res = await api("GET", "/api/reports/payroll", undefined, sessionCookie);
    expect(res.status).toBe(400);
  });

  // ── Delegation ────────────────────────────────────────────────────────────
  test("GET /api/users/me/delegation returns delegation info", async () => {
    const res = await api("GET", "/api/users/me/delegation", undefined, sessionCookie);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("delegateTo");
    expect(data).toHaveProperty("delegateUntil");
  });

  // ── Security ─────────────────────────────────────────────────────────────
  test("unauthenticated requests to protected endpoints return 401", async () => {
    const endpoints = [
      "/api/users",
      "/api/allowances/me",
      "/api/leave-requests/me",
      "/api/calendar",
      "/api/audit-log",
    ];
    for (const endpoint of endpoints) {
      const res = await fetch(`${BASE}${endpoint}`);
      expect(res.status, `${endpoint} should return 401`).toBe(401);
    }
  });

  test("admin-only endpoints blocked for unauthenticated users", async () => {
    const res = await api("GET", "/api/audit-log");
    expect(res.status).toBe(401);
  });

  test("security headers are present", async () => {
    const res = await fetch(`${BASE}/api/auth/me`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });
});
