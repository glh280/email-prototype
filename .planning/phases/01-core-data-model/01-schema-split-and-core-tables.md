---
phase: 01-core-data-model
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - db/schema.ts
  - db/schema/auth.ts
  - db/schema/app.ts
  - db/schema/index.ts
  - drizzle.config.ts
  - drizzle/migrations/0003_phase1_core_data_model.sql
  - drizzle/migrations/meta/_journal.json
  - tests/unit/schema-shape.test.ts
autonomous: true
requirements: [DEAL-01, DEAL-02, DEAL-02a, STAGE-01, OPS-01]
requirements_addressed: [DEAL-01, DEAL-02, DEAL-02a, STAGE-01, OPS-01]

must_haves:
  truths:
    - "Drizzle schema exports tracks, stages, deals, audit_log tables from @/db/schema"
    - "npi_access_log.deal_id has FK to deals(id) — no dangling reference remains"
    - "Existing `@/db/schema` imports (users, npiAccessLog) continue to work without modification"
    - "npm run db:generate produces a migration that creates tracks, stages, deals, audit_log and the deal_id FK"
    - "npm test tests/unit/schema-shape.test.ts passes (validates table shapes and columns)"
    - "The canonical DB client import path for ALL future code is `@/lib/db` (NOT `@/db/client` — which does not exist)"
  artifacts:
    - path: "db/schema/auth.ts"
      provides: "users + npiAccessLog tables (moved from db/schema.ts)"
      exports: ["users", "npiAccessLog", "User", "NewUser", "NpiAccessLogRow", "NewNpiAccessLogRow"]
    - path: "db/schema/app.ts"
      provides: "tracks, stages, deals, audit_log tables"
      exports: ["tracks", "stages", "deals", "auditLog", "Track", "NewTrack", "Stage", "NewStage", "Deal", "NewDeal", "AuditLogRow", "NewAuditLogRow"]
    - path: "db/schema/index.ts"
      provides: "Re-exports auth + app for backward-compat"
    - path: "drizzle/migrations/0003_phase1_core_data_model.sql"
      provides: "Drizzle-generated SQL creating 4 new tables + FK constraint"
      contains: "CREATE TABLE \"tracks\""
  key_links:
    - from: "@/db/schema"
      to: "db/schema/index.ts → auth.ts + app.ts"
      via: "TypeScript path alias"
      pattern: "export \\* from"
    - from: "npi_access_log.deal_id"
      to: "deals.id"
      via: "FK constraint added in 0003 migration"
      pattern: "REFERENCES \"deals\""
    - from: "all future server code"
      to: "lib/db.ts (the canonical Drizzle client)"
      via: "import { db } from \"@/lib/db\""
      pattern: "from \"@/lib/db\""
---

<objective>
Split the single `db/schema.ts` file into `db/schema/auth.ts` + `db/schema/app.ts` + `db/schema/index.ts` per D-04, add the four Phase 1 tables (`tracks`, `stages`, `deals`, `audit_log`), add an FK from `npi_access_log.deal_id` to `deals.id` per D-04a, update `drizzle.config.ts` to point at the new index, and generate + apply the Drizzle migration.

Also: lock the DB-client convention. The Drizzle client lives at `lib/db.ts` (NOT `db/client.ts`). ALL future code — server actions, page server components, seeders, tests — MUST `import { db } from "@/lib/db"`. Any reference to `@/db/client` is a bug.

Purpose: Creates the data foundation every other Phase 1 plan builds on. Implements all Phase 1 schema-shape decisions from CONTEXT.md (D-01, D-02 columns only — SQL function lands in plan 03; D-04, D-04a, D-05, D-17, D-18, D-19). Enables the template-extraction seam by colocating reusable auth tables.
Output: 4 new app-domain tables + FK fix, backward-compatible schema exports, generated SQL migration committed to git, and a documented DB-client convention.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-core-data-model/01-CONTEXT.md
@.planning/phases/01-core-data-model/01-UI-SPEC.md
@.planning/REQUIREMENTS.md
@AGENTS.md
@db/schema.ts
@drizzle.config.ts
@lib/db.ts

<interfaces>
<!-- Existing exports that MUST keep working after the split -->

