"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell preview placeholder)
 * CREATED: 2026-04-27
 * STATUS: new
 * REINTEGRATION: Phase 2+ replaces placeholder with real thread reader
 *   (load body, mark-read, reply/forward affordances, file linkage).
 *
 * Right preview pane. Phase 1 = empty state when nothing selected,
 * placeholder card with the selected message's metadata otherwise.
 */

import { X, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InboxRow } from "@/mock/types";

type Props = {
  row: InboxRow | null;
  onClose: () => void;
};

export function Inbox2PreviewPane({ row, onClose }: Props) {
  return (
    <aside
      className={cn(
        "h-full bg-background flex flex-col",
        "min-w-0",
      )}
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
        Phase 1 placeholder — full thread reader, mark-read, and reply
        affordances arrive in Phase 2+.
      </div>
    </div>
  );
}

function PreviewContent({ row, onClose }: { row: InboxRow; onClose: () => void }) {
  return (
    <>
      <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">
            {row.subject ?? "(no subject)"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            From {row.fromName ?? row.fromAddress}
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
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 overflow-auto px-4 py-3 text-xs space-y-3">
        <PreviewField label="Message ID" value={row.messageId} mono />
        <PreviewField label="Mailbox" value={row.mailboxAddress ?? "—"} mono />
        <PreviewField label="File" value={row.fileNo ?? "—"} />
        <PreviewField label="Property" value={row.propertyAddress ?? "—"} />
        {row.aiSummary ? (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              AI summary
            </div>
            <div className="rounded bg-muted/40 p-2 italic text-foreground/80">
              {row.aiSummary}
            </div>
          </div>
        ) : null}
        {row.snippet ? (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Snippet
            </div>
            <div className="rounded bg-muted/40 p-2 text-foreground/80">
              {row.snippet}
            </div>
          </div>
        ) : null}
        <div className="text-[11px] text-muted-foreground italic pt-2 border-t">
          Phase 1 placeholder. Real thread body, replies, and actions land in
          Phase 2+.
        </div>
      </div>
    </>
  );
}

function PreviewField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("text-foreground/90", mono && "font-mono text-[11px]")}>
        {value}
      </div>
    </div>
  );
}
