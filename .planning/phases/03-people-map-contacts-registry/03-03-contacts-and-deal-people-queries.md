---
phase: 03-people-map-contacts-registry
plan: 03
type: execute
wave: 2
depends_on:
  - 03-people-map-contacts-registry/01
files_modified:
  - lib/contacts-query.ts
  - lib/deal-people-query.ts
  - tests/integration/contacts-query.test.ts
  - tests/integration/deal-people-query.test.ts
autonomous: true
requirements:
  - PEOPLE-03
  - PEOPLE-04
  - VIEW-06

must_haves:
  truths:
    - "queryContactsForList(q?) returns every contact + active-deals count for /contacts page"
    - "Searching by q matches case-insensitive substring on full_name OR email OR org"
    - "queryContactsAutosuggest(q, limit) returns top-N contacts for role-slot autosuggest (PEOPLE-03)"
    - "queryDealPeopleForDeal(dealId) returns every deal_people row joined to contacts + a computed `resolvedLabel` (contact.full_name OR free_text fallback)"
    - "active-deals count excludes deals where status IN ('closed','killed')"
  artifacts:
    - path: lib/contacts-query.ts
      provides: "Read-only queries for /contacts and autosuggest"
      contains: "queryContactsForList"
    - path: lib/deal-people-query.ts
      provides: "Read-only query for deal-detail File Contacts tab"
      contains: "queryDealPeopleForDeal"
    - path: tests/integration/contacts-query.test.ts
      provides: "Real-Postgres behavioral tests"
      contains: "queryContactsForList"
    - path: tests/integration/deal-people-query.test.ts
      provides: "Real-Postgres behavioral tests for deal_people join"
      contains: "queryDealPeopleForDeal"
  key_links:
    - from: lib/contacts-query.ts
      to: "@/lib/db"
      via: "canonical DB client import (D-04 — @/db/client forbidden)"
      pattern: "from\\s+[\"']@/lib/db[\"']"
    - from: lib/contacts-query.ts
      to: db/schema/app.ts
      via: "imports contacts + dealPeople + deals tables"
      pattern: "import.*contacts.*dealPeople.*deals|from [\"']@/db/schema[\"']"
---

<objective>
Ship the read-only query layer for `/contacts` (VIEW-06), per-deal File Contacts tab, and role-slot autosuggest (PEOPLE-03/04). Pure queries — no mutations, no server actions.

**Purpose:** Separating reads from writes keeps server actions (Plan 04) focused on mutation + audit; UI plans (05/06) import from this module. Mirrors the P1/P2 pattern: `lib/deals-query.ts`, `lib/tasks-query.ts`, `lib/notes-query.ts`, `lib/audit-query.ts`.

**Output:**
- `lib/contacts-query.ts` — `queryContactsForList(q?)`, `queryContactsAutosuggest(q, limit)`, `queryContactById(id)`, plus `ContactListRow` and `ContactAutosuggestRow` types
- `lib/deal-people-query.ts` — `queryDealPeopleForDeal(dealId)` + `DealPersonRow` type (joined to contacts, resolved labels)
- Real-Postgres integration tests per project convention (vitest, no DB mocks)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/REQUIREMENTS.md
@lib/deals-query.ts
@lib/tasks-query.ts
@lib/notes-query.ts
@lib/db.ts
@db/schema/app.ts
@.planning/phases/01-core-data-model/06-list-view-rewrite-SUMMARY.md
@.planning/phases/02-deal-detail-tasks-stages/06-tasks-notes-audit-tabs-SUMMARY.md

<interfaces>
From lib/db.ts (after Plan 01): canonical client with schema pre-bound.
```typescript
import { db } from "@/lib/db"; // use this, NOT @/db/client (D-04 forbidden)
```

From db/schema/app.ts (after Plan 01):
```typescript
export const contacts: PgTable;      // columns: id, fullName, roleHint, org, email, phone, notes, createdBy, createdAt, updatedAt
export const dealPeople: PgTable;    // columns: id, dealId, contactId (nullable), role, createdBy, createdAt
export type Contact = typeof contacts.$inferSelect;
export type DealPerson = typeof dealPeople.$inferSelect;
```

