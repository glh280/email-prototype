---
phase: 01-core-data-model
plan: 03
type: tdd
wave: 2
depends_on: [01-core-data-model/01]
files_modified:
  - drizzle/migrations/0004_next_file_no_function.sql
  - drizzle/migrations/meta/_journal.json
  - lib/file-no.ts
  - tests/unit/file-no.test.ts
autonomous: true
requirements: [DEAL-02a]
requirements_addressed: [DEAL-02a]

must_haves:
  truths:
    - "Postgres has a SQL function `next_file_no(state_code text)` that returns the next file_no for a given state and the current year"
    - "Per-year sequence `deals_file_no_{YYYY}_seq` is created lazily (first call of the year creates it)"
    - "Calling next_file_no('TX') twice returns TX-YYYY-0001 then TX-YYYY-0002 (counter is global across states within a year per DEAL-02a)"
    - "Passing NULL / empty state_code yields 'XX' prefix per DEAL-02a"
    - "`lib/file-no.ts::generateFileNo(tx, state)` wraps the SQL function for use in server actions; `tx` is typed as Drizzle's `PgTransaction` (not a loose duck-type)"
    - "`npm test tests/unit/file-no.test.ts` passes with tests covering: normal allocation, state=null → XX, sequential counter behavior, state uppercase normalization, collision safety under concurrent calls"
  artifacts:
    - path: "drizzle/migrations/0004_next_file_no_function.sql"
      provides: "Postgres function + trigger (if any) for file_no generation"
      contains: "CREATE OR REPLACE FUNCTION next_file_no"
    - path: "lib/file-no.ts"
      provides: "TS wrapper around the SQL function, for use inside Drizzle transactions"
      exports: ["generateFileNo"]
    - path: "tests/unit/file-no.test.ts"
      provides: "Unit tests against a real Postgres (or test schema)"
  key_links:
    - from: "lib/file-no.ts::generateFileNo"
      to: "next_file_no() SQL function"
      via: "Drizzle sql`SELECT next_file_no($state)`"
      pattern: "next_file_no"
    - from: "lib/file-no.ts"
      to: "lib/db.ts (canonical Drizzle client)"
      via: "tests import { db } from \"@/lib/db\" and call db.transaction(tx => generateFileNo(tx, ...))"
      pattern: "from \"@/lib/db\""
---

<objective>
Implement per-year Postgres sequence-based `file_no` generation per D-02 + DEAL-02a. Create a SQL function `next_file_no(state_code text)` that (a) lazily creates `deals_file_no_{YYYY}_seq` on first use of each year, (b) reads `nextval()`, and (c) returns a formatted string `{STATE|XX}-{YYYY}-{NNNN}` with 4-digit zero-padding. Wrap it in a typed TypeScript helper `lib/file-no.ts::generateFileNo(tx, state)` that server actions can call inside a transaction.

The wrapper's `tx` parameter MUST be typed as Drizzle's proper transaction type (`PgTransaction<...>`), NOT a duck-typed `{ execute: ... }` — otherwise Plan 05's caller (`db.transaction(async tx => ...)`) will have a structural-match that silently drifts across Drizzle versions.

Purpose: Implements DEAL-02a and D-02. Postgres sequences give collision-free atomicity without application-level locks; lazy creation avoids the need to pre-allocate sequences for every year in advance.
Output: SQL migration 0004 adding the function; typed TS wrapper; unit tests proving sequence semantics and state-code edge cases.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-core-data-model/01-CONTEXT.md
@.planning/phases/01-core-data-model/01-01-SUMMARY.md
@.planning/REQUIREMENTS.md
@db/schema/app.ts
@drizzle/migrations/0003_phase1_core_data_model.sql
@lib/crypto.ts
@lib/db.ts

<interfaces>
DEAL-02a (REQUIREMENTS.md, verbatim):
> `file_no` auto-generates on deal insert in format `{STATE}-{YYYY}-{NNNN}` where STATE is the 2-letter `property_state` upper-cased (or literal `XX` if `property_state` is null), YYYY is the 4-digit year at insert time, and NNNN is a zero-padded per-year counter that resets on January 1. `file_no` is immutable after insert. Counter is global across states within a given year (so `TX-2026-0005` and `CA-2026-0006` are sequential).

