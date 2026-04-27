---
phase: 03-people-map-contacts-registry
plan: 01
subsystem: database
tags: [postgres, drizzle, migration, partial-unique-index, schema, contacts, deal_people, people-map]

# Dependency graph
requires:
  - phase: 01-core-data-model
    provides: "deals, users, tracks, stages tables; @/lib/db canonical client; schema-shape test pattern; drizzle-kit migration pipeline"
  - phase: 02-deal-detail-tasks-stages
    provides: "Partial unique index pattern (tasks_one_is_next_per_deal_idx) — reused shape for deal_people_one_per_slot_idx; journal-tag rename convention"
provides:
  - "contacts table (10 cols) — PEOPLE-01 global contact registry"
  - "deal_people table (6 cols) with DB-level UNIQUE INDEX on (deal_id, role) — PEOPLE-02 one-slot-per-deal invariant"
  - "Partial UNIQUE INDEX on contacts (lower(email)) WHERE email IS NOT NULL — autosuggest dedupe foundation"
  - "Contact / NewContact / DealPerson / NewDealPerson TypeScript type exports"
  - "Migration 0006 applied + idempotent; DB reality matches Drizzle schema"
affects:
  - "03-02 role-slot registry + Zod contracts (imports contacts + dealPeople types)"
  - "03-03 read-query layer (queries contacts + deal_people with join to deals)"
  - "03-04 server actions (createContact / upsertDealPerson / removeDealPerson — relies on partial unique index for dedupe and one-slot-per-deal invariant as safety net)"
  - "03-05 /contacts page UI (lists contacts with activeDealsCount)"
  - "03-06 deal-detail File Contacts tab (autosuggest + per-slot role assignment)"
  - "03-07 D-03 backfill (copies deals.main_contact_* → deal_people rows)"

# Tech tracking
tech-stack:
  added: []  # Pure schema + migration plan; zero new deps
  patterns:
    - "Partial unique index on expression (lower(email)) WHERE email IS NOT NULL via Drizzle uniqueIndex(...).on(sql`lower(${t.email})`).where(sql`${t.email} IS NOT NULL`) — generates correct partial expression index SQL"
    - "deal_people one-slot-per-deal invariant enforced by DB-level UNIQUE INDEX on (deal_id, role) — cheaper than trigger, indexable, atomic under concurrency"
    - "Contact FK semantics for soft-delete audit trail: contact_id SET NULL preserves deal_people rows so deleting a contact doesn't orphan deals (role text remains as the marker)"

key-files:
  created:
    - "drizzle/migrations/0006_contacts_and_deal_people.sql — 31-line migration (2 CREATE TABLE, 4 FK constraints, 5 indexes incl. 2 partial/expression unique)"
    - "drizzle/migrations/meta/0006_snapshot.json — Drizzle shape snapshot for the new schema"
    - "tests/unit/schema-contacts.test.ts — 8 schema-shape assertions covering PEOPLE-01 + PEOPLE-02"
  modified:
    - "db/schema/app.ts — added contacts + dealPeople tables and 4 type exports (Contact, NewContact, DealPerson, NewDealPerson)"
    - "drizzle/migrations/meta/_journal.json — added entry #6 with renamed tag 0006_contacts_and_deal_people"

key-decisions:
  - "Partial UNIQUE INDEX on lower(email) (not CITEXT) — avoids a new column type dep, dedupe still case-insensitive, leaves raw-case email intact for display"
  - "deal_people.contact_id SET NULL on contact delete — preserves audit trail (a contact once occupied this slot); alternative CASCADE would erase history"
  - "deal_people.deal_id CASCADE on deal delete — slot rows belong to the deal (same semantics as tasks.deal_id / deal_notes.deal_id)"
  - "created_by NO ACTION on both tables — users should not be deletable while they own data (same pattern as tasks / deal_notes)"
  - "Separate role_hint (free-text per contact) from deal_people.role (enum string per slot) — contacts carry a general role descriptor for autosuggest; the slot table owns the canonical role-per-deal assignment"

patterns-established:
  - "P3 schema-shape tests split into their own file (tests/unit/schema-contacts.test.ts) rather than appended to schema-shape.test.ts — keeps P1/P2/P3 slices independently readable; P3 tests target new tables only"
  - "Deterministic UUID synthesis in psql smoke-test + BEGIN/ROLLBACK — invariant can be proven without persisting fixture data"

requirements-completed: [PEOPLE-01, PEOPLE-02]

# Metrics
duration: 4m 52s
completed: 2026-04-18
---

# Phase 3 Plan 01: Schema — contacts + deal_people Summary

**Drizzle schema + migration 0006: `contacts` global registry + `deal_people` link table with a Postgres UNIQUE INDEX enforcing PEOPLE-02 (one contact per slot per deal) and a PARTIAL UNIQUE INDEX on `lower(contacts.email) WHERE email IS NOT NULL` enabling case-insensitive autosuggest dedupe without forcing every contact to own an email address.**

## Performance

- **Duration:** 4m 52s
- **Started:** 2026-04-19T01:18:53Z
- **Completed:** 2026-04-19T01:23:45Z
- **Tasks:** 2
- **Files modified:** 5 (1 source, 1 test, 3 migration metadata)

