"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-row-unassigned.tsx
 * COPIED: 2026-04-27
 * STATUS: stripped-server-actions — confirmAssociation = no-op (DEAD CALL)
 * REINTEGRATION: restore `confirmAssociation` + `addThreadToFile` actions.
 *
 * Phase 04.2 Plan 11 — Unassigned row variant.
 * Renders base row + suggestion pill (when ≥70% confidence) + Add-to-File button.
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InboxRow } from "@/mock/types";
import { InboxRowAll } from "./inbox-row-all";
import { UnassignedSuggestionPill } from "./unassigned-suggestion-pill";
import { AddThreadToDealDialog } from "./add-thread-to-deal-dialog";

export function InboxRowUnassigned({
  row,
  onMarkRead,
}: {
  row: InboxRow;
  onMarkRead?: (threadId: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);

  function handleConfirm(dealId: string) {
    // DEAD CALL — see PROTOTYPE-DEAD-CALLS.md
    console.log("[stub] confirmAssociation (unassigned suggestion)", {
      threadId: row.threadId,
      messageId: row.messageId,
      dealId,
    });
    alert(`Stub: would confirm association to deal ${dealId}.`);
  }

  return (
    <li className="border-b last:border-0">
      <InboxRowAll row={row} onMarkRead={onMarkRead} />
      <div className="px-4 pb-3 -mt-2 flex items-center gap-2 flex-wrap">
        {row.suggestion ? (
          <UnassignedSuggestionPill
            suggestion={row.suggestion}
            onConfirm={handleConfirm}
          />
        ) : null}
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[11px] gap-1"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-3 w-3" />
          Add to file
        </Button>
      </div>
      <AddThreadToDealDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        threadId={row.threadId}
        messageId={row.messageId}
      />
    </li>
  );
}
