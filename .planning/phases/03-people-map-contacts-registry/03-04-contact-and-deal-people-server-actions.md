---
phase: 03-people-map-contacts-registry
plan: 04
type: tdd
wave: 3
depends_on:
  - 03-people-map-contacts-registry/01
  - 03-people-map-contacts-registry/02
  - 03-people-map-contacts-registry/03
files_modified:
  - app/contacts/actions.ts
  - app/deal/[id]/actions/people.ts
  - tests/integration/contact-actions.test.ts
  - tests/integration/deal-people-actions.test.ts
autonomous: true
requirements:
  - PEOPLE-01
  - PEOPLE-02
  - PEOPLE-05

must_haves:
  truths:
    - "createContact + updateContact each wrap DML + writeAuditLog in ONE db.transaction (D-05 rollback invariant)"
    - "upsertDealPerson rejects unknown role at Zod layer AND rejects role-incompatible-with-track at action layer via isRoleValidForTrack (PEOPLE-05)"
    - "upsertDealPerson is UPSERT keyed by (deal_id, role): first call INSERTs, second call for same (deal_id, role) UPDATEs contactId — never two rows for the same slot"
    - "Role 'lender_partner' with freeTextValue creates/reuses a minimal contact row (full_name=freeTextValue, role_hint='lender') and wires the dealPeople row to it"
    - "removeDealPerson deletes the (deal_id, role) row and writes an audit row"
    - "New audit vocab added to the source marker lexicon: contact_create, contact_update, deal_people_upsert, deal_people_remove"
    - "Every mutation throws inside db.transaction on audit failure → mutation rolls back (proven by vi.doMock('@/lib/audit'))"
  artifacts:
    - path: app/contacts/actions.ts
      provides: "createContact + updateContact Server Actions for /contacts page forms"
      contains: "createContact"
    - path: app/deal/[id]/actions/people.ts
      provides: "upsertDealPerson + removeDealPerson Server Actions for deal-detail File Contacts tab"
      contains: "upsertDealPerson"
    - path: tests/integration/contact-actions.test.ts
      provides: "TDD coverage of createContact + updateContact incl. rollback invariant"
      contains: "rollback"
    - path: tests/integration/deal-people-actions.test.ts
      provides: "TDD coverage of upsertDealPerson track-validity + UPSERT + removeDealPerson"
      contains: "isRoleValidForTrack"
  key_links:
    - from: app/contacts/actions.ts
      to: lib/audit.ts
      via: "writeAuditLog called inside db.transaction for every mutation"
      pattern: "writeAuditLog\\("
    - from: app/deal/[id]/actions/people.ts
      to: lib/role-slots.ts
      via: "isRoleValidForTrack used to reject bad role+track combos"
      pattern: "isRoleValidForTrack"
    - from: app/deal/[id]/actions/people.ts
      to: "Next.js revalidation"
      via: "revalidatePath('/deal/[id]', 'page') after tx commits"
      pattern: "revalidatePath\\([\"']/deal/\\[id\\][\"'], [\"']page[\"']\\)"
---

<objective>
Implement the 4 P3 Server Actions with TDD (RED → GREEN): `createContact`, `updateContact`, `upsertDealPerson`, `removeDealPerson`. Each wraps DML + audit in one `db.transaction`. `upsertDealPerson` enforces PEOPLE-05 (role-compatible-with-track) at the application layer.

**Purpose:** Ship the write-path for PEOPLE-01 (contacts CRUD) and PEOPLE-02 (deal_people slot assignments) with the same atomicity + audit guarantees P2 established (proven rollback invariant via mocked audit throw). PEOPLE-05 enforcement layer lives here, composed from Plan 02's `isRoleValidForTrack`.

