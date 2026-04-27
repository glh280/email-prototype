import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts, dealPeople } from "@/db/schema";

/**
 * Phase 3 Plan 03 — read-only per-deal people/slot query.
 *
 * Consumed by:
 *   - Plan 06 deal-detail File Contacts tab (VIEW-05 integration)
 *   - Future email-template plans that resolve "the directing agent" etc.
 *
 * One SELECT with leftJoin(contacts) so the consumer renders slot rows in a
 * single round-trip. Left join (not inner) because `contact_id` is nullable
 * — the schema SET NULLs it when a contact row is deleted, preserving the
 * deal_people row as an audit trail of "a contact once occupied this slot."
 *
 * ORDER BY role ASC gives deterministic output for diffing + audit display.
 * UI (Plan 06) reorders visually per role-slot registry ordering; DB-level
 * sort is strictly for stability.
 *
 * IMPORTANT: canonical `@/lib/db` client per D-04. Never import `@/db/client`.
 */

export type DealPersonRow = {
  id: string;
  dealId: string;
  role: string;
  contactId: string | null;
  contactFullName: string | null;
  contactEmail: string | null;
  contactOrg: string | null;
  createdAt: Date;
};

export async function queryDealPeopleForDeal(
  dealId: string,
): Promise<DealPersonRow[]> {
  return await db
    .select({
      id: dealPeople.id,
      dealId: dealPeople.dealId,
      role: dealPeople.role,
      contactId: dealPeople.contactId,
      contactFullName: contacts.fullName,
      contactEmail: contacts.email,
      contactOrg: contacts.org,
      createdAt: dealPeople.createdAt,
    })
    .from(dealPeople)
    .leftJoin(contacts, eq(contacts.id, dealPeople.contactId))
    .where(eq(dealPeople.dealId, dealId))
    .orderBy(asc(dealPeople.role));
}