From db/schema.ts (current):
```typescript
export const users: PgTable;
export const npiAccessLog: PgTable;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type NpiAccessLogRow = typeof npiAccessLog.$inferSelect;
export type NewNpiAccessLogRow = typeof npiAccessLog.$inferInsert;
```

After the split, `import { users, npiAccessLog, type User } from "@/db/schema"` MUST still resolve (through `db/schema/index.ts` re-exports).

From lib/db.ts (existing — DO NOT move or rename):
```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "@/db/schema";

const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

This is THE canonical DB client. Later plans (03, 04, 05, 06) will all import it as `import { db } from "@/lib/db"`. Do NOT create `db/client.ts`.

Drizzle pgTable column helpers in use (from `drizzle-orm/pg-core`):
- `uuid("col").defaultRandom().primaryKey()`
- `uuid("col").references(() => otherTable.id)` for FKs
- `text("col").notNull()` / `.unique()`
- `boolean("col").notNull().default(true)`
- `integer("col").notNull()` (for sort_order)
- `timestamp("col", { withTimezone: true }).defaultNow().notNull()`
- `jsonb("col")` (for audit_log before_json / after_json)
- `index("idx_name").on(t.col)` inside the third-arg table builder
- `pgEnum("priority", ["HIGH", "MEDIUM", "LOW"])` or text column with CHECK — use text + CHECK per D-01 rationale (enum changes require ALTER TYPE)

Drizzle Next.js 16 notes (per AGENTS.md): the `pgTable` third argument signature changed from an object-returning callback to a direct array in some recent drizzle-orm versions. Confirm against installed `drizzle-orm` 0.45.2 docs in `node_modules/drizzle-orm/` before writing table definitions — do not assume training-data shape.

**`check()` import — VERIFY AT RUNTIME before proceeding.** Plan 01 uses `check()` for 3 CHECK constraints (tracks.defaultPriority, deals.priority, deals.status, audit_log.operation). The export location of `check` varies across drizzle-orm versions: it may live in `drizzle-orm/pg-core` or in `drizzle-orm` core. Grep `node_modules/drizzle-orm/pg-core/index.d.ts` AND `node_modules/drizzle-orm/index.d.ts` for `export.*check` BEFORE writing the schema. If neither exports `check`, fall back to raw `sql\`CHECK (...)\`` via `drizzle-orm` — see the explicit guidance in Task 1 Step 3.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Split schema into auth.ts + app.ts + index.ts with new tables (and lock DB-client convention)</name>
  <files>db/schema/auth.ts, db/schema/app.ts, db/schema/index.ts, db/schema.ts</files>
  <read_first>
    - db/schema.ts (current state — must not lose any columns when moving to auth.ts)
    - lib/db.ts (CANONICAL DB client — confirm it's the single source of the Drizzle instance; all future code uses `import { db } from "@/lib/db"`)
    - .planning/phases/01-core-data-model/01-CONTEXT.md (D-01, D-04, D-04a, D-05, D-17, D-18, D-19 — exact column specifications)
    - .planning/REQUIREMENTS.md (DEAL-01 track list; DEAL-02 field list; STAGE-01 universal flag; OPS-01 audit_log shape)
    - AGENTS.md (Next.js 16 / Drizzle breaking-change warning)
    - node_modules/drizzle-orm/pg-core/index.d.ts (confirm current pgTable / index / references API signatures before writing; grep for `export.*check`)
    - node_modules/drizzle-orm/index.d.ts (grep for `export.*check` — the `check` helper's export location varies by drizzle-orm version)
    - package.json (confirm drizzle-orm 0.45.2 is installed)
  </read_first>
  <behavior>
    - Test 1: `import { users, npiAccessLog, tracks, stages, deals, auditLog } from "@/db/schema"` resolves (all 6 tables exported)
    - Test 2: `tracks` has columns id, code, label, defaultPriority, active, sortOrder
    - Test 3: `stages` has columns id, code, label, trackId (nullable), sortOrder, isTerminal
    - Test 4: `deals` has the full DEAL-02 field list (track_id, stage_id, file_no unique, title, priority, status, closing_at, funding_at nullable, etc.) plus created_by, internal_owner per D-17/D-18
    - Test 5: `auditLog` has table_name, record_id, operation, before_json nullable, after_json not-null, user_id, user_email, created_at per D-05
    - Test 6: `npiAccessLog.dealId` type is inferred as the FK-referencing column type (Drizzle's relation is present)
    - Test 7: Old import path `@/db/schema` (no subpath) still works
  </behavior>
  <action>
    Step 1 — Create `db/schema/auth.ts` by moving the existing `users` and `npiAccessLog` definitions from `db/schema.ts` verbatim (DO NOT modify columns). Preserve all type exports (`User`, `NewUser`, `NpiAccessLogRow`, `NewNpiAccessLogRow`). Preserve all comments.

    Step 2 — In `db/schema/auth.ts`, modify ONLY the `npiAccessLog.dealId` column: add a `.references(() => deals.id)` clause to close the dangling FK per D-04a. Import `deals` from `./app` at the top of the file. Because this creates a circular import risk, use the lazy-arrow `() => deals.id` form (Drizzle supports this). Verify by: `grep -n "deals.id" db/schema/auth.ts` should match.

    Step 3 — BEFORE writing `db/schema/app.ts`, verify the `check` helper's import path:
    ```bash
    grep -n "export.*\\bcheck\\b" node_modules/drizzle-orm/pg-core/index.d.ts
    grep -n "export.*\\bcheck\\b" node_modules/drizzle-orm/index.d.ts
    ```
    Pick the matching import. If `check` is exported from `drizzle-orm/pg-core`, use `import { check } from "drizzle-orm/pg-core"` in the same import as the other pg-core helpers. If it's exported from `drizzle-orm` core, do `import { check } from "drizzle-orm"` separately. If NEITHER exports `check` in this Drizzle version, fall back to raw-SQL CHECK constraints via the pg-core `sql` tag — attach them inside the third-arg array as `sql\`CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW'))\``. The chosen path must be whatever makes `npx tsc --noEmit` pass.

    DO NOT proceed to `npm run db:generate` (Task 2) until `npx tsc --noEmit` exits 0 after writing the schema files. A compile failure here will also make Task 2's migration generation fail.

    Step 4 — Create `db/schema/app.ts` with FOUR new tables. Copy the specifications below verbatim (except adjusting the `check` import line per Step 3):

    ```typescript
    import { pgTable, text, timestamp, uuid, boolean, integer, jsonb, index, check } from "drizzle-orm/pg-core";
    import { sql } from "drizzle-orm";
    import { users } from "./auth";

    /**
     * Tracks — 8 seeded rows per DEAL-01 (D-01 lookup-table approach).
     * Code values: TE, FL, DP, PO, EC, SL, BL, GI.
     */
    export const tracks = pgTable("tracks", {
      id: uuid("id").defaultRandom().primaryKey(),
      code: text("code").notNull().unique(),            // e.g. "TE"
      label: text("label").notNull(),                   // e.g. "Title & Escrow"
      defaultPriority: text("default_priority").notNull(), // "HIGH" | "MEDIUM" | "LOW"
      active: boolean("active").notNull().default(true),
      sortOrder: integer("sort_order").notNull(),
    }, (t) => [
      check("tracks_default_priority_check", sql`${t.defaultPriority} IN ('HIGH', 'MEDIUM', 'LOW')`),
    ]);

    /**
     * Stages — 25 seeded rows per STAGE-01 (D-01 hybrid: track_id NULL = universal).
     * Universal (4): pre_screen_qualification, deal_structuring, file_completed, killed
     * TE (10): title_order_opened ... policy_issued
     * FL (11): deal_team_assigned ... funding_approval_received
     */
    export const stages = pgTable("stages", {
      id: uuid("id").defaultRandom().primaryKey(),
      code: text("code").notNull().unique(),
      label: text("label").notNull(),
      trackId: uuid("track_id").references(() => tracks.id),  // NULL = universal
      sortOrder: integer("sort_order").notNull(),
      isTerminal: boolean("is_terminal").notNull().default(false),
    });

    /**
     * Deals — the core record per DEAL-02. D-03: main_contact as free text in P1.
     * D-17 created_by FK users; D-18 internal_owner FK users (nullable, defaults to created_by).
     * D-19 status text with CHECK. file_no auto-generated by next_file_no() — see plan 03.
     */
    export const deals = pgTable("deals", {
      id: uuid("id").defaultRandom().primaryKey(),
      trackId: uuid("track_id").notNull().references(() => tracks.id),
      stageId: uuid("stage_id").notNull().references(() => stages.id),
      fileNo: text("file_no").notNull().unique(),
      title: text("title").notNull(),
      priority: text("priority").notNull(),  // HIGH | MEDIUM | LOW
      status: text("status").notNull().default("active"),  // active | closed | killed
      // Main contact free-text per D-03 (migrates to FK in P3)
      mainContactName: text("main_contact_name"),
      mainContactEmail: text("main_contact_email"),
      mainContactPhone: text("main_contact_phone"),
      // Property fields (all nullable per D-09)
      propertyAddress: text("property_address"),
      propertyState: text("property_state"),   // 2-letter code (drives file_no prefix)
      propertyType: text("property_type"),
      salesPrice: integer("sales_price"),      // cents NOT used — whole USD per UI-SPEC
      // Lending fields
      loanType: text("loan_type"),
      transactionType: text("transaction_type"),
      loanAmount: integer("loan_amount"),
      estimatedDown: integer("estimated_down"),
      earnestMoney: integer("earnest_money"),
      estRehab: integer("est_rehab"),
      arv: integer("arv"),
      titleCtc: boolean("title_ctc").notNull().default(false),
      lenderCtc: boolean("lender_ctc").notNull().default(false),
      // Legacy / misc DEAL-02 fields
      titleFileNo: text("title_file_no"),
      loanNo: text("loan_no"),
      serviceSelected: text("service_selected"),
      quickNote: text("quick_note"),
      // Dates
      openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
      closingAt: timestamp("closing_at", { withTimezone: true }),
      fundingAt: timestamp("funding_at", { withTimezone: true }),
      closedAt: timestamp("closed_at", { withTimezone: true }),
      // Ownership per D-17 / D-18
      createdBy: uuid("created_by").notNull().references(() => users.id),
      internalOwner: uuid("internal_owner").references(() => users.id),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    }, (t) => [
      check("deals_priority_check", sql`${t.priority} IN ('HIGH', 'MEDIUM', 'LOW')`),
      check("deals_status_check", sql`${t.status} IN ('active', 'closed', 'killed')`),
      index("deals_file_no_idx").on(t.fileNo),
      index("deals_track_id_idx").on(t.trackId),
      index("deals_stage_id_idx").on(t.stageId),
      index("deals_status_idx").on(t.status),
      index("deals_internal_owner_idx").on(t.internalOwner),
      index("deals_created_at_desc_idx").on(t.createdAt),
    ]);

    /**
     * Audit log (OPS-01) — every mutation writes one row. D-05.
     * P1 writes on deal.create only; P2 extends to update/stage/task mutations.
     * user_email denormalized so GLBA traceability survives user-row deletion.
     */
    export const auditLog = pgTable("audit_log", {
      id: uuid("id").defaultRandom().primaryKey(),
      tableName: text("table_name").notNull(),      // e.g. "deals"
      recordId: uuid("record_id").notNull(),
      operation: text("operation").notNull(),       // create | update | delete
      beforeJson: jsonb("before_json"),             // null for create
      afterJson: jsonb("after_json").notNull(),
      userId: uuid("user_id").notNull().references(() => users.id),
      userEmail: text("user_email").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    }, (t) => [
      check("audit_log_operation_check", sql`${t.operation} IN ('create', 'update', 'delete')`),
      index("audit_log_record_idx").on(t.tableName, t.recordId),
      index("audit_log_user_idx").on(t.userId, t.createdAt),
      index("audit_log_created_at_desc_idx").on(t.createdAt),
    ]);

    export type Track = typeof tracks.$inferSelect;
    export type NewTrack = typeof tracks.$inferInsert;
    export type Stage = typeof stages.$inferSelect;
    export type NewStage = typeof stages.$inferInsert;
    export type Deal = typeof deals.$inferSelect;
    export type NewDeal = typeof deals.$inferInsert;
    export type AuditLogRow = typeof auditLog.$inferSelect;
    export type NewAuditLogRow = typeof auditLog.$inferInsert;
    ```

    Before writing, verify the `pgTable` third-argument shape against drizzle-orm 0.45.2's actual TypeScript definitions — if the installed version uses the object-returning callback form `(t) => ({ idx: index(...).on(t.col) })` instead of the array form shown above, use that shape. Do not assume — read `node_modules/drizzle-orm/pg-core/index.d.ts` (or the relevant `.d.ts` in that package) first.

    Step 5 — Create `db/schema/index.ts`:
    ```typescript
    export * from "./auth";
    export * from "./app";
    ```

    Step 6 — Delete the old `db/schema.ts` file (contents now fully moved). Verify with `test ! -f db/schema.ts` AFTER confirming `git status` shows the file removed.

    Step 7 — Update `drizzle.config.ts` to change the `schema` field from `"./db/schema.ts"` to `"./db/schema/index.ts"`. Verify with `grep "schema/index" drizzle.config.ts`.

    Step 8 — Compile check: run `npx tsc --noEmit` and confirm it exits 0. If `check` import is wrong, the error surfaces here — fix before moving to Task 2.

    Step 9 — Write `tests/unit/schema-shape.test.ts` with assertions matching the 7 behaviors above. Use vitest. Do simple object-shape assertions:
    ```typescript
    import { describe, it, expect } from "vitest";
    import * as schema from "@/db/schema";
    describe("schema exports", () => {
      it("exports tracks, stages, deals, auditLog, users, npiAccessLog", () => {
        expect(schema.tracks).toBeDefined();
        expect(schema.stages).toBeDefined();
        expect(schema.deals).toBeDefined();
        expect(schema.auditLog).toBeDefined();
        expect(schema.users).toBeDefined();
        expect(schema.npiAccessLog).toBeDefined();
      });
      // ...column-presence checks using schema.tracks._.config.columns, etc.
    });
    ```
    Inspect Drizzle's actual introspection API (`table._.columns` or similar) to find the correct property. Add at minimum one assertion per behavior (7 tests).
  </action>
  <verify>
    <automated>npm test tests/unit/schema-shape.test.ts</automated>
  </verify>
  <done>
    - `db/schema/auth.ts` exists with users + npiAccessLog, FK on dealId to deals.id
    - `db/schema/app.ts` exists with tracks + stages + deals + auditLog (all columns per spec)
    - `db/schema/index.ts` re-exports both
    - `db/schema.ts` (single-file) DELETED
    - `drizzle.config.ts` points at `./db/schema/index.ts`
    - `tests/unit/schema-shape.test.ts` passes with 7+ assertions
    - `npx tsc --noEmit` exits 0 (the `check` import and all schema typing are correct)
    - DB-client convention locked: `lib/db.ts` is the canonical client; no `db/client.ts` exists
    - Existing imports like `import { users } from "@/db/schema"` (used in lib/users.ts, lib/current-user.ts) still compile — `npm run build` does NOT regress
  </done>
  <acceptance_criteria>
    - `ls db/schema/auth.ts db/schema/app.ts db/schema/index.ts` shows all 3 files
    - `test ! -f db/schema.ts` succeeds (old file gone)
    - `test ! -f db/client.ts` succeeds (there must be no db/client.ts — the canonical client is lib/db.ts)
    - `ls lib/db.ts` succeeds (canonical client still present)
    - `grep "schema/index" drizzle.config.ts` returns a match
    - `grep -E "export const tracks|export const stages|export const deals|export const auditLog" db/schema/app.ts` returns all 4 matches
    - `grep "references(() => deals.id)" db/schema/auth.ts` returns a match (FK on dealId)
    - `grep -E "main_contact_name|file_no|quick_note|funding_at|closing_at|loan_type|transaction_type|estimated_down|sales_price|title_ctc|lender_ctc|internal_owner|created_by" db/schema/app.ts` returns 13+ matches
    - `grep -E "before_json|after_json|user_email|operation" db/schema/app.ts` returns 4+ matches (audit_log fields)
    - `grep -E "check\\(\"|check \"" db/schema/app.ts` returns 3+ matches (CHECK constraints on tracks, deals priority+status, audit_log — sanity check OR an equivalent fallback using `sql\`CHECK (...)\`` appears if `check()` wasn't available; at minimum the string "CHECK" appears 3+ times in the file)
    - `npx tsc --noEmit` exits 0 (MUST pass BEFORE Task 2's `npm run db:generate`)
    - `npm test tests/unit/schema-shape.test.ts` exits 0
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Generate + apply Drizzle migration for new tables and FK</name>
  <files>drizzle/migrations/0003_*.sql, drizzle/migrations/meta/_journal.json, drizzle/migrations/meta/0003_snapshot.json</files>
  <read_first>
    - drizzle.config.ts (confirm it points at db/schema/index.ts from Task 1)
    - drizzle/migrations/ (existing 0000, 0001, 0002 migrations — name scheme + style)
    - drizzle/migrations/meta/_journal.json (entry format for new migration)
    - .planning/phases/01-core-data-model/01-CONTEXT.md (D-04a FK requirement)
    - db/schema/auth.ts + db/schema/app.ts (schema state to be migrated)
  </read_first>
  <action>
    PRECONDITION — confirm `npx tsc --noEmit` exits 0 before starting Step 1. If it fails, go back to Task 1 Step 3 and resolve the `check` import. `npm run db:generate` internally runs the TypeScript compiler to introspect the schema; it will fail opaquely if typing is broken.

    Step 1 — Run `npm run db:generate` from the repo root. Drizzle-kit will produce `drizzle/migrations/0003_<adjective>_<name>.sql` and append to `_journal.json`. Do NOT rename the file manually — the journal hash depends on it.

    Step 2 — Inspect the generated SQL. It MUST contain (in this order):
    - `CREATE TABLE "tracks" (...)`
    - `CREATE TABLE "stages" (...)` with FK to tracks
    - `CREATE TABLE "deals" (...)` with FKs to tracks, stages, users (created_by, internal_owner)
    - `CREATE TABLE "audit_log" (...)` with FK to users
    - `ALTER TABLE "npi_access_log" ADD CONSTRAINT ... FOREIGN KEY ("deal_id") REFERENCES "deals"("id")` (the D-04a FK)
    - At least 3 CHECK constraints (priority on tracks + deals, status on deals, operation on audit_log)

    If any of these are missing, the schema files from Task 1 are wrong — fix them and regenerate (`rm drizzle/migrations/0003*.sql`, revert `_journal.json`, re-run `db:generate`). Do not hand-edit generated SQL.

    Step 3 — Apply the migration: `npm run db:migrate`. On a fresh local Postgres this should exit 0.

    Step 4 — Verify by connecting to the DB (use DATABASE_URL from .env.local) and running:
    ```sql
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
    ```
    Expected output includes: `audit_log`, `deals`, `npi_access_log`, `stages`, `tracks`, `users`.

    Then verify the D-04a FK:
    ```sql
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'npi_access_log'::regclass
      AND contype = 'f';
    ```
    Expected: at least one FK constraint with `deal_id` in its column list targeting `deals`. Use `\d npi_access_log` in psql if needed — look for `Foreign-key constraints:` section mentioning `deal_id`.

    Step 5 — Git-stage the generated SQL + journal + snapshot files (but do not commit — the orchestrator handles committing).
  </action>
  <verify>
    <automated>npm run db:migrate 2>&1 | grep -iE "success|applied|no changes|migration"</automated>
  </verify>
  <done>
    - `drizzle/migrations/0003_*.sql` exists and contains the 4 CREATE TABLE statements and the D-04a ALTER TABLE for npi_access_log.deal_id FK
    - `drizzle/migrations/meta/_journal.json` has entry index 3 (or next sequential) with the new migration's hash
    - Postgres has tables `tracks`, `stages`, `deals`, `audit_log` (verified by `\dt` in psql or equivalent query)
    - `\d npi_access_log` shows a FK constraint on `deal_id` → `deals(id)`
    - `npm run db:migrate` exits 0 (idempotent re-run shows "no changes to apply")
  </done>
  <acceptance_criteria>
    - `ls drizzle/migrations/0003_*.sql` matches exactly one file
    - `grep -E "CREATE TABLE \"tracks\"|CREATE TABLE \"stages\"|CREATE TABLE \"deals\"|CREATE TABLE \"audit_log\"" drizzle/migrations/0003_*.sql` returns 4 matches
    - `grep "deal_id" drizzle/migrations/0003_*.sql | grep -i "REFERENCES \"deals\""` returns a match (D-04a)
    - `grep -E "file_no|main_contact_name|quick_note|funding_at|internal_owner" drizzle/migrations/0003_*.sql` returns 5+ matches
    - `grep -E "before_json|after_json|user_email" drizzle/migrations/0003_*.sql` returns 3+ matches
    - `grep -ci "CHECK" drizzle/migrations/0003_*.sql` returns 3+ (CHECK constraints landed)
    - `npm run db:migrate` exits 0
    - Re-running `npm run db:migrate` exits 0 and reports no pending migrations (idempotent)
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Verify codebase-wide DB-client convention (no stale @/db/client references)</name>
  <files> (verification only — no files written)</files>
  <read_first>
    - lib/db.ts (canonical client)
  </read_first>
  <action>
    Step 1 — Verify that no file in the codebase imports from `@/db/client` (a path that does not exist). Run:
    ```bash
    grep -rn "from \"@/db/client\"" app/ lib/ db/ components/ tests/ 2>/dev/null || true
    grep -rn "from '@/db/client'" app/ lib/ db/ components/ tests/ 2>/dev/null || true
    ```
    BOTH commands must return zero matches. If either returns matches, those files are broken and MUST be fixed to use `import { db } from "@/lib/db"` before the migration-generation in Task 2 runs.

    Step 2 — Document in the plan's summary (01-01-SUMMARY.md) that the DB-client convention is now locked: all future server code (Plans 03, 04, 05, 06 in particular) MUST use `import { db } from "@/lib/db"`. Any future PR that introduces `@/db/client` should be rejected by checker.
  </action>
  <verify>
    <automated>bash -c "count=$(git ls-files '*.ts' '*.tsx' | xargs grep -l 'from \"@/db/client\"' 2>/dev/null | wc -l); count2=$(git ls-files '*.ts' '*.tsx' | xargs grep -l \"from '@/db/client'\" 2>/dev/null | wc -l); total=$((count + count2)); echo \"stale db/client imports: $total\"; [ \"$total\" -eq 0 ]"</automated>
  </verify>
  <done>
    - Zero files in the repo reference `@/db/client` (or `'@/db/client'`). The canonical path is `@/lib/db`.
  </done>
  <acceptance_criteria>
    - `git ls-files "*.ts" "*.tsx" | xargs grep -l "from \"@/db/client\"" 2>/dev/null | wc -l` returns 0
    - `git ls-files "*.ts" "*.tsx" | xargs grep -l "from '@/db/client'" 2>/dev/null | wc -l` returns 0
    - `ls lib/db.ts` succeeds (canonical client present)
  </acceptance_criteria>
</task>

</tasks>

<verification>
Phase-level checks for this plan:
1. `npm test tests/unit/schema-shape.test.ts` exits 0
2. `npm run db:migrate` exits 0 (both first-run and re-run)
3. `npm run build` exits 0 (no TypeScript regressions — existing `@/db/schema` imports still resolve)
4. `npx tsc --noEmit` exits 0 (the `check` import issue is resolved)
5. No files reference `@/db/client` (verified by Task 3)
6. Running `SELECT column_name FROM information_schema.columns WHERE table_name = 'deals' ORDER BY column_name;` returns at least the columns listed in D-02 + D-17 + D-18 + D-19.
</verification>

<success_criteria>
- Old `db/schema.ts` deleted; new split files exist and re-export cleanly via `index.ts`
- Migration 0003 creates tracks + stages + deals + audit_log and adds the npi_access_log.deal_id FK (D-04a)
- Existing Phase 0.5 tests (access, crypto, env) still pass unchanged
- `db/schema/app.ts` implements every Phase 1 schema decision from CONTEXT.md (D-01 shape, D-03 free-text main contact, D-05 audit_log, D-17/D-18 ownership, D-19 status CHECK)
- DB-client convention locked: `lib/db.ts` is canonical; `@/db/client` is forbidden
</success_criteria>

<output>
After completion, create `.planning/phases/01-core-data-model/01-01-SUMMARY.md` documenting:
- The schema split (file moves + re-export topology)
- The new tables' columns and FK wiring (with ASCII table)
- Migration file name + line count + notable SQL (CHECK constraints, FKs)
- Any drizzle-orm API surprises found in node_modules vs training-data expectations (especially the `check` import path)
- **DB-client convention: canonical path is `@/lib/db`; `@/db/client` does NOT exist and MUST NOT be introduced.**
- Decisions applied (D-01, D-04, D-04a, D-05, D-17, D-18, D-19)
</output>
