"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-compose-dialog.tsx
 * COPIED: 2026-04-27
 * STATUS: stubbed — Send button toasts "Sent (stub)" instead of calling sendEmail action
 * REINTEGRATION: restore `sendEmail` server action; thread it through Send onClick.
 *
 * Phase 04.2 Plan 12 — Compose dialog. DEAD CALL on Send (see PROTOTYPE-DEAD-CALLS.md).
 */

import { useState } from "react";
import { toast } from "sonner";
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
import { MOCK_MAILBOXES } from "@/mock/inbox";

export function InboxComposeDialog({
  open,
  onOpenChange,
  defaultMailbox,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMailbox: string;
}) {
  const [from, setFrom] = useState(defaultMailbox);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  function handleSend() {
    // DEAD CALL — see PROTOTYPE-DEAD-CALLS.md
    console.log("[stub] sendEmail", { from, to, subject, body });
    toast.success("Sent (stub) — wire-up deferred to L2+");
    onOpenChange(false);
    setTo("");
    setSubject("");
    setBody("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend}>Send</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
