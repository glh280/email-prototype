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
  ContextMenuGroup,
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
import { GROUPS } from "@/mock/inbox2";
import { WORKSPACE_USERS } from "@/mock/settings";
import type { InboxRow } from "@/mock/types";

type Props = {
  row: InboxRow;
  effectiveIsUnread: boolean;
  onToggleUnread: (messageId: string, nextUnread: boolean) => void;
  onAssign: (messageId: string, assigneeId: string | null) => void;
  /**
   * Open the manual file-association picker (AddThreadToDealDialog —
   * the primary dead call per PROTOTYPE-DEAD-CALLS.md). Hosted on the
   * row component so the dialog state lives next to the row that
   * opened it.
   */
  onAddToFile: () => void;
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
  onAssign,
  onAddToFile,
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

        <ContextMenuItem onClick={onAddToFile}>
          {row.fileNo ? "Change file…" : "Add to file…"}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>Assign to…</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuGroup>
              <ContextMenuLabel>Workspace members</ContextMenuLabel>
              {WORKSPACE_USERS.filter((u) => u.status === "active").map((u) => (
                <ContextMenuItem
                  key={u.id}
                  onClick={() => {
                    onAssign(row.messageId, u.id);
                    toast.success(`Assigned to ${u.name}`, {
                      description: row.subject ?? row.messageId,
                    });
                  }}
                >
                  {u.name}
                </ContextMenuItem>
              ))}
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => {
                  onAssign(row.messageId, null);
                  toast.success("Unassigned", {
                    description: row.subject ?? row.messageId,
                  });
                }}
              >
                Unassign
              </ContextMenuItem>
            </ContextMenuGroup>
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
