---
phase: 01-core-data-model
plan: 05
type: execute
wave: 3
depends_on: [01-core-data-model/01, 01-core-data-model/02, 01-core-data-model/03, 01-core-data-model/04]
files_modified:
  - app/deal/new/page.tsx
  - app/deal/new/new-deal-form.tsx
  - app/deal/new/actions.ts
  - lib/deal-schema.ts
  - lib/audit.ts
  - lib/parse-money.ts
  - app/layout.tsx
  - components/ui/form.tsx
  - components/ui/label.tsx
  - components/ui/calendar.tsx
  - components/ui/accordion.tsx
  - tests/unit/create-deal-action.test.ts
  - tests/unit/parse-money.test.ts
autonomous: true
requirements: [DEAL-02, DEAL-02a, DEAL-03, OPS-01]
requirements_addressed: [DEAL-02, DEAL-02a, DEAL-03, OPS-01]

must_haves:
  truths:
    - "Route `/deal/new` renders the sectioned-accordion form per UI-SPEC page 2"
    - "Submitting a valid form creates a deals row with auto-generated file_no in format {STATE|XX}-{YYYY}-{NNNN}"
    - "On successful create, the server writes an audit_log row with operation='create', user_id populated from getCurrentUser(), after_json containing the full deal row"
    - "Deal is created with status='active', stage_id=pre_screen_qualification, created_by=current user, internal_owner=current user (defaults to created_by per D-18)"
    - "Submit redirects to `/` with a success toast showing the assigned file_no"
    - "Money fields ($-prefix inputs like sales_price, loan_amount, estimated_down, earnest_money, est_rehab, arv) accept formats like `$485,000`, `485000`, `485,000` and normalize to integer USD before validation"
    - "Track `<Select>` options render with a colored dot (track badge color) to the left of each label per UI-SPEC"
    - "`npm test tests/unit/create-deal-action.test.ts` passes — tests cover success path, file_no format, audit row presence, validation rejection"
    - "`npm test tests/unit/parse-money.test.ts` passes — covers $-prefix, comma grouping, null/empty, invalid"
  artifacts:
    - path: "app/deal/new/page.tsx"
      provides: "Server Component wrapping the form; loads tracks + computes file_no preview"
    - path: "app/deal/new/new-deal-form.tsx"
      provides: "Client Component (`'use client'`) — react-hook-form + Zod resolver, sectioned accordion UI"
    - path: "app/deal/new/actions.ts"
      provides: "'use server' — createDeal(input) → { ok: true, fileNo } | { ok: false, errors }"
      exports: ["createDeal"]
    - path: "lib/deal-schema.ts"
      provides: "Zod schema shared between form and server action"
      exports: ["createDealSchema", "CreateDealInput"]
    - path: "lib/audit.ts"
      provides: "writeAuditLog(tx, { tableName, recordId, operation, beforeJson, afterJson, user })"
      exports: ["writeAuditLog"]
    - path: "lib/parse-money.ts"
      provides: "parseMoney(raw) — normalizes '$485,000' → 485000; handles null/empty/invalid"
      exports: ["parseMoney"]
  key_links:
    - from: "app/deal/new/new-deal-form.tsx"
      to: "app/deal/new/actions.ts::createDeal"
      via: "form onSubmit → await createDeal(data)"
      pattern: "createDeal\\("
    - from: "app/deal/new/actions.ts"
      to: "lib/file-no.ts::generateFileNo"
      via: "inside db.transaction(async tx => ...)"
      pattern: "generateFileNo\\(tx"
    - from: "app/deal/new/actions.ts"
      to: "lib/audit.ts::writeAuditLog"
      via: "inside same transaction as the deal insert"
      pattern: "writeAuditLog\\(tx"
    - from: "app/deal/new/new-deal-form.tsx"
      to: "lib/parse-money.ts::parseMoney"
      via: "onBlur handlers for money fields"
      pattern: "parseMoney\\("
---

<objective>
Ship `/deal/new` — the New Deal form per UI-SPEC page 2 and CONTEXT D-08/D-09/D-10/D-11/D-17/D-18/D-19. Inside a single transaction, the server action: (a) validates input via Zod, (b) generates the next file_no via `generateFileNo` (from Plan 03), (c) inserts the deal with status='active', stage=pre_screen_qualification, created_by=internal_owner=current user, (d) writes an audit_log row for the create mutation per D-05/OPS-01. Redirects to `/` on success with a toast.

Purpose: Implements DEAL-03 (user creates deals via form), closes the last chunk of DEAL-02 (all the fields land), exercises DEAL-02a (file_no auto-gen), and kicks off OPS-01 (audit-log writes on create).
Output: Working `/deal/new` route, validated form with functional $-prefix money parsing, server action, audit-log wiring, shared Zod schema, unit tests on the action + money parser.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-core-data-model/01-CONTEXT.md
@.planning/phases/01-core-data-model/01-UI-SPEC.md
@.planning/phases/01-core-data-model/01-01-SUMMARY.md
@.planning/phases/01-core-data-model/01-03-SUMMARY.md
@.planning/phases/01-core-data-model/01-04-SUMMARY.md
@db/schema/app.ts
@db/seed/tracks.ts
@db/seed/stages.ts
@lib/file-no.ts
@lib/current-user.ts
@lib/users.ts
@lib/db.ts
@components/app-header.tsx
@app/layout.tsx
@AGENTS.md

<interfaces>
From lib/current-user.ts:
```typescript
export async function getCurrentUser(): Promise<User>;  // throws if no CF Access JWT
```

From lib/file-no.ts (Plan 03):
```typescript
import type { PgTransaction } from "drizzle-orm/pg-core";
export type AppTx = PgTransaction<...>;  // the exact Drizzle tx type
export async function generateFileNo(
  tx: AppTx,
  stateCode: string | null | undefined,
): Promise<string>;
```

The Plan 05 caller MUST just do `await db.transaction(async (tx) => { const fileNo = await generateFileNo(tx, input.propertyState ?? null); ... })`. NO cast required — the `tx` from `db.transaction` will match `AppTx` structurally.