## Accomplishments

- `contacts` table lands with all 10 columns, 1 FK (`created_by → users.id` NO ACTION), partial expression unique index `contacts_email_unique_idx ON contacts (lower(email)) WHERE email IS NOT NULL`, and a btree index on `full_name` for autosuggest prefix search
- `deal_people` table lands with all 6 columns, 3 FKs (`deal_id → deals.id` CASCADE, `contact_id → contacts.id` SET NULL, `created_by → users.id` NO ACTION), and unique index `deal_people_one_per_slot_idx ON (deal_id, role)` backstopping the one-slot-per-deal invariant at the DB level
- 4 type exports published via the schema barrel: `Contact`, `NewContact`, `DealPerson`, `NewDealPerson`
- 8 new schema-shape assertions (182/182 full suite green; 170 prior baseline + 4 Phase 2 extras + 8 new)
- Migration applied and verified idempotent (second run is a no-op)
- DB-level invariants smoke-tested in psql with BEGIN/ROLLBACK:
  - Two sequential `INSERT INTO deal_people (..., role='main_contact', ...)` for the same deal → second rejected with `deal_people_one_per_slot_idx` violation
  - Two contacts with `email = NULL` coexist (partial unique skips nulls)
  - `email='DUPE@Test.com'` then `email='dupe@test.com'` → second rejected with `contacts_email_unique_idx` violation (case-insensitive via `lower(email)`)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing schema-shape tests for contacts + deal_people** — `9bda3fa` (test)
2. **Task 1 GREEN: add contacts + dealPeople tables to db/schema/app.ts** — `ab3984d` (feat)
3. **Task 2: migration 0006 generated, renamed, applied, smoke-tested** — `b801170` (feat)

## Files Created/Modified

- `db/schema/app.ts` — Added `contacts` table (10 cols, partial expression unique index on `lower(email)` WHERE email IS NOT NULL, btree on full_name), `dealPeople` table (6 cols, unique index on `(deal_id, role)`, 2 btree indexes on `deal_id` and `contact_id`), and 4 type exports. Reused existing `uniqueIndex` import and `sql` template tag; no new imports required.
- `tests/unit/schema-contacts.test.ts` — Split from `schema-shape.test.ts` to keep P3 slice independently readable. 8 tests: exports presence, column lists, FK nullability contract, email-column proxy presence, runtime type-instantiation for `Contact` / `NewContact` / `DealPerson` / `NewDealPerson`.
- `drizzle/migrations/0006_contacts_and_deal_people.sql` — Full 31-line migration (renamed from drizzle-kit auto-tag `0006_flowery_bloodscream.sql`).
- `drizzle/migrations/meta/0006_snapshot.json` — Drizzle shape snapshot (filename tied to `idx`, not tag — no rename needed).
- `drizzle/migrations/meta/_journal.json` — Added entry #6 with tag `0006_contacts_and_deal_people`.

## Decisions Made

- **`lower(email)` expression index, not CITEXT** — No new column-type dep; display-layer reads raw-case email; dedupe is case-insensitive through the index expression. Matches the `lower()` pattern used in future autosuggest queries (Plan 03).
- **Partial index with `WHERE email IS NOT NULL`** — Many contacts will have no email (Facebook Messenger leads, paper intake, lender-name-only partners). Full unique index would force every contact to have a unique email OR NULL — partial unique keeps null-email-coexisting behavior while still deduping the ones that DO have emails.
- **`deal_people.contact_id` SET NULL on delete, not CASCADE** — Preserves the slot row as an audit trail ("a contact once occupied this slot"). The `role` column remains populated; a future replacement contact can be assigned without losing the historical record of who was there before. Alternative CASCADE would erase that history, which is the wrong default for a GLBA-scope system.
- **`deal_people.deal_id` CASCADE on delete** — Slots belong to their deal; if the deal is deleted, the slots should go with it. Same semantics as `tasks.deal_id` and `deal_notes.deal_id`.
- **`created_by` NO ACTION on both tables** — Users should not be deletable while they own data. Keeps the default drizzle semantics for user-attribution columns (same as tasks / deal_notes pattern).
- **Separate test file `schema-contacts.test.ts`** (not appended to `schema-shape.test.ts`) — Independent readability; P1 / P2 / P3 schema slices each own their assertion file. Existing P1+P2 tests untouched (170 baseline preserved).

## Deviations from Plan

None - plan executed exactly as written.

