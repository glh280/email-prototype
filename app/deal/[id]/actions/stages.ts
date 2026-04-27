"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { deals, stages, type Deal, type Stage } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/current-user";
import {
  advanceStageSchema,
  revertStageSchema,
} from "@/lib/stage-schema";
import type { AppTx } from "@/lib/file-no";

/**
 * Phase 2 Plan 04 — stage advance + revert server actions (STAGE-02 / STAGE-03).
 *
 * Two shapes per action:
 *   - Top-level server action (`advanceStage` / `revertStage`): wraps its own
 *     `db.transaction`, handles `revalidatePath`, returns {ok:true|false}
 *   - Tx-scoped helper (`advanceStageInTx` / `revertStageInTx`): callable from
 *     an already-open tx; used by Plan 03's completeTask for auto-advance.
 *     Throws on invariant violation — the caller decides how to map to result.
 *
 * Validation invariants (same for advance + revert; direction differs):
 *   - advance: target.sort_order > current.sort_order
 *   - revert:  target.sort_order < current.sort_order
 *   - track compatibility (both): target.track_id IS NULL OR target.track_id = deal.track_id
 *
 * Audit:
 *   - ONE row per call, tableName='deals', operation='update'
 *   - afterJson carries a `source` marker so the Audit-tab filter can
 *     distinguish manual_advance / manual_revert / task_autoadvance /
 *     task_autoadvance_undo (the undo source is Plan 03's territory, but we
 *     admit it to the type union here so the helper signature stays stable).
 *
 * revalidatePath: only the TOP-LEVEL actions revalidate. Tx-scoped helpers
 * never call revalidatePath — that's the caller's job (e.g., completeTask
 * revalidates once after its own tx commits). Per Next.js 16 docs
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md),
 * `/deal/[id]` is a dynamic path and requires `type: 'page'`.
 */

export type AdvanceStageSource =
  | "manual_advance"
  | "task_autoadvance"
  | "task_autoadvance_undo";

export type RevertStageSource =
  | "manual_revert"
  | "task_autoadvance_undo";

export type StageActionResult =
  | { ok: true; toStageCode: string; toStageLabel: string }
  | { ok: false; error: string };

type TxUser = { id: string; email: string };

/**
 * Shared stage-transition core. Called by both advance and revert; direction
 * flag controls the sort_order comparison. Extracting this avoids duplicating
 * the SELECT + validation + UPDATE + audit sequence twice.
 */
async function applyStageTransitionInTx(
  tx: AppTx,
  params: {
    dealId: string;
    targetStageId: string;
    direction: "advance" | "revert";
    source: AdvanceStageSource | RevertStageSource;
    user: TxUser;
  },
): Promise<{ before: Deal; after: Deal; targetStage: Stage }> {
  // SELECT deal
  const [deal] = await tx
    .select()
    .from(deals)
    .where(eq(deals.id, params.dealId))
    .limit(1);
  if (!deal) {
    throw new Error(`Deal not found: ${params.dealId}`);
  }

  // SELECT current stage
  const [currentStage] = await tx
    .select()
    .from(stages)
    .where(eq(stages.id, deal.stageId))
    .limit(1);
  if (!currentStage) {
    throw new Error(`Current stage not found: ${deal.stageId}`);
  }

  // SELECT target stage
  const [targetStage] = await tx
    .select()
    .from(stages)
    .where(eq(stages.id, params.targetStageId))
    .limit(1);
  if (!targetStage) {
    throw new Error(`Target stage not found: ${params.targetStageId}`);
  }

  // Direction validation
  if (
    params.direction === "advance" &&
    targetStage.sortOrder <= currentStage.sortOrder
  ) {
    throw new Error(
      `advanceStage: target sort_order (${targetStage.sortOrder}) must be greater than current (${currentStage.sortOrder}).`,
    );
  }
  if (
    params.direction === "revert" &&
    targetStage.sortOrder >= currentStage.sortOrder
  ) {
    throw new Error(
      `revertStage: target sort_order (${targetStage.sortOrder}) must be less than current (${currentStage.sortOrder}).`,
    );
  }

  // Track compatibility: target is universal (track_id IS NULL) OR same track as deal
  if (
    targetStage.trackId !== null &&
    targetStage.trackId !== deal.trackId
  ) {
    throw new Error(
      `Target stage '${targetStage.code}' belongs to a different track than the deal.`,
    );
  }

  // UPDATE deals SET stage_id = target.id, updated_at = now()
  const [after] = await tx
    .update(deals)
    .set({ stageId: targetStage.id, updatedAt: new Date() })
    .where(eq(deals.id, params.dealId))
    .returning();

  // Audit with source marker in afterJson for Audit-tab filter
  await writeAuditLog(tx, {
    tableName: "deals",
    recordId: params.dealId,
    operation: "update",
    beforeJson: {
      stage_id: currentStage.id,
      stage_code: currentStage.code,
    },
    afterJson: {
      stage_id: targetStage.id,
      stage_code: targetStage.code,
      source: params.source,
    },
    user: params.user,
  });

  return { before: deal, after, targetStage };
}