**Output:**
- `app/contacts/actions.ts` — `createContact`, `updateContact`
- `app/deal/[id]/actions/people.ts` — `upsertDealPerson`, `removeDealPerson`
- Full TDD integration tests for each action including rollback invariants
- Audit `source` vocab extended with `contact_create`, `contact_update`, `deal_people_upsert`, `deal_people_remove` (added to the module-level comment in `app/deal/[id]/actions/stages.ts` and `lib/audit.ts` JSDoc — not a new column)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/REQUIREMENTS.md
@app/deal/[id]/actions/deals.ts
@app/deal/[id]/actions/stages.ts
@app/deal/[id]/actions/tasks.ts
@app/deal/new/actions.ts
@lib/audit.ts
@lib/contact-schema.ts
@lib/role-slots.ts
@lib/contacts-query.ts
@lib/deal-people-query.ts
@lib/db.ts
@lib/file-no.ts
@.planning/phases/02-deal-detail-tasks-stages/04-stage-advance-revert-kill-actions-SUMMARY.md
@.planning/phases/02-deal-detail-tasks-stages/03-task-server-actions-is-next-invariant-SUMMARY.md

<interfaces>
From lib/audit.ts (existing signature — DO NOT modify):
```typescript
export async function writeAuditLog(tx: AppTx, params: {
  tableName: string;
  recordId: string;
  operation: "create" | "update" | "delete";
  beforeJson: unknown | null;
  afterJson: unknown;
  user: Pick<User, "id" | "email">;
}): Promise<void>
```

From lib/file-no.ts:
```typescript
export type AppTx = PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;
```

From lib/current-user.ts (existing):
```typescript
export async function getCurrentUser(): Promise<{ id: string; email: string; ... }>
```

From lib/contact-schema.ts (from Plan 02):
```typescript
export const createContactSchema: z.ZodObject<...>;
export const updateContactSchema: z.ZodObject<...>;
export const contactIdSchema: z.ZodObject<{ id: z.ZodString }>;
export const upsertDealPersonSchema: z.ZodObject<...>;
export const removeDealPersonSchema: z.ZodObject<...>;
```

From lib/role-slots.ts (from Plan 02):
```typescript
export function isRoleValidForTrack(role: string, trackCode: string): boolean;
export const ROLE_SLOTS: readonly RoleSlot[];  // each has .source: "contact_fk" | "free_text"
```
</interfaces>

<audit_source_vocab>
Canonical `after_json.source` marker strings used across the app. Plan 04 ADDS the four P3 strings. DO NOT rename prior vocab.

