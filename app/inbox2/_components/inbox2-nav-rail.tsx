"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell left navigation rail)
 * CREATED: 2026-04-27
 * STATUS: new (stubbed click)
 * REINTEGRATION: Phase 2+ replaces local navView state with URL push
 *   (`/inbox2/<view>` or `?view=`). Groups section becomes server-driven.
 *
 * Iter (2026-04-27): Missive realignment. NavView union shrunk to the
 * 8 left-rail items; groups now own the bottom of this rail (formerly a
 * top-bar dropdown). Settings dropped from this rail — reachable via the
 * Avatar menu in the top bar.
 *
 * Vertical icon+label nav. Click sets shell.navView OR shell.groupId. No
 * router push in Phase 1.
 */

import {
  Inbox,
  Users,
  Calendar,
  UserCheck,
  UserPlus2,
  MessageSquare,
  Trash2,
  ShieldAlert,
  Tag,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_VIEW_ORDER, type Group, type NavView, type ViewBadge } from "@/mock/types";
import { NAV_VIEW_LABEL } from "@/mock/inbox2";

const NAV_ICON: Record<NavView, LucideIcon> = {
  "inbox": Inbox,
  "team-inboxes": Users,
  "calendars": Calendar,
  "assigned-me": UserCheck,
  "assigned-others": UserPlus2,
  "comments": MessageSquare,
  "trash": Trash2,
  "spam": ShieldAlert,
};

type Props = {
  navView: NavView;
  onChange: (next: NavView) => void;
  /**
   * Per-view badge map. `urgent > 0` ⇒ red badge with urgent count;
   * otherwise neutral badge with `total`.
   */
  badges?: Partial<Record<NavView, ViewBadge>>;
  groups: Group[];
  groupId: Group["id"];
  onGroupChange: (next: Group["id"]) => void;
  groupBadges?: Partial<Record<Group["id"], ViewBadge>>;
  /** Open the Settings dialog (full-viewport overlay, not a route). */
  onOpenSettings: () => void;
};

export function Inbox2NavRail({
  navView,
  onChange,
  badges,
  groups,
  groupId,
  onGroupChange,
  groupBadges,
  onOpenSettings,
}: Props) {
  function handleViewClick(next: NavView) {
    // No early-return on same navView — re-clicking "Inbox" while a Custom
    // Group is active is the operator's reset gesture (the shell handler
    // clears groupId on inbox click). For other views the patch is
    // idempotent.
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-nav-rail view click", { from: navView, to: next });
    onChange(next);
  }

  function handleGroupClick(next: Group["id"]) {
    if (next === groupId) return;
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-nav-rail group click", { from: groupId, to: next });
    onGroupChange(next);
  }

  return (
    <nav
      aria-label="Inbox views"
      className="h-full w-full shrink-0 bg-muted/20 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto"
    >
      {NAV_VIEW_ORDER.map((v) => (
        <NavItem
          key={v}
          icon={NAV_ICON[v]}
          label={NAV_VIEW_LABEL[v]}
          active={navView === v}
          onClick={() => handleViewClick(v)}
          badge={badges?.[v]}
        />
      ))}

      <SectionHeader>Custom Groups</SectionHeader>
      {groups.map((g) => (
        <NavItem
          key={g.id}
          icon={Tag}
          label={g.name}
          active={groupId === g.id}
          onClick={() => handleGroupClick(g.id)}
          badge={groupBadges?.[g.id]}
        />
      ))}

      {/*
        Settings opens a full-viewport overlay (SettingsDialog) — not a
        route. Always pinned to the bottom of the rail; mt-auto pushes it
        down inside the flex column. Operator stays in inbox context and
        dismisses with esc / close.
      */}
      <button
        type="button"
        onClick={onOpenSettings}
        className={cn(
          "mt-auto flex items-center gap-2 rounded px-2.5 py-1.5 text-xs text-left transition-colors",
          "text-muted-foreground hover:bg-background/60 hover:text-foreground",
        )}
      >
        <Settings className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="flex-1 truncate">Settings</span>
      </button>
    </nav>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
      {children}
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: ViewBadge;
}) {
  // Always show TOTAL unread; color signals urgency. Earlier model showed
  // `urgent` count when urgent>0 (hiding total) — operator misread "2"
  // as "2 unread" when 4 rows were actually unread. Number now matches
  // visible bold rows; rose tint means at least one is HIGH priority.
  const total = badge?.total ?? 0;
  const isUrgent = (badge?.urgent ?? 0) > 0;
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
      <span className="flex-1 truncate">{label}</span>
      {total > 0 ? (
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
              ? `${total} unread (${badge!.urgent} high priority)`
              : `${total} unread`
          }
          title={
            isUrgent
              ? `${total} unread · ${badge!.urgent} high priority`
              : `${total} unread`
          }
        >
          {total}
        </span>
      ) : null}
    </button>
  );
}
