"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-row-byfile.tsx
 * COPIED: 2026-04-27
 * STATUS: stripped-server-actions
 * REINTEGRATION: replace local-state mark-read with server action.
 *
 * Phase 04.2 Plan 10 — By-file grouped rows. Sticky group header per file_no.
 */

import type { InboxRow } from "@/mock/types";
import { InboxRowAll } from "./inbox-row-all";

export type InboxByFileGroup = {
  fileNo: string;
  dealId: string;
  propertyAddress: string | null;
  title: string;
  rows: InboxRow[];
};

export function InboxRowByFile({
  group,
  onMarkRead,
}: {
  group: InboxByFileGroup;
  onMarkRead?: (threadId: string) => void;
}) {
  return (
    <li>
      <div className="sticky top-0 z-10 bg-muted/50 backdrop-blur px-4 py-2 border-b text-xs font-semibold flex items-center gap-2">
        <span className="font-mono">{group.fileNo}</span>
        {group.propertyAddress ? (
          <span className="text-muted-foreground font-normal truncate">
            · {group.propertyAddress}
          </span>
        ) : null}
        <span className="ml-auto text-muted-foreground font-normal">
          {group.rows.length} {group.rows.length === 1 ? "thread" : "threads"}
        </span>
      </div>
      <ul className="divide-y">
        {group.rows.map((r) => (
          <InboxRowAll key={r.threadId} row={r} onMarkRead={onMarkRead} />
        ))}
      </ul>
    </li>
  );
}
