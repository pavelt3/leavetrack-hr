import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Users ────────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role", { enum: ["admin", "manager", "employee"] }).notNull().default("employee"),
  managerId: integer("manager_id"), // nullable — references users(id)
  country: text("country").notNull().default("CZ"), // CZ, PL, MC
  department: text("department"),
  jobTitle: text("job_title"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  inviteToken: text("invite_token"), // pending invite
  inviteExpiry: text("invite_expiry"), // ISO date
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  lastLoginAt: text("last_login_at"), // ISO datetime of last successful login
  startDate: text("start_date"), // employment start date YYYY-MM-DD (for pro-rata)
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, passwordHash: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ── Leave Allowances ─────────────────────────────────────────────────────────
export const leaveAllowances = sqliteTable("leave_allowances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  year: integer("year").notNull(),
  totalDays: real("total_days").notNull().default(25),        // annual entitlement
  carriedOverDays: real("carried_over_days").notNull().default(0), // from previous year
  usedDays: real("used_days").notNull().default(0),           // approved + taken
  pendingDays: real("pending_days").notNull().default(0),     // awaiting approval
});

export const insertLeaveAllowanceSchema = createInsertSchema(leaveAllowances).omit({ id: true });
export type InsertLeaveAllowance = z.infer<typeof insertLeaveAllowanceSchema>;
export type LeaveAllowance = typeof leaveAllowances.$inferSelect;

// ── Leave Requests ───────────────────────────────────────────────────────────
export const leaveRequests = sqliteTable("leave_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  managerId: integer("manager_id"),               // who will approve/reject
  startDate: text("start_date").notNull(),        // ISO date YYYY-MM-DD
  endDate: text("end_date").notNull(),
  days: real("days").notNull(),                    // business days calculated
  leaveType: text("leave_type", {
    enum: ["annual", "sick", "unpaid", "home_office", "other"],
  }).notNull().default("annual"),
  halfDay: integer("half_day", { mode: "boolean" }).notNull().default(false),
  status: text("status", {
    enum: ["pending", "approved", "rejected", "cancelled"],
  }).notNull().default("pending"),
  note: text("note"),                             // employee note
  managerNote: text("manager_note"),              // manager's response note
  year: integer("year").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  id: true, createdAt: true, updatedAt: true, managerId: true, year: true, days: true, status: true,
});
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type LeaveRequest = typeof leaveRequests.$inferSelect;

// ── Public Holidays (per country) ────────────────────────────────────────────
export const publicHolidays = sqliteTable("public_holidays", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),   // YYYY-MM-DD
  name: text("name").notNull(),
  country: text("country").notNull(), // CZ, PL, MC
  year: integer("year").notNull(),
});

export const insertPublicHolidaySchema = createInsertSchema(publicHolidays).omit({ id: true });
export type InsertPublicHoliday = z.infer<typeof insertPublicHolidaySchema>;
export type PublicHoliday = typeof publicHolidays.$inferSelect;

// ── Carry-Over Log ────────────────────────────────────────────────────────────
export const carryOverLog = sqliteTable("carry_over_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  fromYear: integer("from_year").notNull(),
  toYear: integer("to_year").notNull(),
  days: real("days").notNull(),
  appliedAt: text("applied_at").notNull(),
  appliedBy: integer("applied_by").notNull(), // admin user id
});

export const insertCarryOverLogSchema = createInsertSchema(carryOverLog).omit({ id: true });
export type InsertCarryOverLog = z.infer<typeof insertCarryOverLogSchema>;
export type CarryOverLog = typeof carryOverLog.$inferSelect;

// ── Audit Log ────────────────────────────────────────────────────────────────────────────
// event_type values: leave_request | leave_approved | leave_rejected | leave_cancelled |
//                    allowance_change | user_created | user_updated | carry_over | login
export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: text("timestamp").notNull(),          // ISO datetime
  actorId: integer("actor_id"),                    // user who performed the action (null = system)
  actorName: text("actor_name"),                   // snapshot: "Pavel Tyle"
  targetUserId: integer("target_user_id"),         // user the action is about
  targetUserName: text("target_user_name"),        // snapshot: "Marco Tirb"
  eventType: text("event_type").notNull(),         // see above
  summary: text("summary").notNull(),              // short human-readable description
  detail: text("detail"),                          // JSON string with before/after or extra context
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLogEntry = typeof auditLog.$inferSelect;
