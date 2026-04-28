"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell list-pane header)
 * CREATED: 2026-04-27
 * STATUS: new (stubbed action buttons)
 * REINTEGRATION: Phase 2+ wires action buttons to bulk-action APIs.
 *
 * Iter (2026-04-27): Missive realignment. Search input + filter chips
 * removed — both moved to top bar. Sub-header now shows view title +
 * thread count + per-list actions (Mark all read / Refresh / Sort).
 */

import { ArrowDownUp, RefreshCw, MailOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { NavView } from "@/mock/types";
import { NAV_VIEW_LABEL } from "@/mock/inbox2";

type Props = {
  navView: NavView;
  matchCount: number;
};

export function Inbox2SubHeader({ navView, matchCount }: Props) {
  function actionClick(action: string) {
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-sub-header action", { action, navView });
    toast(`${action} — stub (no wire-up in Phase 1)`);
  }

  return (
    <div className="border-b bg-background px-4 py-2 flex items-center gap-2 flex-wrap">
      <h2 className="text-sm font-semibold mr-2">{NAV_VIEW_LABEL[navView]}</h2>
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {matchCount} {matchCount === 1 ? "thread" : "threads"}
      </span>
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => actionClick("Mark all read")}
        className="h-7 text-xs gap-1"
      >
        <MailOpen className="h-3.5 w-3.5" />
        Mark all read
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => actionClick("Refresh")}
        className="h-7 text-xs gap-1"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => actionClick("Sort")}
        className="h-7 text-xs gap-1"
      >
        <ArrowDownUp className="h-3.5 w-3.5" />
        Sort
      </Button>
    </div>
  );
}
