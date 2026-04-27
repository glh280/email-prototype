import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { deals, tracks, stages, auditLog, dealPeople, contacts } from "@/db/schema";
import type { FilterParams } from "@/lib/filter-params";

/**
 * Phase 1 Plan 06 Task 2 — deals list query.
 *
 * Reads real deals from Postgres for VIEW-01, applying VIEW-02 filters and
 * sort. Joins tracks + stages for label columns, and left-joins a CTE that
 * computes MAX(audit_log.created_at) per deal for the Activity column (D-15).
 *
 * D-12 semantics: AND across filter groups, OR within multi-select (the
 * inArray(...) clauses naturally implement OR within each group; combining
 * them with and(...) produces AND across groups).
 *
 * D-13: default sort = activity_desc.
 *
 * D-14 P1 semantics: "Needs me" = deals.internalOwner = current_user.id.
 *
 * D-15: Activity = COALESCE(MAX(audit_log.created_at WHERE table_name='deals'
 *       AND record_id=deal.id), deal.updated_at). Plan 05's createDeal writes
 *       an audit row, so the fallback is defensive (covers deals created before
 *       audit writes landed — none in P1, but the code stays honest).
 *
 * D-16 is rendered at the UI layer (em-dash placeholder); the query itself
 * returns `null` for columns without data (Main Contact, Quick Note, etc.) and
 * the row component substitutes the em-dash.
 *
 * IMPORTANT: Uses the canonical `@/lib/db` client (per Plan 01 Task 3). Never
 * imports `@/db/client`.
 */

export type DealListRow = {
  id: string;
  fileNo: string;
  title: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "active" | "closed" | "killed";
  trackCode: string;
  trackLabel: string;
  stageCode: string;
  stageLabel: string;
  mainContactName: string | null;
  propertyAddress: string | null;
  quickNote: string | null;
  activityAt: Date; // coalesce(max(audit_log.created_at), deal.updated_at)
  closingAt: Date | null;
  fundingAt: Date | null;
};

export async function queryDeals(
  filters: FilterParams,
  currentUserId: string,
): Promise<DealListRow[]> {
  // CTE: for each deal, the most recent audit_log.created_at timestamp.
  const activity = db.$with("deal_activity").as(
    db
      .select({
        dealId: auditLog.recordId,
        lastAt: sql<Date>`max(${auditLog.createdAt})`.as("last_at"),
      })
      .from(auditLog)
      .where(eq(auditLog.tableName, "deals"))
      .groupBy(auditLog.recordId),
  );

  // Activity timestamp expression reused in SELECT + ORDER BY
  const activityExpr = sql<Date>`coalesce(${activity.lastAt}, ${deals.updatedAt})`;

  // Build WHERE clauses. D-12: AND between groups, OR within (inArray).
  const whereClauses: SQL[] = [];
  if (filters.needsMe)
    whereClauses.push(eq(deals.internalOwner, currentUserId));
  if (filters.track.length)
    whereClauses.push(inArray(tracks.code, filters.track));
  if (filters.milestone.length)
    whereClauses.push(inArray(stages.code, filters.milestone));
  if (filters.priority.length)
    whereClauses.push(inArray(deals.priority, filters.priority));
  if (filters.closing) {
    whereClauses.push(gte(deals.closingAt, filters.closing.from));
    whereClauses.push(lte(deals.closingAt, filters.closing.to));
  }
  if (filters.funding) {
    whereClauses.push(gte(deals.fundingAt, filters.funding.from));
    whereClauses.push(lte(deals.fundingAt, filters.funding.to));
  }
  // overdue + taskDue are P2-data dependent (tasks table); no-op in P1.

  // Sort per filters.sort. task_due_* falls back to activity (P2 data).
  let orderBy: SQL;
  switch (filters.sort) {
    case "activity_asc":
      orderBy = asc(activityExpr);
      break;
    case "activity_desc":
      orderBy = desc(activityExpr);
      break;
    case "file_no_asc":
      orderBy = asc(deals.fileNo);
      break;
    case "file_no_desc":
      orderBy = desc(deals.fileNo);
      break;
    case "priority_asc":
      orderBy = asc(deals.priority);
      break;
    case "priority_desc":
      orderBy = desc(deals.priority);
      break;
    case "task_due_asc":
    case "task_due_desc":
      // P2 data not in DB yet — fall back to activity_desc.
      orderBy = desc(activityExpr);
      break;
    default:
      orderBy = desc(activityExpr);
  }

  const rows = await db
    .with(activity)
    .select({
      id: deals.id,
      fileNo: deals.fileNo,
      title: deals.title,
      priority: deals.priority,
      status: deals.status,
      trackCode: tracks.code,
      trackLabel: tracks.label,
      stageCode: stages.code,
      stageLabel: stages.label,
      mainContactName: deals.mainContactName,
      propertyAddress: deals.propertyAddress,
      quickNote: deals.quickNote,
      activityAt: activityExpr,
      closingAt: deals.closingAt,
      fundingAt: deals.fundingAt,
    })
    .from(deals)
    .innerJoin(tracks, eq(deals.trackId, tracks.id))
    .innerJoin(stages, eq(deals.stageId, stages.id))
    .leftJoin(activity, eq(deals.id, activity.dealId))
    .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
    .orderBy(orderBy);

  // Bug fix (2026-04-19 incident): `sql<Date>` is a TypeScript-only
  // annotation. At runtime, values returned through `sql` template
  // literals inside a CTE come back as strings (pg's automatic type
  // parsing via OID doesn't thread through CTE wrappers reliably).
  // `relativeTime(activityAt)` then calls `.getTime()` on a string and
  // crashes the whole list view with "a.getTime is not a function".
  //
  // Symptom didn't manifest pre-ClickUp-import because an empty deals
  // table → empty CTE → coalesce fell back to `deals.updatedAt` (a
  // direct column pluck, which pg DOES parse to Date correctly).
  //
  // Fix: coerce the two CTE-sourced / sql-template Date fields at the
  // mapping boundary. `closingAt`/`fundingAt` come from direct column
  // plucks and don't need coercion, but we normalize them too for
  // safety in case a future refactor changes their source.
  return rows.map((row) => ({
    ...row,
    activityAt:
      row.activityAt instanceof Date
        ? row.activityAt
        : new Date(row.activityAt as unknown as string),
    closingAt:
      row.closingAt === null
        ? null
        : row.closingAt instanceof Date
          ? row.closingAt
          : new Date(row.closingAt as unknown as string),
    fundingAt:
      row.fundingAt === null
        ? null
        : row.fundingAt instanceof Date
          ? row.fundingAt
          : new Date(row.fundingAt as unknown as string),
  })) as DealListRow[];
}

