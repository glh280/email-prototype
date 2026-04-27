---
phase: 02-deal-detail-tasks-stages
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - db/schema/app.ts
  - drizzle/migrations/0005_phase2_tasks_notes_kill.sql
  - drizzle/migrations/meta/_journal.json
  - tests/unit/schema-shape.test.ts
autonomous: true
requirements: [DEAL-06, TASK-01, TASK-02]
requirements_addressed: [DEAL-06, TASK-01, TASK-02]

must_haves:
  truths:
    - "Drizzle schema exports a new `tasks` table from @/db/schema with columns: id, dealId, title, ownerUserId, dueDate, status, isNext, parentTaskId, advancesStageToId, createdBy, createdAt, updatedAt, completedAt"
    - "Drizzle schema exports a new `dealNotes` table from @/db/schema with columns: id, dealId, body, isSystem, createdBy, createdAt"
    - "`deals` table gains nullable `killedAt timestamptz` and `killReason text` columns (closedAt already exists)"
    - "Migration 0005 creates a Postgres PARTIAL UNIQUE INDEX `tasks_one_is_next_per_deal_idx ON tasks (deal_id) WHERE is_next = true`"
    - "CHECK constraint `tasks_status_check` restricts status to ('open','done','skipped')"
    - "FK `tasks.advances_stage_to_id → stages(id)` exists and is nullable (ON DELETE SET NULL)"
    - "FK `tasks.parent_task_id → tasks(id)` exists and is nullable (self-referential, ON DELETE SET NULL)"
    - "`npm run db:migrate` is idempotent (second run exits 0 with no changes)"
    - "`npm test tests/unit/schema-shape.test.ts` passes"
  artifacts:
    - path: "db/schema/app.ts"
      provides: "tasks + dealNotes tables; killedAt/killReason columns on deals"
      exports: ["tasks", "dealNotes", "Task", "NewTask", "DealNote", "NewDealNote"]
    - path: "drizzle/migrations/0005_phase2_tasks_notes_kill.sql"
      provides: "CREATE TABLE tasks, CREATE TABLE deal_notes, ALTER TABLE deals ADD kill_reason/killed_at, CREATE UNIQUE INDEX tasks_one_is_next_per_deal_idx"
      contains: "CREATE UNIQUE INDEX \"tasks_one_is_next_per_deal_idx\""
  key_links:
    - from: "tasks.deal_id"
      to: "deals.id"
      via: "FK constraint (ON DELETE CASCADE — tasks belong to the deal)"
      pattern: "REFERENCES \"deals\""
    - from: "tasks.advances_stage_to_id"
      to: "stages.id"
      via: "FK constraint (nullable, ON DELETE SET NULL)"
      pattern: "REFERENCES \"stages\""
    - from: "deal_notes.deal_id"
      to: "deals.id"
      via: "FK constraint (ON DELETE CASCADE)"
      pattern: "REFERENCES \"deals\""
---

<objective>
Extend the Phase 1 schema with the two new tables P2 needs (`tasks`, `deal_notes`) and add the kill-deal columns (`killed_at`, `kill_reason`) to `deals`. Ship a Drizzle migration (0005) that creates the tables, the CHECK constraints, and — critically — the **partial unique index** that makes the TASK-02 "exactly one `is_next` per deal" invariant a database-level guarantee (belt). The server action in Plan 03 is the suspenders.

Also extend `tests/unit/schema-shape.test.ts` to encode the new table columns verbatim, matching the Phase 1 convention of "schema shape tests fail CI on drift".

Purpose: Creates the data foundation every other P2 plan builds on. Without this migration in place, Plans 02–06 cannot land — tasks table, is_next invariant, and kill columns are prerequisites.
Output: `tasks` + `deal_notes` tables in Postgres, DB-level is_next uniqueness, schema tests encoding the new shape.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-deal-detail-tasks-stages/02-CONTEXT.md
@.planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md

