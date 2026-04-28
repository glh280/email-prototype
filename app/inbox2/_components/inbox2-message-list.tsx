"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell list)
 * CREATED: 2026-04-27
 * STATUS: new (filters INBOX_ROWS by accountId + groupId + navView)
 * REINTEGRATION: Phase 2+ replaces with `queryInboxForUser({ accountId,
 *   groupId, navView, filters })` from server.
 *
 * Iter (2026-04-27): NavView union shrunk for Missive realignment.
 * Mapping to existing mock InboxTab data:
 *   - "inbox" → rowsForTab("all")
 *   - "spam"  → rowsForTab("spam")
 *   - everything else (team-inboxes / calendars / assigned-* / comments /
 *     trash) → empty placeholder. Real fixtures land in Phase 2+.
 */

import { useMemo } from "react";
import { Inbox, ArrowDownUp, ChevronRight } from "lucide-react";
import { Inbox2MessageRow } from "./inbox2-message-row";
import type { InboxRow, NavView } from "@/mock/types";
import { FILES_NAV_VIEWS } from "@/mock/types";
import {
  NAV_VIEW_LABEL,
  NAV_VIEW_TO_INBOX_TAB,
  sortFileNumbers,
  type FileNoSortDir,
} from "@/mock/inbox2";

type Props = {
  navView: NavView;
  rows: InboxRow[];
  selectedMessageId: string | null;
  onSelect: (messageId: string) => void;
  onToggleUnread: (messageId: string, nextUnread: boolean) => void;
  onAssign: (messageId: string, assigneeId: string | null) => void;
  assigneeOverrides: Record<string, string[]>;
  /** Set when a single file is selected — disables grouping (list shows
   * only that file's rows so a header would just duplicate the
   * sub-header chip). */
  selectedFileNo: string | null;
  byFileSort: FileNoSortDir;
  onByFileSortChange: (next: FileNoSortDir) => void;
  /**
   * File numbers the operator has explicitly EXPANDED. Default state
   * (file no NOT in this set) is collapsed — only unread rows render.
   * Operator clicks group header to flip; cookie persistence happens
   * in shell.
   */
  expandedFiles: Set<string>;
  onToggleFileExpanded: (fileNo: string) => void;
};

export function Inbox2MessageList({
  navView,
  rows,
  selectedMessageId,
  onSelect,
  onToggleUnread,
  onAssign,
  assigneeOverrides,
  selectedFileNo,
  byFileSort,
  onByFileSortChange,
  expandedFiles,
  onToggleFileExpanded,
}: Props) {
  // Route-to-file affordances (candidate chips / suggestion pill /
  // Change-file icon) only appear on FILES views — keeps the standard
  // Inbox row dense.
  const showFileAffordances = (FILES_NAV_VIEWS as readonly NavView[]).includes(
    navView,
  );

  // Group rows by fileNo for the "By File" view when no file is
  // selected. Group order follows shared FILES sort direction so the
  // nav-rail dropdown order matches the center-pane group order.
  const groups = useMemo(() => {
    if (navView !== "files-by-file" || selectedFileNo) return null;
    const map = new Map<string, InboxRow[]>();
    for (const r of rows) {
      const key = r.fileNo ?? "(no file)";
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    const orderedKeys = sortFileNumbers(Array.from(map.keys()), byFileSort);
    return orderedKeys.map((key) => ({ fileNo: key, rows: map.get(key) ?? [] }));
  }, [navView, selectedFileNo, rows, byFileSort]);

  if (rows.length === 0) {
    const hasMockedTab = NAV_VIEW_TO_INBOX_TAB[navView] !== undefined;
    return <EmptyState navView={navView} hasMockedTab={hasMockedTab} />;
  }

  function row(r: InboxRow) {
    return (
      <Inbox2MessageRow
        key={r.threadId}
        row={r}
        selected={r.messageId === selectedMessageId}
        onSelect={onSelect}
        onToggleUnread={onToggleUnread}
        onAssign={onAssign}
        assigneeIds={assigneeOverrides[r.messageId] ?? []}
        showFileAffordances={showFileAffordances}
      />
    );
  }

  if (groups) {
    return (
      <div className="overflow-y-auto h-full bg-background">
        <div className="flex items-center justify-between px-4 py-1.5 border-b bg-muted/20 text-[10px] uppercase tracking-wide text-muted-foreground/80 sticky top-0 z-10">
          <span>
            {groups.length} file{groups.length === 1 ? "" : "s"} ·{" "}
            {rows.length} thread{rows.length === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() =>
              onByFileSortChange(byFileSort === "newest" ? "oldest" : "newest")
            }
            title={`Sort by file number: ${
              byFileSort === "newest" ? "Newest first" : "Oldest first"
            } (click to flip)`}
            className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-background/60 hover:text-foreground outline-none"
          >
            <ArrowDownUp className="h-2.5 w-2.5" aria-hidden />
            {byFileSort === "newest" ? "Newest" : "Oldest"}
          </button>
        </div>
        {groups.map((g) => {
          const expanded = expandedFiles.has(g.fileNo);
          // Collapsed groups still surface unread rows so new mail
          // doesn't get hidden. "Collapsed" here means "hide read
          // rows" rather than "hide the entire group".
          const visibleRows = expanded
            ? g.rows
            : g.rows.filter((r) => r.isUnread);
          const hiddenCount = g.rows.length - visibleRows.length;
          return (
            <section key={g.fileNo}>
              <h3 className="sticky top-7 z-[5] border-b bg-muted/40 text-[11px] font-mono font-medium text-foreground/80">
                <button
                  type="button"
                  onClick={() => onToggleFileExpanded(g.fileNo)}
                  aria-expanded={expanded}
                  className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-muted/60 outline-none"
                >
                  <ChevronRight
                    className={[
                      "h-3 w-3 shrink-0 transition-transform text-muted-foreground",
                      expanded ? "rotate-90" : "",
                    ].join(" ")}
                    aria-hidden
                  />
                  <span>{g.fileNo}</span>
                  <span className="text-muted-foreground tabular-nums text-[10px] font-sans font-normal">
                    · {g.rows.length}
                  </span>
                  {!expanded && hiddenCount > 0 ? (
                    <span className="ml-auto text-[10px] font-sans font-normal text-muted-foreground/70">
                      {hiddenCount} read hidden
                    </span>
                  ) : null}
                </button>
              </h3>
              {visibleRows.length > 0 ? (
                <ul>{visibleRows.map(row)}</ul>
              ) : !expanded ? (
                // Collapsed AND zero unread → quiet group. Render a
                // tiny "all caught up" affordance so the group still
                // signals it exists without forcing rows.
                <div className="px-4 py-1 pl-9 text-[10px] italic text-muted-foreground/60 border-b">
                  All caught up — no unread.
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    );
  }

  return <ul className="overflow-y-auto h-full bg-background">{rows.map(row)}</ul>;
}

function EmptyState({
  navView,
  hasMockedTab,
}: {
  navView: NavView;
  hasMockedTab: boolean;
}) {
  const reason = hasMockedTab
    ? "Nothing matches the current account + group scope."
    : "No mock data in Phase 1 — wired in Phase 2+.";
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 px-6 py-16 text-center">
      <Inbox className="h-8 w-8 opacity-40" aria-hidden />
      <div className="text-sm font-medium">No threads in {NAV_VIEW_LABEL[navView]}</div>
      <div className="text-xs opacity-70 max-w-sm">{reason}</div>
    </div>
  );
}
