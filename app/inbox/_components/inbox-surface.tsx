"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-surface.tsx
 * COPIED: 2026-04-27
 * STATUS: stripped-server-actions — L1 rewrite
 * REINTEGRATION: this file replaced by PROD's surface (URL-driven tab,
 *   SSE useInboxStream, server-action pagination, surface-state machine).
 *   Keep this comment + diff against PROD when reintegrating.
 *
 * Phase 04.2 Plan 09 — `InboxSurface` (EMAIL-14, EMAIL-19).
 *
 * L1 changes vs PROD:
 *   - URL-driven tab + search → React `useState` lifted to this component
 *   - No SSE (`useInboxStream` removed)
 *   - No `surfaceState` machine (always renders rows or empty)
 *   - No `DisconnectedBanner`, no `newMessagesBanner`
 *   - `markThreadRead` action call removed; row click toggles local
 *     `isUnread` flag in component state
 */

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";

import { InboxTabBar } from "./inbox-tab-bar";
import { InboxEmailList } from "./inbox-email-list";
import { InboxDigestButton } from "./inbox-digest-button";
import { InboxComposeButton } from "./inbox-compose-button";
import { InboxSearchBar } from "./inbox-search-bar";
import { InboxEmptyState } from "./inbox-empty-state";

import {
  type InboxRow,
  type InboxTab,
  type PriorityTier,
} from "@/mock/types";
import { rowsForTab, unreadCountsByTab } from "@/mock/inbox";

type Props = {
  userId: string;
  initialRows: InboxRow[];
  unreadCounts: Record<InboxTab, number>;
  defaultMailbox: string;
};

export function InboxSurface({
  userId: _userId,
  initialRows,
  unreadCounts: initialUnreadCounts,
  defaultMailbox,
}: Props) {
  const [tab, setTab] = useState<InboxTab>("all");
  const [q, setQ] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityTier[]>([]);
  const [rows, setRows] = useState<InboxRow[]>(initialRows);

  const tabRows = useMemo(() => rowsForTab(tab), [tab]);

  const filteredRows = useMemo(() => {
    let result = tabRows;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      result = result.filter((r) => {
        const haystack = [
          r.subject,
          r.fromName,
          r.fromAddress,
          r.snippet,
          r.fileNo,
          r.aiSummary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      });
    }
    if (priorityFilter.length > 0 && priorityFilter.length < 3) {
      result = result.filter(
        (r) => r.priorityTier !== null && priorityFilter.includes(r.priorityTier),
      );
    }
    return result;
  }, [tabRows, q, priorityFilter]);

  const unreadCounts = useMemo(() => {
    // Recompute unread when local read-state toggles. L1 only — read state
    // not persisted; refresh resets.
    const localUnread = unreadCountsByTab(rows);
    // Merge: use local unread if it differs (i.e. a row was marked read in
    // this session), else fall back to initial.
    return localUnread;
  }, [rows]);

  function markThreadReadLocal(threadId: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.threadId === threadId ? { ...r, isUnread: false } : r,
      ),
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-6 py-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-lg font-semibold">Inbox</h1>
        <div className="flex items-center gap-2">
          <InboxDigestButton />
          <InboxComposeButton defaultMailbox={defaultMailbox} />
        </div>
      </div>
      <Card className="overflow-hidden">
        <InboxTabBar
          currentTab={tab}
          unreadCounts={unreadCounts}
          onTabChange={setTab}
        />
        <InboxSearchBar
          q={q}
          priority={priorityFilter}
          onQueryChange={setQ}
          onPriorityChange={setPriorityFilter}
        />
        {filteredRows.length === 0 ? (
          <InboxEmptyState tab={tab} />
        ) : (
          <InboxEmailList
            rows={filteredRows}
            tab={tab}
            onMarkRead={markThreadReadLocal}
          />
        )}
      </Card>
    </main>
  );
}
