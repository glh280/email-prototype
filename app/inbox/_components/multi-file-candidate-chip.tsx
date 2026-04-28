"use client";

/**
 * SOURCE: inferred-from-spec (no PROD source read for L1)
 * COPIED: 2026-04-27
 * STATUS: new — L1 simplification of PROD multi-file-candidate-chip.tsx
 * REINTEGRATION: replace with PROD's chip when porting from
 *   `NPR_Dashboard/app/(authenticated)/inbox/_components/multi-file-candidate-chip.tsx`.
 *
 * Per-candidate chip in the Multi-File tab. Renders confidence + topSignal
 * + Haiku ai_reason. Click confirms association — DEAD CALL in L1
 * (no-op + console.log; see PROTOTYPE-DEAD-CALLS.md).
 */

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MultiFileCandidate } from "@/mock/types";

export function MultiFileCandidateChip({
  candidate,
  onConfirm,
}: {
  candidate: MultiFileCandidate;
  onConfirm?: (dealId: string) => void;
}) {
  const reason = candidate.aiReason ?? `Matched on ${candidate.topSignal}`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => onConfirm?.(candidate.dealId)}
            className="inline-flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors"
          >
            <span className="font-mono">{candidate.fileNo}</span>
            <span className="text-muted-foreground">{candidate.confidence}%</span>
          </button>
        }
      />
      <TooltipContent>
        <div className="max-w-xs space-y-1">
          {candidate.propertyAddress ? (
            <div className="font-medium">{candidate.propertyAddress}</div>
          ) : null}
          <div className="text-[11px] opacity-80">{reason}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
