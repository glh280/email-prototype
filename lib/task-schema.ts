import { z } from "zod";

/**
 * Shared Zod schemas for task mutations (Phase 2 Plan 03).
 *
 * createTaskSchema validates the "New task" dialog input (UI-SPEC lines
 * 354-375). updateTaskSchema validates the inline edit popover. Both are
 * re-validated server-side inside the transactional task actions.
 *
 * Error copy mirrors UI-SPEC "Copywriting Contract" (Tasks tab section):
 *   - Title blank:       "Title is required."
 *   - Title too long:    "Title must be 200 characters or fewer."
 *
 * Database-side constraints (plan 01):
 *   - tasks.status CHECK → ('open' | 'done' | 'skipped')
 *   - tasks_one_is_next_per_deal_idx — partial unique index enforces TASK-02
 *     at DB level; server action (plan 03) is happy path.
 */
export const createTaskSchema = z.object({
  dealId: z.string().uuid(),
  title: z
    .string({ message: "Title is required." })
    .trim()
    .min(1, "Title is required.")
    .max(200, "Title must be 200 characters or fewer."),
  ownerUserId: z.string().uuid().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  isNext: z.boolean().default(false),
  parentTaskId: z.string().uuid().nullable().optional(),
  advancesStageToId: z.string().uuid().nullable().optional(),
});

/** Output type — resolved after defaults (isNext becomes boolean). */
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Input type for react-hook-form state — isNext is optional on input
 * because `.default(false)` means users can omit it.
 */
export type CreateTaskFormInput = z.input<typeof createTaskSchema>;

/**
 * updateTaskSchema — inline edit popover (UI-SPEC lines 352) + status
 * transitions from completion undo (plan 03 revertTask).
 *
 * `.strict()` rejects unknown keys so e.g. re-parenting a task to a new deal
 * via `{ id, dealId: otherUuid }` fails loudly — tasks live and die with
 * their deal.
 */
export const updateTaskSchema = z
  .object({
    id: z.string().uuid(),
    title: z
      .string()
      .trim()
      .min(1, "Title is required.")
      .max(200, "Title must be 200 characters or fewer.")
      .optional(),
    ownerUserId: z.string().uuid().nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    status: z.enum(["open", "done", "skipped"]).optional(),
    isNext: z.boolean().optional(),
    advancesStageToId: z.string().uuid().nullable().optional(),
  })
  .strict();

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/**
 * completeTaskSchema — the simplest mutation; checkbox-click in the task
 * list collapses to `{id}`. The server action (plan 03) resolves everything
 * else from the current task row: auto-promote the next is_next, auto-advance
 * the deal stage if `advances_stage_to_id` is set, write audit rows.
 */
export const completeTaskSchema = z.object({
  id: z.string().uuid(),
});

export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