D-02 rationale confirms:
- Sequence per year (`deals_file_no_{YYYY}_seq`), NOT per-state
- Lazy creation: `CREATE SEQUENCE IF NOT EXISTS` inside the function
- `state_code` upper-cased; fallback `XX` if null

TypeScript wrapper signature target — use Drizzle's proper transaction type:
```typescript
// lib/file-no.ts
import { sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type * as schema from "@/db/schema";

// Drizzle's PgTransaction is generic over: QueryResultHKT, Schema, TablesRelationalConfig.
// For node-postgres with `drizzle(pool, { schema })`, use this exact alias:
export type AppTx = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export async function generateFileNo(
  tx: AppTx,
  stateCode: string | null | undefined,
): Promise<string>;
```

If the exact generic arity of `PgTransaction` differs in drizzle-orm 0.45.2 (the number or name of generics has evolved across minor versions), inspect `node_modules/drizzle-orm/pg-core/session.d.ts` and adjust the `AppTx` alias to match. The GOAL is: `db.transaction(async (tx) => generateFileNo(tx, ...))` must typecheck WITHOUT any `as` cast at the call site. If Drizzle's exact type is too intricate, the fallback is `PgTransaction<any, any, any>` — still far more specific than the previous duck-typed `{ execute }` shape.

Do NOT use the previous duck-typed signature `tx: { execute: (q: any) => Promise<any> }`. That signature is too loose — it accidentally matches any object with an `execute` method, and it defeats Drizzle's compile-time protection against passing a non-transaction object.

