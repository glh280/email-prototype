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

import { X, Mail, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailMessage, InboxRow } from "@/mock/types";

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
        <SummarySnippetGrid aiSummary={row.aiSummary} snippet={row.snippet} />

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
  const items: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: "Mailbox", value: row.mailboxAddress ?? "—", mono: true },
    { label: "File", value: row.fileNo ?? "—" },
    { label: "Property", value: row.propertyAddress ?? "—" },
  ];
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 flex items-center gap-x-4 gap-y-1.5 flex-wrap text-[11px]">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-baseline gap-1 min-w-0">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
            {it.label}
          </span>
          <span
            className={cn(
              "text-foreground/90 truncate",
              it.mono && "font-mono text-[10.5px]",
            )}
          >
            {it.value}
          </span>
        </span>
      ))}
    </div>
  );
}

function SummarySnippetGrid({
  aiSummary,
  snippet,
}: {
  aiSummary: string | null;
  snippet: string | null;
}) {
  if (!aiSummary && !snippet) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {aiSummary ? (
        <Bubble label="AI summary" italic tone="ai">
          {aiSummary}
        </Bubble>
      ) : null}
      {snippet ? (
        <Bubble label="Snippet" tone="muted">
          {snippet}
        </Bubble>
      ) : null}
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
