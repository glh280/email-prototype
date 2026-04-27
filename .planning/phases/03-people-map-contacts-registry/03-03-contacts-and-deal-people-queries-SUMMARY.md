---
phase: 03-people-map-contacts-registry
plan: 03
subsystem: database
tags: [postgres, drizzle, query, contacts, deal-people, autosuggest, view-06, people-03, people-04, ilike, cte]

# Dependency graph
requires:
  - phase: 03-people-map-contacts-registry/01
    provides: "contacts + deal_people Drizzle tables with FK semantics (CASCADE deal_id, SET NULL contact_id); activeDealsCount CTE target"
  - phase: 01-core-data-model/06
    provides: "lib/deals-query.ts CTE pattern (db.$with / leftJoin / sql`coalesce(...)::int` for derived integer counts)"
  - phase: 02-deal-detail-tasks-stages/06
    provides: "lib/notes-query.ts single-table leftJoin pattern with nullable joined fields"
provides:
  - "queryContactsForList(q?) — VIEW-06 /contacts list with ILIKE search on full_name OR email OR org and CTE-joined activeDealsCount (excludes closed + killed deals)"
  - "queryContactsAutosuggest(q, limit) — PEOPLE-03 role-slot autosuggest primitive, empty-input guard, limit clamped to [1, 20], ranks exact > prefix > substring"
  - "queryContactById(id) — PEOPLE-04 PK read, null on not-found"
  - "queryDealPeopleForDeal(dealId) — per-deal File Contacts tab read, left-joined to contacts, ORDER BY role ASC"
  - "ContactListRow, ContactAutosuggestRow, DealPersonRow type exports"
affects:
  - "03-04 server actions (createContact / upsertDealPerson / removeDealPerson — revalidate the /contacts page which reads from queryContactsForList; refresh deal-detail which reads from queryDealPeopleForDeal)"
  - "03-05 /contacts page UI (imports queryContactsForList + ContactListRow; renders the table)"
  - "03-06 deal-detail File Contacts tab (imports queryDealPeopleForDeal + DealPersonRow; imports queryContactsAutosuggest for combobox)"
  - "Future email-template plans that resolve deal roles via queryDealPeopleForDeal (resolvedLabel = contactFullName || role for free_text slots)"

# Tech tracking
tech-stack:
  added: []  # Pure read-layer plan; zero new deps
  patterns:
    - "Derived-count CTE pattern: db.$with('alias').as(db.select(...).groupBy(...)) then .with(alias).leftJoin(alias, ...) + sql`coalesce(alias.cnt, 0)::int` — mirrors lib/deals-query.ts::queryDeals deal_activity CTE for the audit-log max-timestamp. Reused here for activeDealsCount."
    - "ILIKE OR-chain on full_name / email / org for case-insensitive substring search — runs against Postgres text comparison, no index yet (acceptable for P3 contact volume; P10 may add pg_trgm if needed)"
    - "Autosuggest ranking via CASE WHEN expression in ORDER BY (not UNION ALL) — single query plan, deterministic tie-break by lower(full_name)"
    - "Server-side limit clamp: Math.min(Math.max(limit, 1), 20) prevents accidental full-table dumps from the autosuggest endpoint regardless of client input"

key-files:
  created:
    - "lib/contacts-query.ts — 161 lines; 3 exported functions + 2 exported types; CTE-backed activeDealsCount"
    - "lib/deal-people-query.ts — 53 lines; 1 exported function + 1 exported type; leftJoin(contacts) for nullable FK"
    - "tests/unit/contacts-query.test.ts — 329 lines; 12 real-Postgres assertions"
    - "tests/unit/deal-people-query.test.ts — 266 lines; 4 real-Postgres assertions including SET NULL cascade"
  modified: []

