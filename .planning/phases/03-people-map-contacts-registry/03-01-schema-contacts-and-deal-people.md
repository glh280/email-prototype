---
phase: 03-people-map-contacts-registry
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - db/schema/app.ts
  - drizzle/migrations/0006_contacts_and_deal_people.sql
  - drizzle/migrations/meta/_journal.json
  - drizzle/migrations/meta/0006_snapshot.json
  - tests/unit/schema-contacts.test.ts
autonomous: true
requirements:
  - PEOPLE-01
  - PEOPLE-02

must_haves:
  truths:
    - "contacts table exists with full_name, role_hint, org, email, phone, notes, created_by, timestamps"
    - "deal_people link table exists wiring contacts to deals with a role text column"
    - "deal_people enforces exactly one row per (deal_id, role) via a UNIQUE INDEX so each slot is singular"
    - "deal_people.deal_id CASCADE-deletes with the deal; deal_people.contact_id is SET NULL so contact deletes don't orphan deals"
    - "npm run db:migrate is idempotent (second run exits 0, no schema drift)"
  artifacts:
    - path: db/schema/app.ts
      provides: "contacts + dealPeople PgTable exports with drizzle-orm types"
      contains: "export const contacts"
    - path: db/schema/app.ts
      provides: "dealPeople PgTable export"
      contains: "export const dealPeople"
    - path: drizzle/migrations/0006_contacts_and_deal_people.sql
      provides: "CREATE TABLE contacts + CREATE TABLE deal_people + UNIQUE INDEX on (deal_id, role)"
      contains: "CREATE TABLE \"contacts\""
    - path: tests/unit/schema-contacts.test.ts
      provides: "schema-shape assertions for contacts + dealPeople"
      contains: "describe(\"contacts schema\""
  key_links:
    - from: db/schema/app.ts
      to: db/schema/auth.ts
      via: "contacts.created_by references users.id"
      pattern: "references\\(\\s*\\(\\)\\s*=>\\s*users\\.id"
    - from: db/schema/app.ts
      to: "itself (deals table)"
      via: "dealPeople.deal_id references deals.id ON DELETE CASCADE"
      pattern: "onDelete:\\s*[\"']cascade[\"']"
    - from: drizzle/migrations/0006_contacts_and_deal_people.sql
      to: drizzle/migrations/meta/_journal.json
      via: "journal tag matches renamed migration filename"
      pattern: "\"tag\":\\s*\"0006_contacts_and_deal_people\""
---

<objective>
Add `contacts` (global registry) + `deal_people` (join table with role slot) to the Drizzle schema and land migration `0006_contacts_and_deal_people.sql`. This is the data-model foundation every other P3 plan depends on.

**Purpose:** Satisfy PEOPLE-01 and PEOPLE-02 at the DB layer so downstream plans (Zod schemas, queries, actions, UI) have a stable table shape to build against.

