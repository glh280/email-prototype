---
phase: 02-deal-detail-tasks-stages
plan: 04
type: tdd
wave: 2
depends_on: [02-deal-detail-tasks-stages/01, 02-deal-detail-tasks-stages/02]
files_modified:
  - app/deal/[id]/actions/stages.ts
  - app/deal/[id]/actions/deals.ts
  - tests/unit/stage-actions.test.ts
  - tests/unit/deal-actions.test.ts
autonomous: true
requirements: [DEAL-05, DEAL-06, STAGE-02, STAGE-03]
requirements_addressed: [DEAL-05, DEAL-06, STAGE-02, STAGE-03]

must_haves:
  truths:
    - "`advanceStage(dealId, targetStageId)` validates forward motion (target.sort_order > current.sort_order) AND track compatibility (target.track_id IS NULL OR target.track_id = deal.track_id) — rejects otherwise"
    - "`revertStage(dealId, targetStageId)` validates backward motion (target.sort_order < current.sort_order) + same track compatibility"
    - "`killDeal(dealId, reason)` atomically sets status='killed', stage_id = killed universal stage id, killedAt=now(), closedAt=now(), kill_reason=reason AND inserts a system note row (is_system=true, body=reason) AND writes audit — all ONE tx"
    - "`closeDeal(dealId)` sets status='closed', stage_id = file_completed universal stage id, closedAt=now() — one tx, audit row written, no reason required"
    - "`updateDeal(dealId, diff)` applies the partial diff from `updateDealSchema`, writes before/after audit; REJECTS if diff attempts status='killed' (force Carrie through killDeal)"
    - "Both stage actions ALSO export `advanceStageInTx(tx, ...)` and `revertStageInTx(tx, ...)` tx-scoped helpers — Plan 03's completeTask imports advanceStageInTx for auto-advance"
    - "Audit rows include a 'source' marker in afterJson metadata: 'manual_advance' | 'manual_revert' | 'task_autoadvance' so the Audit tab filter can distinguish"
    - "killDeal rejects with {ok:false} if deal.status === 'killed' already (idempotent-friendly — double-clicks don't write duplicate notes)"
  artifacts:
    - path: "app/deal/[id]/actions/stages.ts"
      provides: "Stage advance/revert server actions + tx-scoped helpers"
      exports: ["advanceStage", "revertStage", "advanceStageInTx", "revertStageInTx"]
    - path: "app/deal/[id]/actions/deals.ts"
      provides: "Deal update/close/kill server actions"
      exports: ["updateDeal", "closeDeal", "killDeal", "UpdateDealResult", "KillDealResult"]
    - path: "tests/unit/stage-actions.test.ts"
      provides: "Real-Postgres tests for advance/revert validity + audit rows"
      contains: "manual_advance"
    - path: "tests/unit/deal-actions.test.ts"
      provides: "Tests for updateDeal diff/audit + closeDeal + killDeal reason-required + kill idempotency"
      contains: "is_system"
  key_links:
    - from: "app/deal/[id]/actions/stages.ts"
      to: "lib/stage-schema.ts"
      via: "safeParse on action entry"
      pattern: "advanceStageSchema.safeParse"
    - from: "app/deal/[id]/actions/deals.ts::killDeal"
      to: "db/schema/app.ts::dealNotes"
      via: "INSERT dealNotes with is_system=true inside the kill transaction"
      pattern: "dealNotes.*is_system"
    - from: "app/deal/[id]/actions/stages.ts::advanceStageInTx"
      to: "app/deal/[id]/actions/tasks.ts::completeTask"
      via: "exported tx helper called from completeTask when advancesStageToId is set"
      pattern: "export async function advanceStageInTx"
---

<objective>
Implement the stage-advance, stage-revert, deal-update, deal-close, and deal-kill server actions. These implement the P2 success criteria for STAGE-02, STAGE-03, and DEAL-06 end-to-end with audit coverage.

