"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { UserCheck, AlertCircle, Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  parseFilterParams,
  serializeFilterParams,
  type FilterParams,
  type TrackCode,
  type PriorityValue,
} from "@/lib/filter-params";
import type { Track } from "@/db/schema";
import type { StageSeed } from "@/db/seed/stages";

/**
 * Phase 1 Plan 06 Task 3 — list-view filter bar.
 *
 * 9 controls per UI-SPEC Page 1:
 *   1. Needs me (toggle)
 *   2. Track (multi)
 *   3. Milestone (multi)
 *   4. Priority (multi)
 *   5. Overdue (toggle)
 *   6. Closing date (range)
 *   7. Funding date (range)
 *   8. Task due date (range) — P2 data; filter present but no-op in query
 *   9. Clear all (visible only when a filter is active)
 *
 * State lives in URL search params (D-07). Every change serializes filters
 * and calls router.push, which causes the server component (app/page.tsx)
 * to re-query.
 *
 * Multi-selects are Popover + Checkbox (shadcn Select is single-select only).
 */

const PRIORITIES: PriorityValue[] = ["HIGH", "MEDIUM", "LOW"];

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dateRangeLabel(
  r: { from: Date; to: Date } | null,
  placeholder: string,
): string {
  if (!r) return `${placeholder}: Any`;
  return `${placeholder}: ${fmtDate(r.from)} – ${fmtDate(r.to)}`;
}

export function DealsFilterBar({
  tracks,
  stages,
}: {
  tracks: Pick<Track, "code" | "label">[] | ReadonlyArray<{ code: string; label: string }>;
  stages: ReadonlyArray<StageSeed>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(() => {
    const record: Record<string, string> = {};
    searchParams.forEach((v, k) => (record[k] = v));
    return parseFilterParams(record);
  }, [searchParams]);

  function pushFilters(next: FilterParams) {
    const serialized = serializeFilterParams(next);
    const qs = serialized.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  function toggleNeedsMe() {
    pushFilters({ ...filters, needsMe: !filters.needsMe });
  }

  function toggleOverdue() {
    pushFilters({ ...filters, overdue: !filters.overdue });
  }

  function toggleTrack(code: TrackCode) {
    const next = filters.track.includes(code)
      ? filters.track.filter((c) => c !== code)
      : [...filters.track, code];
    pushFilters({ ...filters, track: next });
  }

  function toggleMilestone(code: string) {
    const next = filters.milestone.includes(code)
      ? filters.milestone.filter((c) => c !== code)
      : [...filters.milestone, code];
    pushFilters({ ...filters, milestone: next });
  }

  function togglePriority(p: PriorityValue) {
    const next = filters.priority.includes(p)
      ? filters.priority.filter((c) => c !== p)
      : [...filters.priority, p];
    pushFilters({ ...filters, priority: next });
  }

  function setDateRange(
    key: "closing" | "funding" | "taskDue",
    range: { from: Date; to: Date } | null,
  ) {
    pushFilters({ ...filters, [key]: range });
  }

  function clearAll() {
    router.push("/");
  }

  const hasAnyActive =
    filters.needsMe ||
    filters.overdue ||
    filters.track.length > 0 ||
    filters.milestone.length > 0 ||
    filters.priority.length > 0 ||
    !!filters.closing ||
    !!filters.funding ||
    !!filters.taskDue;

  // Label helpers for multi-select triggers
  function multiLabel(name: string, selected: string[], totalCount: number): string {
    if (selected.length === 0) return `${name}: All`;
    if (selected.length === 1) return `${name}: ${selected[0]}`;
    if (selected.length === totalCount) return `${name}: All`;
    return `${name}: ${selected.length} selected`;
  }

  return (
    <div
      className="bg-muted/40 rounded-md border p-3 flex flex-wrap items-center gap-2"
      role="toolbar"
      aria-label="Deals filters"
    >
      {/* 1. Needs me */}
      <Button
        variant={filters.needsMe ? "default" : "outline"}
        size="sm"
        onClick={toggleNeedsMe}
        aria-pressed={filters.needsMe}
        title="Deals where you're the internal owner"
      >
        <UserCheck className="h-4 w-4" />
        Needs me
      </Button>

      {/* 2. Track */}
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="min-w-[160px]">
              {multiLabel("Track", filters.track, tracks.length)}
            </Button>
          }
        />
        <PopoverContent className="w-[240px] p-2" align="start">
          <div className="flex flex-col gap-1">
            {tracks.map((t) => {
              const checked = filters.track.includes(t.code as TrackCode);
              return (
                <label
                  key={t.code}
                  className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleTrack(t.code as TrackCode)}
                  />
                  <span>{t.label}</span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* 3. Milestone */}
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="min-w-[200px]">
              {multiLabel("Milestone", filters.milestone, stages.length)}
            </Button>
          }
        />
        <PopoverContent className="w-[320px] p-2 max-h-[360px] overflow-y-auto" align="start">
          <div className="flex flex-col gap-1">
            {stages.map((s) => {
              const checked = filters.milestone.includes(s.code);
              return (
                <label
                  key={s.code}
                  className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleMilestone(s.code)}
                  />
                  <span>{s.label}</span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* 4. Priority */}
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="min-w-[160px]">
              {multiLabel("Priority", filters.priority, PRIORITIES.length)}
            </Button>
          }
        />
        <PopoverContent className="w-[200px] p-2" align="start">
          <div className="flex flex-col gap-1">
            {PRIORITIES.map((p) => {
              const checked = filters.priority.includes(p);
              return (
                <label
                  key={p}
                  className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => togglePriority(p)}
                  />
                  <span>{p}</span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* 5. Overdue */}
      <Button
        variant={filters.overdue ? "default" : "outline"}
        size="sm"
        onClick={toggleOverdue}
        aria-pressed={filters.overdue}
      >
        <AlertCircle className="h-4 w-4" />
        Overdue
      </Button>

      {/* 6. Closing date */}
      <DateRangePopover
        label="Closing"
        value={filters.closing}
        onChange={(r) => setDateRange("closing", r)}
      />

      {/* 7. Funding date */}
      <DateRangePopover
        label="Funding"
        value={filters.funding}
        onChange={(r) => setDateRange("funding", r)}
      />

      {/* 8. Task due date */}
      <DateRangePopover
        label="Task due"
        value={filters.taskDue}
        onChange={(r) => setDateRange("taskDue", r)}
      />

      {/* 9. Clear all — only visible when a filter is active */}
      {hasAnyActive ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="ml-auto text-muted-foreground hover:text-foreground"
        >
          Clear all
        </Button>
      ) : null}
    </div>
  );
}

function DateRangePopover({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { from: Date; to: Date } | null;
  onChange: (v: { from: Date; to: Date } | null) => void;
}) {
  const display = dateRangeLabel(value, label);
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="min-w-[200px]">
            <CalendarIcon className="h-4 w-4" />
            {display}
            {value ? (
              <X
                className="h-3 w-3 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            ) : null}
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value ? { from: value.from, to: value.to } : undefined}
          onSelect={(sel) => {
            if (sel && sel.from && sel.to) {
              onChange({ from: sel.from, to: sel.to });
            }
          }}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
