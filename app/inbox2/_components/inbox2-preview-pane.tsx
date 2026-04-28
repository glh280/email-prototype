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
 */

import {
  X,
  Mail,
  Paperclip,
  ArrowRight,
  UserPlus,
  Reply,
  Clock,
  FileEdit,
  Flag,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  EmailMessage,
  InboxRow,
  SuggestedAction,
  SuggestedActionKind,
} from "@/mock/types";

type Props = {
  row: InboxRow | null;
  onClose: () => void;
};

export function Inbox2PreviewPane({ row, onClose }: Props) {
  return (
    <aside
      className={cn("h-full bg-background flex flex-col", "min-w-0")}
      aria-label="Message preview"
    >
      {row ? <PreviewContent row={row} onClose={onClose} /> : <EmptyState />}
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

function PreviewContent({ row, onClose }: { row: InboxRow; onClose: () => void }) {
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

  return (
    <>
      <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-snug break-words">
            {row.subject ?? "(no subject)"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span>From {row.fromName ?? row.fromAddress}</span>
            {row.hasAttachment ? (
              <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
                <Paperclip className="h-3 w-3" aria-hidden />
                attachment
              </span>
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
      </header>

      <div className="flex-1 overflow-auto px-4 py-3 text-xs space-y-3">
        <ContextBubble row={row} />
        <SummaryActionsGrid
          aiSummary={row.aiSummary}
          actions={row.suggestedActions ?? []}
          messageId={row.messageId}
        />

        <section className="space-y-3 pt-1">
          {messages.map((m) => (
            <MessageCard key={m.id} message={m} />
          ))}
        </section>

        <div className="text-[11px] text-muted-foreground italic pt-2 border-t">
          Phase 1 placeholder. Reply / forward / file-linkage actions land
          in Phase 2+.
        </div>
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
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
          Mailbox
        </span>
        <span className="text-foreground/90 truncate font-mono text-[10.5px]">
          {row.mailboxAddress ?? "—"}
        </span>
      </span>
      <span className="inline-flex items-baseline gap-1 min-w-0 justify-self-center">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
          File
        </span>
        <span className="text-foreground/90 truncate">{row.fileNo ?? "—"}</span>
      </span>
      <span className="inline-flex items-baseline gap-1 min-w-0 justify-self-end text-right">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
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
}: {
  aiSummary: string | null;
  actions: SuggestedAction[];
  messageId: string;
}) {
  if (!aiSummary && actions.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {aiSummary ? (
        <Bubble label="AI summary" italic tone="ai">
          {aiSummary}
        </Bubble>
      ) : null}
      <SuggestedActionsBubble actions={actions} messageId={messageId} />
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

function SuggestedActionsBubble({
  actions,
  messageId,
}: {
  actions: SuggestedAction[];
  messageId: string;
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
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    // eslint-disable-next-line no-console
                    console.log("[stub] inbox2-preview-pane suggested-action", {
                      messageId,
                      actionId: a.id,
                      kind: a.kind,
                    });
                    toast.message(a.label, {
                      description: a.hint
                        ? `${a.hint} — stub`
                        : "Stub (no wire-up in Phase 1)",
                    });
                  }}
                  className="w-full text-left rounded-md px-1.5 py-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors group"
                >
                  <div className="flex items-start gap-1.5">
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
                  </div>
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
