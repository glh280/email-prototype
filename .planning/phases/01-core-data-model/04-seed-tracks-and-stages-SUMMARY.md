---
phase: 01-core-data-model
plan: 04
subsystem: database
tags: [drizzle, postgres, seed, upsert, idempotent, tracks, stages]

# Dependency graph
requires:
  - phase: 01-core-data-model
    plan: 01
    provides: tracks table (6 cols, unique code), stages table (6 cols, FK→tracks nullable), @/lib/db canonical client
provides:
  - db/seed/tracks.ts (TRACK_SEEDS — 8 rows, DEAL-01)
  - db/seed/stages.ts (STAGE_SEEDS — 25 rows, STAGE-01; 4 universal + 10 TE + 11 FL)
  - db/seed/run.ts (idempotent `onConflictDoUpdate` seeder — resolves stage FKs via code→id lookup)
  - package.json db:seed script (tsx entrypoint)
  - Seed-shape unit tests (13 assertions encoding DEAL-01 + STAGE-01 verbatim)
affects: [05-new-deal-form, 06-list-view-rewrite, 10-calibration-week]

# Tech tracking
tech-stack:
  added: []  # tsx already in devDependencies from prior plan
  patterns:
    - "Dynamic `import()` inside `main()` after `config()` so `@/lib/env` Zod validation sees loaded dotenv values (works around ESM import hoisting)"
    - "Upsert keyed by business code via `onConflictDoUpdate({ target: tracks.code })` — never by primary key / never TRUNCATE"
    - "`excluded.<col>` SQL reference for upsert `set` clauses — portable across drivers"
    - "Seeder resolves cross-table FKs at insert time via `SELECT id, code` read-back (not via hardcoded numeric IDs)"
    - "Seed invariant guard: throws if a stage's trackCode doesn't resolve after the track upsert (defensive against seed-data typos)"

key-files:
  created:
    - db/seed/tracks.ts
    - db/seed/stages.ts
    - db/seed/run.ts
    - tests/unit/seed-shape.test.ts
  modified:
    - package.json

key-decisions:
  - "D-01 fully realized: 33 seed rows land as INSERTs on lookup tables, not ALTER TYPE migrations — P10 stage calibration is a data change, not a schema change"
  - "Idempotency via `onConflictDoUpdate` (not `onConflictDoNothing`) so re-running after spec tweaks UPDATEs rows in place — never drifts from STAGE_SEEDS"
  - "Seeder uses canonical `@/lib/db` client (not a second Pool) — preserves the DB-client convention locked in Plan 01"
  - "sort_order namespace chosen with gaps (universal 10..40, TE 100..190, FL 200..300) so P10 calibration can insert between existing stages without renumbering"

patterns-established:
  - "Pattern: Seed file split — `*.ts` files export plain arrays; `run.ts` owns the DB client + upsert logic. Tests import just the arrays; no DB needed."
  - "Pattern: Dotenv-before-dynamic-import for any script that touches `@/lib/env` outside of Next.js runtime"
  - "Pattern: Seed invariants (FK resolution must succeed) enforced in `run.ts` — not left to Postgres FK failure"

requirements-completed: [DEAL-01, STAGE-01]

# Metrics
duration: ~3m 34s
completed: 2026-04-17
---

# Phase 01 Plan 04: Seed Tracks and Stages Summary

**33 seed rows (8 tracks + 25 stages) landed in Postgres via an idempotent `npm run db:seed` script using Drizzle `onConflictDoUpdate` keyed by business `code`; 13 seed-shape unit tests encode DEAL-01 + STAGE-01 verbatim.**

## Performance

- **Duration:** ~3m 34s
- **Started:** 2026-04-17T22:23:53Z
- **Completed:** 2026-04-17T22:27:27Z
- **Tasks:** 2 (Task 1 seed files + script; Task 2 TDD tests)
- **Files created/modified:** 5 (4 created + 1 modified)
- **Commits:** 2 task commits + this SUMMARY commit

## Accomplishments

- **DEAL-01 data landed:** All 8 tracks seeded with correct default priorities:

  | Code | Label                     | Priority | sort_order |
  | ---- | ------------------------- | -------- | ---------- |
  | TE   | Title & Escrow            | HIGH     | 10         |
  | FL   | Funding & Lending         | HIGH     | 20         |
  | DP   | Deal Planning & Structure | MEDIUM   | 30         |
  | PO   | Partnership Opportunity   | MEDIUM   | 40         |
  | EC   | Education & Consulting    | MEDIUM   | 50         |
  | SL   | Seller Listing            | MEDIUM   | 60         |
  | BL   | Buyer Listing             | MEDIUM   | 70         |
  | GI   | General Inquiry           | MEDIUM   | 80         |

