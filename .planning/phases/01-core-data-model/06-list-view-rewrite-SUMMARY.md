---
phase: 01-core-data-model
plan: 06
subsystem: ui/server-component/query-layer
tags: [nextjs-16, server-component, drizzle-cte, url-state, shadcn-table, popover, multi-select, sonner-toast]

# Dependency graph
requires:
  - phase: 01-core-data-model
    plan: 01
    provides: deals + tracks + stages + audit_log schemas + @/lib/db canonical client
  - phase: 01-core-data-model
    plan: 04
    provides: TRACK_SEEDS + STAGE_SEEDS (populate filter dropdowns)
  - phase: 01-core-data-model
    plan: 05
    provides: createDeal redirect target (?created={fileNo}) + shared patterns

provides:
  - app/page.tsx (Server Component — real deals list view at route "/")
  - app/deal/[id]/page.tsx (Phase-1 placeholder — @/mock coupling removed)
  - app/_components/deals-table.tsx (sortable 10-column shadcn Table, Client)
  - app/_components/deals-filter-bar.tsx (9 URL-state controls, Client)
  - app/_components/deal-row.tsx (one TR with track/priority/em-dash cells, Client)
  - app/_components/success-toast.tsx (one-shot ?created= toast, Client)
  - lib/deals-query.ts (Drizzle query with CTE for MAX(audit_log.created_at), D-15)
  - lib/filter-params.ts (URL parse/serialize + hasAnyFilter helper, D-07)
  - lib/format.ts (trackBadgeClasses + priorityPillClasses + priorityDotClasses + relativeTime + truncate)
  - components/ui/table.tsx (shadcn Table primitive)
  - tests/unit/filter-params.test.ts (11 behaviors green)

affects: [P2 detail-page (gets a real implementation), P2 task integration (unblocks Task Due By + Progress/Next Task + Overdue filter), P10 calibration (color palette tuning)]

# Tech tracking
tech-stack:
  added: []   # no new npm deps; shadcn `table` primitive installed (not a dep)
  patterns:
    - "Next.js 16 searchParams is a Promise — server component awaits it before parsing filters (verified against node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md)"
    - "Drizzle 0.45.2 CTE pattern: db.$with('alias').as(select + groupBy) + db.with(cte).select().leftJoin(cte, ...) — used for per-deal MAX(audit_log.created_at) without N+1"
    - "URL-state driven filters via parseFilterParams + serializeFilterParams — omits defaults so `?sort=activity_desc` never appears; serializer is the SINGLE source of truth for URL shape"
    - "Multi-select as Popover + Checkbox group (shadcn Select is single-only in base-nova preset; this is the pragmatic shadcn pattern for multi-select)"
    - "Client-component <tr> with role='button' tabIndex={0} onKeyDown → router.push; File # <Link> inside uses e.stopPropagation so cmd-click / middle-click open a new tab"
    - "Success-toast StrictMode guard: useRef tracks the last-fired fileNo so dev-mode double-invoke doesn't double-toast"
    - "base-nova Button uses @base-ui/react/button's `render={<Link />}` prop instead of shadcn's `asChild` — pattern established in Plan 05, propagated throughout this plan"

key-files:
  created:
    - app/_components/deal-row.tsx
    - app/_components/deals-filter-bar.tsx
    - app/_components/deals-table.tsx
    - app/_components/success-toast.tsx
    - lib/deals-query.ts
    - lib/filter-params.ts
    - lib/format.ts
    - tests/unit/filter-params.test.ts
    - components/ui/table.tsx
  modified:
    - app/page.tsx                     # rewritten from mock-renderer to real server component
    - app/deal/[id]/page.tsx           # neutralized to Phase-1 placeholder (Task 3A)
  deleted:
    - mock/deals.ts
    - mock/helpers.ts
    - mock/types.ts
    - mock/                             # directory itself
    - components/deals-view.tsx
    - components/deal-detail.tsx
    - components/notes-popup.tsx
    - components/email-threads.tsx
    - components/change-history.tsx
    - components/editable-currency.tsx
    - components/calendar-popup.tsx
    - components/track-priority-dropdowns.tsx
    - components/stage-dropdown.tsx
    - components/contact-hover-card.tsx
    - components/deal-details-popup.tsx
    - components/draft-email-dialog.tsx
    - components/mini-stage-bar.tsx
    - components/people-picker.tsx
    - components/stage-stepper.tsx
    - components/refresh-button.tsx

