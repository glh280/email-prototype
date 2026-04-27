---
phase: 03-people-map-contacts-registry
plan: 07
type: execute
wave: 5
depends_on:
  - 03-people-map-contacts-registry/01
  - 03-people-map-contacts-registry/04
  - 03-people-map-contacts-registry/06
files_modified:
  - drizzle/migrations/0007_backfill_deal_main_contact.sql
  - drizzle/migrations/meta/_journal.json
  - drizzle/migrations/meta/0007_snapshot.json
  - app/deal/new/actions.ts
  - app/deal/[id]/_components/overview-card.tsx
  - tests/integration/backfill-migration.test.ts
  - tests/integration/create-deal-people-dual-write.test.ts
autonomous: true
requirements:
  - PEOPLE-01
  - PEOPLE-02

must_haves:
  truths:
    - "Migration 0007 runs idempotently and creates a contacts row + deal_people row (role='main_contact') for every existing deal whose main_contact_email is non-null"
    - "Re-running migration 0007 produces zero new rows (idempotent via ON CONFLICT on contacts.email unique and deal_people (deal_id, role) unique)"
    - "The existing deals.main_contact_name + main_contact_email columns are PRESERVED (not dropped) — backward compat during P3/P4 transition; drop scheduled for P10 calibration in a separate migration"
    - "createDeal Server Action now ALSO inserts a deal_people row (role='main_contact') when mainContactEmail is provided — future deals stay in sync with the deal_people model without the text columns"
    - "The Overview tab's Main Contact display reads from the deal_people row (joined to contacts) — not from the deals.main_contact_* text columns"
    - "Rollback invariant: if deal_people INSERT fails during createDeal, the deal row is rolled back (single db.transaction — the existing tx is extended, not a second tx)"
  artifacts:
    - path: drizzle/migrations/0007_backfill_deal_main_contact.sql
      provides: "Idempotent SQL backfill: INSERT contacts from deals.main_contact_*; INSERT deal_people rows"
      contains: "INSERT INTO \"deal_people\""
    - path: app/deal/new/actions.ts
      provides: "Extended createDeal with dual-write to deal_people when mainContactEmail is set"
      contains: "deal_people"
    - path: tests/integration/backfill-migration.test.ts
      provides: "Proves migration creates the right rows AND is idempotent on re-run"
      contains: "idempotent"
    - path: tests/integration/create-deal-people-dual-write.test.ts
      provides: "Proves createDeal writes deal_people row + contact row when main_contact_email supplied"
      contains: "main_contact"
  key_links:
    - from: drizzle/migrations/0007_backfill_deal_main_contact.sql
      to: drizzle/migrations/meta/_journal.json
      via: "journal tag matches renamed migration filename"
      pattern: "\"tag\":\\s*\"0007_backfill_deal_main_contact\""
    - from: app/deal/new/actions.ts
      to: app/deal/[id]/actions/people.ts
      via: "createDeal no longer calls upsertDealPerson directly (cross-tx would break atomicity); instead inserts deal_people inline within the SAME db.transaction that creates the deal"
      pattern: "tx\\.insert\\(dealPeople\\)"
    - from: app/deal/[id]/_components/overview-card.tsx
      to: lib/deal-people-query.ts
      via: "Main Contact display reads from queryDealPeopleForDeal output (or the main_contact row passed into the overview prop)"
      pattern: "main_contact|mainContact"
---

<objective>
Migrate legacy Phase 1 data (deals.main_contact_name + main_contact_email TEXT columns) to the new contacts + deal_people model introduced in Plans 01-04. Extend createDeal to dual-write going forward. Update the Overview Main Contact display to read from deal_people.

**Purpose:** Close D-03 — the legacy text columns were a pragmatic P1 shortcut; P3 makes contacts first-class. Migration 0007 backfills; createDeal extension keeps new deals aligned; UI read-path switches to the authoritative source.

