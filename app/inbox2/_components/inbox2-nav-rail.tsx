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

import { useMemo, useState } from "react";
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
  Plus,
  MoreHorizontal,
  ChevronRight,
  ArrowDownUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NAV_VIEW_ORDER,
  FILES_NAV_VIEWS,
  type Group,
  type NavView,
  type ViewBadge,
} from "@/mock/types";
import {
  NAV_VIEW_LABEL,
  sortFileNumbers,
  uniqueByFileNumbers,
  uniqueMultiFileNumbers,
  type FileNoSortDir,
} from "@/mock/inbox2";
import { FileStack, FilePlus2, FileQuestion } from "lucide-react";

const NAV_ICON: Record<NavView, LucideIcon> = {
  "inbox": Inbox,
  "team-inboxes": Users,
  "calendars": Calendar,
  "assigned-me": UserCheck,
  "assigned-others": UserPlus2,
  "comments": MessageSquare,
  "trash": Trash2,
  "spam": ShieldAlert,
  "files-by-file": FileStack,
  "files-multi": FilePlus2,
  "files-unassigned": FileQuestion,
};

type Props = {
  navView: NavView;
  onChange: (next: NavView) => void;
  /**
   * Per-view badge map. `urgent > 0` ⇒ red badge with urgent count;
   * otherwise neutral badge with `total`.
   */
  badges?: Partial<Record<NavView, ViewBadge>>;
  /** Visible (non-hidden) groups, rendered as nav items. */
  groups: Group[];
  /** All groups (incl. hidden) — drives the `...` filter dropdown. */
  allGroups: Group[];
  hiddenGroupIds: Set<string>;
  onCreateGroup: () => void;
  onToggleGroupHidden: (id: string) => void;
  groupId: Group["id"];
  onGroupChange: (next: Group["id"]) => void;
  groupBadges?: Partial<Record<Group["id"], ViewBadge>>;
  /** Open the Settings dialog (full-viewport overlay, not a route). */
  onOpenSettings: () => void;
  /** Currently selected file number (drives row filter). null = no filter. */
  selectedFileNo: string | null;
  onFileNoChange: (next: string | null) => void;
  byFileSort: FileNoSortDir;
  onByFileSortChange: (next: FileNoSortDir) => void;
  multiFileSort: FileNoSortDir;
  onMultiFileSortChange: (next: FileNoSortDir) => void;
};

export function Inbox2NavRail({
  navView,
  onChange,
  badges,
  groups,
  allGroups,
  hiddenGroupIds,
  onCreateGroup,
  onToggleGroupHidden,
  groupId,
  onGroupChange,
  groupBadges,
  onOpenSettings,
  selectedFileNo,
  onFileNoChange,
  byFileSort,
  onByFileSortChange,
  multiFileSort,
  onMultiFileSortChange,
}: Props) {
  const [byFileExpanded, setByFileExpanded] = useState(false);
  const [multiFileExpanded, setMultiFileExpanded] = useState(false);

  const byFileNumbers = useMemo(
    () => sortFileNumbers(uniqueByFileNumbers(), byFileSort),
    [byFileSort],
  );
  const multiFileNumbers = useMemo(
    () => sortFileNumbers(uniqueMultiFileNumbers(), multiFileSort),
    [multiFileSort],
  );
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
      {NAV_VIEW_ORDER.filter((v) => !FILES_NAV_VIEWS.includes(v)).map((v) => (
        <NavItem
          key={v}
          icon={NAV_ICON[v]}
          label={NAV_VIEW_LABEL[v]}
          active={navView === v}
          onClick={() => handleViewClick(v)}
          badge={badges?.[v]}
        />
      ))}

      <SectionHeaderRow label="Custom Groups">
        <button
          type="button"
          aria-label="Create custom group"
          title="Create custom group"
          onClick={onCreateGroup}
          className="rounded p-0.5 text-muted-foreground/70 hover:bg-background/60 hover:text-foreground outline-none"
        >
          <Plus className="h-3 w-3" aria-hidden />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded p-0.5 text-muted-foreground/70 hover:bg-background/60 hover:text-foreground outline-none"
            aria-label="Filter custom groups"
            title="Show / hide custom groups"
          >
            <MoreHorizontal className="h-3 w-3" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Show in rail
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allGroups.length === 0 ? (
                <div className="px-2 py-1.5 text-[11px] text-muted-foreground italic">
                  No groups yet — use + to create one.
                </div>
              ) : (
                allGroups.map((g) => {
                  const visible = !hiddenGroupIds.has(g.id);
                  return (
                    <label
                      key={g.id}
                      className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/40 rounded"
                    >
                      <Checkbox
                        checked={visible}
                        onCheckedChange={() => onToggleGroupHidden(g.id)}
                      />
                      <span className="flex-1 truncate">{g.name}</span>
                    </label>
                  );
                })
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SectionHeaderRow>
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
        FILES section — surface for testing route-to-file functionality.
        Each item maps to an existing InboxTab via NAV_VIEW_TO_INBOX_TAB
        in mock/inbox2.ts, reusing the classic surface's per-tab row
        slices (rowsForTab) and supporting fixtures (multiFileRows /
        unassignedRows).
        REINTEGRATION: at L2 these become server-driven counts; the
        primary dead call `addThreadToFile` (PROTOTYPE-DEAD-CALLS.md row 1)
        is reachable from the row context menu via the existing
        `AddThreadToDealDialog`.
      */}
      <SectionHeader>Files</SectionHeader>
      <CollapsibleFilesNavItem
        view="files-by-file"
        icon={NAV_ICON["files-by-file"]}
        label={NAV_VIEW_LABEL["files-by-file"]}
        active={navView === "files-by-file"}
        badge={badges?.["files-by-file"]}
        expanded={byFileExpanded}
        onToggleExpand={() => setByFileExpanded((v) => !v)}
        onParentClick={() => {
          // Click parent = navigate to view + clear file filter. Caret
          // is the only expansion control so navigation feels distinct.
          if (selectedFileNo) onFileNoChange(null);
          handleViewClick("files-by-file");
        }}
        fileNumbers={byFileNumbers}
        selectedFileNo={navView === "files-by-file" ? selectedFileNo : null}
        onFileClick={(fileNo) => {
          if (navView !== "files-by-file") handleViewClick("files-by-file");
          onFileNoChange(fileNo);
        }}
        sort={byFileSort}
        onSortChange={onByFileSortChange}
      />
      <CollapsibleFilesNavItem
        view="files-multi"
        icon={NAV_ICON["files-multi"]}
        label={NAV_VIEW_LABEL["files-multi"]}
        active={navView === "files-multi"}
        badge={badges?.["files-multi"]}
        expanded={multiFileExpanded}
        onToggleExpand={() => setMultiFileExpanded((v) => !v)}
        onParentClick={() => {
          if (selectedFileNo) onFileNoChange(null);
          handleViewClick("files-multi");
        }}
        fileNumbers={multiFileNumbers}
        selectedFileNo={navView === "files-multi" ? selectedFileNo : null}
        onFileClick={(fileNo) => {
          if (navView !== "files-multi") handleViewClick("files-multi");
          onFileNoChange(fileNo);
        }}
        sort={multiFileSort}
        onSortChange={onMultiFileSortChange}
      />
      <NavItem
        icon={NAV_ICON["files-unassigned"]}
        label={NAV_VIEW_LABEL["files-unassigned"]}
        active={navView === "files-unassigned"}
        onClick={() => handleViewClick("files-unassigned")}
        badge={badges?.["files-unassigned"]}
      />

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

function SectionHeaderRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 mb-1 px-2.5 flex items-center justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      <div className="flex items-center gap-0.5 -mr-1">{children}</div>
    </div>
  );
}

