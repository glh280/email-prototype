import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { dealNotes, users } from "@/db/schema";

/**
 * Phase 2 Plan 06 — notes reader for the detail-page Notes tab (DEAL-04).
 *
 * Returns every note for the deal, newest first. Notes are append-only in
 * Phase 2 per UI-SPEC assumption 4 — no edit/delete surface ships until
 * Carrie requests it during calibration.
 *
 * `is_system = true` rows are rendered with a muted "system" chip next to
 * the author name (see app/deal/[id]/_components/notes-tab.tsx).
 *
 * One SELECT with leftJoin(users) so the authored-by line renders without
 * a second round-trip. Users left-joined (not inner) so a note authored by
 * a later-deleted user still surfaces (user_email on audit_log is the
 * durable identity, but notes don't denormalize — we get `null` here and
 * the UI falls back to "unknown".)
 */

export type NoteListRow = {
  id: string;
  body: string;
  isSystem: boolean;
  createdAt: Date;
  authorName: string | null;
  authorEmail: string | null;
};

export async function queryNotesForDeal(
  dealId: string,
): Promise<NoteListRow[]> {
  const rows = await db
    .select({
      id: dealNotes.id,
      body: dealNotes.body,
      isSystem: dealNotes.isSystem,
      createdAt: dealNotes.createdAt,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(dealNotes)
    .leftJoin(users, eq(users.id, dealNotes.createdBy))
    .where(eq(dealNotes.dealId, dealId))
    .orderBy(desc(dealNotes.createdAt));

  return rows;
}
