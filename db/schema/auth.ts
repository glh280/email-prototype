import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { deals } from "./app";

/**
 * Users.
 *
 * Source of truth is Cloudflare Access — this row is an app-side cache for FK joins
 * and attribution ({@link ./../lib/users.ts::upsertUserFromAccess} writes on first
 * request after Access verifies a JWT).
 *
 * Auth.js-specific columns (email_verified) removed in Phase 0.5 Task A3.
 * Auth.js-specific tables (accounts, sessions, verification_tokens) dropped in
 * the accompanying migration.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * NPI access audit log.
 *
 * Every call to `lib/crypto.ts::decrypt()` inserts a row here recording who
 * decrypted what NPI field for which deal/contact, and when. The audit is
 * non-skippable — the decrypt function always writes before returning
 * plaintext. Unit tests enforce that invariant.
 *
 * This is Layer 2 of the three-layer audit model (see AUDIT.md §1 + §8).
 * Authoritative for GLBA when combined with `change_history` (Layer 1).
 *
 * Phase 1 (D-04a): `dealId` now has a FK to `deals.id` — the dangling reference
 * from P0.5 is closed. Lazy `() => deals.id` form avoids circular-import issues
 * with `./app`.
 */
export const npiAccessLog = pgTable(
  "npi_access_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userEmail: text("user_email").notNull(),
    dealId: uuid("deal_id").references(() => deals.id),
    contactId: uuid("contact_id"),
    /** e.g. "contacts.ssn", "contacts.dob" — dot-separated table.column */
    fieldAccessed: text("field_accessed").notNull(),
    accessedAt: timestamp("accessed_at", { withTimezone: true }).defaultNow().notNull(),
    /** Optional — captured when the UI surfaces a "why are you decrypting this" prompt */
    purpose: text("purpose"),
  },
  (t) => ({
    byUser: index("npi_access_log_user_email_idx").on(t.userEmail, t.accessedAt),
    byDeal: index("npi_access_log_deal_id_idx").on(t.dealId, t.accessedAt),
    byContact: index("npi_access_log_contact_id_idx").on(t.contactId, t.accessedAt),
  }),
);

export type NpiAccessLogRow = typeof npiAccessLog.$inferSelect;
export type NewNpiAccessLogRow = typeof npiAccessLog.$inferInsert;
