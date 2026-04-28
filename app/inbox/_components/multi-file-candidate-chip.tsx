"use client";

/**
 * SOURCE: inferred-from-spec (no PROD source read for L1)
 * COPIED: 2026-04-27
 * STATUS: new — L1 simplification of PROD multi-file-candidate-chip.tsx
 * REINTEGRATION: replace with PROD's chip when porting from
 *   `NPR_Dashboard/app/(authenticated)/inbox/_components/multi-file-candidate-chip.tsx`.
 *
 * Per-candidate chip in the Multi-File tab. Click opens a popover with
 * the full match reasoning (confidence, top signal, AI reason) plus
 * Confirm + Reject buttons. DEAD CALL in L1 — both buttons fire
 * console.log + toast (see PROTOTYPE-DEAD-CALLS.md).
 *
 * Iter (2026-04-28): converted from Tooltip-only quick-peek to
 * Popover-driven reasoning panel so operator can decide before
 * confirming. onReject callback added.
 */

import { useState } from "react";
import { Check, X, Sparkles } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MultiFileCandidate } from "@/mock/types";

export function MultiFileCandidateChip({
  candidate,
  onConfirm,
  onReject,
}: {
  candidate: MultiFileCandidate;
  onConfirm?: (dealId: string) => void;
  onReject?: (dealId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const reason = candidate.aiReason ?? `Matched on ${candidate.topSignal}`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            title={`${candidate.fileNo} — ${candidate.confidence}% match. Click for reasoning.`}
            className="inline-flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors outline-none"
          >
            <span className="font-mono">{candidate.fileNo}</span>
            <span className="text-muted-foreground">{candidate.confidence}%</span>
          </button>
        }
      />
      <PopoverContent side="top" align="start" className="w-[320px] p-0">
        <header className="border-b px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[12px] font-semibold">
              {candidate.fileNo}
            </span>
            <ConfidenceBadge value={candidate.confidence} />
          </div>
          {candidate.propertyAddress ? (
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {candidate.propertyAddress}
            </div>
          ) : null}
        </header>
        <div className="px-3 py-2 space-y-2">
          <ConfidenceBar value={candidate.confidence} />
          <div className="text-[11px]">
            <div className="text-muted-foreground uppercase tracking-wide text-[10px]">
              Top signal
            </div>
            <div className="text-foreground/90">{candidate.topSignal}</div>
          </div>
          <div className="text-[11px]">
            <div className="text-muted-foreground uppercase tracking-wide text-[10px] flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" aria-hidden /> AI reason
            </div>
            <div className="text-foreground/90 italic">{reason}</div>
          </div>
        </div>
        <footer className="flex items-center justify-end gap-2 border-t px-3 py-2 bg-muted/20">
          <button
            type="button"
            onClick={() => {
              onReject?.(candidate.dealId);
              setOpen(false);
            }}
            className="inline-flex items-center gap-1 rounded border bg-background px-2 py-1 text-[11px] hover:bg-muted/50 outline-none"
          >
            <X className="h-3 w-3" aria-hidden />
            Reject
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm?.(candidate.dealId);
              setOpen(false);
            }}
            className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 outline-none"
          >
            <Check className="h-3 w-3" aria-hidden />
            Confirm match
          </button>
        </footer>
      </PopoverContent>
    </Popover>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const tone =
    value >= 85
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
      : value >= 70
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        : "bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200";
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${tone}`}
    >
      {value}%
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const fill =
    value >= 85
      ? "bg-emerald-500"
      : value >= 70
        ? "bg-amber-500"
        : "bg-rose-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full ${fill}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        role="progressbar"
      />
    </div>
  );
}
