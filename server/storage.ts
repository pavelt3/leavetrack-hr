import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, sql } from "drizzle-orm";
import {
  users, leaveAllowances, leaveRequests, publicHolidays, carryOverLog, auditLog,
  type User, type InsertUser, type LeaveAllowance, type InsertLeaveAllowance,
  type LeaveRequest, type InsertLeaveRequest, type PublicHoliday,
  type InsertPublicHoliday, type CarryOverLog, type InsertCarryOverLog,
  type AuditLogEntry, type InsertAuditLog,
} from "@shared/schema";

// Use DATABASE_PATH env var in production (points to Render persistent disk).
// Falls back to a local file for development.
const DB_PATH = process.env.DATABASE_PATH || "hr_platform.db";
const sqlite = new Database(DB_PATH);
console.log(`[db] Using database at: ${DB_PATH}`);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite);

/** Expose the raw better-sqlite3 instance for use by the session store */
export function getSqliteDb() { return sqlite; }

// ── DB initialisation ────────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    manager_id INTEGER,
    country TEXT NOT NULL DEFAULT 'CZ',
    department TEXT,
    job_title TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    invite_token TEXT,
    invite_expiry TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS leave_allowances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_days REAL NOT NULL DEFAULT 25,
    carried_over_days REAL NOT NULL DEFAULT 0,
    used_days REAL NOT NULL DEFAULT 0,
    pending_days REAL NOT NULL DEFAULT 0,
    UNIQUE(user_id, year)
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    manager_id INTEGER,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days REAL NOT NULL,
    leave_type TEXT NOT NULL DEFAULT 'annual',
    status TEXT NOT NULL DEFAULT 'pending',
    note TEXT,
    manager_note TEXT,
    year INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS public_holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    year INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS carry_over_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    from_year INTEGER NOT NULL,
    to_year INTEGER NOT NULL,
    days REAL NOT NULL,
    applied_at TEXT NOT NULL,
    applied_by INTEGER NOT NULL
  );
`);

// ── Migrations — add columns that may not exist in older DBs ────────────────
try { sqlite.exec(`ALTER TABLE users ADD COLUMN last_login_at TEXT`); } catch (_) { /* already exists */ }
try { sqlite.exec(`ALTER TABLE leave_requests ADD COLUMN half_day INTEGER NOT NULL DEFAULT 0`); } catch (_) { /* already exists */ }
try { sqlite.exec(`ALTER TABLE users ADD COLUMN start_date TEXT`); } catch (_) { /* already exists */ }
// Audit log table (created via CREATE TABLE IF NOT EXISTS above, but add as migration for existing DBs)
try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      actor_id INTEGER,
      actor_name TEXT,
      target_user_id INTEGER,
      target_user_name TEXT,
      event_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      detail TEXT
    )
  `);
} catch (_) { /* already exists */ }

export interface IStorage {
  // Users
  getUserById(id: number): User | undefined;
  getUserByEmail(email: string): User | undefined;
  getUserByInviteToken(token: string): User | undefined;
  getAllUsers(): User[];
  getActiveUsers(): User[];
  createUser(user: Omit<User, "id">): User;
  updateUser(id: number, data: Partial<User>): User | undefined;
  deleteUser(id: number): void;

  // Leave Allowances
  getAllowance(userId: number, year: number): LeaveAllowance | undefined;
  getAllowancesForYear(year: number): LeaveAllowance[];
  getAllowancesForUser(userId: number): LeaveAllowance[];
  createAllowance(data: InsertLeaveAllowance): LeaveAllowance;
  updateAllowance(userId: number, year: number, data: Partial<LeaveAllowance>): LeaveAllowance | undefined;
  ensureAllowance(userId: number, year: number, defaultDays?: number): LeaveAllowance;

  // Leave Requests
  getLeaveRequestById(id: number): LeaveRequest | undefined;
  getLeaveRequestsByUser(userId: number): LeaveRequest[];
  getLeaveRequestsByManager(managerId: number): LeaveRequest[];
  getPendingRequests(): LeaveRequest[];
  getAllLeaveRequests(): LeaveRequest[];
  createLeaveRequest(data: InsertLeaveRequest & { days: number; year: number; managerId?: number }): LeaveRequest;
  updateLeaveRequest(id: number, data: Partial<LeaveRequest>): LeaveRequest | undefined;

  // Public Holidays
  getPublicHolidays(country: string, year: number): PublicHoliday[];
  bulkInsertPublicHolidays(holidays: InsertPublicHoliday[]): void;

  // Carry Over
  applyCarryOver(data: InsertCarryOverLog): CarryOverLog;
  getCarryOverLog(userId: number): CarryOverLog[];

  // Audit Log
  writeAuditLog(entry: InsertAuditLog): AuditLogEntry;
  getAuditLog(limit?: number): AuditLogEntry[];
}