Existing (P1/P2):
- `manual_advance`, `manual_revert`, `manual_close`, `manual_kill`
- `task_autoadvance`, `task_autoadvance_undo`
- (createDeal writes no `source` marker — it's the root creation)

NEW (P3 Plan 04):
- `contact_create` — writeAuditLog after createContact INSERT
- `contact_update` — writeAuditLog after updateContact UPDATE
- `deal_people_upsert` — writeAuditLog after upsertDealPerson INSERT or UPDATE (both operations reuse this source marker; the operation column distinguishes)
- `deal_people_remove` — writeAuditLog after removeDealPerson DELETE
</audit_source_vocab>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: TDD createContact + updateContact Server Actions with rollback invariant test (RED → GREEN).</name>
  <files>
    app/contacts/actions.ts
    tests/integration/contact-actions.test.ts
  </files>
  <read_first>
    - app/deal/new/actions.ts (canonical createDeal pattern: Zod parse → db.transaction → INSERT + writeAuditLog → return {ok} OR return validation errors)
    - app/deal/[id]/actions/deals.ts::updateDeal (canonical split-parse pattern for {id, ...diff} — contactIdSchema + updateContactSchema.safeParse(rest))
    - .planning/phases/01-core-data-model/05-new-deal-form-SUMMARY.md §Test 7 (the rollback-invariant proof: vi.doMock('@/lib/audit') → throw → assert no deal row)
    - lib/contact-schema.ts (consume — don't re-declare)
    - lib/audit.ts (consume — do not modify the signature)
  </read_first>
  <behavior>
    - `createContact(raw: unknown): Promise&lt;{ok:true; contactId:string} | {ok:false; errors:Record&lt;string,string[]&gt;} | {ok:false; error:string}&gt;`
      - Parses with `createContactSchema.safeParse`. On ZodError, returns `{ok:false, errors}`.
      - Otherwise opens `db.transaction(async tx =&gt; ...)`: INSERT contact row (createdBy from getCurrentUser), call `writeAuditLog(tx, { tableName:'contacts', recordId, operation:'create', beforeJson:null, afterJson: { ...inserted, source:'contact_create' }, user })`, return `{ok:true, contactId}`.
      - On `uniqueIndex contacts_email_unique_idx` violation (23505), returns `{ok:false, error:'A contact with this email already exists.'}` (graceful, no throw to the caller).
    - `updateContact(raw: unknown): Promise&lt;same result shape&gt;`
      - Split-parse: `contactIdSchema` first, then `updateContactSchema.safeParse(rest)` — unknown keys rejected by `.strict()`.
      - Fetches existing row for before-diff, computes diff, empty-diff short-circuits `{ok:true, noop:true}` with NO audit row (mirrors P2 updateDeal).
      - `db.transaction`: UPDATE contacts SET ... WHERE id = ..., then `writeAuditLog(tx, { tableName:'contacts', recordId:id, operation:'update', beforeJson, afterJson:{...after, source:'contact_update'}, user })`.
    - Tests:
      1. Happy create: Zod-valid payload → `{ok:true}` → row exists in DB → audit_log row exists with tableName='contacts', operation='create', after_json.source='contact_create', userEmail populated.
      2. Validation error: missing fullName → `{ok:false, errors: { fullName: [...] }}`.
      3. Unknown key: `{fullName:'X', extra:'y'}` → `{ok:false, errors}` (via `.strict()`).
      4. Duplicate email: insert two contacts with same email → second returns `{ok:false, error: /already exists/}`; first contact row is still present.
      5. **ROLLBACK INVARIANT** (pattern from P1 Plan 05 Test 7): `vi.doMock('@/lib/audit', () =&gt; ({ writeAuditLog: () =&gt; { throw new Error('audit fail'); } }))`, re-import, call createContact → the returned result is a thrown error (or `{ok:false}` with error surfaced), and crucially `SELECT COUNT(*) FROM contacts WHERE email='...'` returns 0 (tx rolled back).
      6. updateContact happy path: change fullName → row updated, audit row has operation='update', beforeJson.full_name != afterJson.full_name, source='contact_update'.
      7. updateContact empty diff: `{id, fullName: existingSame}` → `{ok:true, noop:true}`, NO new audit row inserted (audit_log row count unchanged).
      8. updateContact unknown key: `{id, extra:'y'}` → `{ok:false, errors}`.

    Run `npm test -- contact-actions`. Expect RED (module doesn't exist).

    Then implement `app/contacts/actions.ts`:

    ```typescript
    "use server";

    import { db } from "@/lib/db";
    import { contacts } from "@/db/schema";
    import { eq } from "drizzle-orm";
    import { revalidatePath } from "next/cache";
    import { writeAuditLog } from "@/lib/audit";
    import { getCurrentUser } from "@/lib/current-user";
    import { createContactSchema, updateContactSchema, contactIdSchema } from "@/lib/contact-schema";

    type ContactResult =
      | { ok: true; contactId: string; noop?: boolean }
      | { ok: false; errors: Record&lt;string, string[]&gt; }
      | { ok: false; error: string };

    export async function createContact(raw: unknown): Promise&lt;ContactResult&gt; {
      const parsed = createContactSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

      const user = await getCurrentUser();
      try {
        const contactId = await db.transaction(async (tx) =&gt; {
          const [row] = await tx
            .insert(contacts)
            .values({ ...parsed.data, createdBy: user.id })
            .returning();
          await writeAuditLog(tx, {
            tableName: "contacts",
            recordId: row.id,
            operation: "create",
            beforeJson: null,
            afterJson: { ...row, source: "contact_create" },
            user: { id: user.id, email: user.email },
          });
          return row.id;
        });
        revalidatePath("/contacts");
        return { ok: true, contactId };
      } catch (e: any) {
        if (e?.code === "23505") return { ok: false, error: "A contact with this email already exists." };
        throw e;
      }
    }

    export async function updateContact(raw: unknown): Promise&lt;ContactResult&gt; {
      const idParse = contactIdSchema.safeParse(raw);
      if (!idParse.success) return { ok: false, errors: idParse.error.flatten().fieldErrors };
      const { id } = idParse.data;
      const { id: _ignore, ...rest } = (raw as any) ?? {};
      const diffParse = updateContactSchema.safeParse(rest);
      if (!diffParse.success) return { ok: false, errors: diffParse.error.flatten().fieldErrors };

      const [existing] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
      if (!existing) return { ok: false, error: "Contact not found." };

      // Compute diff — normalize null/undefined/'' as equivalent (mirrors P2 OverviewCard diff).
      const normalize = (v: unknown) =&gt; (v === null || v === undefined || v === "" ? null : v);
      const diff: Record&lt;string, unknown&gt; = {};
      for (const [k, v] of Object.entries(diffParse.data)) {
        if (normalize((existing as any)[k]) !== normalize(v)) diff[k] = v;
      }
      if (Object.keys(diff).length === 0) return { ok: true, contactId: id, noop: true };

      const user = await getCurrentUser();
      await db.transaction(async (tx) =&gt; {
        const [after] = await tx
          .update(contacts)
          .set({ ...diff, updatedAt: new Date() })
          .where(eq(contacts.id, id))
          .returning();
        await writeAuditLog(tx, {
          tableName: "contacts",
          recordId: id,
          operation: "update",
          beforeJson: existing,
          afterJson: { ...after, source: "contact_update" },
          user: { id: user.id, email: user.email },
        });
      });
      revalidatePath("/contacts");
      return { ok: true, contactId: id };
    }
    ```

    Re-run `npm test -- contact-actions`. Expect GREEN. Full `npm test` still green.
  </action>
  <verify>
    <automated>npm test -- contact-actions &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `app/contacts/actions.ts` exists starting with `"use server";`
    - `grep "db.transaction" app/contacts/actions.ts | wc -l` returns `2` (one per mutating action)
    - `grep "writeAuditLog" app/contacts/actions.ts | wc -l` returns `2`
    - `grep "source: \"contact_create\"" app/contacts/actions.ts` returns a match
    - `grep "source: \"contact_update\"" app/contacts/actions.ts` returns a match
    - `grep "revalidatePath(\"/contacts\")" app/contacts/actions.ts` returns `>= 2`
    - Rollback test 5 passes: mocked audit throw leaves zero contact rows with the test email
    - All 8 test assertions pass
    - `npx tsc --noEmit` exits 0
    - Full `npm test` green
  </acceptance_criteria>
  <done>Contacts create + update Server Actions shipped with atomicity + audit + rollback invariant proven. PEOPLE-01 write path live.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: TDD upsertDealPerson + removeDealPerson with track-validity (PEOPLE-05) and UPSERT semantics.</name>
  <files>
    app/deal/[id]/actions/people.ts
    tests/integration/deal-people-actions.test.ts
  </files>
  <read_first>
    - app/deal/[id]/actions/deals.ts (canonical composite-input split-parse; revalidatePath pattern)
    - app/deal/[id]/actions/stages.ts (`applyStageTransitionInTx` shape is similar: fetch deal + target, validate, mutate inside one tx, audit inside same tx — mirror for upsertDealPerson)
    - lib/role-slots.ts (consume `isRoleValidForTrack` + `ROLE_SLOTS` — look up `.source` to branch on free_text vs contact_fk)
    - lib/contact-schema.ts (consume `upsertDealPersonSchema` + `removeDealPersonSchema`)
    - db/schema/app.ts after Plan 01 (dealPeople unique (deal_id, role))
  </read_first>
  <behavior>
    - `upsertDealPerson(raw: unknown): Promise&lt;{ok:true; dealPersonId:string} | {ok:false; errors} | {ok:false; error:string}&gt;`
      - Zod-parse with `upsertDealPersonSchema`.
      - Fetch deal row (for trackCode lookup via tracks join). If deal missing → `{ok:false, error:'Deal not found.'}`.
      - Call `isRoleValidForTrack(role, deal.trackCode)` → if false, return `{ok:false, error: `Role "${role}" is not valid for ${deal.trackCode} deals.`}` (PEOPLE-05 — EXACT error shape asserted by Phase-3 Success Criterion 3).
      - Look up the role slot's `source`:
        - If `source === 'free_text'` (lender_partner): require `freeTextValue` non-empty. If missing, `{ok:false, errors: { freeTextValue: ['Lender name is required.'] }}`. Else UPSERT a minimal contact row (full_name=freeTextValue, role_hint='lender') — INSERT with `ON CONFLICT (lower(email)) DO NOTHING` is not applicable here since email is null; do a plain INSERT and capture its id. Use that id for `contactId`.
        - If `source === 'contact_fk'`: require `contactId`. If missing, `{ok:false, errors: { contactId: ['Pick a contact or create a new one.'] }}`.
      - All of the above runs inside ONE `db.transaction`: fetch deal → validate → optional minimal-contact INSERT → dealPeople UPSERT → writeAuditLog → commit.
      - UPSERT uses drizzle's `.onConflictDoUpdate({ target: [dealPeople.dealId, dealPeople.role], set: { contactId: ... } })` — this satisfies PEOPLE-02 invariant (one row per slot) at the action layer (the `deal_people_one_per_slot_idx` unique index is the safety net).
      - Audit row: operation='create' on INSERT, 'update' on UPDATE — drizzle `.returning({ ...fields, xmin: sql\`xmin\` })` is heavy; simpler: query for existing row before the upsert to determine operation (create vs update), capture beforeJson.
      - `after_json.source = 'deal_people_upsert'` always (both INSERT and UPDATE).
      - `revalidatePath('/deal/[id]', 'page')` after tx commits (Next.js 16 dynamic-route signature per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`).
    - `removeDealPerson(raw: unknown): Promise&lt;...same result shape&gt;`
      - Zod-parse with `removeDealPersonSchema`.
      - Fetch existing (deal_id, role) row for beforeJson. If missing → `{ok:true, noop:true}` (idempotent — deleting an absent slot is not an error).
      - `db.transaction`: DELETE + writeAuditLog ({operation:'delete', beforeJson: row, afterJson: { source: 'deal_people_remove' }}).
      - revalidatePath('/deal/[id]', 'page').
    - Tests (at least 12 assertions):
      1. upsertDealPerson happy INSERT: {dealId, role:'main_contact', contactId} → {ok:true}, one deal_people row, audit row with operation='create' + source='deal_people_upsert'.
      2. upsertDealPerson same (deal_id, role) second call: {contactId: otherId} → {ok:true}, STILL only ONE deal_people row for that slot, audit row with operation='update' + beforeJson.contact_id !== afterJson.contact_id.
      3. upsertDealPerson invalid role-for-track: deal has trackCode='GI', role='title_partner' (TE-only) → {ok:false, error: /not valid for GI/}. No deal_people row exists for that slot after the call.
      4. upsertDealPerson with unknown role: role='banana' → {ok:false, errors} (caught at Zod layer via .enum).
      5. upsertDealPerson contactId missing for contact_fk slot: role='main_contact' with no contactId → {ok:false, errors: { contactId: ... }}.
      6. upsertDealPerson lender_partner happy: role='lender_partner' + freeTextValue='Wells Fargo' → creates contact row with full_name='Wells Fargo', wires deal_people to it, returns ok.
      7. upsertDealPerson lender_partner missing freeTextValue: {ok:false, errors: { freeTextValue }}.
      8. upsertDealPerson rollback invariant: vi.doMock('@/lib/audit') throw → no deal_people row for the slot (was absent before), deal row unchanged.
      9. removeDealPerson happy: existing slot → {ok:true}, row deleted, audit row with operation='delete' + source='deal_people_remove'.
      10. removeDealPerson idempotent (slot absent): {ok:true, noop:true}, NO new audit row.
      11. removeDealPerson unknown role rejected at Zod: {ok:false, errors}.
      12. upsertDealPerson + removeDealPerson across 3 slots: data integrity (exactly 2 remaining after one remove; each row has unique (deal_id, role)).

    Run `npm test -- deal-people-actions`. Expect RED.

    Write `app/deal/[id]/actions/people.ts`:

    ```typescript
    "use server";

    import { db } from "@/lib/db";
    import { deals, tracks, dealPeople, contacts } from "@/db/schema";
    import { and, eq } from "drizzle-orm";
    import { revalidatePath } from "next/cache";
    import { writeAuditLog } from "@/lib/audit";
    import { getCurrentUser } from "@/lib/current-user";
    import { upsertDealPersonSchema, removeDealPersonSchema } from "@/lib/contact-schema";
    import { isRoleValidForTrack, ROLE_SLOTS } from "@/lib/role-slots";

    type DealPersonResult =
      | { ok: true; dealPersonId: string; noop?: boolean }
      | { ok: false; errors: Record&lt;string, string[]&gt; }
      | { ok: false; error: string };

    export async function upsertDealPerson(raw: unknown): Promise&lt;DealPersonResult&gt; {
      const parsed = upsertDealPersonSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
      const { dealId, role, contactId, freeTextValue } = parsed.data;

      // Read deal + trackCode OUTSIDE tx so the error path is clean.
      const [dealRow] = await db
        .select({ id: deals.id, trackCode: tracks.code })
        .from(deals)
        .innerJoin(tracks, eq(tracks.id, deals.trackId))
        .where(eq(deals.id, dealId))
        .limit(1);
      if (!dealRow) return { ok: false, error: "Deal not found." };

      // PEOPLE-05 gate — run BEFORE writing.
      if (!isRoleValidForTrack(role, dealRow.trackCode)) {
        return { ok: false, error: `Role "${role}" is not valid for ${dealRow.trackCode} deals.` };
      }

      const slot = ROLE_SLOTS.find((s) =&gt; s.code === role);
      if (!slot) return { ok: false, error: `Unknown role "${role}".` }; // belt + suspenders

      // Branch on slot source.
      let resolvedContactId: string | null = null;
      if (slot.source === "free_text") {
        const v = (freeTextValue ?? "").trim();
        if (v.length === 0) return { ok: false, errors: { freeTextValue: ["Lender name is required."] } };
      } else {
        if (!contactId) return { ok: false, errors: { contactId: ["Pick a contact or create a new one."] } };
        resolvedContactId = contactId;
      }

      const user = await getCurrentUser();
      const resultId = await db.transaction(async (tx) =&gt; {
        // Minimal-contact insert for lender free-text.
        if (slot.source === "free_text") {
          const [inserted] = await tx
            .insert(contacts)
            .values({
              fullName: (freeTextValue as string).trim(),
              roleHint: "lender",
              createdBy: user.id,
            })
            .returning();
          resolvedContactId = inserted.id;
          await writeAuditLog(tx, {
            tableName: "contacts",
            recordId: inserted.id,
            operation: "create",
            beforeJson: null,
            afterJson: { ...inserted, source: "contact_create" },
            user: { id: user.id, email: user.email },
          });
        }

        // Determine create-vs-update for audit operation via pre-read.
        const [existing] = await tx
          .select()
          .from(dealPeople)
          .where(and(eq(dealPeople.dealId, dealId), eq(dealPeople.role, role)))
          .limit(1);
        const operation: "create" | "update" = existing ? "update" : "create";

        const [after] = await tx
          .insert(dealPeople)
          .values({
            dealId,
            role,
            contactId: resolvedContactId,
            createdBy: user.id,
          })
          .onConflictDoUpdate({
            target: [dealPeople.dealId, dealPeople.role],
            set: { contactId: resolvedContactId },
          })
          .returning();

        await writeAuditLog(tx, {
          tableName: "deal_people",
          recordId: after.id,
          operation,
          beforeJson: existing ?? null,
          afterJson: { ...after, source: "deal_people_upsert" },
          user: { id: user.id, email: user.email },
        });
        return after.id;
      });
      revalidatePath("/deal/[id]", "page");
      return { ok: true, dealPersonId: resultId };
    }

    export async function removeDealPerson(raw: unknown): Promise&lt;DealPersonResult&gt; {
      const parsed = removeDealPersonSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
      const { dealId, role } = parsed.data;

      const [existing] = await db
        .select()
        .from(dealPeople)
        .where(and(eq(dealPeople.dealId, dealId), eq(dealPeople.role, role)))
        .limit(1);
      if (!existing) return { ok: true, dealPersonId: "", noop: true };

      const user = await getCurrentUser();
      await db.transaction(async (tx) =&gt; {
        await tx.delete(dealPeople).where(eq(dealPeople.id, existing.id));
        await writeAuditLog(tx, {
          tableName: "deal_people",
          recordId: existing.id,
          operation: "delete",
          beforeJson: existing,
          afterJson: { source: "deal_people_remove" },
          user: { id: user.id, email: user.email },
        });
      });
      revalidatePath("/deal/[id]", "page");
      return { ok: true, dealPersonId: existing.id };
    }
    ```

    Re-run `npm test -- deal-people-actions`. Expect GREEN. Full `npm test` green.
  </action>
  <verify>
    <automated>npm test -- deal-people-actions &amp;&amp; npx tsc --noEmit &amp;&amp; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `app/deal/[id]/actions/people.ts` exists starting with `"use server";`
    - `grep "isRoleValidForTrack" app/deal/[id]/actions/people.ts` returns a match (PEOPLE-05 enforcement)
    - `grep "db.transaction" app/deal/[id]/actions/people.ts | wc -l` returns `2`
    - `grep "writeAuditLog" app/deal/[id]/actions/people.ts | wc -l` returns `>= 2` (upsert + remove; the free_text branch also writes a contact_create audit row, so count may be 3)
    - `grep "onConflictDoUpdate" app/deal/[id]/actions/people.ts` returns a match (UPSERT semantics)
    - `grep "revalidatePath(\"/deal/\\[id\\]\", \"page\")" app/deal/[id]/actions/people.ts` returns `>= 2`
    - `grep "source: \"deal_people_upsert\"" app/deal/[id]/actions/people.ts` returns a match
    - `grep "source: \"deal_people_remove\"" app/deal/[id]/actions/people.ts` returns a match
    - Test 3 (role-invalid-for-track) passes — validates the exact PEOPLE-05 enforcement message shape
    - Test 2 (second upsert for same slot produces exactly ONE row) passes — validates PEOPLE-02 single-row invariant at the app layer
    - All 12 test assertions pass
    - Full `npm test` green
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Deal-people write path ships with UPSERT semantics, PEOPLE-05 enforcement, rollback invariant, free-text lender branch, and full audit coverage using the new source vocab.</done>
</task>

</tasks>

<verification>
- Full `npm test` green (baseline + new P3 tests)
- `grep -rn "@/db/client" app/contacts/actions.ts app/deal/[id]/actions/people.ts` returns 0 (D-04 holds)
- `grep -rn "mainContact" app/contacts/actions.ts app/deal/[id]/actions/people.ts` returns 0 (new contact path does NOT write to deals.main_contact_* — that migration is Plan 06 concern)
- `npm run build` clean
</verification>

<success_criteria>
PEOPLE-01 + PEOPLE-02 + PEOPLE-05 write paths are live. Every slot mutation is atomic with audit. PEOPLE-05 rejects role-incompatible-with-track with a clear error (tested — Phase 3 Success Criterion 3 primary proof point is this exact test).
</success_criteria>

<output>
After completion, create `.planning/phases/03-people-map-contacts-registry/03-04-contact-and-deal-people-server-actions-SUMMARY.md` recording: new audit source vocab added to the app lexicon; rollback invariant proven; track-validity gate proven by the Success Criterion 3 test.
</output>