key-decisions:
  - "Tests placed at tests/unit/ (not tests/integration/ as the plan text said) because vitest.config.ts include glob is 'tests/unit/**/*.test.ts' — putting them at tests/integration/ would orphan them. This matches the P2 pattern where DB-touching action tests (deal-actions, task-actions, note-actions) all live under tests/unit/. The test file docstrings call this out."
  - "activeDealsCount CTE filters by deals.status='active' literal string — excludes both 'closed' and 'killed' in one predicate, matching PEOPLE-04 semantics ('deals they're currently on'). Alternative (inArray(deals.status, ['active'])) would generate identical SQL but eq() is cleaner for a single-value check."
  - "Autosuggest empty-input guard returns [] before touching the DB — avoids a round-trip just to return an empty list and hardens against a client that accidentally sends '' (would otherwise return every contact that matches %% which is every contact with a non-null field)."
  - "Autosuggest limit clamped server-side (not via zod schema) because this module has no DB import and stays a pure pass-through from whatever the Plan 06 UI asks for. Enforcing at the DB-query boundary gives one place to audit instead of depending on every caller to sanitize."
  - "DealPersonRow left-joins contacts (not inner join) because deal_people.contact_id is nullable after the P3 Plan 01 schema set SET NULL cascade. The type expresses this: contactFullName / contactEmail / contactOrg are all `| null`. UI (Plan 06) falls back to role label display when the contact row is gone."
  - "ORDER BY role ASC at DB level, not alphabetical by contactFullName — roles are the stable identity ('main_contact' slot rendered in the same position every query). UI can re-sort visually by ROLE_SLOTS registry order (Plan 06 concern)."

patterns-established:
  - "lib/*-query.ts convention now spans 4 files (deals-query, tasks-query is pending in P1, notes-query, contacts-query, deal-people-query) — the read/write split (queries here, server actions in app/*/actions/) is canonical across P1/P2/P3. Future phases inherit this."
  - "Test-file naming mirrors the module name without the /integration/ subdir: lib/contacts-query.ts -> tests/unit/contacts-query.test.ts. Matches the deals/tasks/notes/audit pattern from P1/P2."

requirements-completed: [PEOPLE-03, PEOPLE-04, VIEW-06]

# Metrics
duration: 5m 44s
completed: 2026-04-19
---

# Phase 3 Plan 03: Contacts + Deal-People Queries Summary

**Two pure read modules shipping VIEW-06 (/contacts list with activeDealsCount CTE), PEOPLE-03 autosuggest primitive (empty-input guard + clamped limit + exact>prefix>substring ranking), and the per-deal File Contacts tab read (left-joined for SET NULL audit-trail semantics) — 16 real-Postgres assertions green (244/244 full suite), canonical @/lib/db client, zero new deps.**

## Performance

- **Duration:** 5m 44s
- **Started:** 2026-04-19T01:38:26Z
- **Completed:** 2026-04-19T01:44:10Z
- **Tasks:** 2 (both TDD — RED + GREEN per task = 4 commits)
- **Files created:** 4 (2 source modules, 2 test files)

## Accomplishments

- `lib/contacts-query.ts` ships `queryContactsForList(q?)`, `queryContactsAutosuggest(q, limit)`, `queryContactById(id)` plus `ContactListRow` and `ContactAutosuggestRow` type exports. The CTE for `activeDealsCount` uses `db.$with('contact_active_deals').as(...).groupBy(dealPeople.contactId)` filtered by `deals.status='active'` — closed and killed deals both excluded in one predicate.
- Autosuggest ranking via `CASE WHEN lower(fullName) = lower(trimmed) THEN 0 WHEN fullName ILIKE prefix THEN 1 ELSE 2 END` → one SQL plan, deterministic tie-break by `lower(fullName)`. Limit clamped server-side to `[1, 20]` regardless of caller input. Empty-input guard returns `[]` before touching the DB.
- `lib/deal-people-query.ts` ships `queryDealPeopleForDeal(dealId)` + `DealPersonRow`. LeftJoin(contacts) honors the SET NULL cascade from Plan 01 — when a contact is deleted, the deal_people row survives and the joined `contactFullName` becomes `null`. ORDER BY role ASC for deterministic output.
- 16 new assertions (12 contacts-query + 4 deal-people-query); full suite **244/244** (up from 228 after P3 Plan 02). `npx tsc --noEmit` clean. `npm run build` green (4 routes unchanged — no UI shipped in this plan).

## Task Commits

Each task was committed atomically (TDD produces RED + GREEN as separate commits):

1. **Task 1 RED: failing tests for lib/contacts-query** — `b9fdab1` (test)
2. **Task 1 GREEN: lib/contacts-query for VIEW-06 + PEOPLE-03/04** — `026a017` (feat)
3. **Task 2 RED: failing tests for lib/deal-people-query** — `b92379c` (test)
4. **Task 2 GREEN: lib/deal-people-query for deal-detail File Contacts tab** — `741b905` (feat)

