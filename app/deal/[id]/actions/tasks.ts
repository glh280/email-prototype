"use server";

import { revalidatePath } from "next/cache";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  tasks,
  deals,
  stages,
  auditLog,
  type Task,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/current-user";
import {
  createTaskSchema,
  updateTaskSchema,
  completeTaskSchema,
} from "@/lib/task-schema";
import {
  advanceStageInTx,
  revertStageInTx,
} from "@/app/deal/[id]/actions/stages";
import type { AppTx } from "@/lib/file-no";

/**
 * Phase 2 Plan 03 — task server actions.
 *
 * Five Server Actions implement TASK-01..05:
 *   - createTask: insert + clear prior is_next if isNext=true; audit both rows
 *   - completeTask: mark done + auto-promote next is_next + auto-advance stage
 *       (via advanceStageInTx) when advancesStageToId is set. Writes the
 *       `triggeringTaskId` breadcrumb to the deals.update audit afterJson so
 *       undoCompleteTask can find it.
 *   - undoCompleteTask: reverses completeTask. For auto-advanced tasks, looks
 *       up the task_autoadvance audit row by triggeringTaskId, reads the prior
 *       stage_id from its beforeJson, and calls revertStageInTx. Aborts with
 *       `Cannot safely revert stage` if the audit row is missing.
 *   - updateTask: partial diff + audit
 *   - reassignTask: sugar over updateTask for owner changes
 *
 * All mutations wrap DML + audit in ONE `db.transaction` per D-05: if any
 * audit write throws, every preceding mutation in the tx rolls back. Proven
 * by Test 8c (audit-row-deleted race → undo aborts, task row untouched).
 *
 * is_next invariant (TASK-02) is enforced at two layers:
 *   - DB: partial unique index `tasks_one_is_next_per_deal_idx` rejects a
 *     second `is_next=true` row per deal with a Postgres 23505.
 *   - App: the actions clear any prior is_next before setting a new one, in
 *     the same tx. The DB index is the safety net for races the app misses.
 *
 * Test 11 (INVARIANT) proves 10 concurrent createTask(isNext:true) calls
 * always leave exactly 1 is_next row — nine of them either get their is_next
 * cleared by a later caller's UPDATE or abort on the partial unique index.
 */

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type CreateTaskResult =
  | { ok: true; task: Task }
  | { ok: false; errors: Record<string, string[]> }
  | { ok: false; error: string };

export type CompleteTaskResult =
  | {
      ok: true;
      taskId: string;
      // W3: include title so UI can render the auto-promote toast copy verbatim
      // without a second round trip. Populated by reading the newly-promoted
      // is_next task inside the same completion tx (null when no open siblings
      // remained).
      newIsNext: { id: string; title: string } | null;
      // W2: toCode is stages.code (machine id, e.g. 'title_order_opened');
      // toLabel is stages.label (human-readable, e.g. 'Title order opened').
      // UI copy uses toLabel verbatim. Both populated by joining the `stages`
      // table in the completion tx when advancesStageToId was set.
      stageAdvanced: { toCode: string; toLabel: string } | null;
    }
  | { ok: false; error: string };

export type UndoCompleteTaskResult =
  | { ok: true; taskId: string }
  | { ok: false; error: string };

export type UpdateTaskResult =
  | { ok: true; task: Task }
  | { ok: false; errors: Record<string, string[]> }
  | { ok: false; error: string };

export type ReassignTaskResult = UpdateTaskResult;

type TxUser = { id: string; email: string };

// ---------------------------------------------------------------------------
// createTask (TASK-01, TASK-02)
// ---------------------------------------------------------------------------

