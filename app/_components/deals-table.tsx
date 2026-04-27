"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import { DealRow } from "./deal-row";
import {
  parseFilterParams,
  serializeFilterParams,
  type SortValue,
} from "@/lib/filter-params";
import type { DealListRow } from "@/lib/deals-query";

/**
 * Phase 1 Plan 06 Task 3 — deals table with sortable headers.
 *
 * Client component so the sortable column headers can call router.push to
 * update the `sort=` URL param (D-07 URL-state driven). The server component
 * (app/page.tsx) re-renders on URL change, re-queries, and passes fresh rows
 * here.
 *
 * Sortable per UI-SPEC Page 1: Activity, Task Due By, Priority, File #.
 * Non-sortable headers are plain labels. Click cycles: desc → asc → default.
 */

type ColumnSpec = {
  header: string;
  minWidth: string; // tailwind min-width class
  sortKey?: "activity" | "task_due" | "priority" | "file_no";
  align?: "left" | "right";
};

const COLUMNS: ColumnSpec[] = [
  { header: "Tracking", minWidth: "min-w-[120px]" },
  { header: "Priority", minWidth: "min-w-[104px]", sortKey: "priority" },
  { header: "File #", minWidth: "min-w-[136px]", sortKey: "file_no" },
  { header: "Main Contact", minWidth: "min-w-[180px]" },
  { header: "Address", minWidth: "min-w-[260px]" },
  { header: "Milestone", minWidth: "min-w-[180px]" },
  { header: "Progress / Next Task", minWidth: "min-w-[220px]" },
  { header: "Task Due By", minWidth: "min-w-[128px]", sortKey: "task_due" },
  { header: "Quick Note", minWidth: "min-w-[240px]" },
  { header: "Activity", minWidth: "min-w-[112px]", sortKey: "activity", align: "right" },
];

/**
 * Cycle the sort for a given column key when the header is clicked.
 * desc → asc → default (activity_desc).
 */
function cycleSort(
  columnKey: "activity" | "task_due" | "priority" | "file_no",
  current: SortValue,
): SortValue {
  const descVal = `${columnKey}_desc` as SortValue;
  const ascVal = `${columnKey}_asc` as SortValue;
  if (current === descVal) return ascVal;
  if (current === ascVal) return "activity_desc";
  return descVal;
}

export function DealsTable({ deals }: { deals: DealListRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spRecord: Record<string, string> = {};
  searchParams.forEach((v, k) => (spRecord[k] = v));
  const filters = parseFilterParams(spRecord);
  const currentSort = filters.sort;

  function onSortClick(columnKey: ColumnSpec["sortKey"]) {
    if (!columnKey) return;
    const next = cycleSort(columnKey, currentSort);
    const serialized = serializeFilterParams({ ...filters, sort: next });
    const qs = serialized.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {COLUMNS.map((col) => {
            const isSortable = !!col.sortKey;
            const isActive =
              isSortable &&
              (currentSort === `${col.sortKey}_desc` ||
                currentSort === `${col.sortKey}_asc`);
            const isDesc = isActive && currentSort === `${col.sortKey}_desc`;
            const isAsc = isActive && currentSort === `${col.sortKey}_asc`;

            const baseClasses =
              "text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground";
            const activeClasses = isActive
              ? "text-foreground"
              : "";
            const alignClass = col.align === "right" ? "text-right" : "text-left";

            return (
              <TableHead
                key={col.header}
                className={`${col.minWidth} py-3 px-3 ${alignClass} ${baseClasses} ${activeClasses}`}
              >
                {isSortable ? (
                  <button
                    type="button"
                    onClick={() => onSortClick(col.sortKey)}
                    className={`inline-flex items-center gap-1 cursor-pointer hover:text-foreground ${
                      col.align === "right" ? "ml-auto" : ""
                    }`}
                  >
                    <span>{col.header}</span>
                    {isDesc ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : isAsc ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {deals.map((d) => (
          <DealRow key={d.id} deal={d} />
        ))}
      </TableBody>
    </Table>
  );
}
