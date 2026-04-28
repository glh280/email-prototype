"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell left navigation rail)
 * CREATED: 2026-04-27
 * STATUS: new (stubbed click)
 * REINTEGRATION: Phase 2+ replaces local navView state with URL push
 *   (`/inbox2/<view>` or `?view=`).
 *
 * Vertical icon+label nav. Click sets shell.navView. No router push in
 * Phase 1.
 */

import {
  Inbox,
  FileText,
  Layers,
  HelpCircle,
  Users,
  ShieldAlert,
  Send,
  FileEdit,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavView, ViewBadge } from "@/mock/types";
import { NAV_VIEW_LABEL } from "@/mock/inbox2";

const NAV_ICON: Record<NavView, LucideIcon> = {
  "all": Inbox,
  "by-file": FileText,
  "multi-file": Layers,
  "unassigned": HelpCircle,
  "team": Users,
  "spam": ShieldAlert,
  "sent": Send,
  "drafts": FileEdit,
  "settings": Settings,
};

const PRIMARY_ORDER: readonly NavView[] = [
  "all",
  "by-file",
  "multi-file",
  "unassigned",
  "team",
  "spam",
  "sent",
  "drafts",
] as const;

type Props = {
  navView: NavView;
  onChange: (next: NavView) => void;
  /**
   * Per-view badge map. `urgent > 0` ⇒ red badge with urgent count;
   * otherwise neutral badge with `total`.
   */
  badges?: Partial<Record<NavView, ViewBadge>>;
};

export function Inbox2NavRail({ navView, onChange, badges }: Props) {
  function handleClick(next: NavView) {
    if (next === navView) return;
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-nav-rail click", { from: navView, to: next });
    onChange(next);
  }

  return (
    <nav
      aria-label="Inbox views"
      className="h-full w-full shrink-0 bg-muted/20 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto"
    >
      {PRIMARY_ORDER.map((v) => (
        <NavButton
          key={v}
          view={v}
          active={navView === v}
          onClick={() => handleClick(v)}
          badge={badges?.[v]}
        />
      ))}
      <div className="my-2 border-t" />
      <NavButton
        view="settings"
        active={navView === "settings"}
        onClick={() => handleClick("settings")}
      />
    </nav>
  );
}

function NavButton({
  view,
  active,
  onClick,
  badge,
}: {
  view: NavView;
  active: boolean;
  onClick: () => void;
  badge?: ViewBadge;
}) {
  const Icon = NAV_ICON[view];
  const isUrgent = (badge?.urgent ?? 0) > 0;
  const count = isUrgent ? badge!.urgent : badge?.total ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded px-2.5 py-1.5 text-xs text-left transition-colors",
        active
          ? "bg-background font-medium text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{NAV_VIEW_LABEL[view]}</span>
      {count > 0 ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
            isUrgent
              ? "bg-rose-500 text-white"
              : active
                ? "bg-muted-foreground/20 text-foreground"
                : "bg-muted text-muted-foreground",
          )}
          aria-label={
            isUrgent
              ? `${badge!.urgent} urgent of ${badge!.total}`
              : `${count} total`
          }
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
