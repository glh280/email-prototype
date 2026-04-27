/**
 * Phase 1 Plan 06 Task 1 — URL filter param parse/serialize (VIEW-02 / D-07).
 *
 * The list view's 8 filters + sort live entirely in URL search params so that
 * links are shareable and no client JS is required to derive state. This module
 * is the ONLY place that talks to the raw URL shape; every consumer (server
 * component, client filter bar, tests) goes through parseFilterParams /
 * serializeFilterParams.
 *
 * URL shape (UI-SPEC Page 1):
 *   ?needsMe=1&track=TE,FL&milestone=title_clear_to_close&priority=HIGH
 *   &overdue=1&closing=2026-04-01..2026-04-30&funding=...&taskDue=...
 *   &sort=activity_desc
 *
 * Semantics:
 *   - D-07: URL-state is source of truth
 *   - D-12: AND across groups, OR within multi-select (enforced at query layer)
 *   - D-13: default sort = "activity_desc" (omitted from serialized URL)
 *
 * Tolerant parser: invalid values are silently dropped (not thrown) so a bad
 * link still renders the list view instead of error-ing.
 *
 * Stage codes for `milestone` are NOT validated here — the query-layer
 * `inArray(stages.code, ...)` naturally filters to real codes. Validating here
 * would require importing STAGE_SEEDS and coupling this module to seed data.
 */

const VALID_TRACKS = [
  "TE",
  "FL",
  "DP",
  "PO",
  "EC",
  "SL",
  "BL",
  "GI",
] as const;
const VALID_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
const VALID_SORTS = [
  "activity_desc",
  "activity_asc",
  "task_due_asc",
  "task_due_desc",
  "priority_desc",
  "priority_asc",
  "file_no_asc",
  "file_no_desc",
] as const;

export type SortValue = (typeof VALID_SORTS)[number];
export type TrackCode = (typeof VALID_TRACKS)[number];
export type PriorityValue = (typeof VALID_PRIORITIES)[number];

export type FilterParams = {
  needsMe: boolean;
  track: TrackCode[];
  milestone: string[]; // stage codes, validated at query layer
  priority: PriorityValue[];
  overdue: boolean;
  closing: { from: Date; to: Date } | null;
  funding: { from: Date; to: Date } | null;
  taskDue: { from: Date; to: Date } | null;
  sort: SortValue;
};

function parseDateRange(s: string | undefined): { from: Date; to: Date } | null {
  if (!s) return null;
  const [a, b] = s.split("..");
  if (!a || !b) return null;
  const from = new Date(a);
  const to = new Date(b);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
  return { from, to };
}

function parseCsvEnum<T extends readonly string[]>(
  raw: string | undefined,
  allowed: T,
): T[number][] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is T[number] =>
      (allowed as readonly string[]).includes(s),
    );
}

export function parseFilterParams(
  sp: Record<string, string | string[] | undefined>,
): FilterParams {
  const getStr = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const rawSort = getStr("sort");
  const sort: SortValue = (VALID_SORTS as readonly string[]).includes(
    rawSort ?? "",
  )
    ? (rawSort as SortValue)
    : "activity_desc";

  return {
    needsMe: getStr("needsMe") === "1",
    track: parseCsvEnum(getStr("track"), VALID_TRACKS),
    milestone:
      getStr("milestone")
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [],
    priority: parseCsvEnum(getStr("priority"), VALID_PRIORITIES),
    overdue: getStr("overdue") === "1",
    closing: parseDateRange(getStr("closing")),
    funding: parseDateRange(getStr("funding")),
    taskDue: parseDateRange(getStr("taskDue")),
    sort,
  };
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Serialize filters to URLSearchParams, OMITTING defaults so the URL stays tidy.
 * Example: default sort "activity_desc" is never emitted; empty multi-selects
 * drop their keys entirely.
 */
export function serializeFilterParams(
  p: Partial<FilterParams>,
): URLSearchParams {
  const out = new URLSearchParams();
  if (p.needsMe) out.set("needsMe", "1");
  if (p.track && p.track.length) out.set("track", p.track.join(","));
  if (p.milestone && p.milestone.length)
    out.set("milestone", p.milestone.join(","));
  if (p.priority && p.priority.length) out.set("priority", p.priority.join(","));
  if (p.overdue) out.set("overdue", "1");
  if (p.closing) out.set("closing", `${fmtDate(p.closing.from)}..${fmtDate(p.closing.to)}`);
  if (p.funding) out.set("funding", `${fmtDate(p.funding.from)}..${fmtDate(p.funding.to)}`);
  if (p.taskDue) out.set("taskDue", `${fmtDate(p.taskDue.from)}..${fmtDate(p.taskDue.to)}`);
  if (p.sort && p.sort !== "activity_desc") out.set("sort", p.sort);
  return out;
}

/**
 * Convenience: does the FilterParams have ANY non-default filter active?
 * Used by the list page to pick Empty-state A (no filters) vs B (filters empty).
 */
export function hasAnyFilter(p: FilterParams): boolean {
  return (
    p.needsMe ||
    p.overdue ||
    p.track.length > 0 ||
    p.milestone.length > 0 ||
    p.priority.length > 0 ||
    p.closing !== null ||
    p.funding !== null ||
    p.taskDue !== null
  );
}
