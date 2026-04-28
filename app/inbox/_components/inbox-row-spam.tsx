"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-row-spam.tsx
 * COPIED: 2026-04-27
 * STATUS: stripped-server-actions
 * REINTEGRATION: no markThreadRead in spam (per PROD); rendering stays static.
 *
 * Phase 04.2 Plan 10 — Spam row. No PriorityChip, no AI summary, opacity-70.
 */

import { Paperclip } from "lucide-react";
import type { InboxRow } from "@/mock/types";

function formatTime(d: Date): string {
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function InboxRowSpam({ row }: { row: InboxRow }) {
  return (
    <li className="px-4 py-3 opacity-70 hover:opacity-90 transition-opacity">
      <div className="flex items-baseline gap-2">
        <span className="text-sm truncate">{row.subject ?? "(no subject)"}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
        <span className="truncate">{row.fromName ?? row.fromAddress}</span>
        <span>·</span>
        <span>{formatTime(row.sentAt)}</span>
        {row.mailboxAddress ? (
          <>
            <span>·</span>
            <span className="font-mono text-[10px]">{row.mailboxAddress}</span>
          </>
        ) : null}
        {row.hasAttachment ? (
          <>
            <span>·</span>
            <Paperclip className="h-3 w-3" aria-label="has attachment" />
          </>
        ) : null}
        <span>·</span>
        <span className="px-1 rounded bg-muted/60 text-[10px] uppercase tracking-wide">
          spam
        </span>
      </div>
      {row.snippet ? (
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {row.snippet}
        </div>
      ) : null}
    </li>
  );
}
