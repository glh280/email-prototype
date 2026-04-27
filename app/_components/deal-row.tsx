"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  trackBadgeClasses,
  priorityPillClasses,
  priorityDotClasses,
  relativeTime,
} from "@/lib/format";
import type { DealListRow } from "@/lib/deals-query";

/**
 * Phase 1 Plan 06 Task 3 — one table row for the deals list.
 *
 * Client Component because the whole row is clickable (router.push to
 * /deal/{id}). The File # column is a real <Link> with e.stopPropagation so
 * middle-click / cmd-click open a new tab cleanly (UI-SPEC Page 1).
 *
 * Column order matches VIEW-01 verbatim:
 *   1. Tracking (track badge)
 *   2. Priority (dot + pill)
 *   3. File #
 *   4. Main Contact
 *   5. Address
 *   6. Milestone
 *   7. Progress / Next Task       — P2 data, em-dash in P1 (D-16)
 *   8. Task Due By                — P2 data, em-dash in P1 (D-16)
 *   9. Quick Note
 *   10. Activity (right-aligned, mono, relative time)
 *
 * Killed deals render dimmed (text-muted-foreground) per UI-SPEC row states.
 */
const EM_DASH = "—";

export function DealRow({ deal }: { deal: DealListRow }) {
  const router = useRouter();
  const killed = deal.status === "killed";

  function onRowClick() {
    router.push(`/deal/${deal.id}`);
  }

  function onRowKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/deal/${deal.id}`);
    }
  }

  return (
    <TableRow
      role="button"
      tabIndex={0}
      onClick={onRowClick}
      onKeyDown={onRowKeyDown}
      className={`h-12 cursor-pointer hover:bg-muted/40 ${
        killed ? "text-muted-foreground" : ""
      }`}
    >
      {/* 1. Tracking */}
      <TableCell className="min-w-[120px] py-3 px-3">
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
            trackBadgeClasses[deal.trackCode] ?? ""
          }`}
        >
          {deal.trackLabel}
        </span>
      </TableCell>

      {/* 2. Priority */}
      <TableCell className="min-w-[104px] py-3 px-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${
            priorityPillClasses[deal.priority] ?? ""
          }`}
        >
          <span className={priorityDotClasses[deal.priority] ?? ""} />
          {deal.priority}
        </span>
      </TableCell>

      {/* 3. File # — hard link (stopPropagation so new-tab works cleanly) */}
      <TableCell className="min-w-[136px] py-3 px-3 font-mono text-[13px]">
        <Link
          href={`/deal/${deal.id}`}
          className="hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {deal.fileNo}
        </Link>
      </TableCell>

      {/* 4. Main Contact */}
      <TableCell
        className="min-w-[180px] max-w-[180px] py-3 px-3 truncate"
        title={deal.mainContactName ?? undefined}
      >
        {deal.mainContactName ?? (
          <span className="text-muted-foreground/70">{EM_DASH}</span>
        )}
      </TableCell>

      {/* 5. Address */}
      <TableCell
        className="min-w-[260px] max-w-[260px] py-3 px-3 truncate"
        title={deal.propertyAddress ?? undefined}
      >
        {deal.propertyAddress ?? (
          <span className="text-muted-foreground/70">{EM_DASH}</span>
        )}
      </TableCell>

      {/* 6. Milestone */}
      <TableCell className="min-w-[180px] py-3 px-3">
        <span className="inline-flex items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border px-2 py-0.5 text-[11px] font-medium">
          {deal.stageLabel}
        </span>
      </TableCell>

      {/* 7. Progress / Next Task — P2 data, em-dash in P1 (D-16) */}
      <TableCell className="min-w-[220px] py-3 px-3">
        <span className="text-muted-foreground/70">{EM_DASH}</span>
      </TableCell>

      {/* 8. Task Due By — P2 data, em-dash in P1 (D-16) */}
      <TableCell className="min-w-[128px] py-3 px-3">
        <span className="text-muted-foreground/70">{EM_DASH}</span>
      </TableCell>

      {/* 9. Quick Note */}
      <TableCell
        className="min-w-[240px] max-w-[240px] py-3 px-3 truncate"
        title={deal.quickNote ?? undefined}
      >
        {deal.quickNote ?? (
          <span className="text-muted-foreground/70">{EM_DASH}</span>
        )}
      </TableCell>

      {/* 10. Activity — right-aligned, mono, relative time */}
      <TableCell className="min-w-[112px] py-3 px-3 text-right text-muted-foreground text-xs font-mono">
        {relativeTime(deal.activityAt)}
      </TableCell>
    </TableRow>
  );
}
