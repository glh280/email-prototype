"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { contacts } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/current-user";
import {
  createContactSchema,
  updateContactSchema,
  contactIdSchema,
} from "@/lib/contact-schema";

/**
 * Phase 3 Plan 04 — createContact + updateContact Server Actions (PEOPLE-01).
 *
 * Both actions wrap DML + audit in ONE db.transaction, per the locked D-05
 * atomicity pattern (see app/deal/new/actions.ts::createDeal and
 * app/deal/[id]/actions/deals.ts::updateDeal for canonical shape).
 *
 * Audit source markers (new to the app lexicon in this plan):
 *   - "contact_create" — after_json.source on create
 *   - "contact_update" — after_json.source on update
 * See plan 03-04 §audit_source_vocab for the full list.
 *
 * Dedupe is enforced at the DB level by the partial unique index
 * `contacts_email_unique_idx` on lower(email) WHERE email IS NOT NULL.
 * Postgres returns error code 23505 on violation; we translate to a clean
 * user-facing message without throwing to the caller.
 *
 * updateContact uses the split-parse convention from P2 (contactIdSchema
 * parsed first, updateContactSchema.safeParse(rest)) so .strict() still
 * rejects unknown keys.
 *
 * Empty-diff short-circuit: mirrors P2 updateDeal — if the caller sends no
 * actual changes, return {ok:true, noop:true} without writing an audit row.
 */

type ContactResult =
  | { ok: true; contactId: string; noop?: boolean }
  | { ok: false; errors: Record<string, string[]> }
  | { ok: false; error: string };

export async function createContact(raw: unknown): Promise<ContactResult> {
  const parsed = createContactSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const user = await getCurrentUser();

  // Coerce empty-string email → null so the partial unique index doesn't
  // see empty strings. createContactSchema accepts `z.literal("")` as a
  // convenience for forms; storage layer normalizes to null.
  const input = parsed.data;
  const values = {
    fullName: input.fullName,
    roleHint: input.roleHint ?? null,
    org: input.org ?? null,
    email: input.email && input.email.length > 0 ? input.email : null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
    createdBy: user.id,
  };

  try {
    const contactId = await db.transaction(async (tx) => {
      const [row] = await tx.insert(contacts).values(values).returning();
      await writeAuditLog(tx, {
        tableName: "contacts",
        recordId: row.id,
        operation: "create",
        beforeJson: null,
        afterJson: { ...row, source: "contact_create" },
        user: { id: user.id, email: user.email },
      });
      return row.id;
    });
    revalidatePath("/contacts");
    return { ok: true, contactId };
  } catch (e: unknown) {
    if (isUniqueViolation(e)) {
      return {
        ok: false,
        error: "A contact with this email already exists.",
      };
    }
    throw e;
  }
}

// Drizzle wraps node-postgres errors; the pg error with code/constraint is
// typically accessible via `.cause` on the wrapping error. Unwrap both levels.
function isUniqueViolation(e: unknown): boolean {
  const visit = (err: unknown): boolean => {
    if (!err || typeof err !== "object") return false;
    const code = (err as { code?: string }).code;
    if (code === "23505") return true;
    const cause = (err as { cause?: unknown }).cause;
    return cause ? visit(cause) : false;
  };
  return visit(e);
}

export async function updateContact(raw: unknown): Promise<ContactResult> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid update-contact input." };
  }

  // Split-parse: contactIdSchema first, then updateContactSchema on the rest.
  const { id: rawId, ...rest } = raw as Record<string, unknown>;
  const idParse = contactIdSchema.safeParse({ id: rawId });
  if (!idParse.success) {
    return {
      ok: false,
      errors: idParse.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { id } = idParse.data;

  const diffParse = updateContactSchema.safeParse(rest);
  if (!diffParse.success) {
    return {
      ok: false,
      errors: diffParse.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const [existing] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);
  if (!existing) return { ok: false, error: "Contact not found." };

  // Normalize null/undefined/'' as equivalent for diff computation.
  const normalize = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : v;

  const diff: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(diffParse.data)) {
    if (v === undefined) continue;
    const normV = normalize(v);
    const normExisting = normalize(
      (existing as unknown as Record<string, unknown>)[k],
    );
    if (normV !== normExisting) {
      diff[k] = normV;
    }
  }

  if (Object.keys(diff).length === 0) {
    return { ok: true, contactId: id, noop: true };
  }

  const user = await getCurrentUser();

  try {
    await db.transaction(async (tx) => {
      const [after] = await tx
        .update(contacts)
        .set({ ...diff, updatedAt: new Date() })
        .where(eq(contacts.id, id))
        .returning();
      await writeAuditLog(tx, {
        tableName: "contacts",
        recordId: id,
        operation: "update",
        beforeJson: existing,
        afterJson: { ...after, source: "contact_update" },
        user: { id: user.id, email: user.email },
      });
    });
    revalidatePath("/contacts");
    return { ok: true, contactId: id };
  } catch (e: unknown) {
    if (isUniqueViolation(e)) {
      return {
        ok: false,
        error: "A contact with this email already exists.",
      };
    }
    throw e;
  }
}
