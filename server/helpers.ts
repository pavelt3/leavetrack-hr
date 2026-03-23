import { storage } from "./storage";
import type { PublicHoliday } from "@shared/schema";

// Seed built-in public holidays for CZ, PL, MC for 2024-2027
const HOLIDAYS: { date: string; name: string; country: string }[] = [
  // Czech Republic
  { date: "2026-01-01", name: "Nový rok", country: "CZ" },
  { date: "2026-04-03", name: "Velký pátek", country: "CZ" },
  { date: "2026-04-06", name: "Velikonoční pondělí", country: "CZ" },
  { date: "2026-05-01", name: "Svátek práce", country: "CZ" },
  { date: "2026-05-08", name: "Den vítězství", country: "CZ" },
  { date: "2026-07-05", name: "Den Cyrila a Metoděje", country: "CZ" },
  { date: "2026-07-06", name: "Den upálení Jana Husa", country: "CZ" },
  { date: "2026-09-28", name: "Den české státnosti", country: "CZ" },
  { date: "2026-10-28", name: "Den vzniku Československa", country: "CZ" },
  { date: "2026-11-17", name: "Den boje za svobodu", country: "CZ" },
  { date: "2026-12-24", name: "Štědrý den", country: "CZ" },
  { date: "2026-12-25", name: "1. svátek vánoční", country: "CZ" },
  { date: "2026-12-26", name: "2. svátek vánoční", country: "CZ" },
  // Poland
  { date: "2026-01-01", name: "Nowy Rok", country: "PL" },
  { date: "2026-01-06", name: "Trzech Króli", country: "PL" },
  { date: "2026-04-05", name: "Niedziela Wielkanocna", country: "PL" },
  { date: "2026-04-06", name: "Poniedziałek Wielkanocny", country: "PL" },
  { date: "2026-05-01", name: "Święto Pracy", country: "PL" },
  { date: "2026-05-03", name: "Święto Konstytucji", country: "PL" },
  { date: "2026-05-24", name: "Zesłanie Ducha Świętego", country: "PL" },
  { date: "2026-06-04", name: "Boże Ciało", country: "PL" },
  { date: "2026-08-15", name: "Wniebowzięcie NMP", country: "PL" },
  { date: "2026-11-01", name: "Wszystkich Świętych", country: "PL" },
  { date: "2026-11-11", name: "Święto Niepodległości", country: "PL" },
  { date: "2026-12-25", name: "Boże Narodzenie", country: "PL" },
  { date: "2026-12-26", name: "Drugi dzień Bożego Narodzenia", country: "PL" },
  // Monaco
  { date: "2026-01-01", name: "Jour de l'An", country: "MC" },
  { date: "2026-01-27", name: "Fête de Sainte Dévote", country: "MC" },
  { date: "2026-04-06", name: "Lundi de Pâques", country: "MC" },
  { date: "2026-05-01", name: "Fête du Travail", country: "MC" },
  { date: "2026-05-14", name: "Ascension", country: "MC" },
  { date: "2026-05-25", name: "Lundi de Pentecôte", country: "MC" },
  { date: "2026-06-04", name: "Fête-Dieu", country: "MC" },
  { date: "2026-08-15", name: "Assomption", country: "MC" },
  { date: "2026-11-01", name: "Toussaint", country: "MC" },
  { date: "2026-11-19", name: "Fête Nationale", country: "MC" },
  { date: "2026-12-08", name: "Immaculée Conception", country: "MC" },
  { date: "2026-12-25", name: "Noël", country: "MC" },
];

export function seedHolidays() {
  for (const year of [2025, 2026, 2027]) {
    for (const h of HOLIDAYS) {
      const date = h.date.replace("2026", String(year));
      const existing = storage.getPublicHolidays(h.country, year);
      if (existing.some((e) => e.date === date)) continue;
      storage.bulkInsertPublicHolidays([{ date, name: h.name, country: h.country, year }]);
    }
  }
}

// Calculate business days between two dates (inclusive), excluding weekends and public holidays.
// If halfDay=true, the result is always 0.5 (single-day half-day request).
export function calcBusinessDays(
  startDate: string,
  endDate: string,
  country: string,
  halfDay?: boolean,
): number {
  if (halfDay) return 0.5;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const year = start.getFullYear();
  const holidays = new Set(
    storage.getPublicHolidays(country, year).map((h) => h.date),
  );
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    const iso = cur.toISOString().split("T")[0];
    if (dow !== 0 && dow !== 6 && !holidays.has(iso)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

import crypto from "crypto";

export function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// ── Password hashing (scrypt with per-user salt) ──────────────────────────────
// Format stored in DB: "scrypt:<salt_hex>:<hash_hex>"
// Legacy SHA-256 format (no prefix) is still accepted for migration purposes —
// on first successful login the hash is silently upgraded to scrypt.

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p,
  }).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith("scrypt:")) {
    // New format: "scrypt:<salt>:<hash>"
    const parts = stored.split(":");
    if (parts.length !== 3) return false;
    const [, salt, expectedHash] = parts;
    const derived = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
      N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p,
    }).toString("hex");
    // Constant-time compare to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(expectedHash, "hex"));
  }
  // Legacy SHA-256 format — compare and signal caller to upgrade
  const legacy = crypto.createHash("sha256").update(password + "leavetrack_salt_2026").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(legacy, "hex"), Buffer.from(stored, "hex"));
  } catch {
    return false;
  }
}

/** Returns true if this hash is in the old SHA-256 format and should be upgraded */
export function isLegacyHash(stored: string): boolean {
  return !stored.startsWith("scrypt:");
}
