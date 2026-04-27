---
phase: 01-core-data-model
plan: 06
type: execute
wave: 3
depends_on: [01-core-data-model/01, 01-core-data-model/02, 01-core-data-model/04, 01-core-data-model/05]
files_modified:
  - app/page.tsx
  - app/deal/[id]/page.tsx
  - app/_components/deals-table.tsx
  - app/_components/deals-filter-bar.tsx
  - app/_components/deal-row.tsx
  - app/_components/success-toast.tsx
  - lib/deals-query.ts
  - lib/filter-params.ts
  - lib/format.ts
  - mock/deals.ts
  - mock/helpers.ts
  - mock/types.ts
  - components/deals-view.tsx
  - components/ui/table.tsx
  - tests/unit/filter-params.test.ts
autonomous: true
requirements: [VIEW-01, VIEW-02]
requirements_addressed: [VIEW-01, VIEW-02]

must_haves:
  truths:
    - "Route `/` queries real deals from Postgres (no mock data)"
    - "Table renders the 10 columns in VIEW-01 order: Tracking, Priority, File #, Main Contact, Address, Milestone, Progress/Next Task, Task Due By, Quick Note, Activity"
    - "Filter bar renders the 8 VIEW-02 filters: Needs me (toggle), Track (multi), Milestone (multi), Priority (multi), Overdue (toggle), Closing date (range), Funding date (range), Task due date (range)"
    - "Filter state is URL-search-param driven; changing a filter `router.push`es an updated URL and the server re-queries"
    - "Default sort is Activity desc (D-13); Activity, Task Due By, Priority, File # column headers are clickable sort triggers"
    - "P2/P3-sourced columns (Progress/Next Task, Task Due By, Main Contact when null) render em-dash placeholder per D-16"
    - "When URL has `?created={fileNo}`, a success toast `Deal {fileNo} created.` fires once"
    - "app/deal/[id]/page.tsx is neutralized to a minimal placeholder (NO `@/mock` imports) — full detail page lands in Phase 2"
    - "Existing mock/deals.ts, mock/helpers.ts, mock/types.ts, components/deals-view.tsx are deleted (and nothing imports from `@/mock` anywhere)"
    - "`npm run build` exits 0 AFTER mock/ deletion (no stale imports)"
    - "`npm test tests/unit/filter-params.test.ts` passes"
  artifacts:
    - path: "app/page.tsx"
      provides: "Server Component — parses URL params, calls lib/deals-query, renders table + filter bar"
    - path: "app/deal/[id]/page.tsx"
      provides: "Placeholder server component (stub) — full page rebuild in Phase 2"
    - path: "app/_components/deals-table.tsx"
      provides: "Server Component — shadcn Table rendering the 10 columns"
    - path: "app/_components/deals-filter-bar.tsx"
      provides: "Client Component — 8 filter controls that router.push on change"
    - path: "app/_components/deal-row.tsx"
      provides: "Server Component — one TR with track badge, priority pill, etc per UI-SPEC"
    - path: "app/_components/success-toast.tsx"
      provides: "Client Component — reads ?created= param on mount and fires sonner toast"
    - path: "lib/deals-query.ts"
      provides: "Drizzle query builder — applies filters + sort + joins tracks/stages/audit_log"
      exports: ["queryDeals", "DealListRow"]
    - path: "lib/filter-params.ts"
      provides: "URL search param parse/serialize (Zod-validated) for the 8 filters + sort"
      exports: ["parseFilterParams", "FilterParams"]
    - path: "lib/format.ts"
      provides: "Helpers: truncate, relativeTime, trackBadgeClasses, priorityDotClasses"
  key_links:
    - from: "app/page.tsx"
      to: "lib/deals-query.ts::queryDeals"
      via: "direct await"
      pattern: "queryDeals\\("
    - from: "app/_components/deals-filter-bar.tsx"
      to: "URL (via next/navigation useRouter + useSearchParams)"
      via: "router.push on change"
      pattern: "router\\.push"
    - from: "app/_components/deals-table.tsx"
      to: "app/_components/deal-row.tsx"
      via: "props map"
    - from: "app/page.tsx + lib/deals-query.ts"
      to: "lib/db.ts (CANONICAL Drizzle client — Plan 01 Task 3)"
      via: "import { db } from \"@/lib/db\" (NOT @/db/client)"
      pattern: "from \"@/lib/db\""
---

<objective>
Rewrite `/` from the mock-data prototype into the real Phase 1 list view per VIEW-01 + VIEW-02 + UI-SPEC Page 1. The page queries real deals from Postgres (joining tracks, stages, and the latest audit_log row for Activity per D-15), renders them in the 10-column shadcn Table with exact widths/styling from UI-SPEC, and provides the 8 filters + default Activity-desc sort with URL-search-param state (per D-07 + D-12 + D-13). P2-sourced columns render em-dash placeholders (D-16). The `?created={fileNo}` URL param triggers a one-shot success toast from the redirected New Deal flow (handoff from Plan 05).

Additionally: BEFORE deleting the `mock/` directory, neutralize `app/deal/[id]/page.tsx` — which currently imports `getDeal` from `@/mock/deals`. Without this step, `npm run build` breaks the moment `mock/` is removed. The detail page is fully rebuilt in Phase 2; in Phase 1 it becomes a minimal placeholder.

Purpose: Implements VIEW-01 and VIEW-02. Completes the Phase 1 success-criteria chain — after this plan, Carrie can create a deal AND see it in the real list view, AND clicking a deal row navigates to a non-broken (if minimal) detail page.
Output: Real list view with filters, sort, URL-driven state, a proper empty-state message, a placeholder deal detail page, and mock data deleted.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-core-data-model/01-CONTEXT.md
@.planning/phases/01-core-data-model/01-UI-SPEC.md
@.planning/phases/01-core-data-model/01-01-SUMMARY.md
@.planning/phases/01-core-data-model/01-04-SUMMARY.md
@.planning/phases/01-core-data-model/01-05-SUMMARY.md
@db/schema/app.ts
@db/seed/tracks.ts
@db/seed/stages.ts
@lib/current-user.ts
@lib/db.ts
@app/deal/[id]/page.tsx
@AGENTS.md

