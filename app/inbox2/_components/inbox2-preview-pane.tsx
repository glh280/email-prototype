"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell preview placeholder)
 * CREATED: 2026-04-27
 * STATUS: new (renders mock thread; no reply / mark-read wired)
 * REINTEGRATION: Phase 2+ wires reply/forward affordances + file
 *   linkage + mark-read on view.
 *
 * Right preview pane. Renders the full thread for the selected row.
 *
 * Iter (2026-04-27): full email render —
 *   - Header: subject, from (Name <email>), to / cc / bcc, sentAt,
 *     attachment chip
 *   - Bubble: Mailbox · File · Property (single line, wraps)
 *   - AI summary + Snippet rendered side-by-side as bubble cards;
 *     each in its own bubble so multi-line content stays grouped
 *   - Body: full message body for each thread message (most recent
 *     last); falls back to row.snippet when no thread is populated
 * Iter (2026-04-28): Phase 1 footer replaced with TeamNotesSection
 *   (mock fixtures from `@/mock/team-notes`) — internal team chatter
 *   pinned to threadId, visible on every message in the chain.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Mail,
  Paperclip,
  ArrowRight,
  UserPlus,
  Reply,
  ReplyAll,
  Forward,
  Clock,
  FileEdit,
  Flag,
  Sparkles,
  MessageSquare,
  Send,
  Printer,
  AtSign,
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ComposeContext } from "@/app/inbox/_components/inbox-compose-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  Attachment,
  EmailMessage,
  InboxRow,
  NoteMention,
  SuggestedAction,
  SuggestedActionKind,
  TeamNote,
} from "@/mock/types";
import { attachmentsForThread } from "@/mock/attachments";

export type Mentionable = {
  kind: "user" | "team";
  id: string;
  label: string;
  /** Sub-line shown in popover (email or member-count). */
  hint?: string;
};

type Props = {
  row: InboxRow | null;
  onClose: () => void;
  notes: TeamNote[];
  onAddNote: (body: string, mentions: NoteMention[]) => void;
  mentionables: Mentionable[];
  onCompose: (ctx?: ComposeContext) => void;
};

export function Inbox2PreviewPane({
  row,
  onClose,
  notes,
  onAddNote,
  mentionables,
  onCompose,
}: Props) {
  return (
    <aside
      className={cn("h-full bg-background flex flex-col", "min-w-0")}
      aria-label="Message preview"
    >
      {row ? (
        <PreviewContent
          row={row}
          onClose={onClose}
          notes={notes}
          onAddNote={onAddNote}
          mentionables={mentionables}
          onCompose={onCompose}
        />
      ) : (
        <EmptyState />
      )}
    </aside>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 px-6 text-center">
      <Mail className="h-10 w-10 opacity-40" aria-hidden />
      <div className="text-sm">Select a message to preview</div>
      <div className="text-xs opacity-70">
        Phase 1 placeholder — reply, mark-read, and file-linkage actions
        arrive in Phase 2+.
      </div>
    </div>
  );
}