**Why keep the legacy columns (grace period):** Dropping `deals.main_contact_name/email` now would:
1. Invalidate the P1 new-deal form state-shape in CONTEXT unless simultaneously updated
2. Lose data if the backfill misses an edge case (we'd have no rollback)
3. Block P10 calibration from retroactively fixing missed migrations by re-running against the still-present source data

Drop is explicitly a P10 calibration-week migration once Carrie has validated every existing deal's main_contact row looks right.

**Output:**
- `drizzle/migrations/0007_backfill_deal_main_contact.sql` (hand-authored — drizzle-kit won't generate a data backfill)
- Journal + snapshot updates
- `createDeal` Server Action extended (dual-write within existing transaction)
- Overview tab Main Contact section reads from deal_people.main_contact (falls back to deals.main_contact_name if no deal_people row exists — defensive during grace period)
- Integration test proving migration applies + is idempotent
- Integration test proving createDeal dual-write
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@drizzle/migrations/0005_phase2_tasks_notes_kill.sql
@drizzle/migrations/0006_contacts_and_deal_people.sql
@drizzle/migrations/meta/_journal.json
@db/schema/app.ts
@app/deal/new/actions.ts
@app/deal/[id]/_components/overview-tab.tsx
@app/deal/[id]/_components/overview-card.tsx
@lib/contact-schema.ts
@lib/audit.ts
@lib/deal-people-query.ts
@app/deal/[id]/actions/people.ts
@.planning/phases/02-deal-detail-tasks-stages/01-schema-extensions-tasks-table-SUMMARY.md

<interfaces>
From db/schema/app.ts (Plan 01 post-state):
```typescript
export const contacts: PgTable;      // id, fullName, roleHint, org, email, phone, notes, createdBy, createdAt, updatedAt
export const dealPeople: PgTable;    // id, dealId, contactId (nullable), role, createdBy, createdAt
// Unique indexes: contacts (lower(email) WHERE email IS NOT NULL), deal_people (dealId, role)
```

From db/schema/app.ts (pre-existing P1):
```typescript
export const deals: PgTable;
// Relevant columns: id, createdBy, mainContactName (text, nullable), mainContactEmail (text, nullable)
```

From app/deal/new/actions.ts (P1 — EXTEND, don't rewrite):
```typescript
// Existing createDeal runs inside db.transaction and INSERTs a deals row + writes audit.
// Task 2 of this plan EXTENDS the transaction body to ALSO upsert a contacts row
// (by email) + INSERT a deal_people row with role='main_contact'. All in the same tx.
```

D-03 (from .planning/STATE.md §Accumulated Context — paraphrased):
"deals.main_contact_name + main_contact_email are P1 convenience text columns; P3's deal_people model supersedes them. Migrate data forward; keep columns during grace period; drop in P10."

D-04: @/lib/db only. D-05: every mutation in db.transaction with audit.
</interfaces>

<idempotency_design>
The SQL backfill must be safe to re-run. Two unique constraints already shipped in migration 0006:
1. `contacts_email_unique_idx` — partial unique on lower(email) WHERE email IS NOT NULL
2. `deal_people_one_per_slot_idx` — unique on (deal_id, role)

Migration 0007 uses these as the idempotency keys:

```sql
-- 1. Insert contacts (one per distinct email in deals.main_contact_email).
-- ON CONFLICT (lower(email)) DO NOTHING — the partial unique index handles dedupe.
INSERT INTO "contacts" (full_name, email, role_hint, created_by)
SELECT
  -- Use name if present, else a placeholder derived from email so contacts.full_name NOT NULL holds
  COALESCE(NULLIF(TRIM(d.main_contact_name), ''), split_part(d.main_contact_email, '@', 1)),
  lower(TRIM(d.main_contact_email)),
  'main_contact (backfill)',
  -- Use deal.created_by as the creator; contacts.created_by NOT NULL requires a user
  d.created_by
FROM (
  SELECT DISTINCT lower(TRIM(main_contact_email)) AS email_key,
         MIN(main_contact_name)                   AS main_contact_name,
         MIN(main_contact_email)                  AS main_contact_email,
         MIN(created_by)                          AS created_by
  FROM "deals"
  WHERE main_contact_email IS NOT NULL
    AND TRIM(main_contact_email) != ''
  GROUP BY lower(TRIM(main_contact_email))
) d
ON CONFLICT DO NOTHING;

-- 2. Insert deal_people rows (one per deal with a main_contact_email).
-- ON CONFLICT (deal_id, role) DO NOTHING — re-runs skip existing.
INSERT INTO "deal_people" (deal_id, contact_id, role, created_by)
SELECT
  d.id,
  c.id,
  'main_contact',
  d.created_by
FROM "deals" d
JOIN "contacts" c ON lower(c.email) = lower(TRIM(d.main_contact_email))
WHERE d.main_contact_email IS NOT NULL
  AND TRIM(d.main_contact_email) != ''
ON CONFLICT ON CONSTRAINT "deal_people_one_per_slot_idx" DO NOTHING;

-- 3. Inline comment reminding the drop is a P10 calibration-week migration.
COMMENT ON COLUMN "deals"."main_contact_name" IS 'LEGACY P1 column — superseded by deal_people.role=main_contact. Scheduled for drop in P10 calibration (separate migration).';
COMMENT ON COLUMN "deals"."main_contact_email" IS 'LEGACY P1 column — superseded by deal_people.role=main_contact. Scheduled for drop in P10 calibration (separate migration).';
```

**NOTE:** The `ON CONFLICT ON CONSTRAINT "deal_people_one_per_slot_idx"` syntax uses the named unique index from migration 0006. If Postgres requires `ON CONFLICT (deal_id, role)` form instead (unique index NOT declared as a constraint — depends on how drizzle emitted it in 0006), adjust accordingly. Smoke-test both re-runs.

**Audit trail consideration:** This is a DATA migration. audit_log rows are NOT written for the backfill itself — these mutations happen below the Server Action layer. That's a deliberate D-05 exception for schema migrations: the migration file itself is the audit artifact (committed to git, version-tagged). Record this deliberately in the plan SUMMARY so a future reviewer does not flag the missing audit rows as a regression.
</idempotency_design>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author migration 0007 SQL + update _journal.json; add integration test proving apply + idempotency.</name>
  <files>
    drizzle/migrations/0007_backfill_deal_main_contact.sql
    drizzle/migrations/meta/_journal.json
    drizzle/migrations/meta/0007_snapshot.json
    tests/integration/backfill-migration.test.ts
  </files>
  <read_first>
    - drizzle/migrations/0006_contacts_and_deal_people.sql (to verify the exact unique-index syntax shipped — `ON CONFLICT` target form depends on whether the index is declared as UNIQUE CONSTRAINT vs UNIQUE INDEX)
    - drizzle/migrations/meta/_journal.json (entry format: idx, when, tag, breakpoints, version — copy structure for the new entry)
    - .planning/phases/02-deal-detail-tasks-stages/01-schema-extensions-tasks-table-SUMMARY.md (canonical "generate → rename → edit journal tag" pattern — Plan 07's twist: generate will emit an empty file since no schema changes; hand-author the data backfill SQL)
    - db/schema/app.ts (confirm no schema change is needed — 0007 is pure data)
    - tests/integration/ (harness, DB lifecycle — we seed, run migrator, assert)
  </read_first>
  <action>
    1. **Preferred path — run drizzle-kit to get an empty migration shell:** `npx drizzle-kit generate`. If drizzle-kit sees no schema diff, it may emit no migration file OR an empty one. If no file is emitted, manually create `0007_backfill_deal_main_contact.sql` with the SQL below and manually update _journal.json and 0007_snapshot.json. (Snapshot file: copy 0006_snapshot.json verbatim and rename — since no schema change, the drizzle state is identical; drizzle-kit's prestart check compares schema to snapshot, not SQL content.)

       **If a file IS emitted**, rename to `0007_backfill_deal_main_contact.sql`, replace its empty body with the data-migration SQL, and update _journal.json tag.

    2. Write the full SQL body into `drizzle/migrations/0007_backfill_deal_main_contact.sql`:

       ```sql
       -- Migration 0007: Backfill deal_people rows from legacy deals.main_contact_* columns.
       --
       -- Phase 3 closes D-03: the P1 convenience text columns (deals.main_contact_name +
       -- main_contact_email) are superseded by the contacts registry + deal_people model
       -- from Plan 01. This migration is IDEMPOTENT — the unique constraints on
       -- contacts.email (partial lower(email) WHERE email IS NOT NULL) and on
       -- deal_people (deal_id, role) guarantee re-runs are no-ops.
       --
       -- LEGACY COLUMNS ARE PRESERVED. They will be dropped in a separate P10
       -- calibration-week migration once Carrie has validated the backfill.

       -- STEP 1: Create one contact per distinct main_contact_email in deals.
       INSERT INTO "contacts" (full_name, email, role_hint, created_by)
       SELECT
         COALESCE(NULLIF(TRIM(d.main_contact_name), ''), split_part(d.main_contact_email, '@', 1)) AS full_name,
         lower(TRIM(d.main_contact_email))                                                         AS email,
         'main_contact (backfill)'                                                                  AS role_hint,
         d.created_by                                                                               AS created_by
       FROM (
         SELECT
           lower(TRIM(main_contact_email)) AS email_key,
           MIN(main_contact_name)          AS main_contact_name,
           MIN(main_contact_email)         AS main_contact_email,
           MIN(created_by)                 AS created_by
         FROM "deals"
         WHERE main_contact_email IS NOT NULL
           AND TRIM(main_contact_email) != ''
         GROUP BY lower(TRIM(main_contact_email))
       ) d
       ON CONFLICT DO NOTHING;

       -- STEP 2: Link each deal to its main_contact via deal_people.
       -- The (deal_id, role) unique constraint makes this idempotent on re-run.
       INSERT INTO "deal_people" (deal_id, contact_id, role, created_by)
       SELECT
         d.id,
         c.id,
         'main_contact',
         d.created_by
       FROM "deals" d
       INNER JOIN "contacts" c
         ON lower(c.email) = lower(TRIM(d.main_contact_email))
       WHERE d.main_contact_email IS NOT NULL
         AND TRIM(d.main_contact_email) != ''
       ON CONFLICT DO NOTHING;

       -- STEP 3: Inline column comments to flag the legacy status for future maintainers.
       COMMENT ON COLUMN "deals"."main_contact_name" IS 'LEGACY P1 column — superseded by deal_people.role=main_contact. Scheduled for drop in P10 calibration (separate migration).';
       COMMENT ON COLUMN "deals"."main_contact_email" IS 'LEGACY P1 column — superseded by deal_people.role=main_contact. Scheduled for drop in P10 calibration (separate migration).';
       ```

    3. Update `drizzle/migrations/meta/_journal.json` — append a new entry matching 0006's shape, with `tag: "0007_backfill_deal_main_contact"` and `idx: 7`.

    4. Write `tests/integration/backfill-migration.test.ts`:

       ```typescript
       // Integration test harness: this test resets DB to 0005 state, seeds test data
       // against the P1 columns, then runs migrator up through 0007 and asserts.
       // If the project's harness only supports "run all migrations + seed + test",
       // then the test instead: drops all contacts + deal_people rows, re-runs 0007
       // via a direct `psql -f drizzle/migrations/0007_backfill_deal_main_contact.sql`
       // (or via drizzle's migrator which tracks completion and WILL skip on re-run —
       // so drop the row in drizzle_migrations first, then re-run, then re-run AGAIN
       // for the idempotency assertion). Executor picks harness-appropriate path and
       // records in SUMMARY.
       ```

       Assertions (>=7):
       - Pre-migration state: insert 3 deals with main_contact_email set (two sharing an email, one with a distinct email) + 1 deal with main_contact_email = NULL + 1 deal with main_contact_email = '  ' (whitespace).
       - Run migration. Assert: `SELECT COUNT(*) FROM contacts WHERE role_hint = 'main_contact (backfill)'` = 2 (one per distinct email, whitespace-only row excluded).
       - Assert: `SELECT COUNT(*) FROM deal_people WHERE role = 'main_contact'` = 3 (one per deal with a real email).
       - Assert the deal with a NULL main_contact_email has NO deal_people row for role=main_contact.
       - Assert the whitespace-only deal has NO row.
       - Re-run the migration (simulate by executing the file body against the DB twice, OR by deleting the drizzle_migrations row + re-running, OR by running the SQL inline in a test-only helper). Assert counts UNCHANGED (idempotency).
       - Assert `deals.main_contact_name` and `deals.main_contact_email` columns STILL EXIST (i.e., not dropped) — `SELECT column_name FROM information_schema.columns WHERE table_name='deals' AND column_name IN ('main_contact_name','main_contact_email')` returns 2 rows.

       Run `npm test -- backfill-migration`. Expect GREEN.

    5. `npm run db:migrate` — runs idempotently. `npm run db:migrate` AGAIN — exits 0 with "no migrations to apply". Confirm via psql smoke:

       ```
       docker compose exec -T postgres psql -U postgres -d npr_dashboard -c "SELECT COUNT(*) FROM deal_people WHERE role='main_contact';"
       docker compose exec -T postgres psql -U postgres -d npr_dashboard -c "SELECT COUNT(*) FROM contacts WHERE role_hint='main_contact (backfill)';"
       ```

    6. `npx tsc --noEmit` + `npm run build`. Clean.
  </action>
  <verify>
    <automated>npm test -- backfill-migration &amp;&amp; npm run db:migrate &amp;&amp; npm run db:migrate &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `drizzle/migrations/0007_backfill_deal_main_contact.sql` exists
    - `drizzle/migrations/meta/0007_snapshot.json` exists
    - `grep '"tag": "0007_backfill_deal_main_contact"' drizzle/migrations/meta/_journal.json` returns a match
    - Migration SQL contains `INSERT INTO "contacts"` and `INSERT INTO "deal_people"`
    - Migration SQL contains `ON CONFLICT DO NOTHING` at least twice (both INSERTs idempotent)
    - Migration SQL contains `COMMENT ON COLUMN "deals"."main_contact_name"` and `COMMENT ON COLUMN "deals"."main_contact_email"` (grace-period markers)
    - `tests/integration/backfill-migration.test.ts` passes with >= 7 assertions including the idempotency and column-still-exists checks
    - `npm run db:migrate` twice in a row both exit 0
    - `npm run build` exits 0
    - Plan SUMMARY documents the D-05 exception rationale (migration is the audit artifact — no audit_log rows written by backfill)
  </acceptance_criteria>
  <done>Legacy main_contact data migrated to contacts + deal_people; idempotent; legacy columns preserved with in-DB grace-period comments.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend createDeal Server Action with dual-write (tests first); update Overview Main Contact display to read from deal_people.</name>
  <files>
    app/deal/new/actions.ts
    app/deal/[id]/_components/overview-card.tsx
    tests/integration/create-deal-people-dual-write.test.ts
  </files>
  <read_first>
    - app/deal/new/actions.ts (current createDeal — single tx with INSERT deals + writeAuditLog; we'll add INSERT contacts (upsert by email) + INSERT deal_people WITHIN the same tx — NOT a cross-module call to upsertDealPerson because that would open a second tx and break atomicity)
    - .planning/phases/01-core-data-model/05-new-deal-form-SUMMARY.md §Test 7 (rollback invariant pattern — vi.doMock('@/lib/audit') → throw → assert no deal row; we extend with an equivalent assertion: no contact row and no deal_people row either)
    - app/deal/[id]/_components/overview-tab.tsx (current Main Contact display — if it exists as a field in the Property card or inline, it currently reads deal.mainContactName + deal.mainContactEmail)
    - app/deal/[id]/_components/overview-card.tsx (shadcn-style card render — find where mainContactName/Email are rendered; switch to reading the deal_people.main_contact join instead)
    - lib/deals-query.ts::DealDetail (the shape passed to OverviewCard — if it doesn't include main_contact join fields, add a read of the main_contact slot via queryDealPeopleForDeal or a direct join in queryDealById)
  </read_first>
  <action>
    1. Write `tests/integration/create-deal-people-dual-write.test.ts` FIRST (RED). Assertions (>=6):
       - createDeal happy path with main_contact_email provided → returns ok; assert:
         * `deals` has 1 new row
         * `contacts` has 1 new row with matching email
         * `deal_people` has 1 new row {dealId, role='main_contact', contactId: <the new contact's id>}
         * `audit_log` has 2 new rows (deals:create, deal_people:create) OR 3 (if we also emit contacts:create — plan author's call; follow the Plan 04 pattern which writes contacts:create when the free-text lender branch runs, so create it here too for consistency)
       - createDeal with NO main_contact_email → still ok; assert NO contacts row, NO deal_people row.
       - createDeal when main_contact_email already matches an existing contact → dedupe; assert contacts row count UNCHANGED, deal_people row still created pointing to the existing contact.
       - Rollback invariant: `vi.doMock('@/lib/audit')` throw → assert deals row count unchanged AND contacts row count unchanged AND deal_people row count unchanged (all three rolled back atomically).
       - createDeal with mainContactEmail='   ' (whitespace) → treated as absent; no contact, no deal_people.
       - createDeal with mainContactName but no email → no contact, no deal_people (email is the dedupe key; without it we'd pollute contacts with untracked names).

       Run `npm test -- create-deal-people-dual-write`. Expect RED (dual-write not yet implemented).

    2. Extend `app/deal/new/actions.ts` — INSIDE the existing `db.transaction(async (tx) => { ... })` block, AFTER the `deals` INSERT + audit write, BEFORE returning:

       ```typescript
       // P3 Plan 07 — dual-write deal_people for main_contact (if email provided).
       // Keeps new deals aligned with the deal_people model without forcing the
       // user to pick a slot on the New Deal form. Email is the dedupe key;
       // without it we skip (name-only would pollute contacts).
       const emailCandidate = (input.mainContactEmail ?? "").trim();
       if (emailCandidate.length > 0) {
         // Upsert contact by lower(email) — the partial unique index guarantees one row per email.
         const [contactRow] = await tx
           .insert(contacts)
           .values({
             fullName: (input.mainContactName ?? emailCandidate.split("@")[0]).trim() || emailCandidate.split("@")[0],
             email: emailCandidate.toLowerCase(),
             roleHint: "main_contact",
             createdBy: user.id,
           })
           .onConflictDoUpdate({
             target: sql`lower(${contacts.email})`,
             set: { updatedAt: new Date() }, // no-op update so we get a RETURNING row even on conflict
           })
           .returning();

         // Audit the contact create (operation='create' may be inaccurate for upsert-conflict case;
         // we emit 'create' uniformly for simplicity — the source marker disambiguates in the log).
         await writeAuditLog(tx, {
           tableName: "contacts",
           recordId: contactRow.id,
           operation: "create",
           beforeJson: null,
           afterJson: { ...contactRow, source: "contact_create_via_new_deal" },
           user: { id: user.id, email: user.email },
         });

         // Link the deal via deal_people. Unique (deal_id, role) guarantees one row.
         const [dealPersonRow] = await tx
           .insert(dealPeople)
           .values({
             dealId: newDeal.id,
             contactId: contactRow.id,
             role: "main_contact",
             createdBy: user.id,
           })
           .returning();

         await writeAuditLog(tx, {
           tableName: "deal_people",
           recordId: dealPersonRow.id,
           operation: "create",
           beforeJson: null,
           afterJson: { ...dealPersonRow, source: "deal_people_upsert_via_new_deal" },
           user: { id: user.id, email: user.email },
         });
       }
       ```

       Add imports at the top: `import { contacts, dealPeople } from "@/db/schema";` + `import { sql } from "drizzle-orm";`

       **New audit source vocab added (extend Plan 04's lexicon):**
       - `contact_create_via_new_deal` — contact upserted during createDeal flow
       - `deal_people_upsert_via_new_deal` — deal_people row created during createDeal flow

       These are distinct from Plan 04's `contact_create` / `deal_people_upsert` markers so audit queries can differentiate "user explicitly created contact via /contacts" vs "contact was auto-created as a side effect of new-deal submission." Document in plan SUMMARY.

    3. Update Overview Main Contact display. Read the current `overview-tab.tsx` and `overview-card.tsx` to locate where `mainContactName`/`mainContactEmail` are rendered. The change:

       - Prefer `deal_people` row where role='main_contact' (the authoritative post-P3 source).
       - Fall back to `deals.main_contact_name` / `deals.main_contact_email` ONLY if no deal_people row exists (grace-period defensive).
       - Switch the text inputs to READ-ONLY display (per the planning-context instruction: "switch from text inputs to a read-only display of the deal_people row with role='main_contact' + an 'Edit' link that jumps to the People tab").

       Implementation approach: extend the `DealDetail` type (or the fetch in `app/deal/[id]/page.tsx`) to include a `mainContactPerson: DealPersonRow | null` field joined via `queryDealPeopleForDeal` (already fetched per Plan 06 Task 1). The Overview card accesses `deal.mainContactPerson?.contactFullName ?? deal.mainContactName ?? "—"`.

       If current overview-card uses a FieldSpec-driven schema (per `app/deal/[id]/_components/overview-tab.tsx`), add the Main Contact rendering as a custom cell in the Tracking or Property section using `renderRead: (d) => <MainContactReadOnly deal={d} />`. The read-only cell ends with an `<Link href="?tab=contacts">Edit in People tab →</Link>`.

       Keep the text inputs for `mainContactName`/`mainContactEmail` on the NEW DEAL FORM — those stay (the form is pre-People-tab-knowledge; the user shouldn't have to know about role slots at intake). The existing tests for the new-deal form remain green.

    4. Run `npm test -- create-deal-people-dual-write` — expect GREEN.
       Run full `npm test` — expect green.
       Run `npx tsc --noEmit` + `npm run build` — both clean.
       Manual smoke (document in SUMMARY):
       - `npm run dev`, go to `/deal/new`, fill in a main_contact_name + main_contact_email, submit.
       - Open the new deal. Overview tab → Main Contact section → shows the name/email read-only + Edit link.
       - Click Edit link → navigates to File Contacts tab → main_contact slot shows the same contact assigned.
       - Go to `/contacts` → the new contact appears with activeDealsCount=1.
  </action>
  <verify>
    <automated>npm test -- create-deal-people-dual-write &amp;&amp; npm test &amp;&amp; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `tests/integration/create-deal-people-dual-write.test.ts` passes with >= 6 assertions including the rollback invariant and dedupe-by-email test
    - `grep -n "tx.insert(dealPeople)" app/deal/new/actions.ts` returns a match
    - `grep -n "tx.insert(contacts)" app/deal/new/actions.ts` returns a match
    - `grep -n "onConflictDoUpdate" app/deal/new/actions.ts` returns a match (email dedupe)
    - `grep -n "contact_create_via_new_deal" app/deal/new/actions.ts` returns a match
    - `grep -n "deal_people_upsert_via_new_deal" app/deal/new/actions.ts` returns a match
    - Overview card renders Main Contact from the deal_people row when present (grep the component for a mainContactPerson reference OR equivalent fallback pattern)
    - The New Deal form still accepts main_contact_name + main_contact_email inputs (un-changed intake UX)
    - Full `npm test` green
    - `npm run build` clean
    - Plan SUMMARY documents: (a) the new audit source vocab, (b) the grace-period fallback in the Overview display, (c) the decision to keep text inputs on the new-deal form while read-only-izing the display on the deal detail page
  </acceptance_criteria>
  <done>D-03 fully closed: data migrated, new deals dual-write, Overview reads from deal_people with legacy fallback. Legacy columns preserved for P10.</done>
</task>

</tasks>

<verification>
- `npm run db:migrate` idempotent (two consecutive runs both exit 0; second is a no-op)
- Full `npm test` green (P1/P2/P3 suites, new backfill + dual-write tests)
- `npm run build` clean
- `grep -rn "@/db/client" app/deal/new/actions.ts drizzle/migrations/0007_backfill_deal_main_contact.sql` returns 0
- No MFA / Auth.js references
- `grep -c "ON CONFLICT" drizzle/migrations/0007_backfill_deal_main_contact.sql` returns >= 2
- `deals.main_contact_name` and `deals.main_contact_email` columns still exist post-migration (information_schema check)
- Audit log rows written for every dual-write path with new source vocab
</verification>

<success_criteria>
D-03 resolved at data + write-path + UI layers. Phase 3 closure unblocked — every existing deal has a `deal_people` row with role='main_contact' pointing to a real contact; every new deal continues the pattern; the UI reads from the authoritative source with a grace-period fallback. Legacy columns preserved for P10 calibration.
</success_criteria>

<output>
After completion, create `.planning/phases/03-people-map-contacts-registry/03-07-d03-backfill-main-contact-migration-SUMMARY.md` recording: audit D-05 exception rationale (migration as audit artifact), new audit source vocab (`contact_create_via_new_deal`, `deal_people_upsert_via_new_deal`), grace-period column retention decision, manual smoke results (3-step walkthrough: new deal → overview read → contacts page count).
</output>