<interfaces>
VIEW-01 columns (REQUIREMENTS.md, verbatim order):
1. Tracking — track badge colored by track's default priority
2. Priority — per-deal override
3. File # — deal.file_no
4. Main Contact — deal.main_contact_name (D-03)
5. Address — deal.property_address
6. Milestone — deal.stage.label
7. Progress / Next Task — next open task (P2 data → em-dash in P1)
8. Task Due By — P2 data → em-dash in P1
9. Quick Note — deal.quick_note
10. Activity — last mutation timestamp (D-15: `max(audit_log.created_at) where record_id = deal.id`)

VIEW-02 filters:
- Track, Milestone, Priority (multi-select)
- "Needs me" toggle → deals where internal_owner = current_user.id (D-14 P1 semantics)
- Overdue toggle
- Closing date range (on closing_at)
- Funding date range (on funding_at)
- Task due date range (next task's due_date — em-dash in P1; filter UI present but no-op since no task data)

D-12: AND across groups, OR within multi-select.
D-13: Default sort `activity_desc`.
D-15: Activity source = MAX(audit_log.created_at) per deal; fallback `deal.updated_at` when no audit row (shouldn't happen in P1 since deal-create always writes one).
D-16: Em-dash placeholder `—` in `text-muted-foreground/70` for absent data.

UI-SPEC Page 1 locked specs (verbatim — do NOT redesign):
- Container: `max-w-[1440px] mx-auto px-6 py-6`
- H1: `Deals` + primary CTA link `New Deal` → `/deal/new`
- Filter bar layout: `bg-muted/40 rounded-md border p-3 flex flex-wrap items-center gap-2`
- Filter order: Needs me, Track, Milestone, Priority, Overdue, Closing, Funding, Task due, Clear all
- URL param format: `?needsMe=1&track=TE,FL&priority=HIGH&overdue=1&closing=2026-04-01..2026-04-30&sort=activity_desc`
- Column min-widths: 120/104/136/180/260/180/220/128/240/112 (px)
- Sortable: Activity, Task Due By, Priority, File # — cycle desc → asc → default
- Row height: 48px
- Row click: navigate to `/deal/{id}` (detail page is a Phase-1 placeholder per this plan's Task 3A; full rebuild in P2)
- Empty state A (no deals): FolderOpen icon, heading "No deals yet", body "Create your first deal to start tracking.", CTA "Create Deal"
- Empty state B (filters match nothing): Filter icon, heading "No deals match your filters", body "Try adjusting or clearing the filters above.", CTA "Clear all filters"
- Footer: `{N} deals` in `text-xs text-muted-foreground`
- Track badge color map: 8 tracks, each with bg-{color}-100 text-{color}-800 per UI-SPEC table (TE: blue-100/blue-800, FL: green-100/green-800, DP: purple, PO: pink, EC: amber, SL: rose, BL: teal, GI: gray-200/gray-700)
- Priority pill: HIGH = red dot + bg-red-50 text-red-700 ring-red-200; MEDIUM = amber; LOW = hollow gray + muted-foreground
- Milestone badge: neutral `bg-secondary text-secondary-foreground ring-1 ring-border rounded-md px-2 py-0.5 text-[11px] font-medium`
- Em-dash: `—` in `text-muted-foreground/70`
- Activity timestamp format: relative (`2m`, `15m`, `3h`, `yesterday`, `Apr 14`, `Jan 2025`)
- File # cell: `<Link>` to `/deal/{id}`, `font-mono text-[13px]`, `e.stopPropagation()` on click

Canonical Drizzle client (per Plan 01 Task 3): `lib/db.ts`. All code in this plan imports as `import { db } from "@/lib/db"`. DO NOT create `db/client.ts`.

Current state of `app/deal/[id]/page.tsx` (captured at plan-time for reference — Task 3A replaces this):
```tsx
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { DealDetail } from "@/components/deal-detail";
import { getDeal } from "@/mock/deals";  // <-- THIS import breaks when mock/ is deleted

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = getDeal(id);
  if (!deal) notFound();
  return (<>...</>);
}
```
The page currently uses the mock data source. Phase 2 will rebuild it from the real DB; in Phase 1 this plan stubs it so `npm run build` stays green after `mock/` is deleted.

Next.js 16 notes (per AGENTS.md):
- Server Components + `searchParams` prop signature — confirm in node_modules/next/dist/docs
- `useSearchParams()` behavior in Client Components
- `router.push()` from `next/navigation`
</interfaces>
</context>

<notes>
<!-- Non-blocking UI-SPEC items explicitly waived in this plan (addressed in later phases per CONTEXT D-08..D-16 user direction "revisit after seeing it working") -->

- **Terminal-stage milestone icon** (file_completed `✓` / killed `✕` with a `·` separator at 12px via lucide icons per UI-SPEC milestone styling): **DEFERRED.** Per CONTEXT.md D-08..D-16 direction — ship the plain milestone badge first and revisit after Carrie sees it in use. The information is still conveyed via the stage label ("File Completed" / "Killed"); the icon is decorative.
- **Sticky left-edge columns below 1120px** (Tracking + File # columns sticky via `sticky left-0 bg-background z-10` classes per UI-SPEC responsive section): **DEFERRED.** Horizontal scroll still works without sticky; the sticky columns are a polish feature for small-viewport use that can be added after first usage session. Per CONTEXT.md D-08..D-16 direction.
- **`app/loading.tsx` with 8 skeleton rows** (per UI-SPEC loading-state spec): **DEFERRED.** Per CONTEXT.md D-08..D-16 — the initial query is fast enough on local data; loading skeletons can land after production data volume exposes whether it matters.

All three items are captured here so the execute-phase checker does NOT re-flag them. They each become first-class tickets after Phase 1 lands and Carrie uses the tool.
</notes>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: URL filter param parser/serializer + unit tests</name>
  <files>lib/filter-params.ts, tests/unit/filter-params.test.ts</files>
  <read_first>
    - .planning/phases/01-core-data-model/01-UI-SPEC.md (URL param format section — exact keys: needsMe, track, milestone, priority, overdue, closing, funding, taskDue, sort)
    - .planning/phases/01-core-data-model/01-CONTEXT.md (D-07, D-12, D-13, D-14 — semantics)
    - db/seed/tracks.ts (valid track codes to validate against)
    - db/seed/stages.ts (valid stage codes)
  </read_first>
  <behavior>
    - Test 1: `parseFilterParams({})` returns defaults: `{ needsMe: false, track: [], milestone: [], priority: [], overdue: false, closing: null, funding: null, taskDue: null, sort: "activity_desc" }`
    - Test 2: `parseFilterParams({ track: "TE,FL" })` yields `track: ["TE","FL"]`
    - Test 3: `parseFilterParams({ track: "TE,INVALID" })` filters out unknown codes → `track: ["TE"]` (does not throw)
    - Test 4: `parseFilterParams({ priority: "HIGH,MEDIUM" })` yields `priority: ["HIGH","MEDIUM"]`; invalid values filtered
    - Test 5: `parseFilterParams({ closing: "2026-04-01..2026-04-30" })` yields `closing: { from: Date, to: Date }` with matching ISO dates
    - Test 6: `parseFilterParams({ closing: "invalid" })` yields `closing: null` (tolerant)
    - Test 7: `parseFilterParams({ needsMe: "1" })` yields `needsMe: true`; `"0"` or absent → false
    - Test 8: `parseFilterParams({ sort: "file_no_asc" })` yields the value only if in the allowed set `["activity_desc", "activity_asc", "task_due_asc", "task_due_desc", "priority_desc", "priority_asc", "file_no_asc", "file_no_desc"]`; invalid → "activity_desc" (default)
    - Test 9: `serializeFilterParams(parsed)` returns a URLSearchParams-compatible object — omits default values (e.g., `sort=activity_desc` not included since it's default) — round-trips cleanly
  </behavior>
  <action>
    Step 1 — Write `lib/filter-params.ts`:

    ```typescript
    import { z } from "zod";

    const VALID_TRACKS = ["TE","FL","DP","PO","EC","SL","BL","GI"] as const;
    const VALID_PRIORITIES = ["HIGH","MEDIUM","LOW"] as const;
    const VALID_SORTS = [
      "activity_desc","activity_asc",
      "task_due_asc","task_due_desc",
      "priority_desc","priority_asc",
      "file_no_asc","file_no_desc",
    ] as const;

    export type FilterParams = {
      needsMe: boolean;
      track: string[];
      milestone: string[];  // stage codes
      priority: ("HIGH"|"MEDIUM"|"LOW")[];
      overdue: boolean;
      closing: { from: Date; to: Date } | null;
      funding: { from: Date; to: Date } | null;
      taskDue: { from: Date; to: Date } | null;
      sort: typeof VALID_SORTS[number];
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

    function parseCsv<T extends readonly string[]>(raw: string | undefined, allowed: T): T[number][] {
      if (!raw) return [];
      return raw.split(",").filter((s): s is T[number] => (allowed as readonly string[]).includes(s));
    }

    export function parseFilterParams(
      sp: Record<string, string | string[] | undefined>
    ): FilterParams {
      const getStr = (k: string): string | undefined => {
        const v = sp[k];
        return Array.isArray(v) ? v[0] : v;
      };
      const sort = getStr("sort");
      return {
        needsMe: getStr("needsMe") === "1",
        track: parseCsv(getStr("track"), VALID_TRACKS),
        milestone: (getStr("milestone")?.split(",").filter(Boolean) ?? []),  // stage codes validated in query
        priority: parseCsv(getStr("priority"), VALID_PRIORITIES),
        overdue: getStr("overdue") === "1",
        closing: parseDateRange(getStr("closing")),
        funding: parseDateRange(getStr("funding")),
        taskDue: parseDateRange(getStr("taskDue")),
        sort: (VALID_SORTS as readonly string[]).includes(sort ?? "")
          ? sort as FilterParams["sort"]
          : "activity_desc",
      };
    }

    export function serializeFilterParams(p: Partial<FilterParams>): URLSearchParams {
      const out = new URLSearchParams();
      if (p.needsMe) out.set("needsMe", "1");
      if (p.track?.length) out.set("track", p.track.join(","));
      if (p.milestone?.length) out.set("milestone", p.milestone.join(","));
      if (p.priority?.length) out.set("priority", p.priority.join(","));
      if (p.overdue) out.set("overdue", "1");
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      if (p.closing) out.set("closing", `${fmt(p.closing.from)}..${fmt(p.closing.to)}`);
      if (p.funding) out.set("funding", `${fmt(p.funding.from)}..${fmt(p.funding.to)}`);
      if (p.taskDue) out.set("taskDue", `${fmt(p.taskDue.from)}..${fmt(p.taskDue.to)}`);
      if (p.sort && p.sort !== "activity_desc") out.set("sort", p.sort);
      return out;
    }
    ```

    Step 2 — Write `tests/unit/filter-params.test.ts` with the 9 behaviors above. Pure vitest, no DB needed.
  </action>
  <verify>
    <automated>npm test tests/unit/filter-params.test.ts</automated>
  </verify>
  <done>
    - lib/filter-params.ts exports `parseFilterParams`, `serializeFilterParams`, `FilterParams`
    - Tests cover valid input, invalid input (tolerant filtering), defaults, round-trip
    - `npm test tests/unit/filter-params.test.ts` exits 0 with 9+ passing
  </done>
  <acceptance_criteria>
    - `ls lib/filter-params.ts tests/unit/filter-params.test.ts` shows both files
    - `grep -E "export.*parseFilterParams|export.*serializeFilterParams|export.*FilterParams" lib/filter-params.ts` returns 3+ matches
    - `grep -E "needsMe|track|milestone|priority|overdue|closing|funding|taskDue|sort" lib/filter-params.ts` returns 9+ matches (all 8 filters + sort)
    - `grep -E "activity_desc|activity_asc|task_due|priority_desc|file_no_asc" lib/filter-params.ts` returns 5+ matches (sort values)
    - `grep -c "^  it\\(\\|^    it\\(" tests/unit/filter-params.test.ts` returns 9+
    - `npm test tests/unit/filter-params.test.ts` exits 0
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Drizzle query builder for the list view (queryDeals) + format helpers</name>
  <files>lib/deals-query.ts, lib/format.ts</files>
  <read_first>
    - db/schema/app.ts (deals, tracks, stages, auditLog shapes)
    - .planning/phases/01-core-data-model/01-CONTEXT.md (D-12, D-13, D-14, D-15 — semantics)
    - .planning/phases/01-core-data-model/01-UI-SPEC.md (track badge color mapping, priority pill styling, timestamp format, truncation rules)
    - lib/filter-params.ts (from Task 1 — FilterParams shape)
    - lib/file-no.ts (pattern for lib file with sql`...` usage)
    - lib/db.ts (CANONICAL Drizzle client — queryDeals MUST `import { db } from "@/lib/db"`; do NOT use @/db/client)
  </read_first>
  <action>
    Step 1 — Write `lib/deals-query.ts`:

    ```typescript
    import { and, desc, asc, eq, inArray, gte, lte, sql, isNotNull, SQL } from "drizzle-orm";
    import { db } from "@/lib/db";  // CANONICAL Drizzle client (Plan 01 Task 3). DO NOT use @/db/client.
    import { deals, tracks, stages, auditLog } from "@/db/schema";
    import type { FilterParams } from "@/lib/filter-params";

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
      activityAt: Date;          // max(audit_log.created_at) per D-15, fallback deal.updatedAt
      closingAt: Date | null;
      fundingAt: Date | null;
    };

    /**
     * Query deals for the list view. Applies:
     *  - Filters per FilterParams (D-12: AND across groups, OR within multi-select)
     *  - Sort per FilterParams.sort (D-13 default activity_desc)
     *  - Joins tracks + stages for label columns
     *  - Left-joins max(audit_log.created_at) for Activity column (D-15)
     *
     * Excludes killed deals? NO — per UI-SPEC Page 1 "Row states", killed rows render
     * dimmed but remain in the default list in Phase 1. Status filter lands in P2.
     */
    export async function queryDeals(
      filters: FilterParams,
      currentUserId: string
    ): Promise<DealListRow[]> {
      const activitySubquery = db.$with("deal_activity").as(
        db.select({
          dealId: auditLog.recordId,
          lastAt: sql<Date>`max(${auditLog.createdAt})`.as("last_at"),
        })
          .from(auditLog)
          .where(eq(auditLog.tableName, "deals"))
          .groupBy(auditLog.recordId)
      );

      const whereClauses: SQL[] = [];
      if (filters.needsMe) whereClauses.push(eq(deals.internalOwner, currentUserId));
      if (filters.track.length) whereClauses.push(inArray(tracks.code, filters.track));
      if (filters.milestone.length) whereClauses.push(inArray(stages.code, filters.milestone));
      if (filters.priority.length) whereClauses.push(inArray(deals.priority, filters.priority));
      if (filters.closing) {
        whereClauses.push(gte(deals.closingAt, filters.closing.from));
        whereClauses.push(lte(deals.closingAt, filters.closing.to));
      }
      if (filters.funding) {
        whereClauses.push(gte(deals.fundingAt, filters.funding.from));
        whereClauses.push(lte(deals.fundingAt, filters.funding.to));
      }
      // overdue / taskDue filters are P2-data dependent; in P1 they're no-ops
      // (could optionally filter deals whose closing_at is past today when overdue=1)

      let orderBy: SQL;
      const activityExpr = sql`coalesce(${activitySubquery.lastAt}, ${deals.updatedAt})`;
      switch (filters.sort) {
        case "activity_asc":  orderBy = asc(activityExpr);  break;
        case "activity_desc": orderBy = desc(activityExpr); break;
        case "file_no_asc":   orderBy = asc(deals.fileNo);  break;
        case "file_no_desc":  orderBy = desc(deals.fileNo); break;
        case "priority_asc":  orderBy = asc(deals.priority); break;
        case "priority_desc": orderBy = desc(deals.priority); break;
        case "task_due_asc":
        case "task_due_desc":
          // P2 data — fall back to activity sort in P1
          orderBy = desc(activityExpr); break;
        default: orderBy = desc(activityExpr);
      }

      const rows = await db.with(activitySubquery)
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
          activityAt: sql<Date>`coalesce(${activitySubquery.lastAt}, ${deals.updatedAt})`,
          closingAt: deals.closingAt,
          fundingAt: deals.fundingAt,
        })
        .from(deals)
        .innerJoin(tracks, eq(deals.trackId, tracks.id))
        .innerJoin(stages, eq(deals.stageId, stages.id))
        .leftJoin(activitySubquery, eq(deals.id, activitySubquery.dealId))
        .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
        .orderBy(orderBy);

      return rows as DealListRow[];
    }
    ```

    Verify the Drizzle 0.45.2 API for CTEs (`$with` / `.with()`), subquery column aliasing (`.as("last_at")`), and `sql<Date>` literal typing against `node_modules/drizzle-orm/`. The API has evolved across minor versions — DO NOT assume. If `$with` is not available in 0.45.2, fall back to a subquery inside a select expression (`sql`(SELECT max(created_at) FROM audit_log WHERE ...) AS activity_at`).

    Step 2 — Write `lib/format.ts` with shared UI helpers:

    ```typescript
    /** Tailwind classes for a track badge background + foreground. Matches UI-SPEC table. */
    export const trackBadgeClasses: Record<string, string> = {
      TE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      FL: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      DP: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      PO: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
      EC: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      SL: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
      BL: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
      GI: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    };

    /** Priority pill classes per UI-SPEC. */
    export const priorityPillClasses: Record<string, string> = {
      HIGH:   "bg-red-50 text-red-700 ring-1 ring-red-200",
      MEDIUM: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
      LOW:    "text-muted-foreground ring-1 ring-border",
    };

    /** Priority dot classes. */
    export const priorityDotClasses: Record<string, string> = {
      HIGH:   "h-2 w-2 rounded-full bg-red-500",
      MEDIUM: "h-2 w-2 rounded-full bg-amber-500",
      LOW:    "h-2 w-2 rounded-full border border-gray-400",
    };

    /** Truncate a string to N chars, adding an ellipsis. */
    export function truncate(s: string | null | undefined, n: number): string {
      if (!s) return "";
      return s.length > n ? s.slice(0, n - 1) + "…" : s;
    }

    /** Format Date as short relative timestamp per UI-SPEC: 2m, 15m, 3h, yesterday, Apr 14, Jan 2025. */
    export function relativeTime(d: Date | null | undefined, now: Date = new Date()): string {
      if (!d) return "";
      const diffMs = now.getTime() - d.getTime();
      const min = Math.round(diffMs / 60_000);
      const hr  = Math.round(diffMs / 3_600_000);
      const day = Math.round(diffMs / 86_400_000);
      if (min < 1) return "just now";
      if (min < 60) return `${min}m`;
      if (hr < 24) return `${hr}h`;
      if (day === 1) return "yesterday";
      if (day < 365) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
    ```
  </action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <done>
    - lib/deals-query.ts exports queryDeals + DealListRow type
    - lib/format.ts exports trackBadgeClasses, priorityPillClasses, priorityDotClasses, truncate, relativeTime
    - `npm run build` exits 0
    - All 8 track codes present in trackBadgeClasses map
    - All 3 priorities present in pill/dot maps
    - lib/deals-query.ts imports from `@/lib/db` (NOT `@/db/client`)
  </done>
  <acceptance_criteria>
    - `grep "export async function queryDeals" lib/deals-query.ts` returns a match
    - `grep "from \"@/lib/db\"" lib/deals-query.ts` returns a match (CANONICAL client path)
    - `grep -c "from \"@/db/client\"" lib/deals-query.ts` returns 0 (no stale path)
    - `grep -E "TE:|FL:|DP:|PO:|EC:|SL:|BL:|GI:" lib/format.ts` returns 8+ matches (all track codes)
    - `grep -E "HIGH:|MEDIUM:|LOW:" lib/format.ts` returns 6+ matches (3 priorities × 2 maps)
    - `grep -E "activity_desc|activity_asc|file_no_asc|priority_desc" lib/deals-query.ts` returns 4+ matches
    - `grep "auditLog.createdAt\\|max(" lib/deals-query.ts` returns at least 1 match (D-15 Activity source)
    - `grep "internalOwner" lib/deals-query.ts` returns a match (D-14 Needs-me filter)
    - `npm run build` exits 0
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3A: Neutralize app/deal/[id]/page.tsx BEFORE mock/ deletion</name>
  <files>app/deal/[id]/page.tsx</files>
  <read_first>
    - app/deal/[id]/page.tsx (current prototype — imports `getDeal` from `@/mock/deals`)
    - mock/deals.ts (about to be deleted — confirms the import target that must go away)
    - components/app-header.tsx (to reuse the header)
  </read_first>
  <action>
    The prototype deal-detail page at `app/deal/[id]/page.tsx` currently does:
    ```tsx
    import { getDeal } from "@/mock/deals";
    ```
    and imports `<DealDetail>` from `@/components/deal-detail`. Both chains reach into `mock/` (directly or transitively). Phase 2 rebuilds this page with a real DB query. Phase 1's job is to (a) remove the `@/mock` coupling so `npm run build` stays green after mock/ deletion, and (b) keep the route functional as a minimal placeholder so row-click navigation from the list view doesn't 404.

    Replace the contents of `app/deal/[id]/page.tsx` with this placeholder server component (it has NO `@/mock/*` imports, depends only on `AppHeader`):

    ```tsx
    import { AppHeader } from "@/components/app-header";

    export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
      const { id } = await params;
      return (
        <>
          <AppHeader />
          <main className="mx-auto w-full max-w-4xl px-6 py-12">
            <div className="text-sm text-muted-foreground">
              Deal detail page for <code className="font-mono">{id}</code> — coming in Phase 2.
            </div>
          </main>
        </>
      );
    }
    ```

    CRITICAL: This task MUST run BEFORE Task 3's `mock/` directory deletion. If `mock/` is deleted first, `npm run build` breaks while this page still imports `@/mock/deals`, and that failure may cascade into the rest of Task 3.

    Also: check whether `components/deal-detail.tsx` is imported elsewhere. If it's ONLY imported by `app/deal/[id]/page.tsx` (which we're just neutralizing), delete `components/deal-detail.tsx` as well in Task 3 Step 7 — it becomes dead code. Grep `grep -rn "from \"@/components/deal-detail\"" app/ lib/ components/ 2>/dev/null` to verify.
  </action>
  <verify>
    <automated>bash -c "grep -c 'from \"@/mock' app/deal/\\[id\\]/page.tsx"</automated>
  </verify>
  <done>
    - app/deal/[id]/page.tsx no longer imports anything from `@/mock/*`
    - Page still exports a default React component (route still resolves)
    - Page renders a minimal placeholder acknowledging the Phase-2 rebuild
  </done>
  <acceptance_criteria>
    - `grep -c "from \"@/mock" app/deal/\\[id\\]/page.tsx` returns 0
    - `grep "export default" app/deal/\\[id\\]/page.tsx` returns a match
    - `grep "coming in Phase 2" app/deal/\\[id\\]/page.tsx` returns a match (or equivalent placeholder copy)
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Rewrite app/page.tsx + build filter bar + table components; delete mock data</name>
  <files>app/page.tsx, app/_components/deals-table.tsx, app/_components/deals-filter-bar.tsx, app/_components/deal-row.tsx, app/_components/success-toast.tsx, components/ui/table.tsx, mock/deals.ts, mock/helpers.ts, mock/types.ts, components/deals-view.tsx</files>
  <read_first>
    - .planning/phases/01-core-data-model/01-UI-SPEC.md (Page 1 — entire section: copy, widths, rows, states, filter bar, sort indicators, empty states, footer)
    - .planning/phases/01-core-data-model/01-CONTEXT.md (D-07, D-12, D-13, D-14, D-15, D-16)
    - lib/deals-query.ts, lib/filter-params.ts, lib/format.ts (from Tasks 1-2)
    - db/seed/tracks.ts, db/seed/stages.ts (for filter dropdown options)
    - app/page.tsx (current state — imports from mock/deals.ts — replace entirely)
    - app/deal/\[id\]/page.tsx (now neutralized per Task 3A — confirm no @/mock imports remain)
    - components/deals-view.tsx (current mock renderer — delete)
    - mock/ directory (delete entire directory)
    - components/app-header.tsx (page chrome pattern)
    - lib/db.ts (CANONICAL Drizzle client — page.tsx uses `import { db } from "@/lib/db"`)
    - AGENTS.md (Next.js 16 — searchParams signature + client hooks)
  </read_first>
  <action>
    PRECONDITION — confirm Task 3A has already run. `grep -c "from \"@/mock" app/deal/\\[id\\]/page.tsx` MUST return 0 before proceeding. If it's still 1, go back and run Task 3A.

    Step 1 — Install shadcn Table primitive:
    ```bash
    npx shadcn@latest add table
    ```
    Confirm `components/ui/table.tsx` exists with exports `Table, TableHeader, TableBody, TableRow, TableHead, TableCell`.

    Step 2 — Create `app/_components/deal-row.tsx` (Server Component):
    ```tsx
    import Link from "next/link";
    import { TableCell, TableRow } from "@/components/ui/table";
    import { trackBadgeClasses, priorityPillClasses, priorityDotClasses, relativeTime, truncate } from "@/lib/format";
    import type { DealListRow } from "@/lib/deals-query";

    const EM_DASH = "—";

    export function DealRow({ deal }: { deal: DealListRow }) {
      const killed = deal.status === "killed";
      return (
        <TableRow
          className={`h-12 cursor-pointer hover:bg-muted/40 ${killed ? "text-muted-foreground" : ""}`}
          role="button"
          tabIndex={0}
          onClick={undefined /* handled in client wrapper — see note below */}
        >
          {/* 1. Tracking */}
          <TableCell className="min-w-[120px] py-3 px-3">
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${trackBadgeClasses[deal.trackCode] ?? ""}`}>
              {deal.trackLabel}
            </span>
          </TableCell>
          {/* 2. Priority */}
          <TableCell className="min-w-[104px] py-3 px-3">
            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${priorityPillClasses[deal.priority]}`}>
              <span className={priorityDotClasses[deal.priority]} />
              {deal.priority}
            </span>
          </TableCell>
          {/* 3. File # */}
          <TableCell className="min-w-[136px] py-3 px-3 font-mono text-[13px]">
            <Link
              href={`/deal/${deal.id}`}
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {deal.fileNo}
            </Link>
          </TableCell>
          {/* 4. Main Contact */}
          <TableCell className="min-w-[180px] py-3 px-3 truncate max-w-[180px]" title={deal.mainContactName ?? undefined}>
            {deal.mainContactName ?? <span className="text-muted-foreground/70">{EM_DASH}</span>}
          </TableCell>
          {/* 5. Address */}
          <TableCell className="min-w-[260px] py-3 px-3 truncate max-w-[260px]" title={deal.propertyAddress ?? undefined}>
            {deal.propertyAddress ?? <span className="text-muted-foreground/70">{EM_DASH}</span>}
          </TableCell>
          {/* 6. Milestone */}
          <TableCell className="min-w-[180px] py-3 px-3">
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-secondary text-secondary-foreground ring-1 ring-border">
              {deal.stageLabel}
            </span>
          </TableCell>
          {/* 7. Progress / Next Task — em-dash in P1 (D-16) */}
          <TableCell className="min-w-[220px] py-3 px-3">
            <span className="text-muted-foreground/70">{EM_DASH}</span>
          </TableCell>
          {/* 8. Task Due By — em-dash in P1 */}
          <TableCell className="min-w-[128px] py-3 px-3">
            <span className="text-muted-foreground/70">{EM_DASH}</span>
          </TableCell>
          {/* 9. Quick Note */}
          <TableCell className="min-w-[240px] py-3 px-3 truncate max-w-[240px]" title={deal.quickNote ?? undefined}>
            {deal.quickNote ?? <span className="text-muted-foreground/70">{EM_DASH}</span>}
          </TableCell>
          {/* 10. Activity */}
          <TableCell className="min-w-[112px] py-3 px-3 text-right text-muted-foreground text-xs font-mono">
            {relativeTime(deal.activityAt)}
          </TableCell>
        </TableRow>
      );
    }
    ```

    NOTE: The row-click navigation behavior requires a Client Component wrapper (onClick). Two options: (a) make DealRow a client component and add `'use client'`; (b) wrap the `<tr>` content in a client-only navigation component. Pick (a) — single file is simpler. Just add `'use client'` and `import { useRouter } from "next/navigation"` + `router.push(\`/deal/${deal.id}\`)` in `onClick`.

    Step 3 — Create `app/_components/deals-table.tsx` (Server or Client, whichever matches DealRow choice):
    - Renders shadcn `Table` with a `TableHeader` row and sortable column triggers
    - Maps `deals` prop to `DealRow` children
    - Header cells for sortable columns (Activity, Task Due By, Priority, File #) wrap their label in a `<SortHeader>` client subcomponent that reads/updates `sort` URL param via `useSearchParams` + `router.push`
    - Non-sortable header cells are plain labels
    - Column header styling: `text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground`; active sort gets `text-foreground` and an `ArrowDown`/`ArrowUp` icon

    Step 4 — Create `app/_components/deals-filter-bar.tsx` (`'use client'`):
    - Reads current filters via `useSearchParams()` parsed through `parseFilterParams`
    - Renders the 9 controls in order per UI-SPEC: Needs me toggle, Track multi-select, Milestone multi-select, Priority multi-select, Overdue toggle, Closing date range, Funding date range, Task due date range, Clear all
    - On any change, builds a new URLSearchParams via `serializeFilterParams` and calls `router.push(\`/?${params.toString()}\`)`
    - Clear-all is visible only if at least one filter is active
    - Match the UI-SPEC styling: `bg-muted/40 rounded-md border p-3 flex flex-wrap items-center gap-2`
    - Toggle buttons: shadcn `Button variant="outline"` when inactive, `variant="default"` when active; icons `UserCheck` and `AlertCircle` at 16px
    - Multi-selects: shadcn `Select` with custom trigger label `Track: All` / `Track: TE, FL` / `Track: 3 selected`. If true multi-select isn't straightforward with shadcn `Select` (it's single by default), use a `Popover` + `Checkbox` group inside — this is the pragmatic shadcn pattern
    - Date ranges: shadcn `Popover` + `Calendar` (mode="range")
    - Track options from TRACK_SEEDS; milestone options from STAGE_SEEDS; priority options from the 3-value enum

    Step 5 — Create `app/_components/success-toast.tsx` (`'use client'`):
    ```tsx
    'use client';
    import { useEffect } from "react";
    import { useSearchParams, useRouter } from "next/navigation";
    import { toast } from "sonner";

    export function SuccessToast() {
      const sp = useSearchParams();
      const router = useRouter();
      useEffect(() => {
        const created = sp.get("created");
        if (created) {
          toast.success(`Deal ${created} created.`);
          // strip the param so a refresh doesn't re-fire
          const next = new URLSearchParams(sp.toString());
          next.delete("created");
          router.replace(`/${next.toString() ? "?" + next.toString() : ""}`);
        }
      }, [sp, router]);
      return null;
    }
    ```

    Step 6 — Rewrite `app/page.tsx`:
    ```tsx
    import { AppHeader } from "@/components/app-header";
    import Link from "next/link";
    import { FolderOpen, Filter } from "lucide-react";
    import { Button } from "@/components/ui/button";
    import { Table, TableHeader, TableRow, TableHead, TableBody } from "@/components/ui/table";
    import { DealsFilterBar } from "./_components/deals-filter-bar";
    import { DealsTable } from "./_components/deals-table";
    import { SuccessToast } from "./_components/success-toast";
    import { queryDeals } from "@/lib/deals-query";
    import { parseFilterParams } from "@/lib/filter-params";
    import { getCurrentUser } from "@/lib/current-user";
    import { TRACK_SEEDS } from "@/db/seed/tracks";
    import { STAGE_SEEDS } from "@/db/seed/stages";

    // Next.js 16 searchParams type — verify in node_modules/next/dist/docs before finalizing
    export default async function DealsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
      const sp = await searchParams;  // Next.js 16 async searchParams — VERIFY signature
      const filters = parseFilterParams(sp);
      const user = await getCurrentUser();
      const deals = await queryDeals(filters, user.id);

      const hasAnyFilter = filters.needsMe || filters.overdue ||
        filters.track.length > 0 || filters.milestone.length > 0 ||
        filters.priority.length > 0 || !!filters.closing ||
        !!filters.funding || !!filters.taskDue;

      return (
        <>
          <AppHeader />
          <SuccessToast />
          <main className="mx-auto max-w-[1440px] px-6 py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">Deals</h1>
              <Button asChild><Link href="/deal/new">New Deal</Link></Button>
            </div>

            <div className="mt-4">
              <DealsFilterBar tracks={TRACK_SEEDS} stages={STAGE_SEEDS} />
            </div>

            <div className="mt-4">
              {deals.length === 0 ? (
                hasAnyFilter ? (
                  <div className="flex flex-col items-center py-24 text-center">
                    <Filter className="h-12 w-12 text-muted-foreground" />
                    <h2 className="mt-6 text-[28px] font-semibold leading-[1.2]">No deals match your filters</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Try adjusting or clearing the filters above.</p>
                    <Button asChild variant="outline" className="mt-6"><Link href="/">Clear all filters</Link></Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-24 text-center">
                    <FolderOpen className="h-12 w-12 text-muted-foreground" />
                    <h2 className="mt-6 text-[28px] font-semibold leading-[1.2]">No deals yet</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Create your first deal to start tracking.</p>
                    <Button asChild className="mt-6"><Link href="/deal/new">Create Deal</Link></Button>
                  </div>
                )
              ) : (
                <DealsTable deals={deals} />
              )}
            </div>

            <div className="mt-8 text-xs text-muted-foreground">
              {deals.length} deal{deals.length === 1 ? "" : "s"}
            </div>
          </main>
        </>
      );
    }
    ```

    CRITICAL: Next.js 16's `searchParams` prop became a Promise (or maintains previous sync shape — verify in `node_modules/next/dist/docs/` before writing). If sync, drop the `await`. Do NOT guess.

    **DB-client path**: All Drizzle-consuming files in this plan (`lib/deals-query.ts`, and any `app/page.tsx` inline DB calls) MUST use `import { db } from "@/lib/db"`. The string `@/db/client` MUST NOT appear anywhere in this plan's output files.

    Step 7 — DELETE the mock data AND the now-dead detail component. Verify Task 3A already landed:
    ```bash
    grep -c "from \"@/mock" app/deal/\[id\]/page.tsx   # MUST be 0 — otherwise go back to Task 3A
    ```
    Then delete:
    ```bash
    rm mock/deals.ts mock/helpers.ts mock/types.ts components/deals-view.tsx
    rmdir mock
    # If components/deal-detail.tsx is only imported by the (now-neutralized) app/deal/[id]/page.tsx, delete it too:
    if [ -z "$(grep -rn 'from \"@/components/deal-detail\"' app/ lib/ components/ 2>/dev/null)" ]; then
      rm -f components/deal-detail.tsx
    fi
    ```
    Verify nothing else imports from `@/mock` via `grep -rn "from \"@/mock\"" app/ lib/ components/ tests/ 2>/dev/null` — must return empty. If ANY file still imports it, neutralize or delete that file first.

    Step 8 — `npm run build` MUST exit 0 at this point. If it fails with "Module not found: @/mock/..." on any file other than the ones just deleted, Task 3A did not run or an orphan consumer was missed — go back and fix before proceeding.
  </action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <done>
    - app/page.tsx rewritten to query real deals and render real filter bar + table
    - app/_components/ contains deals-table, deals-filter-bar, deal-row, success-toast
    - components/ui/table.tsx installed
    - app/deal/[id]/page.tsx still exists and has NO `@/mock/*` imports (neutralized per Task 3A)
    - mock/deals.ts, mock/helpers.ts, mock/types.ts DELETED; mock/ directory removed
    - components/deals-view.tsx DELETED
    - components/deal-detail.tsx DELETED (if no other consumer)
    - No imports from `@/mock` remain anywhere in the repo
    - All Drizzle-consuming code imports from `@/lib/db` (never `@/db/client`)
    - `npm run build` exits 0
    - `/` renders the filter bar + 10-column table with real data (smoke-test via `npm run dev`)
    - Filter changes update the URL and re-query
    - Default sort is Activity desc
    - Empty state A renders when the deals table is empty; Empty state B renders when filters match nothing
    - `?created=TX-2026-0001` param fires the success toast once then strips itself
  </done>
  <acceptance_criteria>
    - `test ! -d mock` succeeds (mock directory gone)
    - `test ! -f components/deals-view.tsx` succeeds (old renderer gone)
    - `ls components/ui/table.tsx` shows the file (shadcn table installed)
    - `ls app/_components/deals-table.tsx app/_components/deals-filter-bar.tsx app/_components/deal-row.tsx app/_components/success-toast.tsx` shows all 4 files
    - `ls app/deal/\[id\]/page.tsx` shows the file (route still resolves)
    - `grep -c "from \"@/mock" app/deal/\\[id\\]/page.tsx` returns 0 (Task 3A landed)
    - `bash -c "git ls-files '*.ts' '*.tsx' | xargs grep -l 'from \"@/mock' 2>/dev/null | wc -l"` returns 0 (NO file imports from @/mock)
    - `grep "queryDeals" app/page.tsx` returns a match
    - `grep "parseFilterParams" app/page.tsx` returns a match
    - `grep -c "from \"@/db/client\"" app/page.tsx lib/deals-query.ts` returns 0 (no stale client path in this plan's new files)
    - `grep -E "Deals</h1>|Tracking|Priority|File #|Main Contact|Address|Milestone|Progress.*Next Task|Task Due By|Quick Note|Activity" app/_components/deals-table.tsx` returns 10+ matches (all 10 column headers present)
    - `grep -E "Needs me|Overdue|Clear all" app/_components/deals-filter-bar.tsx` returns 3+ matches
    - `grep -E "Track|Milestone|Priority|Closing|Funding|Task due" app/_components/deals-filter-bar.tsx` returns 6+ matches (6 non-toggle filters)
    - `grep "router.push" app/_components/deals-filter-bar.tsx` returns at least 1 match (URL state)
    - `grep "No deals yet\\|No deals match" app/page.tsx` returns 2 matches (both empty states)
    - `grep "Create your first deal" app/page.tsx` returns a match (empty-state A body)
    - `grep "Try adjusting or clearing" app/page.tsx` returns a match (empty-state B body)
    - `grep "— " app/_components/deal-row.tsx` or `grep "EM_DASH\\|text-muted-foreground/70" app/_components/deal-row.tsx` returns at least 3 matches (placeholder treatment for 3 em-dash columns — Main Contact nullable, Progress/Next Task, Task Due By)
    - `grep "onClick={(e) => e.stopPropagation()}" app/_components/deal-row.tsx` returns a match (File # link exception)
    - `grep "\\?created=" app/_components/success-toast.tsx` returns a match OR `grep "sp.get(\"created\")" app/_components/success-toast.tsx` returns a match
    - `grep "Deal.*created" app/_components/success-toast.tsx` returns a match (toast copy)
    - `npm run build` exits 0
  </acceptance_criteria>
</task>

</tasks>

<verification>
1. `npm test tests/unit/filter-params.test.ts` exits 0
2. `npm run build` exits 0 (the FULL Next.js build passes AFTER mock/ deletion — confirms Task 3A landed first)
3. All prior tests (schema-shape, env, file-no, seed-shape, create-deal-action, parse-money, crypto, access) still pass: run `npm test` and expect 0-failure tally
4. `bash -c "git ls-files '*.ts' '*.tsx' | xargs grep -l 'from \"@/mock' 2>/dev/null | wc -l"` returns 0
5. `bash -c "git ls-files '*.ts' '*.tsx' | xargs grep -l 'from \"@/db/client' 2>/dev/null | wc -l"` returns 0
6. Manual smoke-test (strongly recommended before commit): `npm run db:seed && npm run dev` → visit `/` → verify empty state A → visit `/deal/new`, submit a valid form → redirected to `/` with toast + 1 deal in table → click a row → land on `/deal/{id}` Phase-2-placeholder page (no crash) → click back → click a track filter → URL updates + re-query → clear filters → all deals back
</verification>

<success_criteria>
- VIEW-01 shipped: 10 columns in the locked order, row click navigates to detail (placeholder page — full rebuild P2)
- VIEW-02 shipped: all 8 filters + Clear all; URL-state driven (D-07)
- D-12 semantics implemented: AND across groups, OR within multi-select (ORing via `inArray`)
- D-13: default `activity_desc` sort
- D-14 P1 semantics: Needs me = internal_owner = current user
- D-15: Activity column sourced from MAX(audit_log.created_at) with updated_at fallback
- D-16: em-dash placeholders for P2/P3 data columns
- Mock data and old prototype renderer deleted — there's no dead code path
- app/deal/[id]/page.tsx neutralized to placeholder (B2 addressed — build stays green after mock/ deletion)
- Success toast on post-create redirect via `?created={fileNo}` handoff from Plan 05
- DB-client convention honored: all imports use `@/lib/db`; `@/db/client` absent (B1 addressed)
</success_criteria>

<output>
After completion, create `.planning/phases/01-core-data-model/01-06-SUMMARY.md` documenting:
- Final route topology (page.tsx server + 4 _components + 3 lib helpers + deal/[id] placeholder)
- The URL param format table (key → type → default)
- The Drizzle query shape (CTE vs inline subquery decision, joins, ordering)
- Any Next.js 16 API surprises (searchParams Promise, etc.)
- The `app/deal/[id]/page.tsx` Phase-1 placeholder — full rebuild scheduled for Phase 2
- Handoff to P2: status filter UI, killed-row default visibility, sortable Main Contact / Milestone columns (all deferred per UI-SPEC assumptions 3, 5, 7), plus the three explicit UI-SPEC waivers captured in this plan's `<notes>` (terminal-stage icon, sticky left columns, loading.tsx skeletons)
- Decisions implemented (D-07, D-12, D-13, D-14, D-15, D-16)
</output>
