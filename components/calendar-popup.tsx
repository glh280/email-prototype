"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { Deal, Task } from "@/mock/types";
import { TRACK_COLOR, TRACK_LABEL } from "@/mock/types";
import { DEALS } from "@/mock/deals";
import { relativeTime } from "@/mock/helpers";

type View = "day" | "week" | "month";

type ScheduledItem = {
  dealId: string;
  dealTitle: string;
  track: Deal["track"];
  task: Task;
  /** The date to schedule against (task due or deal closing). */
  at: Date;
  kind: "task-due" | "closing";
};

/** Flatten all deals into a single list of items keyed by date. */
function collectItems(deals: Deal[]): ScheduledItem[] {
  const items: ScheduledItem[] = [];
  for (const d of deals) {
    for (const t of d.tasks) {
      if (t.dueAt && t.status === "open") {
        items.push({ dealId: d.id, dealTitle: d.title, track: d.track, task: t, at: new Date(t.dueAt), kind: "task-due" });
      }
    }
    if (d.closingAt) {
      // Synthesize a synthetic closing "task" entry so we can reuse the same UI
      items.push({
        dealId: d.id,
        dealTitle: d.title,
        track: d.track,
        task: {
          id: `${d.id}-closing`,
          title: "Closing scheduled",
          owners: d.internalOwners as string[],
          dueAt: d.closingAt,
          status: "open",
          isNext: false,
        },
        at: new Date(d.closingAt),
        kind: "closing",
      });
    }
  }
  return items;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysBetween(a: Date, b: Date) {
  const out: Date[] = [];
  const cursor = new Date(a);
  while (cursor <= b) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function CalendarButton() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  // In-memory date edits keyed by taskId. Prototype-only.
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  function dueDateFor(item: ScheduledItem): Date {
    return overrides[item.task.id] ? new Date(overrides[item.task.id]) : item.at;
  }

  const allItems = useMemo(() => collectItems(DEALS), []);

  const itemsInView = useMemo(() => {
    if (view === "day") {
      return allItems.filter((it) => sameDay(dueDateFor(it), cursor));
    }
    if (view === "week") {
      const start = startOfWeek(cursor);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return allItems.filter((it) => {
        const d = dueDateFor(it);
        return d >= start && d <= end;
      });
    }
    // month
    const start = startOfMonth(cursor);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    return allItems.filter((it) => {
      const d = dueDateFor(it);
      return d >= start && d <= end;
    });
  }, [view, cursor, allItems, overrides]);

  function navigate(delta: -1 | 1) {
    const next = new Date(cursor);
    if (view === "day") next.setDate(next.getDate() + delta);
    if (view === "week") next.setDate(next.getDate() + delta * 7);
    if (view === "month") next.setMonth(next.getMonth() + delta);
    setCursor(next);
  }

  function updateDate(itemId: string, iso: string) {
    setOverrides((prev) => ({ ...prev, [itemId]: iso }));
    toast.success("Due date updated (simulated)", { description: "Prototype: changes are in-memory." });
  }

  const title =
    view === "day"
      ? cursor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : view === "week"
        ? (() => {
            const s = startOfWeek(cursor);
            const e = new Date(s);
            e.setDate(e.getDate() + 6);
            return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${e.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}`;
          })()
        : cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="gap-1.5" title="Upcoming deadlines + closings">
            📅 Calendar
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Calendar — deadlines & closings</DialogTitle>
          <DialogDescription>All open task due dates + scheduled closings across active deals.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 pb-3 border-b">
          <div className="flex rounded-md border overflow-hidden">
            {(["day", "week", "month"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-xs capitalize ${view === v ? "bg-foreground text-background" : "hover:bg-muted"}`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>
            ←
          </Button>
          <div className="text-sm font-medium min-w-[240px] text-center">{title}</div>
          <Button size="sm" variant="ghost" onClick={() => navigate(1)}>
            →
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              setCursor(d);
            }}
          >
            Today
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          {view === "day" && <DayView items={itemsInView} dueDateFor={dueDateFor} onDateChange={updateDate} />}
          {view === "week" && <WeekView cursor={cursor} items={itemsInView} dueDateFor={dueDateFor} onDateChange={updateDate} />}
          {view === "month" && <MonthView cursor={cursor} items={itemsInView} dueDateFor={dueDateFor} onDateChange={updateDate} />}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Close</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemPill({
  item,
  dueDateFor,
  onDateChange,
}: {
  item: ScheduledItem;
  dueDateFor: (it: ScheduledItem) => Date;
  onDateChange: (id: string, iso: string) => void;
}) {
  const when = dueDateFor(item);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(() => {
    const d = new Date(when);
    const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    return tz;
  });

  function commit() {
    const iso = new Date(draft).toISOString();
    onDateChange(item.task.id, iso);
    setEditing(false);
  }

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <div
            className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer mb-0.5 truncate ${
              item.kind === "closing"
                ? "bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                : TRACK_COLOR[item.track]
            }`}
            onClick={() => setEditing(true)}
          >
            {item.kind === "closing" ? "🏁 " : "• "}
            {item.task.title}
          </div>
        }
      />
      <HoverCardContent side="top" align="start" className="w-72 p-3 space-y-2">
        <div>
          <Badge variant="secondary" className={`${TRACK_COLOR[item.track]} border-0 text-[10px]`}>
            {TRACK_LABEL[item.track]}
          </Badge>
        </div>
        <div>
          <Link href={`/deal/${item.dealId}`} className="font-medium text-sm hover:underline">
            {item.dealTitle}
          </Link>
        </div>
        <div className="text-sm">{item.task.title}</div>
        <div className="text-xs text-muted-foreground">Owners: {item.task.owners.join(", ") || "—"}</div>
        <div className="text-xs text-muted-foreground">
          Due: {when.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · {relativeTime(when.toISOString())}
        </div>

        {editing ? (
          <div className="pt-1 space-y-1">
            <input
              type="datetime-local"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded border text-xs px-2 py-1 bg-background"
            />
            <div className="flex gap-1">
              <Button size="sm" onClick={commit} className="h-7">Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7">Cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-7">Reschedule</Button>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function DayView({
  items,
  dueDateFor,
  onDateChange,
}: {
  items: ScheduledItem[];
  dueDateFor: (it: ScheduledItem) => Date;
  onDateChange: (id: string, iso: string) => void;
}) {
  if (items.length === 0) return <div className="text-sm text-muted-foreground text-center py-8">Nothing due.</div>;
  return (
    <ul className="space-y-2">
      {items
        .sort((a, b) => dueDateFor(a).getTime() - dueDateFor(b).getTime())
        .map((it) => (
          <li key={it.task.id} className="border rounded p-3 flex items-start gap-3">
            <div className="text-xs text-muted-foreground min-w-[80px]">
              {dueDateFor(it).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </div>
            <div className="flex-1 min-w-0">
              <Badge variant="secondary" className={`${TRACK_COLOR[it.track]} border-0 text-[10px] mb-1`}>
                {TRACK_LABEL[it.track]}
              </Badge>
              <div className="text-sm font-medium">{it.task.title}</div>
              <Link href={`/deal/${it.dealId}`} className="text-xs text-muted-foreground hover:underline">
                {it.dealTitle}
              </Link>
            </div>
            <ItemPill item={it} dueDateFor={dueDateFor} onDateChange={onDateChange} />
          </li>
        ))}
    </ul>
  );
}

function WeekView({
  cursor,
  items,
  dueDateFor,
  onDateChange,
}: {
  cursor: Date;
  items: ScheduledItem[];
  dueDateFor: (it: ScheduledItem) => Date;
  onDateChange: (id: string, iso: string) => void;
}) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const dayItems = items.filter((it) => sameDay(dueDateFor(it), d));
        const isToday = sameDay(d, new Date());
        return (
          <div key={d.toISOString()} className={`border rounded min-h-[160px] p-1.5 ${isToday ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              {d.toLocaleDateString("en-US", { weekday: "short" })}
            </div>
            <div className={`text-sm font-medium ${isToday ? "text-amber-700 dark:text-amber-300" : ""}`}>{d.getDate()}</div>
            <div className="mt-1">
              {dayItems.map((it) => (
                <ItemPill key={it.task.id} item={it} dueDateFor={dueDateFor} onDateChange={onDateChange} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  cursor,
  items,
  dueDateFor,
  onDateChange,
}: {
  cursor: Date;
  items: ScheduledItem[];
  dueDateFor: (it: ScheduledItem) => Date;
  onDateChange: (id: string, iso: string) => void;
}) {
  const first = startOfMonth(cursor);
  const gridStart = startOfWeek(first);
  const lastOfMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
  const days = daysBetween(gridStart, gridEnd);
  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
          <div key={w} className="text-[10px] font-semibold text-muted-foreground uppercase text-center">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const dayItems = items.filter((it) => sameDay(dueDateFor(it), d));
          const isToday = sameDay(d, new Date());
          const isOtherMonth = d.getMonth() !== cursor.getMonth();
          return (
            <div
              key={d.toISOString()}
              className={`border rounded min-h-[90px] p-1 ${isToday ? "bg-amber-50 dark:bg-amber-950/20" : ""} ${isOtherMonth ? "opacity-40" : ""}`}
            >
              <div className={`text-xs ${isToday ? "font-semibold text-amber-700 dark:text-amber-300" : ""}`}>{d.getDate()}</div>
              <div>
                {dayItems.slice(0, 3).map((it) => (
                  <ItemPill key={it.task.id} item={it} dueDateFor={dueDateFor} onDateChange={onDateChange} />
                ))}
                {dayItems.length > 3 && <div className="text-[9px] text-muted-foreground">+{dayItems.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
