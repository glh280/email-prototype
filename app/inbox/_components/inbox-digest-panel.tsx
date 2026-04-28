"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-digest-panel.tsx
 * COPIED: 2026-04-27
 * STATUS: stripped-server-actions — uses canned MOCK_DIGEST
 * REINTEGRATION: restore `getDigestForUser` call; add 15-min cache layer.
 *
 * Phase 04.2 Plan 12 — Morning digest panel (EMAIL-16). Groups by file_no, HIGH-first.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MOCK_DIGEST } from "@/mock/inbox";
import { PriorityChip } from "./priority-chip";

export function InboxDigestPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Overnight digest</DialogTitle>
          <DialogDescription>
            Grouped by file, priority-ordered. Last 12 hours.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          {MOCK_DIGEST.map((group, idx) => (
            <div key={group.fileNo ?? `unfiled-${idx}`}>
              <div className="flex items-center gap-2 text-xs font-semibold mb-2">
                {group.fileNo ? (
                  <>
                    <span className="font-mono">{group.fileNo}</span>
                    {group.propertyAddress ? (
                      <span className="text-muted-foreground font-normal truncate">
                        · {group.propertyAddress}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">Unfiled</span>
                )}
              </div>
              <ul className="space-y-2 pl-2 border-l-2 border-muted">
                {group.rows.map((row) => (
                  <li key={row.threadId} className="pl-3">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {row.priorityTier ? (
                        <PriorityChip
                          tier={row.priorityTier}
                          reason={row.priorityReason}
                        />
                      ) : null}
                      <span className="text-sm font-medium">
                        {row.subject ?? "(no subject)"}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {row.fromName ?? row.fromAddress}
                    </div>
                    {row.aiSummary ? (
                      <div className="text-xs text-muted-foreground/90 mt-1 italic">
                        {row.aiSummary}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