/**
 * Phase 2 Plan 05 Task 1 — single-deal loader for `/deal/[id]`.
 *
 * Returns `null` for not-found (page calls `notFound()` from next/navigation).
 * Assembles:
 *   - Deal row (all editable columns per updateDealSchema surface)
 *   - Current stage (joined via deals.stage_id)
 *   - Track (joined via deals.track_id — code + label for TrackBadge)
 *   - availableStages: all universal (track_id IS NULL) + deal-track-specific
 *     stages, ordered by sort_order, for the stepper.
 *
 * DEAL-05 editable surface intentionally excludes mainContactName/Email/Phone
 * per B1 revision (D-03 migration to P3 contacts FK). The columns exist on
 * `deals` but are not surfaced on DealDetail.
 */
export type DealDetail = {
  id: string;
  fileNo: string;
  title: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "active" | "closed" | "killed";
  // Track + current stage (joined)
  trackId: string;
  trackCode: string;
  trackLabel: string;
  currentStage: {
    id: string;
    code: string;
    label: string;
    sortOrder: number;
    isTerminal: boolean;
    trackId: string | null;
  };
  // All stages applicable to this deal (universal + deal.track_id-specific),
  // ordered by sort_order, for the stepper.
  availableStages: Array<{
    id: string;
    code: string;
    label: string;
    sortOrder: number;
    isTerminal: boolean;
    trackId: string | null;
  }>;
  // All editable deals columns (mainContact* intentionally omitted per B1)
  propertyAddress: string | null;
  propertyState: string | null;
  propertyType: string | null;
  salesPrice: number | null;
  loanType: string | null;
  transactionType: string | null;
  loanAmount: number | null;
  estimatedDown: number | null;
  earnestMoney: number | null;
  estRehab: number | null;
  arv: number | null;
  titleCtc: boolean;
  lenderCtc: boolean;
  titleFileNo: string | null;
  loanNo: string | null;
  quickNote: string | null;
  openedAt: Date;
  closingAt: Date | null;
  fundingAt: Date | null;
  closedAt: Date | null;
  killedAt: Date | null;
  killReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  internalOwner: string | null;
  createdBy: string;
  // P3 Plan 07 — main_contact deal_people row (if any). Joined from
  // deal_people LEFT JOIN contacts so the Overview tab reads from the
  // authoritative post-D-03 source. Legacy deals.main_contact_* text
  // columns remain on the table for grace-period fallback (dropped in P10).
  mainContactPerson: {
    dealPersonId: string;
    contactId: string | null;
    contactFullName: string | null;
    contactEmail: string | null;
  } | null;
  // Legacy text columns — preserved for grace-period fallback in the
  // Overview Main Contact renderer. Drop scheduled for P10 calibration.
  legacyMainContactName: string | null;
  legacyMainContactEmail: string | null;
};

