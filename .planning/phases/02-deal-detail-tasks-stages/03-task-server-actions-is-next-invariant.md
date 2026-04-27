---
phase: 02-deal-detail-tasks-stages
plan: 03
type: tdd
wave: 2
depends_on: [02-deal-detail-tasks-stages/01, 02-deal-detail-tasks-stages/02]
files_modified:
  - app/deal/[id]/actions/tasks.ts
  - lib/tasks-query.ts
  - tests/unit/task-actions.test.ts
autonomous: true
requirements: [TASK-01, TASK-02, TASK-03, TASK-04, TASK-05]
requirements_addressed: [TASK-01, TASK-02, TASK-03, TASK-04, TASK-05]

must_haves:
  truths:
    - "Server action `createTask(input)` inserts one row and (when `isNext=true`) atomically clears any prior is_next on the same deal inside ONE db.transaction"
    - "Server action `completeTask(id)` flips status→'done', clears is_next on that row, and atomically promotes the next open task (order: due_date asc nulls last, created_at asc) to is_next=true — all inside ONE transaction; returns `newIsNext: { id, title } | null` and `stageAdvanced: { toCode, toLabel } | null` (W2/W3 contract)"
    - "Server action `undoCompleteTask(id)` reverses the above inside one db.transaction: flips status→'open', restores is_next on the previously-completed task, clears is_next on the auto-promoted task, writes a compensating audit row; if the completed task had `advances_stage_to_id IS NOT NULL`, derives the prior stage by reading the most recent audit_log row for this dealId with source='task_autoadvance' referencing this taskId (triggeringTaskId breadcrumb), then calls `revertStageInTx(tx, { dealId, targetStageId: audit.beforeJson.stage_id, source: 'task_autoadvance_undo' })`; aborts with `{ok:false, error:'Cannot safely revert stage'}` if no matching audit row is found (W1)"
    - "Server action `updateTask(input)` applies a partial diff, writes before/after audit row"
    - "Server action `reassignTask(id, ownerUserId)` is sugar over updateTask — accepts owner change, audits the change"
    - "If `createTask.advancesStageToId` is set AND the task's status is flipped to 'done', completeTask also runs the stage advance inside the SAME transaction; audit row `source: 'task_autoadvance'`"
    - "Concurrency test: 10 parallel createTask calls with is_next=true on the same deal produce exactly 1 task with is_next=true (NEVER 2 — partial unique index backstops the app logic)"
    - "Every task mutation writes a corresponding audit_log row — failed audit MUST roll back the task mutation (OPS-01 invariant from P1 D-05)"
    - "queryTasksForDeal(dealId) returns { open: Task[], done: Task[] } ordered per UI-SPEC: open[0] is the is_next row, then by due_date asc nulls last, created_at asc; done sorted by completedAt desc"
  artifacts:
    - path: "app/deal/[id]/actions/tasks.ts"
      provides: "`createTask`, `completeTask`, `undoCompleteTask`, `updateTask`, `reassignTask` server actions"
      exports: ["createTask", "completeTask", "undoCompleteTask", "updateTask", "reassignTask", "CreateTaskResult", "CompleteTaskResult"]
    - path: "lib/tasks-query.ts"
      provides: "Server-component-safe task reader for the Tasks tab and list-view `is_next` column"
      exports: ["queryTasksForDeal", "TaskListRow"]
    - path: "tests/unit/task-actions.test.ts"
      provides: "Real-Postgres tests covering TASK-02/03/04 invariants + concurrency"
      contains: "partial unique index"
  key_links:
    - from: "app/deal/[id]/actions/tasks.ts::createTask"
      to: "lib/task-schema.ts::createTaskSchema"
      via: "safeParse(raw) at action entry"
      pattern: "createTaskSchema.safeParse"
    - from: "app/deal/[id]/actions/tasks.ts::completeTask"
      to: "app/deal/[id]/actions/stages.ts::advanceStageInTx (Plan 04)"
      via: "inline call inside completeTask's transaction when advancesStageToId is set"
      pattern: "advanceStageInTx\\(tx,"
    - from: "All task server actions"
      to: "lib/audit.ts::writeAuditLog"
      via: "writeAuditLog(tx, { tableName: 'tasks', ... }) inside the same tx"
      pattern: "tableName: \"tasks\""
