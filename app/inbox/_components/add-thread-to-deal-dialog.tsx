"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/add-thread-to-deal-dialog.tsx
 * COPIED: 2026-04-27
 * STATUS: stubbed — Confirm = no-op + console.log (DEAD CALL)
 * REINTEGRATION: restore `addThreadToFile` server action + deal autosuggest.
 *
 * Phase 04.2 Plan 11 — Manual file-association picker. THE primary dead call —
 * file-assignment is the user's "leave dead, reactivate later" surface per spec.
 */

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddThreadToDealDialog({
  open,
  onOpenChange,
  threadId,
  messageId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  messageId: string;
}) {
  const [query, setQuery] = useState("");

  function handleConfirm() {
    // DEAD CALL — primary file-assignment stub per spec
    // (PROTOTYPE-DEAD-CALLS.md row 1).
    console.log("[stub] addThreadToFile", {
      threadId,
      messageId,
      query,
    });
    toast.success(`Stub: would assign thread to "${query}" (dead call).`);
    onOpenChange(false);
    setQuery("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add thread to file</DialogTitle>
          <DialogDescription>
            Search by file number, property address, or contact name.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="FL-2026-001 or 1247 Elm St…"
          className="text-sm"
        />
        <p className="text-[11px] text-muted-foreground italic">
          Stub: deal autosuggest deferred to L2+. Any non-empty query confirms (no-op).
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!query.trim()}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
