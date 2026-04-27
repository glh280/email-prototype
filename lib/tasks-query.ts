import { eq, desc, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, users, type Task } from "@/db/schema";

/**
 * Phase 2 Plan 03 — task reader for the detail-page Tasks tab (TASK-05) and
 * the list-view Next Task column.
 *
 * One SELECT round-trip pulls every task for the deal (open + done). We
 * split into two groups in-memory rather than firing two queries so the
 * Tasks tab renders with a single DB hit. Callers (Plan 06 UI) destructure
 * `{ open, done }` directly.
 *
 * Ordering contract (from UI-SPEC lines 367-375):
 *   - open: is_next DESC first (puts the Next row at index 0),
 *           then due_date ASC NULLS LAST,
 *           then created_at ASC
 *   - done: completed_at DESC (most recently completed first)
 */

export type TaskListRow = Pick<
  Task,
  | "id"
  | "dealId"
  | "title"
  | "dueDate"
  | "status"
  | "isNext"
  | "ownerUserId"
  | "completedAt"
  | "createdAt"
  | "advancesStageToId"
  | "parentTaskId"
> & {
  ownerName: string | null;
};

export async function queryTasksForDeal(
  dealId: string,
): Promise<{ open: TaskListRow[]; done: TaskListRow[] }> {
  const rows = await db
    .select({
      id: tasks.id,
      dealId: tasks.dealId,
      title: tasks.title,
      dueDate: tasks.dueDate,
      status: tasks.status,
      isNext: tasks.isNext,
      ownerUserId: tasks.ownerUserId,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      advancesStageToId: tasks.advancesStageToId,
      parentTaskId: tasks.parentTaskId,
      ownerName: users.name,
    })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.ownerUserId))
    .where(eq(tasks.dealId, dealId))
    .orderBy(
      desc(tasks.isNext),
      sql`${tasks.dueDate} ASC NULLS LAST`,
      asc(tasks.createdAt),
    );

  const open: TaskListRow[] = [];
  const done: TaskListRow[] = [];
  for (const row of rows) {
    if (row.status === "open") {
      open.push(row);
    } else if (row.status === "done") {
      done.push(row);
    }
  }

  // Resort done by completedAt DESC (null-safe — completed rows always have a value)
  done.sort((a, b) => {
    const at = a.completedAt ? a.completedAt.getTime() : 0;
    const bt = b.completedAt ? b.completedAt.getTime() : 0;
    return bt - at;
  });

  return { open, done };
}
