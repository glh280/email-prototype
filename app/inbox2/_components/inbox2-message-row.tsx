"use client";

/**
 * SOURCE: new (no PROD source — net-new dense row for Workspace shell)
 * CREATED: 2026-04-27
 * STATUS: new
 * REINTEGRATION: dense Workspace-style row; Phase 2+ adds selection
 *   indicator, hover actions, optimistic mark-read.
 *
 * Single-line dense message row. Sender · Subject · [📎] Time.
 *
 * Iter (2026-04-27): drop snippet from compact row (preview pane shows
 * it), shrink sender column to w-24, attachment icon hugs the timestamp
 * (gap-1) so the eye sees them as a unit.
 */

import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InboxRow } from "@/mock/types";
import { Inbox2RowContextMenu } from "./inbox2-row-context-menu";

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
  onToggleUnread: (messageId: string, nextUnread: boolean) => void;
};

export function Inbox2MessageRow({
  row,
  selected,
  onSelect,
  onToggleUnread,
}: Props) {
  return (
    <li>
      <Inbox2RowContextMenu
        row={row}
        effectiveIsUnread={row.isUnread}
        onToggleUnread={onToggleUnread}
      >
      <button
        type="button"
        onClick={() => onSelect(row.messageId)}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "w-full text-left pr-3 py-2 flex items-center gap-3 border-b border-border/40 transition-colors",
          // Left accent bar carries the unread signal; keep a transparent
          // 3px stripe on read rows so subject text stays vertically aligned.
          "border-l-[3px]",
          "hover:bg-muted/50",
          selected && "bg-primary/10 hover:bg-primary/15 border-l-primary",
          row.isUnread && !selected && "bg-background border-l-primary",
          !row.isUnread && !selected && "bg-muted/30 border-l-transparent",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "ml-3 w-1.5 h-1.5 rounded-full shrink-0",
            row.isUnread ? "bg-primary" : "bg-transparent",
          )}
        />
        <span
          className={cn(
            "text-xs w-24 shrink-0 truncate",
            row.isUnread
              ? "font-semibold text-foreground"
              : "font-normal text-muted-foreground/70",
          )}
        >
          {row.fromName ?? row.fromAddress}
        </span>
        <span
          className={cn(
            "flex-1 min-w-0 text-xs truncate",
            row.isUnread
              ? "font-semibold text-foreground"
              : "font-normal text-muted-foreground",
          )}
        >
          {row.subject ?? "(no subject)"}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {row.hasAttachment ? (
            <Paperclip className="h-3 w-3 text-muted-foreground" aria-label="has attachment" />
          ) : null}
          <span className="text-[11px] text-muted-foreground tabular-nums w-10 text-right">
            {formatTime(row.sentAt)}
          </span>
        </span>
      </button>
      </Inbox2RowContextMenu>
    </li>
  );
}