key-decisions:
  - "Drizzle CTE chosen over inline correlated subquery for Activity column: `db.$with('deal_activity').as(...)` + `db.with(cte).leftJoin(cte, ...)` — cleaner than an inline sql`(SELECT max(...))` and typechecks end-to-end. Plan's fallback to inline subquery was unnecessary (drizzle 0.45.2 fully supports `$with`)."
  - "Multi-select via Popover + Checkbox (not shadcn Select) — base-nova's Select is single-value. Popover + Checkbox is the shadcn-canonical multi-select pattern; also serves as the reference for P2's stage-advancement dropdowns and P3's contact role-slot multi-assign."
  - "Entire orphaned prototype-component graph (16 files) deleted, not just the 2 the plan listed. Leaving them would have broken `npm run build` immediately: 14 transitive consumers still imported from @/mock. Dead code in source control is a silent hazard; removing it means the repo contents = the repo reality."
  - "`app/deal/[id]/page.tsx` neutralized in a SEPARATE commit (Task 3A) BEFORE the mock/ deletion commit (Task 3). Preserves bisectability — every commit compiles. If Task 3 had fused the neutralize-and-delete into one diff, bisecting between 'after P5' and 'after P6' would be harder."
  - "Success toast strips `?created=` from URL via router.replace immediately after firing. Without this, a refresh or back-nav would re-fire the toast. The firedRef guard covers StrictMode dev-mode double-invoke."
  - "Sort handler cycles desc → asc → default (activity_desc). Third click of any sortable header returns to the global default rather than un-sorting — Carrie always sees data in a defined order."

patterns-established:
  - "Pattern: URL-state in a server-rendered app via a single parse/serialize module (lib/filter-params.ts). Client components call serialize + router.push; server component calls parse + queries. No client-side filter state. Shareable links come free."
  - "Pattern: MAX(child_table.ts) per parent via Drizzle $with CTE + leftJoin + coalesce fallback — will be reused for P2's 'last task activity' or any other aggregate-per-row timestamp column."
  - "Pattern: P2/P3 data placeholders render em-dash in `text-muted-foreground/70` at query-return layer (null) + row layer (em-dash substitution). When the data lands, changing lib/deals-query.ts + deal-row.tsx is a surgical edit, not a cascading rewrite."
  - "Pattern: one-shot URL-param-triggered toast via useEffect + useRef + router.replace. Reusable for any future `?success=`/`?error=` handoff from server actions."

requirements-completed: [VIEW-01, VIEW-02]

# Metrics
duration: ~12m
completed: 2026-04-17
tests_added: 11
tests_total: 82 (was 71)
commits: 5
---

# Phase 1 Plan 06: List View Rewrite Summary

Deals list at route `/` now queries real Postgres data and renders the 10-column VIEW-01 table with VIEW-02's 8 URL-driven filters and 4 sortable columns. Mock data is gone; `?created={fileNo}` handoff from Plan 05 fires the success toast.

## What Shipped

**VIEW-01 — 10 columns in locked order**

| # | Column | Source | P1 treatment |
|---|--------|--------|--------------|
| 1 | Tracking | `tracks.code → label` + color map | badge per UI-SPEC (TE blue, FL green, DP purple, PO pink, EC amber, SL rose, BL teal, GI gray) |
| 2 | Priority | `deals.priority` | dot + pill (HIGH red, MEDIUM amber, LOW hollow gray) |
| 3 | File # | `deals.fileNo` | font-mono Link to `/deal/{id}`; e.stopPropagation preserved |
| 4 | Main Contact | `deals.mainContactName` | truncated; em-dash when null (D-16) |
| 5 | Address | `deals.propertyAddress` | truncated with title tooltip; em-dash when null |
| 6 | Milestone | `stages.label` | neutral badge (25 milestones → one style per UI-SPEC) |
| 7 | Progress / Next Task | P2 data | em-dash (D-16) |
| 8 | Task Due By | P2 data | em-dash (D-16) |
| 9 | Quick Note | `deals.quickNote` | truncated; em-dash when null |
| 10 | Activity | `max(audit_log.created_at)` (D-15) | right-aligned relative time (2m / 3h / yesterday / Apr 14 / Jan 2025) |

