"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  upsertDealPerson,
  removeDealPerson,
} from "@/app/deal/[id]/actions/people";
import type { DealPersonRow } from "@/lib/deal-people-query";

/**
 * Phase 3 Plan 06 Task 2 — lender_partner free-text slot row.
 *
 * DISTINCT from the contact_fk autosuggest flow (REQUIREMENTS.md line 85:
 * "free-text because lenders are often not in the contacts registry").
 * Plan 04's upsertDealPerson + freeTextValue branch synthesizes a minimal
 * contact row (full_name=value, role_hint='lender') behind the scenes
 * inside the same tx, keeping deal_people shape uniform (every row has
 * a contact_id FK) while preserving the UX distinction.
 *
 * Two states:
 *   - Assigned: show contactFullName + "Free-text lender" subtitle + Remove (✕)
 *   - Unassigned: plain Input + Save button
 *
 * After mutation: router.refresh() so the server component re-queries
 * queryDealPeopleForDeal and the row flips state without a full reload.
 */
export function LenderFreeTextRow({
  dealId,
  current,
}: {
  dealId: string;
  current: DealPersonRow | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  async function onSave() {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    startTransition(async () => {
      const result = await upsertDealPerson({
        dealId,
        role: "lender_partner",
        freeTextValue: trimmed,
      });
      if (result.ok === false) {
        toast.error("error" in result ? result.error : "Could not save lender.");
        return;
      }
      toast.success("Lender saved.");
      setValue("");
      router.refresh();
    });
  }

  async function onRemove() {
    startTransition(async () => {
      const result = await removeDealPerson({
        dealId,
        role: "lender_partner",
      });
      if (result.ok === false) {
        toast.error(
          "error" in result ? result.error : "Could not remove lender.",
        );
        return;
      }
      toast.success("Lender removed.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b">
      <div className="w-[160px] text-sm font-medium">Lender</div>
      <div className="flex-1">
        {current && current.contactFullName ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{current.contactFullName}</div>
              <div className="text-xs text-muted-foreground">
                Free-text lender
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={isPending}
              aria-label="Remove lender"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Lender name (e.g., Wells Fargo)"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button
              size="sm"
              onClick={onSave}
              disabled={isPending || value.trim().length === 0}
            >
              Save
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
