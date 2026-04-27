---
phase: 02-deal-detail-tasks-stages
plan: 04
subsystem: api
tags: [server-actions, drizzle, postgres, audit, transactions, next16, zod, tdd]

# Dependency graph
requires:
  - phase: 02-deal-detail-tasks-stages/01
    provides: "deals.killed_at + kill_reason cols; deal_notes table with is_system; tasks table with advances_stage_to_id FK"
  - phase: 02-deal-detail-tasks-stages/02
    provides: "updateDealSchema (.strict() rejects immutable + status='killed'); killDealSchema (uuid + trimmed reason 3-2000); advanceStageSchema + revertStageSchema (identical uuid pair)"
  - phase: 01-core-data-model/01
    provides: "deals/stages/tracks/audit_log base tables; D-05 transactional audit pattern"
  - phase: 01-core-data-model/04
    provides: "stages seeded — universal (pre_screen_qualification/deal_structuring/file_completed/killed) + TE (10) + FL (11); track.code + stage.sort_order vocab"
  - phase: 01-core-data-model/05
    provides: "app/deal/new/actions.ts createDeal — canonical db.transaction + writeAuditLog pattern; test harness in tests/unit/create-deal-action.test.ts"
provides:
  - "advanceStage / revertStage top-level Server Actions (STAGE-02 / STAGE-03)"
  - "advanceStageInTx / revertStageInTx tx-scoped helpers — Plan 03's completeTask composes advanceStageInTx for auto-advance"
  - "updateDeal Server Action (DEAL-05) — split-parse preserves updateDealSchema.strict() rejection of immutable fields"
  - "closeDeal Server Action — benign terminal transition to file_completed universal stage"
  - "killDeal Server Action (DEAL-06) — four writes in one tx: UPDATE deals + INSERT deal_notes (is_system=true) + 2 audit rows"
  - "Audit afterJson `source` marker vocab: manual_advance / manual_revert / manual_close / manual_kill / task_autoadvance / task_autoadvance_undo"
  - "Kill-rollback invariant proven (Test 9): mocked audit-throw leaves deal.status=active with no system note"
