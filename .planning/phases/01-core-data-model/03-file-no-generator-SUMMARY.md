---
phase: 01-core-data-model
plan: 03
subsystem: database
tags: [drizzle, postgres, sequence, plpgsql, tdd, file-no]

# Dependency graph
requires:
  - phase: 01-core-data-model/01
    provides: deals.file_no column (text, not null, unique) + @/lib/db canonical client
provides:
  - SQL function next_file_no(state_code text) — per-year sequence, lazy-created
  - TypeScript wrapper lib/file-no.ts::generateFileNo(tx, stateCode)
  - AppTx type alias (PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>) — the proper Drizzle tx type that Plan 05's server action will use
affects: [01-core-data-model/05-new-deal-form, 04-seed-tracks-and-stages, template-extraction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-authored SQL migrations for pg functions (drizzle-kit only generates schema-object migrations)"
    - "Lazy Postgres sequence CREATE IF NOT EXISTS inside plpgsql function — no pre-allocation of yearly sequences"
    - "Typed Drizzle transaction parameter via PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>> — not duck-typed { execute }"
    - "Real-Postgres integration tests in tests/unit/ — beforeEach/afterAll clean up the year sequence via raw DROP IF EXISTS"

key-files:
  created:
    - drizzle/migrations/0004_next_file_no_function.sql
    - lib/file-no.ts
    - tests/unit/file-no.test.ts
  modified:
    - drizzle/migrations/meta/_journal.json

key-decisions:
  - "Normalize state_code in BOTH TS and SQL layers (defence in depth: caller passes JS null → SQL receives SQL NULL → function returns 'XX'). TS-side normalization is additive, not authoritative."
  - "AppTx = PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>. drizzle-orm 0.45.2 exposes PgTransaction with exactly 3 generics; NodePgQueryResultHKT is re-exported from drizzle-orm/node-postgres. No fallback to PgTransaction<any,any,any> was needed."
  - "Drizzle's `.execute()` return is QueryResult<Record<string, unknown>>; narrowing to { file_no: string } requires casting through 'unknown' first to satisfy TypeScript's structural-subtype guard. Documented in both wrapper and test."
  - "Test isolation via DROP SEQUENCE IF EXISTS in beforeEach (not TRUNCATE — sequences don't support TRUNCATE). Function re-creates the sequence lazily on first call per test."

patterns-established:
  - "Pattern 1: SQL-function migrations are hand-authored .sql files with matching _journal.json entries (idx, when, tag). drizzle-kit generate does NOT produce them."
  - "Pattern 2: Real-Postgres unit tests in tests/unit/ — can coexist with mocked ones; dynamic `import('@/lib/db')` inside beforeAll defers module load until env is set."
  - "Pattern 3: Wrapper functions around pg functions cast through `as unknown as { rows?: ... }` to narrow Drizzle's generic QueryResult<Record<string,unknown>> to the known column shape."
  - "Pattern 4: Normalize nullable inputs at TS/SQL boundary — function accepts JS null/undefined/empty-string, passes SQL NULL, SQL function returns 'XX'."

requirements-completed: [DEAL-02a]

# Metrics
duration: 6m
completed: 2026-04-17
---

# Phase 01 Plan 03: file_no Generator Summary

**Postgres `next_file_no(state_code)` plpgsql function with lazy per-year sequence, plus properly-typed `generateFileNo(tx, state)` TS wrapper over drizzle-orm 0.45.2's `PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>`.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-17T22:12:36Z
- **Completed:** 2026-04-17T22:18:40Z
- **Tasks:** 2 (Task 1 TDD RED, Task 2 TDD GREEN + refactor)
- **Files created:** 3 (migration SQL, lib/file-no.ts, tests/unit/file-no.test.ts)
- **Files modified:** 1 (drizzle/migrations/meta/_journal.json)

## Accomplishments

- **SQL function `next_file_no(state_code text)`** — lazy-creates `deals_file_no_{YYYY}_seq`, calls `nextval()`, returns `'{STATE|XX}-{YYYY}-{NNNN}'` with 4-digit zero-pad. Postgres guarantees atomicity of `nextval()` — proven by Test 8 (10 concurrent calls yield no duplicate counters).
- **State normalization** per DEAL-02a: null/empty/whitespace → literal `'XX'`; non-empty → `upper(trim(state_code))`. Handled in the SQL function so callers can pass `null` safely.
- **Global-within-year counter** — Test 3 confirms `TX` then `CA` yields `TX-YYYY-0001` then `CA-YYYY-0002` (one shared sequence, not per-state).
- **TS wrapper `generateFileNo(tx, stateCode)`** with a proper `AppTx` type alias. This fixes the prior planning concern about loose duck-typing (`{ execute: (q:any) => Promise<any> }`), which would accidentally match non-transaction objects. The `AppTx` type resolves cleanly in drizzle-orm 0.45.2 with no `as any` escape hatch.
- **Migration 0004** hand-authored (drizzle-kit only generates schema-object migrations, not SQL functions). Journal entry `{ idx: 4, tag: "0004_next_file_no_function" }` added to `_journal.json`. Idempotent re-run of `npm run db:migrate` verified.
- **TDD record:** RED commit `521e965` → GREEN SQL commit `3b061f2` → GREEN wrapper commit `2de5b1a` → refactor commit `1f0cb3f`. 8 tests fail in RED (module-load error), all 8 pass in GREEN.

## Task Commits

1. **Task 1 (TDD RED): failing tests for generateFileNo / next_file_no** — `521e965` (test)
2. **Task 2a (GREEN, SQL side): migration 0004 + journal entry** — `3b061f2` (feat)
3. **Task 2b (GREEN, TS side): lib/file-no.ts + test typing fix** — `2de5b1a` (feat)
4. **Task 2c (REFACTOR): rephrase duck-type rationale comment** — `1f0cb3f` (refactor) — reworded a comment that literally quoted `{ execute: (q: any) => Promise<any> }` for documentation, since the plan's acceptance grep for that exact string is designed to flag real duck-typed signatures.

**Plan metadata commit:** produced after SUMMARY.md write.

## Files Created/Modified

- **Created** `drizzle/migrations/0004_next_file_no_function.sql` — 29 lines of plpgsql. `CREATE OR REPLACE FUNCTION next_file_no(state_code text) RETURNS text LANGUAGE plpgsql`. Computes `current_year := EXTRACT(YEAR FROM CURRENT_DATE)`, derives `seq_name`, normalizes state (null/empty → 'XX' else `upper(trim(state_code))`), `EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START WITH 1', seq_name)`, then `EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_n`, concatenates result.
- **Created** `lib/file-no.ts` — exports `AppTx` type alias and `generateFileNo(tx, stateCode)` async function. Uses `sql\`SELECT next_file_no(${normalized}) AS file_no\`` through `tx.execute()`, narrows `QueryResult<Record<string,unknown>>` to `{ rows?: Array<{ file_no: string }> }` via `as unknown as ...` (required: Drizzle's generic row shape doesn't structurally overlap).
- **Created** `tests/unit/file-no.test.ts` — 8 real-Postgres tests. `beforeAll` dynamic-imports `@/lib/db` and `@/lib/file-no` (after env setup); `beforeEach` runs `DROP SEQUENCE IF EXISTS deals_file_no_{YYYY}_seq`; `afterAll` cleans up. Tests 1–6 cover normal allocation + edge cases; Test 7 verifies the sequence name via `pg_sequences`; Test 8 (stretch) fires 10 concurrent `Promise.all` calls and asserts no duplicate counters.
- **Modified** `drizzle/migrations/meta/_journal.json` — appended idx:4 entry for `0004_next_file_no_function`.

## Decisions Made

- **Defence-in-depth normalization** (not in the plan, logged here): the TS wrapper trims/collapses empty→null *before* the SQL call, and the SQL function re-normalizes. This means a misuse like `generateFileNo(tx, "  ")` produces `XX-YYYY-NNNN` cleanly: TS trims to empty → passes `null` → SQL sees NULL → returns 'XX'. If future callers bypass the wrapper and call the SQL function directly with `''` or `'  '`, they still get the correct result.
- **Cast through `unknown` for Drizzle's `.execute()` result** — drizzle-orm 0.45.2 types `.execute()` as `QueryResult<Record<string, unknown>>`. Narrowing to `{ file_no: string }` without going through `unknown` is a TS2352 error. Documented inline.

## Deviations from Plan

None that change behavior. Three minor reconciliations worth calling out:

### Type-import reconciliation (not a rule-deviation)

The plan's example test imports were `let db: typeof import("@/lib/db").db` and `let generateFileNo: typeof import("@/lib/file-no").generateFileNo`. At actual compile time in this repo, `typeof import(...)` resolved the `transaction` overload to `never`, producing 15+ TS7006 errors. Resolution: import `AppTx` directly from `@/lib/file-no` and construct the `generateFileNo` signature explicitly. Functionally identical; a typing clean-up.

### `QueryResult` cast-through-`unknown` (documented, not a deviation)

The plan's wrapper sketch used `result as { rows?: ... }`. Drizzle's generic `QueryResult<Record<string, unknown>>` doesn't structurally overlap with `{ rows?: Array<{ file_no: string }> }`, so TypeScript emits TS2352 unless the cast goes through `unknown`. The plan noted "if the installed drizzle-orm 0.45.2 exposes a different .execute() return shape, adjust the unwrapping accordingly — inspect the file, do not guess." The adjustment is this cast-through-unknown.

### Refactor commit to satisfy acceptance grep

The plan's acceptance criterion #9 is `grep -c "{ execute: (q: any)" lib/file-no.ts` returns 0. My initial wrapper put that literal string in a documentation comment explaining what the PgTransaction type rejects. I reworded the comment in commit `1f0cb3f`. Intent of the acceptance grep was clearly "no real duck-typed signature" — the grep now returns 0 and the rationale is preserved in prose.

## Issues Encountered

None that blocked. The typing-paperwork iterations above surfaced during verification (`npx tsc --noEmit`), were fixed in-task, and did not require plan revision.

## User Setup Required

None — local Postgres (already running via docker-compose) is all that's needed. No new env vars, no vendor config.

## Next Phase Readiness

- **Plan 04 (seed tracks + stages):** unblocked. Independent of this plan — seeds pre-existing tables.
- **Plan 05 (new-deal form + server action):** unblocked. Server action can now `import { db } from "@/lib/db"`, wrap the insert in `db.transaction(async tx => { const fileNo = await generateFileNo(tx, propertyState); await tx.insert(deals).values({ ..., fileNo }); })`. Type safety is enforced — passing anything other than a real Drizzle tx to `generateFileNo` is a compile error.
- **Plan 06 (list view rewrite):** unblocked — doesn't touch file_no.

### Open questions for Plan 05's consumer

1. **Transaction contract** — `generateFileNo` MUST be called inside the same transaction as the deal insert. The `AppTx` type enforces this at compile time, but the developer still has to choose to call it. Plan 05's server action template should include this pattern explicitly.
2. **Year rollover** — the function uses `CURRENT_DATE` (Postgres server time) to compute the year. If the Postgres server timezone differs from the app timezone, a deal created at 23:50 local on Dec 31 might land in the current or next year's sequence depending on UTC vs local. Acceptable for v1 (Carrie's TZ matches server TZ on Railway US-east), but worth noting if the product ever ships multi-TZ.
3. **Immutability** — DEAL-02a says `file_no` is immutable after insert. Plan 01 added a UNIQUE constraint (prevents duplicate inserts), but there is no trigger or column-level immutability enforcement — an `UPDATE deals SET file_no = '...'` would succeed at the DB level. The plan accepted this as "implied by unique constraint" (see Plan 01 success criteria). If P2/P5 wants hard enforcement, add a `BEFORE UPDATE` trigger that raises on `NEW.file_no <> OLD.file_no`. Not needed for v1.

