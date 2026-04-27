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
import { revertStage } from "../actions/stages";
import type { DealDetail } from "@/lib/deals-query";

/**
 * Phase 2 Plan 05 — Revert-stage confirm dialog (STAGE-03, UI-SPEC lines 552-571).
 *
 * Opened by clicking a past pip in the stepper. Destructive-outline confirm
 * CTA (UI-SPEC Assumption 10: revert is destructive-ish but outline, not solid
 * destructive — kill owns the solid-destructive CTA).
 *
 * Copy verbatim from UI-SPEC §Copywriting Contract:
 *   - Heading: `Revert milestone to {target.label}?`
 *   - Confirm: `Revert to {target.label}` (variant destructive)
 *   - Success toast: `Reverted to {target.label}.`
 *   - Error toast: `Couldn't revert — {error}. Try again.`
 */
export function RevertStageDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deal: DealDetail;
  targetStage: DealDetail["availableStages"][number] | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const { deal, targetStage } = props;

  if (!targetStage) return null;

  const onConfirm = () => {
    startTransition(async () => {
      const result = await revertStage({
        dealId: deal.id,
        targetStageId: targetStage.id,
      });
      if (result.ok) {
        toast.success(`Reverted to ${result.toStageLabel}.`);
        props.onOpenChange(false);
        router.refresh();
      } else {
        toast.error(`Couldn't revert — ${result.error}. Try again.`);
      }
    });
  };

  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Revert milestone to {targetStage.label}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Revert is also logged to the Audit tab. Use this sparingly — stage
            changes are intended to move forward.
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
            <span className="text-muted-foreground">Target: </span>
            <span className="font-medium text-foreground">
              {targetStage.label}
            </span>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Reverting…
              </>
            ) : (
              `Revert to ${targetStage.label}`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