function PreviewContent({
  row,
  onClose,
  notes,
  onAddNote,
  mentionables,
  onCompose,
}: {
  row: InboxRow;
  onClose: () => void;
  notes: TeamNote[];
  onAddNote: (body: string, mentions: NoteMention[]) => void;
  mentionables: Mentionable[];
  onCompose: (ctx?: ComposeContext) => void;
}) {
  const attachments = attachmentsForThread(row.threadId);
  // Newest-first; if no full thread, synthesize a single message from row.
  const threadMessages: EmailMessage[] = (row.messages ?? []).slice().reverse();
  const synthesized: EmailMessage | null =
    threadMessages.length === 0
      ? {
          id: row.messageId,
          fromName: row.fromName ?? row.fromAddress,
          fromAddress: row.fromAddress,
          sentAt: row.sentAt.toISOString(),
          snippet: row.snippet ?? "",
          body: row.snippet ?? undefined,
        }
      : null;
  const messages: EmailMessage[] = synthesized ? [synthesized] : threadMessages;

  // Build a quoted block from the most-recent message body (newest is first
  // after the reverse() above). Used for reply / forward.
  const newest = messages[0];
  const quotedBody = newest?.body ?? newest?.snippet ?? "";
  const senderEmail = newest?.fromAddress ?? row.fromAddress;
  const senderName = newest?.fromName ?? row.fromName ?? row.fromAddress;
  const replySubject = row.subject
    ? row.subject.startsWith("Re:")
      ? row.subject
      : `Re: ${row.subject}`
    : "Re:";
  const forwardSubject = row.subject
    ? row.subject.startsWith("Fwd:")
      ? row.subject
      : `Fwd: ${row.subject}`
    : "Fwd:";
  const allCcs = [
    ...(newest?.toNames ?? []),
    ...(newest?.ccNames ?? []),
  ].join(", ");

  function makeReplyCtx(mode: "reply" | "reply-all" | "forward"): ComposeContext {
    return {
      mode,
      to:
        mode === "forward"
          ? ""
          : senderEmail
            ? `${senderName} <${senderEmail}>`
            : senderName,
      cc: mode === "reply-all" ? allCcs : undefined,
      subject: mode === "forward" ? forwardSubject : replySubject,
      quotedBody: `On ${formatSent(newest?.sentAt ?? row.sentAt.toISOString())}, ${senderName} wrote:\n\n${quotedBody}`,
    };
  }

  return (
    <>
      <header className="border-b px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-snug break-words">
              {row.subject ?? "(no subject)"}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span>
                From{" "}
                {row.fromName
                  ? `${row.fromName} (${row.fromAddress})`
                  : row.fromAddress}
              </span>
              {attachments.length > 0 ? (
                <AttachmentChip attachments={attachments} threadId={row.threadId} />
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              // eslint-disable-next-line no-console
              console.log("[stub] inbox2-preview-pane close", { messageId: row.messageId });
              onClose();
            }}
            aria-label="Close preview"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <ReplyToolButton
            label="Reply"
            icon={Reply}
            onClick={() => onCompose(makeReplyCtx("reply"))}
          />
          <ReplyToolButton
            label="Reply all"
            icon={ReplyAll}
            onClick={() => onCompose(makeReplyCtx("reply-all"))}
          />
          <ReplyToolButton
            label="Forward"
            icon={Forward}
            onClick={() => onCompose(makeReplyCtx("forward"))}
          />
        </div>
      </header>

      <div className="flex-1 overflow-auto px-4 py-3 text-xs space-y-3">
        <ContextBubble row={row} />
        <SummaryActionsGrid
          aiSummary={row.aiSummary}
          actions={row.suggestedActions ?? []}
          messageId={row.messageId}
          onReply={() => onCompose(makeReplyCtx("reply"))}
        />

        <section
          id="email-print-target"
          aria-label="Email thread"
          className="space-y-3 pt-1"
        >
          <header className="flex items-center justify-between gap-2 px-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
              <Mail className="h-3 w-3" aria-hidden />
              Email thread
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-foreground/70">
                {messages.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                // eslint-disable-next-line no-console
                console.log("[print] inbox2-preview-pane print", {
                  messageId: row.messageId,
                  threadId: row.threadId,
                });
                if (typeof window !== "undefined") window.print();
              }}
              aria-label="Print email thread"
              title="Print email thread"
              className="no-print inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Printer className="h-3 w-3" aria-hidden />
              Print
            </button>
          </header>
          {messages.map((m) => (
            <MessageCard key={m.id} message={m} />
          ))}
        </section>

        {attachments.length > 0 ? (
          <AttachmentsSection attachments={attachments} threadId={row.threadId} />
        ) : null}

        <TeamNotesSection
          threadId={row.threadId}
          notes={notes}
          onAddNote={onAddNote}
          mentionables={mentionables}
        />
      </div>
    </>
  );
}

function ContextBubble({ row }: { row: InboxRow }) {
  // 3-col grid so File sits visually centered between Mailbox (left)
  // and Property (right-justified). justify-self per cell handles the
  // alignment without nesting flex containers.
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 grid grid-cols-3 items-baseline gap-x-3 text-[11px]">
      <span className="inline-flex items-baseline gap-1 min-w-0 justify-self-start">
        <span className="text-[10px] uppercase tracking-wide font-bold text-foreground/70">
          Mailbox
        </span>
        <span className="text-foreground/90 truncate font-mono text-[10.5px]">
          {row.mailboxAddress ?? "—"}
        </span>
      </span>
      <span className="inline-flex items-baseline gap-1 min-w-0 justify-self-center">
        <span className="text-[10px] uppercase tracking-wide font-bold text-foreground/70">
          File
        </span>
        <span className="text-foreground/90 truncate">{row.fileNo ?? "—"}</span>
      </span>
      <span className="inline-flex items-baseline gap-1 min-w-0 justify-self-end text-right">
        <span className="text-[10px] uppercase tracking-wide font-bold text-foreground/70">
          Property
        </span>
        <span className="text-foreground/90 truncate">{row.propertyAddress ?? "—"}</span>
      </span>
    </div>
  );
}

