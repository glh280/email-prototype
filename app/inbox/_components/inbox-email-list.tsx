"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-email-list.tsx
 * COPIED: 2026-04-27
 * STATUS: stripped-server-actions — types swapped to mock/types
 * REINTEGRATION: restore `InboxRow` from `lib/email-query`, drop onMarkRead prop chain.
 *
 * Phase 04.2 Plan 10 — Per-tab row dispatcher.
 */

import type { InboxRow, InboxTab } from "@/mock/types";
import { InboxRowAll } from "./inbox-row-all";
import { InboxRowByFile, type InboxByFileGroup } from "./inbox-row-byfile";
import { InboxRowTeam } from "./inbox-row-team";
import { InboxRowSpam } from "./inbox-row-spam";
import { InboxRowMultiFile } from "./inbox-row-multi-file";
import { InboxRowUnassigned } from "./inbox-row-unassigned";

function groupByFile(rows: InboxRow[]): InboxByFileGroup[] {
  const map = new Map<string, InboxByFileGroup>();
  for (const row of rows) {
    const key = row.fileNo ?? "UNFILED";
    if (!map.has(key)) {
      map.set(key, {
        fileNo: key,
        dealId: row.dealId ?? "",
        propertyAddress: row.propertyAddress ?? null,
        title: "",
        rows: [],
      });
    }
    map.get(key)!.rows.push(row);
  }
  return Array.from(map.values());
}

export function InboxEmailList({
  rows,
  tab,
  onMarkRead,
}: {
  rows: InboxRow[];
  tab: InboxTab;
  onMarkRead?: (threadId: string) => void;
}) {
  if (tab === "by-file") {
    const groups = groupByFile(rows);
    return (
      <ul className="divide-y">
        {groups.map((g) => (
          <InboxRowByFile key={g.fileNo} group={g} onMarkRead={onMarkRead} />
        ))}
      </ul>
    );
  }

  return (
    <ul className="divide-y" aria-live="off">
      {rows.map((row) => {
        if (tab === "multi-file")
          return (
            <InboxRowMultiFile
              key={row.threadId}
              row={row}
              onMarkRead={onMarkRead}
            />
          );
        if (tab === "unassigned")
          return (
            <InboxRowUnassigned
              key={row.threadId}
              row={row}
              onMarkRead={onMarkRead}
            />
          );
        if (tab === "team")
          return (
            <InboxRowTeam key={row.threadId} row={row} onMarkRead={onMarkRead} />
          );
        if (tab === "spam") return <InboxRowSpam key={row.threadId} row={row} />;
        return (
          <InboxRowAll key={row.threadId} row={row} onMarkRead={onMarkRead} />
        );
      })}
    </ul>
  );
}
