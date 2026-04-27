---
phase: 02-deal-detail-tasks-stages
plan: 01
subsystem: database
tags: [postgres, drizzle, migration, partial-unique-index, schema, tasks, deal_notes, kill-columns]

# Dependency graph
requires:
  - phase: 01-core-data-model
    provides: "deals, stages, tracks, audit_log, users tables; @/lib/db canonical client; schema-shape test pattern; drizzle-kit migration pipeline"
provides:
  - "tasks table (13 cols) with DB-level is_next uniqueness via partial unique index"
  - "deal_notes table (6 cols, append-only) for P2 Notes tab + system-note mirror on kill"
  - "deals.killed_at + deals.kill_reason nullable columns for DEAL-06 kill flow"
  - "Task / NewTask / DealNote / NewDealNote TypeScript type exports"
  - "Migration 0005 applied + idempotent; DB reality matches Drizzle schema"
affects:
  - "02-02 next-task queries (reads tasks + is_next)"
  - "02-03 task server actions (relies on partial unique index safety net + status CHECK)"
  - "02-04 stage advance (audit-log kind extension — schema unchanged)"
  - "02-05 kill-deal action (writes killed_at/kill_reason + system note to deal_notes)"
  - "02-06 notes composer + audit tab (reads deal_notes)"

# Tech tracking
tech-stack:
  added: []  # No new deps; schema-only migration
  patterns:
    - "Partial unique index in Drizzle via uniqueIndex(...).on(...).where(sql\\`...\\`) — generates CREATE UNIQUE INDEX ... WHERE correctly"
    - "Self-referential FK via .references((): AnyPgColumn => tasks.id) — imports AnyPgColumn as a type from drizzle-orm/pg-core"
    - "Hand-rename drizzle-kit auto-tag in _journal.json to keep migration filenames human-readable (established P1 convention — Plan 04 pattern)"

key-files:
  created:
    - "drizzle/migrations/0005_phase2_tasks_notes_kill.sql — 40-line migration (2 CREATE TABLE, 2 ADD COLUMN, 7 FK constraints, 4 indexes + 1 partial unique index)"
    - "drizzle/migrations/meta/0005_snapshot.json — drizzle-kit shape snapshot for the new schema"
  modified:
    - "db/schema/app.ts — added tasks + dealNotes tables, killedAt/killReason columns, 4 type exports; added uniqueIndex + AnyPgColumn imports"
    - "tests/unit/schema-shape.test.ts — appended P2 describe block with 9 new assertions"
    - "drizzle/migrations/meta/_journal.json — added 0005 entry with renamed tag"

key-decisions:
  - "Partial unique index (not CHECK trigger) enforces TASK-02 is_next invariant — cheaper, indexable, atomic"
  - "tasks.deal_id + deal_notes.deal_id use ON DELETE CASCADE — tasks/notes belong to the deal"
  - "tasks.parent_task_id + tasks.advances_stage_to_id use ON DELETE SET NULL — preserve history if stage or parent removed"
  - "tasks.owner_user_id + *.created_by use default NO ACTION — users should not be deleted once they own data; if needed later, migrate to SET NULL"
  - "dealNotes is append-only in P2 (no updatedAt column) — audit integrity per UI-SPEC assumption 4"

patterns-established:
  - "P2 schema-shape block extends (not rewrites) the P1 block — one describe per phase to keep drift diffs readable"
  - "Runtime type-presence test (P2 Test 9) instantiates each exported type so tsc catches both export presence and column shape in one shot"

requirements-completed: [DEAL-06, TASK-01, TASK-02]

# Metrics
duration: 4m 41s
completed: 2026-04-18
---

# Phase 2 Plan 01: Schema Extensions — Tasks Table Summary

**Drizzle schema + migration 0005: `tasks` + `deal_notes` tables, `deals.killed_at` / `kill_reason` columns, and a Postgres PARTIAL UNIQUE INDEX that enforces TASK-02 (exactly one `is_next` per deal) at the database level.**

## Performance

