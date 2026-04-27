"use client";

import {
  MainContactReadOnly,
  OverviewCard,
  PriorityBadgeReadOnly,
  StatusBadgeReadOnly,
  TrackBadgeReadOnly,
  type FieldSpec,
} from "./overview-card";
import type { DealDetail } from "@/lib/deals-query";

/**
 * Phase 2 Plan 05 Task 3 — Overview tab (UI-SPEC lines 241-302).
 *
 * Four stacked cards, top→bottom (VIEW-05 mandated order):
 *   1. Tracking (FIRST per VIEW-05)
 *   2. Property
 *   3. Financials
 *   4. Dates & Gates
 *
 * Each card is a `<OverviewCard>` with its own edit state. Save calls
 * updateDeal with the diff; router.refresh() re-runs queryDealById so the
 * list view + stepper + header re-render with fresh values.
 *
 * Field labels from UI-SPEC line 301: `Sales Price` / `Loan Amount` /
 * `Estimated Down` / `Earnest Money` / `Est. Rehab` / `ARV` /
 * `Closing Date` / `Funding Date` / `Title CTC` / `Lender CTC`.
 */

const PROPERTY_TYPES: Array<{ value: string; label: string }> = [
  { value: "single_family", label: "Single Family" },
  { value: "multi_family", label: "Multi Family" },
  { value: "condo", label: "Condo" },
  { value: "townhome", label: "Townhome" },
  { value: "commercial", label: "Commercial" },
  { value: "land", label: "Land" },
  { value: "other", label: "Other" },
];

const LOAN_TYPES: Array<{ value: string; label: string }> = [
  { value: "conventional", label: "Conventional" },
  { value: "dscr", label: "DSCR" },
  { value: "hard_money", label: "Hard Money" },
  { value: "bridge", label: "Bridge" },
  { value: "transactional", label: "Transactional" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

const TRANSACTION_TYPES: Array<{ value: string; label: string }> = [
  { value: "purchase", label: "Purchase" },
  { value: "refinance", label: "Refinance" },
  { value: "wholesale", label: "Wholesale" },
  { value: "double_close", label: "Double Close" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "HIGH", label: "HIGH" },
  { value: "MEDIUM", label: "MEDIUM" },
  { value: "LOW", label: "LOW" },
];

export function OverviewTab(props: { deal: DealDetail }) {
  const { deal } = props;

  // Tracking — priority editable; track + status read-only badges; quickNote
  // as a short textarea (UI-SPEC assumption 1: per-card Save/Cancel, not the
  // auto-save-on-blur ideal).
  //
  // P3 Plan 07 — Main Contact is read-only here and reads from the deal_people
  // row (role='main_contact') with legacy column fallback during grace
  // period. The authoritative write path is the File Contacts tab (Plan 06).
  // Intake (/deal/new form) still accepts mainContactName/Email free-text
  // inputs; createDeal dual-writes them to deal_people via the P3 Plan 07
  // extension so this renderer picks them up on first page load.
  const trackingFields: FieldSpec[] = [
    {
      key: "trackCode",
      label: "Track",
      kind: "text",
      readOnly: true,
      renderRead: (d) => <TrackBadgeReadOnly deal={d} />,
    },
    {
      key: "priority",
      label: "Priority",
      kind: "select",
      options: PRIORITY_OPTIONS,
      renderRead: (d) => <PriorityBadgeReadOnly deal={d} />,
    },
    {
      key: "status",
      label: "Status",
      kind: "text",
      readOnly: true,
      renderRead: (d) => <StatusBadgeReadOnly deal={d} />,
    },
    {
      key: "mainContactPerson",
      label: "Main Contact",
      kind: "text",
      readOnly: true,
      renderRead: (d) => <MainContactReadOnly deal={d} />,
    },
    {
      key: "quickNote",
      label: "Quick note",
      kind: "textarea",
    },
  ];

  // Property
  const propertyFields: FieldSpec[] = [
    { key: "propertyAddress", label: "Property Address", kind: "text" },
    { key: "propertyState", label: "Property State", kind: "text" },
    {
      key: "propertyType",
      label: "Property Type",
      kind: "select",
      options: PROPERTY_TYPES,
    },
    { key: "titleFileNo", label: "Title File #", kind: "text" },
    { key: "loanNo", label: "Loan #", kind: "text" },
  ];

  // Financials
  const financialsFields: FieldSpec[] = [
    { key: "salesPrice", label: "Sales Price", kind: "money" },
    { key: "loanAmount", label: "Loan Amount", kind: "money" },
    { key: "estimatedDown", label: "Estimated Down", kind: "money" },
    { key: "earnestMoney", label: "Earnest Money", kind: "money" },
    { key: "estRehab", label: "Est. Rehab", kind: "money" },
    { key: "arv", label: "ARV", kind: "money" },
    {
      key: "loanType",
      label: "Loan Type",
      kind: "select",
      options: LOAN_TYPES,
    },
    {
      key: "transactionType",
      label: "Transaction Type",
      kind: "select",
      options: TRANSACTION_TYPES,
    },
  ];

  // Dates & Gates — openedAt + closedAt read-only (set by system)
  const datesFields: FieldSpec[] = [
    { key: "openedAt", label: "Opened", kind: "date", readOnly: true },
    { key: "closingAt", label: "Closing Date", kind: "date" },
    { key: "fundingAt", label: "Funding Date", kind: "date" },
    { key: "closedAt", label: "Closed", kind: "date", readOnly: true },
    { key: "titleCtc", label: "Title CTC", kind: "bool" },
    { key: "lenderCtc", label: "Lender CTC", kind: "bool" },
  ];

  // Killed-deal-only extra rows: show killed_at + kill_reason read-only
  // appended to Dates & Gates so users see why the deal died.
  if (deal.status === "killed") {
    datesFields.push(
      { key: "killedAt", label: "Killed", kind: "date", readOnly: true },
      { key: "killReason", label: "Kill Reason", kind: "text", readOnly: true },
    );
  }

  return (
    <div className="space-y-4">
      <OverviewCard title="Tracking" deal={deal} fields={trackingFields} />
      <OverviewCard title="Property" deal={deal} fields={propertyFields} />
      <OverviewCard
        title="Financials"
        deal={deal}
        fields={financialsFields}
      />
      <OverviewCard
        title="Dates & Gates"
        deal={deal}
        fields={datesFields}
      />
    </div>
  );
}