From lib/db.ts (canonical Drizzle client — Plan 01 Task 3):
```typescript
import { drizzle } from "drizzle-orm/node-postgres";
export const db = drizzle(pool, { schema });
```
All imports in this plan MUST use `import { db } from "@/lib/db"`. DO NOT use `@/db/client` — that path does not exist.

From db/schema/app.ts (Plan 01) — the deals table columns relevant here:
- trackId: uuid NOT NULL (FK tracks)
- stageId: uuid NOT NULL (FK stages)
- fileNo: text UNIQUE NOT NULL
- title: text NOT NULL
- priority: text NOT NULL (HIGH|MEDIUM|LOW CHECK)
- status: text NOT NULL DEFAULT 'active'
- mainContactName / Email / Phone: text NULL
- propertyAddress / State / Type: text NULL
- salesPrice, loanAmount, estimatedDown, earnestMoney, estRehab, arv: integer NULL (whole USD)
- loanType, transactionType: text NULL
- titleCtc, lenderCtc: boolean NOT NULL DEFAULT false
- closingAt, fundingAt: timestamptz NULL
- createdBy: uuid NOT NULL FK users
- internalOwner: uuid NULL FK users
- openedAt, createdAt, updatedAt: timestamptz DEFAULT now()

Next.js 16 server action pattern — PER AGENTS.md, verify in node_modules/next/dist/docs/ before writing. Do NOT rely on training data. Key things to confirm:
- `'use server'` file directive usage
- Return type expected by `<form action={...}>` vs programmatic invocation from a client component
- `redirect()` behavior — does it throw? where can it be called from?
- `revalidatePath("/")` usage for invalidating the list-view cache after create

