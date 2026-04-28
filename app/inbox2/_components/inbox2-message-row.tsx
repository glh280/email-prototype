"use client";

/**
 * SOURCE: new (no PROD source — net-new dense row for Workspace shell)
 * CREATED: 2026-04-27
 * STATUS: new
 * REINTEGRATION: dense Workspace-style row; Phase 2+ adds selection
 *   indicator, hover actions, optimistic mark-read.
 *
 * Single-line dense message row. Sender · Subject · Snippet · Time.
 */

import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InboxRow } from "@/mock/types";

function formatTime(d: Date): string {
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Props = {
  row: InboxRow;
  selected: boolean;
  onSelect: (messageId: string) => void;
};

export function Inbox2MessageRow({ row, selected, onSelect }: Props) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(row.messageId)}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "w-full text-left px-3 py-2 flex items-center gap-3 border-b border-border/40 transition-colors",
          "hover:bg-muted/50",
          selected && "bg-primary/10 hover:bg-primary/15",
          row.isUnread && "bg-background",
          !row.isUnread && !selected && "bg-muted/20",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            row.isUnread ? "bg-primary" : "bg-transparent",
          )}
        />
        <span
          className={cn(
            "text-xs w-32 shrink-0 truncate",
            row.isUnread ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {row.fromName ?? row.fromAddress}
        </span>
        <span className="flex-1 min-w-0 flex items-baseline gap-2">
          <span
            className={cn(
              "text-xs truncate",
              row.isUnread ? "font-semibold text-foreground" : "text-foreground/80",
            )}
          >
            {row.subject ?? "(no subject)"}
          </span>
          {row.snippet ? (
            <span className="text-xs text-muted-foreground truncate hidden md:inline">
              — {row.snippet}
            </span>
          ) : null}
        </span>
        {row.hasAttachment ? (
          <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" aria-label="has attachment" />
        ) : null}
        <span className="text-[11px] text-muted-foreground tabular-nums w-12 text-right shrink-0">
          {formatTime(row.sentAt)}
        </span>
      </button>
    </li>
  );
}
