/**
 * Seed row shape — trackCode is a *string pointer* (not an FK).
 *
 * The seeder (`db/seed/run.ts`) resolves trackCode → trackId at insert time
 * by SELECTing from the tracks table. trackCode === null means the stage is
 * universal (track_id NULL in DB).
 *
 * Only TE and FL get track-specific stages in P1 per STAGE-01; DP/PO/EC/SL/BL/GI
 * ride universal stages until P10 calibration.
 */
export type StageSeed = {
  code: string;
  label: string;
  trackCode: "TE" | "FL" | null;
  sortOrder: number;
  isTerminal?: boolean;
};

/**
 * 25 stage rows (STAGE-01):
 *   4 universal + 10 Title & Escrow + 11 Funding & Lending.
 *
 * sort_order namespace:
 *   - universal: 10..40
 *   - TE:        100..190
 *   - FL:        200..300
 *
 * Leaves gaps for P10 calibration to insert additional stages without
 * renumbering. Stage `code` values MUST match STAGE-01 verbatim — stable
 * slugs that stage-advancement code will reference forever.
 *
 * Two terminal stages (isTerminal=true): `file_completed`, `killed`. Both
 * universal so every track can reach them.
 */
export const STAGE_SEEDS: StageSeed[] = [
  // Universal (4) — sort_order 10..40
  { code: "pre_screen_qualification", label: "Pre-Screen / Qualification", trackCode: null, sortOrder: 10 },
  { code: "deal_structuring", label: "Deal Structuring", trackCode: null, sortOrder: 20 },
  { code: "file_completed", label: "File Completed", trackCode: null, sortOrder: 30, isTerminal: true },
  { code: "killed", label: "Killed", trackCode: null, sortOrder: 40, isTerminal: true },

  // Title & Escrow (10) — sort_order 100..190
  { code: "title_order_opened", label: "Title Order Opened", trackCode: "TE", sortOrder: 100 },
  { code: "title_not_clear_to_close", label: "Title — Not Clear to Close", trackCode: "TE", sortOrder: 110 },
  { code: "title_clear_to_close", label: "Title — Clear to Close", trackCode: "TE", sortOrder: 120 },
  { code: "cd_ss_not_balanced", label: "CD / SS — Not Balanced", trackCode: "TE", sortOrder: 130 },
  { code: "cd_ss_balanced", label: "CD / SS — Balanced", trackCode: "TE", sortOrder: 140 },
  { code: "closing_scheduled", label: "Closing Scheduled", trackCode: "TE", sortOrder: 150 },
  { code: "signing_completed", label: "Signing Completed", trackCode: "TE", sortOrder: 160 },
  { code: "disbursed", label: "Disbursed", trackCode: "TE", sortOrder: 170 },
  { code: "recorded", label: "Recorded", trackCode: "TE", sortOrder: 180 },
  { code: "policy_issued", label: "Policy Issued", trackCode: "TE", sortOrder: 190 },

  // Funding & Lending (11) — sort_order 200..300
  { code: "deal_team_assigned", label: "Deal Team Assigned", trackCode: "FL", sortOrder: 200 },
  { code: "preparing_lender_review_pkg", label: "Preparing Lender Review Pkg", trackCode: "FL", sortOrder: 210 },
  { code: "deal_pkg_submitted_to_lender", label: "Deal Pkg Submitted to Lender", trackCode: "FL", sortOrder: 220 },
  { code: "term_sheets_received", label: "Term Sheets Received", trackCode: "FL", sortOrder: 230 },
  { code: "approval_decision_received", label: "Approval Decision Received", trackCode: "FL", sortOrder: 240 },
  { code: "term_sheet_loi_received", label: "Term Sheet / LOI Received", trackCode: "FL", sortOrder: 250 },
  { code: "uw_conditions_issued", label: "UW Conditions Issued", trackCode: "FL", sortOrder: 260 },
  { code: "uw_conditions_cleared", label: "UW Conditions Cleared", trackCode: "FL", sortOrder: 270 },
  { code: "lender_docs_received", label: "Lender Docs Received", trackCode: "FL", sortOrder: 280 },
  { code: "funding_conditions_cleared", label: "Funding Conditions Cleared", trackCode: "FL", sortOrder: 290 },
  { code: "funding_approval_received", label: "Funding Approval Received", trackCode: "FL", sortOrder: 300 },
];