- **Duration:** 4m 41s
- **Started:** 2026-04-18T01:37:42Z
- **Completed:** 2026-04-18T01:42:24Z
- **Tasks:** 2
- **Files modified:** 4 (2 source, 2 migration metadata)

## Accomplishments

- `tasks` table lands with all 13 columns, CHECK on status (open|done|skipped), 5 FKs (deal_id CASCADE, parent_task_id/advances_stage_to_id SET NULL, owner_user_id/created_by NO ACTION), and the partial unique index `tasks_one_is_next_per_deal_idx ON tasks (deal_id) WHERE is_next = true`
- `deal_notes` table lands with 6 columns, 2 FKs (deal_id CASCADE, created_by NO ACTION), and a composite `deal_id + created_at` index for chronological note queries
- `deals.killed_at` (nullable timestamptz) + `deals.kill_reason` (nullable text) columns added — prerequisite for the P2 kill-deal action (Plan 05)
- Schema-shape test grew from 7 to 16 assertions (P1 7 + P2 9); full suite 82 → 91 green
- Migration applied and verified idempotent (second run is a no-op)
- DB-level partial unique index smoke-tested: first `is_next=true` accepted, second `is_next=true` on same deal rejected with `unique_violation`, `is_next=false` rows unconstrained

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema-shape assertions + tasks/deal_notes tables + kill columns (RED)** — `2bbe762` (test)
2. **Task 2: Migration 0005 generated, renamed, applied (GREEN)** — `d79b719` (feat)

_Note: P1 Plan 01 established the RED-before-GREEN TDD pattern for schema changes; this plan follows it. The P2 assertions happen to pass as soon as the schema changes land (they introspect Drizzle metadata, not DB), but the commit ordering preserves the intent: test file carries the shape contract, migration proves the DB matches._

## Files Created/Modified

- `db/schema/app.ts` — Added `tasks` table (13 cols, partial unique index, 5 FKs, CHECK constraint, 3 btree indexes), `dealNotes` table (6 cols, composite index, 2 FKs), `killedAt` + `killReason` columns on `deals`, and `Task`/`NewTask`/`DealNote`/`NewDealNote` type exports. Added `uniqueIndex` + `AnyPgColumn` imports.
- `tests/unit/schema-shape.test.ts` — Appended P2 describe block with 9 assertions: exports, column lists (alphabetized), status/is_next defaults, FK nullability, type compilation proxy via runtime instantiation.
- `drizzle/migrations/0005_phase2_tasks_notes_kill.sql` — Full migration (renamed from the auto-tag `0005_far_skullbuster.sql`).
- `drizzle/migrations/meta/0005_snapshot.json` — Drizzle shape snapshot (new).
- `drizzle/migrations/meta/_journal.json` — Added entry #5 with the renamed tag.

## Decisions Made

- **Partial unique index is the DB-level enforcement** (not a CHECK trigger or row-level lock). Postgres treats `CREATE UNIQUE INDEX ... WHERE ...` as a partial index that only constrains rows matching the predicate, so the common case (many `is_next=false` rows per deal) is unconstrained while the invariant case (`is_next=true`) is atomic.
- **CASCADE semantics on deal_id FKs** (tasks + deal_notes): tasks and notes belong to their deal; a deal-delete should remove them.
- **SET NULL on self-ref and stage FK** (parent_task_id, advances_stage_to_id): preserve task-history if the parent task or the target stage is removed. Stage deletion in P1 is out-of-scope anyway, but the semantics are future-proof.
- **NO ACTION on user FKs** (owner_user_id, created_by, deal_notes.created_by): users should not be deletable while they own data. If P10 ever needs user archival, migrate the FK to `SET NULL` then — cheaper than reverse-migrating today.
- **deal_notes append-only in P2** — no `updatedAt`, no edit/delete UI. Audit integrity per UI-SPEC assumption 4; P3 can add edit if Carrie asks during calibration.

## Deviations from Plan

None — plan executed exactly as written. Two tasks, two commits, all acceptance criteria verified by grep + `npm test` + `npm run build` + DB smoke test.

## Issues Encountered

