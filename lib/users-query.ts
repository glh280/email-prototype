import { asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";

/**
 * Phase 2 Plan 06 — users reader for the task owner-select dropdown.
 *
 * Carrie's portal is internal-only with ≤50 users per AUDIT.md scope doc —
 * no pagination. One SELECT ordered by name (NULLS LAST per Postgres
 * convention) then email so the dropdown sorts predictably when Cloudflare
 * Access hasn't populated a display name yet.
 */

export type UserOption = {
  id: string;
  name: string | null;
  email: string;
};

export async function listUsers(): Promise<UserOption[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .orderBy(sql`${users.name} ASC NULLS LAST`, asc(users.email));

  return rows;
}