Two shapes per stage action: `advanceStage(input)` (top-level server action, handles its own transaction) and `advanceStageInTx(tx, ...)` (tx-scoped helper, called by Plan 03's completeTask for auto-advance). Same for revert. This split is the pattern P1 established with `writeAuditLog(tx, ...)` — callers that own a transaction pass it in; callers that don't wrap with `db.transaction`.

Kill action is the most destructive: it sets multiple columns, creates a system note in `deal_notes`, and writes audit — all in one transaction. If any step fails, nothing commits.

TDD RED→GREEN. Tests hit real Postgres. The state machine validity tests (advance requires forward motion, revert requires backward motion, track compatibility check) are the core invariants.

Purpose: STAGE-02 (two-click advance), STAGE-03 (revert), DEAL-06 (kill with reason), DEAL-05 (update via Overview edit); audit surface widened to all these mutations.
Output: two action modules + two test files; tx-scoped helpers exported for Plan 03 composition.
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

# Canonical patterns:
@app/deal/new/actions.ts
@lib/audit.ts
@lib/file-no.ts
@tests/unit/create-deal-action.test.ts

# Wave 1 prerequisites (must be committed before this plan runs):
@db/schema/app.ts
@lib/deal-schema.ts
@lib/stage-schema.ts

<interfaces>
From lib/deal-schema.ts (Plan 02):
```typescript
export const updateDealSchema, killDealSchema;
export type UpdateDealInput, KillDealInput;
```

From lib/stage-schema.ts (Plan 02):
```typescript
export const advanceStageSchema, revertStageSchema;
export type AdvanceStageInput, RevertStageInput;
```

From db/schema/app.ts (Plan 01):
```typescript
tracks, stages, deals, auditLog, dealNotes;
type Deal, Stage;
// Universal stages have track_id = NULL. Known codes to resolve by:
//   - 'file_completed' (closeDeal target)
//   - 'killed' (killDeal target)
```

From lib/audit.ts:
```typescript
writeAuditLog(tx: AppTx, params: {...});
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — stage-actions.test.ts + deal-actions.test.ts (tests fail; actions don't exist)</name>
  <files>tests/unit/stage-actions.test.ts, tests/unit/deal-actions.test.ts</files>
  <read_first>
    - tests/unit/create-deal-action.test.ts (harness reference)
    - .planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md lines 522-572 (advance + revert semantics), lines 573-618 (kill + close semantics)
    - .planning/REQUIREMENTS.md lines 53-54 (DEAL-05, DEAL-06), line 68-69 (STAGE-02, STAGE-03)
    - lib/deal-schema.ts + lib/stage-schema.ts (just shipped in plan 02)
  </read_first>
  <behavior>
    stage-actions.test.ts (≥ 10 tests):
    1. advanceStage happy path: deal on 'pre_screen_qualification' + track=TE + target='deal_structuring' (universal, sort_order > current) → ok:true; deal.stage_id updated; audit row operation='update', source='manual_advance'
    2. advanceStage happy path to track-specific: target='title_order_opened' (TE-specific) succeeds because target.track_id = deal.track_id
    3. advanceStage REJECTS going backward: target.sort_order < current.sort_order → ok:false
    4. advanceStage REJECTS track mismatch: deal.track=TE but target.track_id = FL track → ok:false
    5. advanceStage REJECTS non-existent targetStageId (uuid valid but no row) → ok:false
    6. revertStage happy path: deal on 'deal_structuring' + target='pre_screen_qualification' (sort_order < current) → ok:true; audit source='manual_revert'
    7. revertStage REJECTS forward motion (target.sort_order > current)
    8. advanceStageInTx (tx-scoped helper): when given an already-open tx + user, does not wrap its own tx, writes its audit row via the passed tx
    9. INVARIANT: advanceStage writes EXACTLY one audit row with tableName='deals', operation='update', and a source marker in afterJson
    10. Concurrency: two simultaneous advanceStage calls race — Postgres serializes; after both finish, the deal is at the later target with 2 audit rows (order not guaranteed, but no lost-update)

    deal-actions.test.ts (≥ 9 tests):
    1. updateDeal happy path: {title:'new title'} applies; before/after audit row diff captures only the changed field
    2. updateDeal rejects unknown key (schema.strict) → ok:false
    3. updateDeal REJECTS trying to set status='killed' → ok:false (must use killDeal)
    4. updateDeal with empty diff → ok:true but NO audit row (no-op short-circuits)
    5. closeDeal sets status='closed', stage_id = file_completed universal, closedAt set → audit row written
    6. killDeal happy path: status='killed', stage_id=killed universal, killedAt + closedAt + killReason set; `deal_notes` row inserted with is_system=true, body=reason, createdBy=user.id; single audit row for deals.update + single audit row for deal_notes.create (both in same tx)
    7. killDeal REJECTS empty reason (validation failure, handled by killDealSchema from plan 02)
    8. killDeal on already-killed deal → ok:false, error message mentions already killed; no duplicate system note
    9. INVARIANT: killDeal rollback — if writeAuditLog (mocked to throw) fails AFTER the UPDATE deals but BEFORE tx commits, the deal status is NOT 'killed' when the test reads it after (rolls back cleanly). Same pattern as P1 plan 05 Test 7.

    Commit: `test(02-04): stage + deal action RED — advance/revert/update/close/kill invariants`
  </behavior>
  <action>
    Create both test files following the `tests/unit/create-deal-action.test.ts` template verbatim (env prelude, vi.mock getCurrentUser, beforeAll seeds a test user + test deal, beforeEach cleans).

    For stage tests, the test deal starts on `pre_screen_qualification` (universal stage inserted by P1 plan 05's createDeal action). Each test re-resolves the target stage id by SELECT from the seeded stages table — DO NOT hardcode uuids.

    For kill tests, the test deal starts status='active'. Each test truncates `deal_notes` and re-resolves the 'killed' universal stage id.

    Imports from `@/app/deal/[id]/actions/stages` and `@/app/deal/[id]/actions/deals` will fail — that's RED.

    Commit: `test(02-04): stage + deal action RED — advance/revert/update/close/kill invariants`.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/stage-actions.test.ts tests/unit/deal-actions.test.ts 2>&1 | tail -25; echo "RED expected"</automated>
  </verify>
  <acceptance_criteria>
    - `tests/unit/stage-actions.test.ts` exists and `grep -c "^  it(" tests/unit/stage-actions.test.ts` ≥ 10
    - `tests/unit/deal-actions.test.ts` exists and `grep -c "^  it(" tests/unit/deal-actions.test.ts` ≥ 9
    - `grep -c "manual_advance" tests/unit/stage-actions.test.ts` ≥ 1
    - `grep -c "manual_revert" tests/unit/stage-actions.test.ts` ≥ 1
    - `grep -c "is_system" tests/unit/deal-actions.test.ts` ≥ 1
    - `grep -c "already killed" tests/unit/deal-actions.test.ts` ≥ 1
    - Running the files produces module-not-found error for the action imports (RED state)
    - Commit matches `^test\(02-04\): stage \+ deal action RED`
  </acceptance_criteria>
  <done>RED tests committed; 19+ behaviors + the kill-rollback invariant enumerated.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — implement app/deal/[id]/actions/stages.ts + app/deal/[id]/actions/deals.ts (tests pass)</name>
  <files>app/deal/[id]/actions/stages.ts, app/deal/[id]/actions/deals.ts</files>
  <read_first>
    - tests/unit/stage-actions.test.ts + tests/unit/deal-actions.test.ts (the contracts)
    - app/deal/new/actions.ts (transactional pattern verbatim)
    - lib/audit.ts (tx-scoped audit)
    - .planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md lines 522-618 (dialog-to-action mapping + success toasts)
  </read_first>
  <action>
    Create `app/deal/[id]/actions/stages.ts` starting with `"use server";`.

    **advanceStageInTx(tx: AppTx, params: { dealId, targetStageId, source: "manual_advance"|"task_autoadvance", user })**: tx-scoped helper.
    1. SELECT deal + current stage + target stage (3 queries OR one 3-way join)
    2. Validate: target.sort_order > current.sort_order AND (target.trackId === null OR target.trackId === deal.trackId) — throw descriptive Error otherwise
    3. UPDATE deals SET stage_id = target.id, updated_at = now() WHERE id = dealId RETURNING *
    4. writeAuditLog(tx, { tableName:'deals', recordId: dealId, operation:'update', beforeJson: { stage_id: current.id, stage_code: current.code }, afterJson: { stage_id: target.id, stage_code: target.code, source }, user })
    5. Return { before, after }

    **advanceStage(raw: unknown)**: top-level server action.
    1. advanceStageSchema.safeParse → ok:false on failure
    2. getCurrentUser()
    3. db.transaction → calls advanceStageInTx(tx, { ..., source:'manual_advance', user })
    4. revalidatePath(`/deal/${dealId}`) + revalidatePath('/')
    5. Return {ok:true, toStageCode, toStageLabel}

    **revertStageInTx / revertStage**: mirror image. Validation: target.sort_order < current.sort_order AND same track check. Audit source = 'manual_revert'.

    Create `app/deal/[id]/actions/deals.ts` starting with `"use server";`.

    **updateDeal(raw: unknown)**:
    1. updateDealSchema.safeParse — ok:false on failure
    2. If diff is empty ({} after removing undefined keys), return {ok:true, noop:true} WITHOUT writing audit
    3. getCurrentUser()
    4. db.transaction:
       a. SELECT deal (snapshot before)
       b. UPDATE deals SET ...diff, updated_at = now() WHERE id = dealId
       c. SELECT deal (snapshot after)
       d. writeAuditLog(tx, { tableName:'deals', recordId, operation:'update', beforeJson:before, afterJson:after, user })
    5. revalidatePath both paths
    6. Return {ok:true}

    **closeDeal(dealId)**: resolve 'file_completed' stage id (universal, track_id IS NULL); call updateDeal internally OR wrap its own tx that sets status='closed', stage_id=..., closedAt=now(). Audit row written. Reject if deal already closed (idempotent).

    **killDeal(raw: unknown)**:
    1. killDealSchema.safeParse
    2. getCurrentUser()
    3. db.transaction:
       a. SELECT deal; if deal.status === 'killed' → throw (translated to ok:false by outer catch)
       b. Resolve 'killed' universal stage id
       c. UPDATE deals SET status='killed', stage_id=killed_id, killed_at=now(), closed_at=now(), kill_reason=reason, updated_at=now() WHERE id=dealId RETURNING *
       d. INSERT dealNotes (dealId, body:reason, isSystem:true, createdBy:user.id) — the UI-SPEC requires the reason mirrored as a note for Notes-tab visibility
       e. writeAuditLog for deals.update (before/after snapshots)
       f. writeAuditLog for deal_notes.create (afterJson = new note row)
    4. revalidatePath both paths
    5. Return {ok:true}

    Catch PG unique-violation or domain errors inside each top-level action and return {ok:false, error:<message>}. Inside tx helpers, always throw (let the caller decide).

    Run both test files — ALL must go from RED to GREEN. If advanceStageInTx has an issue, the matching test in Plan 03's task-actions test (Behavior 7: auto-advance) will catch it when Plan 03 runs. Coordinate commit ordering: this plan commits GREEN independently; plan 03's GREEN depends on this plan's helper existing.

    Commit: `feat(02-04): stage + deal server actions + kill/close + audit widening (GREEN)`.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/stage-actions.test.ts tests/unit/deal-actions.test.ts 2>&1 | tail -20; npx tsc --noEmit 2>&1 | grep -E "(error|TS)" || echo "tsc clean"; npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `app/deal/[id]/actions/stages.ts` exists with `'use server'` directive
    - `grep -c "export async function advanceStage" app/deal/[id]/actions/stages.ts` returns 1
    - `grep -c "export async function revertStage" app/deal/[id]/actions/stages.ts` returns 1
    - `grep -c "export async function advanceStageInTx" app/deal/[id]/actions/stages.ts` returns 1
    - `grep -c "export async function revertStageInTx" app/deal/[id]/actions/stages.ts` returns 1
    - `grep -c "manual_advance" app/deal/[id]/actions/stages.ts` ≥ 1
    - `grep -c "manual_revert" app/deal/[id]/actions/stages.ts` ≥ 1
    - `app/deal/[id]/actions/deals.ts` exists
    - `grep -c "export async function updateDeal" app/deal/[id]/actions/deals.ts` returns 1
    - `grep -c "export async function closeDeal" app/deal/[id]/actions/deals.ts` returns 1
    - `grep -c "export async function killDeal" app/deal/[id]/actions/deals.ts` returns 1
    - `grep -c "is_system" app/deal/[id]/actions/deals.ts` ≥ 1 (kill writes a system note)
    - `grep -c "db.transaction" app/deal/[id]/actions/deals.ts` ≥ 3
    - `grep -c "writeAuditLog" app/deal/[id]/actions/deals.ts` ≥ 3
    - `npx vitest run tests/unit/stage-actions.test.ts tests/unit/deal-actions.test.ts` exits 0
    - `npx tsc --noEmit` exit 0
    - `npm run build` exit 0
    - Commit matches `^feat\(02-04\): stage \+ deal server actions`
  </acceptance_criteria>
  <done>Stage advance/revert + deal update/close/kill actions all working; tx-scoped helpers exported for Plan 03 composition; all tests green; every mutation audited with a source marker.</done>
</task>

</tasks>

<verification>
- RED commit: both test files fail with module-not-found
- GREEN commit: 19+ tests green; tx-scoped helpers callable from Plan 03
- `npx tsc --noEmit` clean
- `npm run build` exits 0
- Full suite count continues to climb monotonically
</verification>

<success_criteria>
- [ ] `advanceStage` / `revertStage` server actions + matching `*InTx` helpers exported
- [ ] `updateDeal` / `closeDeal` / `killDeal` server actions exported
- [ ] All stage transitions validated (forward for advance, backward for revert, track compatibility both)
- [ ] All mutations audited with a source marker (`manual_advance` / `manual_revert` / `task_autoadvance`)
- [ ] Kill writes (a) UPDATE deals, (b) INSERT deal_notes, (c) two audit_log rows — ALL in one transaction
- [ ] Kill rollback invariant proven by the simulated audit-throw test
- [ ] Two commits landed: RED then GREEN
</success_criteria>

<output>
After completion, create `.planning/phases/02-deal-detail-tasks-stages/02-04-stage-advance-revert-kill-actions-SUMMARY.md` using the standard SUMMARY template.
</output>