affects: [02-deal-detail-tasks-stages/03, 02-deal-detail-tasks-stages/05, 02-deal-detail-tasks-stages/06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared stage-transition core (applyStageTransitionInTx) parameterized by direction — avoids duplicating SELECT + validate + UPDATE + audit twice"
    - "Split-parse for Server Actions that take `{ dealId, ...diff }` — dealId parsed separately then updateDealSchema.strict() on remainder so unknown-key rejection propagates (z.intersection/.and() does NOT propagate strict)"
    - "Tx-scoped helper vs top-level Server Action split: `*InTx(tx, ...)` throws on invariant violation; top-level `*Action(raw)` wraps its own tx + catches + returns {ok:false,error}"
    - "revalidatePath('/deal/[id]', 'page') for dynamic routes per Next.js 16 docs (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md)"
    - "Empty-diff noop short-circuit on updateDeal — returns {ok:true, noop:true} WITHOUT writing audit row (prevents Audit-tab noise)"

key-files:
  created:
    - "app/deal/[id]/actions/stages.ts — advanceStage + revertStage + advanceStageInTx + revertStageInTx + StageActionResult type"
    - "app/deal/[id]/actions/deals.ts — updateDeal + closeDeal + killDeal + UpdateDealResult/CloseDealResult/KillDealResult types"
    - "tests/unit/stage-actions.test.ts — 10 behaviors including concurrency + tx-scoped helper"
    - "tests/unit/deal-actions.test.ts — 9 behaviors including kill-rollback invariant via vi.doMock('@/lib/audit')"
  modified: []

key-decisions:
  - "Shared applyStageTransitionInTx core parameterized by direction='advance'|'revert' — keeps SELECT+validate+UPDATE+audit sequence in one place; direction flag controls sort_order comparison only"
  - "Split-parse updateDeal: dealIdSchema.safeParse({dealId}) then updateDealSchema.safeParse(rest) — intersection schemas (z.intersection / .and()) do NOT propagate .strict() unknown-key rejection because each sub-schema sees the full object; splitting keeps the strict boundary on updateDealSchema"
  - "Source marker union includes task_autoadvance_undo even though Plan 03 owns that source — keeps helper signature stable across plans and gives the Audit-tab filter a canonical vocab to filter by"
  - "killDeal writes 4 rows in ONE tx (UPDATE deals + INSERT deal_notes + 2 audit rows); audit-throw rollback proven by Test 9's vi.doMock('@/lib/audit') pattern (same invariant shape as P1 Plan 05 Test 7)"
  - "Only top-level Server Actions call revalidatePath; tx-scoped helpers never revalidate (that's the composing action's responsibility — e.g., completeTask will revalidate once for its whole tx, not per advanceStageInTx call)"
  - "revalidatePath('/deal/[id]', 'page') instead of a concrete path — the dynamic segment requires the type param per Next.js 16 docs; also invalidates ALL deal pages which is the desired semantic (the list at '/' also invalidates so the ETA/last-activity column refreshes)"
  - "closeDeal and killDeal resolve their target universal stage (file_completed / killed) INSIDE the tx (not via a cached ENV var) — avoids staleness if P10 renames stages; single SELECT has negligible cost"

patterns-established:
  - "Audit source marker lives in afterJson — not a new column. Keeps audit_log schema stable; the filter/query uses ->>'source' JSONB extraction (when the Audit tab lands in Plan 06)"
  - "Split-parse composite-input pattern for Server Actions taking `{ dealId, ...fields }` — critical whenever the field-sub-schema uses .strict() to enforce immutable boundary fields"
  - "Idempotent kill: action rejects with ok:false if deal.status === 'killed' before writing any row. Prevents duplicate system notes from double-clicks on the confirm dialog"
  - "Empty-diff noop returns {ok:true, noop:true} — UI surface can show 'No changes to save' without a toast firing an audit row"

requirements-completed: [DEAL-05, DEAL-06, STAGE-02, STAGE-03]

# Metrics
duration: 10min
completed: 2026-04-18
---

# Phase 2 Plan 04: Stage Advance/Revert + Deal Update/Close/Kill Server Actions Summary

**STAGE-02 / STAGE-03 / DEAL-05 / DEAL-06 shipped via 5 Server Actions + 2 tx-scoped helpers, all audited with source markers; kill writes 4 rows in one transaction with proven rollback invariant.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-18T21:57:37Z (baseline suite confirmed 134/134)
- **Completed:** 2026-04-18T22:05:00Z
- **Tasks:** 2 (RED + GREEN)
- **Files created:** 4 (2 action modules + 2 test files)
- **Files modified:** 0

## Accomplishments

- **Stage state machine landed:** `advanceStage` validates forward motion + track compatibility; `revertStage` validates backward motion + track compatibility. Both share `applyStageTransitionInTx` core so the SELECT+validate+UPDATE+audit sequence is DRY.
- **Tx-scoped composition enabled:** `advanceStageInTx(tx, ...)` and `revertStageInTx(tx, ...)` are exported so Plan 03's `completeTask` can call them inside its own transaction (auto-advance wants task + stage update to be atomic).
- **Deal mutation surface complete:** `updateDeal` (DEAL-05 Overview edit with `.strict()` rejection of immutable fileNo/trackCode + refusal to set status='killed'), `closeDeal` (benign terminal transition to file_completed), `killDeal` (destructive terminal with 4-row tx).
- **Audit widened per D-05:** Every mutation writes one audit row with `source` marker in afterJson — `manual_advance`, `manual_revert`, `manual_close`, `manual_kill`, `task_autoadvance`, `task_autoadvance_undo`. Audit-tab filter (Plan 06) has a canonical vocab to filter by.
- **Kill-rollback invariant proven:** Test 9 uses `vi.doMock('@/lib/audit', { writeAuditLog: throws })` — the UPDATE deals + INSERT deal_notes both roll back cleanly, deal stays status='active', no system note leaks.

## Task Commits

1. **Task 1 (RED): stage + deal action tests fail with module-not-found** — `788b4ec` (test)
2. **Task 2 (GREEN): stages.ts + deals.ts implementations + `.strict()` split-parse fix** — `f38f2a7` (feat)

**Plan metadata commit:** (this commit, includes SUMMARY + STATE + ROADMAP)

## Files Created/Modified

### Created

- `app/deal/[id]/actions/stages.ts` (200 lines) — two top-level Server Actions (`advanceStage` / `revertStage`) + two tx-scoped helpers (`advanceStageInTx` / `revertStageInTx`) + shared `applyStageTransitionInTx` core + `AdvanceStageSource` / `RevertStageSource` / `StageActionResult` type exports.
- `app/deal/[id]/actions/deals.ts` (288 lines) — `updateDeal` (split-parse), `closeDeal`, `killDeal` (4-row tx) + result types.
- `tests/unit/stage-actions.test.ts` (303 lines) — 10 real-Postgres behaviors.
- `tests/unit/deal-actions.test.ts` (287 lines) — 9 real-Postgres behaviors incl. kill-rollback invariant via `vi.doMock('@/lib/audit')`.

### Modified

None (this plan is purely additive).

## Decisions Made

1. **Split-parse for updateDeal** — `z.object({dealId}).and(updateDealSchema)` does NOT propagate `.strict()` rejection; each sub-schema sees the full object and either complains about the other's keys (dealIdSchema rejecting `title`) or admits everything. Splitting into two `.safeParse` calls keeps `.strict()` meaningful on the field-surface schema.
2. **Source marker in afterJson, not a new column** — audit_log stays stable; JSONB `->>'source'` extraction is cheap and the filter surface doesn't land until Plan 06.
3. **Empty-diff noop writes NO audit row** — Carrie saving an untouched Overview form shouldn't pollute the Audit tab. Returns `{ok:true, noop:true}` so the UI can optionally show "No changes to save".
4. **Only top-level Server Actions revalidate** — tx-scoped helpers never call `revalidatePath`. The composing action owns revalidation (e.g., completeTask in Plan 03 revalidates once after its whole tx commits, not per-inner-helper).
5. **Kill idempotency** — rejects `{ok:false}` if `deal.status === 'killed'` before writing any row. Double-clicks on the kill dialog don't insert duplicate system notes.
6. **Stage resolution inside tx** — closeDeal and killDeal resolve their target universal stage (file_completed / killed) via a SELECT inside the tx rather than a cached ENV var. Survives P10 stage renaming; cost is one indexed lookup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `z.object(...).and(updateDealSchema).safeParse` fails to reject unknown keys**

- **Found during:** Task 2 GREEN test run
- **Issue:** Test 2 ("updateDeal rejects unknown key — strict schema") failed with `expected true to be false`. The composed schema `z.object({dealId}).and(updateDealSchema)` did NOT propagate `updateDealSchema`'s `.strict()` unknown-key rejection. Zod's intersection/`.and()` passes the full input to BOTH sub-schemas independently; each one only validates its own known keys and is tolerant of extras seen by the other.
- **Fix:** Split parsing into two steps: first `dealIdSchema.safeParse({ dealId: rawDealId })`, then `updateDealSchema.safeParse(rest)` on the remainder. Now `.strict()` sees only the field surface and rejects `fileNo`, `trackCode`, and any other non-editable column.
- **Files modified:** `app/deal/[id]/actions/deals.ts` (updateDealActionSchema removed; split-parse added).
- **Verification:** Test 2 now passes; all 19/19 plan 04 tests green.
- **Committed in:** `f38f2a7` (same GREEN commit — fix landed before commit).

---

**Total deviations:** 1 auto-fixed (1 bug).

**Impact on plan:** The split-parse pattern is strictly better than the intersection version — it makes the immutability boundary explicit in code. Documented in the module's docstring so future composite-input Server Actions (e.g., Plan 03's updateTask) follow the same shape.