export async function createTask(
  raw: unknown,
): Promise<CreateTaskResult> {
  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const input = parsed.data;

  const user = await getCurrentUser();

  try {
    const newTask = await db.transaction(async (tx) => {
      // If isNext=true, atomically clear any prior is_next on the same deal.
      if (input.isNext === true) {
        const priorIsNext = await tx
          .select()
          .from(tasks)
          .where(
            and(eq(tasks.dealId, input.dealId), eq(tasks.isNext, true)),
          );
        for (const prior of priorIsNext) {
          const [after] = await tx
            .update(tasks)
            .set({ isNext: false, updatedAt: new Date() })
            .where(eq(tasks.id, prior.id))
            .returning();
          await writeAuditLog(tx, {
            tableName: "tasks",
            recordId: prior.id,
            operation: "update",
            beforeJson: prior,
            afterJson: { ...after, source: "user_action" },
            user: { id: user.id, email: user.email },
          });
        }
      }

      const [row] = await tx
        .insert(tasks)
        .values({
          dealId: input.dealId,
          title: input.title,
          ownerUserId: input.ownerUserId ?? null,
          dueDate: input.dueDate ?? null,
          isNext: input.isNext ?? false,
          parentTaskId: input.parentTaskId ?? null,
          advancesStageToId: input.advancesStageToId ?? null,
          createdBy: user.id,
        })
        .returning();

      await writeAuditLog(tx, {
        tableName: "tasks",
        recordId: row.id,
        operation: "create",
        beforeJson: null,
        afterJson: { ...row, source: "user_action" },
        user: { id: user.id, email: user.email },
      });

      return row;
    });

    revalidatePath(`/deal/[id]`, "page");
    revalidatePath("/");

    return { ok: true, task: newTask };
  } catch (err) {
    // Postgres unique_violation on tasks_one_is_next_per_deal_idx = 23505
    const pgErr = err as { code?: string; message?: string };
    if (pgErr.code === "23505") {
      return { ok: false, error: "conflict" };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// completeTask (TASK-01 auto-advance, TASK-03 auto-promote)
// ---------------------------------------------------------------------------

export async function completeTask(
  raw: unknown,
): Promise<CompleteTaskResult> {
  const parsed = completeTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid complete-task input." };
  }
  const { id } = parsed.data;

  const user = await getCurrentUser();

  try {
    const result = await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      if (!before) {
        throw new Error(`Task not found: ${id}`);
      }

      const now = new Date();
      const [after] = await tx
        .update(tasks)
        .set({
          status: "done",
          isNext: false,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(tasks.id, id))
        .returning();

      await writeAuditLog(tx, {
        tableName: "tasks",
        recordId: id,
        operation: "update",
        beforeJson: before,
        afterJson: { ...after, source: "user_action" },
        user: { id: user.id, email: user.email },
      });

      // Auto-promote: if this task had is_next=true AND the deal has other
      // open tasks, promote the next one by (due_date asc nulls last,
      // created_at asc).
      let newIsNext: { id: string; title: string } | null = null;
      if (before.isNext === true) {
        const [candidate] = await tx
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.dealId, before.dealId),
              eq(tasks.status, "open"),
            ),
          )
          .orderBy(
            sql`${tasks.dueDate} ASC NULLS LAST`,
            asc(tasks.createdAt),
          )
          .limit(1);

        if (candidate) {
          const [promoted] = await tx
            .update(tasks)
            .set({ isNext: true, updatedAt: new Date() })
            .where(eq(tasks.id, candidate.id))
            .returning();

          await writeAuditLog(tx, {
            tableName: "tasks",
            recordId: candidate.id,
            operation: "update",
            beforeJson: candidate,
            afterJson: { ...promoted, source: "user_action" },
            user: { id: user.id, email: user.email },
          });

          newIsNext = { id: promoted.id, title: promoted.title };
        }
      }

      // Auto-advance stage (TASK-01): if advancesStageToId is set, call
      // advanceStageInTx inside this tx. Write triggeringTaskId breadcrumb
      // to the deals.update audit afterJson so undoCompleteTask can find it.
      let stageAdvanced: { toCode: string; toLabel: string } | null = null;
      if (before.advancesStageToId !== null) {
        // advanceStageInTx writes its own deals.update audit row. We want to
        // attach the triggeringTaskId breadcrumb to THAT row. Strategy: call
        // advanceStageInTx first (it writes the row with source=task_autoadvance),
        // then UPDATE the just-written audit row's afterJson to merge in the
        // triggeringTaskId field. This preserves the helper's signature while
        // satisfying the undo-lookup contract.
        const advanceResult = await advanceStageInTx(tx, {
          dealId: before.dealId,
          targetStageId: before.advancesStageToId,
          source: "task_autoadvance",
          user: { id: user.id, email: user.email },
        });

        // Patch the most recent audit row for this deal with triggeringTaskId
        // so undoCompleteTask can find the revert-target stage id via
        // afterJson->>'triggeringTaskId'.
        await tx.execute(
          sql`UPDATE audit_log
              SET after_json = after_json || jsonb_build_object('triggeringTaskId', ${id}::text)
              WHERE id = (
                SELECT id FROM audit_log
                WHERE table_name = 'deals'
                  AND record_id = ${before.dealId}
                  AND after_json->>'source' = 'task_autoadvance'
                ORDER BY created_at DESC
                LIMIT 1
              )`,
        );

        stageAdvanced = {
          toCode: advanceResult.targetStage.code,
          toLabel: advanceResult.targetStage.label,
        };
      }

      return {
        taskId: id,
        newIsNext,
        stageAdvanced,
      };
    });

    revalidatePath(`/deal/[id]`, "page");
    revalidatePath("/");

    return {
      ok: true,
      taskId: result.taskId,
      newIsNext: result.newIsNext,
      stageAdvanced: result.stageAdvanced,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// undoCompleteTask (TASK-04)
// ---------------------------------------------------------------------------

const undoCompleteTaskSchema = z.object({
  taskId: z.string().uuid(),
  autoPromotedTaskId: z.string().uuid().nullable().optional(),
  priorIsNext: z.boolean(),
});

export async function undoCompleteTask(
  raw: unknown,
): Promise<UndoCompleteTaskResult> {
  const parsed = undoCompleteTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid undo-complete-task input." };
  }
  const input = parsed.data;

  const user = await getCurrentUser();

  try {
    await db.transaction(async (tx) => {
      // Re-read the completed task row inside the tx — source of truth for
      // what we're undoing.
      const [before] = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.taskId))
        .limit(1);
      if (!before) {
        throw new Error(`Task not found: ${input.taskId}`);
      }

      // W1: if the task auto-advanced the stage, derive the prior stage by
      // looking up the task_autoadvance audit row by triggeringTaskId. Do
      // this BEFORE mutating the task row so the abort-on-missing-audit case
      // leaves the task untouched (Test 8c).
      if (before.advancesStageToId !== null) {
        const auditRows = await tx
          .select()
          .from(auditLog)
          .where(
            and(
              eq(auditLog.tableName, "deals"),
              eq(auditLog.recordId, before.dealId),
              sql`${auditLog.afterJson}->>'source' = 'task_autoadvance'`,
              sql`${auditLog.afterJson}->>'triggeringTaskId' = ${input.taskId}`,
            ),
          )
          .orderBy(desc(auditLog.createdAt))
          .limit(1);

        if (auditRows.length === 0) {
          throw new Error("Cannot safely revert stage");
        }
        const beforeJson = auditRows[0].beforeJson as {
          stage_id?: string;
        } | null;
        const targetStageId = beforeJson?.stage_id;
        if (!targetStageId) {
          throw new Error("Cannot safely revert stage");
        }

        await revertStageInTx(tx, {
          dealId: before.dealId,
          targetStageId,
          source: "task_autoadvance_undo",
          user: { id: user.id, email: user.email },
        });
      }

      // Flip status back to open + restore is_next + clear completedAt
      const [after] = await tx
        .update(tasks)
        .set({
          status: "open",
          completedAt: null,
          isNext: input.priorIsNext,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, input.taskId))
        .returning();

      await writeAuditLog(tx, {
        tableName: "tasks",
        recordId: input.taskId,
        operation: "update",
        beforeJson: before,
        afterJson: { ...after, source: "task_undo_complete" },
        user: { id: user.id, email: user.email },
      });

      // If an auto-promoted sibling exists, clear its is_next and audit.
      if (input.autoPromotedTaskId) {
        const [promotedBefore] = await tx
          .select()
          .from(tasks)
          .where(eq(tasks.id, input.autoPromotedTaskId))
          .limit(1);
        if (promotedBefore) {
          const [promotedAfter] = await tx
            .update(tasks)
            .set({ isNext: false, updatedAt: new Date() })
            .where(eq(tasks.id, input.autoPromotedTaskId))
            .returning();

          await writeAuditLog(tx, {
            tableName: "tasks",
            recordId: input.autoPromotedTaskId,
            operation: "update",
            beforeJson: promotedBefore,
            afterJson: { ...promotedAfter, source: "task_undo_complete" },
            user: { id: user.id, email: user.email },
          });
        }
      }
    });

    revalidatePath(`/deal/[id]`, "page");
    revalidatePath("/");

    return { ok: true, taskId: input.taskId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// updateTask (generic partial edit)
// ---------------------------------------------------------------------------

export async function updateTask(
  raw: unknown,
): Promise<UpdateTaskResult> {
  const parsed = updateTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const input = parsed.data;
  const { id, ...rawDiff } = input;

  // Strip undefined keys — only touch fields the caller actually sent.
  const diff: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawDiff)) {
    if (v !== undefined) diff[k] = v;
  }

  if (Object.keys(diff).length === 0) {
    return { ok: false, error: "No changes to apply." };
  }

  const user = await getCurrentUser();

  try {
    const updated = await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      if (!before) {
        throw new Error(`Task not found: ${id}`);
      }

      // If setting isNext=true, atomically clear any prior is_next on the
      // same deal first.
      if (diff.isNext === true) {
        const priorIsNext = await tx
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.dealId, before.dealId),
              eq(tasks.isNext, true),
            ),
          );
        for (const prior of priorIsNext) {
          if (prior.id === id) continue; // updating the same row below
          const [afterPrior] = await tx
            .update(tasks)
            .set({ isNext: false, updatedAt: new Date() })
            .where(eq(tasks.id, prior.id))
            .returning();
          await writeAuditLog(tx, {
            tableName: "tasks",
            recordId: prior.id,
            operation: "update",
            beforeJson: prior,
            afterJson: { ...afterPrior, source: "user_action" },
            user: { id: user.id, email: user.email },
          });
        }
      }

      const [after] = await tx
        .update(tasks)
        .set({ ...diff, updatedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning();

      await writeAuditLog(tx, {
        tableName: "tasks",
        recordId: id,
        operation: "update",
        beforeJson: before,
        afterJson: { ...after, source: "user_action" },
        user: { id: user.id, email: user.email },
      });

      return after;
    });

    revalidatePath(`/deal/[id]`, "page");
    revalidatePath("/");

    return { ok: true, task: updated };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// reassignTask — sugar over updateTask for owner changes
// ---------------------------------------------------------------------------

export async function reassignTask(
  id: string,
  ownerUserId: string | null,
): Promise<ReassignTaskResult> {
  return updateTask({ id, ownerUserId });
}

// Re-export AppTx typing boundary used by tests if needed.
export type { AppTx };
