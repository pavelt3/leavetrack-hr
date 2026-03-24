import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import session from "express-session";
import fs from "fs";
import path from "path";
import { storage, getSqliteDb } from "./storage";
import { seedHolidays, calcBusinessDays, generateToken, hashPassword, verifyPassword, isLegacyHash } from "./helpers";
import {
  sendInviteEmail,
  sendLeaveRequestEmail,
  sendStatusUpdateEmail,
  sendReminderEmail,
  sendCancellationEmail,
  sendWeeklyDigestEmail,
} from "./email";

// Feature 5: Attachments directory setup
const ATTACHMENTS_DIR = process.env.ATTACHMENTS_DIR || path.join(process.cwd(), "attachments");
fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });

// ── SQLite-backed session store (survives restarts, no extra packages needed) ─
function createSQLiteSessionStore(db: ReturnType<typeof getSqliteDb>): session.Store {
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expired_at INTEGER NOT NULL
  )`);
  // Prune expired sessions on startup
  db.prepare("DELETE FROM sessions WHERE expired_at < ?").run(Date.now());

  class SQLiteStore extends session.Store {
    get(sid: string, cb: (err: any, session?: session.SessionData | null) => void) {
      try {
        const row = db.prepare("SELECT sess, expired_at FROM sessions WHERE sid = ?").get(sid) as any;
        if (!row) return cb(null, null);
        if (Date.now() > row.expired_at) { this.destroy(sid, () => {}); return cb(null, null); }
        cb(null, JSON.parse(row.sess));
      } catch (e) { cb(e); }
    }
    set(sid: string, sess: session.SessionData, cb?: (err?: any) => void) {
      try {
        const maxAge = (sess.cookie?.maxAge ?? 7 * 24 * 60 * 60 * 1000);
        const expiredAt = Date.now() + maxAge;
        db.prepare("INSERT OR REPLACE INTO sessions (sid, sess, expired_at) VALUES (?, ?, ?)")
          .run(sid, JSON.stringify(sess), expiredAt);
        cb?.();
      } catch (e) { cb?.(e); }
    }
    destroy(sid: string, cb?: (err?: any) => void) {
      try { db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid); cb?.(); }
      catch (e) { cb?.(e); }
    }
    touch(sid: string, sess: session.SessionData, cb?: (err?: any) => void) {
      try {
        const maxAge = (sess.cookie?.maxAge ?? 7 * 24 * 60 * 60 * 1000);
        db.prepare("UPDATE sessions SET expired_at = ? WHERE sid = ?").run(Date.now() + maxAge, sid);
        cb?.();
      } catch (e) { cb?.(e); }
    }
  }
  const store = new SQLiteStore();
  // Prune expired sessions every hour
  setInterval(() => {
    try { db.prepare("DELETE FROM sessions WHERE expired_at < ?").run(Date.now()); } catch (_) {}
  }, 3_600_000).unref();
  return store;
}

// ── Simple in-memory login rate limiter ──────────────────────────────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const WINDOW = 15 * 60 * 1000; // 15 min
  const MAX = 10;
  const rec = loginAttempts.get(key);
  if (rec && now < rec.resetAt) {
    if (rec.count >= MAX) return res.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." });
    rec.count++;
  } else {
    loginAttempts.set(key, { count: 1, resetAt: now + WINDOW });
  }
  next();
}

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated" });
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = storage.getUserById(req.session.userId!);
    if (!user || !roles.includes(user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

// ── Audit log helper ───────────────────────────────────────────────────────────────────
function auditLog(opts: {
  actorId?: number | null;
  actorName?: string | null;
  targetUserId?: number | null;
  targetUserName?: string | null;
  eventType: string;
  summary: string;
  detail?: Record<string, any>;
}) {
  try {
    storage.writeAuditLog({
      timestamp: new Date().toISOString(),
      actorId: opts.actorId ?? null,
      actorName: opts.actorName ?? null,
      targetUserId: opts.targetUserId ?? null,
      targetUserName: opts.targetUserName ?? null,
      eventType: opts.eventType,
      summary: opts.summary,
      detail: opts.detail ? JSON.stringify(opts.detail) : null,
    });
  } catch (e) {
    console.error("[audit] Failed to write log:", e);
  }
}

export function registerRoutes(httpServer: Server, app: Express) {
  // ── Security headers ────────────────────────────────────────────────────────
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  // ── Session (SQLite-backed — persists across restarts) ──────────────────────
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret && process.env.NODE_ENV === "production") {
    console.error("[FATAL] SESSION_SECRET env var is not set. Refusing to start in production without it.");
    process.exit(1);
  }
  app.use(
    session({
      secret: sessionSecret ?? "leavetrack_dev_secret_not_for_production",
      resave: false,
      saveUninitialized: false,
      store: createSQLiteSessionStore(getSqliteDb()),
      cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: "lax" },
    }),
  );

  // Seed public holidays on startup
  seedHolidays();

  // ── Auth ────────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", loginRateLimit, (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    const user = storage.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (!user.isActive) return res.status(403).json({ error: "Account is deactivated" });
    // Clear rate-limit counter on success
    loginAttempts.delete(req.ip ?? "unknown");
    // Silently upgrade legacy SHA-256 hash to scrypt on first login
    if (isLegacyHash(user.passwordHash)) {
      storage.updateUser(user.id, { passwordHash: hashPassword(password) });
    }
    req.session.userId = user.id;
    storage.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
    const { passwordHash: _, inviteToken: __, ...safe } = user;
    res.json(safe);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    const user = storage.getUserById(req.session.userId!);
    if (!user) return res.status(401).json({ error: "Not found" });
    const { passwordHash: _, inviteToken: __, ...safe } = user;
    res.json(safe);
  });

  // Change own password
  app.post("/api/auth/change-password", requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = storage.getUserById(req.session.userId!)!;
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    storage.updateUser(user.id, { passwordHash: hashPassword(newPassword) });
    auditLog({ actorId: user.id, actorName: `${user.firstName} ${user.lastName}`, targetUserId: user.id, targetUserName: `${user.firstName} ${user.lastName}`, eventType: "user_updated", summary: `${user.firstName} ${user.lastName} changed their password` });
    res.json({ ok: true });
  });

  // Accept invite + set password
  app.post("/api/auth/accept-invite", (req, res) => {
    const { token, password } = req.body;
    const user = storage.getUserByInviteToken(token);
    if (!user) return res.status(400).json({ error: "Invalid or expired invite" });
    if (user.inviteExpiry && new Date(user.inviteExpiry) < new Date()) {
      return res.status(400).json({ error: "Invite has expired" });
    }
    storage.updateUser(user.id, {
      passwordHash: hashPassword(password),
      inviteToken: null,
      inviteExpiry: null,
    });
    // Ensure allowance for current year
    const year = new Date().getFullYear();
    storage.ensureAllowance(user.id, year);
    auditLog({ actorId: user.id, actorName: `${user.firstName} ${user.lastName}`, targetUserId: user.id, targetUserName: `${user.firstName} ${user.lastName}`, eventType: "user_updated", summary: `${user.firstName} ${user.lastName} accepted invite and set their password` });
    req.session.userId = user.id;
    const { passwordHash: _, inviteToken: __, ...safe } = storage.getUserById(user.id)!;
    res.json(safe);
  });

  // ── Users ───────────────────────────────────────────────────────────────────
  app.get("/api/users", requireAuth, (req, res) => {
    const me = storage.getUserById(req.session.userId!)!;
    const all = storage.getActiveUsers().map(({ passwordHash: _, inviteToken: __, ...u }) => u);
    // Employees only see themselves + their manager; managers see their team; admins see all
    if (me.role === "admin") return res.json(all);
    if (me.role === "manager") {
      const team = all.filter((u) => u.managerId === me.id || u.id === me.id);
      return res.json(team);
    }
    return res.json(all.filter((u) => u.id === me.id || u.id === me.managerId));
  });

  // Basic user list — id/name/country only — accessible to all authenticated users (for calendar)
  app.get("/api/users/basic", requireAuth, (req, res) => {
    const basics = storage.getActiveUsers().map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      country: u.country,
    }));
    res.json(basics);
  });

  app.get("/api/users/all", requireAuth, requireRole("admin", "manager"), (req, res) => {
    const me = storage.getUserById(req.session.userId!)!;
    // Admins get inviteToken so they can copy/share links; managers do not
    // hasPassword = user has a real password set (not just the seeded random one) AND no pending invite token
    const all = storage.getAllUsers().map(({ passwordHash, inviteToken, ...u }) => ({
      ...u,
      inviteToken: me.role === "admin" ? inviteToken : undefined,
      // A user is "set up" if they have accepted their invite (inviteToken is null) AND have a real password
      // We detect seeded/random passwords by checking if the user ever logged in OR if inviteToken is null with no login
      hasPassword: !inviteToken && !!u.lastLoginAt,
    }));
    res.json(all);
  });

  app.post("/api/users/invite", requireAuth, requireRole("admin"), async (req, res) => {
    const { email, firstName, lastName, role, managerId, country, department, jobTitle, totalDays, startDate } = req.body;
    if (storage.getUserByEmail(email)) {
      return res.status(400).json({ error: "Email already exists" });
    }
    const token = generateToken();
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const user = storage.createUser({
      email: email.toLowerCase(),
      passwordHash: hashPassword(Math.random().toString()), // temp
      firstName,
      lastName,
      role: role || "employee",
      managerId: managerId || null,
      country: country || "CZ",
      department: department || null,
      jobTitle: jobTitle || null,
      isActive: true,
      inviteToken: token,
      inviteExpiry: expiry,
      createdAt: new Date().toISOString(),
      startDate: startDate || null,
    });
    // Create allowance for current year
    const year = new Date().getFullYear();
    storage.ensureAllowance(user.id, year, totalDays || 25);
    const inviteActor = storage.getUserById(req.session.userId!)!;
    auditLog({ actorId: inviteActor.id, actorName: `${inviteActor.firstName} ${inviteActor.lastName}`, targetUserId: user.id, targetUserName: `${firstName} ${lastName}`, eventType: "user_created", summary: `${inviteActor.firstName} ${inviteActor.lastName} invited ${firstName} ${lastName} (${email})`, detail: { role: role || "employee", country: country || "CZ", totalDays: totalDays || 25, startDate: startDate || null } });
    try {
      await sendInviteEmail(email, firstName, token);
    } catch (e) {
      console.error("Failed to send invite email:", e);
    }
    const { passwordHash: _, inviteToken: __, ...safe } = user;
    res.json({ ...safe, inviteToken: token }); // return token for copying
  });

  app.put("/api/users/:id", requireAuth, requireRole("admin"), (req, res) => {
    const id = parseInt(req.params.id);
    const { firstName, lastName, role, managerId, country, department, jobTitle, isActive, startDate } = req.body;
    const before = storage.getUserById(id);
    const updated = storage.updateUser(id, { firstName, lastName, role, managerId, country, department, jobTitle, isActive, startDate: startDate || null });
    if (!updated) return res.status(404).json({ error: "User not found" });
    const editActor = storage.getUserById(req.session.userId!)!;
    auditLog({ actorId: editActor.id, actorName: `${editActor.firstName} ${editActor.lastName}`, targetUserId: id, targetUserName: `${updated.firstName} ${updated.lastName}`, eventType: "user_updated", summary: `${editActor.firstName} ${editActor.lastName} updated profile of ${updated.firstName} ${updated.lastName}`, detail: { before: { role: before?.role, country: before?.country, department: before?.department, jobTitle: before?.jobTitle, startDate: before?.startDate }, after: { role, country, department, jobTitle, startDate: startDate || null } } });
    const { passwordHash: _, inviteToken: __, ...safe } = updated;
    res.json(safe);
  });

  app.delete("/api/users/:id", requireAuth, requireRole("admin"), (req, res) => {
    const id = parseInt(req.params.id);
    storage.updateUser(id, { isActive: false });
    res.json({ ok: true });
  });

  // Generate (or regenerate) an invite / password-reset link for any existing user
  app.post("/api/users/:id/resend-invite", requireAuth, requireRole("admin"), async (req, res) => {
    const id = parseInt(req.params.id);
    const user = storage.getUserById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const token = generateToken();
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    storage.updateUser(id, { inviteToken: token, inviteExpiry: expiry });
    try {
      await sendInviteEmail(user.email, user.firstName, token);
    } catch (e) { console.error(e); }
    res.json({ inviteToken: token });
  });

  // Feature 2: Approval delegation — get current delegation
  app.get("/api/users/me/delegation", requireAuth, (req, res) => {
    const me = storage.getUserById(req.session.userId!)!;
    let delegateTo: any = null;
    if (me.delegateApprovalsTo) {
      delegateTo = storage.getUserById(me.delegateApprovalsTo);
      if (delegateTo) {
        const { passwordHash: _, inviteToken: __, ...safe } = delegateTo;
        delegateTo = safe;
      }
    }
    res.json({ delegateTo, delegateUntil: me.delegateUntil });
  });

  // Feature 2: Approval delegation — set or clear delegation
  app.put("/api/users/me/delegation", requireAuth, (req, res) => {
    const { delegateToId, delegateUntil } = req.body;
    const me = storage.getUserById(req.session.userId!)!;
    if (delegateToId && typeof delegateToId === "number") {
      const delegateUser = storage.getUserById(delegateToId);
      if (!delegateUser) return res.status(400).json({ error: "Delegate user not found" });
    }
    storage.updateUser(me.id, {
      delegateApprovalsTo: delegateToId || null,
      delegateUntil: delegateUntil || null,
    });
    const updated = storage.getUserById(me.id)!;
    const { passwordHash: _, inviteToken: __, ...safe } = updated;
    res.json(safe);
  });

  // Feature 4: Employee profile update
  app.put("/api/users/me/profile", requireAuth, (req, res) => {
    const { firstName, lastName, phone, emergencyContact, emergencyContactPhone } = req.body;
    const me = storage.getUserById(req.session.userId!)!;

    const updated = storage.updateUser(me.id, {
      firstName: firstName || me.firstName,
      lastName: lastName || me.lastName,
      phone: phone || null,
      emergencyContact: emergencyContact || null,
      emergencyContactPhone: emergencyContactPhone || null,
    });

    if (!updated) return res.status(404).json({ error: "User not found" });

    const { passwordHash: _, inviteToken: __, ...safe } = updated;
    res.json(safe);
  });

  // ── Leave Allowances ────────────────────────────────────────────────────────

  /**
   * Calculate pro-rata total and accrued days for a given allowance row.
   * Pro-rata: if user has a startDate in the target year, scale totalDays by
   *   fraction of the year remaining from startDate.
   * Accrued: how many of the (pro-rata) total days have theoretically accrued
   *   so far this year (up to today).
   */
  function enrichAllowanceWithProRata(a: any, user: any, year: number): any {
    const today = new Date();
    // Use UTC dates throughout to avoid timezone shifts when parsing ISO date strings.
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const dec31 = new Date(Date.UTC(year, 11, 31));
    const daysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
    const msPerDay = 24 * 60 * 60 * 1000;

    // ── Pro-rata calculation ──────────────────────────────────────────────────
    // If the user has a startDate within this year (and after Jan 1), scale the
    // full entitlement by the fraction of the year they are employed.
    // We keep an exact (unrounded) value for use in the accrual formula and only
    // round the final output field.
    let exactProRata: number = a.totalDays; // exact, unrounded
    let effectiveStartUTC: Date = jan1;     // start of accrual window
    let isProRata = false;

    if (user && user.startDate) {
      // Parse as UTC date (ISO string: "YYYY-MM-DD")
      const sd = new Date(user.startDate + "T00:00:00Z");
      if (sd.getUTCFullYear() === year && sd.getTime() > jan1.getTime()) {
        // Days from startDate (inclusive) to Dec 31 (inclusive)
        const remainingDays = Math.round((dec31.getTime() - sd.getTime()) / msPerDay) + 1;
        exactProRata = a.totalDays * remainingDays / daysInYear;
        effectiveStartUTC = sd;
        isProRata = true;
      }
    }

    const proRataTotalDays = Math.round(exactProRata * 10) / 10;

    // ── Accrual calculation ───────────────────────────────────────────────────
    // Annual leave days accrue linearly from the effective start date to Dec 31.
    // Carried-over days are available in FULL from the effective start (they were
    // earned last year) — they must NOT be multiplied by the accrual fraction.
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const startOfAccrual = effectiveStartUTC.getTime() < jan1.getTime() ? jan1 : effectiveStartUTC;
    const totalAccrualDays = Math.round((dec31.getTime() - startOfAccrual.getTime()) / msPerDay) + 1;
    const cappedToday = todayUTC < startOfAccrual ? startOfAccrual : (todayUTC > dec31 ? dec31 : todayUTC);
    const elapsedAccrualDays = Math.round((cappedToday.getTime() - startOfAccrual.getTime()) / msPerDay) + 1;
    const accrualFraction = totalAccrualDays > 0 ? Math.min(1, elapsedAccrualDays / totalAccrualDays) : 1;

    // Correct formula: carried days available in full; annual days accrue linearly
    const totalAccruedDays = Math.round(((a.carriedOverDays || 0) + exactProRata * accrualFraction) * 10) / 10;
    const accruedRemaining = Math.max(0, Math.round((totalAccruedDays - a.usedDays - a.pendingDays) * 10) / 10);

    return {
      ...a,
      proRataTotalDays,
      isProRata,
      totalAccruedDays,
      accruedRemaining,
    };
  }

  app.get("/api/allowances/me", requireAuth, (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const allowance = storage.ensureAllowance(req.session.userId!, year);
    const user = storage.getUserById(req.session.userId!);
    res.json(enrichAllowanceWithProRata(allowance, user, year));
  });

  app.get("/api/allowances", requireAuth, requireRole("admin", "manager"), (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const me = storage.getUserById(req.session.userId!)!;
    const allowances = storage.getAllowancesForYear(year);
    const users = storage.getActiveUsers();
    // Enrich with user info + pro-rata + accrued
    const enriched = allowances.map((a) => {
      const u = users.find((u) => u.id === a.userId);
      return {
        ...enrichAllowanceWithProRata(a, u, year),
        user: u ? { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, country: u.country, department: u.department } : null,
      };
    }).filter((a) => {
      if (!a.user) return false;
      if (me.role === "admin") return true;
      // manager sees their own team
      const u = users.find((u) => u.id === a.userId);
      return u && (u.managerId === me.id || u.id === me.id);
    });
    res.json(enriched);
  });

  app.put("/api/allowances/:userId/:year", requireAuth, requireRole("admin"), (req, res) => {
    const userId = parseInt(req.params.userId);
    const year = parseInt(req.params.year);
    const { totalDays, carriedOverDays } = req.body;
    const allowance = storage.ensureAllowance(userId, year);
    const updated = storage.updateAllowance(userId, year, {
      totalDays: totalDays !== undefined ? totalDays : allowance.totalDays,
      carriedOverDays: carriedOverDays !== undefined ? carriedOverDays : allowance.carriedOverDays,
    });
    res.json(updated);
  });

  // Manually adjust used/pending days (admin only — for correcting seeded data)
  app.put("/api/allowances/:userId/:year/used", requireAuth, requireRole("admin"), (req, res) => {
    const userId = parseInt(req.params.userId);
    const year = parseInt(req.params.year);
    const { usedDays, pendingDays } = req.body;
    const allowance = storage.ensureAllowance(userId, year);
    const updated = storage.updateAllowance(userId, year, {
      usedDays: usedDays !== undefined ? parseFloat(usedDays) : allowance.usedDays,
      pendingDays: pendingDays !== undefined ? parseFloat(pendingDays) : allowance.pendingDays,
    });
    const overrideActor = storage.getUserById(req.session.userId!)!;
    const overrideTarget = storage.getUserById(userId);
    auditLog({ actorId: overrideActor.id, actorName: `${overrideActor.firstName} ${overrideActor.lastName}`, targetUserId: userId, targetUserName: overrideTarget ? `${overrideTarget.firstName} ${overrideTarget.lastName}` : `User ${userId}`, eventType: "allowance_change", summary: `${overrideActor.firstName} ${overrideActor.lastName} manually adjusted allowance for ${overrideTarget ? `${overrideTarget.firstName} ${overrideTarget.lastName}` : `User ${userId}`} (${year})`, detail: { year, before: { usedDays: allowance.usedDays, pendingDays: allowance.pendingDays }, after: { usedDays: updated?.usedDays, pendingDays: updated?.pendingDays } } });
    res.json(updated);
  });

  // Apply carry-over from previous year
  app.post("/api/allowances/carry-over", requireAuth, requireRole("admin"), (req, res) => {
    const { userId, fromYear, days } = req.body;
    const toYear = fromYear + 1;
    // Ensure target year allowance
    const target = storage.ensureAllowance(userId, toYear);
    storage.updateAllowance(userId, toYear, {
      carriedOverDays: (target.carriedOverDays || 0) + days,
    });
    const log = storage.applyCarryOver({
      userId,
      fromYear,
      toYear,
      days,
      appliedAt: new Date().toISOString(),
      appliedBy: req.session.userId!,
    });
    const coActor = storage.getUserById(req.session.userId!)!;
    const coTarget = storage.getUserById(userId);
    auditLog({ actorId: coActor.id, actorName: `${coActor.firstName} ${coActor.lastName}`, targetUserId: userId, targetUserName: coTarget ? `${coTarget.firstName} ${coTarget.lastName}` : `User ${userId}`, eventType: "carry_over", summary: `${coActor.firstName} ${coActor.lastName} carried over ${days} days for ${coTarget ? `${coTarget.firstName} ${coTarget.lastName}` : `User ${userId}`} from ${fromYear} to ${toYear}`, detail: { fromYear, toYear, days } });
    res.json(log);
  });

  // ── Leave Requests ──────────────────────────────────────────────────────────
  app.get("/api/leave-requests/me", requireAuth, (req, res) => {
    const requests = storage.getLeaveRequestsByUser(req.session.userId!);
    res.json(requests);
  });

  app.get("/api/leave-requests/pending", requireAuth, requireRole("admin", "manager"), (req, res) => {
    const me = storage.getUserById(req.session.userId!)!;
    let pending = storage.getPendingRequests();
    const todayStr = new Date().toISOString().split("T")[0];

    if (me.role === "manager") {
      // Show requests assigned to this manager, plus delegated requests
      const directRequests = pending.filter((r) => r.managerId === me.id);

      // Find all users who delegated to me and whose delegation is still active
      const allUsers = storage.getAllUsers();
      const delegatingUsers = allUsers.filter((u) => u.delegateApprovalsTo === me.id && u.delegateUntil && u.delegateUntil >= todayStr);
      const delegatingManagerIds = delegatingUsers.map((u) => u.id);

      // Add requests from delegating managers
      const delegatedRequests = pending.filter((r) => delegatingManagerIds.includes(r.managerId || -1));

      pending = [...directRequests, ...delegatedRequests];
    }

    // Enrich with user and delegation info
    const users = storage.getActiveUsers();
    const enriched = pending.map((r) => {
      const u = users.find((u) => u.id === r.userId);
      // Check if this request is delegated to me
      const isDelegated = me.role === "manager" && r.managerId && r.managerId !== me.id;
      let delegatedFromUser = null;
      if (isDelegated) {
        const origManager = storage.getUserById(r.managerId);
        delegatedFromUser = origManager ? { firstName: origManager.firstName, lastName: origManager.lastName } : null;
      }
      const result: any = { ...r, employee: u ? { firstName: u.firstName, lastName: u.lastName, email: u.email, country: u.country, department: u.department } : null };
      if (isDelegated) {
        result.isDelegated = true;
        result.delegatedFrom = delegatedFromUser;
      }
      return result;
    });
    res.json(enriched);
  });

  app.get("/api/leave-requests/all", requireAuth, requireRole("admin", "manager"), (req, res) => {
    const me = storage.getUserById(req.session.userId!)!;
    const all = storage.getAllLeaveRequests();
    const activeUsers = storage.getActiveUsers();
    const relevant = me.role === "admin"
      ? all
      : all.filter((r) => r.managerId === me.id || r.userId === me.id);
    const enriched = relevant.map((r) => {
      const u = activeUsers.find((u) => u.id === r.userId);
      return { ...r, employee: u ? { firstName: u.firstName, lastName: u.lastName, email: u.email, country: u.country } : null };
    });
    res.json(enriched);
  });

  app.post("/api/leave-requests", requireAuth, async (req, res) => {
    const { startDate, endDate, leaveType, note, halfDay } = req.body;
    // Server-side past-date guard
    const todayStr = new Date().toISOString().split("T")[0];
    if (startDate < todayStr) return res.status(400).json({ error: "Start date cannot be in the past" });
    const user = storage.getUserById(req.session.userId!)!;
    const year = new Date(startDate).getFullYear();
    // Half-day: force endDate = startDate and days = 0.5
    const effectiveEnd = halfDay ? startDate : endDate;
    const days = calcBusinessDays(startDate, effectiveEnd, user.country, !!halfDay);
    if (days <= 0) return res.status(400).json({ error: "No working days in selected range" });

    const allowance = storage.ensureAllowance(user.id, year);
    // Only annual leave counts against the allowance; sick/unpaid/home-office/other do not
    const countsAgainstAllowance = leaveType === "annual";
    if (countsAgainstAllowance) {
      const enriched = enrichAllowanceWithProRata(allowance, user, year);
      const remaining = enriched.proRataTotalDays + allowance.carriedOverDays - allowance.usedDays - allowance.pendingDays;
      if (days > remaining) {
        return res.status(400).json({ error: `Not enough days remaining. You have ${remaining.toFixed(1)} days left.` });
      }
    }

    // Get manager
    const manager = user.managerId ? storage.getUserById(user.managerId) : null;
    const request = storage.createLeaveRequest({
      userId: user.id,
      startDate,
      endDate: effectiveEnd,
      days,
      leaveType: leaveType || "annual",
      note: note || null,
      managerId: manager?.id || null,
      year,
      halfDay: !!halfDay,
    });

    // Deduct pending days from allowance (annual leave only)
    if (countsAgainstAllowance) {
      storage.updateAllowance(user.id, year, {
        pendingDays: allowance.pendingDays + days,
      });
    }

    // Non-annual leave types auto-approve immediately (sick, home_office, unpaid, other)
    const autoApproveTypes = ["sick", "home_office", "unpaid", "other"];
    if (autoApproveTypes.includes(leaveType)) {
      storage.updateLeaveRequest(request.id, { status: "approved" });
      auditLog({ actorId: user.id, actorName: `${user.firstName} ${user.lastName}`, targetUserId: user.id, targetUserName: `${user.firstName} ${user.lastName}`, eventType: "leave_request", summary: `${user.firstName} ${user.lastName} logged ${leaveType === "home_office" ? "home office" : leaveType} (${halfDay ? "½ day" : `${days} day${days !== 1 ? "s" : ""}`}) — auto-approved`, detail: { leaveType, startDate, endDate: effectiveEnd, days, halfDay: !!halfDay, note: note || null, autoApproved: true } });
      const autoApproved = storage.getLeaveRequestById(request.id)!;
      return res.json(autoApproved);
    }

    // Annual leave — email manager to review
    if (manager) {
      try {
        await sendLeaveRequestEmail(
          manager.email, manager.firstName,
          `${user.firstName} ${user.lastName}`,
          startDate, endDate, days, request.id,
        );
      } catch (e) { console.error(e); }
    }

    auditLog({ actorId: user.id, actorName: `${user.firstName} ${user.lastName}`, targetUserId: user.id, targetUserName: `${user.firstName} ${user.lastName}`, eventType: "leave_request", summary: `${user.firstName} ${user.lastName} submitted ${leaveType} leave request (${halfDay ? "½ day" : `${days} day${days !== 1 ? "s" : ""}`})`, detail: { leaveType, startDate, endDate: effectiveEnd, days, halfDay: !!halfDay, note: note || null } });
    res.json(request);
  });

  // Feature 7: On-behalf leave submission (admin/manager submit for team members)
  app.post("/api/leave-requests/on-behalf", requireAuth, requireRole("admin", "manager"), async (req, res) => {
    const { userId, startDate, endDate, leaveType, note, halfDay } = req.body;
    const me = storage.getUserById(req.session.userId!)!;
    const targetUser = storage.getUserById(userId);

    if (!targetUser) return res.status(400).json({ error: "Target user not found" });

    // Manager can only submit for their direct reports
    if (me.role === "manager" && targetUser.managerId !== me.id) {
      return res.status(403).json({ error: "Can only submit leave for your direct reports" });
    }

    const year = new Date(startDate).getFullYear();
    const effectiveEnd = halfDay ? startDate : endDate;
    const days = calcBusinessDays(startDate, effectiveEnd, targetUser.country, !!halfDay);

    if (days <= 0) return res.status(400).json({ error: "No working days in selected range" });

    // For admin, relax past-date restrictions
    if (me.role === "manager") {
      const todayStr = new Date().toISOString().split("T")[0];
      if (startDate < todayStr) return res.status(400).json({ error: "Start date cannot be in the past" });
    }

    // Check allowance for annual leave
    const allowance = storage.ensureAllowance(targetUser.id, year);
    const countsAgainstAllowance = leaveType === "annual";
    if (countsAgainstAllowance) {
      const enriched = enrichAllowanceWithProRata(allowance, targetUser, year);
      const remaining = enriched.proRataTotalDays + allowance.carriedOverDays - allowance.usedDays - allowance.pendingDays;
      if (days > remaining) {
        return res.status(400).json({ error: `Not enough days remaining for ${targetUser.firstName}` });
      }
    }

    const manager = targetUser.managerId ? storage.getUserById(targetUser.managerId) : null;
    const request = storage.createLeaveRequest({
      userId: targetUser.id,
      startDate,
      endDate: effectiveEnd,
      days,
      leaveType: leaveType || "sick",
      note: note || null,
      managerId: manager?.id || null,
      year,
      halfDay: !!halfDay,
    });

    // Update allowance for annual leave
    if (countsAgainstAllowance) {
      storage.updateAllowance(targetUser.id, year, {
        pendingDays: allowance.pendingDays + days,
      });
    }

    // Auto-approve for admin/manager on-behalf submissions
    storage.updateLeaveRequest(request.id, { status: "approved" });

    if (countsAgainstAllowance) {
      const updatedAllowance = storage.ensureAllowance(targetUser.id, year);
      storage.updateAllowance(targetUser.id, year, {
        usedDays: updatedAllowance.usedDays + days,
        pendingDays: Math.max(0, updatedAllowance.pendingDays - days),
      });
    }

    auditLog({
      actorId: me.id,
      actorName: `${me.firstName} ${me.lastName}`,
      targetUserId: targetUser.id,
      targetUserName: `${targetUser.firstName} ${targetUser.lastName}`,
      eventType: "leave_approved",
      summary: `${me.firstName} ${me.lastName} logged ${leaveType === "home_office" ? "home office" : leaveType} for ${targetUser.firstName} ${targetUser.lastName} on behalf (${halfDay ? "½ day" : `${days} day${days !== 1 ? "s" : ""}`})`,
      detail: { leaveType, startDate, endDate: effectiveEnd, days, halfDay: !!halfDay, note: note || null, onBehalf: true },
    });

    const finalRequest = storage.getLeaveRequestById(request.id)!;
    res.json(finalRequest);
  });

  app.put("/api/leave-requests/:id/decision", requireAuth, requireRole("admin", "manager"), async (req, res) => {
    const id = parseInt(req.params.id);
    const { status, managerNote } = req.body; // approved | rejected
    const request = storage.getLeaveRequestById(id);
    if (!request) return res.status(404).json({ error: "Not found" });
    if (request.status !== "pending") return res.status(400).json({ error: "Already processed" });
    const me = storage.getUserById(req.session.userId!)!;
    const todayStr = new Date().toISOString().split("T")[0];

    // Feature 2: Check if I can approve this request
    let canApprove = me.role === "admin" || request.managerId === me.id;
    if (!canApprove && me.role === "manager" && request.managerId) {
      // Check if the request's manager delegated to me
      const requestManager = storage.getUserById(request.managerId);
      if (requestManager?.delegateApprovalsTo === me.id && requestManager?.delegateUntil && requestManager.delegateUntil >= todayStr) {
        canApprove = true;
      }
    }

    if (!canApprove) {
      return res.status(403).json({ error: "Not your request to approve" });
    }

    const updated = storage.updateLeaveRequest(id, { status, managerNote: managerNote || null });
    const employee = storage.getUserById(request.userId)!;
    const allowance = storage.ensureAllowance(employee.id, request.year);

    // Only adjust allowance for annual leave
    if (request.leaveType === "annual") {
      if (status === "approved") {
        storage.updateAllowance(employee.id, request.year, {
          usedDays: allowance.usedDays + request.days,
          pendingDays: Math.max(0, allowance.pendingDays - request.days),
        });
      } else if (status === "rejected") {
        storage.updateAllowance(employee.id, request.year, {
          pendingDays: Math.max(0, allowance.pendingDays - request.days),
        });
      }
    }
    // Sick/other leave types: no allowance adjustment needed

    auditLog({ actorId: me.id, actorName: `${me.firstName} ${me.lastName}`, targetUserId: employee.id, targetUserName: `${employee.firstName} ${employee.lastName}`, eventType: status === "approved" ? "leave_approved" : "leave_rejected", summary: `${me.firstName} ${me.lastName} ${status} ${request.leaveType === "home_office" ? "home office" : request.leaveType} request for ${employee.firstName} ${employee.lastName} (${request.days} day${request.days !== 1 ? "s" : ""})`, detail: { leaveType: request.leaveType, startDate: request.startDate, endDate: request.endDate, days: request.days, managerNote: managerNote || null } });
    try {
      await sendStatusUpdateEmail(
        employee.email, employee.firstName,
        status as "approved" | "rejected",
        request.startDate, request.endDate, request.days,
        managerNote,
      );
    } catch (e) { console.error(e); }

    res.json(updated);
  });

  app.put("/api/leave-requests/:id/cancel", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const request = storage.getLeaveRequestById(id);
    if (!request) return res.status(404).json({ error: "Not found" });
    if (request.userId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
    const todayStr = new Date().toISOString().split("T")[0];
    const canCancel =
      request.status === "pending" ||
      (request.status === "approved" && request.startDate >= todayStr);
    if (!canCancel) return res.status(400).json({ error: "Cannot cancel leave that has already started or been rejected/cancelled" });

    storage.updateLeaveRequest(id, { status: "cancelled" });
    // Restore allowance counters for annual leave
    if (request.leaveType === "annual") {
      const allowance = storage.ensureAllowance(request.userId, request.year);
      if (request.status === "pending") {
        storage.updateAllowance(request.userId, request.year, {
          pendingDays: Math.max(0, allowance.pendingDays - request.days),
        });
      } else if (request.status === "approved") {
        storage.updateAllowance(request.userId, request.year, {
          usedDays: Math.max(0, allowance.usedDays - request.days),
        });
      }
    }
    const canceller = storage.getUserById(req.session.userId!)!;
    auditLog({ actorId: canceller.id, actorName: `${canceller.firstName} ${canceller.lastName}`, targetUserId: request.userId, targetUserName: `${canceller.firstName} ${canceller.lastName}`, eventType: "leave_cancelled", summary: `${canceller.firstName} ${canceller.lastName} cancelled ${request.leaveType === "home_office" ? "home office" : request.leaveType} request (${request.days} day${request.days !== 1 ? "s" : ""})`, detail: { leaveType: request.leaveType, startDate: request.startDate, endDate: request.endDate, days: request.days } });

    // Feature 6: Send cancellation email to manager for annual leave
    if (request.managerId && request.leaveType === "annual") {
      const mgr = storage.getUserById(request.managerId);
      const emp = storage.getUserById(request.userId)!;
      if (mgr) {
        try {
          await sendCancellationEmail(mgr.email, mgr.firstName, `${emp.firstName} ${emp.lastName}`, request.startDate, request.endDate, request.days);
        } catch (e) {
          console.error(e);
        }
      }
    }

    res.json({ ok: true });
  });

  // ── Test email (admin only — for verifying SMTP config) ───────────────────────
  app.post("/api/email/test", requireAuth, requireRole("admin"), async (req, res) => {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: "Missing 'to' address" });
    try {
      const { sendInviteEmail, resetTransporter } = await import("./email");
      resetTransporter(); // force fresh connection with latest env vars
      await sendInviteEmail(to, "Test", "test-token-do-not-use");
      res.json({ ok: true, message: `Test email dispatched to ${to}` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Reminder emails (can be triggered by admin or via cron) ──────────────────
  app.post("/api/reminders/send", requireAuth, requireRole("admin"), async (req, res) => {
    const pending = storage.getPendingRequests();
    const managerMap: Record<number, number> = {};
    pending.forEach((r) => {
      if (r.managerId) managerMap[r.managerId] = (managerMap[r.managerId] || 0) + 1;
    });
    let sent = 0;
    for (const [mid, count] of Object.entries(managerMap)) {
      const manager = storage.getUserById(parseInt(mid));
      if (manager) {
        try {
          await sendReminderEmail(manager.email, manager.firstName, count);
          sent++;
        } catch (e) { console.error(e); }
      }
    }
    res.json({ sent, pendingCount: pending.length });
  });

  // ── Audit log (admin only) ─────────────────────────────────────────────────────────────────
  app.get("/api/audit-log", requireAuth, requireRole("admin"), (req, res) => {
    const limit = parseInt(req.query.limit as string) || 1000;
    const entries = storage.getAuditLog(limit);
    res.json(entries);
  });

  // Feature 5: Document attachments — upload
  app.post("/api/leave-requests/:id/attachment", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const { fileName, mimeType, dataBase64 } = req.body;
    const request = storage.getLeaveRequestById(id);
    if (!request) return res.status(404).json({ error: "Leave request not found" });

    const me = storage.getUserById(req.session.userId!)!;
    const canUpload = me.id === request.userId || me.role === "admin" || me.role === "manager";
    if (!canUpload) return res.status(403).json({ error: "Forbidden" });

    if (!dataBase64) return res.status(400).json({ error: "Missing dataBase64" });

    // Max 10MB check
    if (dataBase64.length > 14_000_000) {
      return res.status(413).json({ error: "File too large (max 10MB)" });
    }

    // Decode and save
    const buffer = Buffer.from(dataBase64, "base64");
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(ATTACHMENTS_DIR, `${id}_${sanitized}`);

    try {
      fs.writeFileSync(filePath, buffer);
      storage.updateLeaveRequest(id, { attachmentPath: filePath, attachmentName: fileName });
      res.json({ ok: true, fileName });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to save attachment" });
    }
  });

  // Feature 5: Document attachments — download
  app.get("/api/leave-requests/:id/attachment", requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const request = storage.getLeaveRequestById(id);
    if (!request) return res.status(404).json({ error: "Leave request not found" });

    if (!request.attachmentPath || !request.attachmentName) {
      return res.status(404).json({ error: "No attachment" });
    }

    const me = storage.getUserById(req.session.userId!)!;
    const canDownload = me.id === request.userId || me.role === "admin" || me.role === "manager";
    if (!canDownload) return res.status(403).json({ error: "Forbidden" });

    if (!fs.existsSync(request.attachmentPath)) {
      return res.status(404).json({ error: "Attachment file not found" });
    }

    // Detect MIME type from extension
    const ext = path.extname(request.attachmentName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${request.attachmentName}"`);
    try {
      res.send(fs.readFileSync(request.attachmentPath));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to read attachment" });
    }
  });

  // Feature 3: Payroll export (admin/manager only)
  app.get("/api/reports/payroll", requireAuth, requireRole("admin", "manager"), (req, res) => {
    const year = parseInt(req.query.year as string);
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;

    if (!year || isNaN(year)) {
      return res.status(400).json({ error: "Missing or invalid year parameter" });
    }

    const me = storage.getUserById(req.session.userId!)!;
    const allRequests = storage.getAllLeaveRequests();
    let filtered = allRequests.filter((r) => r.status === "approved" && r.year === year);

    if (month && !isNaN(month)) {
      filtered = filtered.filter((r) => {
        const startMonth = new Date(r.startDate).getMonth() + 1;
        const endMonth = new Date(r.endDate).getMonth() + 1;
        return startMonth === month || endMonth === month || (startMonth < month && endMonth > month);
      });
    }

    if (me.role === "manager") {
      // Manager only sees their team
      const teamMembers = storage.getActiveUsers().filter((u) => u.managerId === me.id);
      const teamIds = teamMembers.map((u) => u.id);
      filtered = filtered.filter((r) => teamIds.includes(r.userId));
    }

    const allUsers = storage.getAllUsers();
    const rows = [["Employee Name", "Email", "Country", "Department", "Leave Type", "Start Date", "End Date", "Days", "Status", "Note"]];

    for (const r of filtered) {
      const u = allUsers.find((user) => user.id === r.userId);
      rows.push([
        `${u?.firstName || ""} ${u?.lastName || ""}`,
        u?.email || "",
        u?.country || "",
        u?.department || "",
        r.leaveType,
        r.startDate,
        r.endDate,
        String(r.days),
        r.status,
        r.note || "",
      ]);
    }

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    const filename = month ? `payroll_${year}_${String(month).padStart(2, "0")}.csv` : `payroll_${year}.csv`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  });

  // ── Public Holidays (read-only for front-end) ────────────────────────────────
  app.get("/api/holidays", requireAuth, (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const country = req.query.country as string || "CZ";
    res.json(storage.getPublicHolidays(country, year));
  });

  // Feature 1: Overlap warnings — check for colleagues on leave during requested period
  app.get("/api/leave-requests/overlap", requireAuth, (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: "Missing startDate or endDate" });
    const me = storage.getUserById(req.session.userId!)!;
    const all = storage.getAllLeaveRequests()
      .filter((r) => r.userId !== me.id && (r.status === "approved" || r.status === "pending"));
    const overlapping = all.filter((r) => {
      return r.startDate <= (endDate as string) && r.endDate >= (startDate as string);
    });
    const activeUsers = storage.getActiveUsers();
    const result = overlapping.map((r) => {
      const u = activeUsers.find((user) => user.id === r.userId);
      return {
        firstName: u?.firstName || "Unknown",
        lastName: u?.lastName || "User",
        leaveType: r.leaveType,
        startDate: r.startDate,
        endDate: r.endDate,
      };
    });
    res.json(result);
  });

  // ── Team calendar (all approved + pending leaves) ────────────────────────────
  app.get("/api/calendar", requireAuth, (req, res) => {
    const me = storage.getUserById(req.session.userId!)!;
    const all = storage.getAllLeaveRequests().filter((r) => r.status === "approved" || r.status === "pending");
    const activeUsers = storage.getActiveUsers();
    // All authenticated users see the full team calendar (per requirements)
  const visible = all;
    const enriched = visible.map((r) => {
      const u = activeUsers.find((u) => u.id === r.userId);
      return { ...r, employee: u ? { firstName: u.firstName, lastName: u.lastName } : null };
    });
    res.json(enriched);
  });

  // ── Seed: Lucent Renewables team ─────────────────────────────────────────────
  const oldAdmin = storage.getUserByEmail("admin@company.com");
  if (oldAdmin) { storage.updateUser(oldAdmin.id, { isActive: false }); }

  const year = new Date().getFullYear();

  // Helper: create user if not exists, return their id
  // IMPORTANT: only sets allowance data on first creation — never overwrites existing data
  function seedUser(data: {
    email: string; firstName: string; lastName: string;
    role: "admin" | "manager" | "employee";
    country: string; department?: string; jobTitle?: string;
    totalDays?: number; carriedOver?: number; usedDays?: number; pendingDays?: number;
  }): number {
    let u = storage.getUserByEmail(data.email);
    const isNew = !u;
    if (!u) {
      u = storage.createUser({
        email: data.email,
        passwordHash: hashPassword(generateToken()), // random — user must set via invite
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        managerId: null, // set in second pass
        country: data.country,
        department: data.department || null,
        jobTitle: data.jobTitle || null,
        isActive: true,
        inviteToken: null,
        inviteExpiry: null,
        createdAt: new Date().toISOString(),
      });
      console.log(`[init] Seeded: ${data.email}`);
    }
    // Only set allowance values for brand-new users — never overwrite live data
    if (isNew) {
      storage.ensureAllowance(u.id, year, data.totalDays ?? 25);
      if (data.carriedOver || data.usedDays || data.pendingDays) {
        storage.updateAllowance(u.id, year, {
          totalDays: data.totalDays ?? 25,
          carriedOverDays: data.carriedOver ?? 0,
          usedDays: data.usedDays ?? 0,
          pendingDays: data.pendingDays ?? 0,
        });
      }
    } else {
      // For existing users, only ensure the allowance row exists (don't touch the numbers)
      storage.ensureAllowance(u.id, year, data.totalDays ?? 25);
    }
    return u.id;
  }

  // Pass 1 — create all users (managerId handled in pass 2)
  // Pavel Tyle (admin)
  const pavelId = seedUser({ email: "ptyle@lucentrenewables.com", firstName: "Pavel", lastName: "Tyle", role: "admin", country: "CZ", department: "Management", jobTitle: "Managing Director", usedDays: 5 });
  // On a fresh install (no login yet), set admin password from env var.
  // Never hardcode credentials in source — set ADMIN_INITIAL_PASSWORD in Render env vars.
  const pavelUser = storage.getUserById(pavelId)!;
  if (!pavelUser.lastLoginAt) {
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
    if (initialPassword) {
      storage.updateUser(pavelId, { passwordHash: hashPassword(initialPassword) });
      console.log("[init] Admin password set from ADMIN_INITIAL_PASSWORD env var.");
    } else {
      // Generate a one-time password and print it — admin must change on first login
      const oneTime = generateToken().slice(0, 16);
      storage.updateUser(pavelId, { passwordHash: hashPassword(oneTime) });
      console.warn(`[init] ⚠️  No ADMIN_INITIAL_PASSWORD set. One-time admin password: ${oneTime}`);
      console.warn("[init] ⚠️  Change this password immediately after first login.");
    }
  }
  // Charles Thomson — manager, CZ
  const charlesId = seedUser({ email: "cthomson@lucentrenewables.com", firstName: "Charles", lastName: "Thomson", role: "manager", country: "CZ", department: "Operations", jobTitle: "Operations Manager", usedDays: 5 });
  // Karen Biesuz — manager, Monaco
  const karenId = seedUser({ email: "kbiesuz@lucentrenewables.com", firstName: "Karen", lastName: "Biesuz", role: "manager", country: "MC", department: "Finance", jobTitle: "Finance Manager", usedDays: 5 });
  // Tomáš Ondráček — employee, CZ, 2 carried over, 5 used
  const tomasId = seedUser({ email: "tondracek@lucentrenewables.com", firstName: "Tomáš", lastName: "Ondráček", role: "employee", country: "CZ", department: "Operations", jobTitle: "Operations Analyst", carriedOver: 2, usedDays: 5 });
  // Patrycja Porysiak — employee, Poland
  const patrycjaId = seedUser({ email: "pporysiak@lucentrenewables.com", firstName: "Patrycja", lastName: "Porysiak", role: "employee", country: "PL", department: "Finance", jobTitle: "Financial Analyst" });
  // Piotr Śledziński — employee, Poland, 5 carried over, 12 used, 3 pending
  const piotrId = seedUser({ email: "psledzinski@lucentrenewables.com", firstName: "Piotr", lastName: "Śledziński", role: "employee", country: "PL", department: "Finance", jobTitle: "Finance Specialist", totalDays: 25, carriedOver: 5, usedDays: 12, pendingDays: 3 });
  // Marco Tirb — employee, Romania
  const marcoId = seedUser({ email: "mtirb@lucentrenewables.com", firstName: "Marco", lastName: "Tirb", role: "employee", country: "RO", department: "Operations", jobTitle: "Project Manager", usedDays: 5 });

  // Pass 2 — set manager relationships + fix any stale data
  storage.updateUser(charlesId, { managerId: pavelId });
  // Ensure Marco's country is RO (corrected from MC)
  storage.updateUser(marcoId, { country: "RO" });
  storage.updateUser(karenId, { managerId: pavelId });
  storage.updateUser(tomasId, { managerId: pavelId });
  storage.updateUser(patrycjaId, { managerId: karenId });
  storage.updateUser(piotrId, { managerId: karenId });
  storage.updateUser(marcoId, { managerId: charlesId });

  console.log("[init] Team seed complete");

  // Feature 6: Weekly digest scheduler — runs every 24h, sends on Mondays
  function scheduleWeeklyDigest() {
    setInterval(async () => {
      const now = new Date();
      if (now.getDay() !== 1) return; // Monday only
      const todayStr = now.toISOString().split("T")[0];
      const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const allLeave = storage.getAllLeaveRequests().filter((r) => r.status === "approved" && r.startDate >= todayStr && r.startDate <= in14);
      const activeUsers = storage.getActiveUsers();

      // Group by manager
      const managerMap = new Map<number, typeof allLeave>();
      allLeave.forEach((r) => {
        if (r.managerId) {
          if (!managerMap.has(r.managerId)) managerMap.set(r.managerId, []);
          managerMap.get(r.managerId)!.push(r);
        }
      });

      for (const [managerId, leaves] of managerMap) {
        const mgr = storage.getUserById(managerId);
        if (!mgr) continue;
        const upcoming = leaves.map((r) => {
          const u = activeUsers.find((u) => u.id === r.userId);
          return {
            name: u ? `${u.firstName} ${u.lastName}` : `User ${r.userId}`,
            leaveType: r.leaveType,
            startDate: r.startDate,
            endDate: r.endDate,
            days: r.days,
          };
        });
        try {
          await sendWeeklyDigestEmail(mgr.email, mgr.firstName, upcoming);
        } catch (e) {
          console.error(e);
        }
      }
    }, 24 * 60 * 60 * 1000).unref();
  }
  scheduleWeeklyDigest();
}
