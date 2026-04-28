"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell list)
 * CREATED: 2026-04-27
 * STATUS: new (filters INBOX_ROWS by accountId + groupId + navView)
 * REINTEGRATION: Phase 2+ replaces with `queryInboxForUser({ accountId,
 *   groupId, navView, filters })` from server.
 *
 * Scrollable message list. Filters rows in-memory by:
 *   - accountId === shell.accountId
 *   - groupId   === shell.groupId
 *   - navView   → existing rowsForTab() for InboxTab values; sent / drafts
 *                 / settings produce empty result.
 */

import { Inbox } from "lucide-react";
import { Inbox2MessageRow } from "./inbox2-message-row";
import { rowsForTab } from "@/mock/inbox";
import type { InboxRow, InboxTab, NavView } from "@/mock/types";
import { NAV_VIEW_LABEL } from "@/mock/inbox2";

const INBOX_TABS: readonly NavView[] = [
  "all",
  "by-file",
  "multi-file",
  "unassigned",
  "team",
  "spam",
] as const;

function isInboxTab(v: NavView): v is InboxTab {
  return INBOX_TABS.includes(v);
}

type Props = {
  accountId: string;
  groupId: string;
  navView: NavView;
  selectedMessageId: string | null;
  onSelect: (messageId: string) => void;
};

export function Inbox2MessageList({
  accountId,
  groupId,
  navView,
  selectedMessageId,
  onSelect,
}: Props) {
  if (navView === "settings") {
    return <SettingsPlaceholder />;
  }

  const baseRows: InboxRow[] = isInboxTab(navView) ? rowsForTab(navView) : [];
  const rows = baseRows.filter(
    (r) => r.accountId === accountId && r.groupId === groupId,
  );

  if (rows.length === 0) {
    return <EmptyState navView={navView} />;
  }

  return (
    <ul className="overflow-y-auto h-full bg-background">
      {rows.map((r) => (
        <Inbox2MessageRow
          key={r.threadId}
          row={r}
          selected={r.messageId === selectedMessageId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

function EmptyState({ navView }: { navView: NavView }) {
  const reason =
    navView === "sent" || navView === "drafts"
      ? "No mock data in Phase 1 — wired in Phase 2+."
      : "Nothing matches the current account + group scope.";
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 px-6 py-16 text-center">
      <Inbox className="h-8 w-8 opacity-40" aria-hidden />
      <div className="text-sm font-medium">No threads in {NAV_VIEW_LABEL[navView]}</div>
      <div className="text-xs opacity-70 max-w-sm">{reason}</div>
    </div>
  );
}

function SettingsPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 px-6 py-16 text-center">
      <div className="text-sm font-medium">Settings</div>
      <div className="text-xs opacity-70 max-w-sm">
        Phase 1 placeholder. Account preferences, notification rules, and
        signatures land in Phase 2+.
      </div>
    </div>
  );
}
