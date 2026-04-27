/**
 * createDealCore — request-free core of `createDeal`.
 *
 * Extracted from `app/deal/new/actions.ts` so non-request callers (scripts,
 * seed/import jobs, future admin tooling) can create deals without a
 * Cloudflare Access JWT cookie or a Next.js request context.
 *
 * What stays in the server-action wrapper (`app/deal/new/actions.ts`):
 *   - `"use server"` directive + exported `createDeal(raw)` that does:
 *     Zod parse → getCurrentUser() → createDealCore → revalidatePath/redirect.
 *   - The redirect-throws-a-special-error behavior (per Next.js 16's
 *     `node_modules/next/dist/docs/01-app/02-guides/redirecting.md`).
 *
 * What moves here (this file):
 *   - The entire `db.transaction` body from actions.ts lines 73–222.
 *   - Pre-validated `CreateDealInput` in, `{ fileNo, dealId }` out.
 *   - User identity passed in explicitly (`{ id, email }`), not fetched.
 *
 * Behavioral guarantees — verbatim preserved from the wrapper:
 *   1. Track lookup by code; throws if unknown.
 *   2. Default stage lookup (`pre_screen_qualification`, track_id NULL); throws
 *      if not seeded.
 *   3. `generateFileNo(tx, propertyState)` for atomic file_no generation.
 *   4. INSERT into `deals` with all P1/P2/P3 fields.
 *   5. Audit row for the deal (operation: 'create').
 *   6. P3 Plan 07 dual-write: if mainContactEmail present and non-empty,
 *      upsert contact by lower(email) (pre-read-then-insert), link via
 *      deal_people (role: 'main_contact'), and audit BOTH the contact
 *      create and the deal_people insert with source markers:
 *        - contact_create_via_new_deal
 *        - deal_people_upsert_via_new_deal
 *   7. Transaction wraps all of it — any failure rolls back the deal too
 *      (proven by tests/unit/create-deal-people-dual-write.test.ts Test 4).
 *
 * Caller responsibilities (that this function does NOT do):
 *   - Zod validation of raw input (wrapper calls createDealSchema.safeParse)
 *   - Authentication / authorization (wrapper calls getCurrentUser)
 *   - Cache revalidation (wrapper calls revalidatePath)
 *   - Navigation (wrapper calls redirect)
 *
 * Why `{ id, email }` instead of full User:
 *   The only fields consumed by the transaction body are user.id (for the
 *   createdBy + internalOwner FKs) and user.email (stamped on audit rows).
 *   Passing the minimum keeps the seam narrow; non-request callers can
 *   synthesize a "system" user without faking a whole JWT payload.
 */
import { eq, and, isNull, sql } from "drizzle-orm";
import { generateFileNo, type AppTx } from "@/lib/file-no";
import { writeAuditLog } from "@/lib/audit";
import type { CreateDealInput } from "@/lib/deal-schema";
import { tracks, stages, deals, contacts, dealPeople } from "@/db/schema";
import { db } from "@/lib/db";

export interface DealCoreUser {
  /** User row primary key — used as createdBy + internalOwner FK. */
  id: string;
  /** User email — stamped on audit rows only (no auth semantics here). */
  email: string;
}

export interface CreateDealCoreResult {
  fileNo: string;
  dealId: string;
}

/**
 * Runs the deal-creation transaction.
 *
 * @param input - pre-validated deal input (wrapper ran Zod already)
 * @param user  - identity for createdBy + audit stamping
 * @returns `{ fileNo, dealId }` on success
 * @throws on any transaction error — entire tx rolls back
 */
