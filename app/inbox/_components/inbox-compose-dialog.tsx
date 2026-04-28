"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-compose-dialog.tsx
 * COPIED: 2026-04-27
 * STATUS: modified — Phase 4.1 added compose modes (reply / reply-all /
 *   forward), Cc field, urgent toggle. Send button still toasts a stub
 *   (PROTOTYPE-DEAD-CALLS #4 + new #30 for urgent flag).
 * REINTEGRATION: restore `sendEmail` server action; thread mode + urgent
 *   into action payload (sets `email.priority_tier = 'HIGH'` when urgent).
 *
 * Phase 04.2 Plan 12 — Compose dialog. DEAD CALL on Send.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MOCK_MAILBOXES } from "@/mock/inbox";

export type ComposeMode = "new" | "reply" | "reply-all" | "forward";

export type ComposeContext = {
  mode: ComposeMode;
  /** Pre-filled values when replying / forwarding. */
  to?: string;
  cc?: string;
  subject?: string;
  /** Quoted thread body — appended below the composer area. */
  quotedBody?: string;
  /** Mailbox to send from (overrides defaultMailbox). */
  from?: string;
};

const MODE_TITLE: Record<ComposeMode, string> = {
  new: "New message",
  reply: "Reply",
  "reply-all": "Reply all",
  forward: "Forward",
};

const MODE_SEND_LABEL: Record<ComposeMode, string> = {
  new: "Send",
  reply: "Send reply",
  "reply-all": "Send reply",
  forward: "Forward",
};

export function InboxComposeDialog({
  open,
  onOpenChange,
  defaultMailbox,
  context,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMailbox: string;
  context?: ComposeContext;
}) {
  const mode = context?.mode ?? "new";
  const [from, setFrom] = useState(context?.from ?? defaultMailbox);
  const [to, setTo] = useState(context?.to ?? "");
  const [cc, setCc] = useState(context?.cc ?? "");
  const [subject, setSubject] = useState(context?.subject ?? "");
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);

  // Sync state to incoming context when the dialog re-opens with a new
  // reply / forward target. Without this the dialog keeps the previous
  // To/Subject across open cycles.
  useEffect(() => {
    if (!open) return;
    setFrom(context?.from ?? defaultMailbox);
    setTo(context?.to ?? "");
    setCc(context?.cc ?? "");
    setSubject(context?.subject ?? "");
    setBody("");
    setUrgent(false);
  }, [open, context, defaultMailbox]);

  function handleSend() {
    // DEAD CALL — see PROTOTYPE-DEAD-CALLS.md #4 + #30
    // eslint-disable-next-line no-console
    console.log("[stub] sendEmail", {
      mode,
      from,
      to,
      cc,
      subject,
      body,
      urgent,
      hasQuotedBody: Boolean(context?.quotedBody),
    });
    toast.success(
      urgent
        ? `${MODE_SEND_LABEL[mode]} (URGENT) — stub`
        : `${MODE_SEND_LABEL[mode]} — stub`,
      {
        description: subject || to,
      },
    );
    onOpenChange(false);
  }

  const showCc = mode === "reply-all" || mode === "forward" || cc.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {MODE_TITLE[mode]}
            {urgent ? (
              <span className="inline-flex items-center gap-1 rounded bg-rose-500 text-white px-1.5 py-0.5 text-[10px] font-semibold">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                URGENT
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[60px_1fr] items-center gap-2">
            <label className="text-xs text-muted-foreground">From</label>
            <Select value={from} onValueChange={(v) => v && setFrom(v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue>{from}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MOCK_MAILBOXES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-[60px_1fr] items-center gap-2">
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="h-8 text-xs"
            />
          </div>
          {showCc ? (
            <div className="grid grid-cols-[60px_1fr] items-center gap-2">
              <label className="text-xs text-muted-foreground">Cc</label>
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="h-8 text-xs"
              />
            </div>
          ) : null}
          <div className="grid grid-cols-[60px_1fr] items-center gap-2">
            <label className="text-xs text-muted-foreground">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message body…"
            rows={8}
            className="text-xs"
          />
          {context?.quotedBody ? (
            <div className="rounded border-l-2 border-muted-foreground/30 bg-muted/30 px-3 py-2 max-h-40 overflow-y-auto">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Quoted from original
              </div>
              <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {context.quotedBody}
              </pre>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <label className="flex items-center gap-2 text-xs text-muted-foreground mr-auto cursor-pointer select-none">
            <input
              type="checkbox"
              checked={urgent}
              onChange={(e) => setUrgent(e.target.checked)}
              className="h-3.5 w-3.5 accent-rose-500"
            />
            <span className={cn("inline-flex items-center gap-1", urgent && "text-rose-600 dark:text-rose-400 font-medium")}>
              <AlertTriangle className={cn("h-3 w-3", urgent ? "text-rose-500" : "text-muted-foreground")} aria-hidden />
              Mark urgent
            </span>
          </label>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            className={cn(urgent && "bg-rose-600 hover:bg-rose-700 text-white")}
          >
            {MODE_SEND_LABEL[mode]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