---

<objective>
Implement the task-mutation server actions and the corresponding task-read helper. This is the plan that enforces the TASK-01..05 invariants in code — most importantly TASK-02 (exactly one `is_next` per deal) and TASK-03 (auto-promote on complete). Partial unique index from plan 01 is the DB safety net; these server actions are the happy path that Carrie interacts with.

TDD RED→GREEN→REFACTOR required. Behavioral tests hit real Postgres via docker-compose (same pattern as P1 plan 03 file-no tests + plan 05 create-deal-action tests). The concurrency test (10 parallel createTask with is_next=true) proves the partial unique index works end-to-end.

Plan 04's advance/revert actions export a `advanceStageInTx(tx, ...)` helper; completeTask calls it inline when `advancesStageToId` is set. To avoid a circular wave-2 dependency, Plan 04 ships the tx-scoped helper; this plan imports it. Both plans are wave 2 with no file overlap — they can execute in parallel.

Purpose: TASK-01..05 lock-in; is_next invariant fully enforced (belt + suspenders); every task mutation audited.
Output: task-action module, task-query module, concurrency-proven tests.
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

# P1 canonical patterns — TDD actions, audit wrapping, real-postgres concurrency.
@app/deal/new/actions.ts
@lib/audit.ts
@lib/file-no.ts
@tests/unit/create-deal-action.test.ts
@tests/unit/file-no.test.ts

# Wave 1 prerequisites (must already be committed):
@db/schema/app.ts
@lib/task-schema.ts

# Peer plan (also wave 2, exports the tx-scoped helper completeTask needs):
@.planning/phases/02-deal-detail-tasks-stages/04-stage-advance-revert-kill-actions.md

<interfaces>
<!-- Types + exports this plan builds against or exports. -->

From lib/task-schema.ts (Plan 02):
```typescript
export const createTaskSchema, updateTaskSchema, completeTaskSchema;
export type CreateTaskInput, UpdateTaskInput, CompleteTaskInput;
```

From db/schema/app.ts (Plan 01):
```typescript
export const tasks = pgTable("tasks", {...});      // 13 cols + partial unique idx
export const deals, stages, auditLog;
export type Task = typeof tasks.$inferSelect;
```

From lib/file-no.ts (P1):
```typescript
export type AppTx = PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;
```

From lib/audit.ts (P1):
```typescript
export async function writeAuditLog(tx: AppTx, params: {
  tableName: string; recordId: string;
  operation: "create" | "update" | "delete";
  beforeJson: unknown | null; afterJson: unknown;
  user: Pick<User, "id" | "email">;
}): Promise<void>;
```