**Output:**
- `contacts` table (12 columns) with `email` UNIQUE WHERE NOT NULL (partial unique) to support autosuggest dedupe
- `deal_people` table (8 columns) with `(deal_id, role)` UNIQUE INDEX enforcing one contact per slot per deal
- New type exports (`Contact`, `NewContact`, `DealPerson`, `NewDealPerson`)
- 1 new migration file + updated `_journal.json` tag
- Schema-shape unit tests
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@db/schema/app.ts
@db/schema/auth.ts
@db/schema/index.ts
@.planning/phases/02-deal-detail-tasks-stages/01-schema-extensions-tasks-table-SUMMARY.md
@drizzle/migrations/0005_phase2_tasks_notes_kill.sql
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend db/schema/app.ts with contacts + dealPeople tables and write schema-shape tests (RED first)</name>
  <files>
    db/schema/app.ts
    tests/unit/schema-contacts.test.ts
  </files>
  <read_first>
    - db/schema/app.ts (current `tasks` and `dealNotes` tables are the structural template — copy their pgTable/check/index/uniqueIndex patterns; note existing `deals` + `users` imports)
    - db/schema/auth.ts (users table shape for FK types)
    - db/schema/index.ts (barrel — re-export continues via `export * from "./app"`, no change required here)
    - tests/unit/ (existing schema tests — mirror their `describe`/`it` cadence and proxy instantiation assertions)
    - .planning/phases/02-deal-detail-tasks-stages/01-schema-extensions-tasks-table-SUMMARY.md (canonical prior pattern: drizzle-kit generate → rename → _journal.json edit; 13-col tasks table; partial unique index; exports `Task`/`NewTask`)
  </read_first>
  <behavior>
    - Test: `contacts` export is a PgTable with columns: id (uuid pk defaultRandom), fullName (text notNull), roleHint (text), org (text), email (text), phone (text), notes (text), createdBy (uuid notNull references users.id), createdAt (timestamp withTimezone defaultNow notNull), updatedAt (timestamp withTimezone defaultNow notNull)
    - Test: `dealPeople` export is a PgTable with columns: id (uuid pk defaultRandom), dealId (uuid notNull references deals.id, onDelete cascade), contactId (uuid references contacts.id, onDelete set null), role (text notNull), createdBy (uuid notNull references users.id), createdAt (timestamp withTimezone defaultNow notNull)
    - Test: contacts has a partial UNIQUE INDEX on lower(email) WHERE email IS NOT NULL (`contacts_email_unique_idx`) — autosuggest dedupe
    - Test: dealPeople has a UNIQUE INDEX on (deal_id, role) (`deal_people_one_per_slot_idx`) — PEOPLE-02 one-slot-per-deal invariant
    - Test: dealPeople has btree indexes on deal_id (for deal-detail People tab query) and on contact_id (for `/contacts` page "on N active deals" counter)
    - Test: type exports `Contact`, `NewContact`, `DealPerson`, `NewDealPerson` are present
  </behavior>
  <action>
    1. Write `tests/unit/schema-contacts.test.ts` FIRST (RED). Mirror the assertion style in existing schema tests — pull the column list via `Object.keys(contacts)` and assert the full set: `['id','fullName','roleHint','org','email','phone','notes','createdBy','createdAt','updatedAt']`. Then assert `Object.keys(dealPeople)` equals `['id','dealId','contactId','role','createdBy','createdAt']`. Also assert `typeof (contacts as any).email === 'object'` (proxy). Run: `npm test -- schema-contacts` — expect RED (module has no such exports yet).

    2. Extend `db/schema/app.ts`:

       ```typescript
       export const contacts = pgTable(
         "contacts",
         {
           id: uuid("id").defaultRandom().primaryKey(),
           fullName: text("full_name").notNull(),
           roleHint: text("role_hint"),
           org: text("org"),
           email: text("email"),
           phone: text("phone"),
           notes: text("notes"),
           createdBy: uuid("created_by").notNull().references(() => users.id),
           createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
           updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
         },
         (t) => [
           // Partial unique — dedupe autosuggest matches by email while allowing many null-email contacts
           uniqueIndex("contacts_email_unique_idx")
             .on(sql`lower(${t.email})`)
             .where(sql`${t.email} IS NOT NULL`),
           index("contacts_full_name_idx").on(t.fullName),
         ],
       );

       export const dealPeople = pgTable(
         "deal_people",
         {
           id: uuid("id").defaultRandom().primaryKey(),
           dealId: uuid("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
           // SET NULL so deleting a contact never cascade-drops deal_people rows (preserves audit
           // history of "a contact once occupied this slot"); role can carry a free-text fallback
           // in the future if needed.
           contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
           role: text("role").notNull(),
           createdBy: uuid("created_by").notNull().references(() => users.id),
           createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
         },
         (t) => [
           // PEOPLE-02 invariant: exactly one deal_people row per (deal_id, role).
           uniqueIndex("deal_people_one_per_slot_idx").on(t.dealId, t.role),
           index("deal_people_deal_id_idx").on(t.dealId),
           index("deal_people_contact_id_idx").on(t.contactId),
         ],
       );

       export type Contact = typeof contacts.$inferSelect;
       export type NewContact = typeof contacts.$inferInsert;
       export type DealPerson = typeof dealPeople.$inferSelect;
       export type NewDealPerson = typeof dealPeople.$inferInsert;
       ```

    3. Re-run `npm test -- schema-contacts`. Expect GREEN. Run full `npm test` to confirm no regressions (prior baseline is 170/170). Run `npx tsc --noEmit` to confirm types clean.

    4. Do NOT write the migration SQL by hand. Migration generation is Task 2.
  </action>
  <verify>
    <automated>npm test -- schema-contacts 2>&1 | grep -E "passed|failed" &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export const contacts" db/schema/app.ts` returns a match
    - `grep -n "export const dealPeople" db/schema/app.ts` returns a match
    - `grep -n "deal_people_one_per_slot_idx" db/schema/app.ts` returns a match
    - `grep -n "contacts_email_unique_idx" db/schema/app.ts` returns a match
    - `grep -n "onDelete: \"cascade\"" db/schema/app.ts | grep dealId` returns a match (dealPeople.dealId cascade)
    - `grep -n "onDelete: \"set null\"" db/schema/app.ts | grep contactId` returns a match
    - `grep -n "export type Contact" db/schema/app.ts` returns a match
    - `grep -n "export type DealPerson" db/schema/app.ts` returns a match
    - `tests/unit/schema-contacts.test.ts` exists and passes (new describe block present)
    - Full `npm test` green (baseline +N new, no regressions)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Contacts + dealPeople schema shapes exported; schema-shape tests green; types compile; no other plan's tests broken.</done>