**VIEW-02 — 8 filters + sort in URL search params**

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `needsMe` | `"1"` toggle | off | D-14 P1: deals.internalOwner = current user |
| `track` | CSV (TE,FL,...) | `[]` | 8 valid codes; unknowns dropped |
| `milestone` | CSV stage codes | `[]` | 25 stages; validated at query (inArray on stages.code) |
| `priority` | CSV HIGH/MEDIUM/LOW | `[]` | unknowns dropped |
| `overdue` | `"1"` toggle | off | P2 data — UI present, query no-op |
| `closing` | `YYYY-MM-DD..YYYY-MM-DD` | null | gte + lte on deals.closingAt |
| `funding` | `YYYY-MM-DD..YYYY-MM-DD` | null | gte + lte on deals.fundingAt |
| `taskDue` | `YYYY-MM-DD..YYYY-MM-DD` | null | P2 data — UI present, query no-op |
| `sort` | whitelisted enum | `activity_desc` | 8 values; invalid → default |

**Sortable columns:** Activity, Task Due By, Priority, File # (cycle desc → asc → default).

**Empty states:** Empty-state A (FolderOpen icon, "No deals yet", Create Deal CTA) when no deals at all; Empty-state B (Filter icon, "No deals match your filters", Clear all filters CTA) when filters return nothing.

## Route Topology

```
app/
├── page.tsx                          # Server Component — parses searchParams (Promise), queries DB, renders
├── deal/
│   ├── [id]/page.tsx                 # Phase-1 placeholder (Task 3A) — NO @/mock coupling
│   └── new/
│       ├── page.tsx                  # From Plan 05
│       ├── actions.ts                # From Plan 05 (redirects with ?created={fileNo})
│       └── new-deal-form.tsx         # From Plan 05
└── _components/
    ├── deals-table.tsx               # Client — shadcn Table + sortable headers
    ├── deals-filter-bar.tsx          # Client — 9 URL-state controls
    ├── deal-row.tsx                  # Client — one TR (full row click + stopPropagation link)
    └── success-toast.tsx             # Client — reads ?created= and strips it

lib/
├── deals-query.ts                    # Drizzle CTE query
├── filter-params.ts                  # URL parse/serialize
└── format.ts                         # Badge/pill/dot classes + relativeTime
```

## Drizzle Query Shape

```ts
// CTE: per-deal MAX(audit_log.created_at) where table_name='deals'
const activity = db.$with("deal_activity").as(
  db.select({
      dealId: auditLog.recordId,
      lastAt: sql<Date>`max(${auditLog.createdAt})`.as("last_at"),
    })
    .from(auditLog)
    .where(eq(auditLog.tableName, "deals"))
    .groupBy(auditLog.recordId)
);

const activityExpr = sql<Date>`coalesce(${activity.lastAt}, ${deals.updatedAt})`;

// Main query — innerJoin tracks/stages, leftJoin CTE, WHERE + ORDER BY from filters
const rows = await db.with(activity)
  .select({ ... })
  .from(deals)
  .innerJoin(tracks, eq(deals.trackId, tracks.id))
  .innerJoin(stages, eq(deals.stageId, stages.id))
  .leftJoin(activity, eq(deals.id, activity.dealId))
  .where(whereClauses.length ? and(...whereClauses) : undefined)
  .orderBy(orderBy);
```