From app/deal/[id]/actions/stages.ts (Plan 04, wave 2 peer):
```typescript
export async function advanceStageInTx(tx: AppTx, params: {
  dealId: string; targetStageId: string; source: "manual_advance" | "task_autoadvance";
  user: Pick<User, "id" | "email">;
}): Promise<{ before: Deal; after: Deal }>;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — tests/unit/task-actions.test.ts exhaustive behaviors (tests fail because actions don't exist yet)</name>
  <files>tests/unit/task-actions.test.ts</files>
  <read_first>
    - tests/unit/create-deal-action.test.ts (shape reference — vi.mock pattern for getCurrentUser, redirect, revalidatePath)
    - tests/unit/file-no.test.ts (concurrency test reference — Promise.all pattern)
    - .planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md lines 354-410 (add-task + auto-promote + auto-advance + undo behavior)
    - .planning/REQUIREMENTS.md lines 93-98 (TASK-01..05 verbatim)
    - lib/task-schema.ts (just shipped in plan 02)
    - db/schema/app.ts (tasks + deal_notes tables from plan 01)
  </read_first>
  <behavior>
    Write 11 RED tests that MUST FAIL until Task 2's implementation lands:

    1. `createTask` — happy path inserts a row returning {ok:true, task:{...}} with status='open', is_next=false
    2. `createTask` with isNext:true on a deal that has NO is_next tasks yet → inserted row has is_next=true; no DB error
    3. `createTask` with isNext:true on a deal that HAS an is_next task → old is_next becomes false, new row is_next=true; both changes in ONE tx (verify via rowCount=2 audit entries in the expected operations)
    4. `createTask` validation failure → returns {ok:false, errors:{...}}; no tasks row; no audit row
    5. `completeTask(id)` with no open siblings → task row status='done', is_next=false; NO auto-promote (no other open task to promote to)
    6. `completeTask(id)` with 2 other open tasks → task done, one of the other two promoted to is_next=true (picked by due_date asc nulls last, created_at asc); second other task remains is_next=false; exactly 1 audit row per affected task
    7. `completeTask(id)` where task has advancesStageToId set → inside the same tx, `deals.stage_id` also updates to the target; audit row for `tasks.update` AND `deals.update` (operation='update', afterJson contains `source:'task_autoadvance'` AND `triggeringTaskId:<task.id>` — the W1 breadcrumb used by undo). Return includes `stageAdvanced:{toCode,toLabel}` (W2).
    8. `undoCompleteTask(id)` reverses case 5: status back to 'open', is_next restored, compensating audit row written. Sub-case for case 7 (auto-advanced): undo ALSO reverts `deals.stage_id` by looking up the `task_autoadvance` audit row via `triggeringTaskId` (W1) and calling `revertStageInTx` with `source:'task_autoadvance_undo'`. Separate test asserts: when audit row is missing (simulated by deleting it), undo returns `{ok:false, error:'Cannot safely revert stage'}` and the task row is NOT modified (tx rollback).
    9. `updateTask({id, title:'new title'})` writes audit row with before.title != after.title
    10. `reassignTask(id, ownerUserId)` writes audit row with before.ownerUserId != after.ownerUserId
    11. INVARIANT (concurrency): Promise.all of 10 concurrent `createTask({isNext:true})` calls on the same deal produces EXACTLY 1 task with is_next=true. Other 9 either (a) had their is_next cleared atomically OR (b) raised a Postgres unique-violation and returned {ok:false, error:'conflict'}. Zero tolerance for 2-is_next states.

    Use the P1 test harness verbatim: vi.mock('@/lib/current-user'), real Postgres via `@/lib/db`, beforeAll seeds a test user + a test deal + the universal pre_screen stage, beforeEach truncates tasks + deal_notes + the deal's audit rows to keep tests isolated. After the test file is committed with all 11 tests expected to FAIL (because the actions don't exist yet — imports from '@/app/deal/[id]/actions/tasks' throw), commit RED.
  </behavior>
  <action>
    Create `tests/unit/task-actions.test.ts` modeled on `tests/unit/create-deal-action.test.ts` (same env-setup prelude, same vi.mock block, same beforeAll/afterAll). Enumerate all 11 behaviors above as `it(...)` blocks. Each test must READ the task row after the action and assert specific column values (is_next boolean, status string, ownerUserId uuid, completedAt not null, etc.).

    For the concurrency test (behavior 11), use this pattern:
    ```typescript
    it("INVARIANT: 10 concurrent createTask(isNext:true) produce exactly 1 is_next task", async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          createTask({
            dealId: TEST_DEAL_ID,
            title: `concurrent task ${i}`,
            isNext: true,
          }),
        ),
      );
      const isNextRows = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.dealId, TEST_DEAL_ID), eq(tasks.isNext, true)));
      expect(isNextRows).toHaveLength(1);
      // At least one must have succeeded; the partial unique index may reject racing writes
      const ok = results.filter((r) => r.status === "fulfilled" && r.value.ok);
      expect(ok.length).toBeGreaterThanOrEqual(1);
    });
    ```

    Imports will error at test-compile because the action module doesn't exist yet — that's the RED state. Commit: `test(02-03): task-actions RED — createTask/completeTask/undoCompleteTask/updateTask/reassignTask + concurrency invariant`.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/task-actions.test.ts 2>&1 | tail -20; echo "RED expected — tests should fail due to missing module"</automated>
  </verify>
  <acceptance_criteria>
    - `tests/unit/task-actions.test.ts` exists
    - `grep -c "^  it(" tests/unit/task-actions.test.ts` ≥ 11
    - `grep -c "INVARIANT.*is_next" tests/unit/task-actions.test.ts` ≥ 1
    - `grep -c "Promise.allSettled" tests/unit/task-actions.test.ts` ≥ 1
    - `grep -c "advancesStageToId" tests/unit/task-actions.test.ts` ≥ 1
    - Running the file produces `Cannot find module '@/app/deal/[id]/actions/tasks'` or equivalent import error (RED state)
    - Commit matches `^test\(02-03\): task-actions RED`
  </acceptance_criteria>
  <done>RED test file committed; 11 behaviors + concurrency invariant enumerated; failing due to missing implementation.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — implement app/deal/[id]/actions/tasks.ts + lib/tasks-query.ts (tests pass)</name>
  <files>app/deal/[id]/actions/tasks.ts, lib/tasks-query.ts</files>
  <read_first>
    - tests/unit/task-actions.test.ts (the contract; build against it)
    - app/deal/new/actions.ts (transactional pattern, redirect, revalidatePath, server-side Zod re-validation)
    - lib/audit.ts (writeAuditLog signature + tx-scoped contract)
    - lib/file-no.ts (AppTx type re-use)
    - .planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md lines 373-380 (auto-advance toast copy), lines 367-375 (auto-promote order-by rule)
  </read_first>
  <action>
    Create `app/deal/[id]/actions/tasks.ts` starting with `"use server";`. Export the five actions. All return discriminated-union results:

    ```typescript
    export type CreateTaskResult =
      | { ok: true; task: Task }
      | { ok: false; errors: Record<string, string[]> };

    export type CompleteTaskResult =
      | {
          ok: true;
          taskId: string;
          // W3: include title so UI can render the auto-promote toast copy verbatim
          // without a second round trip. Populated by reading the newly-promoted
          // is_next task inside the same completion tx (null when no open siblings
          // remained).
          newIsNext: { id: string; title: string } | null;
          // W2: toCode is stages.code (machine id, e.g. 'title_order_opened');
          // toLabel is stages.label (human-readable, e.g. 'Title order opened').
          // UI copy uses toLabel verbatim. Both populated by joining the `stages`
          // table in the completion tx when advancesStageToId was set.
          stageAdvanced: { toCode: string; toLabel: string } | null;
        }
      | { ok: false; error: string };
    ```

    Implementation contracts:

    **createTask(raw: unknown): Promise<CreateTaskResult>**
    1. `createTaskSchema.safeParse(raw)` — return {ok:false, errors} on failure (no DB touch)
    2. `getCurrentUser()` (from `@/lib/current-user`)
    3. `db.transaction(async tx => { ... })`:
       a. If `input.isNext === true`: `UPDATE tasks SET is_next = false WHERE deal_id = ? AND is_next = true` (returning so we can audit)
       b. If any were cleared, write an audit_log row per cleared task (operation='update', before: is_next=true, after: is_next=false)
       c. INSERT tasks (...) RETURNING row
       d. writeAuditLog(tx, { tableName:'tasks', recordId:new.id, operation:'create', beforeJson:null, afterJson:new, user })
       e. return row
    4. `revalidatePath('/deal/${input.dealId}')` + `revalidatePath('/')` (list view Next Task column — TASK-05)
    5. If the INSERT throws a Postgres 23505 (unique violation) on `tasks_one_is_next_per_deal_idx`, catch and return `{ok:false, error:'conflict'}`

    **completeTask(raw: unknown): Promise<CompleteTaskResult>**
    1. `completeTaskSchema.safeParse(raw)`
    2. `getCurrentUser()`
    3. `db.transaction(async tx => { ... })`:
       a. Select task by id (throw if not found)
       b. UPDATE that task: status='done', is_next=false, completedAt=now(), updatedAt=now()
       c. Write audit (tasks.update with before/after)
       d. If the task HAD is_next=true AND the deal has another open task, select the next promotion candidate by `order by due_date asc nulls last, created_at asc limit 1`, UPDATE it is_next=true, write audit
       e. If task.advancesStageToId is set: call `advanceStageInTx(tx, { dealId, targetStageId: advancesStageToId, source:'task_autoadvance', user })` — this writes its own deals.update audit row with `source:'task_autoadvance'` metadata
    4. `revalidatePath('/deal/${task.dealId}')` + `revalidatePath('/')`
    5. Return `{ok:true, taskId, newIsNext, stageAdvanced}` where:
       - `newIsNext = { id, title } | null` — populated by reading the newly-promoted is_next task inside the same tx (null when no open siblings remained) (W3)
       - `stageAdvanced = { toCode, toLabel } | null` — populated by joining `stages` on the advance target inside the same tx; `toCode` is stages.code (machine) and `toLabel` is stages.label (human-readable, used by UI copy) (W2)
    6. When completeTask calls `advanceStageInTx` (because `task.advancesStageToId IS NOT NULL`), it MUST pass through `source: 'task_autoadvance'` AND include `triggeringTaskId: task.id` inside the afterJson metadata the stage action writes. This breadcrumb is the audit row undoCompleteTask uses in W1 to derive the revert target — completeTask writing it is the contract.

    **undoCompleteTask(raw: unknown): Promise<...>**
    - Input shape: `{ taskId: uuid, autoPromotedTaskId?: uuid | null, priorIsNext: boolean }` — UI-SPEC says the toast carries this state; executor defines the Zod schema inline (keep it local to this action since it's only used for undo).
    - Wraps the entire undo in ONE `db.transaction(async tx => { ... })`:
       a. Re-read the completed task row by id INSIDE this tx (source-of-truth for what we're undoing — the UI-supplied `priorIsNext` is a hint, not trusted).
       b. UPDATE the task row: status='open', completedAt=null, is_next = priorIsNext, updatedAt=now(). Write a compensating audit row (operation='update', afterJson carries `{ source: 'task_undo_complete' }`).
       c. If `autoPromotedTaskId` is provided and non-null: UPDATE that task SET is_next=false, updatedAt=now(); write its compensating audit row.
       d. **W1 — stage revert on undo**: if `task.advancesStageToId IS NOT NULL`, derive the prior stage by audit lookup:
           - SELECT the most recent `audit_log` row for this dealId WHERE `table_name='deals'`, `operation='update'`, `afterJson->>'source' = 'task_autoadvance'`, AND `afterJson->>'triggeringTaskId' = task.id`. The completeTask contract (step 6 above) guarantees this breadcrumb exists.
           - Read `beforeJson->>'stage_id'` from that audit row — this is the target revert stage id.
           - Call `revertStageInTx(tx, { dealId, targetStageId: <beforeJson.stage_id>, source: 'task_autoadvance_undo', user })`. revertStageInTx writes its own deals.update audit row with the `task_autoadvance_undo` source.
           - If no matching audit row is found (race / legacy data / tampered audit): return `{ ok: false, error: 'Cannot safely revert stage' }` from inside the tx so Postgres rolls back; DO NOT touch the task row.
    - Final return on success: `{ ok: true, taskId }`.
    - revalidatePath both paths on success.

    **updateTask(raw: unknown): Promise<...>**
    - `updateTaskSchema.safeParse(raw)`
    - If input.isNext=true AND some other task is currently is_next for the same deal, clear the other one first (same pattern as createTask).
    - Apply the partial update via `UPDATE tasks SET ... WHERE id = ?`
    - Write audit row (before/after JSON) inside same tx
    - Revalidate

    **reassignTask(id: string, ownerUserId: string | null): Promise<...>**
    - Thin wrapper: calls `updateTask({id, ownerUserId})`. Included as its own export so Plan 06's task-row owner popover can import by semantically-named action.

    Create `lib/tasks-query.ts`:

    ```typescript
    export type TaskListRow = Pick<Task, "id" | "title" | "dueDate" | "status" | "isNext" | "ownerUserId" | "completedAt" | "createdAt" | "advancesStageToId" | "parentTaskId"> & {
      ownerName: string | null;
    };

    export async function queryTasksForDeal(dealId: string): Promise<{ open: TaskListRow[]; done: TaskListRow[] }> {
      // SELECT t.*, u.name AS owner_name FROM tasks t LEFT JOIN users u ON u.id = t.owner_user_id WHERE t.deal_id = $1
      // Open: status='open', ordered: is_next DESC (puts the Next row first), due_date ASC NULLS LAST, created_at ASC
      // Done: status='done', ordered: completed_at DESC
    }
    ```

    Implement it using Drizzle's `.select(...).from(tasks).leftJoin(users, eq(users.id, tasks.ownerUserId)).where(eq(tasks.dealId, dealId)).orderBy(...)`. Return both groups in one round-trip (single SELECT, filter in-memory) so Plan 06's Tasks tab renders with one DB hit.

    Run the test suite. All 11 tests + the concurrency invariant MUST PASS. Iterate on the implementation until green.

    Commit: `feat(02-03): task server actions + is_next invariant + auto-promote (GREEN)`.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/task-actions.test.ts 2>&1 | tail -20; npx tsc --noEmit 2>&1 | grep -E "(error|TS)" || echo "tsc clean"; npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `app/deal/[id]/actions/tasks.ts` exists
    - `grep -c '"use server"' app/deal/[id]/actions/tasks.ts` returns 1
    - `grep -c "export async function createTask" app/deal/[id]/actions/tasks.ts` returns 1
    - `grep -c "export async function completeTask" app/deal/[id]/actions/tasks.ts` returns 1
    - `grep -c "export async function undoCompleteTask" app/deal/[id]/actions/tasks.ts` returns 1
    - `grep -c "export async function updateTask" app/deal/[id]/actions/tasks.ts` returns 1
    - `grep -c "export async function reassignTask" app/deal/[id]/actions/tasks.ts` returns 1
    - `grep -c "db.transaction" app/deal/[id]/actions/tasks.ts` ≥ 5  (one per mutating action)
    - `grep -c "writeAuditLog" app/deal/[id]/actions/tasks.ts` ≥ 5
    - `grep -c "advanceStageInTx" app/deal/[id]/actions/tasks.ts` ≥ 1
    - `grep -c "task_autoadvance" app/deal/[id]/actions/tasks.ts` ≥ 1
    - `grep -c "triggeringTaskId" app/deal/[id]/actions/tasks.ts` ≥ 2  (written by completeTask, read by undoCompleteTask — W1 breadcrumb)
    - `grep -c "task_autoadvance_undo" app/deal/[id]/actions/tasks.ts` ≥ 1  (W1 revert source marker)
    - `grep -c "newIsNext:" app/deal/[id]/actions/tasks.ts` ≥ 1  (W3 — replaces flat newIsNextTaskId)
    - `grep -c "toLabel" app/deal/[id]/actions/tasks.ts` ≥ 1  (W2 — stageAdvanced shape)
    - `grep -c "Cannot safely revert stage" app/deal/[id]/actions/tasks.ts` ≥ 1  (W1 abort branch)
    - `lib/tasks-query.ts` exists and `grep -c "export async function queryTasksForDeal" lib/tasks-query.ts` returns 1
    - `npx vitest run tests/unit/task-actions.test.ts` exits 0 (all 11 tests green including the concurrency invariant)
    - `npx tsc --noEmit` exit 0
    - `npm run build` exit 0
    - Commit matches `^feat\(02-03\): task server actions`
  </acceptance_criteria>
  <done>All 5 task actions implemented + tested; is_next invariant enforced in code AND DB; auto-promote + auto-advance-stage working; audit rows written for every mutation; concurrency test green proving the partial unique index saves us from races.</done>
</task>

</tasks>

<verification>
- RED commit: tests fail with module-not-found (expected)
- GREEN commit: all 11 tests + concurrency invariant green
- `npx tsc --noEmit` clean
- `npm run build` exits 0
- Full suite: ≥ 106 (post-plan-02) + 11 = 117 tests passing
</verification>

<success_criteria>
- [ ] `createTask` / `completeTask` / `undoCompleteTask` / `updateTask` / `reassignTask` exported as server actions
- [ ] Every mutation writes an audit_log row inside the same transaction as the mutation (failed audit rolls back the mutation)
- [ ] TASK-02 invariant proven by 10-way concurrency test
- [ ] TASK-03 auto-promote ordering (`due_date asc nulls last, created_at asc`) verified by tests
- [ ] TASK-01 `advances_stage_to` auto-advance executes inside the same tx as completeTask
- [ ] TASK-04 undo shape supported (`undoCompleteTask` reverses state + writes compensating audit)
- [ ] TASK-05 list-view read path exposed via `queryTasksForDeal` for Plan 05/06 consumption
- [ ] Two commits landed: RED then GREEN
</success_criteria>

<output>
After completion, create `.planning/phases/02-deal-detail-tasks-stages/02-03-task-server-actions-is-next-invariant-SUMMARY.md` using the standard SUMMARY template. Document the `advanceStageInTx` + `revertStageInTx` integration points for Plan 04 execution order awareness.
</output>
