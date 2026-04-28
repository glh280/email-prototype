"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell view-mode dropdown)
 * CREATED: 2026-04-27
 * STATUS: new (mirrors nav rail state — both controls write the same
 *   shell.navView slot)
 * REINTEGRATION: Phase 2+ likely consolidates view selection into the
 *   nav rail OR top bar (one of the two). Today both exist for muscle-
 *   memory exploration during visual review.
 *
 * Top-bar dropdown for the queue type. The 6 primary inbox views go in
 * the main group; sent/drafts go in a secondary group. `settings` is
 * deliberately excluded — settings is reached via the nav rail or
 * avatar menu, not the top scope row.
 */

import {
  ChevronDown,
  Inbox,
  FileText,
  Layers,
  HelpCircle,
  Users,
  ShieldAlert,
  Send,
  FileEdit,
  Check,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NavView } from "@/mock/types";
import { NAV_VIEW_LABEL } from "@/mock/inbox2";

const VIEW_ICON: Record<Exclude<NavView, "settings">, LucideIcon> = {
  all: Inbox,
  "by-file": FileText,
  "multi-file": Layers,
  unassigned: HelpCircle,
  team: Users,
  spam: ShieldAlert,
  sent: Send,
  drafts: FileEdit,
};

const PRIMARY: readonly NavView[] = [
  "all",
  "by-file",
  "multi-file",
  "unassigned",
  "team",
  "spam",
] as const;

const SECONDARY: readonly NavView[] = ["sent", "drafts"] as const;

type Props = {
  navView: NavView;
  onChange: (next: NavView) => void;
};

export function Inbox2ViewSelector({ navView, onChange }: Props) {
  // settings is unreachable via this control — fall back to "all" if state
  // is settings (the nav rail can still get there).
  const displayView: Exclude<NavView, "settings"> =
    navView === "settings" ? "all" : navView;
  const ActiveIcon = VIEW_ICON[displayView];

  function handleSelect(next: NavView) {
    if (next === navView) return;
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-view-selector change", { from: navView, to: next });
    onChange(next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded border bg-background px-2.5 py-1 text-xs hover:bg-muted/50 outline-none">
        <ActiveIcon className="h-3 w-3 text-muted-foreground" aria-hidden />
        <span className="font-medium">{NAV_VIEW_LABEL[displayView]}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
          View
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PRIMARY.map((v) => (
          <ViewItem
            key={v}
            view={v}
            active={navView === v}
            onClick={() => handleSelect(v)}
          />
        ))}
        <DropdownMenuSeparator />
        {SECONDARY.map((v) => (
          <ViewItem
            key={v}
            view={v}
            active={navView === v}
            onClick={() => handleSelect(v)}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ViewItem({
  view,
  active,
  onClick,
}: {
  view: NavView;
  active: boolean;
  onClick: () => void;
}) {
  if (view === "settings") return null;
  const Icon = VIEW_ICON[view];
  return (
    <DropdownMenuItem
      onClick={onClick}
      className="text-xs flex items-center gap-2"
    >
      <Icon className="h-3 w-3 text-muted-foreground" aria-hidden />
      <span className="flex-1">{NAV_VIEW_LABEL[view]}</span>
      {active ? (
        <Check className="h-3 w-3 text-primary shrink-0" aria-hidden />
      ) : null}
    </DropdownMenuItem>
  );
}
