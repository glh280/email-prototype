"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ContactAutosuggest } from "./contact-autosuggest";
import {
  upsertDealPerson,
  removeDealPerson,
} from "@/app/deal/[id]/actions/people";
import { NewContactDialog } from "@/app/contacts/_components/new-contact-dialog";
import type { DealPersonRow } from "@/lib/deal-people-query";
import type { RoleSlot } from "@/lib/role-slots";
import type { ContactAutosuggestRow } from "@/lib/contacts-query";

/**
 * Phase 3 Plan 06 Task 2 — contact_fk role slot row.
 *
 * Two states:
 *   A) Assigned — shows contactFullName + contactEmail + Remove (✕)
 *   B) Unassigned — shows <ContactAutosuggest>; on pick → upsertDealPerson;
 *      on "Create new contact" → open NewContactDialog pre-filled, then
 *      auto-assign via onCreated callback.
 *
 * NewContactDialog was extended additively in Plan 06 with optional props
 * (initialFullName, controlledOpen, onOpenChange, onCreated) — the trigger
 * button is hidden when controlledOpen is set, and onCreated fires BEFORE
 * the dialog's internal router.refresh() so we can assign the newly created
 * contact to the slot immediately.
 */
export function RoleSlotRow({
  dealId,
  slot,
  current,
}: {
  dealId: string;
  slot: RoleSlot;
  current: DealPersonRow | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [prefillName, setPrefillName] = useState<string | null>(null);

  function assign(contactId: string) {
    startTransition(async () => {
      const result = await upsertDealPerson({
        dealId,
        role: slot.code,
        contactId,
      });
      if (result.ok === false) {
        toast.error("error" in result ? result.error : "Could not assign.");
        return;
      }
      toast.success(`${slot.label} assigned.`);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeDealPerson({ dealId, role: slot.code });
      if (result.ok === false) {
        toast.error("error" in result ? result.error : "Could not remove.");
        return;
      }
      toast.success(`${slot.label} removed.`);
      router.refresh();
    });
  }

  function onPick(row: ContactAutosuggestRow) {
    assign(row.id);
  }
  function onCreateNew(typed: string) {
    setPrefillName(typed);
  }
  function onCreated(newContactId: string) {
    setPrefillName(null);
    assign(newContactId);
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b">
      <div className="w-[160px] text-sm font-medium">{slot.label}</div>
      <div className="flex-1">
        {current && current.contactId && current.contactFullName ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                {current.contactFullName}
              </div>
              {current.contactEmail ? (
                <div className="text-xs text-muted-foreground">
                  {current.contactEmail}
                </div>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={remove}
              disabled={isPending}
              aria-label={`Remove ${slot.label}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <ContactAutosuggest
            triggerLabel="Assign"
            onPick={onPick}
            onCreateNew={onCreateNew}
          />
        )}
      </div>
      {prefillName !== null ? (
        <NewContactDialog
          initialFullName={prefillName}
          controlledOpen={true}
          onOpenChange={(v) => {
            if (!v) setPrefillName(null);
          }}
          onCreated={onCreated}
        />
      ) : null}
    </div>
  );
}
