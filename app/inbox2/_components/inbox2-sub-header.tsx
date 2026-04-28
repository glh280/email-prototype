"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell list-pane header)
 * CREATED: 2026-04-27
 * STATUS: new (stubbed action buttons)
 * REINTEGRATION: Phase 2+ wires action buttons to bulk-action APIs.
 *
 * Iter (2026-04-27): Missive realignment. Search input + filter chips
 * moved to top bar. Sub-header shows view title + thread count + per-
 * list actions.
 *
 * Iter (2026-04-27): drop `flex-wrap` and switch actions to icon-only
 * buttons (with `title` tooltip). Center pane min is 380 px; previous
 * labelled buttons forced sort onto a second row at narrow widths.
 */

import { ArrowDownUp, RefreshCw, MailOpen, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { NavView } from "@/mock/types";
import { NAV_VIEW_LABEL } from "@/mock/inbox2";

type Props = {
  navView: NavView;
  matchCount: number;
  // When the user has selected a custom group (Title / Lending / etc.)
  // and is on the Inbox view, swap the title to that group's name. Other
  // NavViews ignore the group filter so we keep the NavView label.
  groupName: string | null;
};

export function Inbox2SubHeader({ navView, matchCount, groupName }: Props) {
  function actionClick(action: string) {
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-sub-header action", { action, navView });
    toast(`${action} — stub (no wire-up in Phase 1)`);
  }

  const title =
    navView === "inbox" && groupName ? groupName : NAV_VIEW_LABEL[navView];

  return (
    <div className="border-b bg-background px-4 py-2 flex items-center gap-2 min-w-0">
      <h2 className="text-sm font-semibold mr-1 truncate">{title}</h2>
      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
        {matchCount} {matchCount === 1 ? "thread" : "threads"}
      </span>
      <div className="flex-1" />
      <IconAction
        icon={MailOpen}
        label="Mark all read"
        onClick={() => actionClick("Mark all read")}
      />
      <IconAction
        icon={RefreshCw}
        label="Refresh"
        onClick={() => actionClick("Refresh")}
      />
      <IconAction
        icon={ArrowDownUp}
        label="Sort"
        onClick={() => actionClick("Sort")}
      />
    </div>
  );
}

function IconAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "shrink-0 inline-flex items-center justify-center rounded h-7 w-7",
        "text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