## Known Stubs

None. The SQL function is live, the wrapper is fully implemented, the sequence atomicity is proven by a real-concurrency test, and no placeholder values are used anywhere.

## Self-Check

- [x] `drizzle/migrations/0004_next_file_no_function.sql` exists — FOUND
- [x] `lib/file-no.ts` exists — FOUND
- [x] `tests/unit/file-no.test.ts` exists — FOUND
- [x] `drizzle/migrations/meta/_journal.json` has idx:4 entry — FOUND
- [x] Commit `521e965` (TDD RED test commit) exists — FOUND
- [x] Commit `3b061f2` (feat SQL migration) exists — FOUND
- [x] Commit `2de5b1a` (feat wrapper + test typing) exists — FOUND
- [x] Commit `1f0cb3f` (refactor comment rephrase) exists — FOUND
- [x] `npm test tests/unit/file-no.test.ts` → 8/8 green — VERIFIED
- [x] `npm test` (full suite) → 36/36 green — VERIFIED (no regressions in env/crypto/access/schema-shape)
- [x] `npx tsc --noEmit` exits 0 — VERIFIED
- [x] `npm run build` succeeds — VERIFIED
- [x] `npm run db:migrate` idempotent re-run → exit 0, no pending migrations — VERIFIED
- [x] `SELECT next_file_no('TX')` returns `TX-2026-0001` — VERIFIED via docker exec psql
- [x] `SELECT proname FROM pg_proc WHERE proname = 'next_file_no'` returns 1 row — VERIFIED
- [x] 6 of 6 must_haves.truths verified:
  - [x] SQL function `next_file_no(state_code text)` exists and returns state + year + counter — VERIFIED (psql)
  - [x] Per-year sequence `deals_file_no_{YYYY}_seq` created lazily — VERIFIED (Test 7 queries pg_sequences)
  - [x] `next_file_no('TX')` twice → `TX-YYYY-0001` / `TX-YYYY-0002` — VERIFIED (Test 2)
  - [x] NULL / empty state_code → 'XX' prefix — VERIFIED (Test 4, Test 5)
  - [x] `lib/file-no.ts::generateFileNo(tx, state)` wraps the SQL function with `tx: AppTx` (proper PgTransaction, not duck-type) — VERIFIED (`grep "PgTransaction" lib/file-no.ts` returns 4 matches)
  - [x] `npm test tests/unit/file-no.test.ts` passes covering all 6 specified behaviors + global-within-year + atomicity — VERIFIED
- [x] Requirement DEAL-02a marked complete — pending `requirements mark-complete` below

## Self-Check: PASSED

---
*Phase: 01-core-data-model*
*Completed: 2026-04-17*