**D-12 semantics** (AND across groups, OR within): each multi-select becomes `inArray(col, [...])` (= OR), wrapped in `and(...)` across groups.
**D-13:** default `orderBy = desc(activityExpr)` when `sort === "activity_desc"` or no sort.
**D-15:** Activity column uses `coalesce(MAX(audit_log.created_at), deal.updated_at)` — the fallback is defensive since Plan 05 writes an audit row on every create.

## Next.js 16 API Surprises

- **`searchParams` is a Promise.** Verified in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`:
  ```ts
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>
  ```
  Must `await` before reading. No synchronous access path in Server Components.

- **base-nova Button does NOT support `asChild`.** It wraps `@base-ui/react/button` which exposes a `render` prop instead:
  ```tsx
  <Button render={<Link href="/deal/new">New Deal</Link>} />
  ```
  Plan 05 established this pattern; propagated to 4 call-sites in this plan.

- **shadcn `table` in base-nova is `"use client"` by default.** That's fine — the Server Component (`app/page.tsx`) passes server-fetched data as props; the Table itself hydrates as a client boundary.

## The `app/deal/[id]/page.tsx` Placeholder

Rewritten in Task 3A to a minimal server component that renders `Deal detail page for {id} — coming in Phase 2.` Removes the `@/mock/deals` + `@/components/deal-detail` imports. Full Phase-2 rebuild will add real DB query, tabs, tasks panel, audit history, stage advancement — all tracked in the Phase 1 → Phase 2 handoff. Task 3A landed in a separate commit (`e2220ce`) before mock/ deletion (`616378f`) so every commit compiles (bisect-friendly).

## Deviations from Plan

### Rule 3 (Blocking) — Orphaned prototype-component graph deleted beyond plan spec

- **Found during:** Task 3 Step 7
- **Issue:** Plan instructed deletion of `mock/*` + `components/deals-view.tsx` + conditionally `components/deal-detail.tsx`. But 14 other prototype components (notes-popup, email-threads, change-history, editable-currency, calendar-popup, track-priority-dropdowns, stage-dropdown, contact-hover-card, deal-details-popup, draft-email-dialog, mini-stage-bar, people-picker, stage-stepper, refresh-button) all imported from `@/mock/*` too. Deleting mock/ without deleting these files broke `npm run build` immediately.
- **Fix:** Checked each component's consumers (`app/`, `lib/`, `tests/`) via Grep — confirmed none are referenced outside the now-deleted `deals-view.tsx` + `deal-detail.tsx` graph. Deleted all 16 prototype components in a single deletion alongside mock/.
- **Files deleted:** See `key-files.deleted` above.
- **Commit:** `616378f` (same commit as Task 3 per plan)

### Rule 3 (Blocking) — Button `asChild` → `render` prop

- **Found during:** Task 3 Step 6 (first `npm run build` after writing `app/page.tsx`)
- **Issue:** Plan's `app/page.tsx` template used `<Button asChild>` which the base-nova Button (wrapping `@base-ui/react/button`) does not support. TypeScript errored: `Property 'asChild' does not exist`.
- **Fix:** Rewrote 3 call sites in `app/page.tsx` to the `<Button render={<Link ... />}>` pattern that Plan 05 already established in `new-deal-form.tsx`. Matches the base-nova convention.
- **Files modified:** `app/page.tsx` (3 sites)
- **Commit:** `616378f`

## Authentication Gates

None. Cloudflare Access already protects `/` via `proxy.ts`; `getCurrentUser()` in the server component re-verifies the JWT. Every queryDeals call has a real `user.id` to pass to the D-14 "Needs me" filter. No net-new auth surface.

## Handoff to Phase 2

- **Detail page rebuild:** `app/deal/[id]/page.tsx` placeholder → real DB query + tabs + tasks panel + audit history panel + stage advancement (two-click confirm per DEAL-06)
- **Task integration:** Progress / Next Task + Task Due By columns currently render em-dash (D-16). When `tasks` table lands in P2, `queryDeals` extends with a second CTE for the next open task per deal; `deal-row.tsx` switches from em-dash to live data.
- **Overdue filter:** Currently renders in the UI but is a no-op in the query. When tasks table lands, filter becomes `next_task.due_date < CURRENT_DATE`.
- **Status filter:** Plan 05 assumption 5: killed deals render dimmed but remain in default list. P2 adds a status chip to the filter bar.
- **Sortable Main Contact / Milestone:** Plan 05 assumption 7: only Activity/Task Due By/Priority/File # are sortable in P1. P2 can add Milestone sort (requires decision on cross-track ordering semantics).

## Explicit UI-SPEC Waivers (captured in plan `<notes>`)

These are **not** deviations — they were explicitly deferred in the plan to avoid over-engineering v1:
- Terminal-stage milestone icons (✓ / ✕ with · separator)
- Sticky left-edge columns below 1120px
- `app/loading.tsx` with 8 skeleton rows

All three become first-class tickets after Carrie uses the tool. Tracked in the plan's `<notes>` so the execute-phase checker doesn't re-flag them.

## Known Stubs

No stubs that prevent the plan's goal. The P1 em-dash placeholders (Progress/Next Task, Task Due By) are **intentional** per D-16 — those columns show em-dash until the P2 `tasks` table exists. Documented above as explicit Phase-2 handoff, not a stub in the "missing data that should be there" sense.

## Decisions Implemented

- **D-07:** URL-state list view — parseFilterParams + serializeFilterParams are the source of truth
- **D-12:** AND across filter groups + OR within multi-select via `inArray(...)` wrapped in `and(...)`
- **D-13:** Default sort `activity_desc` — `sort=activity_desc` is never emitted in URL (stripped by serializer)
- **D-14:** P1 "Needs me" = `deals.internalOwner = currentUser.id`
- **D-15:** Activity column = `coalesce(MAX(audit_log.created_at where table='deals' and record_id=deal.id), deal.updated_at)` via CTE
- **D-16:** P2/P3 column placeholders render em-dash `—` in `text-muted-foreground/70`

## Commits

| # | Hash | Type | Scope |
|---|------|------|-------|
| 1 | `80fde7c` | test | Add failing tests for filter-params parser/serializer (RED) |
| 2 | `17963cc` | feat | Implement lib/filter-params parse/serialize (GREEN, 11 tests pass) |
| 3 | `0c45810` | feat | Add queryDeals + format helpers for list view |
| 4 | `e2220ce` | refactor | Neutralize app/deal/[id]/page.tsx — remove @/mock coupling (Task 3A) |
| 5 | `616378f` | feat | Rewrite app/page.tsx as real deals list view (VIEW-01+VIEW-02) |

## Verification

- `npm test tests/unit/filter-params.test.ts` — 11/11 pass (pure unit, no DB)
- `npm test` (full suite) — 82/82 pass (71 baseline + 11 new filter-params)
- `npm run build` — exits 0; 4 routes registered (`/`, `/_not-found`, `/deal/[id]`, `/deal/new`)
- `npx tsc --noEmit` — clean
- `git ls-files '*.ts' '*.tsx' | xargs grep -l 'from "@/mock' | wc -l` — 0
- `git ls-files '*.ts' '*.tsx' | xargs grep -l 'from "@/db/client' | wc -l` — 0 (canonical-client convention honored)

## Self-Check: PASSED

**Files created (verified via `ls`):**
- app/_components/deal-row.tsx — FOUND
- app/_components/deals-filter-bar.tsx — FOUND
- app/_components/deals-table.tsx — FOUND
- app/_components/success-toast.tsx — FOUND
- lib/deals-query.ts — FOUND
- lib/filter-params.ts — FOUND
- lib/format.ts — FOUND
- tests/unit/filter-params.test.ts — FOUND
- components/ui/table.tsx — FOUND

**Files deleted (verified via `test ! -f` / `test ! -d`):**
- mock/ directory — GONE
- components/deals-view.tsx — GONE
- components/deal-detail.tsx — GONE
- (and 14 other prototype components — all GONE)

**Commits exist (verified via `git log --oneline`):**
- 80fde7c — FOUND
- 17963cc — FOUND
- 0c45810 — FOUND
- e2220ce — FOUND
- 616378f — FOUND
