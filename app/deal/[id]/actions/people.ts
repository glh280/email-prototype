"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { deals, tracks, dealPeople, contacts } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/current-user";
import {
  upsertDealPersonSchema,
  removeDealPersonSchema,
} from "@/lib/contact-schema";
import { isRoleValidForTrack, ROLE_SLOTS } from "@/lib/role-slots";

/**
 * Phase 3 Plan 04 — upsertDealPerson + removeDealPerson Server Actions.
 *
 * PEOPLE-02 + PEOPLE-05 write path for the per-deal File Contacts tab.
 *
 * Atomicity contract (D-05): DML + audit in ONE db.transaction. The
 * rollback-invariant test (Test 8) proves audit-failure rolls back the
 * deal_people INSERT/UPDATE — the same P2 pattern from stages.ts.
 *
 * PEOPLE-05 enforcement sits at the APPLICATION layer, BEFORE the tx:
 *   1. Zod validates shape + role membership (unknown role → errors)
 *   2. We read the deal's trackCode (tracks join)
 *   3. isRoleValidForTrack(role, trackCode) gates the whole operation
 * Only after that gate passes do we open the transaction. Running the
 * gate before the tx keeps the error path clean (no wasted BEGIN/ROLLBACK)
 * and makes the error shape stable (test 3 asserts exact message shape).
 *
 * Per-slot `source` branching:
 *   - "contact_fk": require contactId (validated before tx)
 *   - "free_text" (lender_partner only): require freeTextValue; we then
 *     INSERT a minimal contact row (full_name=freeTextValue, role_hint='lender')
 *     inside the tx and wire the deal_people row to it. This keeps the
 *     deal_people shape uniform — every row has a contact_id FK.
 *
 * UPSERT semantics via drizzle .onConflictDoUpdate() on the existing
 * `deal_people_one_per_slot_idx (deal_id, role)` — same (deal_id, role)
 * twice produces ONE row (update), not two. The DB unique index is the
 * safety net; this action layer is the well-behaved first line of defense.
 *
 * Audit source markers (new to the app lexicon in this plan):
 *   - after_json.source = "deal_people_upsert" on INSERT or UPDATE
 *   - after_json.source = "deal_people_remove" on DELETE
 * The `operation` column (create/update/delete) distinguishes INSERT from
 * UPDATE for the upsert case — a pre-read determines operation value.
 *
 * Free-text branch also writes a "contact_create" audit row (the minimal
 * contact is a real registry row with its own audit trail).
 *
 * revalidatePath uses the Next.js 16 dynamic-route signature
 * revalidatePath("/deal/[id]", "page") — see revalidatePath.md.
 */

type DealPersonResult =
  | { ok: true; dealPersonId: string; noop?: boolean }
  | { ok: false; errors: Record<string, string[]> }
  | { ok: false; error: string };

export async function upsertDealPerson(
  raw: unknown,
): Promise<DealPersonResult> {
  const parsed = upsertDealPersonSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { dealId, role, contactId, freeTextValue } = parsed.data;

  // Read deal + trackCode OUTSIDE tx — clean error path.
  const [dealRow] = await db
    .select({ id: deals.id, trackCode: tracks.code })
    .from(deals)
    .innerJoin(tracks, eq(tracks.id, deals.trackId))
    .where(eq(deals.id, dealId))
    .limit(1);
  if (!dealRow) return { ok: false, error: "Deal not found." };

  // PEOPLE-05 gate — BEFORE writing. Exact error shape is asserted by
  // Phase 3 Success Criterion 3 (test 3 matches /not valid for {track}/).
  if (!isRoleValidForTrack(role, dealRow.trackCode)) {
    return {
      ok: false,
      error: `Role "${role}" is not valid for ${dealRow.trackCode} deals.`,
    };
  }

  const slot = ROLE_SLOTS.find((s) => s.code === role);
  if (!slot) {
    // Belt + suspenders — Zod enum should already reject this.
    return { ok: false, error: `Unknown role "${role}".` };
  }

  // Resolve contactId strategy based on slot source.
  let resolvedContactId: string | null = null;
  if (slot.source === "free_text") {
    const v = (freeTextValue ?? "").trim();
    if (v.length === 0) {
      return {
        ok: false,
        errors: { freeTextValue: ["Lender name is required."] },
      };
    }
  } else {
    if (!contactId) {
      return {
        ok: false,
        errors: { contactId: ["Pick a contact or create a new one."] },
      };
    }
    resolvedContactId = contactId;
  }

  const user = await getCurrentUser();

  const resultId = await db.transaction(async (tx) => {
    // Free-text branch: synthesize a minimal contact row inside the tx so
    // the create + wire + audit are all-or-nothing.
    if (slot.source === "free_text") {
      const [inserted] = await tx
        .insert(contacts)
        .values({
          fullName: (freeTextValue as string).trim(),
          roleHint: "lender",
          createdBy: user.id,
        })
        .returning();
      resolvedContactId = inserted.id;
      await writeAuditLog(tx, {
        tableName: "contacts",
        recordId: inserted.id,
        operation: "create",
        beforeJson: null,
        afterJson: { ...inserted, source: "contact_create" },
        user: { id: user.id, email: user.email },
      });
    }

    // Pre-read to determine create-vs-update for the audit operation column.
    const [existing] = await tx
      .select()
      .from(dealPeople)
      .where(
        and(eq(dealPeople.dealId, dealId), eq(dealPeople.role, role)),
      )
      .limit(1);
    const operation: "create" | "update" = existing ? "update" : "create";

    const [after] = await tx
      .insert(dealPeople)
      .values({
        dealId,
        role,
        contactId: resolvedContactId,
        createdBy: user.id,
      })
      .onConflictDoUpdate({
        target: [dealPeople.dealId, dealPeople.role],
        set: { contactId: resolvedContactId },
      })
      .returning();

    await writeAuditLog(tx, {
      tableName: "deal_people",
      recordId: after.id,
      operation,
      beforeJson: existing ?? null,
      afterJson: { ...after, source: "deal_people_upsert" },
      user: { id: user.id, email: user.email },
    });

    return after.id;
  });

  revalidatePath("/deal/[id]", "page");
  return { ok: true, dealPersonId: resultId };
}

export async function removeDealPerson(
  raw: unknown,
): Promise<DealPersonResult> {
  const parsed = removeDealPersonSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { dealId, role } = parsed.data;

  // Pre-read: if the slot is already empty, this is a no-op (idempotent).
  const [existing] = await db
    .select()
    .from(dealPeople)
    .where(and(eq(dealPeople.dealId, dealId), eq(dealPeople.role, role)))
    .limit(1);
  if (!existing) {
    return { ok: true, dealPersonId: "", noop: true };
  }

  const user = await getCurrentUser();

  await db.transaction(async (tx) => {
    await tx.delete(dealPeople).where(eq(dealPeople.id, existing.id));
    await writeAuditLog(tx, {
      tableName: "deal_people",
      recordId: existing.id,
      operation: "delete",
      beforeJson: existing,
      afterJson: { source: "deal_people_remove" },
      user: { id: user.id, email: user.email },
    });
  });

  revalidatePath("/deal/[id]", "page");
  return { ok: true, dealPersonId: existing.id };
}
