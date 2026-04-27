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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { killDeal } from "../actions/deals";
import { killDealSchema } from "@/lib/deal-schema";
import type { DealDetail } from "@/lib/deals-query";

/**
 * Phase 2 Plan 05 — Kill-deal confirm dialog (DEAL-06 kill path, UI-SPEC
 * lines 573-601). Destructive variant; requires reason ≥ 3 chars.
 *
 * Copy verbatim from UI-SPEC:
 *   - Heading: `Kill this deal?`
 *   - Body: explains what "killed" means and that it's logged to Audit
 *   - Reason label: `Reason (required)` (Textarea, 4 rows)
 *   - Confirm: `Kill deal` (destructive, disabled until reason.trim() >= 3)
 *   - Success toast: `Deal killed.`
 *   - Error toast: `Couldn't kill deal — {error}. Try again.`
 *
 * Client-side uses killDealSchema.safeParse for immediate feedback; the
 * server re-validates.
 */
export function KillDealDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deal: DealDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [reason, setReason] = React.useState("");
  const [clientError, setClientError] = React.useState<string | null>(null);
  const { deal } = props;

  // Reset reason when the dialog opens (fresh textarea each time)
  React.useEffect(() => {
    if (props.open) {
      setReason("");
      setClientError(null);
    }
  }, [props.open]);

  const trimmedLen = reason.trim().length;
  const isConfirmEnabled = trimmedLen >= 3 && !isPending;

  const onConfirm = () => {
    // Client-side pre-validate to surface Zod messages without a round-trip.
    const parsed = killDealSchema.safeParse({
      dealId: deal.id,
      reason,
    });
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message ?? "Please provide a reason.";
      setClientError(msg);
      return;
    }
    setClientError(null);

    startTransition(async () => {
      const result = await killDeal({ dealId: deal.id, reason });
      if (result.ok) {
        toast.success("Deal killed.");
        props.onOpenChange(false);
        router.refresh();
      } else {
        toast.error(`Couldn't kill deal — ${result.error}. Try again.`);
      }
    });
  };

  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kill this deal?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks the deal as killed and stops the active list view from
            showing it by default. You can no longer advance milestones on a
            killed deal. This action is logged to the Audit tab.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="kill-reason" className="text-sm font-medium">
            Reason (required)
          </Label>
          <Textarea
            id="kill-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={clientError !== null ? true : undefined}
            aria-describedby={clientError ? "kill-reason-error" : undefined}
            disabled={isPending}
          />
          {clientError ? (
            <p
              id="kill-reason-error"
              className="text-xs text-destructive"
              role="alert"
            >
              {clientError}
            </p>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onConfirm}
            disabled={!isConfirmEnabled}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Killing…
              </>
            ) : (
              "Kill deal"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
