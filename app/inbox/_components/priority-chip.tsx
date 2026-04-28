"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/priority-chip.tsx
 * COPIED: 2026-04-27
 * STATUS: verbatim
 * REINTEGRATION: no changes needed; pure render component.
 *
 * Phase 04.2 Plan 10 — `PriorityChip` (EMAIL-14, EMAIL-15).
 */

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Tier = "HIGH" | "MEDIUM" | "LOW";

const LABEL: Record<Tier, string> = {
  HIGH: "HIGH",
  MEDIUM: "MED",
  LOW: "LOW",
};

const TIER_SR: Record<Tier, string> = {
  HIGH: "high priority",
  MEDIUM: "medium priority",
  LOW: "low priority",
};

const CLASSES: Record<Tier, string> = {
  HIGH: "bg-rose-500 text-white border-rose-500",
  MEDIUM:
    "bg-amber-50 text-amber-900 border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200",
  LOW: "bg-muted text-muted-foreground border-muted-foreground/20",
};

export function PriorityChip({
  tier,
  reason,
}: {
  tier: Tier;
  reason: string | null;
}) {
  const body = (
    <span
      className={cn(
        "text-[11px] font-medium rounded px-1.5 py-0.5 border whitespace-nowrap inline-flex items-center shrink-0",
        CLASSES[tier],
      )}
    >
      <span aria-hidden="true">{LABEL[tier]}</span>
      <span className="sr-only">{TIER_SR[tier]}</span>
    </span>
  );

  if (!reason) return body;

  return (
    <Tooltip>
      <TooltipTrigger render={body} />
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