/**
 * advanceStageInTx — tx-scoped helper for auto-advance.
 *
 * Called by Plan 03's completeTask when a task has `advances_stage_to_id` set.
 * Must run inside the same tx as the task completion so either both land or
 * both roll back.
 */
export async function advanceStageInTx(
  tx: AppTx,
  params: {
    dealId: string;
    targetStageId: string;
    source: AdvanceStageSource;
    user: TxUser;
  },
): Promise<{ before: Deal; after: Deal; targetStage: Stage }> {
  return applyStageTransitionInTx(tx, {
    dealId: params.dealId,
    targetStageId: params.targetStageId,
    direction: "advance",
    source: params.source,
    user: params.user,
  });
}

/**
 * revertStageInTx — tx-scoped helper for auto-revert (Plan 03 undo path).
 */
export async function revertStageInTx(
  tx: AppTx,
  params: {
    dealId: string;
    targetStageId: string;
    source: RevertStageSource;
    user: TxUser;
  },
): Promise<{ before: Deal; after: Deal; targetStage: Stage }> {
  return applyStageTransitionInTx(tx, {
    dealId: params.dealId,
    targetStageId: params.targetStageId,
    direction: "revert",
    source: params.source,
    user: params.user,
  });
}

/**
 * advanceStage — top-level server action (STAGE-02 two-click advance).
 *
 * Called from the AlertDialog's confirm button (UI-SPEC lines 540-544). Returns
 * {ok:false,error} on validation or invariant failure; caller toasts destructive.
 */
export async function advanceStage(raw: unknown): Promise<StageActionResult> {
  const parsed = advanceStageSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid advance-stage input." };
  }
  const input = parsed.data;

  const user = await getCurrentUser();

  try {
    const { targetStage } = await db.transaction(async (tx) => {
      return advanceStageInTx(tx, {
        dealId: input.dealId,
        targetStageId: input.targetStageId,
        source: "manual_advance",
        user: { id: user.id, email: user.email },
      });
    });

    revalidatePath(`/deal/[id]`, "page");
    revalidatePath("/");

    return {
      ok: true,
      toStageCode: targetStage.code,
      toStageLabel: targetStage.label,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * revertStage — top-level server action (STAGE-03 revert).
 */
export async function revertStage(raw: unknown): Promise<StageActionResult> {
  const parsed = revertStageSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid revert-stage input." };
  }
  const input = parsed.data;

  const user = await getCurrentUser();

  try {
    const { targetStage } = await db.transaction(async (tx) => {
      return revertStageInTx(tx, {
        dealId: input.dealId,
        targetStageId: input.targetStageId,
        source: "manual_revert",
        user: { id: user.id, email: user.email },
      });
    });

    revalidatePath(`/deal/[id]`, "page");
    revalidatePath("/");

    return {
      ok: true,
      toStageCode: targetStage.code,
      toStageLabel: targetStage.label,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