**Plan metadata:** _pending_ (docs: complete plan — final commit appended after self-check)

## Files Created/Modified

- `lib/contacts-query.ts` — 161 lines. Module header cites VIEW-06 / PEOPLE-03 / PEOPLE-04 and the lib/deals-query.ts pattern inheritance. Uses `and, asc, eq, ilike, or, sql` from drizzle-orm + canonical `@/lib/db` + `contacts, dealPeople, deals` from `@/db/schema`. No new drizzle primitives needed.
- `lib/deal-people-query.ts` — 53 lines. Module header documents the leftJoin-for-SET-NULL reasoning and the role-based ORDER BY rationale. Imports only `asc, eq` from drizzle-orm + `@/lib/db` + `contacts, dealPeople`.
- `tests/unit/contacts-query.test.ts` — 329 lines. 12 assertions: empty-state, 3-contact fixture with zero counts, activeDealsCount=1 after attaching deal_people, count drops to 0 after closing the deal, ILIKE search matches 'alic' against 'Alice Baker' full_name AND 'Malice LLC' org, non-matching search returns 0 of my contacts, autosuggest empty/whitespace returns [], autosuggest('Ali') returns Alice first (prefix rank), autosuggest limit clamped to 20, queryContactById returns the row, queryContactById on unknown uuid returns null.
- `tests/unit/deal-people-query.test.ts` — 266 lines. 4 assertions: unknown deal → [], 2 rows (one FK + one contact-less lender_partner) → correct joined field population, ORDER BY role ASC is deterministic across insertion order, SET NULL cascade after `DELETE FROM contacts` leaves the deal_people row with `contactFullName=null`.

## Decisions Made

- **Test location: `tests/unit/` not `tests/integration/`.** Tracked as a Rule 3 deviation below. `vitest.config.ts` restricts discovery to `tests/unit/**/*.test.ts` — the plan text referred to `tests/integration/` (which would have orphaned the files). The P2 precedent (deal-actions, task-actions, note-actions all real-Postgres and all in `tests/unit/`) is the canonical convention. Test file docstrings note the decision.
- **activeDealsCount predicate: `eq(deals.status, "active")`.** Closed and killed are both excluded by the single literal match (the `deals_status_check` constraint enumerates exactly those three values). Simpler than `inArray(deals.status, ['active'])`, identical SQL.
- **Autosuggest empty-input guard returns `[]` before touching the DB.** Avoids the `%%` ILIKE pattern which would match every non-null row. Client-side and server-side both enforce this — defense in depth.
- **Server-side limit clamp in the query layer, not Zod.** This module is a pass-through; there's no Zod schema for query inputs. Clamping at the DB boundary gives one auditable spot instead of trusting every caller.
- **LeftJoin for `queryDealPeopleForDeal`.** Contact FK is nullable post-SET NULL — inner join would silently drop audit-preserved rows. Type system (DealPersonRow fields are `| null`) makes this explicit to consumers.
- **ORDER BY role ASC, not alphabetical by contact name.** Roles are the stable identity across queries — the File Contacts tab should render 'main_contact' in the same position whether or not the contact's name changed. UI re-sorts to ROLE_SLOTS registry order in Plan 06.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test file location changed from `tests/integration/` to `tests/unit/`**

- **Found during:** Task 1 RED phase (about to create the test file)
- **Issue:** The plan's `files_modified` frontmatter and `<read_first>` instructions referenced `tests/integration/contacts-query.test.ts` and `tests/integration/deal-people-query.test.ts`. However, `vitest.config.ts` has `include: ["tests/unit/**/*.test.ts"]` — tests placed at `tests/integration/` would not be discovered by the runner. The plan's acceptance criterion "`tests/integration/contacts-query.test.ts` passes with >= 9 assertions" would be unreachable without modifying vitest config.
- **Fix:** Placed the tests at `tests/unit/contacts-query.test.ts` and `tests/unit/deal-people-query.test.ts` (matching P2 convention: deal-actions.test.ts, task-actions.test.ts, note-actions.test.ts are all real-Postgres DB-touching tests in `tests/unit/`). Did NOT modify `vitest.config.ts` — that would have been a Rule 4 architectural change.
- **Files modified:** Test files placed at `tests/unit/` instead of `tests/integration/`.
- **Verification:** `npx vitest run` discovers and runs both files; 16/16 pass. Full suite 244/244 green.
- **Committed in:** `b9fdab1` (Task 1 RED) and `b92379c` (Task 2 RED) — each test file docstring calls out the decision.

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Zero scope creep — all behavior, all acceptance criteria (modulo the test-path rename) were met exactly as specified. The only alternative would have been to modify `vitest.config.ts` to add a new `tests/integration/` include glob, which was not called for by this plan and would have been an architectural change to testing infrastructure deferred to a future plan if the split-directory structure is ever desired.