## Issues Encountered

None beyond the deviation above. Baseline 134/134 held throughout; no flaky tests; tsc + build remained clean.

## User Setup Required

None — no external service configuration, no new env vars, no migrations.

## Self-Check

- [x] `app/deal/[id]/actions/stages.ts` exists with `'use server'` + all 4 exports
- [x] `app/deal/[id]/actions/deals.ts` exists with `'use server'` + all 3 action exports
- [x] `tests/unit/stage-actions.test.ts` exists — 10 `it(` blocks; contains `manual_advance` (5×) + `manual_revert` (3×)
- [x] `tests/unit/deal-actions.test.ts` exists — 9 `it(` blocks; contains `is_system` / `isSystem` (3×) + `already killed` (1×)
- [x] RED commit `788b4ec` exists (verified: `git log --oneline | grep 788b4ec`)
- [x] GREEN commit `f38f2a7` exists (verified: `git log --oneline | grep f38f2a7`)
- [x] `npx vitest run tests/unit/stage-actions.test.ts tests/unit/deal-actions.test.ts` → 19 passed
- [x] Full suite: 134 → 153 tests green (15 files)
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run build` exits 0; 4 dynamic routes registered
- [x] must_haves.truths checklist:
  - [x] advanceStage validates target.sort_order > current.sort_order AND track compatibility (universal OR same-track)
  - [x] revertStage validates target.sort_order < current.sort_order AND same track check
  - [x] killDeal atomically writes 4 rows (UPDATE deals + INSERT deal_notes + 2 audit) in one tx (Test 6 + Test 9 prove atomicity)
  - [x] closeDeal sets status='closed' + stage=file_completed + closedAt=now() (Test 5)
  - [x] updateDeal applies diff, writes before/after audit, REJECTS status='killed' (Test 3)
  - [x] Both stage actions export tx-scoped `*InTx` helpers (Test 8 uses advanceStageInTx directly)
  - [x] Audit rows carry `source` marker in afterJson (Tests 1, 6, 8, 9 assert)
  - [x] killDeal rejects with {ok:false} if deal.status === 'killed' already (Test 8)

## Self-Check: PASSED

All acceptance criteria met. Two commits landed (RED 788b4ec, GREEN f38f2a7). Full test suite 153/153 green; tsc + build clean.

## Next Phase Readiness

**Unblocks Plan 03 (task server actions).** Plan 03's `completeTask` can now import:
```ts
import { advanceStageInTx } from "@/app/deal/[id]/actions/stages";
```
and call it inside its own `db.transaction` when a task's `advances_stage_to_id` is set. The source marker vocab already admits `task_autoadvance` — Plan 03 passes that value through to distinguish auto-advance audit rows from Carrie-clicked manual-advance audit rows.

**Unblocks Plan 05 (Overview edit UI).** The deal detail form can submit raw JSON to `updateDeal`; the split-parse handles dealId extraction + `.strict()` rejection of immutable fields.

**Unblocks Plan 06 (Audit tab).** Every mutation in this plan writes a row with `source` in afterJson — the Audit-tab filter query can extract `(after_json->>'source')::text` for the filter chip vocab.

---
*Phase: 02-deal-detail-tasks-stages*
*Plan: 04*
*Completed: 2026-04-18*