- **STAGE-01 data landed:** All 25 stages seeded in 3 scope groups:

  **Universal (4, track_id = NULL) — sort_order 10..40**
  - `pre_screen_qualification` (10) — default stage for new deals per D-10
  - `deal_structuring` (20)
  - `file_completed` (30, terminal)
  - `killed` (40, terminal)

  **Title & Escrow (10) — sort_order 100..190**
  - `title_order_opened` (100), `title_not_clear_to_close` (110), `title_clear_to_close` (120), `cd_ss_not_balanced` (130), `cd_ss_balanced` (140), `closing_scheduled` (150), `signing_completed` (160), `disbursed` (170), `recorded` (180), `policy_issued` (190)

  **Funding & Lending (11) — sort_order 200..300**
  - `deal_team_assigned` (200), `preparing_lender_review_pkg` (210), `deal_pkg_submitted_to_lender` (220), `term_sheets_received` (230), `approval_decision_received` (240), `term_sheet_loi_received` (250), `uw_conditions_issued` (260), `uw_conditions_cleared` (270), `lender_docs_received` (280), `funding_conditions_cleared` (290), `funding_approval_received` (300)

- **Idempotent seeder:** `npm run db:seed` ran twice back-to-back. Both runs exited 0 with the same log line `"Seeded 8 tracks, 25 stages."` — no duplicates, no FK failures.

- **SQL-verified counts** (against live Postgres):

  ```
  tracks           |  8
  stages           | 25
  universal_stages |  4
  TE_stages        | 10
  FL_stages        | 11
  terminal_stages  |  2
  ```

- **13 seed-shape unit tests** passing — encoding DEAL-01 + STAGE-01 as executable spec. If the seed arrays drift from spec, the tests fail immediately.

## Upsert Strategy (why `onConflictDoUpdate` and not alternatives)

- **Not `onConflictDoNothing`:** a no-op on re-run would mean spec tweaks (e.g., relabel "Title & Escrow" → "Title, Escrow & Closing") would never propagate without a separate migration. `onConflictDoUpdate` keeps the seed file as the source of truth.
- **Not `TRUNCATE + INSERT`:** TRUNCATE on `tracks` would CASCADE (or RESTRICT) against any real deals, blocking the seed in any environment with data. Upsert by `code` touches only the 33 seed rows.
- **Conflict target = `code` (unique), not `id`:** `id` is `defaultRandom()`, so re-running with new UUIDs would insert duplicates. `code` is the stable business key — matches the human-readable spec.
- **`set:` uses `excluded.<col>`:** standard Postgres pattern that references the row we attempted to INSERT, so we don't duplicate seed values in two places (VALUES and SET).

## Driver / Dependency Notes

- **`tsx` already installed** (from prior plans as a devDependency). No install needed; `db:seed` just points at `tsx db/seed/run.ts`.
- **Drizzle driver path:** `drizzle-orm/node-postgres` is the correct 0.45.2 export (confirmed via `node_modules/drizzle-orm/node-postgres/driver.*`). Seeder uses the canonical `@/lib/db` client instead of spinning up a second `Pool` — preserves the locked DB-client convention from Plan 01.
- **Dotenv + ESM hoisting gotcha (resolved inline, see Deviations):** top-level `config()` followed by top-level `import` doesn't work because ESM hoists imports above all executable statements. `@/lib/env` then runs Zod validation against an empty `process.env` and throws before dotenv fires. The fix is to call `config()` at module scope, then do `await import(...)` inside `main()`.

## Task Commits

1. **Task 1:** `feat(01-04): seed tracks + stages via idempotent db:seed script` — `d139716`
2. **Task 2 (TDD):** `test(01-04): seed-shape assertions for TRACK_SEEDS + STAGE_SEEDS` — `de10846`

**Plan metadata commit:** follows this SUMMARY write.

## Files Created/Modified

