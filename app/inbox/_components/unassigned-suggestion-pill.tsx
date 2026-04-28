"use client";

/**
 * SOURCE: inferred-from-spec (no PROD source read for L1)
 * COPIED: 2026-04-27
 * STATUS: new — L1 simplification of PROD unassigned-suggestion-pill.tsx
 * REINTEGRATION: replace with PROD's pill when porting from
 *   `NPR_Dashboard/app/(authenticated)/inbox/_components/unassigned-suggestion-pill.tsx`.
 *
 * Single-suggestion pill in the Unassigned tab. Click confirms association.
 * DEAD CALL in L1.
 */

import type { UnassignedSuggestion } from "@/mock/types";

export function UnassignedSuggestionPill({
  suggestion,
  onConfirm,
}: {
  suggestion: UnassignedSuggestion;
  onConfirm?: (dealId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onConfirm?.(suggestion.dealId)}
      className="inline-flex items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium hover:bg-primary/20 transition-colors"
      aria-label={`Confirm association with ${suggestion.fileNo}`}
    >
      <span className="font-mono">{suggestion.fileNo}</span>
      <span className="text-muted-foreground">{suggestion.confidence}%</span>
      {suggestion.propertyAddress ? (
        <span className="text-muted-foreground truncate max-w-[180px]">
          · {suggestion.propertyAddress}
        </span>
      ) : null}
    </button>
  );
}