Two tasks, three commits (TDD produces RED + GREEN as separate commits for Task 1 per the plan's `tdd="true"` instruction), all acceptance criteria verified by grep + `npm test` + `npm run build` + DB smoke test.

**Total deviations:** 0.
**Impact on plan:** Zero scope creep. Execution matched the plan byte-for-byte.

## Issues Encountered

- **`drizzle-kit generate` auto-tagged the file `0006_flowery_bloodscream.sql`** instead of the plan's intended `0006_contacts_and_deal_people.sql`. Expected per the plan (the Task 2 action explicitly covers rename + journal edit). Renamed the `.sql` file AND updated `_journal.json` (`"tag": "0006_contacts_and_deal_people"`). The `0006_snapshot.json` filename is tied to `idx` (not tag), so no rename needed there. This matches the P1 Plan 03 + P2 Plan 01 patterns.
- **Local `users` + `deals` tables were empty** when running the partial-unique + one-slot-per-deal smoke tests (no one has logged in against local Postgres; Cloudflare Access user auto-provisioning only runs in the deployed app). Synthesized a user, track, stage, deal, and contact inside `BEGIN ... ROLLBACK`, ran the assertions, and rolled back. No committed test artifacts; Plan 04 will own the automated version of these invariants via real-Postgres server-action tests.
- **`docker compose exec -T postgres psql -U postgres`** failed (`role "postgres" does not exist`) — the local Postgres container runs with user `npr` (per `DATABASE_URL=postgres://npr:npr@localhost:5432/npr_dashboard`). Switched to `psql -U npr -d npr_dashboard` and proceeded.

## User Setup Required

None — pure schema + migration plan, no external-service configuration.

## Next Phase Readiness

Plans 02–07 in phase 03 are unblocked:

- **Plan 03-02 (role-slot registry + Zod contracts):** can now import `contacts` + `dealPeople` from `@/db/schema`; the `ROLE_SLOTS` registry in `lib/role-slots.ts` can reference the `role` column's free-text nature and add the per-track applicability layer.
- **Plan 03-03 (read-query layer):** can compose `queryContactsForList` with `LEFT JOIN deal_people` + activeDealsCount CTE against `deals.status = 'active'`, and `queryDealPeopleForDeal` with a join to `contacts` to resolve display names.
- **Plan 03-04 (server actions TDD):** the partial unique on `lower(email)` is the DB-level dedupe safety net for `createContact`; `deal_people_one_per_slot_idx` is the safety net for `upsertDealPerson`. PEOPLE-05 role-track compatibility is an app-level gate layered on top.
- **Plan 03-05 (/contacts page):** the table can render `contacts.full_name` + `org` + `email` + activeDealsCount without additional schema work.
- **Plan 03-06 (deal-detail File Contacts tab):** can replace the P2 placeholder; autosuggest combobox queries `contacts` ordered by `full_name` prefix match.
- **Plan 03-07 (D-03 backfill migration 0007):** existing `deals.main_contact_*` TEXT columns (P1 DEAL-03) remain in place; migration 0007 will insert `deal_people` rows from them with `role='main_contact'` using `ON CONFLICT DO NOTHING` keyed against `deal_people_one_per_slot_idx` — the unique index lands in THIS plan, giving 0007 the conflict target it needs.

**P3 data foundation is complete.** The `audit_log.table_name` will extend to `'contacts'` and `'deal_people'` in Plan 04's server actions — no schema change required since `table_name` is `text`.

## Self-Check: PASSED

Verified before writing SUMMARY:

- Schema file: `db/schema/app.ts` FOUND; contains `export const contacts = pgTable` (1), `export const dealPeople = pgTable` (1), `contacts_email_unique_idx` (2 — JSDoc reference + uniqueIndex call), `deal_people_one_per_slot_idx` (2), `export type Contact` (1), `export type DealPerson` (1)
- Test file: `tests/unit/schema-contacts.test.ts` FOUND; contains `describe("contacts schema` (1) + `describe("dealPeople schema` (1); 8/8 tests passing
- Migration file: `drizzle/migrations/0006_contacts_and_deal_people.sql` FOUND; contains `CREATE TABLE "contacts"` (1), `CREATE TABLE "deal_people"` (1), `CREATE UNIQUE INDEX "contacts_email_unique_idx"` ON `lower("email")` WHERE `"contacts"."email" IS NOT NULL` (1), `CREATE UNIQUE INDEX "deal_people_one_per_slot_idx"` ON `("deal_id","role")` (1)
- Snapshot: `drizzle/migrations/meta/0006_snapshot.json` FOUND
- Journal: `drizzle/migrations/meta/_journal.json` contains `0006_contacts_and_deal_people` (1)
- Commits: `git log --oneline --all | grep 9bda3fa` FOUND (test RED); `ab3984d` FOUND (feat GREEN schema); `b801170` FOUND (feat migration)
- `npx tsc --noEmit` exit 0
- `npm test` full suite: 182/182 PASSED
- `npm run db:migrate` exit 0 on second run (idempotent)
- `npm run build` exit 0 with 4 routes
- DB smoke tests: `(deal_id, role)` unique violation on second insert; `lower(email)` unique violation on case-variant second insert; null-email contacts coexist — all three as expected

## Known Stubs

None. This plan ships a migration + schema extensions; the new tables/columns will be read/written by Plans 03-02 through 03-07 within the same phase. Until Plan 03-05 and 03-06 ship their UIs, no surface renders stub data for contacts or deal_people — the deal-detail File Contacts tab continues to show its P2 placeholder content (documented in P2 Plan 05 SUMMARY as intentionally deferred to P3).

---
*Phase: 03-people-map-contacts-registry*
*Completed: 2026-04-18*
