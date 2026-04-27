"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  trackBadgeClasses,
  priorityPillClasses,
  priorityDotClasses,
} from "@/lib/format";
import { CloseDealDialog } from "./close-deal-dialog";
import { KillDealDialog } from "./kill-deal-dialog";
import type { DealDetail } from "@/lib/deals-query";

/**
 * Phase 2 Plan 05 — Deal detail header (UI-SPEC lines 163-195).
 *
 * Two lines:
 *   Line 1: back link "Back to deals"
 *   Line 2: title + file_no (mono) + TrackBadge + PriorityPill + StatusBadge
 *           (hidden when status='active') + right cluster with Edit + overflow
 *
 * Overflow menu items (UI-SPEC Assumption 2):
 *   - Mark as closed  → opens CloseDealDialog (default variant)
 *   - Kill deal…      → opens KillDealDialog (destructive)
 *   - Killed deal:    both items collapse to disabled "Deal is killed"
 *   - Closed deal:    both items collapse to disabled "Deal is closed"
 *
 * Killed-deal chrome: status badge uses destructive colors; body text on the
 * detail page gets opacity-80 (applied at parent level where needed).
 */
export function DealHeader(props: { deal: DealDetail }) {
  const { deal } = props;
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [killOpen, setKillOpen] = React.useState(false);

  const isKilled = deal.status === "killed";
  const isClosed = deal.status === "closed";
  const isTerminal = isKilled || isClosed;

  return (
    <div className={isKilled ? "opacity-80" : undefined}>
      {/* Line 1 — breadcrumb / back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to deals
      </Link>

      {/* Line 2 — title row */}
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-xl font-semibold">{deal.title}</h1>
          <span className="font-mono text-[13px] text-muted-foreground">
            {deal.fileNo}
          </span>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
              trackBadgeClasses[deal.trackCode] ?? ""
            }`}
          >
            {deal.trackLabel}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
              priorityPillClasses[deal.priority] ?? ""
            }`}
          >
            <span
              className={priorityDotClasses[deal.priority] ?? ""}
              aria-hidden="true"
            />
            {deal.priority}
          </span>
          {isKilled ? (
            <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive ring-1 ring-destructive/30">
              Killed
            </span>
          ) : null}
          {isClosed ? (
            <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground ring-1 ring-border">
              Closed
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" disabled={isTerminal}>
            Edit deal
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {isKilled ? (
                <DropdownMenuItem disabled>Deal is killed</DropdownMenuItem>
              ) : isClosed ? (
                <DropdownMenuItem disabled>Deal is closed</DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => setCloseOpen(true)}>
                    Mark as closed
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setKillOpen(true)}
                  >
                    Kill deal…
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Dialogs — mounted unconditionally (controlled open state) */}
      <CloseDealDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        deal={deal}
      />
      <KillDealDialog open={killOpen} onOpenChange={setKillOpen} deal={deal} />
    </div>
  );
}
