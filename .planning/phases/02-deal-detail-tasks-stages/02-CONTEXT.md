# Phase 2: Deal Detail, Tasks, Stages - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss=true per user choice in /gsd:autonomous run)

<domain>
## Phase Boundary

Full deal detail page with tabs, task management with `is_next`, stage advancement with audit log.

**In scope:**
- `/deal/[id]` route with tabs: Overview (editable), Tasks, Notes, Audit
- Task management: add/complete/reassign with `is_next` invariant (exactly one active next-task per deal)
- Stage advancement: two-click confirm, writes to audit_log, reflected in list view
- Killing a deal: requires reason note, writes audit_log
- Audit tab: every mutation appears with before/after diff

**Requirements delivered (11):**
DEAL-04, DEAL-05, DEAL-06, STAGE-02, STAGE-03, TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, VIEW-05

**Note from Phase 1 transition (D-05):** OPS-01 (audit_log table + writes on deal.create) shipped in P1. P2 extends audit writes to *updates*, *stage advancement*, and *task mutations* — the infrastructure exists, we're widening the surface.

**Out of scope (deferred):**
- Two-way sync to ClickUp/GHL (never in v1)
- Automated stage transitions (human-initiated only per Carrie's workflow)
- Real-time collab / multi-user editing (single-operator product)
- Kanban/Calendar views (Phase 9)

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, UI-SPEC.md (to be generated), codebase conventions from Phase 1 (see SUMMARYs), and project decisions D-01..D-19 from `01-CONTEXT.md` to guide decisions.

### Locked from Phase 1 (do not revisit)
- Canonical DB client path: `@/lib/db` (NOT `@/db/client`)
- Schema imports: `@/db/schema/app` and `@/db/schema/auth` (or `@/db/schema` re-export)
- Transactional pattern for audit writes: `db.transaction(async tx => { ... writeAuditLog(tx, ...) })` — reuse `lib/audit.ts::writeAuditLog`
- Shared Zod schemas live in `lib/*-schema.ts` (see `lib/deal-schema.ts` for the pattern)
- Money parsing helper: `lib/parse-money.ts`; formatting helpers: `lib/format.ts`
- Server Component (default) + Client Component (leaf, URL-state via `useRouter`/`useSearchParams`) pattern from `app/page.tsx` + `app/_components/deals-filter-bar.tsx`
- shadcn base-nova primitives: `<Button render={<Link/>}>` (NOT `asChild`)
- CF Access handles auth at the edge — no client-side login logic; server code reads user via existing Phase 0.5 helper

### Locked from Phase 0.5
- NPI columns must pass through `lib/crypto.ts` encrypt/decrypt — never store plaintext
- `decrypt()` writes to `npi_access_log` on every call (non-skippable)
- Audit log writes are NEVER conditional — the `writeAuditLog` call is a peer to the mutation, inside the same tx

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. Key pre-existing assets relevant to Phase 2:

### Reusable assets
- `lib/db.ts` — Drizzle client
- `lib/audit.ts::writeAuditLog` — transaction-scoped audit writer (D-05). Extend (don't rewrite) for P2 mutation surface
- `lib/file-no.ts::generateFileNo` + `AppTx` type — use if tasks/stages need monotonic IDs
- `lib/deal-schema.ts` — shared Zod. Extend for DEAL-05 (update) and DEAL-06 (kill) input schemas
- `lib/deals-query.ts::queryDeals` — list view query. May need a peer `queryDealById` or expand with relation loaders
- `lib/format.ts` — trackBadge, priorityPill, relativeTime (reuse in deal detail header)
- `components/ui/{accordion,form,label,calendar,button,input,select,badge}.tsx` — shadcn primitives shipped in P1
- `app/_components/deals-table.tsx`, `deal-row.tsx` — column order + styling (keep consistent on detail page)

### Established patterns
- Server Component pages (`app/page.tsx`) → await queries directly → pass to client components as props
- Server actions in `actions.ts` next to the route (`app/deal/new/actions.ts` is the canonical example) — wrap mutation + audit in ONE `db.transaction`
- TDD for business logic (`tests/unit/create-deal-action.test.ts` shows the form)
- URL-state for filters (`app/_components/deals-filter-bar.tsx` + `lib/filter-params.ts`)

### Integration points
- New route: `app/deal/[id]/page.tsx` (placeholder exists at `app/deal/[id]/page.tsx` from P1 01-06; currently returns a minimal stub)
- Existing list view at `/` must link to `/deal/[id]` (already does)
- audit_log table schema lives in `db/schema/app.ts` — may need extended `kind` values for P2 (stage.advance, task.create, task.complete, deal.kill, deal.update)
- Row-level task uniqueness: exactly one `is_next = true` per deal — enforce at DB level (partial unique index) AND app level

</code_context>

<specifics>
## Specific Ideas

No specific requirements captured — discuss phase skipped. Refer to:
- ROADMAP.md Phase 2 success criteria (5 items)
- REQUIREMENTS.md for DEAL-04, DEAL-05, DEAL-06, STAGE-02, STAGE-03, TASK-01..05, VIEW-05 specifics
- UI-SPEC.md (to be generated next via `/gsd:ui-phase 2`) for visual contract

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped. Any ideas raised during planning that exceed Phase 2 scope should be routed to `/gsd:add-backlog` or the appropriate later phase.

</deferred>
