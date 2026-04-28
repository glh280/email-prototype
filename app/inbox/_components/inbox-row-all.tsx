"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-row-all.tsx
 * COPIED: 2026-04-27
 * STATUS: stripped-server-actions — `markThreadRead` action call removed
 * REINTEGRATION: restore `markThreadRead` import + `useTransition` flow;
 *   keep optimistic-toggle pattern.
 *
 * Phase 04.2 Plan 10 — Base inbox row (EMAIL-14, EMAIL-15, EMAIL-19, EMAIL-20).
 * Reused by InboxRowByFile (inside groups) + InboxRowTeam (with metaBadge="team").
 */

import { useState } from "react";
import { Paperclip, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailMessage, InboxRow } from "@/mock/types";
import { PriorityChip } from "./priority-chip";

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

const MATCH_BADGE_LABEL: Record<string, string> = {
  "auto-matched": "auto",
  "ai-suggested": "AI",
  "manually-added": "manual",
};

type Props = {
  row: InboxRow;
  metaBadge?: "team";
  onMarkRead?: (threadId: string) => void;
};

export function InboxRowAll({ row, metaBadge, onMarkRead }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isUnread, setIsUnread] = useState(row.isUnread);

  function handleClick() {
    setExpanded((v) => !v);
    if (isUnread) {
      setIsUnread(false);
      onMarkRead?.(row.threadId);
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors"
        aria-expanded={expanded}
      >
        {row.priorityTier ? (
          <PriorityChip tier={row.priorityTier} reason={row.priorityReason} />
        ) : (
          <span className="w-[42px] shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {isUnread && (
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"
              />
            )}
            <span className={cn("text-sm truncate", isUnread && "font-semibold")}>
              {row.subject ?? "(no subject)"}
            </span>
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
            {row.matchBadge ? (
              <>
                <span>·</span>
                <span className="px-1 rounded bg-muted/60 text-[10px] uppercase tracking-wide">
                  {MATCH_BADGE_LABEL[row.matchBadge] ?? row.matchBadge}
                </span>
              </>
            ) : null}
            {metaBadge === "team" ? (
              <>
                <span>·</span>
                <span className="px-1 rounded bg-muted/60 text-[10px] uppercase tracking-wide">
                  team
                </span>
              </>
            ) : null}
          </div>
          {row.snippet ? (
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              {row.snippet}
            </div>
          ) : null}
          {row.aiSummary ? (
            <div className="text-xs text-muted-foreground/80 mt-1 line-clamp-2 italic">
              {row.aiSummary}
            </div>
          ) : null}
        </div>
        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform",
            expanded && "rotate-90",
          )}
        />
      </button>
      {expanded ? (
        <div className="px-4 pb-3 -mt-1 text-xs text-muted-foreground">
          {row.messages && row.messages.length > 0 ? (
            <ThreadChain messages={row.messages} />
          ) : (
            <div className="rounded bg-muted/40 p-3">
              {row.snippet ?? "(no preview available — full body fetch deferred to L2+)"}
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

function ThreadChain({ messages }: { messages: EmailMessage[] }) {
  const sorted = [...messages].sort((a, b) =>
    a.sentAt < b.sentAt ? 1 : -1,
  );
  return (
    <ol className="space-y-2">
      {sorted.map((m, idx) => (
        <li
          key={m.id}
          className={cn(
            "rounded bg-background border p-3",
            idx === 0 && "ring-1 ring-primary/20",
          )}
        >
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span>
              <span className="font-medium text-foreground">{m.fromName}</span>
              {m.toNames && m.toNames.length > 0 ? (
                <span className="text-muted-foreground"> → {m.toNames.join(", ")}</span>
              ) : null}
            </span>
            <span className="text-muted-foreground shrink-0">
              {formatTime(new Date(m.sentAt))}
            </span>
          </div>
          {m.body ? (
            <div className="mt-1.5 text-xs text-foreground/80 whitespace-pre-wrap">
              {m.body}
            </div>
          ) : (
            <div className="mt-1.5 text-xs text-muted-foreground">{m.snippet}</div>
          )}
        </li>
      ))}
    </ol>
  );
}