function SummaryActionsGrid({
  aiSummary,
  actions,
  messageId,
  onReply,
}: {
  aiSummary: string | null;
  actions: SuggestedAction[];
  messageId: string;
  onReply: () => void;
}) {
  if (!aiSummary && actions.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {aiSummary ? (
        <Bubble label="AI summary" italic tone="ai">
          {aiSummary}
        </Bubble>
      ) : null}
      <SuggestedActionsBubble
        actions={actions}
        messageId={messageId}
        onReply={onReply}
      />
    </div>
  );
}

const ACTION_ICON: Record<SuggestedActionKind, LucideIcon> = {
  "stage-update": ArrowRight,
  assign: UserPlus,
  "reply-template": Reply,
  "follow-up": Clock,
  "file-update": FileEdit,
  flag: Flag,
};

const ACTION_VERB: Record<SuggestedActionKind, string> = {
  "stage-update": "Advance",
  assign: "Assign",
  "reply-template": "Reply",
  "follow-up": "Schedule",
  "file-update": "Update",
  flag: "Flag",
};

function SuggestedActionsBubble({
  actions,
  messageId,
  onReply,
}: {
  actions: SuggestedAction[];
  messageId: string;
  onReply: () => void;
}) {
  return (
    <div className="rounded-lg p-2 border bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 inline-flex items-center gap-1">
        <Sparkles className="h-3 w-3" aria-hidden />
        Suggested actions
      </div>
      {actions.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic">
          No suggested actions for this message yet.
        </div>
      ) : (
        <ul className="space-y-1">
          {actions.map((a) => {
            const Icon = ACTION_ICON[a.kind];
            const verb = ACTION_VERB[a.kind];
            return (
              <li
                key={a.id}
                className="rounded-md px-1.5 py-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-start gap-1.5"
              >
                <Icon
                  className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] text-foreground/90 leading-snug">
                    {a.label}
                  </div>
                  {a.hint ? (
                    <div className="text-[10px] text-muted-foreground leading-snug">
                      {a.hint}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // eslint-disable-next-line no-console
                    console.log("[stub] inbox2-preview-pane suggested-action", {
                      messageId,
                      actionId: a.id,
                      kind: a.kind,
                    });
                    if (a.kind === "reply-template") {
                      onReply();
                      return;
                    }
                    toast.message(`${verb}: ${a.label}`, {
                      description: a.hint
                        ? `${a.hint} — stub`
                        : "Stub (no wire-up in Phase 1)",
                    });
                  }}
                  aria-label={`${verb} — ${a.label}`}
                  className="shrink-0 inline-flex items-center rounded px-2 py-0.5 text-[10.5px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
                >
                  {verb}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Bubble({
  label,
  children,
  italic,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  italic?: boolean;
  tone: "ai" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-lg p-2 border",
        tone === "ai" ? "bg-primary/5 border-primary/20" : "bg-muted/40 border-border",
      )}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </div>
      <div className={cn("text-foreground/85 leading-relaxed", italic && "italic")}>
        {children}
      </div>
    </div>
  );
}

function MessageCard({ message }: { message: EmailMessage }) {
  const sentLabel = formatSent(message.sentAt);
  const senderLine = message.fromAddress
    ? `${message.fromName} <${message.fromAddress}>`
    : message.fromName;
  return (
    <article className="rounded-lg border bg-background px-3 py-2.5 space-y-2">
      <header className="space-y-0.5 text-[11px]">
        <div className="font-medium text-foreground/90 truncate" title={senderLine}>
          {senderLine}
        </div>
        <RecipientLine label="To" names={message.toNames} />
        <RecipientLine label="Cc" names={message.ccNames} />
        <RecipientLine label="Bcc" names={message.bccNames} />
        <div className="text-[10px] text-muted-foreground tabular-nums">
          {sentLabel}
        </div>
      </header>
      <div className="text-xs text-foreground/85 whitespace-pre-wrap leading-relaxed">
        {message.body ?? message.snippet}
      </div>
    </article>
  );
}

function RecipientLine({ label, names }: { label: string; names?: string[] }) {
  if (!names || names.length === 0) return null;
  return (
    <div className="text-[10.5px] text-muted-foreground truncate">
      <span className="uppercase tracking-wide text-[9.5px] mr-1 text-muted-foreground/80">
        {label}
      </span>
      {names.join(", ")}
    </div>
  );
}

function formatSent(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const ATTACHMENT_ICON: Record<Attachment["kind"], LucideIcon> = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
  image: FileImage,
  other: FileIcon,
};

const ATTACHMENT_TINT: Record<Attachment["kind"], string> = {
  pdf: "text-rose-600 dark:text-rose-400",
  docx: "text-sky-600 dark:text-sky-400",
  xlsx: "text-emerald-600 dark:text-emerald-400",
  image: "text-violet-600 dark:text-violet-400",
  other: "text-muted-foreground",
};

function AttachmentsSection({
  attachments,
  threadId,
}: {
  attachments: Attachment[];
  threadId: string;
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Paperclip className="h-3 w-3" aria-hidden />
        Attachments
        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-foreground/70">
          {attachments.length}
        </span>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {attachments.map((a) => {
          const Icon = ATTACHMENT_ICON[a.kind];
          return (
            <li key={a.id}>
              <a
                href={`/samples/${a.id}`}
                target="_blank"
                rel="noopener"
                onClick={() => {
                  // eslint-disable-next-line no-console
                  console.log("[stub] inbox2-preview-pane attachment-click", {
                    threadId,
                    attachmentId: a.id,
                    name: a.name,
                  });
                }}
                className="w-full text-left rounded-md border bg-background hover:bg-muted/50 transition-colors px-2 py-1.5 flex items-center gap-2 min-w-0"
              >
                <Icon className={cn("h-4 w-4 shrink-0", ATTACHMENT_TINT[a.kind])} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] text-foreground/90 truncate">
                    {a.name}
                  </span>
                  <span className="block text-[10px] text-muted-foreground tabular-nums">
                    {a.sizeLabel}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Compact reply / reply-all / forward toolbar button for the preview header.
 */
function ReplyToolButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 text-[11px] text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </button>
  );
}

/**
 * Paperclip badge in the preview header. Click → popover lists all
 * attachments for the current thread. Each row links to /samples/<id>.
 */
function AttachmentChip({
  attachments,
  threadId,
}: {
  attachments: Attachment[];
  threadId: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`${attachments.length} attachment${attachments.length === 1 ? "" : "s"}`}
            title={`${attachments.length} attachment${attachments.length === 1 ? "" : "s"}`}
            className="inline-flex items-center gap-1 rounded bg-muted hover:bg-muted/70 transition-colors px-1.5 py-0.5"
          >
            <Paperclip className="h-3 w-3" aria-hidden />
            <span className="text-[10px] tabular-nums text-foreground/70">
              {attachments.length}
            </span>
          </button>
        }
      />
      <PopoverContent side="bottom" align="start" className="w-[280px] p-0">
        <div className="border-b px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
          <Paperclip className="h-3 w-3" aria-hidden />
          {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
        </div>
        <ul className="max-h-72 overflow-y-auto py-1">
          {attachments.map((a) => {
            const Icon = ATTACHMENT_ICON[a.kind];
            return (
              <li key={a.id}>
                <a
                  href={`/samples/${a.id}`}
                  target="_blank"
                  rel="noopener"
                  onClick={() => {
                    // eslint-disable-next-line no-console
                    console.log("[stub] inbox2-preview-pane attachment-click (chip)", {
                      threadId,
                      attachmentId: a.id,
                      name: a.name,
                    });
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 text-[11.5px] hover:bg-muted/60 transition-colors"
                >
                  <Icon className={cn("h-4 w-4 shrink-0", ATTACHMENT_TINT[a.kind])} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground/90">
                      {a.name}
                    </span>
                    <span className="block text-[10px] text-muted-foreground tabular-nums">
                      {a.sizeLabel}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Team notes pinned to the email thread. Visible on every message in the
 * chain (scoped by threadId, not messageId). Composer persists to shell
 * state via onAddNote — note appears immediately. Mentions surface in
 * the nav-rail Comments badge for tagged users. See PROTOTYPE-DEAD-CALLS #27.
 *
 * Visual: thick top border so the operator sees the section is internal-
 * only — distinct from the email body above.
 */
function TeamNotesSection({
  threadId,
  notes,
  onAddNote,
  mentionables,
}: {
  threadId: string;
  notes: TeamNote[];
  onAddNote: (body: string, mentions: NoteMention[]) => void;
  mentionables: Mentionable[];
}) {
  return (
    <section className="mt-4 pt-4 border-t-4 border-amber-400 dark:border-amber-600 space-y-2 bg-amber-50/40 dark:bg-amber-950/15 -mx-4 px-4 pb-3 rounded-b-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-amber-900 dark:text-amber-200 font-semibold">
          <MessageSquare className="h-3 w-3" aria-hidden />
          Team notes — internal only
          {notes.length > 0 ? (
            <span className="ml-1 rounded-full bg-amber-200 dark:bg-amber-800 px-1.5 py-0.5 text-[10px] tabular-nums text-amber-900 dark:text-amber-100">
              {notes.length}
            </span>
          ) : null}
        </div>
        <span className="text-[10px] text-amber-800/70 dark:text-amber-300/60 italic">
          Not visible to email recipients
        </span>
      </div>

      {notes.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic px-1">
          No team notes yet — be the first to add context.
        </div>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </ul>
      )}

      <NoteComposer
        threadId={threadId}
        onSubmit={onAddNote}
        mentionables={mentionables}
      />
    </section>
  );
}

function NoteCard({ note }: { note: TeamNote }) {
  return (
    <li className="rounded-md border bg-background dark:bg-amber-950/40 border-amber-200/70 dark:border-amber-900/60 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[11px] mb-1">
        <span
          aria-hidden
          className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100 text-[9px] font-semibold"
        >
          {initialsOf(note.authorName)}
        </span>
        <span className="font-medium text-foreground/90">{note.authorName}</span>
        <span className="text-muted-foreground tabular-nums">
          · {formatRelative(note.createdAt)}
        </span>
        {note.mentions && note.mentions.length > 0 ? (
          <span className="ml-auto inline-flex items-center gap-0.5 text-[9.5px] text-amber-900/70 dark:text-amber-200/70">
            <AtSign className="h-2.5 w-2.5" aria-hidden />
            {note.mentions.length}
          </span>
        ) : null}
      </div>
      <div className="text-[12px] text-foreground/85 whitespace-pre-wrap leading-relaxed">
        {renderBodyWithMentions(note.body, note.mentions ?? [])}
      </div>
    </li>
  );
}

/**
 * Wrap any `@Label` substring matching one of `mentions` in a styled chip.
 * Plain string body otherwise — no markdown.
 */
function renderBodyWithMentions(body: string, mentions: NoteMention[]): React.ReactNode {
  if (mentions.length === 0) return body;
  const labels = mentions
    .map((m) => m.label)
    .sort((a, b) => b.length - a.length); // longest first to avoid partial matches
  const escaped = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`@(${escaped.join("|")})`, "g");
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > cursor) parts.push(body.slice(cursor, m.index));
    const label = m[1];
    const mention = mentions.find((x) => x.label === label);
    parts.push(
      <span
        key={`m-${key++}`}
        className={cn(
          "inline-flex items-center rounded px-1 py-0 mx-0.5 font-medium text-[11.5px]",
          mention?.kind === "team"
            ? "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200"
            : "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
        )}
      >
        @{label}
      </span>,
    );
    cursor = m.index + m[0].length;
  }
  if (cursor < body.length) parts.push(body.slice(cursor));
  return parts;
}

/**
 * Composer with @ trigger → mention popover. Tracks committed mentions
 * separately from body text so we don't have to parse on submit.
 */
function NoteComposer({
  threadId,
  onSubmit,
  mentionables,
}: {
  threadId: string;
  onSubmit: (body: string, mentions: NoteMention[]) => void;
  mentionables: Mentionable[];
}) {
  const [draft, setDraft] = useState("");
  const [mentions, setMentions] = useState<NoteMention[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tokenStart, setTokenStart] = useState<number | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter mentionables against the typed query (after the @).
  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    const all = mentionables;
    if (q.length === 0) return all.slice(0, 6);
    return all
      .filter((m) => m.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, mentionables]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, popoverOpen]);

  function handleChange(value: string, caret: number) {
    setDraft(value);
    // Find the latest `@` before caret with no whitespace between.
    const before = value.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at >= 0) {
      const between = before.slice(at + 1);
      if (!/\s/.test(between) && between.length <= 24) {
        setTokenStart(at);
        setQuery(between);
        setPopoverOpen(true);
        return;
      }
    }
    setPopoverOpen(false);
    setTokenStart(null);
    setQuery("");
  }

  function commitMention(m: Mentionable) {
    if (tokenStart === null) {
      // Just append at end if somehow no active token.
      const next = `${draft} @${m.label} `;
      setDraft(next);
    } else {
      const before = draft.slice(0, tokenStart);
      const after = draft.slice(tokenStart + 1 + query.length);
      const inserted = `@${m.label} `;
      const next = `${before}${inserted}${after}`;
      setDraft(next);
      // restore caret after inserted token (best effort).
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        const pos = before.length + inserted.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    }
    setMentions((prev) =>
      prev.some((p) => p.kind === m.kind && p.id === m.id)
        ? prev
        : [...prev, { kind: m.kind, id: m.id, label: m.label }],
    );
    setPopoverOpen(false);
    setTokenStart(null);
    setQuery("");
  }

  function submit() {
    const body = draft.trim();
    if (!body) return;
    // Drop mentions whose label no longer appears in the body (operator
    // backspaced over the chip text).
    const live = mentions.filter((m) => body.includes(`@${m.label}`));
    onSubmit(body, live);
    setDraft("");
    setMentions([]);
  }

  return (
    <div className="rounded-md border bg-background focus-within:border-amber-500/50 transition-colors relative">
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => handleChange(e.target.value, e.target.selectionStart ?? 0)}
        onKeyDown={(e) => {
          if (popoverOpen && matches.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => (i + 1) % matches.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => (i - 1 + matches.length) % matches.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              commitMention(matches[activeIdx]!);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setPopoverOpen(false);
              return;
            }
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        placeholder="Leave a note for the team — type @ to tag a teammate or team…"
        className="w-full resize-none bg-transparent px-2.5 py-2 text-[12px] outline-none placeholder:text-muted-foreground/70"
      />

      {popoverOpen && matches.length > 0 ? (
        <div
          role="listbox"
          aria-label="Mention suggestions"
          className="absolute left-2 bottom-full mb-1 z-20 w-[240px] rounded-md border bg-popover shadow-md ring-1 ring-foreground/10 overflow-hidden"
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
            Tag a person or team
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {matches.map((m, i) => (
              <li key={`${m.kind}:${m.id}`}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep textarea focus
                    commitMention(m);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "w-full text-left flex items-center gap-2 px-2 py-1.5 text-[11.5px]",
                    i === activeIdx ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-semibold shrink-0",
                      m.kind === "team"
                        ? "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200"
                        : "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
                    )}
                  >
                    {m.kind === "team" ? "T" : initialsOf(m.label)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground/90">
                      {m.label}
                    </span>
                    {m.hint ? (
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {m.hint}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t px-2 py-1 gap-2 flex-wrap">
        <div className="flex items-center gap-1 min-w-0 flex-wrap">
          <span className="text-[10px] text-muted-foreground">
            Internal · ↵ to post · ⇧↵ for new line · @ to tag
          </span>
          {mentions.map((m) => (
            <span
              key={`${m.kind}:${m.id}`}
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-medium",
                m.kind === "team"
                  ? "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200"
                  : "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
              )}
            >
              @{m.label}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={draft.trim().length === 0}
          className={cn(
            "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-colors",
            draft.trim().length === 0
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-amber-600 text-white hover:bg-amber-700",
          )}
        >
          <Send className="h-3 w-3" aria-hidden />
          Post note
        </button>
      </div>
    </div>
  );
}
