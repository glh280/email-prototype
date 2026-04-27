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
import { closeDeal } from "../actions/deals";
import type { DealDetail } from "@/lib/deals-query";

/**
 * Phase 2 Plan 05 — Close-deal confirm dialog (DEAL-06 close path, UI-SPEC
 * lines 604-618). Default variant (not destructive — close is benign).
 *
 * Copy verbatim from UI-SPEC:
 *   - Heading: `Mark deal as closed?`
 *   - Body: `The deal stays visible in the list but is marked complete. This is logged to the Audit tab.`
 *   - Confirm: `Mark as closed`
 *   - Success toast: `Deal closed.`
 *   - Error toast: `Couldn't close deal — {error}. Try again.`
 */
export function CloseDealDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deal: DealDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const { deal } = props;

  const onConfirm = () => {
    startTransition(async () => {
      const result = await closeDeal({ dealId: deal.id });
      if (result.ok) {
        toast.success("Deal closed.");
        props.onOpenChange(false);
        router.refresh();
      } else {
        toast.error(`Couldn't close deal — ${result.error}. Try again.`);
      }
    });
  };

  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark deal as closed?</AlertDialogTitle>
          <AlertDialogDescription>
            The deal stays visible in the list but is marked complete. This is
            logged to the Audit tab.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Closing…
              </>
            ) : (
              "Mark as closed"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
