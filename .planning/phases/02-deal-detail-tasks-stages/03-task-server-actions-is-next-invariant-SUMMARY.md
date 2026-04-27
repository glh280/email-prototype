---
phase: 02-deal-detail-tasks-stages
plan: 03
subsystem: api
tags: [server-actions, drizzle, postgres, audit, transactions, tdd, next16, zod, tasks, is-next-invariant, concurrency]

# Dependency graph
requires:
  - phase: 02-deal-detail-tasks-stages/01
    provides: "tasks table (13 cols, CHECK status, partial unique index tasks_one_is_next_per_deal_idx) — DB safety net for TASK-02"
  - phase: 02-deal-detail-tasks-stages/02
    provides: "createTaskSchema + updateTaskSchema.strict() + completeTaskSchema from lib/task-schema.ts"
  - phase: 02-deal-detail-tasks-stages/04
    provides: "advanceStageInTx + revertStageInTx tx-scoped helpers from app/deal/[id]/actions/stages.ts — composed inside completeTask tx for auto-advance and inside undoCompleteTask tx for audit-lookup revert"
  - phase: 01-core-data-model/01
    provides: "deals/stages/audit_log tables + D-05 transactional audit pattern"
  - phase: 01-core-data-model/05
    provides: "app/deal/new/actions.ts createDeal — canonical db.transaction + writeAuditLog shape this plan mirrors"
provides:
  - "createTask Server Action (TASK-01) — INSERT + atomic clear-prior-is_next + audit, all in one tx"
  - "completeTask Server Action (TASK-01 auto-advance + TASK-03 auto-promote) — status='done' + auto-promote next is_next + optional advanceStageInTx call + triggeringTaskId audit breadcrumb"
  - "undoCompleteTask Server Action (TASK-04) — reverses completeTask; audit-lookup revert flow via revertStageInTx; aborts with 'Cannot safely revert stage' when audit row missing"
  - "updateTask Server Action — partial diff + audit; clears prior is_next when isNext:true set"
  - "reassignTask Server Action — sugar over updateTask for owner changes"
  - "queryTasksForDeal reader (lib/tasks-query.ts) — { open, done } in one SELECT round-trip, ordered per UI-SPEC"
  - "TASK-02 is_next invariant proven end-to-end by 10-way concurrency test (partial unique index backstops app logic)"