From lib/deals-query.ts (prior pattern to mirror for multi-join reads):
```typescript
// Uses db.$with CTE + leftJoin + sql`coalesce(...)` for derived columns
// ORDER BY via desc(...)/asc(...)/sql`... NULLS LAST`
// Returns plain typed array — no .prepare() caching yet
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Author lib/contacts-query.ts + tests. Handles VIEW-06 list + PEOPLE-03 autosuggest + by-id reads.</name>
  <files>
    lib/contacts-query.ts
    tests/integration/contacts-query.test.ts
  </files>
  <read_first>
    - lib/deals-query.ts (canonical multi-join query with CTE aggregation — copy the shape for active-deals-count)
    - lib/notes-query.ts (simpler single-table SELECT with ORDER BY)
    - db/schema/app.ts (after Plan 01 — exact column names)
    - tests/integration/ (existing integration test setup — DB lifecycle, fixtures, cleanup; copy the before/after convention)
  </read_first>
  <behavior>
    - `queryContactsForList(q?: string): Promise&lt;ContactListRow[]&gt;` returns every contact row with: id, fullName, roleHint, org, email, phone, notes, createdAt, activeDealsCount (integer)
    - `activeDealsCount` = number of DISTINCT deal_people rows with `contact_id = contacts.id` whose deal has `status = 'active'` (excludes closed AND killed)
    - When `q` omitted/empty: ORDER BY `lower(full_name) ASC`
    - When `q` provided: filter rows matching case-insensitive `full_name ILIKE %q%` OR `email ILIKE %q%` OR `org ILIKE %q%`. Still ORDER BY `lower(full_name) ASC`
    - `queryContactsAutosuggest(q: string, limit: number): Promise&lt;ContactAutosuggestRow[]&gt;` — cheaper read for role-slot autosuggest (PEOPLE-03). Returns id, fullName, email, org. Must require `q.trim().length &gt;= 1` (return `[]` if empty to avoid returning the full contact table). LIMIT clamped server-side at `Math.min(limit, 20)`
    - Autosuggest ORDER BY: exact `full_name = q` first, then `full_name ILIKE q%` (prefix), then substring matches. Implementation via `CASE WHEN ... THEN 0 WHEN ... THEN 1 ELSE 2 END` sort key
    - `queryContactById(id: string): Promise&lt;Contact | null&gt;` — simple PK read, null if not found
    - Tests include: empty DB → queryContactsForList() returns [] cleanly; 3 inserted contacts → list returns 3 with activeDealsCount=0; attach one deal_people row → that contact's activeDealsCount=1; close the deal → that contact's activeDealsCount=0; search "alic" matches "Alice Baker" and "Malice LLC" (case-insensitive); autosuggest("") returns []; autosuggest("Ali", 5) returns the Ali... contact first; by-id returns row; by-id of unknown uuid returns null
  </behavior>
  <action>
    1. Write `tests/integration/contacts-query.test.ts` FIRST. Use the existing real-Postgres test harness (vitest integration config). Seed: 1 user (via existing fixtures), 1 track+stage (already seeded globally), 3 contacts, 2 deals (one active, one closed), 1 deal_people row linking contactA → active deal with role='main_contact'. Assertions:
       - Contact count = 3
       - Active-deals-count: contactA=1, contactB=0, contactC=0
       - After updating the active deal to status='closed': contactA's count drops to 0 on re-query
       - Search "alic" (assuming Alice Baker + Malice LLC as contact names) returns 2 rows
       - Search "alic" returns 0 rows when no contact matches
       - Autosuggest("") returns []
       - Autosuggest("Ali", 5) returns Alice first
       - queryContactById(validUuid) returns the expected row
       - queryContactById('00000000-0000-0000-0000-000000000000') returns null

       Run `npm test -- contacts-query`. Expect RED (module doesn't exist).

    2. Write `lib/contacts-query.ts`. Structure mirrors `lib/deals-query.ts` exactly — top docstring citing PEOPLE-03/04 + VIEW-06, types above functions, canonical `@/lib/db` import. Key SQL notes:

       ```typescript
       import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
       import { db } from "@/lib/db";
       import { contacts, dealPeople, deals } from "@/db/schema";
       import type { Contact } from "@/db/schema";

       export type ContactListRow = {
         id: string;
         fullName: string;
         roleHint: string | null;
         org: string | null;
         email: string | null;
         phone: string | null;
         notes: string | null;
         createdAt: Date;
         activeDealsCount: number;
       };

       export type ContactAutosuggestRow = {
         id: string;
         fullName: string;
         email: string | null;
         org: string | null;
       };

       export async function queryContactsForList(q?: string): Promise&lt;ContactListRow[]&gt; {
         // CTE: per-contact active-deals count from deal_people ⋈ deals WHERE deals.status='active'
         const activeCount = db.$with("contact_active_deals").as(
           db
             .select({
               contactId: dealPeople.contactId,
               cnt: sql&lt;number&gt;`count(distinct ${dealPeople.dealId})::int`.as("cnt"),
             })
             .from(dealPeople)
             .innerJoin(deals, eq(deals.id, dealPeople.dealId))
             .where(eq(deals.status, "active"))
             .groupBy(dealPeople.contactId),
         );

         const whereExpr = q &amp;&amp; q.trim().length &gt; 0
           ? or(
               ilike(contacts.fullName, `%${q}%`),
               ilike(contacts.email, `%${q}%`),
               ilike(contacts.org, `%${q}%`),
             )
           : undefined;

         const rows = await db
           .with(activeCount)
           .select({
             id: contacts.id,
             fullName: contacts.fullName,
             roleHint: contacts.roleHint,
             org: contacts.org,
             email: contacts.email,
             phone: contacts.phone,
             notes: contacts.notes,
             createdAt: contacts.createdAt,
             activeDealsCount: sql&lt;number&gt;`coalesce(${activeCount.cnt}, 0)::int`,
           })
           .from(contacts)
           .leftJoin(activeCount, eq(activeCount.contactId, contacts.id))
           .where(whereExpr ?? sql`true`)
           .orderBy(sql`lower(${contacts.fullName}) asc`);

         return rows;
       }

       export async function queryContactsAutosuggest(q: string, limit: number): Promise&lt;ContactAutosuggestRow[]&gt; {
         const trimmed = q.trim();
         if (trimmed.length === 0) return [];
         const cappedLimit = Math.min(Math.max(limit, 1), 20);
         const pattern = `%${trimmed}%`;
         const prefix = `${trimmed}%`;

         const rows = await db
           .select({
             id: contacts.id,
             fullName: contacts.fullName,
             email: contacts.email,
             org: contacts.org,
           })
           .from(contacts)
           .where(
             or(
               ilike(contacts.fullName, pattern),
               ilike(contacts.email, pattern),
               ilike(contacts.org, pattern),
             ),
           )
           .orderBy(
             sql`case
               when lower(${contacts.fullName}) = lower(${trimmed}) then 0
               when ${contacts.fullName} ilike ${prefix} then 1
               else 2
             end`,
             sql`lower(${contacts.fullName}) asc`,
           )
           .limit(cappedLimit);

         return rows;
       }

       export async function queryContactById(id: string): Promise&lt;Contact | null&gt; {
         const [row] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
         return row ?? null;
       }
       ```

    3. Re-run `npm test -- contacts-query`. Expect GREEN. Keep existing suite green.
  </action>
  <verify>
    <automated>npm test -- contacts-query &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `lib/contacts-query.ts` exists and exports: `queryContactsForList`, `queryContactsAutosuggest`, `queryContactById`, `ContactListRow`, `ContactAutosuggestRow`
    - `grep "from [\"']@/lib/db[\"']" lib/contacts-query.ts` returns a match (canonical client)
    - `grep "from [\"']@/db/client[\"']" lib/contacts-query.ts` returns 0 matches (D-04 forbidden)
    - `grep "status, \"active\"" lib/contacts-query.ts` returns a match (active-only count)
    - `tests/integration/contacts-query.test.ts` passes with >= 9 assertions
    - Full `npm test` green
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>VIEW-06 + PEOPLE-03 + PEOPLE-04 read paths exist and are tested against real Postgres. Autosuggest ranks exact &gt; prefix &gt; substring.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Author lib/deal-people-query.ts + tests. Join deal_people → contacts for File Contacts tab.</name>
  <files>
    lib/deal-people-query.ts
    tests/integration/deal-people-query.test.ts
  </files>
  <read_first>
    - lib/deals-query.ts::queryDealById (pattern: secondary queries off a primary join; returning a composite type with nullable joined fields)
    - lib/role-slots.ts (from Plan 02 — use ROLE_SLOTS for consumer reference; this module does NOT enforce, it only reads)
    - lib/contacts-query.ts (from Task 1 — same import style)
  </read_first>
  <behavior>
    - `queryDealPeopleForDeal(dealId: string): Promise&lt;DealPersonRow[]&gt;` returns every deal_people row for the deal, joined to contacts (left join — contact_id is nullable after SET NULL cascade)
    - `DealPersonRow`: { id, dealId, role, contactId (nullable), contactFullName (nullable), contactEmail (nullable), contactOrg (nullable), createdAt }
    - ORDER BY role ASC (stable deterministic order; UI reorders visually per role-slot registry but DB-level sort is deterministic for diffing and audit display)
    - Empty result for a deal with no people rows yet (never null — always a []
    - Tests: empty deal → []; 2 rows inserted → returns 2 with joined contact fields; after DELETE contacts row (SET NULL fires) → dealPerson row remains, contactFullName becomes null
  </behavior>
  <action>
    1. Write `tests/integration/deal-people-query.test.ts` FIRST. Fixture: 1 deal, 1 contact, 2 deal_people rows (one with contactId, one with contactId=null + role='lender_partner'). Assertions:
       - `queryDealPeopleForDeal(unknownDealId)` returns []
       - Insert 2 people rows → returns 2 rows with deterministic order by role
       - Joined contactFullName matches for the FK row; is null for the no-contact row
       - After `DELETE FROM contacts WHERE id = ...` the dealPerson row survives (SET NULL from Plan 01 schema) AND `contactFullName` is null

       Run `npm test -- deal-people-query`. Expect RED.

    2. Write `lib/deal-people-query.ts`:

       ```typescript
       import { asc, eq } from "drizzle-orm";
       import { db } from "@/lib/db";
       import { dealPeople, contacts } from "@/db/schema";

       export type DealPersonRow = {
         id: string;
         dealId: string;
         role: string;
         contactId: string | null;
         contactFullName: string | null;
         contactEmail: string | null;
         contactOrg: string | null;
         createdAt: Date;
       };

       export async function queryDealPeopleForDeal(dealId: string): Promise&lt;DealPersonRow[]&gt; {
         return await db
           .select({
             id: dealPeople.id,
             dealId: dealPeople.dealId,
             role: dealPeople.role,
             contactId: dealPeople.contactId,
             contactFullName: contacts.fullName,
             contactEmail: contacts.email,
             contactOrg: contacts.org,
             createdAt: dealPeople.createdAt,
           })
           .from(dealPeople)
           .leftJoin(contacts, eq(contacts.id, dealPeople.contactId))
           .where(eq(dealPeople.dealId, dealId))
           .orderBy(asc(dealPeople.role));
       }
       ```

    3. Re-run test. Expect GREEN. Full `npm test` green.
  </action>
  <verify>
    <automated>npm test -- deal-people-query &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `lib/deal-people-query.ts` exists and exports `queryDealPeopleForDeal` + `DealPersonRow`
    - `grep "leftJoin(contacts" lib/deal-people-query.ts` returns a match (nullable join honored)
    - `grep "from [\"']@/lib/db[\"']" lib/deal-people-query.ts` returns a match
    - `tests/integration/deal-people-query.test.ts` passes with >= 4 assertions including the SET NULL behavior test
    - `npx tsc --noEmit` exits 0
    - Full suite green
  </acceptance_criteria>
  <done>Deal-detail File Contacts tab has a single query primitive returning all slot assignments joined to contact identity. Plan 06 consumes this directly.</done>
</task>

</tasks>

<verification>
- Full `npm test` green with new integration tests
- `grep -rn "@/db/client" lib/contacts-query.ts lib/deal-people-query.ts` returns 0 (D-04 holds)
- Both modules compile + full build passes
</verification>

<success_criteria>
VIEW-06 data (global list + search + active-deals count), PEOPLE-03 autosuggest primitive, and per-deal File Contacts fetch all exist as pure read functions, tested against real Postgres.
</success_criteria>

<output>
After completion, create `.planning/phases/03-people-map-contacts-registry/03-03-contacts-and-deal-people-queries-SUMMARY.md`.
</output>
