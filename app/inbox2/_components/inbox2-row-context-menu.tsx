"use client";

/**
 * SOURCE: new (no PROD source — Workspace-shell row right-click menu)
 * CREATED: 2026-04-28
 * STATUS: new
 * REINTEGRATION: L2+ replaces stub handlers with real PATCH calls
 *   (mark-read, snooze, archive, assign, label, priority).
 *
 * Right-click context menu for an inbox row. Mark-read/unread is the
 * only action with real state — flips an entry in shell.unreadOverrides.
 * Everything else fires a console.log + sonner toast labeled `[stub]`,
 * registered in PROTOTYPE-DEAD-CALLS.md.
 */

import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { GROUPS, ACCOUNTS } from "@/mock/inbox2";
import type { InboxRow } from "@/mock/types";

type Props = {
  row: InboxRow;
  effectiveIsUnread: boolean;
  onToggleUnread: (messageId: string, nextUnread: boolean) => void;
  children: React.ReactNode;
};

const SNOOZE_OPTIONS = [
  { id: "later-today", label: "Later today (3 hr)" },
  { id: "tomorrow", label: "Tomorrow 9 AM" },
  { id: "next-week", label: "Next week (Mon 9 AM)" },
  { id: "pick", label: "Pick date & time…" },
];

const PRIORITY_OPTIONS: Array<{ id: InboxRow["priorityTier"]; label: string }> = [
  { id: "HIGH", label: "High" },
  { id: "MEDIUM", label: "Medium" },
  { id: "LOW", label: "Low" },
];

export function Inbox2RowContextMenu({
  row,
  effectiveIsUnread,
  onToggleUnread,
  children,
}: Props) {
  function stub(action: string, payload: Record<string, unknown> = {}) {
    // eslint-disable-next-line no-console
    console.log(`[stub] inbox2-row-context-menu ${action}`, {
      messageId: row.messageId,
      ...payload,
    });
    toast.message(`${action} — stub`, {
      description: `messageId ${row.messageId}`,
    });
  }

  function handleToggleUnread() {
    const next = !effectiveIsUnread;
    onToggleUnread(row.messageId, next);
    toast.success(next ? "Marked as unread" : "Marked as read", {
      description: row.subject ?? row.messageId,
    });
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger render={(p) => <div {...p}>{children}</div>} />
      <ContextMenuContent>
        <ContextMenuItem onClick={handleToggleUnread}>
          {effectiveIsUnread ? "Mark as read" : "Mark as unread"}
        </ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger>Snooze</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {SNOOZE_OPTIONS.map((opt) => (
              <ContextMenuItem
                key={opt.id}
                onClick={() => stub("snooze", { option: opt.id })}
              >
                {opt.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuItem onClick={() => stub("archive")}>Archive</ContextMenuItem>

        <ContextMenuItem
          onClick={() => stub("toggle-spam")}
        >
          Move to spam
        </ContextMenuItem>

        <ContextMenuItem variant="destructive" onClick={() => stub("trash")}>
          Move to trash
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>Assign to…</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuLabel>Teammates</ContextMenuLabel>
            {ACCOUNTS.map((a) => (
              <ContextMenuItem
                key={a.id}
                onClick={() => stub("assign", { assigneeId: a.id })}
              >
                {a.displayName}
              </ContextMenuItem>
            ))}
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => stub("assign", { assigneeId: null })}>
              Unassign
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>Change group</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuRadioGroup
              value={row.groupId ?? ""}
              onValueChange={(v) => stub("change-group", { groupId: v })}
            >
              {GROUPS.map((g) => (
                <ContextMenuRadioItem key={g.id} value={g.id}>
                  {g.name}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>Set priority</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuRadioGroup
              value={row.priorityTier}
              onValueChange={(v) => stub("set-priority", { priorityTier: v })}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <ContextMenuRadioItem key={p.id} value={p.id}>
                  {p.label}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}