Canonical DB client (per Plan 01 Task 3): `lib/db.ts`. Tests import as `import { db } from "@/lib/db"`. DO NOT create `db/client.ts` — it does not exist.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write failing tests for file_no generator behavior (RED)</name>
  <files>tests/unit/file-no.test.ts</files>
  <read_first>
    - .planning/REQUIREMENTS.md (DEAL-02a verbatim)
    - .planning/phases/01-core-data-model/01-CONTEXT.md (D-02)
    - tests/unit/crypto.test.ts (established TDD pattern from P0.5 — use as reference for DB-connection test setup)
    - db/schema/app.ts (Deal table shape from Plan 01)
    - lib/db.ts (canonical Drizzle client — tests must `import { db } from "@/lib/db"`)
  </read_first>
  <behavior>
    Tests must cover, using a real Postgres connection (the repo already uses `pg` + local docker-compose Postgres; tests connect via the canonical `db` exported from `lib/db.ts` the same way crypto.test.ts does):

    - Test 1: `generateFileNo(tx, "TX")` on a clean DB returns a string matching `/^TX-\d{4}-0001$/` where `\d{4}` is the current year
    - Test 2: Two sequential calls with same state return sequential counters: "TX-YYYY-0001" then "TX-YYYY-0002"
    - Test 3: Calls interleaving states use one shared counter — `generateFileNo(tx, "TX")` then `generateFileNo(tx, "CA")` returns e.g. "TX-YYYY-0001" then "CA-YYYY-0002" (global-within-year per DEAL-02a)
    - Test 4: `generateFileNo(tx, null)` returns "XX-YYYY-NNNN" (literal XX prefix)
    - Test 5: `generateFileNo(tx, "")` returns "XX-YYYY-NNNN" (empty string → XX)
    - Test 6: `generateFileNo(tx, "tx")` returns "TX-YYYY-NNNN" (lowercase normalized to uppercase)
    - Test 7: `generateFileNo(tx, "TX")` from year Y and year Y+1 start independent counters (skip if the test can't manipulate the clock — but at minimum verify the sequence name matches the current year via a direct SELECT on `pg_sequences`)
    - Test 8 (optional stretch): Concurrent calls to `generateFileNo(tx, "TX")` inside Promise.all() produce no duplicate counters (sequence atomicity)
  </behavior>
  <action>
    Step 1 — Create `tests/unit/file-no.test.ts` following the crypto.test.ts pattern:
    - Use `beforeEach` to TRUNCATE the sequence (or DROP then recreate) — each test starts with counter at 1
    - Connect to Postgres via the canonical Drizzle client: `import { db } from "@/lib/db"`. Inside tests, call `await db.transaction(async (tx) => { const out = await generateFileNo(tx, "TX"); ... })` — this is the same calling pattern Plan 05 will use, so the tests exercise the real type contract
    - Write the 7 tests above. These tests MUST FAIL initially because `lib/file-no.ts` doesn't exist yet and the SQL function isn't defined.

    Step 2 — Run `npm test tests/unit/file-no.test.ts` and confirm all tests fail (RED state). Commit as "test(p1-03): add failing tests for file_no generator".

    IMPORTANT: The repo's canonical Drizzle client is `lib/db.ts` (confirmed in Plan 01 Task 3). Tests MUST import `{ db } from "@/lib/db"`. Do NOT create a `db/client.ts` — that path is forbidden.
  </action>
  <verify>
    <automated>npm test tests/unit/file-no.test.ts 2>&1 | grep -E "FAIL|failed|passed"</automated>
  </verify>
  <done>
    - tests/unit/file-no.test.ts exists with 7+ tests covering the behaviors listed
    - Running the tests reports all of them FAILING (since lib/file-no.ts doesn't exist yet and the SQL function isn't created)
    - Tests use real Postgres via `@/lib/db` (not a mock) — consistent with crypto.test.ts
  </done>
  <acceptance_criteria>
    - `ls tests/unit/file-no.test.ts` returns the file
    - `grep -E "generateFileNo|next_file_no" tests/unit/file-no.test.ts` returns 10+ matches
    - `grep "from \"@/lib/db\"" tests/unit/file-no.test.ts` returns a match (canonical client)
    - `grep -c "from \"@/db/client\"" tests/unit/file-no.test.ts` returns 0 (no stale import path)
    - `grep -E "TX-|CA-|XX-" tests/unit/file-no.test.ts` returns 8+ matches (testing prefix formats)
    - `grep -c "^  it\\(" tests/unit/file-no.test.ts` or equivalent returns 7+ (test count)
    - Running `npm test tests/unit/file-no.test.ts` reports failures (RED state — any non-zero count in "failed")
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create SQL migration + TS wrapper to make tests pass (GREEN)</name>
  <files>drizzle/migrations/0004_next_file_no_function.sql, drizzle/migrations/meta/_journal.json, lib/file-no.ts</files>
  <read_first>
    - tests/unit/file-no.test.ts (from Task 1 — the failing tests that drive this implementation)
    - drizzle/migrations/0003_*.sql (confirm current migration numbering — this is 0004)
    - drizzle/migrations/meta/_journal.json (to append a new entry manually — drizzle-kit won't regenerate SQL functions, only schema tables)
    - db/schema/app.ts (confirm deals table has file_no text unique not null)
    - lib/crypto.ts (pattern for a TS lib file that wraps a DB function — comment style, invariant enforcement)
    - lib/db.ts (canonical Drizzle client — for transaction-type derivation)
    - node_modules/drizzle-orm/pg-core/session.d.ts (MUST read to find the exact PgTransaction generic arity for drizzle-orm 0.45.2 — needed for the `AppTx` type alias in the wrapper)
    - node_modules/drizzle-orm/node-postgres/index.d.ts (confirm `NodePgQueryResultHKT` or equivalent driver-HKT type name)
  </read_first>
  <action>
    Because drizzle-kit `generate` only produces migrations for schema-object changes (tables / columns / indexes), not for custom SQL functions, this migration is hand-authored. Drizzle's migrator applies any `.sql` file in the migrations directory in journal order.

    Step 1 — Create `drizzle/migrations/0004_next_file_no_function.sql` with this exact content:

    ```sql
    -- Phase 1 Plan 03 — file_no auto-generation (DEAL-02a, D-02)
    -- Per-year Postgres sequence, lazy-created on first call.
    -- Counter is global across states within a year (TX-2026-0005, CA-2026-0006 are sequential).

    CREATE OR REPLACE FUNCTION next_file_no(state_code text)
    RETURNS text
    LANGUAGE plpgsql
    AS $$
    DECLARE
        current_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
        seq_name text := 'deals_file_no_' || current_year::text || '_seq';
        next_n bigint;
        normalized_state text;
    BEGIN
        -- Normalize state: null/empty → 'XX'; otherwise uppercase 2 chars
        IF state_code IS NULL OR length(trim(state_code)) = 0 THEN
            normalized_state := 'XX';
        ELSE
            normalized_state := upper(trim(state_code));
        END IF;

        -- Lazy-create the year's sequence (idempotent)
        EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START WITH 1', seq_name);

        -- Atomically get next value
        EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_n;

        RETURN normalized_state || '-' || current_year::text || '-' || lpad(next_n::text, 4, '0');
    END;
    $$;
    ```

    Step 2 — Append a journal entry to `drizzle/migrations/meta/_journal.json`:
    ```json
    {
      "idx": 4,
      "version": "<same as previous entry's version>",
      "when": <Date.now() numeric>,
      "tag": "0004_next_file_no_function",
      "breakpoints": true
    }
    ```
    Check the existing journal format and match it exactly (the `version` and other fields may differ — copy-then-adapt).

    Step 3 — Create `lib/file-no.ts` with a PROPERLY-TYPED `tx` parameter (Drizzle's `PgTransaction`, not a duck type):
    ```typescript
    import { sql } from "drizzle-orm";
    import type { PgTransaction } from "drizzle-orm/pg-core";
    import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
    import type { ExtractTablesWithRelations } from "drizzle-orm";
    import type * as schema from "@/db/schema";

    /**
     * Drizzle transaction type for this app's (node-postgres + typed schema) setup.
     *
     * Derived from lib/db.ts — `drizzle(pool, { schema })` with the node-postgres
     * driver. If Plan 05's `db.transaction(async tx => ...)` caller does NOT match
     * this type, that's a sign the DB client was reconfigured; adjust this alias.
     */
    export type AppTx = PgTransaction<
      NodePgQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >;

    /**
     * Generates the next file_no for a deal insert.
     *
     * Must be called inside the same transaction that inserts the deal, so the
     * returned file_no is consistent with the deal row. Postgres guarantees
     * atomicity of `nextval()` — two concurrent callers will never get the same
     * number.
     *
     * DEAL-02a format: {STATE|XX}-{YYYY}-{NNNN}
     *
     * @param tx - Drizzle transaction (from `db.transaction(async tx => ...)`)
     * @param stateCode - 2-letter state code; null/empty → "XX"
     * @returns the assigned file_no string
     */
    export async function generateFileNo(
      tx: AppTx,
      stateCode: string | null | undefined,
    ): Promise<string> {
      const normalized = stateCode && stateCode.trim().length > 0
        ? stateCode.trim()
        : null;
      const result = await tx.execute(
        sql`SELECT next_file_no(${normalized}) AS file_no`,
      );
      // Drizzle's execute() result shape: normally { rows: [{ file_no: "..." }] }
      // but can vary by driver — check both shapes defensively.
      const rows = (result as { rows?: Array<{ file_no: string }> }).rows
        ?? (result as unknown as Array<{ file_no: string }>);
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row || typeof row.file_no !== "string") {
        throw new Error("generateFileNo: unexpected SELECT result shape");
      }
      return row.file_no;
    }
    ```

    **IMPORTANT**: Before committing, run `npx tsc --noEmit lib/file-no.ts` and confirm it exits 0. If the `PgTransaction` generic arity in drizzle-orm 0.45.2 doesn't match (e.g., Drizzle expects 2 or 4 generics instead of 3, or `NodePgQueryResultHKT` is named differently), read `node_modules/drizzle-orm/pg-core/session.d.ts` and `node_modules/drizzle-orm/node-postgres/index.d.ts` to find the exact shape and adjust the `AppTx` alias. As a last resort, `AppTx = PgTransaction<any, any, any>` is acceptable — still stricter than the previous duck-typed `{ execute }` signature. DO NOT revert to `tx: { execute: ... }` — that's the bug we're fixing.

    If the installed `drizzle-orm` 0.45.2 exposes a different `.execute()` return shape, adjust the unwrapping accordingly — inspect `node_modules/drizzle-orm/pg-core/session.d.ts` or wherever the return type is declared. Do not guess.

    Step 4 — Apply the migration: `npm run db:migrate`. Verify with:
    ```sql
    SELECT proname FROM pg_proc WHERE proname = 'next_file_no';
    -- should return 1 row
    SELECT next_file_no('TX');
    -- should return 'TX-YYYY-0001' (with current year)
    ```

    Step 5 — Run the test suite: `npm test tests/unit/file-no.test.ts`. All 7 tests MUST pass (GREEN). If any fail, fix the SQL function or wrapper — do not modify the tests.

    Step 6 — Commit in two steps to preserve the TDD record: first "feat(p1-03): SQL function next_file_no" (migration + db state), then "feat(p1-03): TS wrapper + tests green" (lib/file-no.ts).
  </action>
  <verify>
    <automated>npm test tests/unit/file-no.test.ts</automated>
  </verify>
  <done>
    - `drizzle/migrations/0004_next_file_no_function.sql` exists with the `next_file_no` function as specified
    - `drizzle/migrations/meta/_journal.json` has an entry for 0004
    - `lib/file-no.ts` exports `generateFileNo` and `AppTx` with a proper `PgTransaction` type (NOT duck-typed `{ execute }`)
    - `npx tsc --noEmit lib/file-no.ts` exits 0 (typing compiles cleanly)
    - `npm run db:migrate` applies 0004 cleanly; re-running is idempotent
    - Postgres has the function (`SELECT proname FROM pg_proc WHERE proname = 'next_file_no';` returns 1 row)
    - `npm test tests/unit/file-no.test.ts` exits 0 with all tests passing (GREEN)
  </done>
  <acceptance_criteria>
    - `ls drizzle/migrations/0004_next_file_no_function.sql lib/file-no.ts` shows both files
    - `grep "CREATE OR REPLACE FUNCTION next_file_no" drizzle/migrations/0004_next_file_no_function.sql` returns a match
    - `grep "CREATE SEQUENCE IF NOT EXISTS" drizzle/migrations/0004_next_file_no_function.sql` returns a match (lazy creation)
    - `grep "lpad" drizzle/migrations/0004_next_file_no_function.sql` returns a match (4-digit zero-pad)
    - `grep "'XX'" drizzle/migrations/0004_next_file_no_function.sql` returns a match (null → XX fallback)
    - `grep "export async function generateFileNo" lib/file-no.ts` returns a match
    - `grep "next_file_no" lib/file-no.ts` returns a match (wrapper calls the SQL function)
    - `grep "PgTransaction" lib/file-no.ts` returns at least 1 match (proper Drizzle tx type — NOT duck-typed)
    - `grep -c "{ execute: (q: any)" lib/file-no.ts` returns 0 (the old duck-type is gone)
    - `npx tsc --noEmit lib/file-no.ts` exits 0 (or equivalently, a whole-project `npx tsc --noEmit` passes)
    - `npm test tests/unit/file-no.test.ts` exits 0 with all 7+ tests passing
    - `grep "\"idx\": 4" drizzle/migrations/meta/_journal.json` returns a match (journal updated)
  </acceptance_criteria>
</task>

</tasks>

<verification>
1. `npm test tests/unit/file-no.test.ts` exits 0 (all tests green)
2. `npm run db:migrate` (idempotent re-run) exits 0 with no pending migrations
3. All prior tests (tests/unit/env.test.ts, crypto.test.ts, access.test.ts, schema-shape.test.ts) still pass
4. Direct SQL `SELECT next_file_no('TX')` returns a valid TX-YYYY-NNNN string
5. `lib/file-no.ts` typechecks with a proper `PgTransaction` signature (no duck-typing)
</verification>

<success_criteria>
- DEAL-02a fully implemented at the database layer: format, state normalization (upper + null→XX), per-year counter, global-within-year increment, immutability implied by unique constraint on `deals.file_no` (set in Plan 01)
- TS wrapper `generateFileNo` usable inside Plan 05's server action, with a type contract strict enough to catch misuse (Drizzle `PgTransaction`, not `{ execute }`)
- TDD discipline: RED commit → GREEN commit, tests in place to catch future regressions
</success_criteria>

<output>
After completion, create `.planning/phases/01-core-data-model/01-03-SUMMARY.md` documenting:
- The SQL function definition + rationale (lazy sequence creation, normalization rules)
- The `AppTx` type alias — the exact Drizzle `PgTransaction<...>` shape used, and WHY duck-typing was rejected
- Any driver-shape surprises in the `.execute()` unwrapping
- TDD record (RED commit SHA → GREEN commit SHA if committed separately)
- Open questions for Plan 05's consumer (e.g., "must be called inside the same transaction as the INSERT")
</output>
