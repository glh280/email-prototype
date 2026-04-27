import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, tasks, dealNotes } from "@/db/schema";

/**
 * Phase 2 Plan 06 — per-deal audit log reader for the Audit tab.
 *
 * Five filters per UI-SPEC lines 481-487:
 *   - all:    rows about this deal OR its tasks OR its notes
 *   - deal:   table_name='deals' AND record_id=dealId
 *   - tasks:  table_name='tasks' AND record_id ∈ (tasks.id WHERE deal_id=dealId)
 *   - notes:  table_name='deal_notes' AND record_id ∈ (deal_notes.id WHERE deal_id=dealId)
 *   - stage:  table_name='deals' AND record_id=dealId AND
 *             (beforeJson->>'stage_id') IS DISTINCT FROM (afterJson->>'stage_id')
 *
 * Results return reverse-chronological (desc(createdAt)). No pagination in
 * P2 — Carrie's ≤ 50-user scope keeps per-deal audit volume bounded; P10
 * adds a cursor if needed.
 *
 * Callers receive real `Date` values for createdAt; JSONB diffs come back as
 * plain JS objects / null for `create`.
 */

export type AuditFilter = "all" | "deal" | "tasks" | "notes" | "stage";

export const AUDIT_FILTERS: readonly AuditFilter[] = [
  "all",
  "deal",
  "tasks",
  "notes",
  "stage",
] as const;

export type AuditRow = {
  id: string;
  tableName: string;
  recordId: string;
  operation: "create" | "update" | "delete";
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown>;
  userEmail: string;
  createdAt: Date;
};

/**
 * Tolerant parser for the `?auditFilter=` URL-state value — unknown values
 * fall back to `all`. Mirrors lib/filter-params.ts conservative behavior so
 * bad/future links still render the tab instead of erroring.
 */
export function parseAuditFilter(raw: string | undefined): AuditFilter {
  if (!raw) return "all";
  return (AUDIT_FILTERS as readonly string[]).includes(raw)
    ? (raw as AuditFilter)
    : "all";
}

export async function queryAuditForDeal(
  dealId: string,
  filter: AuditFilter,
): Promise<AuditRow[]> {
  // Subqueries: record_ids of tasks / notes belonging to this deal
  const taskIdsForDeal = db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.dealId, dealId));

  const noteIdsForDeal = db
    .select({ id: dealNotes.id })
    .from(dealNotes)
    .where(eq(dealNotes.dealId, dealId));

  let whereClause: SQL;

  switch (filter) {
    case "deal":
      whereClause = and(
        eq(auditLog.tableName, "deals"),
        eq(auditLog.recordId, dealId),
      )!;
      break;
    case "tasks":
      whereClause = and(
        eq(auditLog.tableName, "tasks"),
        sql`${auditLog.recordId} IN ${taskIdsForDeal}`,
      )!;
      break;
    case "notes":
      whereClause = and(
        eq(auditLog.tableName, "deal_notes"),
        sql`${auditLog.recordId} IN ${noteIdsForDeal}`,
      )!;
      break;
    case "stage":
      whereClause = and(
        eq(auditLog.tableName, "deals"),
        eq(auditLog.recordId, dealId),
        sql`(${auditLog.beforeJson}->>'stage_id') IS DISTINCT FROM (${auditLog.afterJson}->>'stage_id')`,
      )!;
      break;
    case "all":
    default:
      whereClause = sql`(
        (${auditLog.tableName} = 'deals' AND ${auditLog.recordId} = ${dealId})
        OR (${auditLog.tableName} = 'tasks' AND ${auditLog.recordId} IN ${taskIdsForDeal})
        OR (${auditLog.tableName} = 'deal_notes' AND ${auditLog.recordId} IN ${noteIdsForDeal})
      )`;
      break;
  }

  const rows = await db
    .select({
      id: auditLog.id,
      tableName: auditLog.tableName,
      recordId: auditLog.recordId,
      operation: auditLog.operation,
      beforeJson: auditLog.beforeJson,
      afterJson: auditLog.afterJson,
      userEmail: auditLog.userEmail,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(whereClause)
    .orderBy(desc(auditLog.createdAt));

  return rows.map((r) => ({
    id: r.id,
    tableName: r.tableName,
    recordId: r.recordId,
    operation: r.operation as "create" | "update" | "delete",
    beforeJson: r.beforeJson as Record<string, unknown> | null,
    afterJson: r.afterJson as Record<string, unknown>,
    userEmail: r.userEmail,
    createdAt: r.createdAt,
  }));
}
