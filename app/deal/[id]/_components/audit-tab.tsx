"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter as FilterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import type { AuditFilter, AuditRow } from "@/lib/audit-query";

/**
 * Phase 2 Plan 06 — Audit tab (UI-SPEC lines 451-517).
 *
 * Reverse-chron list of audit_log rows related to this deal (by queryAuditForDeal
 * with the supplied AuditFilter). Sticky filter header with 5 chips (All / Deal /
 * Tasks / Notes / Stage). Active chip gets primary fill.
 *
 * URL state: `?tab=audit&auditFilter=<key>`. The parent Server Component parses
 * the URL + refetches on change, so this component pushes the URL and lets the
 * server re-render.
 *
 * Row rendering:
 *   - Meta line (mono text-[13px] muted): `{relativeTime} · {userEmail} · {table}.{op}`
 *   - Diff lines for operation='update': field label + before → after (with
 *     nulls as italic muted "null"; money/date rendered via format helpers).
 *   - operation='create': only the after values (no arrow)
 *   - operation='delete': before values with strikethrough
 *
 * Empty-filter state (rows.length === 0): Filter icon + `No audit rows match this
 * filter` + body + Show all button (clears ?auditFilter).
 */

const FILTER_CHIPS: Array<{ key: AuditFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "deal", label: "Deal" },
  { key: "tasks", label: "Tasks" },
  { key: "notes", label: "Notes" },
  { key: "stage", label: "Stage" },
];

// Human-readable label for a field key in an audit diff. Raw snake_case
// Postgres column names get massaged into Title Case; unknown keys fall
// back to the raw key so nothing is ever hidden.
const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  priority: "Priority",
  status: "Status",
  quick_note: "Quick note",
  property_address: "Address",
  property_state: "State",
  property_type: "Property type",
  sales_price: "Sales price",
  loan_type: "Loan type",
  transaction_type: "Transaction type",
  loan_amount: "Loan amount",
  estimated_down: "Estimated down",
  earnest_money: "Earnest money",
  est_rehab: "Est. rehab",
  arv: "ARV",
  title_ctc: "Title CTC",
  lender_ctc: "Lender CTC",
  title_file_no: "Title file #",
  loan_no: "Loan #",
  stage_id: "Stage",
  closing_at: "Closing date",
  funding_at: "Funding date",
  closed_at: "Closed at",
  killed_at: "Killed at",
  kill_reason: "Kill reason",
  is_next: "Is next",
  owner_user_id: "Owner",
  due_date: "Due date",
  advances_stage_to_id: "Advances stage to",
  completed_at: "Completed at",
  parent_task_id: "Parent task",
  body: "Body",
  is_system: "System note",
};

// Columns we never want to show in the diff (noise — change on every save)
const IGNORE_KEYS = new Set([
  "id",
  "updated_at",
  "created_at",
  "source",
  "triggeringTaskId",
]);

// Money-valued keys — rendered as `$485,000`
const MONEY_KEYS = new Set([
  "sales_price",
  "loan_amount",
  "estimated_down",
  "earnest_money",
  "est_rehab",
  "arv",
]);

// Date-valued keys — rendered as `Apr 17, 2026`
const DATE_KEYS = new Set([
  "opened_at",
  "closing_at",
  "funding_at",
  "closed_at",
  "killed_at",
  "due_date",
  "completed_at",
]);

function formatFieldLabel(key: string): string {
  return (
    FIELD_LABELS[key] ??
    key
      .split("_")
      .map((w) => w[0]?.toUpperCase() + w.slice(1))
      .join(" ")
  );
}

function formatValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="italic text-muted-foreground">null</span>;
  }
  if (MONEY_KEYS.has(key) && typeof value === "number") {
    return `$${value.toLocaleString("en-US")}`;
  }
  if (DATE_KEYS.has(key)) {
    const d = new Date(value as string | number | Date);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Diff the before+after shapes and yield the changed keys. For create, all
 * after keys are "new" (null before). For delete, all before keys are "old"
 * (null after). For update, only keys whose values differ are returned.
 */
function diffKeys(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  operation: "create" | "update" | "delete",
): string[] {
  const keys = new Set<string>([
    ...(before ? Object.keys(before) : []),
    ...Object.keys(after ?? {}),
  ]);
  const changed: string[] = [];
  for (const k of keys) {
    if (IGNORE_KEYS.has(k)) continue;
    if (operation === "create") {
      // Show every non-null after-value for context
      if (after[k] !== null && after[k] !== undefined && after[k] !== "") {
        changed.push(k);
      }
      continue;
    }
    if (operation === "delete") {
      if (
        before &&
        before[k] !== null &&
        before[k] !== undefined &&
        before[k] !== ""
      ) {
        changed.push(k);
      }
      continue;
    }
    // update: strict-ish equality on JSON serialisation
    const a = JSON.stringify(before?.[k] ?? null);
    const b = JSON.stringify(after?.[k] ?? null);
    if (a !== b) changed.push(k);
  }
  return changed;
}

export function AuditTab(props: {
  rows: AuditRow[];
  currentFilter: AuditFilter;
}) {
  const { rows, currentFilter } = props;
  const router = useRouter();
  const searchParams = useSearchParams();

  const setFilter = (key: AuditFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "audit");
    if (key === "all") {
      params.delete("auditFilter");
    } else {
      params.set("auditFilter", key);
    }
    router.push(`?${params.toString()}`);
  };

  const clearFilter = () => setFilter("all");

  return (
    <div>
      {/* Sticky filter header */}
      <div className="flex gap-2 items-center sticky top-0 bg-background py-3 border-b z-10">
        <span className="text-xs font-medium text-muted-foreground mr-1">
          Filter:
        </span>
        <div className="flex gap-1.5">
          {FILTER_CHIPS.map((chip) => {
            const active = currentFilter === chip.key;
            return (
              <Button
                key={chip.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFilter(chip.key)}
                className={
                  active
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : ""
                }
                aria-pressed={active}
              >
                {chip.label}
              </Button>
            );
          })}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          Sort: Newest first
        </span>
      </div>

      {/* Rows or empty-filter state */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <FilterIcon
            className="h-12 w-12 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="mt-6 text-[28px] font-semibold leading-[1.2]">
            No audit rows match this filter
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a different filter above.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={clearFilter}
          >
            Show all
          </Button>
        </div>
      ) : (
        <div className="divide-y">
          {rows.map((row) => {
            const changed = diffKeys(row.beforeJson, row.afterJson, row.operation);
            return (
              <div key={row.id} className="py-3">
                <div className="font-mono text-[13px] text-muted-foreground">
                  {relativeTime(row.createdAt)} · {row.userEmail} ·{" "}
                  {row.tableName}.{row.operation}
                </div>
                {changed.length > 0 ? (
                  <div className="mt-1.5 space-y-1 pl-2">
                    {changed.map((k) => {
                      const beforeVal = row.beforeJson?.[k];
                      const afterVal = row.afterJson?.[k];
                      if (row.operation === "create") {
                        return (
                          <div key={k}>
                            <span className="text-xs font-medium text-muted-foreground">
                              {formatFieldLabel(k)}:
                            </span>{" "}
                            <span className="font-mono text-[13px]">
                              {formatValue(k, afterVal)}
                            </span>
                          </div>
                        );
                      }
                      if (row.operation === "delete") {
                        return (
                          <div key={k}>
                            <span className="text-xs font-medium text-muted-foreground">
                              {formatFieldLabel(k)}:
                            </span>{" "}
                            <span className="font-mono text-[13px] line-through">
                              {formatValue(k, beforeVal)}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div key={k}>
                          <span className="text-xs font-medium text-muted-foreground">
                            {formatFieldLabel(k)}:
                          </span>{" "}
                          <span className="font-mono text-[13px]">
                            {formatValue(k, beforeVal)}
                          </span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="font-mono text-[13px]">
                            {formatValue(k, afterVal)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
