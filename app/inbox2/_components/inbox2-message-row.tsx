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

import { useState } from "react";
import { Paperclip, AlertCircle, FolderInput } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { InboxRow } from "@/mock/types";
import { Inbox2RowContextMenu } from "./inbox2-row-context-menu";
import { AssigneeAvatars } from "./inbox2-assignee-avatars";
import { AddThreadToDealDialog } from "@/app/inbox/_components/add-thread-to-deal-dialog";
import { MultiFileCandidateChip } from "@/app/inbox/_components/multi-file-candidate-chip";
import { UnassignedSuggestionPill } from "@/app/inbox/_components/unassigned-suggestion-pill";
import { getAiSettings, useAiSettings } from "@/lib/ai-settings-store";

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
  onAssign: (messageId: string, assigneeId: string | null) => void;
  assigneeIds: string[];
  /**
   * When true, render route-to-file affordances inline below the row:
   *   - candidate chips (multi-file rows with `row.candidates`)
   *   - suggestion pill (unassigned rows with `row.suggestion`)
   *   - "Add to file" button (always, on FILES views)
   * Driven by `state.navView ∈ FILES_NAV_VIEWS` in the shell. Off by
   * default so the standard Inbox view stays single-line dense.
   */
  showFileAffordances?: boolean;
};

export function Inbox2MessageRow({
  row,
  selected,
  onSelect,
  onToggleUnread,
  onAssign,
  assigneeIds,
  showFileAffordances,
}: Props) {
  const [addToFileOpen, setAddToFileOpen] = useState(false);
  const aiSettings = useAiSettings();
  const showMatchAffordances =
    aiSettings.enabled && aiSettings.autoMatchSuggestions;

  function handleConfirmCandidate(dealId: string) {
    // DEAD CALL — mirrors classic-surface InboxRowMultiFile + InboxRowUnassigned.
    // PROTOTYPE-DEAD-CALLS.md row 1 (`confirmAssociation`).
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-message-row confirmAssociation", {
      threadId: row.threadId,
      messageId: row.messageId,
      dealId,
    });
    toast.success(`Stub: would confirm association to deal ${dealId}.`);

    // Subject-line learning — only when the AI setting is on. Logs the
    // confirmed (subject + dealId) pair as a SUPPLEMENTARY match
    // signal. Subject is intentionally NOT a primary key — the PROD
    // matcher uses it to boost confidence for similar subjects in the
    // same conversation but never relies on it alone (sender / file no
    // / contact data still primary). Empty subject = nothing to learn.
    const ai = getAiSettings();
    if (ai.enabled && ai.subjectLineLearning && row.subject) {
      // eslint-disable-next-line no-console
      console.log("[stub-state] subject-line-learning", {
        subject: row.subject,
        dealId,
        threadId: row.threadId,
        note: "supplementary signal only — never primary key",
      });
      toast.message("Subject pattern logged for future matching", {
        description: `"${row.subject}" → ${dealId} (supplementary signal)`,
      });
    }
  }

  function handleRejectCandidate(dealId: string) {
    // DEAD CALL — would call `dismissCandidate` server action at L2.
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-message-row dismissCandidate", {
      threadId: row.threadId,
      messageId: row.messageId,
      dealId,
    });
    toast.message(`Rejected match — ${dealId} (stub).`);
  }

  return (
    <li>
      <Inbox2RowContextMenu
        row={row}
        effectiveIsUnread={row.isUnread}
        onToggleUnread={onToggleUnread}
        onAssign={onAssign}
        onAddToFile={() => setAddToFileOpen(true)}
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
        <span className="flex items-center gap-1.5 shrink-0">
          {assigneeIds.length > 0 ? (
            <AssigneeAvatars assigneeIds={assigneeIds} size="sm" />
          ) : null}
          {row.priorityTier === "HIGH" ? (
            <AlertCircle
              className="h-3.5 w-3.5 fill-rose-500 text-white dark:fill-rose-600"
              aria-label="high priority"
            />
          ) : null}
          {row.hasAttachment ? (
            <Paperclip className="h-3 w-3 text-muted-foreground" aria-label="has attachment" />
          ) : null}
          {showFileAffordances ? (
            // Span (not <button>) because the row itself is already a
            // <button>; nested <button> elements are invalid HTML.
            // role="button" + tabIndex make this keyboard-reachable.
            // Stops propagation so opening the dialog doesn't also
            // open the preview pane.
            <span
              role="button"
              tabIndex={0}
              aria-label={
                row.fileNo
                  ? `Change file (currently ${row.fileNo})`
                  : "Add to file"
              }
              title={
                row.fileNo
                  ? `Change file — currently ${row.fileNo}`
                  : "Add to file"
              }
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setAddToFileOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  setAddToFileOpen(true);
                }
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground outline-none cursor-pointer inline-flex items-center"
            >
              <FolderInput className="h-3.5 w-3.5" aria-hidden />
            </span>
          ) : null}
          <span className="text-[11px] text-muted-foreground tabular-nums w-10 text-right">
            {formatTime(row.sentAt)}
          </span>
        </span>
      </button>
      {showFileAffordances &&
      showMatchAffordances &&
      ((row.candidates && row.candidates.length > 0) || row.suggestion) ? (
        // Inline affordance row only when the row has multi-file
        // candidates or an unassigned suggestion. The file-number is
        // shown in the sub-header (when one file selected) or as a
        // group header (in By File grouped view), so the row no longer
        // needs to repeat it. The "Change file" affordance moved to the
        // FolderInput icon next to the paperclip.
        <div className="px-4 pb-2 pl-[3.25rem] flex items-center gap-1.5 flex-wrap">
          {row.candidates && row.candidates.length > 0 ? (
            <>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Candidates:
              </span>
              {row.candidates.map((c) => (
                <MultiFileCandidateChip
                  key={c.dealId}
                  candidate={c}
                  onConfirm={handleConfirmCandidate}
                  onReject={handleRejectCandidate}
                />
              ))}
            </>
          ) : null}
          {row.suggestion ? (
            <UnassignedSuggestionPill
              suggestion={row.suggestion}
              onConfirm={handleConfirmCandidate}
              onReject={handleRejectCandidate}
            />
          ) : null}
        </div>
      ) : null}
      </Inbox2RowContextMenu>
      <AddThreadToDealDialog
        open={addToFileOpen}
        onOpenChange={setAddToFileOpen}
        threadId={row.threadId}
        messageId={row.messageId}
      />
    </li>
  );
}