function CollapsibleFilesNavItem({
  icon: Icon,
  label,
  active,
  badge,
  expanded,
  onToggleExpand,
  onParentClick,
  fileNumbers,
  selectedFileNo,
  onFileClick,
  sort,
  onSortChange,
}: {
  view: NavView;
  icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: ViewBadge;
  expanded: boolean;
  onToggleExpand: () => void;
  onParentClick: () => void;
  fileNumbers: string[];
  selectedFileNo: string | null;
  onFileClick: (fileNo: string) => void;
  sort: FileNoSortDir;
  onSortChange: (next: FileNoSortDir) => void;
}) {
  const total = badge?.total ?? 0;
  const isUrgent = (badge?.urgent ?? 0) > 0;
  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded transition-colors",
          active
            ? "bg-background font-medium text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
        )}
      >
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          className="shrink-0 rounded p-1 outline-none hover:bg-background/40"
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 transition-transform",
              expanded && "rotate-90",
            )}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={onParentClick}
          aria-current={active ? "page" : undefined}
          className="flex-1 min-w-0 flex items-center gap-2 px-1 py-1.5 text-xs text-left outline-none"
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="flex-1 truncate">{label}</span>
          {total > 0 ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums mr-1",
                isUrgent
                  ? "bg-rose-500 text-white"
                  : active
                    ? "bg-muted-foreground/20 text-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {total}
            </span>
          ) : null}
        </button>
      </div>
      {expanded ? (
        <div className="ml-4 mt-0.5 mb-1 border-l border-border/40 pl-1">
          <div className="flex items-center justify-between px-1.5 py-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {fileNumbers.length} file{fileNumbers.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={() =>
                onSortChange(sort === "newest" ? "oldest" : "newest")
              }
              title={`Sort: ${sort === "newest" ? "Newest first" : "Oldest first"} (click to flip)`}
              className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-background/60 hover:text-foreground outline-none"
            >
              <ArrowDownUp className="h-2.5 w-2.5" aria-hidden />
              {sort === "newest" ? "Newest" : "Oldest"}
            </button>
          </div>
          {fileNumbers.length === 0 ? (
            <div className="px-2 py-1 text-[11px] text-muted-foreground/70 italic">
              No files yet
            </div>
          ) : (
            fileNumbers.map((fileNo) => {
              const sel = fileNo === selectedFileNo;
              return (
                <button
                  key={fileNo}
                  type="button"
                  onClick={() => onFileClick(fileNo)}
                  aria-current={sel ? "page" : undefined}
                  className={cn(
                    "w-full text-left rounded px-2 py-1 text-[11px] font-mono truncate transition-colors",
                    sel
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                  )}
                >
                  {fileNo}
                </button>
              );
            })
          )}
        </div>
      ) : null}
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
