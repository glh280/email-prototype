---
phase: 01-core-data-model
plan: 01
subsystem: database
tags: [drizzle, postgres, schema, migrations, audit-log, glba]

# Dependency graph
requires:
  - phase: 00.5-access-encryption
    provides: users table, npi_access_log table (dangling deal_id), lib/db.ts canonical client, lib/crypto.ts audit invariant
provides:
  - tracks table (8-row lookup, seeded in plan 04)
  - stages table (25-row hybrid lookup with NULL track_id = universal, seeded in plan 04)
  - deals table (35 columns: DEAL-02 + D-17 created_by + D-18 internal_owner + D-19 status CHECK)
  - audit_log table (OPS-01 per D-05 — Layer 1 of the 3-layer audit model)
  - D-04a FK npi_access_log.deal_id → deals.id (closes P0.5 dangling reference)
  - db/schema/ barrel (auth.ts + app.ts + index.ts re-export) — template-extraction seam
  - DB-client convention locked: @/lib/db is canonical, @/db/client is forbidden
affects: [02-seed-stages-indexes, 03-file-no-generator, 04-seed-tracks-and-stages, 05-new-deal-form, 06-list-view-rewrite, template-extraction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle schema split auth.ts + app.ts with index.ts barrel (template-extraction seam)"
    - "CHECK constraints via drizzle-orm/pg-core `check()` + `sql` tag (4 in this plan)"
    - "Lazy FK arrow `() => table.id` to avoid circular imports across schema files"
    - "Denormalized `user_email` on audit_log for GLBA traceability across user-row deletion (D-05)"
    - "Lookup tables (tracks/stages) instead of pgEnum — SQL INSERTs, no ALTER TYPE migrations (D-01)"

key-files:
  created:
    - db/schema/auth.ts
    - db/schema/app.ts
    - db/schema/index.ts
    - drizzle/migrations/0003_fat_dark_phoenix.sql
    - drizzle/migrations/meta/0003_snapshot.json
    - tests/unit/schema-shape.test.ts
  modified:
    - drizzle.config.ts
    - drizzle/migrations/meta/_journal.json

key-decisions:
  - "D-01 applied: tracks + stages as lookup tables (FK, not pgEnum) — Carrie can add/rename stages in P10 via SQL INSERT"
  - "D-04 applied: schema split into auth.ts (cross-project) + app.ts (NPR-domain) with index.ts re-export — template-extraction seam"
  - "D-04a applied: npi_access_log.deal_id FK to deals.id added in 0003 migration (line 91)"
  - "D-05 applied: audit_log table ships in P1 with denormalized user_email; P1 writes on deal.create only, P2 extends"
  - "D-17 applied: deals.created_by FK users NOT NULL"
  - "D-18 applied: deals.internal_owner FK users NULL (defaults to created_by on insert; used by Needs-me filter D-14)"
  - "D-19 applied: deals.status text with CHECK (active | closed | killed), default 'active'"
  - "Locked DB-client convention: canonical path is `@/lib/db`. `@/db/client` does NOT exist and MUST NOT be introduced in plans 02-06 or any future phase."

patterns-established:
  - "Pattern 1: Split schema barrel — `db/schema/index.ts` re-exports auth + app so downstream code keeps using `@/db/schema` unchanged"
  - "Pattern 2: CHECK constraints via `check('name', sql\"col IN (...)\") in the third-arg array of pgTable"
  - "Pattern 3: Lazy FK references across files via `() => foreignTable.id` to avoid circular import resolution"
  - "Pattern 4: Audit-log writes are part of mutation path, not separate — audit_log.user_email denormalized per D-05 so traceability survives user-row deletion"

requirements-completed: [DEAL-01, DEAL-02, DEAL-02a, STAGE-01, OPS-01]

# Metrics
duration: 5m
completed: 2026-04-17
---

# Phase 01 Plan 01: Schema Split and Core Tables Summary

**Drizzle schema split into auth.ts + app.ts barrel, 4 P1 tables (tracks, stages, deals, audit_log) landed via migration 0003, D-04a FK on npi_access_log.deal_id closed, DB-client convention locked to @/lib/db.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-17T21:54:47Z
- **Completed:** 2026-04-17T21:59:34Z
- **Tasks:** 3 (Task 1 TDD RED+GREEN, Task 2 migration, Task 3 convention audit)
- **Files modified/created:** 9 source/artifact files

## Accomplishments

- **Schema split (D-04):** `db/schema.ts` became `db/schema/{auth,app,index}.ts`. `auth.ts` holds cross-project tables (users, npi_access_log) — the template-extraction seam. `app.ts` holds NPR domain tables (tracks, stages, deals, audit_log). `index.ts` re-exports both so every existing `import { ... } from "@/db/schema"` keeps working with zero changes.
- **4 new tables** with all Phase 1 schema decisions applied:

  | Table | Columns | CHECKs | FKs | Indexes |
  |-------|---------|--------|-----|---------|
  | tracks | 6 | 1 (default_priority) | — | (unique on code) |
  | stages | 6 | 0 | 1 (→tracks, nullable) | (unique on code) |
  | deals | 35 | 2 (priority, status) | 4 (→tracks, →stages, →users×2) | 6 + unique file_no |
  | audit_log | 9 | 1 (operation) | 1 (→users) | 3 |

- **D-04a FK:** Added `npi_access_log_deal_id_deals_id_fk` on `npi_access_log.deal_id → deals.id` — closes the dangling reference from P0.5.
- **TDD:** 7 schema-shape tests (RED → GREEN in one iteration); full suite 23/23 green; `npm run build` compiles; `npx tsc --noEmit` exits 0.
- **DB-client convention locked:** zero files in the repo reference `@/db/client`. Every future server file MUST `import { db } from "@/lib/db"`.

## Schema Topology After Split

```
@/db/schema (consumer-facing import path)
  └── db/schema/index.ts   (barrel)
        ├── export * from "./auth"
        │     ├── users              (tbl, moved from old db/schema.ts)
        │     ├── npiAccessLog       (tbl, moved + dealId FK added per D-04a)
        │     └── types: User, NewUser, NpiAccessLogRow, NewNpiAccessLogRow
        └── export * from "./app"
              ├── tracks             (tbl, NEW — 6 cols, 1 CHECK)
              ├── stages             (tbl, NEW — 6 cols, FK to tracks nullable)
              ├── deals              (tbl, NEW — 35 cols, 2 CHECKs, 4 FKs, 6 idx)
              ├── auditLog           (tbl, NEW — 9 cols, 1 CHECK, FK to users, 3 idx)
              └── types: Track, NewTrack, Stage, NewStage, Deal, NewDeal, AuditLogRow, NewAuditLogRow
```

Canonical DB client (unchanged): `lib/db.ts` — `import { db } from "@/lib/db"`.
**`@/db/client` does NOT exist and MUST NOT be introduced.**

## Task Commits

1. **Task 1 (TDD RED): failing schema-shape test** — `2c04d24` (test)
2. **Task 1 (TDD GREEN): split schema + add P1 tables** — `b28ec4b` (feat)
3. **Task 2: generate + apply migration 0003** — `83cc000` (feat)
4. **Task 3: verify DB-client convention (no stale @/db/client)** — (verification-only, no file changes; documented here)

**Plan metadata commit:** produced after SUMMARY.md write.

## Files Created/Modified

- **Created:** `db/schema/auth.ts` — users + npiAccessLog with FK to deals.id (D-04a, lazy arrow for circular-import safety)
- **Created:** `db/schema/app.ts` — tracks, stages, deals, auditLog with CHECK constraints via `check()` from `drizzle-orm/pg-core`
- **Created:** `db/schema/index.ts` — barrel `export * from "./auth"; export * from "./app"`
- **Renamed (git):** `db/schema.ts` → `db/schema/auth.ts` (R 89% similarity)
- **Modified:** `drizzle.config.ts` — `schema` field retargeted to `./db/schema/index.ts`
- **Created:** `drizzle/migrations/0003_fat_dark_phoenix.sql` — 91 lines: 4 CREATE TABLE, 6 ALTER TABLE (FKs), 9 CREATE INDEX, 4 inline CHECK constraints
- **Created:** `drizzle/migrations/meta/0003_snapshot.json` — drizzle-kit snapshot
- **Modified:** `drizzle/migrations/meta/_journal.json` — journal entry index 3 added
- **Created:** `tests/unit/schema-shape.test.ts` — 7 assertions matching behaviors 1–7

## Migration 0003 Notable SQL

```sql
-- CHECK constraints (4 total)
CONSTRAINT "audit_log_operation_check" CHECK ("audit_log"."operation" IN ('create', 'update', 'delete'))
CONSTRAINT "deals_priority_check"      CHECK ("deals"."priority" IN ('HIGH', 'MEDIUM', 'LOW'))
CONSTRAINT "deals_status_check"        CHECK ("deals"."status" IN ('active', 'closed', 'killed'))
CONSTRAINT "tracks_default_priority_check" CHECK ("tracks"."default_priority" IN ('HIGH', 'MEDIUM', 'LOW'))

-- D-04a — closes the dangling FK from P0.5
ALTER TABLE "npi_access_log"
  ADD CONSTRAINT "npi_access_log_deal_id_deals_id_fk"
  FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id")
  ON DELETE no action ON UPDATE no action;
```

## Drizzle API Notes (no surprises this plan)

- **`check` export location:** `drizzle-orm/pg-core` re-exports `check` from `./checks.js` (verified in `node_modules/drizzle-orm/pg-core/index.d.ts`). The plan's concern about fallback to raw `sql\`CHECK (...)\`` did not materialize — `check()` worked first try.
- **`pgTable` third-arg:** drizzle-orm 0.45.2 supports BOTH the array form `(t) => [...]` (non-deprecated) and the object form `(t) => ({ ... })` (still works; carries a `@deprecated` JSDoc). New tables use the array form; existing `npiAccessLog` keeps the object form (not touched).
- **Lazy FK arrow across files:** `dealId: uuid("deal_id").references(() => deals.id)` resolves cleanly despite auth.ts importing from app.ts and vice versa — Drizzle evaluates the arrow lazily.
- **Generated FK names:** drizzle-kit names constraints `<table>_<col>_<ref-table>_<ref-col>_fk` (e.g., `deals_created_by_users_id_fk`). No manual naming needed.

## DB-Client Convention (locked for plans 02–06 and beyond)

The canonical Drizzle client lives at **`lib/db.ts`** and is imported as:

```typescript
import { db } from "@/lib/db";
```

**`@/db/client` does NOT exist and MUST NOT be introduced** by any future plan, server action, seeder, test, or helper. Any PR that adds `db/client.ts` or references `@/db/client` should be rejected in checker/verifier.

Verified at commit time: `git ls-files '*.ts' '*.tsx' | xargs grep -l '@/db/client'` returns 0 matches.

## Decisions Made

None new — plan applied existing decisions from CONTEXT.md (D-01, D-03, D-04, D-04a, D-05, D-17, D-18, D-19). See `key-decisions` in frontmatter for the applied list.

## Deviations from Plan

None — plan executed exactly as written.

The plan's concern about the `check` helper's import path (potential fallback to raw `sql\`CHECK (...)\``) did not materialize: `check` is cleanly exported from `drizzle-orm/pg-core` in 0.45.2. The plan's concern about `pgTable` third-arg signature also did not materialize: the array form works. No deviations logged.

## Issues Encountered

None.

## Known Stubs

None. All 4 new tables are fully wired and the FK on `npi_access_log.deal_id` is real in both schema and migrated DB. The tables have no seed data yet — seeding is plan 04's scope (DEAL-01 8 tracks + STAGE-01 25 stages), which is intentional per the plan boundary, not a stub.

## User Setup Required

None — no external service configuration required. Postgres (already running locally) and the migration apply cleanly.

## Next Phase Readiness

- **Plan 02 (indexes / stage-guard constraint):** unblocked. Can add the `deals.stage_id` CHECK that enforces `stage IS universal OR stage.track = deal.track` per CONTEXT §Phase Boundary.
- **Plan 03 (file_no generator):** unblocked. `deals.file_no` exists as `text NOT NULL UNIQUE`; plan 03 adds the `next_file_no(state_code)` SQL function + trigger.
- **Plan 04 (seed tracks + stages):** unblocked. All 8 track rows + 25 stage rows can land as a seed script hitting the new tables.
- **Plan 05 (new-deal form):** unblocked. `deals` has every column DEAL-02 needs; server action will use `import { db } from "@/lib/db"` and `import { deals } from "@/db/schema"`.
- **Plan 06 (list view rewrite):** unblocked. Activity-column source (`audit_log.created_at` per D-15) is available.

## Self-Check

- [x] `db/schema/auth.ts` exists — FOUND
- [x] `db/schema/app.ts` exists — FOUND
- [x] `db/schema/index.ts` exists — FOUND
- [x] old `db/schema.ts` file removed — CONFIRMED via `git status` (rename detected)
- [x] no `db/client.ts` exists — CONFIRMED
- [x] `lib/db.ts` present (canonical client) — FOUND
- [x] `drizzle.config.ts` points at `./db/schema/index.ts` — FOUND
- [x] `drizzle/migrations/0003_fat_dark_phoenix.sql` exists — FOUND
- [x] Commit `2c04d24` (test RED) exists in git log — VERIFIED
- [x] Commit `b28ec4b` (feat GREEN) exists in git log — VERIFIED
- [x] Commit `83cc000` (feat migration 0003) exists in git log — VERIFIED
- [x] `npm test` → 23/23 green
- [x] `npm run build` → compiled successfully
- [x] `npx tsc --noEmit` → exit 0
- [x] `npm run db:migrate` idempotent re-run → exit 0
- [x] All 6 must_haves.truths verified
- [x] All 5 requirements marked complete: DEAL-01, DEAL-02, DEAL-02a, STAGE-01, OPS-01

## Self-Check: PASSED

---
*Phase: 01-core-data-model*
*Completed: 2026-04-17*
