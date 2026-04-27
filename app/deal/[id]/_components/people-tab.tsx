"use client";

import { RoleSlotRow } from "./role-slot-row";
import { LenderFreeTextRow } from "./lender-free-text-row";
import { slotsForTrack, type TrackCode } from "@/lib/role-slots";
import type { DealDetail } from "@/lib/deals-query";
import type { DealPersonRow } from "@/lib/deal-people-query";

/**
 * Phase 3 Plan 06 Task 3 — File Contacts tab pane.
 *
 * Loops slotsForTrack(deal.trackCode) — Plan 02's canonical per-track
 * applicability map — and renders one row per slot. For every slot, look
 * up the matching deal_people row (by role) to determine assigned vs
 * unassigned state.
 *
 * lender_partner gets a distinct row component (source === "free_text")
 * per REQUIREMENTS line 85 — it's the only slot where the UX is a plain
 * text input rather than the autosuggest combobox. Mortgage Partner,
 * which IS autosuggest-backed, renders via the standard RoleSlotRow.
 *
 * Rendering order follows ROLE_SLOTS declaration order (slotsForTrack
 * preserves it): universals first (directing_agent, main_contact,
 * internal_owner), then track-specific slots.
 */
export function PeopleTab({
  deal,
  dealPeople,
}: {
  deal: DealDetail;
  dealPeople: DealPersonRow[];
}) {
  const trackCode = deal.trackCode as TrackCode;
  const slots = slotsForTrack(trackCode);

  // Index by role for O(1) per-slot lookup.
  const byRole = new Map<string, DealPersonRow>();
  for (const row of dealPeople) byRole.set(row.role, row);

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col">
        {slots.map((slot) =>
          slot.source === "free_text" ? (
            <LenderFreeTextRow
              key={slot.code}
              dealId={deal.id}
              current={byRole.get(slot.code) ?? null}
            />
          ) : (
            <RoleSlotRow
              key={slot.code}
              dealId={deal.id}
              slot={slot}
              current={byRole.get(slot.code) ?? null}
            />
          ),
        )}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        {slots.length} role slot{slots.length === 1 ? "" : "s"} for {trackCode}{" "}
        deals.
      </p>
    </div>
  );
}
