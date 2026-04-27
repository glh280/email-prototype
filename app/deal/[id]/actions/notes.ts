"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { dealNotes } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/current-user";
import { createNoteSchema } from "@/lib/note-schema";

/**
 * Phase 2 Plan 06 — createNote Server Action (DEAL-04 Notes tab).
 *
 * Notes are append-only in P2 (UI-SPEC assumption 4). One insert + one
 * audit row wrapped in a single `db.transaction` per D-05 — if the audit
 * write throws, the note insert rolls back too. Mirrors the P1 Plan 05
 * createDeal atomicity pattern and P2 Plan 04 killDeal compound-mutation
 * rollback invariant (Test 9 there).
 *
 * Returns a discriminated union:
 *   - {ok:true, noteId} — insert + audit committed
 *   - {ok:false, errors} — Zod validation failure (RHF can show per-field
 *     error messages, though in P2 the notes composer is a single textarea
 *     so only `body` can fail)
 *   - {ok:false, error} — runtime error (DB failure, unexpected)
 *
 * Revalidates /deal/[id] (the Notes tab re-fetches) and / (list view —
 * the per-deal activity timestamp refreshes via the audit_log MAX CTE).
 */

export type CreateNoteResult =
  | { ok: true; noteId: string }
  | { ok: false; errors: Record<string, string[]> }
  | { ok: false; error: string };

export async function createNote(
  raw: unknown,
): Promise<CreateNoteResult> {
  const parsed = createNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const input = parsed.data;

  const user = await getCurrentUser();

  try {
    const noteId = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(dealNotes)
        .values({
          dealId: input.dealId,
          body: input.body,
          isSystem: false,
          createdBy: user.id,
        })
        .returning();

      await writeAuditLog(tx, {
        tableName: "deal_notes",
        recordId: row.id,
        operation: "create",
        beforeJson: null,
        afterJson: { ...row, source: "user_action" },
        user: { id: user.id, email: user.email },
      });

      return row.id;
    });

    revalidatePath(`/deal/[id]`, "page");
    revalidatePath("/");

    return { ok: true, noteId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