- **Created** `db/seed/tracks.ts` — `TRACK_SEEDS: NewTrack[]` (8 rows)
- **Created** `db/seed/stages.ts` — `StageSeed` type + `STAGE_SEEDS: StageSeed[]` (25 rows with string `trackCode` pointer)
- **Created** `db/seed/run.ts` — idempotent seeder using `@/lib/db`, `onConflictDoUpdate`, code→id FK resolution, invariant guard
- **Created** `tests/unit/seed-shape.test.ts` — 13 pure-in-process assertions
- **Modified** `package.json` — added `"db:seed": "tsx db/seed/run.ts"` between `db:migrate` and `db:studio`

## Decisions Made

None new — this plan applied existing decisions (D-01 lookup-tables, D-10 default-stage, DB-client convention) to data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dotenv vs ESM import hoisting on seeder boot**
- **Found during:** Task 1 (first `npm run db:seed` run)
- **Issue:** The plan's skeleton had `config({ path: ".env.local" })` at the top, then `import { db } from "@/lib/db"` directly below. ESM hoists imports above the `config()` call, so `@/lib/env`'s Zod validation ran against an empty `process.env` and the seeder died with `"DATABASE_URL: expected string, received undefined"` (and 4 similar errors).
- **Fix:** Kept `config()` at module scope, but moved the DB/schema/seed imports into dynamic `await import(...)` calls inside `main()`. These resolve AFTER dotenv fires, so `@/lib/env` sees the real values.
- **Files modified:** `db/seed/run.ts`
- **Commit:** `d139716` (landed in the Task 1 commit — fix was applied before the first successful run)

No other deviations. `tsx` was already installed, drizzle driver path was correct first try, `onConflictDoUpdate` signature worked as documented, counts matched spec on first attempt.

## Issues Encountered

Only the ESM-hoisting issue documented above. Resolved inline in the same task.

## Known Stubs

None. All 33 rows are real data matching DEAL-01 / STAGE-01 verbatim. The 6 tracks without track-specific stages (DP, PO, EC, SL, BL, GI) are *not* stubs — they intentionally ride universal stages until P10 calibration, per STAGE-01 and CONTEXT.md.

## User Setup Required

None. Postgres is already running locally (docker-compose); `DATABASE_URL` is already in `.env.local` from Plan 01. `npm run db:seed` works out of the box.

## Next Phase Readiness

- **Plan 05 (new-deal form):** unblocked. The form can now `SELECT code, label FROM tracks WHERE active = true ORDER BY sort_order` for the track dropdown and `SELECT code, label FROM stages WHERE track_id IS NULL OR track_id = $trackId ORDER BY sort_order` for the stage selector. Default stage per D-10 is `pre_screen_qualification` (universal, lowest sort_order in scope).
- **Plan 06 (list view rewrite):** unblocked. Track badges can resolve code → label via the seeded tracks table; stage labels come from `stages.label` keyed by `deals.stage_id`.
- **Phase 10 (calibration):** the 6 tracks that ride universal-only stages in P1 (DP, PO, EC, SL, BL, GI) have reserved sort_order bands to be filled later without renumbering.

## Self-Check

- [x] `db/seed/tracks.ts` exists — FOUND
- [x] `db/seed/stages.ts` exists — FOUND
- [x] `db/seed/run.ts` exists — FOUND
- [x] `tests/unit/seed-shape.test.ts` exists — FOUND
- [x] `package.json` contains `"db:seed"` script — FOUND (`tsx db/seed/run.ts`)
- [x] Commit `d139716` (Task 1 feat) exists — VERIFIED via `git log`
- [x] Commit `de10846` (Task 2 test) exists — VERIFIED via `git log`
- [x] `npm run db:seed` exits 0 and prints "Seeded 8 tracks, 25 stages." — VERIFIED (both runs)
- [x] Second run is idempotent (same output, no errors) — VERIFIED
- [x] Postgres row counts: tracks=8, stages=25, universal=4, TE=10, FL=11, terminal=2 — VERIFIED via `docker exec psql`
- [x] Track priorities: TE=HIGH, FL=HIGH, DP/PO/EC/SL/BL/GI=MEDIUM — VERIFIED via SQL SELECT
- [x] `npm test` → 49/49 green (36 baseline + 13 new seed-shape) — VERIFIED
- [x] `npx tsc --noEmit` → exit 0 (no output) — VERIFIED
- [x] `npm run build` → compiled successfully — VERIFIED
- [x] All 5 must_haves.truths verified
- [x] Requirements DEAL-01 + STAGE-01 marked complete

## Self-Check: PASSED

---
*Phase: 01-core-data-model*
*Completed: 2026-04-17*