## Issues Encountered

None. RED-GREEN flowed cleanly on both tasks. One cosmetic note: the RED phase's "cleanup errors" (syntax error at end of input for `DELETE ... WHERE created_by = `) during the teardown are an artifact of the test importing failing — the tests never seed any rows, so the empty-ID DELETE runs in afterAll with no TEST_USER_ID. This is the same pattern as P2's RED phase and resolves automatically once the module exists and the tests execute normally.

## User Setup Required

None — pure read-layer plan, no external-service configuration.

## Next Phase Readiness

Remaining P3 plans are unblocked:

- **Plan 03-04 (server actions, TDD):** can freely import `queryContactsForList` / `queryContactById` / `queryDealPeopleForDeal` for any read-before-write logic (e.g., the existing-contact autosuggest inside createContact's de-dupe flow, the "load the deal row to get track" pattern inside upsertDealPerson). Plan 04 is the single writer for contacts + deal_people tables.
- **Plan 03-05 (`/contacts` page):** `queryContactsForList` is the direct data source; `ContactListRow` is the row-renderer contract. The search box on the /contacts route wires its `q` param straight into the query.
- **Plan 03-06 (deal-detail File Contacts tab):** `queryDealPeopleForDeal` + `queryContactsAutosuggest` are the two read primitives. `DealPersonRow` is the slot-renderer contract; `ROLE_SLOTS.find(s => s.code === dp.role)?.label` provides the human-readable label.
- **Plan 03-07 (D-03 backfill):** no direct dependency on this plan (pure data migration), but the `activeDealsCount=1` expectation after backfill is the regression signal if the backfill works — existing `/contacts` queries will immediately show `activeDealsCount > 0` for every contact attached to an active deal via the backfilled `main_contact` slot.

**P3 read layer is complete.** Plan 03 progresses to 3/7 plans shipped (waves 1 + 2 done: 01, 02, 03).

## Self-Check: PASSED

Verified before writing SUMMARY:

- Source files:
  - `lib/contacts-query.ts` FOUND; grep confirms `export async function queryContactsForList` (1), `queryContactsAutosuggest` (1), `queryContactById` (1), `export type ContactListRow` (1), `export type ContactAutosuggestRow` (1), `from "@/lib/db"` (1), `from "@/db/client"` (0 — forbidden D-04), `eq(deals.status, "active")` (1 — active-only count).
  - `lib/deal-people-query.ts` FOUND; grep confirms `export async function queryDealPeopleForDeal` (1), `export type DealPersonRow` (1), `leftJoin(contacts` (2 — import + call), `from "@/lib/db"` (1), no `@/db/client` imports.
- Test files:
  - `tests/unit/contacts-query.test.ts` FOUND; 12/12 passing.
  - `tests/unit/deal-people-query.test.ts` FOUND; 4/4 passing.
- Commits: `b9fdab1` (RED contacts), `026a017` (GREEN contacts), `b92379c` (RED deal-people), `741b905` (GREEN deal-people) — all four found via `git log --oneline -8`.
- Full suite: `npm test` → **244/244 passing** (228 baseline + 16 new: 12 contacts-query + 4 deal-people-query).
- `npx tsc --noEmit` exit 0.
- `npm run build` exit 0, 4 routes unchanged.

## Known Stubs

None. This plan ships pure read primitives with no UI surface. Plan 05 (`/contacts` page) and Plan 06 (File Contacts tab) consume these functions to render real data; until then, no surface renders stub data for contacts or deal_people. The deal-detail File Contacts tab continues to show its P2 placeholder content (documented in P2 Plan 05 SUMMARY as intentionally deferred to P3 Plan 06).

---
*Phase: 03-people-map-contacts-registry*
*Completed: 2026-04-19*