export async function createDealCore(
  input: CreateDealInput,
  user: DealCoreUser,
): Promise<CreateDealCoreResult> {
  return db.transaction(async (tx: AppTx) => {
    const [track] = await tx
      .select()
      .from(tracks)
      .where(eq(tracks.code, input.trackCode))
      .limit(1);
    if (!track) {
      throw new Error(`Unknown track code: ${input.trackCode}`);
    }

    const [defaultStage] = await tx
      .select()
      .from(stages)
      .where(
        and(eq(stages.code, "pre_screen_qualification"), isNull(stages.trackId)),
      )
      .limit(1);
    if (!defaultStage) {
      throw new Error(
        "Default stage 'pre_screen_qualification' not seeded — run `npm run db:seed`.",
      );
    }

    // DEAL-02a — atomic file_no inside this tx (Postgres sequence)
    const fileNo = await generateFileNo(tx, input.propertyState ?? null);

    const [newDeal] = await tx
      .insert(deals)
      .values({
        trackId: track.id,
        stageId: defaultStage.id,
        fileNo,
        title: input.title,
        priority: input.priority,
        status: "active",
        mainContactName: input.mainContactName ?? null,
        // Coerce empty-string email to null (schema allows z.literal(""))
        mainContactEmail: input.mainContactEmail
          ? input.mainContactEmail
          : null,
        propertyAddress: input.propertyAddress ?? null,
        propertyState: input.propertyState ?? null,
        propertyType: input.propertyType ?? null,
        salesPrice: input.salesPrice ?? null,
        loanType: input.loanType ?? null,
        transactionType: input.transactionType ?? null,
        loanAmount: input.loanAmount ?? null,
        estimatedDown: input.estimatedDown ?? null,
        earnestMoney: input.earnestMoney ?? null,
        estRehab: input.estRehab ?? null,
        arv: input.arv ?? null,
        closingAt: input.closingAt ?? null,
        fundingAt: input.fundingAt ?? null,
        titleCtc: input.titleCtc,
        lenderCtc: input.lenderCtc,
        createdBy: user.id,
        internalOwner: user.id, // D-18: defaults to created_by on insert
      })
      .returning();

    // D-05: audit the create inside the same transaction
    await writeAuditLog(tx, {
      tableName: "deals",
      recordId: newDeal.id,
      operation: "create",
      beforeJson: null,
      afterJson: newDeal,
      user: { id: user.id, email: user.email },
    });

    // P3 Plan 07 — dual-write deal_people for main_contact (if email provided).
    // Email is the dedupe key. Empty string or missing → skip; name-only with
    // no email would pollute contacts without a stable identity key.
    const emailCandidate = (input.mainContactEmail ?? "").trim();
    if (emailCandidate.length > 0) {
      const emailLower = emailCandidate.toLowerCase();
      const nameCandidate = (input.mainContactName ?? "").trim();
      const fullName =
        nameCandidate.length > 0 ? nameCandidate : emailLower.split("@")[0];

      // Upsert contact by lower(email). Drizzle's onConflictDoUpdate requires
      // a column reference (not a functional-index expression) for target, and
      // the partial unique index contacts_email_unique_idx is on
      // lower(email) WHERE email IS NOT NULL — a functional expression that
      // can't be referenced via drizzle's .onConflict API. So we do a
      // pre-read: if a contact with lower(email) match exists, reuse its id;
      // otherwise INSERT. The pre-read lives inside the tx so concurrent
      // creates are rare — and if two createDeal calls race with the same
      // novel email, the second would hit the partial unique index and raise
      // 23505, rolling back this tx (acceptable: the user retries and gets
      // the other's contact on the second attempt).
      const [existingContact] = await tx
        .select()
        .from(contacts)
        .where(sql`lower(${contacts.email}) = ${emailLower}`)
        .limit(1);

      let contactRow: typeof contacts.$inferSelect;
      if (existingContact) {
        contactRow = existingContact;
      } else {
        const [inserted] = await tx
          .insert(contacts)
          .values({
            fullName,
            email: emailLower,
            roleHint: "main_contact",
            createdBy: user.id,
          })
          .returning();
        contactRow = inserted;
      }

      await writeAuditLog(tx, {
        tableName: "contacts",
        recordId: contactRow.id,
        operation: "create",
        beforeJson: null,
        afterJson: { ...contactRow, source: "contact_create_via_new_deal" },
        user: { id: user.id, email: user.email },
      });

      // Link the deal via deal_people. Unique (deal_id, role) guarantees one
      // row per slot per deal — this is a fresh deal so we always INSERT
      // (no prior main_contact row could exist yet for this new deal id).
      const [dealPersonRow] = await tx
        .insert(dealPeople)
        .values({
          dealId: newDeal.id,
          contactId: contactRow.id,
          role: "main_contact",
          createdBy: user.id,
        })
        .returning();

      await writeAuditLog(tx, {
        tableName: "deal_people",
        recordId: dealPersonRow.id,
        operation: "create",
        beforeJson: null,
        afterJson: {
          ...dealPersonRow,
          source: "deal_people_upsert_via_new_deal",
        },
        user: { id: user.id, email: user.email },
      });
    }

    return { fileNo: newDeal.fileNo, dealId: newDeal.id };
  });
}
