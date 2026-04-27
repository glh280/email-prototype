"use server";

import { revalidatePath } from "next/cache";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  deals,
  dealNotes,
  stages,
  type Deal,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/current-user";
import {
  updateDealSchema,
  killDealSchema,
  type UpdateDealInput,
} from "@/lib/deal-schema";
import { z } from "zod";

/**
 * Phase 2 Plan 04 — deal update/close/kill server actions (DEAL-05 / DEAL-06).
 *
 * All three wrap mutation + audit in ONE `db.transaction` per the locked D-05
 * pattern (see `app/deal/new/actions.ts` for the canonical shape). If the
 * audit write fails, every preceding DML in the tx rolls back — proven by
 * Plan 04 Task 1 Test 9 (kill-rollback invariant).
 *
 * Separation of concerns:
 *   - updateDeal: arbitrary column edits from the Overview tab (DEAL-05).
 *     Rejects trying to set status='killed' (killDeal owns that transition,
 *     because UI-SPEC requires a reason note).
 *   - closeDeal: benign terminal transition — status='closed', stage =
 *     'file_completed' universal stage, closedAt=now(). No reason required.
 *   - killDeal: destructive terminal transition — status='killed', stage =
 *     'killed' universal stage, killedAt+closedAt+killReason set, PLUS a
 *     system note in `deal_notes` mirroring the reason (UI-SPEC lines 596-601:
 *     "Reason also added as a note row in deal_notes with is_system = true").
 *
 * All three revalidate both `/deal/[id]` (page, dynamic — requires type='page'
 * per Next.js 16 revalidatePath.md) and `/` (list view).
 */

// updateDeal accepts `{ dealId, ...diff }` — dealId is not part of
// updateDealSchema (updateDealSchema is the editable-field surface, not the
// DB-id boundary). We split the parse into two steps so `.strict()` on
// updateDealSchema still rejects unknown keys (z.intersection/.and() does
// NOT propagate strict-mode unknown-key rejection — the two sub-schemas
// each see the full object and would complain about each other's fields).
const dealIdSchema = z.object({ dealId: z.string().uuid() });

export type UpdateDealResult =
  | { ok: true; noop?: boolean }
  | { ok: false; error: string };

export type CloseDealResult =
  | { ok: true }
  | { ok: false; error: string };

export type KillDealResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * updateDeal — DEAL-05 Overview-tab edit.
 *
 * Accepts any subset of updateDealSchema fields. Rejects unknown keys via
 * `.strict()` on the schema itself. Empty diff short-circuits with noop=true
 * and writes NO audit row (noise-reduction — Carrie saving an untouched form
 * shouldn't pollute the Audit tab).
 */
export async function updateDeal(
  raw: unknown,
): Promise<UpdateDealResult> {
  // Step 1: extract dealId
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid update-deal input." };
  }
  const { dealId: rawDealId, ...rest } = raw as Record<string, unknown>;
  const idParsed = dealIdSchema.safeParse({ dealId: rawDealId });
  if (!idParsed.success) {
    return { ok: false, error: "Invalid update-deal input." };
  }
  const dealId = idParsed.data.dealId;

  // Step 2: validate remaining fields against updateDealSchema (`.strict()`
  // rejects unknown keys like `fileNo` — DEAL-02a immutable).
  const diffParsed = updateDealSchema.safeParse(rest);
  if (!diffParsed.success) {
    return { ok: false, error: "Invalid update-deal input." };
  }
  const rawDiff: UpdateDealInput = diffParsed.data;

  // Strip undefined keys — Zod may leave them on the object; the DB UPDATE
  // should only touch fields the caller actually sent.
  const diff: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawDiff)) {
    if (v !== undefined) diff[k] = v;
  }

  if (Object.keys(diff).length === 0) {
    return { ok: true, noop: true };
  }

  const user = await getCurrentUser();

  try {
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(deals)
        .where(eq(deals.id, dealId))
        .limit(1);
      if (!before) {
        throw new Error(`Deal not found: ${dealId}`);
      }

      const [after] = await tx
        .update(deals)
        .set({ ...diff, updatedAt: new Date() })
        .where(eq(deals.id, dealId))
        .returning();

      await writeAuditLog(tx, {
        tableName: "deals",
        recordId: dealId,
        operation: "update",
        beforeJson: before,
        afterJson: after,
        user: { id: user.id, email: user.email },
      });
    });

    revalidatePath(`/deal/[id]`, "page");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// closeDeal takes only a dealId — status/stage transitions are fixed.
const closeDealSchema = z.object({ dealId: z.string().uuid() });

/**
 * closeDeal — benign terminal transition. UI-SPEC lines 604-618: no reason
 * textarea, AlertDialog default variant.
 */
