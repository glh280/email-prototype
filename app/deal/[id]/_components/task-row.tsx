"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  completeTask,
  undoCompleteTask,
} from "@/app/deal/[id]/actions/tasks";
import type { TaskListRow } from "@/lib/tasks-query";

/**
 * Phase 2 Plan 06 — Task row (UI-SPEC lines 342-355).
 *
 * Renders one task row with:
 *   - Checkbox leading the row (completes the task on check)
 *   - `border-l-2 border-primary pl-3` accent bar when isNext=true (UI-SPEC
 *     line 130 — the P2-NEW accent reservation for is_next task rows)
 *   - `◀ Next` chip before the title when isNext=true
 *   - Title (Body tier, truncated, with tooltip)
 *   - Relative due date (mono, tone color — destructive/today-amber/muted)
 *   - `@owner` label (text-xs text-muted-foreground)
 *   - `▸` chevron on hover (future: opens inline edit popover — stub for P10)
 *
 * Completion flow (TASK-04):
 *   - Captures prior is_next so undo can restore it
 *   - Calls completeTask; handles three toast copies per UI-SPEC:
 *       (a) plain:            "Task completed. Undo?"
 *       (b) auto-advance:     "Task completed. Milestone advanced to {stage.toLabel}. Undo?"
 *       (c) auto-promote:     "Task completed. Next task is now \"{title}\". Undo?"
 *   - 5-second toast with Undo button — click → undoCompleteTask with
 *     autoPromotedTaskId + priorIsNext so the server can reverse both
 *     the status flip AND the auto-promoted sibling's is_next
 *
 * Contract keys used verbatim (W2/W3 revision):
 *   - result.stageAdvanced.toLabel    ← NOT toCode, NOT to
 *   - result.newIsNext.title          ← return type carries the title
 *   - result.newIsNext?.id ?? null    ← passed to undoCompleteTask
 */

function formatRelativeDue(dueDate: Date | null):
  | { text: string; tone: "overdue" | "today" | "future" | "none" } {
  if (!dueDate) return { text: "no due date", tone: "none" };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) {
    return {
      text: `overdue ${Math.abs(diffDays)}d`,
      tone: "overdue",
    };
  }
  if (diffDays === 0) return { text: "due today", tone: "today" };
  if (diffDays === 1) return { text: "due tomorrow", tone: "future" };
  return { text: `due in ${diffDays}d`, tone: "future" };
}

function toneClass(tone: "overdue" | "today" | "future" | "none"): string {
  switch (tone) {
    case "overdue":
      return "text-destructive";
    case "today":
      return "text-amber-700 dark:text-amber-300";
    case "future":
      return "text-muted-foreground";
    case "none":
      return "text-muted-foreground/70";
  }
}

export function TaskRow(props: { task: TaskListRow }) {
  const { task } = props;
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const due = formatRelativeDue(task.dueDate);

  const handleComplete = (checked: boolean) => {
    // Only act on check (not uncheck — open tasks render with checked=false)
    if (!checked) return;
    // Stash previous isNext for the undo payload — the server needs it to
    // restore the invariant correctly if this row had been the Next task.
    const prevIsNext = task.isNext;

    startTransition(async () => {
      const result = await completeTask({ id: task.id });
      if (!result.ok) {
        toast.error(`Couldn't update task — ${result.error}. Try again.`);
        return;
      }

      // Pick the toast copy. UI-SPEC lines 404-406 + copy contract
      // (lines 707-709) are the source of truth.
      // Precedence: stage advanced > new is_next promoted > plain
      let message = `Task completed. Undo?`;
      if (result.stageAdvanced) {
        // W2: use .toLabel (human-readable), NOT .toCode
        message = `Task completed. Milestone advanced to ${result.stageAdvanced.toLabel}. Undo?`;
      } else if (result.newIsNext) {
        // W3: use .title from the returned newIsNext object
        message = `Task completed. Next task is now "${result.newIsNext.title}". Undo?`;
      }

      toast(message, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            startTransition(async () => {
              // W3: pass auto-promoted sibling's id via newIsNext?.id ?? null
              const undoResult = await undoCompleteTask({
                taskId: task.id,
                autoPromotedTaskId: result.newIsNext?.id ?? null,
                priorIsNext: prevIsNext,
              });
              if (!undoResult.ok) {
                toast.error(
                  `Couldn't undo — ${undoResult.error}. Try again.`,
                );
                return;
              }
              router.refresh();
            });
          },
        },
      });

      router.refresh();
    });
  };

  const isDone = task.status === "done";

  return (
    <div
      className={`group flex items-center gap-3 py-3 px-2 rounded-md hover:bg-muted/40 ${
        task.isNext ? "border-l-2 border-primary pl-3" : ""
      } ${isDone ? "opacity-70" : ""}`}
    >
      <Checkbox
        checked={isDone}
        onCheckedChange={(v) => handleComplete(!!v)}
        disabled={pending || isDone}
        aria-label={`Complete task: ${task.title}`}
      />

      {task.isNext ? (
        <span className="text-[11px] bg-primary/10 text-primary ring-1 ring-primary/30 rounded-md px-1.5 py-0.5 font-medium whitespace-nowrap">
          ◀ Next
        </span>
      ) : null}

      <span
        className={`flex-1 truncate text-sm ${
          isDone ? "line-through text-muted-foreground" : ""
        }`}
        title={task.title}
      >
        {task.title}
      </span>

      <span
        className={`font-mono text-[13px] whitespace-nowrap ${toneClass(due.tone)}`}
      >
        {due.text}
      </span>

      <span className="text-xs text-muted-foreground whitespace-nowrap">
        @{task.ownerName ?? "unassigned"}
      </span>

      <ChevronRight
        className="h-4 w-4 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
      />
    </div>
  );
}
