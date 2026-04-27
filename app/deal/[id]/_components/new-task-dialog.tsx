"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarIcon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  createTaskSchema,
  type CreateTaskFormInput,
  type CreateTaskInput,
} from "@/lib/task-schema";
import { createTask } from "@/app/deal/[id]/actions/tasks";
import type { DealDetail } from "@/lib/deals-query";
import type { TaskListRow } from "@/lib/tasks-query";
import type { UserOption } from "@/lib/users-query";

/**
 * Phase 2 Plan 06 — "New task" dialog (UI-SPEC lines 356-367 + copy lines
 * 711-712).
 *
 * Six fields per UI-SPEC:
 *   1. Title (required)
 *   2. Owner (select from users list)
 *   3. Due date (Popover + Calendar — same pattern as new-deal-form.tsx)
 *   4. Parent task (select from this deal's OPEN tasks — optional)
 *   5. Advances stage to (select — only stages reachable from current with
 *      sort_order > current.sortOrder AND (track_id IS NULL OR = deal.trackId))
 *   6. Is next (Checkbox, default false)
 *
 * Uses react-hook-form + zodResolver(createTaskSchema). Server re-validates
 * (plan 03 createTask schema parse). Submit on success: close dialog,
 * router.refresh(), toast `Task added.`. Failure: toast the error verbatim
 * per UI-SPEC copy contract.
 */

export function NewTaskDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: DealDetail;
  openTasks: TaskListRow[];
  users: UserOption[];
}) {
  const { open, onOpenChange, deal, openTasks, users } = props;
  const router = useRouter();

  const form = useForm<CreateTaskFormInput, unknown, CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      dealId: deal.id,
      title: "",
      ownerUserId: undefined,
      dueDate: undefined,
      parentTaskId: undefined,
      advancesStageToId: undefined,
      isNext: false,
    },
  });

  const [isPending, startTransition] = React.useTransition();

  // Stages reachable from current: sort_order > current.sortOrder AND
  // (track_id IS NULL OR track_id === deal.trackId). Exclude 'killed' —
  // killed is only reachable via the KillDealDialog, not via advance.
  const reachableStages = React.useMemo(() => {
    return deal.availableStages.filter(
      (s) =>
        s.sortOrder > deal.currentStage.sortOrder &&
        (s.trackId === null || s.trackId === deal.trackId) &&
        s.code !== "killed",
    );
  }, [deal.availableStages, deal.currentStage.sortOrder, deal.trackId]);

  const onSubmit = (data: CreateTaskInput) => {
    startTransition(async () => {
      const result = await createTask(data);
      if (result.ok) {
        toast.success("Task added.");
        form.reset({
          dealId: deal.id,
          title: "",
          ownerUserId: undefined,
          dueDate: undefined,
          parentTaskId: undefined,
          advancesStageToId: undefined,
          isNext: false,
        });
        onOpenChange(false);
        router.refresh();
      } else if ("errors" in result) {
        for (const [field, msgs] of Object.entries(result.errors)) {
          if (msgs && msgs[0]) {
            form.setError(field as keyof CreateTaskFormInput, {
              message: msgs[0],
            });
          }
        }
        toast.error("Please fix the errors above.");
      } else {
        toast.error(`Couldn't add task — ${result.error}. Try again.`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Title <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="What's the next action?"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Owner */}
            <FormField
              control={form.control}
              name="ownerUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Owner</FormLabel>
                  <Select
                    value={(field.value as string | null | undefined) ?? ""}
                    onValueChange={(v) => field.onChange(v || undefined)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name ?? u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Due date */}
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due date</FormLabel>
                  <DateFieldControl
                    value={field.value as Date | null | undefined}
                    onChange={(d) => field.onChange(d ?? undefined)}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Parent task */}
            <FormField
              control={form.control}
              name="parentTaskId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent task</FormLabel>
                  <Select
                    value={(field.value as string | null | undefined) ?? ""}
                    onValueChange={(v) => field.onChange(v || undefined)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {openTasks.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          No open tasks to parent under.
                        </div>
                      ) : (
                        openTasks.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.title}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Advances stage to */}
            <FormField
              control={form.control}
              name="advancesStageToId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Advances stage to</FormLabel>
                  <Select
                    value={(field.value as string | null | undefined) ?? ""}
                    onValueChange={(v) => field.onChange(v || undefined)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No stage advance" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {reachableStages.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          No reachable stages (deal at terminal).
                        </div>
                      ) : (
                        reachableStages.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Is next */}
            <FormField
              control={form.control}
              name="isNext"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={!!field.value}
                        onCheckedChange={(v) => field.onChange(!!v)}
                      />
                    </FormControl>
                    <FormLabel className="mb-0">
                      Mark as the next task (sets ◀ Next)
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Adding…
                  </>
                ) : (
                  "Add task"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Popover + Calendar date picker. Null/undefined clears the field.
 * Mirrors DateFieldControl in new-deal-form.tsx.
 */
function DateFieldControl(props: {
  value: Date | null | undefined;
  onChange: (v: Date | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const label = props.value
    ? (props.value as Date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Pick a date";
  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              type="button"
              className="justify-start w-full"
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              {label}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={(props.value as Date | undefined) ?? undefined}
            onSelect={(d) => {
              props.onChange(d ?? null);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {props.value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear date"
          onClick={() => props.onChange(null)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