export async function closeDeal(
  raw: unknown,
): Promise<CloseDealResult> {
  const parsed = closeDealSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid close-deal input." };
  }
  const { dealId } = parsed.data;

  const user = await getCurrentUser();

  try {
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(deals)
        .where(eq(deals.id, dealId))
        .limit(1);
      if (!before) {
        throw new Error(`Deal not found: ${dealId}`);
      }
      if (before.status === "closed") {
        throw new Error("Deal is already closed.");
      }
      if (before.status === "killed") {
        throw new Error("Cannot close a killed deal.");
      }

      // Resolve 'file_completed' universal stage id inside the tx
      const [fileCompleted] = await tx
        .select()
        .from(stages)
        .where(
          and(eq(stages.code, "file_completed"), isNull(stages.trackId)),
        )
        .limit(1);
      if (!fileCompleted) {
        throw new Error(
          "Universal stage 'file_completed' not seeded — run npm run db:seed.",
        );
      }

      const now = new Date();
      const [after] = await tx
        .update(deals)
        .set({
          status: "closed",
          stageId: fileCompleted.id,
          closedAt: now,
          updatedAt: now,
        })
        .where(eq(deals.id, dealId))
        .returning();

      await writeAuditLog(tx, {
        tableName: "deals",
        recordId: dealId,
        operation: "update",
        beforeJson: before,
        afterJson: { ...after, source: "manual_close" } as Deal & { source: string },
        user: { id: user.id, email: user.email },
      });
    });

    revalidatePath(`/deal/[id]`, "page");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * killDeal — DEAL-06 destructive terminal transition.
 *
 * One tx contains FOUR writes:
 *   (a) UPDATE deals SET status='killed', stage=killed, killedAt+closedAt+killReason
 *   (b) INSERT deal_notes (is_system=true, body=reason)
 *   (c) writeAuditLog for deals.update (before/after snapshot)
 *   (d) writeAuditLog for deal_notes.create (afterJson = new note row)
 *
 * If ANY step throws, Postgres rolls back all three (Plan 04 Task 1 Test 9
 * proves this with a mocked audit-throw). This is the D-05 atomicity guarantee
 * as applied to a multi-row mutation.
 *
 * Idempotency: rejects with ok:false if deal.status === 'killed' already, so
 * double-clicks on the confirm button don't write duplicate system notes.
 */
export async function killDeal(
  raw: unknown,
): Promise<KillDealResult> {
  const parsed = killDealSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors;
    const firstMsg =
      issues.reason?.[0] ?? issues.dealId?.[0] ?? "Invalid kill-deal input.";
    return { ok: false, error: firstMsg };
  }
  const { dealId, reason } = parsed.data;

  const user = await getCurrentUser();

  try {
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(deals)
        .where(eq(deals.id, dealId))
        .limit(1);
      if (!before) {
        throw new Error(`Deal not found: ${dealId}`);
      }
      if (before.status === "killed") {
        throw new Error("Deal is already killed.");
      }

      // Resolve 'killed' universal stage id inside the tx
      const [killedStage] = await tx
        .select()
        .from(stages)
        .where(and(eq(stages.code, "killed"), isNull(stages.trackId)))
        .limit(1);
      if (!killedStage) {
        throw new Error(
          "Universal stage 'killed' not seeded — run npm run db:seed.",
        );
      }

      const now = new Date();
      const [after] = await tx
        .update(deals)
        .set({
          status: "killed",
          stageId: killedStage.id,
          killedAt: now,
          closedAt: now,
          killReason: reason,
          updatedAt: now,
        })
        .where(eq(deals.id, dealId))
        .returning();

      // System note mirroring the reason so Notes tab shows why the deal died.
      // DB column is `is_system` (snake_case) — Drizzle camelCases to `isSystem`.
      const [note] = await tx
        .insert(dealNotes)
        .values({
          dealId,
          body: reason,
          isSystem: true, // is_system column — marks this as app-generated
          createdBy: user.id,
        })
        .returning();

      // Audit: the deals.update
      await writeAuditLog(tx, {
        tableName: "deals",
        recordId: dealId,
        operation: "update",
        beforeJson: before,
        afterJson: { ...after, source: "manual_kill" } as Deal & { source: string },
        user: { id: user.id, email: user.email },
      });

      // Audit: the deal_notes.create
      await writeAuditLog(tx, {
        tableName: "deal_notes",
        recordId: note.id,
        operation: "create",
        beforeJson: null,
        afterJson: { ...note, source: "manual_kill" },
        user: { id: user.id, email: user.email },
      });
    });

    revalidatePath(`/deal/[id]`, "page");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
