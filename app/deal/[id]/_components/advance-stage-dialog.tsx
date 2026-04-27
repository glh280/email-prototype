"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { advanceStage } from "../actions/stages";
import type { DealDetail } from "@/lib/deals-query";

/**
 * Phase 2 Plan 05 — Advance-stage confirm dialog (STAGE-02, UI-SPEC lines 525-548).
 *
 * Copy verbatim from UI-SPEC §Copywriting Contract:
 *   - Heading: `Advance milestone?`
 *   - Body: `Current: {current.label}` / `Next: {next.label}` / `This will be logged to the Audit tab.`
 *   - Cancel: `Cancel`
 *   - Confirm: `Advance to {next.label}` (variant default — not destructive)
 *   - Success toast: `Advanced to {next.label}.`
 *   - Error toast: `Couldn't advance — {error}. Try again.`
 */
export function AdvanceStageDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deal: DealDetail;
  nextStage: DealDetail["availableStages"][number];
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const { deal, nextStage } = props;

  const onConfirm = () => {
    startTransition(async () => {
      const result = await advanceStage({
        dealId: deal.id,
        targetStageId: nextStage.id,
      });
      if (result.ok) {
        toast.success(`Advanced to ${result.toStageLabel}.`);
        props.onOpenChange(false);
        router.refresh();
      } else {
        toast.error(`Couldn't advance — ${result.error}. Try again.`);
      }
    });
  };

  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Advance milestone?</AlertDialogTitle>
          <AlertDialogDescription>
            This will be logged to the Audit tab.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5 text-sm">
          <div>
            <span className="text-muted-foreground">Current: </span>
            <span className="font-medium text-foreground">
              {deal.currentStage.label}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Next: </span>
            <span className="font-medium text-foreground">
              {nextStage.label}
            </span>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Advancing…
              </>
            ) : (
              `Advance to ${nextStage.label}`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
