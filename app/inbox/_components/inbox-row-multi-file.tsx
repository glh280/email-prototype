"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-row-multi-file.tsx
 * COPIED: 2026-04-27
 * STATUS: stripped-server-actions — confirmAssociation = no-op (DEAD CALL)
 * REINTEGRATION: restore `confirmAssociation` server action; wire to chip onConfirm.
 *
 * Phase 04.2 Plan 11 — Multi-File row variant (EMAIL-17).
 * D-06 Option C hybrid (2026-04-24): per-candidate chips with aiReason.
 */

import type { InboxRow } from "@/mock/types";
import { InboxRowAll } from "./inbox-row-all";
import { MultiFileCandidateChip } from "./multi-file-candidate-chip";

export function InboxRowMultiFile({
  row,
  onMarkRead,
}: {
  row: InboxRow;
  onMarkRead?: (threadId: string) => void;
}) {
  function handleConfirm(dealId: string) {
    // DEAD CALL — see PROTOTYPE-DEAD-CALLS.md
    console.log("[stub] confirmAssociation (multi-file)", {
      threadId: row.threadId,
      messageId: row.messageId,
      dealId,
    });
    alert(`Stub: would confirm association to deal ${dealId} + dismiss other candidates.`);
  }

  return (
    <li className="border-b last:border-0">
      <InboxRowAll row={row} onMarkRead={onMarkRead} />
      {row.candidates && row.candidates.length > 0 ? (
        <div className="px-4 pb-3 -mt-2 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">
            Candidates:
          </span>
          {row.candidates.map((c) => (
            <MultiFileCandidateChip
              key={c.dealId}
              candidate={c}
              onConfirm={handleConfirm}
            />
          ))}
        </div>
      ) : null}
    </li>
  );
}