UI-SPEC page 2 locked decisions (copy verbatim; DO NOT redesign):
- Container: `max-w-[720px] mx-auto`
- Back link: `Back to deals` → `/`
- H1: `New Deal`
- Subtitle: `Fill in the basics — you can edit the rest after it's created.`
- 3 accordion sections: `File basics` (open), `Property details` (collapsed), `Financials & dates` (collapsed)
- Section 1 fields: Track (req), Priority (req), Title (req), Property state (optional), File # preview (read-only pill), Main Contact name (optional), Main Contact email (optional)
- Section 2 fields: Property address, Property type (select: single_family, multi_family, condo, townhome, commercial, land, other), Sales price ($ prefix), Loan type (select: conventional, dscr, hard_money, bridge, transactional, cash, other), Transaction type (select: purchase, refinance, wholesale, double_close, other)
- Section 3 fields: Loan amount, Estimated down, Earnest money, Est. rehab, ARV, Closing date, Funding date, Title CTC (checkbox), Lender CTC (checkbox)
- Section 3 layout: `grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4`
- Sticky footer: Cancel (outline → `/`) + Create Deal (primary)
- On submit success: redirect to `/` with toast `Deal {file_no} created.`
- On submit validation error: scroll to first invalid field + focus + toast `Please fix the errors above.`
- Required asterisk: `<span class="text-destructive">*</span>`
- Submit spinner: `Loader2` with `animate-spin`, label changes to `Creating…`
- Field help text on property state: `Used in the file number. Leave blank and the file number will start with XX.`
- File # preview: `Will be assigned: ~{STATE or XX}-{YYYY}-{nnnn}` (best-effort estimate per UI-SPEC assumption 4)
- **Track Select option rendering**: each `<SelectItem>` renders a small colored dot (the track's badge color from `lib/format.ts::trackBadgeClasses` — reusable in Plan 06) + the label. Dot is an inline span with the track's bg-color class, `h-2 w-2 rounded-full`, `mr-2`.

Money fields: UI renders `$` prefix, parses to integer USD via `parseMoney(raw)` on blur (`$485,000` → 485000). Store as integer (whole dollars) in Phase 1 — a future money-type refactor can happen if decimals matter.

Validation copy (verbatim from UI-SPEC):
- Required blank: `{Field label} is required.`
- Email format: `That email doesn't look right.`
- Decimal format: `Enter a number like 485000 or 485,000.`
</interfaces>
</context>

<notes>
<!-- Non-blocking UI-SPEC items explicitly waived in this plan (addressed in later phases per CONTEXT D-08..D-16 user direction "revisit after seeing it working") -->

- **Per-section progress counter** ("3 / 5 filled" meta in each accordion section header, per UI-SPEC Page 2): **DEFERRED.** Per CONTEXT.md D-08..D-16 direction — ship the form first, revisit after Carrie uses it for real. Adding the counter now invites premature polish on a surface that may get re-shaped once we see how it's used. Re-open as P1-follow-up ticket after first Carrie usage session.
</notes>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: parseMoney helper + unit tests</name>
  <files>lib/parse-money.ts, tests/unit/parse-money.test.ts</files>
  <read_first>
    - .planning/phases/01-core-data-model/01-UI-SPEC.md (money field formatting section)
    - lib/crypto.ts (reference for simple pure TS lib file with JSDoc)
  </read_first>
  <behavior>
    - Test 1: `parseMoney("")` returns `null`
    - Test 2: `parseMoney(null)` returns `null`
    - Test 3: `parseMoney(undefined)` returns `null`
    - Test 4: `parseMoney("485000")` returns `485000`
    - Test 5: `parseMoney("485,000")` returns `485000`
    - Test 6: `parseMoney("$485,000")` returns `485000`
    - Test 7: `parseMoney("$ 485,000 ")` (extra whitespace) returns `485000`
    - Test 8: `parseMoney("0")` returns `0` (NOT null — explicit zero is a valid entry)
    - Test 9: `parseMoney("485,000.75")` returns `485000` (P1 stores whole USD; truncate, don't round — safe default; future money-type refactor can reshape)
    - Test 10: `parseMoney("abc")` returns `null` (non-numeric garbage — tolerant)
    - Test 11: `parseMoney("-50")` returns `null` (negative amounts don't make sense for any of the deal money fields — Zod validates `nonnegative()`, but parseMoney should also reject so the UI can flag it)
  </behavior>
  <action>
    Create `lib/parse-money.ts`:

    ```typescript
    /**
     * Parse a user-typed money string into integer USD (whole dollars).
     *
     * Accepts:
     *   - "485000"       → 485000
     *   - "485,000"      → 485000
     *   - "$485,000"     → 485000
     *   - "$ 485,000 "   → 485000
     *   - "485,000.75"   → 485000  (P1 stores whole USD; decimals truncated)
     *   - "0"            → 0
     *
     * Returns null for:
     *   - null / undefined / "" / whitespace-only
     *   - Non-numeric strings ("abc")
     *   - Negative amounts ("-50")
     *
     * Used on blur from $-prefix inputs in the New Deal form.
     */
    export function parseMoney(raw: string | null | undefined): number | null {
      if (raw === null || raw === undefined) return null;
      const trimmed = String(raw).trim();
      if (trimmed === "") return null;

      // Strip $ and commas; keep digits, dot, and leading minus
      const cleaned = trimmed.replace(/[$,\s]/g, "");
      if (cleaned === "") return null;

      // Reject negative numbers explicitly (money fields are non-negative)
      if (cleaned.startsWith("-")) return null;

      const parsed = Number.parseFloat(cleaned);
      if (!Number.isFinite(parsed)) return null;
      if (parsed < 0) return null;

      return Math.trunc(parsed);  // whole USD — truncate decimals
    }
    ```

    Create `tests/unit/parse-money.test.ts` covering the 11 behaviors. Pure vitest, no DB.
  </action>
  <verify>
    <automated>npm test tests/unit/parse-money.test.ts</automated>
  </verify>
  <done>
    - lib/parse-money.ts exports parseMoney
    - tests/unit/parse-money.test.ts covers 11+ cases (null, empty, plain int, comma, $-prefix, whitespace, zero, decimal-truncate, garbage, negative)
    - `npm test tests/unit/parse-money.test.ts` exits 0
  </done>
  <acceptance_criteria>
    - `ls lib/parse-money.ts tests/unit/parse-money.test.ts` shows both files
    - `grep "export function parseMoney" lib/parse-money.ts` returns a match
    - `grep -E "toBe\\(485000\\)|toBe\\(null\\)|toBe\\(0\\)" tests/unit/parse-money.test.ts` returns 8+ matches
    - `npm test tests/unit/parse-money.test.ts` exits 0 with 11+ passing
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Shared Zod schema + writeAuditLog helper + createDeal server action</name>
  <files>lib/deal-schema.ts, lib/audit.ts, app/deal/new/actions.ts, tests/unit/create-deal-action.test.ts</files>
  <read_first>
    - .planning/phases/01-core-data-model/01-CONTEXT.md (D-08 through D-19 — field set, D-10 default stage, D-17/D-18 ownership, D-19 status, D-05 audit shape)
    - .planning/phases/01-core-data-model/01-UI-SPEC.md (verbatim field list + validation copy + required-field markers)
    - db/schema/app.ts (deals + auditLog + tracks + stages — column types drive Zod shape)
    - db/seed/tracks.ts (TRACK_SEEDS — 8 codes for track enum)
    - db/seed/stages.ts (STAGE_SEEDS — `pre_screen_qualification` is the default on insert per D-10)
    - lib/file-no.ts (Plan 03 — generateFileNo signature + tx requirement; exports `AppTx`)
    - lib/current-user.ts (getCurrentUser() returns User)
    - lib/db.ts (CANONICAL Drizzle client — import as `import { db } from "@/lib/db"`; do NOT use `@/db/client`)
    - lib/crypto.ts (reference for non-skippable-invariant TS pattern — audit-log invariant mirrors this)
    - node_modules/next/dist/docs/ (Next.js 16 server action patterns — confirm 'use server' semantics)
  </read_first>
  <behavior>
    Tests for `createDeal(input)`:
    - Test 1: Given valid input, returns `{ ok: true, fileNo: /^[A-Z]{2}-\d{4}-\d{4}$/ }` and inserts a deals row whose file_no matches
    - Test 2: Inserted deal has stage_id = the universal `pre_screen_qualification` stage (D-10)
    - Test 3: Inserted deal has status='active', created_by = current user id, internal_owner = created_by (defaults per D-18)
    - Test 4: After successful insert, exactly one new audit_log row exists with tableName='deals', recordId=new deal id, operation='create', userEmail=current user email, beforeJson=null, afterJson non-null (D-05)
    - Test 5: Given property_state='TX', file_no starts with 'TX-'; given property_state=null, file_no starts with 'XX-'
    - Test 6: Given invalid input (missing required title), returns `{ ok: false, errors: { title: [...] } }` and NO deals row is inserted, NO audit row is written
    - Test 7: Invariant — if deal insert succeeds but audit insert fails, the transaction rolls back (no deal row either). Test by stubbing writeAuditLog to throw; assert the deals count is unchanged.
    - Test 8 (money fields round-trip): Given input with salesPrice=485000 and loanAmount=300000, the inserted row has those exact integer values (confirms schema stores integer USD correctly via the server-action path — end-to-end money handling)
  </behavior>
  <action>
    Step 1 — Create `lib/deal-schema.ts`:
    ```typescript
    import { z } from "zod";

    export const createDealSchema = z.object({
      // Section 1 — File basics
      trackCode: z.enum(["TE","FL","DP","PO","EC","SL","BL","GI"], {
        message: "Track is required.",
      }),
      priority: z.enum(["HIGH","MEDIUM","LOW"], { message: "Priority is required." }),
      title: z.string().trim().min(1, "Title is required.").max(200),
      propertyState: z.string().trim().length(2).toUpperCase().nullable().optional(),
      mainContactName: z.string().trim().max(200).nullable().optional(),
      mainContactEmail: z.string().trim().email("That email doesn't look right.").nullable().optional().or(z.literal("")),

      // Section 2 — Property details
      propertyAddress: z.string().trim().max(300).nullable().optional(),
      propertyType: z.enum([
        "single_family","multi_family","condo","townhome","commercial","land","other",
      ]).nullable().optional(),
      salesPrice: z.number().int().nonnegative().nullable().optional(),
      loanType: z.enum([
        "conventional","dscr","hard_money","bridge","transactional","cash","other",
      ]).nullable().optional(),
      transactionType: z.enum([
        "purchase","refinance","wholesale","double_close","other",
      ]).nullable().optional(),

      // Section 3 — Financials & dates
      loanAmount: z.number().int().nonnegative().nullable().optional(),
      estimatedDown: z.number().int().nonnegative().nullable().optional(),
      earnestMoney: z.number().int().nonnegative().nullable().optional(),
      estRehab: z.number().int().nonnegative().nullable().optional(),
      arv: z.number().int().nonnegative().nullable().optional(),
      closingAt: z.coerce.date().nullable().optional(),
      fundingAt: z.coerce.date().nullable().optional(),
      titleCtc: z.boolean().default(false),
      lenderCtc: z.boolean().default(false),
    });

    export type CreateDealInput = z.infer<typeof createDealSchema>;
    ```

    Confirm Zod 4.3.6 syntax (installed version) — z.enum error-messages landed in Zod 3.23+, but Zod 4 may have moved this API. Inspect node_modules/zod's dist types before writing. Adjust accordingly — do not assume.

    Step 2 — Create `lib/audit.ts`:
    ```typescript
    import { auditLog } from "@/db/schema";
    import type { User } from "@/db/schema";
    import type { AppTx } from "@/lib/file-no";

    /**
     * Writes one audit_log row inside an open transaction.
     *
     * MUST be called inside the same transaction as the mutation being audited,
     * so that if the audit write fails the mutation also rolls back. This is the
     * OPS-01 / D-05 contract — every mutation leaves a trail.
     */
    export async function writeAuditLog(
      tx: AppTx,
      params: {
        tableName: string;
        recordId: string;
        operation: "create" | "update" | "delete";
        beforeJson: unknown | null;
        afterJson: unknown;
        user: Pick<User, "id" | "email">;
      }
    ): Promise<void> {
      await tx.insert(auditLog).values({
        tableName: params.tableName,
        recordId: params.recordId,
        operation: params.operation,
        beforeJson: params.beforeJson as any,
        afterJson: params.afterJson as any,
        userId: params.user.id,
        userEmail: params.user.email,
      });
    }
    ```

    Re-using `AppTx` from `lib/file-no.ts` keeps the transaction-parameter typing consistent across `generateFileNo` and `writeAuditLog`. If that type alias doesn't fit cleanly (e.g., `lib/audit.ts` shouldn't depend on `lib/file-no.ts` semantically), duplicate the `AppTx` derivation here — but use the SAME `PgTransaction<...>` shape.

    Step 3 — Create `app/deal/new/actions.ts`:
    ```typescript
    "use server";

    import { redirect } from "next/navigation";
    import { revalidatePath } from "next/cache";
    import { eq, and, isNull } from "drizzle-orm";
    import { getCurrentUser } from "@/lib/current-user";
    import { generateFileNo } from "@/lib/file-no";
    import { writeAuditLog } from "@/lib/audit";
    import { createDealSchema, type CreateDealInput } from "@/lib/deal-schema";
    import { tracks, stages, deals } from "@/db/schema";
    import { db } from "@/lib/db";  // CANONICAL Drizzle client (Plan 01 Task 3). DO NOT use @/db/client.

    export type CreateDealResult =
      | { ok: true; fileNo: string; dealId: string }
      | { ok: false; errors: Record<string, string[]> };

    export async function createDeal(raw: unknown): Promise<CreateDealResult> {
      // 1. Validate
      const parsed = createDealSchema.safeParse(raw);
      if (!parsed.success) {
        return { ok: false, errors: parsed.error.flatten().fieldErrors as any };
      }
      const input = parsed.data;

      // 2. Current user
      const user = await getCurrentUser();

      // 3. Transaction: resolve track id, resolve universal pre_screen_qualification stage id, generate file_no, insert deal, write audit
      const result = await db.transaction(async (tx) => {
        const [track] = await tx.select().from(tracks).where(eq(tracks.code, input.trackCode)).limit(1);
        if (!track) throw new Error(`Unknown track code: ${input.trackCode}`);

        const [defaultStage] = await tx.select().from(stages)
          .where(and(eq(stages.code, "pre_screen_qualification"), isNull(stages.trackId)))
          .limit(1);
        if (!defaultStage) throw new Error("Default stage pre_screen_qualification not seeded — run npm run db:seed");

        // Plan 03 wrapper accepts AppTx; the tx from db.transaction matches it — no cast needed.
        const fileNo = await generateFileNo(tx, input.propertyState ?? null);

        const [newDeal] = await tx.insert(deals).values({
          trackId: track.id,
          stageId: defaultStage.id,
          fileNo,
          title: input.title,
          priority: input.priority,
          status: "active",
          mainContactName: input.mainContactName ?? null,
          mainContactEmail: input.mainContactEmail || null,
          propertyAddress: input.propertyAddress ?? null,
          propertyState: input.propertyState ?? null,
          propertyType: input.propertyType ?? null,
          salesPrice: input.salesPrice ?? null,
          loanType: input.loanType ?? null,
          transactionType: input.transactionType ?? null,
          loanAmount: input.loanAmount ?? null,
          estimatedDown: input.estimatedDown ?? null,
          earnestMoney: input.earnestMoney ?? null,
          estRehab: input.estRehab ?? null,
          arv: input.arv ?? null,
          closingAt: input.closingAt ?? null,
          fundingAt: input.fundingAt ?? null,
          titleCtc: input.titleCtc,
          lenderCtc: input.lenderCtc,
          createdBy: user.id,
          internalOwner: user.id,  // D-18: defaults to created_by on insert
        }).returning();

        // D-05: audit the create inside the same transaction
        await writeAuditLog(tx, {
          tableName: "deals",
          recordId: newDeal.id,
          operation: "create",
          beforeJson: null,
          afterJson: newDeal,
          user: { id: user.id, email: user.email },
        });

        return { fileNo: newDeal.fileNo, dealId: newDeal.id };
      });

      // 4. Revalidate list view and redirect
      revalidatePath("/");
      // Pass the fileNo via a URL param so the list view can emit the toast
      redirect(`/?created=${encodeURIComponent(result.fileNo)}`);
    }
    ```

    CRITICAL: `redirect()` in Next.js 16 throws a special error to signal navigation. It MUST be called AFTER the try/catch (not inside) and AFTER revalidatePath. Do NOT wrap it in try/catch — verify this in the Next.js 16 docs at node_modules/next/dist/docs/ before writing.

    **DB-client path**: `import { db } from "@/lib/db"` is the ONLY correct path. The string `@/db/client` MUST NOT appear anywhere in this plan's output files. Plan 01 Task 3 enforces zero stale references — this plan must preserve that.

    Step 4 — Write `tests/unit/create-deal-action.test.ts` covering the 8 behaviors. Pattern follows crypto.test.ts (real DB, cleanup per test via TRUNCATE). Key setup: the test needs a valid user row (the `current_user` FK). Create a test user directly via `db.insert(users)...` in `beforeAll` (importing `{ db } from "@/lib/db"`), then stub `getCurrentUser` via `vi.mock("@/lib/current-user", ...)` to return that user. Between tests, TRUNCATE deals, audit_log, and reset the file_no sequence (`ALTER SEQUENCE deals_file_no_YYYY_seq RESTART WITH 1;`).

    For Test 7 (audit-row-failure rollback invariant), stub `writeAuditLog` with `vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn().mockRejectedValue(new Error('boom')) }))` inside a describe block, call createDeal, expect it to throw, then assert `SELECT COUNT(*) FROM deals WHERE file_no = <predicted>` returns 0.

    For Test 8 (money round-trip), pass `salesPrice: 485000, loanAmount: 300000` in the input and assert the inserted row has those exact integer values via `db.select().from(deals).where(eq(deals.id, dealId))`.

    Step 5 — Run the tests: `npm test tests/unit/create-deal-action.test.ts`. All 8 must pass.
  </action>
  <verify>
    <automated>npm test tests/unit/create-deal-action.test.ts</automated>
  </verify>
  <done>
    - lib/deal-schema.ts, lib/audit.ts, app/deal/new/actions.ts all exist
    - createDeal() on valid input creates a deal with file_no, writes one audit row, both inside a single transaction
    - On schema error returns `{ ok: false, errors }` with no DB mutation
    - On audit-insert failure, the deal insert rolls back (transaction atomicity)
    - Money fields (salesPrice, loanAmount, etc.) round-trip as integer USD
    - `npm test tests/unit/create-deal-action.test.ts` exits 0 with all 8+ tests passing
  </done>
  <acceptance_criteria>
    - `ls lib/deal-schema.ts lib/audit.ts app/deal/new/actions.ts tests/unit/create-deal-action.test.ts` shows all 4 files
    - `grep "export const createDealSchema" lib/deal-schema.ts` returns a match
    - `grep "export async function writeAuditLog" lib/audit.ts` returns a match
    - `grep "export async function createDeal" app/deal/new/actions.ts` returns a match
    - `grep "\"use server\"" app/deal/new/actions.ts` returns a match on line 1 or 2
    - `grep "from \"@/lib/db\"" app/deal/new/actions.ts` returns a match (CANONICAL client path)
    - `grep -c "from \"@/db/client\"" app/deal/new/actions.ts` returns 0 (no stale path)
    - `grep "generateFileNo" app/deal/new/actions.ts` returns a match
    - `grep "writeAuditLog" app/deal/new/actions.ts` returns a match
    - `grep "db.transaction" app/deal/new/actions.ts` returns a match (single-transaction atomicity)
    - `grep "pre_screen_qualification" app/deal/new/actions.ts` returns a match (D-10 default stage)
    - `grep "internalOwner: user.id" app/deal/new/actions.ts` returns a match (D-18)
    - `grep -c "^  it\\(\\|^    it\\(" tests/unit/create-deal-action.test.ts` returns 8+ (test count)
    - `npm test tests/unit/create-deal-action.test.ts` exits 0
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Install shadcn form/label/calendar/accordion primitives + global Toaster</name>
  <files>components/ui/form.tsx, components/ui/label.tsx, components/ui/calendar.tsx, components/ui/accordion.tsx, app/layout.tsx, package.json</files>
  <read_first>
    - components/ui/ (existing shadcn primitives for style/convention)
    - .planning/phases/01-core-data-model/01-UI-SPEC.md ("New primitives to install in Phase 1" section — lists `form label calendar accordion`)
    - app/layout.tsx (current state — check if Toaster is already mounted)
    - components/ui/sonner.tsx (existing shadcn Sonner wrapper to import)
    - AGENTS.md (Next.js 16 — layout.tsx RSC signature)
  </read_first>
  <action>
    Step 1 — Install the four shadcn primitives:
    ```bash
    npx shadcn@latest add form label calendar accordion
    ```

    The CLI will write `components/ui/form.tsx`, `components/ui/label.tsx`, `components/ui/calendar.tsx`, and `components/ui/accordion.tsx`. It may also add dependencies to `package.json` (react-hook-form, @hookform/resolvers, react-day-picker for Calendar — confirm which). If the CLI prompts for overwrite on anything, decline (preserve existing styling).

    Step 2 — Mount the Toaster globally in `app/layout.tsx`. Add this import and the Toaster JSX inside the `<body>` after children:
    ```tsx
    import { Toaster } from "@/components/ui/sonner";
    // ...
    <body>
      {children}
      <Toaster />
    </body>
    ```

    If Toaster is already mounted (check by `grep Toaster app/layout.tsx` first), skip this.

    Step 3 — Verify the installed primitives by checking exports:
    - `form.tsx` should export `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField`
    - `accordion.tsx` should export `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`

    Step 4 — Confirm `react-hook-form` and `@hookform/resolvers` are now in `package.json` dependencies (added by the shadcn form CLI). If not, add manually: `npm install react-hook-form @hookform/resolvers`.
  </action>
  <verify>
    <automated>ls components/ui/form.tsx components/ui/label.tsx components/ui/calendar.tsx components/ui/accordion.tsx &amp;&amp; npm run build</automated>
  </verify>
  <done>
    - The four new components exist in components/ui/
    - react-hook-form and @hookform/resolvers are in package.json deps
    - app/layout.tsx mounts `<Toaster />`
    - `npm run build` exits 0
  </done>
  <acceptance_criteria>
    - `ls components/ui/form.tsx components/ui/label.tsx components/ui/calendar.tsx components/ui/accordion.tsx` shows all 4 files
    - `grep "export.*FormField" components/ui/form.tsx` returns a match
    - `grep "export.*AccordionTrigger" components/ui/accordion.tsx` returns a match
    - `grep "Toaster" app/layout.tsx` returns at least one match
    - `grep -E "\"react-hook-form\"|\"@hookform/resolvers\"" package.json` returns 2 matches
    - `npm run build` exits 0
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 4: Build the New Deal form UI — page.tsx + new-deal-form.tsx (with $-prefix money parsing + Track color dots)</name>
  <files>app/deal/new/page.tsx, app/deal/new/new-deal-form.tsx</files>
  <read_first>
    - .planning/phases/01-core-data-model/01-UI-SPEC.md (Page 2 — New Deal form section; read ALL of it — field list, validation copy, sticky footer, file_no preview, toast copy; also "Track Select option color dot" requirement)
    - .planning/phases/01-core-data-model/01-CONTEXT.md (D-08, D-09, D-10, D-11 — accordion layout, always-visible property section, default stage, validation UX)
    - lib/deal-schema.ts (from Task 2 — CreateDealInput shape)
    - lib/parse-money.ts (from Task 1 — parseMoney helper; USE in money field onBlur)
    - app/deal/new/actions.ts (from Task 2 — createDeal signature and result shape)
    - db/seed/tracks.ts (TRACK_SEEDS — for the Track select options + default-priority prefill)
    - components/ui/form.tsx, accordion.tsx, calendar.tsx (from Task 3 — primitives available)
    - components/app-header.tsx (page chrome pattern)
    - app/page.tsx (current page structure to follow for Server Component boilerplate)
    - lib/db.ts (canonical Drizzle client — for the file-no-preview query)
    - AGENTS.md (Next.js 16 server/client component boundary rules)
  </read_first>
  <action>
    Step 1 — Create `app/deal/new/page.tsx` (Server Component). NOTE: this page imports the CANONICAL Drizzle client from `@/lib/db`, not `@/db/client`:
    ```tsx
    import { AppHeader } from "@/components/app-header";
    import Link from "next/link";
    import { ChevronLeft } from "lucide-react";
    import { NewDealForm } from "./new-deal-form";
    import { db } from "@/lib/db";  // CANONICAL Drizzle client (Plan 01 Task 3). DO NOT use @/db/client.
    import { deals } from "@/db/schema";
    import { sql } from "drizzle-orm";
    import { TRACK_SEEDS } from "@/db/seed/tracks";

    export default async function NewDealPage() {
      // Best-effort file_no preview (UI-SPEC assumption 4): count of deals created this year + 1
      const [{ count }] = await db.execute(sql`
        SELECT COUNT(*)::int AS count FROM deals
        WHERE created_at >= date_trunc('year', CURRENT_DATE)
      ` as any) as unknown as Array<{ count: number }>;
      const currentYear = new Date().getFullYear();
      const nextEstimate = String(count + 1).padStart(4, "0");

      return (
        <>
          <AppHeader />
          <main className="mx-auto max-w-[720px] px-6 py-6">
            <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
              <ChevronLeft className="h-4 w-4" />
              Back to deals
            </Link>
            <h1 className="text-xl font-semibold">New Deal</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Fill in the basics — you can edit the rest after it's created.
            </p>
            <div className="mt-6 pb-24">
              <NewDealForm
                tracks={TRACK_SEEDS}
                currentYear={currentYear}
                fileNoEstimate={nextEstimate}
              />
            </div>
          </main>
        </>
      );
    }
    ```

    If the `db.execute(sql``)` unwrapping shape differs from Plan 03's findings, adjust. The estimate failing gracefully is OK — if the query errors, default to "0001".

    Step 2 — Create `app/deal/new/new-deal-form.tsx` (Client Component, `'use client'` at top).

    This is the bulk of the work. Follow UI-SPEC Page 2 section-by-section. Key structure:

    ```tsx
    'use client';

    import { useState, useTransition } from "react";
    import { useForm } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { toast } from "sonner";
    import Link from "next/link";
    import { Loader2 } from "lucide-react";
    import { Button } from "@/components/ui/button";
    import { Input } from "@/components/ui/input";
    import { Checkbox } from "@/components/ui/checkbox";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
    import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
    import { createDealSchema, type CreateDealInput } from "@/lib/deal-schema";
    import { createDeal } from "./actions";
    import { parseMoney } from "@/lib/parse-money";
    import type { NewTrack } from "@/db/schema";

    const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];
    const PROPERTY_TYPES = [["single_family","Single Family"],["multi_family","Multi Family"],["condo","Condo"],["townhome","Townhome"],["commercial","Commercial"],["land","Land"],["other","Other"]] as const;
    const LOAN_TYPES = [["conventional","Conventional"],["dscr","DSCR"],["hard_money","Hard Money"],["bridge","Bridge"],["transactional","Transactional"],["cash","Cash"],["other","Other"]] as const;
    const TRANSACTION_TYPES = [["purchase","Purchase"],["refinance","Refinance"],["wholesale","Wholesale"],["double_close","Double Close"],["other","Other"]] as const;

    // Track badge color map (matches lib/format.ts in Plan 06; keep in sync). Used for the
    // colored dot beside each Track <SelectItem> label per UI-SPEC.
    const TRACK_DOT_CLASSES: Record<string, string> = {
      TE: "bg-blue-500",
      FL: "bg-green-500",
      DP: "bg-purple-500",
      PO: "bg-pink-500",
      EC: "bg-amber-500",
      SL: "bg-rose-500",
      BL: "bg-teal-500",
      GI: "bg-gray-400",
    };

    export function NewDealForm(props: {
      tracks: Pick<NewTrack, "code" | "label" | "defaultPriority" | "sortOrder">[];
      currentYear: number;
      fileNoEstimate: string;
    }) {
      const form = useForm<CreateDealInput>({
        resolver: zodResolver(createDealSchema),
        defaultValues: {
          trackCode: undefined,
          priority: undefined,
          title: "",
          propertyState: undefined,
          mainContactName: "",
          mainContactEmail: "",
          titleCtc: false,
          lenderCtc: false,
        },
      });

      const [isPending, startTransition] = useTransition();

      // Track selection prefills Priority with track's defaultPriority (D-08 rationale)
      const selectedTrackCode = form.watch("trackCode");
      const selectedState = form.watch("propertyState");

      const onSubmit = (data: CreateDealInput) => {
        startTransition(async () => {
          const result = await createDeal(data);
          if (!result.ok) {
            // Apply server-side errors to the form
            for (const [field, msgs] of Object.entries(result.errors)) {
              form.setError(field as any, { message: msgs[0] });
            }
            toast.error("Please fix the errors above.");
            // Scroll to first invalid field
            requestAnimationFrame(() => {
              const firstError = document.querySelector('[aria-invalid="true"]') as HTMLElement | null;
              firstError?.scrollIntoView({ block: "center", behavior: "smooth" });
              firstError?.focus();
            });
          }
          // On success, createDeal redirects — nothing else to do here
        });
      };

      const onInvalid = () => {
        toast.error("Please fix the errors above.");
        requestAnimationFrame(() => {
          const firstError = document.querySelector('[aria-invalid="true"]') as HTMLElement | null;
          firstError?.scrollIntoView({ block: "center", behavior: "smooth" });
          firstError?.focus();
        });
      };

      const prefix = selectedState ? selectedState.toUpperCase() : "XX";

      // Reusable money-field onBlur handler. Parses raw string via parseMoney
      // and writes the integer (or null) back to the form field.
      const makeMoneyBlurHandler = (fieldName: keyof CreateDealInput) =>
        (e: React.FocusEvent<HTMLInputElement>) => {
          const parsed = parseMoney(e.target.value);
          form.setValue(fieldName as any, parsed as any, { shouldValidate: true });
          // Re-render the input with a normalized display string
          e.target.value = parsed === null ? "" : `$${parsed.toLocaleString("en-US")}`;
        };

      return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
            <Accordion type="multiple" defaultValue={["file-basics"]}>
              {/* Section 1 — File basics */}
              <AccordionItem value="file-basics">
                <AccordionTrigger>File basics</AccordionTrigger>
                <AccordionContent className="space-y-4 p-6 pt-2">
                  {/* Track */}
                  <FormField control={form.control} name="trackCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Track <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={(v) => {
                        field.onChange(v);
                        const t = props.tracks.find(tt => tt.code === v);
                        if (t) form.setValue("priority", t.defaultPriority as any);
                      }} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a track" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {props.tracks.map(t => (
                            <SelectItem key={t.code} value={t.code}>
                              <span className="flex items-center">
                                <span
                                  className={`inline-block h-2 w-2 rounded-full mr-2 ${TRACK_DOT_CLASSES[t.code] ?? "bg-gray-400"}`}
                                  aria-hidden="true"
                                />
                                {t.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {/* Priority */}
                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="HIGH">HIGH</SelectItem>
                          <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                          <SelectItem value="LOW">LOW</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {/* Title */}
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormDescription>A short name to recognize this file at a glance.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {/* Property state */}
                  <FormField control={form.control} name="propertyState" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property state</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="(none — file # starts with XX)" /></SelectTrigger></FormControl>
                        <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormDescription>Used in the file number. Leave blank and the file number will start with XX.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {/* File # preview */}
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground font-mono">
                    Will be assigned: ~{prefix}-{props.currentYear}-{props.fileNoEstimate}
                  </div>
                  {/* Main Contact name + email */}
                  <FormField control={form.control} name="mainContactName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Main Contact name</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="mainContactEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Main Contact email</FormLabel>
                      <FormControl><Input type="email" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </AccordionContent>
              </AccordionItem>

              {/* Section 2 — Property details (collapsed by default) */}
              <AccordionItem value="property-details">
                <AccordionTrigger>Property details</AccordionTrigger>
                <AccordionContent className="space-y-4 p-6 pt-2">
                  {/* propertyAddress — plain text input */}
                  {/* propertyType — Select */}
                  {/* salesPrice — $-prefix input using makeMoneyBlurHandler("salesPrice") */}
                  {/* loanType — Select */}
                  {/* transactionType — Select */}
                  {/* ... render each field following the Section 1 pattern ... */}
                </AccordionContent>
              </AccordionItem>

              {/* Section 3 — Financials & dates (2-col grid on ≥640px) */}
              <AccordionItem value="financials">
                <AccordionTrigger>Financials &amp; dates</AccordionTrigger>
                <AccordionContent className="p-6 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    {/* loanAmount, estimatedDown, earnestMoney, estRehab, arv: Input with $ prefix AND onBlur={makeMoneyBlurHandler("fieldName")} */}
                    {/* closingAt, fundingAt: Popover + Calendar trigger */}
                    {/* titleCtc, lenderCtc: Checkbox + label */}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Sticky footer */}
            <div className="sticky bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur px-6 py-3 flex items-center justify-end gap-2">
              <Button asChild variant="outline" type="button"><Link href="/">Cancel</Link></Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating…</> : "Create Deal"}
              </Button>
            </div>
          </form>
        </Form>
      );
    }
    ```

    COMPLETE the Section 2 and Section 3 field rendering following the Section 1 pattern. For each money input ($-prefix), render `<Input>` inside a relative-positioned wrapper with a leading `<span>$</span>` absolute-positioned at left, wire `onBlur={makeMoneyBlurHandler("<fieldName>")}` using the helper defined above. The helper uses `parseMoney` from `lib/parse-money.ts` — every $-prefix field gets the same behavior (pasted `$485,000` → stored as integer 485000, display re-renders as `$485,000`). For date pickers, use `<Popover>` + `<Calendar mode="single">` from the installed primitives, rendering `Apr 24, 2026` on selection and an `X` clear button.

    Do NOT skip fields. Every field listed in UI-SPEC sections 2 and 3 must be rendered — that's DEAL-02's full field set (property_address, property_type, sales_price, loan_type, transaction_type, loan_amount, estimated_down, earnest_money, est_rehab, arv, closing_at, funding_at, title_ctc, lender_ctc). Every `<Input>` for a money field MUST wire `onBlur={makeMoneyBlurHandler("<fieldName>")}`.

    Step 3 — Build and smoke-test:
    ```bash
    npm run build
    ```
    Build must succeed. Then `npm run dev` and visit http://localhost:3000/deal/new — verify: back link works, all 3 accordion sections expand, selecting a track prefills priority, Track Select options show colored dots, typing `$485,000` in Sales price and tabbing out re-renders as `$485,000` and submits as integer 485000.
  </action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <done>
    - `app/deal/new/page.tsx` + `app/deal/new/new-deal-form.tsx` exist
    - Page renders: header, back link, title, subtitle, 3-section accordion (section 1 open), sticky footer
    - All DEAL-02 fields are present as form inputs (track, priority, title, property_state, main_contact_name/email, property_address, property_type, sales_price, loan_type, transaction_type, loan_amount, estimated_down, earnest_money, est_rehab, arv, closing_at, funding_at, title_ctc, lender_ctc)
    - Track selection prefills Priority with track's default (D-08 hover rationale)
    - Track `<SelectItem>` options render a colored dot (per UI-SPEC) beside each label
    - Money fields (all 6: salesPrice, loanAmount, estimatedDown, earnestMoney, estRehab, arv) wire `onBlur` to `parseMoney` via the shared helper
    - Property-state selection updates the File # preview pill prefix
    - Required fields show red asterisk
    - Submit calls server action; invalid submit scrolls to + focuses first error + fires toast
    - `npm run build` exits 0
  </done>
  <acceptance_criteria>
    - `ls app/deal/new/page.tsx app/deal/new/new-deal-form.tsx` shows both files
    - `grep "New Deal" app/deal/new/page.tsx` returns a match (h1 copy)
    - `grep "Back to deals" app/deal/new/page.tsx` returns a match (link copy)
    - `grep "Fill in the basics" app/deal/new/page.tsx` returns a match (subtitle verbatim)
    - `grep "from \"@/lib/db\"" app/deal/new/page.tsx` returns a match (CANONICAL client path)
    - `grep -c "from \"@/db/client\"" app/deal/new/page.tsx` returns 0 (no stale path)
    - `grep "'use client'" app/deal/new/new-deal-form.tsx` returns a match on an early line
    - `grep "zodResolver" app/deal/new/new-deal-form.tsx` returns a match
    - `grep "createDeal" app/deal/new/new-deal-form.tsx` returns a match (server action wired)
    - `grep "parseMoney" app/deal/new/new-deal-form.tsx` returns at least 1 match (money helper imported)
    - `grep -E "makeMoneyBlurHandler|onBlur.*parseMoney" app/deal/new/new-deal-form.tsx` returns at least 1 match
    - `grep "TRACK_DOT_CLASSES" app/deal/new/new-deal-form.tsx` returns at least 2 matches (defined + used)
    - `grep -E "rounded-full.*mr-2|h-2 w-2 rounded-full" app/deal/new/new-deal-form.tsx` returns at least 1 match (Track Select color dot)
    - `grep -E "trackCode|priority|title|propertyState|mainContactName|mainContactEmail|propertyAddress|propertyType|salesPrice|loanType|transactionType|loanAmount|estimatedDown|earnestMoney|estRehab|arv|closingAt|fundingAt|titleCtc|lenderCtc" app/deal/new/new-deal-form.tsx` returns 20+ matches (every DEAL-02 field)
    - `grep "File basics" app/deal/new/new-deal-form.tsx` returns a match (section 1 header verbatim)
    - `grep "Property details" app/deal/new/new-deal-form.tsx` returns a match
    - `grep "Financials" app/deal/new/new-deal-form.tsx` returns a match
    - `grep "Will be assigned" app/deal/new/new-deal-form.tsx` returns a match (file_no preview)
    - `grep "Please fix the errors above" app/deal/new/new-deal-form.tsx` returns a match (toast copy verbatim)
    - `grep -E "Create Deal|Creating" app/deal/new/new-deal-form.tsx` returns 2+ matches (submit button + spinner label)
    - `grep "text-destructive" app/deal/new/new-deal-form.tsx` returns at least one match (red asterisk for required fields)
    - `npm run build` exits 0
  </acceptance_criteria>
</task>

</tasks>

<verification>
1. `npm test tests/unit/parse-money.test.ts` exits 0
2. `npm test tests/unit/create-deal-action.test.ts` exits 0
3. `npm run build` exits 0
4. No file in this plan's output references `@/db/client` (grep returns 0)
5. Manual smoke (optional but recommended): `npm run dev` → visit `/deal/new` → submit a minimal valid form → verify a deals row + audit_log row were created with matching file_no; type `$485,000` in salesPrice and confirm the server-stored value is the integer 485000.
</verification>

<success_criteria>
- DEAL-03 shipped: `/deal/new` route exists and creates deals
- DEAL-02 shipped: form captures every field listed in the requirement
- DEAL-02a exercised end-to-end: createDeal uses generateFileNo (Plan 03) inside a transaction
- OPS-01 partial: audit_log row written on deal.create with full before/after discipline
- D-08/D-09/D-10/D-11 honored: accordion layout, always-visible property section, default stage, validation UX
- D-17/D-18/D-19 honored: created_by + internal_owner + status='active' set on insert
- Money inputs accept $-prefix / comma-formatted text and store as integer USD (W5 addressed)
- Track Select options render colored dots per UI-SPEC (W7 addressed)
- DB-client convention honored: all imports use `@/lib/db`; `@/db/client` is absent (B1 addressed)
</success_criteria>

<output>
After completion, create `.planning/phases/01-core-data-model/01-05-SUMMARY.md` documenting:
- Route + component topology (server/client boundary)
- The createDeal transaction sequence (find track → find default stage → generate file_no → insert deal → write audit → redirect)
- Any Next.js 16 server-action gotchas encountered (vs. training data)
- Any shadcn form pattern tweaks from the defaults
- The `parseMoney` helper's behavior table + where it's wired (every $-prefix onBlur)
- The Track color-dot map and note that it mirrors `lib/format.ts::trackBadgeClasses` added in Plan 06
- Decisions implemented with IDs (D-08, D-09, D-10, D-11, D-17, D-18, D-19)
- Explicit waiver: per-section progress counter DEFERRED per CONTEXT.md D-08..D-16 "revisit after seeing it working"
- Open follow-ups for Plan 06 (the list view needs to read the `?created=` param to fire the success toast)
</output>