- **`drizzle-kit generate` auto-tagged the file `0005_far_skullbuster.sql`** instead of the plan's intended `0005_phase2_tasks_notes_kill.sql`. Renamed the file AND updated `_journal.json` (`"tag": "0005_phase2_tasks_notes_kill"`). The `0005_snapshot.json` name is tied to the `idx` (not the tag), so no rename needed there. This matches the P1 Plan 03 pattern (hand-authored migration + journal edit).
- **Local `users` table was empty when running the partial-index smoke test** (no one has logged in against local Postgres yet; Cloudflare Access user auto-provisioning only runs in the deployed app). Inserted a synthetic user for the smoke check, ran the invariant assertions (first is_next=true accepted → second is_next=true rejected with unique_violation → is_next=false unconstrained), then cleaned up. No committed test artifacts; Plan 03 owns the automated version.

## User Setup Required

None — this is a pure schema + migration plan with no external-service configuration.

## Next Phase Readiness

Plans 02–06 in phase 02 are unblocked:

- **Plan 02 (next-task queries / list-view wire-through):** can now read `tasks` and query by `is_next = true` + due-date ordering. The list view's em-dashed "Progress/Next Task" + "Task Due By" columns can finally light up.
- **Plan 03 (task server actions — create/complete/reassign with auto-promote + auto-advance):** can rely on the partial unique index as the safety net and on the `tasks_status_check` CONSTRAINT for status validation. TASK-02 invariant is enforceable.
- **Plan 04 (stage advance + revert actions):** no schema prereq from this plan; stages table already shipped in P1. Listed for traceability.
- **Plan 05 (kill-deal action):** `killed_at` + `kill_reason` columns in place; the system-note mirror has a `deal_notes` row to write to.
- **Plan 06 (notes tab + audit tab filters):** `deal_notes` table in place; audit-tab filtering keys on `table_name ∈ ('deals','tasks','deal_notes')` which all exist now.

**P2 data foundation is complete.** The `audit_log.kind` column is still text (not an enum), so plans 03/04/05 can extend `kind` values in mutation code without further schema changes.

## Self-Check: PASSED

Verified before committing SUMMARY:
- Schema file: `db/schema/app.ts` FOUND; contains `export const tasks = pgTable` (1), `export const dealNotes = pgTable` (1), `killedAt: timestamp` (1), `killReason: text` (1), `tasks_one_is_next_per_deal_idx` (2 — JSDoc reference + uniqueIndex call)
- Test file: `tests/unit/schema-shape.test.ts` FOUND; contains `P2 schema shape` describe block (1)
- Migration file: `drizzle/migrations/0005_phase2_tasks_notes_kill.sql` FOUND; contains `CREATE TABLE "tasks"` (1), `CREATE TABLE "deal_notes"` (1), `CREATE UNIQUE INDEX "tasks_one_is_next_per_deal_idx"` (1), `WHERE "tasks"."is_next" = true` (1), `ADD COLUMN "killed_at"` (1), `ADD COLUMN "kill_reason"` (1), `tasks_status_check` (1)
- Journal: `drizzle/migrations/meta/_journal.json` contains `0005_phase2_tasks_notes_kill` (1)
- Commits: `git log --oneline --all | grep 2bbe762` FOUND; `git log --oneline --all | grep d79b719` FOUND
- `npx tsc --noEmit` exit 0
- `npm test` full suite: 91/91 PASSED (82 P1 baseline + 9 P2 schema-shape)
- `npm run db:migrate` exit 0 on second run (idempotent)
- `npm run build` exit 0 with 4 routes
- DB smoke test: partial unique index enforces `is_next` invariant at DB level

## Known Stubs

None. This plan ships a migration + schema extensions; the new tables/columns will be read/written by later plans in the same phase. Until those plans ship, no UI renders stub data for `tasks` or `deal_notes` — the list view continues to em-dash the task columns exactly as it did at end of Phase 1 (that em-dash behavior is documented in the P1 Plan 06 SUMMARY as planned until P2 wires the data).

---
*Phase: 02-deal-detail-tasks-stages*
*Completed: 2026-04-18*