</task>

<task type="auto">
  <name>Task 2: Generate migration 0006 via drizzle-kit, rename for readability, update _journal.json, verify idempotent db:migrate</name>
  <files>
    drizzle/migrations/0006_contacts_and_deal_people.sql
    drizzle/migrations/meta/_journal.json
    drizzle/migrations/meta/0006_snapshot.json
  </files>
  <read_first>
    - drizzle/migrations/0005_phase2_tasks_notes_kill.sql (exact shape of the prior renamed migration — same approach applies: generate, rename, edit journal tag)
    - drizzle/migrations/meta/_journal.json (entry format for 0005 — tag, when, version, breakpoints — copy structure)
    - .planning/phases/02-deal-detail-tasks-stages/01-schema-extensions-tasks-table-SUMMARY.md §"Migration 0005 rename" — documented pattern
    - db/schema/app.ts (after Task 1 — the source the generator reads)
  </read_first>
  <action>
    1. Run `npx drizzle-kit generate`. It will emit a new migration file with an auto-generated tag (e.g., `0006_XXX_YYY.sql`) plus `0006_snapshot.json`.

    2. Rename the generated `.sql` file to `0006_contacts_and_deal_people.sql`. Open `drizzle/migrations/meta/_journal.json` and change the new entry's `tag` field from the auto-tag (e.g., `"0006_XXX_YYY"`) to `"0006_contacts_and_deal_people"`. Do NOT touch the `idx` or `when` numeric fields. Do NOT rename `0006_snapshot.json`.

    3. Inspect the generated SQL. It MUST contain:
       - `CREATE TABLE "contacts" (...)` with the 10 columns from Task 1
       - `CREATE TABLE "deal_people" (...)` with the 6 columns from Task 1
       - `CREATE UNIQUE INDEX "contacts_email_unique_idx" ON "contacts" (lower("email")) WHERE "email" IS NOT NULL;`
       - `CREATE UNIQUE INDEX "deal_people_one_per_slot_idx" ON "deal_people" ("deal_id","role");`
       - `CREATE INDEX "contacts_full_name_idx"`, `CREATE INDEX "deal_people_deal_id_idx"`, `CREATE INDEX "deal_people_contact_id_idx"`
       - ALTER TABLE statements adding FKs to `users(id)` and `deals(id)` and `contacts(id)` with correct ON DELETE clauses (cascade for dealPeople.dealId, set null for dealPeople.contactId, no action for created_by refs)

       If drizzle-kit emits `CREATE UNIQUE INDEX` without the partial `WHERE email IS NOT NULL` clause (drizzle sometimes emits partial indexes under a trailing `WHERE` fragment — inspect carefully), hand-edit the SQL to include the partial clause AND update `0006_snapshot.json` to match, OR redeclare the index as `.where(sql\`${t.email} IS NOT NULL\`)` and regenerate. The `.where()` already in Task 1's schema should cause drizzle-kit to emit the clause — verify.

    4. Run `npm run db:migrate` locally (against docker-compose Postgres). Expect exit 0, with migration `0006_contacts_and_deal_people` logged. Run it a second time — expect exit 0 with "No migrations to apply" (idempotent, per `package.json prestart` contract from P0.5.1).

    5. Smoke-test the invariants via `psql` (or docker exec):
       ```
       docker compose exec -T postgres psql -U postgres -d npr_dashboard -c "\d contacts"
       docker compose exec -T postgres psql -U postgres -d npr_dashboard -c "\d deal_people"
       ```
       Confirm both tables exist and indexes are listed.

    6. Insert a smoke row manually to verify the `(deal_id, role)` unique invariant rejects duplicates:
       ```
       docker compose exec -T postgres psql -U postgres -d npr_dashboard -c "
         -- Pick any existing deal + user; this SQL is smoke only, it gets rolled back
         BEGIN;
         INSERT INTO contacts (full_name, email, created_by) SELECT 'Smoke', 'smoke@test.com', id FROM users LIMIT 1;
         INSERT INTO deal_people (deal_id, contact_id, role, created_by)
           SELECT d.id, c.id, 'main_contact', d.created_by FROM deals d, contacts c WHERE c.email='smoke@test.com' LIMIT 1;
         INSERT INTO deal_people (deal_id, contact_id, role, created_by)
           SELECT d.id, c.id, 'main_contact', d.created_by FROM deals d, contacts c WHERE c.email='smoke@test.com' LIMIT 1;
         ROLLBACK;
       "
       ```
       Expect the SECOND INSERT to fail with `duplicate key value violates unique constraint "deal_people_one_per_slot_idx"`. If it does NOT fail, the partial index SQL is wrong — fix and regenerate.

    7. Run `npx tsc --noEmit` + `npm run build` clean. No app code changes yet, so these are smoke-level checks for import drift.
  </action>
  <verify>
    <automated>npm run db:migrate &amp;&amp; npm run db:migrate &amp;&amp; npx tsc --noEmit &amp;&amp; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - File `drizzle/migrations/0006_contacts_and_deal_people.sql` exists
    - File `drizzle/migrations/meta/0006_snapshot.json` exists
    - `grep '"tag": "0006_contacts_and_deal_people"' drizzle/migrations/meta/_journal.json` returns a match
    - Migration SQL contains `CREATE TABLE "contacts"` and `CREATE TABLE "deal_people"`
    - Migration SQL contains `CREATE UNIQUE INDEX "deal_people_one_per_slot_idx" ON "deal_people"`
    - Migration SQL contains `WHERE "email" IS NOT NULL` in the contacts email unique index (partial unique)
    - `npm run db:migrate` exits 0 on first run AND on second run (idempotent)
    - `npm run build` exits 0 (no import drift broke anything)
    - `npx tsc --noEmit` exits 0
    - Smoke-test in psql: two sequential `INSERT INTO deal_people (..., role='main_contact', ...)` for the same deal → second fails with `deal_people_one_per_slot_idx` unique violation (recorded in plan SUMMARY; NOT a test file — this is a one-off verification)
  </acceptance_criteria>
  <done>Migration 0006 exists with readable filename, matches schema, idempotent on re-run, partial unique on contacts.email is enforced, one-slot-per-deal unique constraint rejects duplicates at the DB level.</done>
</task>

</tasks>

<verification>
- `npm test` — full suite green (baseline 170 + new schema-shape assertions)
- `npx tsc --noEmit` clean
- `npm run build` clean
- `npm run db:migrate` idempotent (two consecutive runs both exit 0)
- `db/schema/app.ts` exports `contacts`, `dealPeople`, `Contact`, `NewContact`, `DealPerson`, `NewDealPerson`
- Migration 0006 contains both CREATE TABLE statements + the `deal_people_one_per_slot_idx` unique constraint
- Partial-unique on contacts.email is enforced
</verification>

<success_criteria>
PEOPLE-01 and PEOPLE-02 data-model substrate is live at the DB layer. Every downstream P3 plan (Zod schemas, queries, server actions, UI) can now import `contacts` / `dealPeople` from `@/db/schema` and reason about stable shapes.
</success_criteria>

<output>
After completion, create `.planning/phases/03-people-map-contacts-registry/03-01-schema-contacts-and-deal-people-SUMMARY.md` per the summary template.
</output>
