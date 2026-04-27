import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts, dealPeople, deals } from "@/db/schema";
import type { Contact } from "@/db/schema";

/**
 * Phase 3 Plan 03 — read-only contact queries.
 *
 * Serves:
 *   - VIEW-06 (/contacts page list + search + activeDealsCount)
 *   - PEOPLE-03 (role-slot autosuggest combobox on deal-detail File Contacts tab)
 *   - PEOPLE-04 (per-contact lookup by id; used by Plan 06 UI)
 *
 * Pure queries — no mutations, no audit writes. Plan 04 owns createContact /
 * upsertDealPerson / removeDealPerson. This module mirrors the P1 `lib/deals-query.ts`
 * shape (CTE + leftJoin + sql`coalesce(...)::int` for derived columns).
 *
 * IMPORTANT: canonical `@/lib/db` client per D-04. Never import `@/db/client`.
 */

/** Row returned by {@link queryContactsForList}. */
export type ContactListRow = {
  id: string;
  fullName: string;
  roleHint: string | null;
  org: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: Date;
  activeDealsCount: number;
};

/** Row returned by {@link queryContactsAutosuggest} — cheaper than the full list row. */
export type ContactAutosuggestRow = {
  id: string;
  fullName: string;
  email: string | null;
  org: string | null;
};

/**
 * VIEW-06: every contact + an active-deals count for the /contacts page.
 *
 * `activeDealsCount` = number of DISTINCT deal_people rows with
 * `contact_id = contacts.id` whose deal has `status = 'active'`. Closed AND
 * killed deals are excluded — PEOPLE-04 semantics ("deals they're currently on").
 *
 * When `q` is provided: case-insensitive ILIKE on full_name OR email OR org.
 * When `q` is omitted/empty: all contacts.
 *
 * Order: lower(full_name) ASC in both modes (stable alphabetical).
 */
export async function queryContactsForList(
  q?: string,
): Promise<ContactListRow[]> {
  // CTE: per-contact count of DISTINCT active deal ids.
  const activeCount = db.$with("contact_active_deals").as(
    db
      .select({
        contactId: dealPeople.contactId,
        cnt: sql<number>`count(distinct ${dealPeople.dealId})::int`.as("cnt"),
      })
      .from(dealPeople)
      .innerJoin(deals, eq(deals.id, dealPeople.dealId))
      .where(eq(deals.status, "active"))
      .groupBy(dealPeople.contactId),
  );

  const trimmed = q?.trim() ?? "";
  const whereExpr =
    trimmed.length > 0
      ? or(
          ilike(contacts.fullName, `%${trimmed}%`),
          ilike(contacts.email, `%${trimmed}%`),
          ilike(contacts.org, `%${trimmed}%`),
        )
      : undefined;

  const rows = await db
    .with(activeCount)
    .select({
      id: contacts.id,
      fullName: contacts.fullName,
      roleHint: contacts.roleHint,
      org: contacts.org,
      email: contacts.email,
      phone: contacts.phone,
      notes: contacts.notes,
      createdAt: contacts.createdAt,
      activeDealsCount: sql<number>`coalesce(${activeCount.cnt}, 0)::int`,
    })
    .from(contacts)
    .leftJoin(activeCount, eq(activeCount.contactId, contacts.id))
    .where(whereExpr ?? sql`true`)
    .orderBy(sql`lower(${contacts.fullName}) asc`);

  return rows;
}

/**
 * PEOPLE-03: cheap autosuggest for the role-slot combobox.
 *
 * Guards against returning the full contact table when the input is empty.
 * Ranks: exact case-insensitive match (0) > prefix (1) > substring (2), then
 * alphabetical. LIMIT clamped server-side to [1, 20] regardless of caller.
 */
export async function queryContactsAutosuggest(
  q: string,
  limit: number,
): Promise<ContactAutosuggestRow[]> {
  const trimmed = q.trim();
  if (trimmed.length === 0) return [];

  // Clamp to [1, 20] — never return an unbounded slice even if caller asks.
  const cappedLimit = Math.min(Math.max(limit, 1), 20);
  const pattern = `%${trimmed}%`;
  const prefix = `${trimmed}%`;

  const rows = await db
    .select({
      id: contacts.id,
      fullName: contacts.fullName,
      email: contacts.email,
      org: contacts.org,
    })
    .from(contacts)
    .where(
      or(
        ilike(contacts.fullName, pattern),
        ilike(contacts.email, pattern),
        ilike(contacts.org, pattern),
      ),
    )
    .orderBy(
      sql`case
        when lower(${contacts.fullName}) = lower(${trimmed}) then 0
        when ${contacts.fullName} ilike ${prefix} then 1
        else 2
      end`,
      sql`lower(${contacts.fullName}) asc`,
    )
    .limit(cappedLimit);

  return rows;
}

/**
 * PEOPLE-04 primary key read. Returns null when no row matches.
 *
 * Used by Plan 06 (File Contacts tab) to display the full contact card when
 * a slot is filled via FK.
 */
export async function queryContactById(id: string): Promise<Contact | null> {
  const [row] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);
  return row ?? null;
}
