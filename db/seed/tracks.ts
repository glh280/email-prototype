import type { NewTrack } from "@/db/schema";

/**
 * 8 track lookup rows (DEAL-01).
 *
 * sort_order drives the form selector's display order and aligns with the
 * UI-SPEC track badge color mapping (TE first, GI last).
 *
 * Priority defaults per DEAL-01:
 *   - TE, FL → HIGH (active transactional files)
 *   - DP, PO, EC, SL, BL, GI → MEDIUM (everything else)
 *
 * Consumed by `db/seed/run.ts` via `onConflictDoUpdate({ target: tracks.code })`.
 */
export const TRACK_SEEDS: NewTrack[] = [
  { code: "TE", label: "Title & Escrow", defaultPriority: "HIGH", sortOrder: 10, active: true },
  { code: "FL", label: "Funding & Lending", defaultPriority: "HIGH", sortOrder: 20, active: true },
  { code: "DP", label: "Deal Planning & Structure", defaultPriority: "MEDIUM", sortOrder: 30, active: true },
  { code: "PO", label: "Partnership Opportunity", defaultPriority: "MEDIUM", sortOrder: 40, active: true },
  { code: "EC", label: "Education & Consulting", defaultPriority: "MEDIUM", sortOrder: 50, active: true },
  { code: "SL", label: "Seller Listing", defaultPriority: "MEDIUM", sortOrder: 60, active: true },
  { code: "BL", label: "Buyer Listing", defaultPriority: "MEDIUM", sortOrder: 70, active: true },
  { code: "GI", label: "General Inquiry", defaultPriority: "MEDIUM", sortOrder: 80, active: true },
];