# Phase 1 parent patterns — DO NOT skim; these are the conventions this migration must match.
@db/schema/app.ts
@db/schema/index.ts
@drizzle/migrations/0003_fat_dark_phoenix.sql
@drizzle/migrations/0004_next_file_no_function.sql
@tests/unit/schema-shape.test.ts

<interfaces>
<!-- Existing exports the new tables/types will join. Executor should use these exact names. -->

From db/schema/app.ts (existing P1 exports):
```typescript
export const tracks = pgTable("tracks", {...});
export const stages = pgTable("stages", {...});
export const deals  = pgTable("deals",  {...});
export const auditLog = pgTable("audit_log", {...});
export type Track = typeof tracks.$inferSelect;
export type Stage = typeof stages.$inferSelect;
export type Deal  = typeof deals.$inferSelect;
export type NewDeal = typeof deals.$inferInsert;
```

From db/schema/auth.ts:
```typescript
export const users = pgTable("users", {...});   // tasks.owner_user_id FK → users.id
```

Drizzle primitives already used in this schema file (re-use; don't invent):
`pgTable, text, timestamp, uuid, boolean, integer, jsonb, index, uniqueIndex, check`
and `sql` from "drizzle-orm".
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add tasks + deal_notes tables + kill columns to db/schema/app.ts (schema-shape test RED)</name>
  <files>db/schema/app.ts, tests/unit/schema-shape.test.ts</files>
  <read_first>
    - db/schema/app.ts (the file you're extending — note exact import style, indent, export pattern, CHECK syntax)
    - db/schema/auth.ts (for `users` import example)
    - tests/unit/schema-shape.test.ts (extend — do not rewrite — so existing P1 assertions remain green)
    - .planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md lines 320-410 (Tasks tab — confirms what data the UI will read)
    - .planning/REQUIREMENTS.md lines 52-54 (DEAL-06 kill reason note), lines 93-98 (TASK-01..05 exact spec)
  </read_first>
  <behavior>
    - tasks.status in ('open','done','skipped') — rejects 'invalid' at DB level
    - tasks has exactly one row with is_next=true per deal_id (enforced by partial unique index — tested in Plan 03, but the index must exist now)
    - dealNotes.isSystem boolean defaults to false
    - deals gained killedAt (nullable timestamptz) and killReason (nullable text)
    - schema-shape.test.ts NEW assertions (add to existing describe blocks):
        * tasks table exports expected columns + correct types
        * tasks CHECK constraint present
        * deal_notes table exports expected columns
        * deals table has killedAt + killReason columns
    - RED: new assertions fail before Task 2's migration is generated
  </behavior>
  <action>
    Append these two table definitions to `db/schema/app.ts` (BELOW the existing `auditLog` definition, ABOVE the exported types). Match the P1 style verbatim: 2-space indent, `pgTable("snake_case", { ... }, (t) => [ ... ])`, `notNull()`, `defaultRandom()`, `withTimezone: true` on every timestamp, indices defined in the second arg.

    ```typescript
    /**
     * Tasks (P2 plan 01) — TASK-01..05.
     *
     * Exactly one task per deal may have `is_next = true`; enforced at the DB
     * level by a PARTIAL UNIQUE INDEX `tasks_one_is_next_per_deal_idx` and at
     * the application level by the task server actions (plan 03). The server
     * actions are the happy path — the partial index is the safety net.
     *
     * `advances_stage_to_id` is nullable: when set, completing the task also
     * advances the deal's stage inside the same transaction (TASK-01 auto-
     * advance; plan 03 implements).
     *
     * `parent_task_id` is nullable + self-referential: enables sub-tasks per
     * TASK-01 (UI slot reserved in P2; Carrie can nest tasks in the New Task
     * dialog).
     */
    export const tasks = pgTable(
      "tasks",
      {
        id: uuid("id").defaultRandom().primaryKey(),
        dealId: uuid("deal_id")
          .notNull()
          .references(() => deals.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        ownerUserId: uuid("owner_user_id").references(() => users.id),
        dueDate: timestamp("due_date", { withTimezone: true }),
        status: text("status").notNull().default("open"), // open | done | skipped
        isNext: boolean("is_next").notNull().default(false),
        parentTaskId: uuid("parent_task_id").references((): AnyPgColumn => tasks.id, {
          onDelete: "set null",
        }),
        advancesStageToId: uuid("advances_stage_to_id").references(() => stages.id, {
          onDelete: "set null",
        }),
        createdBy: uuid("created_by")
          .notNull()
          .references(() => users.id),
        createdAt: timestamp("created_at", { withTimezone: true })
          .defaultNow()
          .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
          .defaultNow()
          .notNull(),
        completedAt: timestamp("completed_at", { withTimezone: true }),
      },
      (t) => [
        check(
          "tasks_status_check",
          sql`${t.status} IN ('open', 'done', 'skipped')`,
        ),
        index("tasks_deal_id_idx").on(t.dealId),
        index("tasks_owner_user_id_idx").on(t.ownerUserId),
        index("tasks_due_date_idx").on(t.dueDate),
        // PARTIAL UNIQUE INDEX — the is_next invariant enforcement. Drizzle
        // supports this via uniqueIndex(...).where(sql`...`). See migration
        // 0005 for the generated SQL shape.
        uniqueIndex("tasks_one_is_next_per_deal_idx")
          .on(t.dealId)
          .where(sql`${t.isNext} = true`),
      ],
    );

    /**
     * Deal notes (P2 plan 06) — append-only per UI-SPEC assumption 4.
     *
     * `is_system = true` for notes auto-generated by the app (e.g., the kill
     * reason is mirrored into a system note on kill). User-authored notes
     * always have `is_system = false`.
     *
     * No edit/delete in P2. If Carrie requests edit during calibration, P3
     * adds the affordance.
     */
    export const dealNotes = pgTable(
      "deal_notes",
      {
        id: uuid("id").defaultRandom().primaryKey(),
        dealId: uuid("deal_id")
          .notNull()
          .references(() => deals.id, { onDelete: "cascade" }),
        body: text("body").notNull(),
        isSystem: boolean("is_system").notNull().default(false),
        createdBy: uuid("created_by")
          .notNull()
          .references(() => users.id),
        createdAt: timestamp("created_at", { withTimezone: true })
          .defaultNow()
          .notNull(),
      },
      (t) => [
        index("deal_notes_deal_id_created_at_idx").on(t.dealId, t.createdAt),
      ],
    );
    ```

    Also, inside the existing `deals` table definition, add two new columns (alongside `closedAt`) — do NOT rewrite the whole table, only add the two:

    ```typescript
    killedAt: timestamp("killed_at", { withTimezone: true }),
    killReason: text("kill_reason"),
    ```

    Add to the drizzle-orm import block (top of file): `uniqueIndex` and `AnyPgColumn` (the latter is a type import from `drizzle-orm/pg-core`).

    Append to the exported types block at the bottom:
    ```typescript
    export type Task = typeof tasks.$inferSelect;
    export type NewTask = typeof tasks.$inferInsert;
    export type DealNote = typeof dealNotes.$inferSelect;
    export type NewDealNote = typeof dealNotes.$inferInsert;
    ```

    In `tests/unit/schema-shape.test.ts`, append a new `describe("P2 schema shape — tasks, deal_notes, kill columns", () => {...})` block with these assertions (extend, DO NOT rewrite the file):
    - `tasks` is a pgTable with 13 columns (enumerate them: id, dealId, title, ownerUserId, dueDate, status, isNext, parentTaskId, advancesStageToId, createdBy, createdAt, updatedAt, completedAt)
    - `tasks` status column default is `"open"`
    - `tasks` is_next column default is `false`
    - `dealNotes` is a pgTable with 6 columns (id, dealId, body, isSystem, createdBy, createdAt)
    - `deals` export now includes `killedAt` and `killReason` columns
    - Types `Task`, `NewTask`, `DealNote`, `NewDealNote` are exported (assert via `typeof` at type-check time — Vitest type-only assertions via `expectTypeOf`)

    Commit with message: `test(02-01): add tasks + deal_notes schema-shape assertions (RED)`.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "(error|TS)" || echo "tsc clean"; npx vitest run tests/unit/schema-shape.test.ts 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "export const tasks = pgTable" db/schema/app.ts` returns 1
    - `grep -c "export const dealNotes = pgTable" db/schema/app.ts` returns 1
    - `grep -c "killedAt: timestamp" db/schema/app.ts` returns 1
    - `grep -c "killReason: text" db/schema/app.ts` returns 1
    - `grep -c "tasks_one_is_next_per_deal_idx" db/schema/app.ts` returns 1
    - `grep -c "P2 schema shape" tests/unit/schema-shape.test.ts` returns 1
    - `npx tsc --noEmit` exit code 0
    - Commit exists with subject matching `^test\(02-01\): add tasks \+ deal_notes schema-shape assertions \(RED\)`
  </acceptance_criteria>
  <done>tasks + dealNotes Drizzle tables defined; kill columns added to deals; schema-shape tests reference new tables; tsc clean; test commit landed.</done>
</task>

<task type="auto">
  <name>Task 2: Generate + apply migration 0005 (schema-shape test GREEN)</name>
  <files>drizzle/migrations/0005_phase2_tasks_notes_kill.sql, drizzle/migrations/meta/_journal.json, tests/unit/schema-shape.test.ts</files>
  <read_first>
    - drizzle.config.ts (confirm migrations dir + schema glob)
    - drizzle/migrations/0003_fat_dark_phoenix.sql (the P1 reference — same style expected)
    - drizzle/migrations/0004_next_file_no_function.sql (hand-authored reference)
    - db/schema/app.ts (the file you just modified in Task 1)
  </read_first>
  <action>
    Run `npx drizzle-kit generate` to produce the next migration. Expected drizzle-kit naming: `0005_<adjective>_<name>.sql` — rename manually to `0005_phase2_tasks_notes_kill.sql` and update `drizzle/migrations/meta/_journal.json` accordingly.

    Open the generated SQL and VERIFY it contains:
    1. `CREATE TABLE "tasks" ( ... )` with all 13 columns
    2. `CREATE TABLE "deal_notes" ( ... )` with all 6 columns
    3. `ALTER TABLE "deals" ADD COLUMN "killed_at" timestamp with time zone;`
    4. `ALTER TABLE "deals" ADD COLUMN "kill_reason" text;`
    5. `CREATE UNIQUE INDEX "tasks_one_is_next_per_deal_idx" ON "tasks" ("deal_id") WHERE "tasks"."is_next" = true;`  -- partial unique
    6. FK constraints: `tasks.deal_id → deals(id) ON DELETE CASCADE`, `tasks.advances_stage_to_id → stages(id) ON DELETE SET NULL`, `tasks.parent_task_id → tasks(id) ON DELETE SET NULL`, `tasks.owner_user_id → users(id)`, `tasks.created_by → users(id)`, `deal_notes.deal_id → deals(id) ON DELETE CASCADE`, `deal_notes.created_by → users(id)`
    7. CHECK: `CONSTRAINT "tasks_status_check" CHECK ("tasks"."status" IN ('open', 'done', 'skipped'))`
    8. Non-unique indices: `tasks_deal_id_idx`, `tasks_owner_user_id_idx`, `tasks_due_date_idx`, `deal_notes_deal_id_created_at_idx`

    If drizzle-kit produced anything off-spec (wrong ON DELETE, missing WHERE clause on partial index), HAND-EDIT the SQL to match. Drizzle-kit's partial-index emission is occasionally lossy — validate the `WHERE "tasks"."is_next" = true` is literally present.

    Then run `npm run db:migrate` against the local Postgres. Expected: exit 0, "Applying migration 0005_phase2_tasks_notes_kill". Run a SECOND time to confirm idempotency (exit 0, no-op).

    Verify the partial unique index is enforced at the DB level (manual psql query — this also serves as a smoke test):
    ```bash
    psql $DATABASE_URL -c "INSERT INTO deals (...) RETURNING id;" # capture id
    psql $DATABASE_URL -c "INSERT INTO tasks (deal_id, title, is_next, created_by) VALUES ('<id>', 't1', true, '<user_id>');" # succeeds
    psql $DATABASE_URL -c "INSERT INTO tasks (deal_id, title, is_next, created_by) VALUES ('<id>', 't2', true, '<user_id>');" # MUST fail with duplicate key
    ```
    This is a sanity check, not a committed test (plan 03 owns the automated version).

    Run `npm test tests/unit/schema-shape.test.ts` — all assertions (P1 + new P2) must pass GREEN.

    Commit with message: `feat(02-01): migration 0005 — tasks, deal_notes, kill columns, is_next partial unique (GREEN)`.

    Do NOT touch the seeder — P2 does not add seeded rows.
  </action>
  <verify>
    <automated>npm run db:migrate 2>&1 | tail -5; npm run db:migrate 2>&1 | tail -5; npx vitest run tests/unit/schema-shape.test.ts 2>&1 | tail -10; npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - File `drizzle/migrations/0005_phase2_tasks_notes_kill.sql` exists
    - `grep -c 'CREATE TABLE "tasks"' drizzle/migrations/0005_phase2_tasks_notes_kill.sql` returns 1
    - `grep -c 'CREATE TABLE "deal_notes"' drizzle/migrations/0005_phase2_tasks_notes_kill.sql` returns 1
    - `grep -c 'CREATE UNIQUE INDEX "tasks_one_is_next_per_deal_idx"' drizzle/migrations/0005_phase2_tasks_notes_kill.sql` returns 1
    - `grep -c 'WHERE "tasks"."is_next" = true' drizzle/migrations/0005_phase2_tasks_notes_kill.sql` returns 1
    - `grep -c 'ADD COLUMN "killed_at"' drizzle/migrations/0005_phase2_tasks_notes_kill.sql` returns 1
    - `grep -c 'ADD COLUMN "kill_reason"' drizzle/migrations/0005_phase2_tasks_notes_kill.sql` returns 1
    - `grep -c 'tasks_status_check' drizzle/migrations/0005_phase2_tasks_notes_kill.sql` returns 1
    - `drizzle/migrations/meta/_journal.json` journal lists the new migration entry
    - `npm run db:migrate` exits 0 twice in a row (idempotent)
    - `npx vitest run tests/unit/schema-shape.test.ts` exits 0 with all P1+P2 tests passing
    - `npm run build` exits 0
    - Commit exists matching `^feat\(02-01\): migration 0005`
  </acceptance_criteria>
  <done>Migration 0005 applied to Postgres; partial unique index enforces is_next at DB level; schema-shape tests all green; build clean.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` → clean
- `npm run db:migrate` → idempotent (re-run exits 0 with no-op)
- `npx vitest run tests/unit/schema-shape.test.ts` → all P1 + P2 assertions green
- `npm run build` → exits 0
- Manual DB check: inserting two `is_next=true` tasks on the same deal_id fails with Postgres unique-violation (the partial unique index is the safety net referenced by plan 03)
</verification>

<success_criteria>
- [ ] `tasks` table exists in Postgres with all 13 columns and the 4 FKs
- [ ] `deal_notes` table exists in Postgres with all 6 columns
- [ ] `deals.killed_at` and `deals.kill_reason` columns exist and are nullable
- [ ] Partial unique index `tasks_one_is_next_per_deal_idx ON tasks (deal_id) WHERE is_next = true` enforces TASK-02 at the DB level
- [ ] `db/schema/app.ts` exports `tasks`, `dealNotes`, `Task`, `NewTask`, `DealNote`, `NewDealNote`
- [ ] `tests/unit/schema-shape.test.ts` encodes the new shape and passes
- [ ] Two commits landed: RED (test first) then GREEN (migration + confirm pass)
</success_criteria>

<output>
After completion, create `.planning/phases/02-deal-detail-tasks-stages/02-01-schema-extensions-tasks-table-SUMMARY.md` using the standard SUMMARY template.
</output>