affects: [02-deal-detail-tasks-stages/05, 02-deal-detail-tasks-stages/06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tx-scoped composition: completeTask calls advanceStageInTx(tx, ...) inside its own db.transaction so task update + stage update are atomic"
    - "Audit breadcrumb pattern: completeTask patches the just-written deals.update audit row with triggeringTaskId via 'SET after_json = after_json || jsonb_build_object(...)' so undoCompleteTask can find it later"
    - "Audit-lookup revert: undoCompleteTask SELECTs the most recent task_autoadvance audit row by triggeringTaskId + reads beforeJson.stage_id → passes to revertStageInTx; aborts on missing row (race/tamper safeguard)"
    - "Partial unique index as concurrency backstop: 10-way Promise.allSettled(createTask({isNext:true})) proves exactly one is_next=true survives; racing writes either clear each other atomically or abort on 23505"
    - "In-memory open/done split: queryTasksForDeal fires ONE SELECT, splits in JS, so the Tasks tab renders with a single DB hit"

key-files:
  created:
    - "app/deal/[id]/actions/tasks.ts (469 lines) — 5 Server Actions + Result type union + discriminated-union error variants for conflict vs validation"
    - "lib/tasks-query.ts (80 lines) — queryTasksForDeal + TaskListRow type"
    - "tests/unit/task-actions.test.ts (613 lines) — 13 behaviors including INVARIANT concurrency test"
  modified: []

key-decisions:
  - "triggeringTaskId written as JSONB merge onto the deals.update audit row AFTER advanceStageInTx returns — avoids changing the stages.ts helper signature while satisfying the undo-lookup contract. The UPDATE audit_log SET after_json = after_json || jsonb_build_object('triggeringTaskId', <id>) patches the most recent source='task_autoadvance' row for the deal."
  - "undoCompleteTask does the audit-lookup BEFORE mutating the task row so the abort-on-missing-audit case (Test 8c) leaves the task untouched via tx rollback. The throw inside db.transaction rolls back everything — the task.status stays 'done' and the deal's stage doesn't change."
  - "CreateTaskResult / UpdateTaskResult are three-way discriminated unions: {ok:true}, {ok:false,errors} (Zod validation), {ok:false,error} (conflict / other runtime). Tests narrow via 'errors' in result to pick the validation variant."
  - "reassignTask is a one-liner wrapper around updateTask({id, ownerUserId}) so Plan 06's task-row owner popover can import a semantically-named action. No new tx, no duplicated audit logic."
  - "queryTasksForDeal uses ONE SELECT with leftJoin(users) + ORDER BY is_next DESC, due_date ASC NULLS LAST, created_at ASC, then splits open/done in-memory. Avoids two round-trips for what's conceptually one page load."
  - "Concurrency backstop (Test 11): 10 parallel createTask(isNext:true) calls — each clears prior is_next first, then inserts. Postgres serializes the partial-unique-index check; some callers abort on 23505 and return {ok:false, error:'conflict'}, others win. The INVARIANT holds regardless: exactly 1 is_next=true row survives."

patterns-established:
  - "Audit breadcrumb merge via 'after_json || jsonb_build_object(...)' — pattern for attaching caller-specific metadata to an audit row written by a lower-level helper without changing the helper's signature"
  - "Audit-lookup as state-machine reversal: where the forward action writes a breadcrumb (triggeringTaskId), the reverse action reads the breadcrumb to derive the target — no need for a separate state column"
  - "Pre-mutation validation inside tx: when a revert depends on historical audit data, run the SELECT before any UPDATE so a missing-audit throw leaves the task row in its pre-undo state"
  - "3-way Result discriminated union: {ok:true, ...} | {ok:false, errors:Record<string, string[]>} | {ok:false, error: string} — validation errors vs runtime errors stay distinguishable"

requirements-completed: [TASK-01, TASK-02, TASK-03, TASK-04, TASK-05]

# Metrics
duration: ~6m
completed: 2026-04-18
---

# Phase 2 Plan 03: Task Server Actions + is_next Invariant Summary

**5 task Server Actions (create/complete/undo/update/reassign) + queryTasksForDeal reader; TASK-02 is_next invariant proven by 10-way concurrency test; TASK-01 auto-advance composes advanceStageInTx via triggeringTaskId audit breadcrumb.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-18T02:10:48Z (baseline 153/153)
- **Completed:** 2026-04-18T02:16:46Z
- **Tasks:** 2 (RED + GREEN)
- **Files created:** 3 (1 action module + 1 reader + 1 test file)
- **Files modified:** 0

## Accomplishments

- **Task mutation surface landed:** `createTask`, `completeTask`, `undoCompleteTask`, `updateTask`, `reassignTask` — all wrap DML + audit in ONE `db.transaction` per D-05.
- **TASK-01 auto-advance:** when a task has `advances_stage_to_id` set, `completeTask` calls `advanceStageInTx` inside its own tx. The stage update is atomic with the task completion. Audit `source='task_autoadvance'`.
- **W1 triggeringTaskId breadcrumb:** completeTask merges `triggeringTaskId: <task.id>` into the deals.update audit afterJson via `jsonb_build_object` after advanceStageInTx returns. undoCompleteTask reads this back to find the revert-target stage id.
- **W1 audit-lookup revert:** `undoCompleteTask` looks up the most recent task_autoadvance audit row for the deal WHERE `afterJson->>'triggeringTaskId' = taskId`, reads `beforeJson.stage_id`, and calls `revertStageInTx(tx, {dealId, targetStageId, source:'task_autoadvance_undo', user})`. Aborts with `{ok:false, error:'Cannot safely revert stage'}` when the audit row is missing, without touching the task row (Test 8c).
- **TASK-02 is_next invariant:** enforced at two layers. App-level: actions clear any prior `is_next=true` before inserting/updating a new one, in the same tx. DB-level: `tasks_one_is_next_per_deal_idx` partial unique index rejects racing writes. Test 11 (INVARIANT) proves 10 concurrent `createTask(isNext:true)` calls leave exactly 1 is_next=true row.
- **TASK-03 auto-promote:** `completeTask` on a task with `is_next=true` promotes the next open task by `(due_date ASC NULLS LAST, created_at ASC)` in the same tx. Returns `newIsNext: {id, title}` so the auto-promote toast can render verbatim without a second round trip.
- **W2/W3 contract compliance:** `CompleteTaskResult.stageAdvanced = { toCode, toLabel } | null` populated by joining `stages` inside the completion tx (via advanceStageInTx's returned targetStage). `newIsNext = { id, title } | null` populated by reading the newly-promoted task's returning row.
- **TASK-05 list-view read path:** `queryTasksForDeal` exposes `{ open, done }` with one SELECT round-trip + leftJoin(users) for owner names. Ordering contract from UI-SPEC (is_next DESC, due_date ASC NULLS LAST, created_at ASC for open; completedAt DESC for done).

## Task Commits

1. **Task 1 (RED): 11 behaviors + INVARIANT concurrency test fail at module-load** — `a7b9b1f` (test)
2. **Task 2 (GREEN): tasks.ts + tasks-query.ts implementations** — `8b849b8` (feat)

**Plan metadata commit:** pending (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md)

## Files Created/Modified

### Created

- `app/deal/[id]/actions/tasks.ts` (469 lines) — 5 Server Actions with `"use server";` directive, 3-way discriminated-union result types, db.transaction wrapping DML + audit per mutation, triggeringTaskId breadcrumb merge via raw SQL jsonb_build_object, audit-lookup revert in undoCompleteTask. Imports advanceStageInTx + revertStageInTx from peer stages.ts module.
- `lib/tasks-query.ts` (80 lines) — queryTasksForDeal(dealId): ONE SELECT with leftJoin(users), ORDER BY is_next DESC + due_date ASC NULLS LAST + created_at ASC; in-memory split into {open, done}; done re-sorted by completedAt DESC.
- `tests/unit/task-actions.test.ts` (613 lines) — 13 real-Postgres behavioral tests (11 original plan + 8b/8c split + INVARIANT). beforeEach inserts a fresh test deal per test to isolate is_next state.

### Modified

None (this plan is purely additive).

## Decisions Made

1. **triggeringTaskId via JSONB merge, not a new audit column** — after advanceStageInTx writes its deals.update audit row with `source='task_autoadvance'`, completeTask runs a raw SQL `UPDATE audit_log SET after_json = after_json || jsonb_build_object('triggeringTaskId', <id>) WHERE id = (SELECT id FROM audit_log WHERE table_name='deals' AND record_id=<dealId> AND after_json->>'source'='task_autoadvance' ORDER BY created_at DESC LIMIT 1)`. Keeps the stages.ts helper signature stable; cost is one small indexed UPDATE per auto-advance.
2. **Audit-lookup BEFORE mutation in undoCompleteTask** — if the lookup fails (Test 8c simulates via direct DELETE), the throw inside db.transaction rolls back the tx without touching the task row. This makes the safeguard honest: task.status stays 'done', deal.stage_id unchanged. Had the task update run first, a partial-revert window would exist.
3. **CreateTaskResult has TWO failure variants** — `{ok:false, errors}` for Zod validation (so the UI can attach field-level error messages to RHF) vs `{ok:false, error}` for runtime failures (conflict on partial unique index, unexpected DB error). Tests narrow via `"errors" in result` to pick the validation path.
4. **reassignTask as updateTask wrapper** — no duplicated audit logic, no separate tx. The one-liner keeps the action registry semantic (Plan 06's owner popover imports `reassignTask` not `updateTask`) without adding code duplication.
5. **queryTasksForDeal single-query pattern** — one SELECT with leftJoin, in-memory split. Two queries (SELECT ... WHERE status='open' + SELECT ... WHERE status='done') would have been simpler but doubled the round-trip count on the Tasks tab's happy path.
6. **Concurrency test with `Promise.allSettled` not `Promise.all`** — some of the 10 createTask calls will abort on 23505 (partial unique index violation); allSettled tolerates mixed outcomes so the test can assert the INVARIANT without requiring all 10 to succeed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 10 cleanup FK-ordering violation**

- **Found during:** Task 2 GREEN first run
- **Issue:** `DELETE FROM users WHERE id = ...` failed with `tasks_owner_user_id_users_id_fk` because the reassigned task still referenced the second user. FK constraint is NO ACTION (per P1 decision — users aren't deletable while they own data).
- **Fix:** Delete in FK-safe order — `DELETE FROM tasks WHERE owner_user_id = <secondUserId>` FIRST, then `DELETE FROM users WHERE email = <email>`. Also: made the second-user insert tolerant of leftover rows from prior failed runs (SELECT first, insert if missing). Also: added the second-user cleanup to afterAll.
- **Files modified:** `tests/unit/task-actions.test.ts` (finally-block DELETE order + upsert pattern + afterAll).
- **Verification:** Re-ran; 13/13 green.
- **Committed in:** `8b849b8` (same GREEN commit — fix landed before commit).

**2. [Rule 1 - Bug] TypeScript narrowing on CreateTaskResult union**

- **Found during:** tsc --noEmit after first GREEN run
- **Issue:** `result.errors.title` after `if (result.ok) return` — TS still saw `result` as the union `{ok:false,errors} | {ok:false,error}` and complained `Property 'errors' does not exist on type '{ ok: false; error: string }'`.
- **Fix:** Narrowed via `if (!("errors" in result)) return;` before accessing `result.errors`. This is the canonical Zod-error-vs-runtime-error narrowing pattern.
- **Files modified:** `tests/unit/task-actions.test.ts` (Test 4).
- **Committed in:** `8b849b8`.

---

**Total deviations:** 2 auto-fixed (2 bugs — both test-side, not implementation).

**Impact on plan:** None on contract. The fixes were narrowing/cleanup corrections caught by the `npx tsc --noEmit` step and the FK constraint pattern established in P1. The CreateTaskResult three-way union (validation vs runtime) is now documented as a pattern for future plan actions.

## Issues Encountered

None beyond the deviations above. Baseline 153/153 held; no flaky tests (the concurrency test runs 10-way Promise.allSettled and finished in 185ms); tsc + build remained clean.

## User Setup Required

None — no external service configuration, no new env vars, no migrations.

## Self-Check

### Files

- FOUND: `app/deal/[id]/actions/tasks.ts` (exists, 469 lines)
- FOUND: `lib/tasks-query.ts` (exists, 80 lines)
- FOUND: `tests/unit/task-actions.test.ts` (exists, 613 lines)

### Commits

- FOUND: `a7b9b1f` — `test(02-03): task-actions RED — createTask/completeTask/undoCompleteTask/updateTask/reassignTask + concurrency invariant`
- FOUND: `8b849b8` — `feat(02-03): task server actions + is_next invariant + auto-promote (GREEN)`

### Acceptance criteria grep counts (all pass)

```
"use server" in tasks.ts:                    1   (≥ 1 ✓)
export async function createTask:            1   (≥ 1 ✓)
export async function completeTask:          1   (≥ 1 ✓)
export async function undoCompleteTask:      1   (≥ 1 ✓)
export async function updateTask:            1   (≥ 1 ✓)
export async function reassignTask:          1   (≥ 1 ✓)
db.transaction:                              5   (≥ 5 ✓ — one per mutating action)
writeAuditLog:                               9   (≥ 5 ✓)
advanceStageInTx:                            6   (≥ 1 ✓)
task_autoadvance:                            7   (≥ 1 ✓)
triggeringTaskId:                           10   (≥ 2 ✓ — written by completeTask, read by undoCompleteTask)
task_autoadvance_undo:                       1   (≥ 1 ✓)
newIsNext:                                   3   (≥ 1 ✓)
toLabel:                                     5   (≥ 1 ✓)
Cannot safely revert stage:                  3   (≥ 1 ✓)
queryTasksForDeal (lib/tasks-query.ts):      1   (= 1 ✓)
it( blocks in test file:                    13   (≥ 11 ✓)
INVARIANT + is_next in test file:            2   (≥ 1 ✓)
Promise.allSettled in test file:             1   (≥ 1 ✓)
advancesStageToId in test file:              7   (≥ 1 ✓)
```

### Build

- FOUND: `npx vitest run tests/unit/task-actions.test.ts` → 13/13 green in 2.47s
- FOUND: Full suite `npx vitest run` → **166/166 green** (153 baseline + 13 new)
- FOUND: `npx tsc --noEmit` → exit 0, no errors
- FOUND: `npm run build` → exit 0; 4 routes registered (`/`, `/deal/[id]`, `/deal/new`, `/_not-found`)

### must_haves.truths

- [x] `createTask(input)` inserts one row and (when `isNext=true`) atomically clears any prior is_next on the same deal inside ONE db.transaction — Tests 1, 2, 3, INVARIANT
- [x] `completeTask(id)` flips status='done', clears is_next, auto-promotes next open task by (due_date asc nulls last, created_at asc), returns `newIsNext:{id,title}|null` + `stageAdvanced:{toCode,toLabel}|null` — Tests 5, 6, 7
- [x] `undoCompleteTask(id)` reverses in one tx, does audit-lookup revert via triggeringTaskId, aborts with `Cannot safely revert stage` on missing audit — Tests 8a, 8b, 8c
- [x] `updateTask(input)` applies partial diff + writes before/after audit — Test 9
- [x] `reassignTask(id, ownerUserId)` is sugar over updateTask — Test 10
- [x] `createTask.advancesStageToId` triggers same-tx stage advance on complete with `source:'task_autoadvance'` audit — Test 7
- [x] 10 parallel createTask(isNext:true) produce exactly 1 is_next row — Test 11 INVARIANT
- [x] Every task mutation writes an audit_log row in same tx — verified via `db.transaction` (5x) + `writeAuditLog` (9x) grep counts
- [x] `queryTasksForDeal(dealId)` returns `{open, done}` ordered per UI-SPEC — code inspection confirms ORDER BY is_next DESC + due_date ASC NULLS LAST + created_at ASC; done sorted by completedAt DESC in-memory

## Self-Check: PASSED

All acceptance criteria met. Two commits landed (RED `a7b9b1f`, GREEN `8b849b8`). Full test suite 166/166 green; tsc + build clean. TASK-01..05 complete.

## Next Phase Readiness

**Unblocks Plan 05 (deal detail shell + Overview edit UI).** The Tasks tab in `app/deal/[id]/page.tsx` can now:
```ts
import { queryTasksForDeal } from "@/lib/tasks-query";
const { open, done } = await queryTasksForDeal(dealId);
```
and wire the checkbox to `completeTask` + the undo toast to `undoCompleteTask`.

**Unblocks Plan 06 (Notes + Audit tabs).** The Audit tab filter vocab now includes `task_autoadvance` / `task_autoadvance_undo` / `task_undo_complete` / `user_action` sources in addition to the Plan 04 sources (`manual_*`). JSONB `afterJson->>'source'` extraction works for all.

**Phase 2 progress:** 4/6 plans complete. Remaining: Plan 05 (deal detail shell + Overview) + Plan 06 (Notes + Audit tabs) — both wave 3, neither blocks on the other.

---
*Phase: 02-deal-detail-tasks-stages*
*Plan: 03*
*Completed: 2026-04-18*
