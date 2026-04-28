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

import { Inbox } from "lucide-react";
import { Inbox2MessageRow } from "./inbox2-message-row";
import type { InboxRow, NavView } from "@/mock/types";
import { NAV_VIEW_LABEL, NAV_VIEW_TO_INBOX_TAB } from "@/mock/inbox2";

type Props = {
  navView: NavView;
  rows: InboxRow[];
  selectedMessageId: string | null;
  onSelect: (messageId: string) => void;
  onToggleUnread: (messageId: string, nextUnread: boolean) => void;
};

export function Inbox2MessageList({
  navView,
  rows,
  selectedMessageId,
  onSelect,
  onToggleUnread,
}: Props) {
  if (rows.length === 0) {
    const hasMockedTab = NAV_VIEW_TO_INBOX_TAB[navView] !== undefined;
    return <EmptyState navView={navView} hasMockedTab={hasMockedTab} />;
  }

  return (
    <ul className="overflow-y-auto h-full bg-background">
      {rows.map((r) => (
        <Inbox2MessageRow
          key={r.threadId}
          row={r}
          selected={r.messageId === selectedMessageId}
          onSelect={onSelect}
          onToggleUnread={onToggleUnread}
        />
      ))}
    </ul>
  );
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
