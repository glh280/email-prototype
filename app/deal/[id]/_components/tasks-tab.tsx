"use client";

import * as React from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskRow } from "./task-row";
import { NewTaskDialog } from "./new-task-dialog";
import type { DealDetail } from "@/lib/deals-query";
import type { TaskListRow } from "@/lib/tasks-query";
import type { UserOption } from "@/lib/users-query";

/**
 * Phase 2 Plan 06 — Tasks tab (UI-SPEC lines 320-410).
 *
 * Layout:
 *   - Top-right `+ New task` button
 *   - OPEN section: header (Label tier uppercase) + TaskRow list ordered by
 *     is_next DESC then due_date ASC NULLS LAST (queryTasksForDeal does this)
 *   - DONE section: header `DONE ({n})` with chevron; collapsed by default
 *     when done count >= 5
 *   - Empty state when open+done both zero (UI-SPEC lines 383-395): ListChecks
 *     48px icon + "No tasks yet" heading + body + primary `+ New task` button
 */

export function TasksTab(props: {
  deal: DealDetail;
  initialTasks: { open: TaskListRow[]; done: TaskListRow[] };
  users: UserOption[];
}) {
  const { deal, initialTasks, users } = props;
  const [newTaskOpen, setNewTaskOpen] = React.useState(false);
  const [doneExpanded, setDoneExpanded] = React.useState(
    initialTasks.done.length < 5,
  );

  const totalTasks = initialTasks.open.length + initialTasks.done.length;

  if (totalTasks === 0) {
    return (
      <>
        <div className="flex flex-col items-center py-24 text-center">
          <ListChecks
            className="h-12 w-12 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="mt-6 text-[28px] font-semibold leading-[1.2]">
            No tasks yet
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a task to track the next action on this file.
          </p>
          <Button className="mt-6" onClick={() => setNewTaskOpen(true)}>
            + New task
          </Button>
        </div>
        <NewTaskDialog
          open={newTaskOpen}
          onOpenChange={setNewTaskOpen}
          deal={deal}
          openTasks={initialTasks.open}
          users={users}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <Button onClick={() => setNewTaskOpen(true)}>+ New task</Button>
      </div>

      {initialTasks.open.length > 0 ? (
        <section aria-label="OPEN" className="mb-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 px-2">
            OPEN
          </h3>
          <div className="space-y-0.5">
            {initialTasks.open.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        </section>
      ) : null}

      {initialTasks.done.length > 0 ? (
        <section aria-label="DONE">
          <button
            type="button"
            onClick={() => setDoneExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 px-2 hover:text-foreground"
            aria-expanded={doneExpanded}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                doneExpanded ? "" : "-rotate-90"
              }`}
              aria-hidden="true"
            />
            DONE ({initialTasks.done.length})
          </button>
          {doneExpanded ? (
            <div className="space-y-0.5">
              {initialTasks.done.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        deal={deal}
        openTasks={initialTasks.open}
        users={users}
      />
    </>
  );
}