class Storage implements IStorage {
  getUserById(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  getUserByEmail(email: string) {
    return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  }
  getUserByInviteToken(token: string) {
    return db.select().from(users).where(eq(users.inviteToken, token)).get();
  }
  getAllUsers() {
    return db.select().from(users).all();
  }
  getActiveUsers() {
    return db.select().from(users).where(eq(users.isActive, true)).all();
  }
  createUser(user: Omit<User, "id">) {
    return db.insert(users).values(user).returning().get() as User;
  }
  updateUser(id: number, data: Partial<User>) {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  }
  deleteUser(id: number) {
    db.delete(users).where(eq(users.id, id)).run();
  }

  getAllowance(userId: number, year: number) {
    return db.select().from(leaveAllowances)
      .where(and(eq(leaveAllowances.userId, userId), eq(leaveAllowances.year, year))).get();
  }
  getAllowancesForYear(year: number) {
    return db.select().from(leaveAllowances).where(eq(leaveAllowances.year, year)).all();
  }
  getAllowancesForUser(userId: number) {
    return db.select().from(leaveAllowances).where(eq(leaveAllowances.userId, userId)).all();
  }
  createAllowance(data: InsertLeaveAllowance) {
    return db.insert(leaveAllowances).values(data).returning().get() as LeaveAllowance;
  }
  updateAllowance(userId: number, year: number, data: Partial<LeaveAllowance>) {
    // Fetch existing and merge explicitly — never let unspecified fields revert to defaults.
    const existing = this.getAllowance(userId, year);
    if (!existing) return undefined;
    // Only update the four numeric fields; always use existing value as fallback.
    return db.update(leaveAllowances)
      .set({
        totalDays:        data.totalDays        !== undefined ? data.totalDays        : existing.totalDays,
        carriedOverDays:  data.carriedOverDays   !== undefined ? data.carriedOverDays  : existing.carriedOverDays,
        usedDays:         data.usedDays          !== undefined ? data.usedDays         : existing.usedDays,
        pendingDays:      data.pendingDays        !== undefined ? data.pendingDays       : existing.pendingDays,
      })
      .where(and(eq(leaveAllowances.userId, userId), eq(leaveAllowances.year, year)))
      .returning().get();
  }
  ensureAllowance(userId: number, year: number, defaultDays = 25) {
    const existing = this.getAllowance(userId, year);
    if (existing) return existing;
    return this.createAllowance({ userId, year, totalDays: defaultDays, carriedOverDays: 0, usedDays: 0, pendingDays: 0 });
  }

  getLeaveRequestById(id: number) {
    return db.select().from(leaveRequests).where(eq(leaveRequests.id, id)).get();
  }
  getLeaveRequestsByUser(userId: number) {
    return db.select().from(leaveRequests).where(eq(leaveRequests.userId, userId)).all();
  }
  getLeaveRequestsByManager(managerId: number) {
    return db.select().from(leaveRequests).where(eq(leaveRequests.managerId, managerId)).all();
  }
  getPendingRequests() {
    return db.select().from(leaveRequests).where(eq(leaveRequests.status, "pending")).all();
  }
  getAllLeaveRequests() {
    return db.select().from(leaveRequests).all();
  }
  createLeaveRequest(data: InsertLeaveRequest & { days: number; year: number; managerId?: number }) {
    const now = new Date().toISOString();
    return db.insert(leaveRequests).values({ ...data, createdAt: now, updatedAt: now }).returning().get() as LeaveRequest;
  }
  updateLeaveRequest(id: number, data: Partial<LeaveRequest>) {
    return db.update(leaveRequests).set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(leaveRequests.id, id)).returning().get();
  }

  getPublicHolidays(country: string, year: number) {
    return db.select().from(publicHolidays)
      .where(and(eq(publicHolidays.country, country), eq(publicHolidays.year, year))).all();
  }
  bulkInsertPublicHolidays(holidays: InsertPublicHoliday[]) {
    if (!holidays.length) return;
    db.insert(publicHolidays).values(holidays).run();
  }

  applyCarryOver(data: InsertCarryOverLog) {
    return db.insert(carryOverLog).values(data).returning().get() as CarryOverLog;
  }
  getCarryOverLog(userId: number) {
    return db.select().from(carryOverLog).where(eq(carryOverLog.userId, userId)).all();
  }

  writeAuditLog(entry: InsertAuditLog) {
    return db.insert(auditLog).values(entry).returning().get() as AuditLogEntry;
  }
  getAuditLog(limit = 500) {
    return db.select().from(auditLog)
      .orderBy(sql`timestamp DESC`)
      .limit(limit)
      .all() as AuditLogEntry[];
  }
}

export const storage = new Storage();