export async function queryDealById(id: string): Promise<DealDetail | null> {
  // 1. SELECT deal joined with tracks + current stage.
  const [row] = await db
    .select({
      id: deals.id,
      fileNo: deals.fileNo,
      title: deals.title,
      priority: deals.priority,
      status: deals.status,
      trackId: deals.trackId,
      trackCode: tracks.code,
      trackLabel: tracks.label,
      stageId: stages.id,
      stageCode: stages.code,
      stageLabel: stages.label,
      stageSortOrder: stages.sortOrder,
      stageIsTerminal: stages.isTerminal,
      stageTrackId: stages.trackId,
      propertyAddress: deals.propertyAddress,
      propertyState: deals.propertyState,
      propertyType: deals.propertyType,
      salesPrice: deals.salesPrice,
      loanType: deals.loanType,
      transactionType: deals.transactionType,
      loanAmount: deals.loanAmount,
      estimatedDown: deals.estimatedDown,
      earnestMoney: deals.earnestMoney,
      estRehab: deals.estRehab,
      arv: deals.arv,
      titleCtc: deals.titleCtc,
      lenderCtc: deals.lenderCtc,
      titleFileNo: deals.titleFileNo,
      loanNo: deals.loanNo,
      quickNote: deals.quickNote,
      openedAt: deals.openedAt,
      closingAt: deals.closingAt,
      fundingAt: deals.fundingAt,
      closedAt: deals.closedAt,
      killedAt: deals.killedAt,
      killReason: deals.killReason,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
      internalOwner: deals.internalOwner,
      createdBy: deals.createdBy,
      // Legacy P1 text columns — preserved for grace-period fallback.
      legacyMainContactName: deals.mainContactName,
      legacyMainContactEmail: deals.mainContactEmail,
    })
    .from(deals)
    .innerJoin(tracks, eq(deals.trackId, tracks.id))
    .innerJoin(stages, eq(deals.stageId, stages.id))
    .where(eq(deals.id, id))
    .limit(1);

  if (!row) return null;

  // P3 Plan 07 — fetch the main_contact deal_people row (if any). LEFT JOIN
  // contacts so a SET NULL cascade (contact deleted) still returns the
  // deal_people row with null fullName/email (the UI can fall back to the
  // legacy columns).
  const [mainContactRow] = await db
    .select({
      dealPersonId: dealPeople.id,
      contactId: dealPeople.contactId,
      contactFullName: contacts.fullName,
      contactEmail: contacts.email,
    })
    .from(dealPeople)
    .leftJoin(contacts, eq(contacts.id, dealPeople.contactId))
    .where(
      and(eq(dealPeople.dealId, id), eq(dealPeople.role, "main_contact")),
    )
    .limit(1);

  // 2. SELECT all stages for this deal (universal OR same track_id) ordered
  //    by sort_order. The stepper renders pips in this order.
  const stageRows = await db
    .select({
      id: stages.id,
      code: stages.code,
      label: stages.label,
      sortOrder: stages.sortOrder,
      isTerminal: stages.isTerminal,
      trackId: stages.trackId,
    })
    .from(stages)
    .where(or(isNull(stages.trackId), eq(stages.trackId, row.trackId)))
    .orderBy(asc(stages.sortOrder));

  return {
    id: row.id,
    fileNo: row.fileNo,
    title: row.title,
    priority: row.priority as "HIGH" | "MEDIUM" | "LOW",
    status: row.status as "active" | "closed" | "killed",
    trackId: row.trackId,
    trackCode: row.trackCode,
    trackLabel: row.trackLabel,
    currentStage: {
      id: row.stageId,
      code: row.stageCode,
      label: row.stageLabel,
      sortOrder: row.stageSortOrder,
      isTerminal: row.stageIsTerminal,
      trackId: row.stageTrackId,
    },
    availableStages: stageRows,
    propertyAddress: row.propertyAddress,
    propertyState: row.propertyState,
    propertyType: row.propertyType,
    salesPrice: row.salesPrice,
    loanType: row.loanType,
    transactionType: row.transactionType,
    loanAmount: row.loanAmount,
    estimatedDown: row.estimatedDown,
    earnestMoney: row.earnestMoney,
    estRehab: row.estRehab,
    arv: row.arv,
    titleCtc: row.titleCtc,
    lenderCtc: row.lenderCtc,
    titleFileNo: row.titleFileNo,
    loanNo: row.loanNo,
    quickNote: row.quickNote,
    openedAt: row.openedAt,
    closingAt: row.closingAt,
    fundingAt: row.fundingAt,
    closedAt: row.closedAt,
    killedAt: row.killedAt,
    killReason: row.killReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    internalOwner: row.internalOwner,
    createdBy: row.createdBy,
    mainContactPerson: mainContactRow ?? null,
    legacyMainContactName: row.legacyMainContactName,
    legacyMainContactEmail: row.legacyMainContactEmail,
  };
}
