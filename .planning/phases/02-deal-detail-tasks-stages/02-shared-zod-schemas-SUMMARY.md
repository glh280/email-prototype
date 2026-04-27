---
phase: 02-deal-detail-tasks-stages
plan: 02
subsystem: database
tags: [zod, validation, schemas, react-hook-form, typescript]

# Dependency graph
requires:
  - phase: 02-deal-detail-tasks-stages (plan 01)
    provides: tasks + deal_notes tables + kill columns on deals — the column shapes these Zod schemas mirror
  - phase: 01-core-data-model
    provides: createDealSchema + z.input/z.infer split pattern + lib/deal-schema.ts canonical location
provides:
  - updateDealSchema (DEAL-05 Overview edit contract — all fields optional, .strict() rejects immutable trackCode/fileNo, status enum 'active'|'closed')
  - killDealSchema (DEAL-06 kill contract — uuid dealId + reason 3-2000 chars trimmed)
  - createTaskSchema + updateTaskSchema + completeTaskSchema (TASK-01 task mutation contracts)
  - advanceStageSchema + revertStageSchema (STAGE-02/03 stage transition contracts)
  - createNoteSchema (DEAL-04 notes tab contract — append-only)
  - UpdateDealInput / UpdateDealFormInput / KillDealInput / CreateTaskInput / CreateTaskFormInput / UpdateTaskInput / CompleteTaskInput / AdvanceStageInput / RevertStageInput / CreateNoteInput types
affects: [02-03-task-server-actions, 02-04-stage-actions, 02-05-deal-detail-overview, 02-06-notes-audit-tabs]

# Tech tracking
tech-stack:
  added: []  # no new deps — uses existing Zod v4
  patterns:
    - "`.strict()` on update schemas to reject immutable-field payloads (trackCode, fileNo for deals; dealId for tasks) loudly"
    - "Schemas per mutation (create / update / complete), not per table, so each action has a tight input shape"
    - "z.input vs z.infer split maintained wherever `.default()` appears (createTaskSchema.isNext)"
    - "Co-located behavioral tests per schema (tests/unit/{name}-schema.test.ts) — pure Zod, no DB, no mocks"

key-files:
  created:
    - lib/task-schema.ts
    - lib/stage-schema.ts
    - lib/note-schema.ts
    - tests/unit/deal-schema.test.ts
    - tests/unit/task-schema.test.ts
    - tests/unit/stage-schema.test.ts
    - tests/unit/note-schema.test.ts
  modified:
    - lib/deal-schema.ts (appended updateDealSchema + killDealSchema; createDealSchema untouched)

key-decisions:
  - "updateDealSchema uses .strict() + field-list (not .partial() over createDealSchema) so immutable fields are rejected by unknown-key check, not silently ignored"
  - "mainContactName + mainContactEmail deliberately omitted from updateDealSchema — the columns live in P1's createDealSchema as DEAL-02 free-text, but editing migrates to P3 when the contacts FK lands (D-03)"
  - "Deal status enum on updateDealSchema is ['active','closed'] only — the 'killed' transition requires a reason note and flows exclusively through killDealSchema"
  - "advanceStageSchema and revertStageSchema are identical shapes — direction enforcement is a server-action concern, not a Zod concern (servers re-resolve sort_order against seeded stages)"
  - "completeTaskSchema collapses to {id} only — the server action (plan 03) resolves auto-promote + auto-advance from the current row"

patterns-established:
  - "Pattern 1: .strict() on all update-style schemas — forces client payloads to stay within the editable field surface; catches typos and unauthorized field edits at validation time"
  - "Pattern 2: one behavioral test file per schema file, co-located under tests/unit/ — each test file imports only from the schema under test; no cross-schema fixtures"
  - "Pattern 3: error-message copy quoted verbatim from UI-SPEC Copywriting Contract — makes UI regression review mechanical (grep the literal) and ensures form-level messages match toast-level messages"

requirements-completed: [DEAL-05, DEAL-06, STAGE-02, STAGE-03, TASK-01]

# Metrics
duration: 5m 7s
completed: 2026-04-18
---

# Phase 2 Plan 02: Shared Zod Schemas Summary

**4 shared Zod contracts (update-deal, kill-deal, task mutations, stage transitions, note creation) with 43 behavioral tests; unblocks Plans 03-06 without schema scavenging.**

## Performance

- **Duration:** 5m 7s
- **Started:** 2026-04-18T01:46:51Z
- **Completed:** 2026-04-18T01:51:58Z
- **Tasks:** 2 (both TDD — RED + GREEN per task = 4 commits)
- **Files modified:** 1
- **Files created:** 7

## Accomplishments

- `lib/deal-schema.ts` extended (createDealSchema from P1 untouched) with `updateDealSchema` + `killDealSchema` + associated types
- Three new sibling modules created — `lib/task-schema.ts`, `lib/stage-schema.ts`, `lib/note-schema.ts` — each exporting the Zod contracts their P2 plan will consume
- 43 new behavioral tests across 4 co-located test files: deal (15), task (14), stage (8), note (6); every test is pure Zod `.safeParse(...)` — no DB, no mocks
- Full suite: 91 → 134 passing
- `.strict()` semantics on all update-style schemas (updateDeal, updateTask) explicitly reject unknown keys — immutable-field safety net is encoded in the schema, not relied upon downstream
- z.input vs z.infer split maintained for every schema with `.default()` (createTaskSchema.isNext), matching the P1 Plan 05 pattern

## Task Commits

Each task was committed atomically (TDD — RED then GREEN):

1. **Task 1 RED: failing deal-schema tests** — `927ba0a` (test)
2. **Task 1 GREEN: updateDealSchema + killDealSchema** — `c5f5d7f` (feat)
3. **Task 2 RED: failing task/stage/note tests** — `2b81162` (test)
4. **Task 2 GREEN: task + stage + note schemas** — `d235f6d` (feat)

**Plan metadata commit:** pending (this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `lib/deal-schema.ts` — Modified: appended `updateDealSchema` (20 optional fields, `.strict()`) + `killDealSchema` (uuid + reason trimmed 3-2000) + `UpdateDealInput` / `UpdateDealFormInput` / `KillDealInput` types; `createDealSchema` + `CreateDealInput` / `CreateDealFormInput` from P1 Plan 05 untouched
- `lib/task-schema.ts` — Created: `createTaskSchema` (required dealId+title, optional owner/due/parent/advancesStageTo, `isNext` default false) + `updateTaskSchema` (`.strict` over id+all-optional, status enum) + `completeTaskSchema` ({id}) + CreateTaskInput / CreateTaskFormInput / UpdateTaskInput / CompleteTaskInput types
- `lib/stage-schema.ts` — Created: `advanceStageSchema` + `revertStageSchema` (identical `{dealId:uuid, targetStageId:uuid}` shapes; direction is a server-action concern) + AdvanceStageInput / RevertStageInput types
- `lib/note-schema.ts` — Created: `createNoteSchema` (uuid dealId + body trimmed min 1 / max 5000 with UI-SPEC error copy) + CreateNoteInput type
- `tests/unit/deal-schema.test.ts` — Created: 15 behaviors covering updateDealSchema (empty ok, single-field, title min/max, priority enum, strict rejects trackCode/fileNo/status=killed, propertyState uppercase transform) + killDealSchema (reason min/max, uuid, whitespace trim)
- `tests/unit/task-schema.test.ts` — Created: 14 behaviors covering createTaskSchema (minimal, fully populated, title min/max, uuid enforcement, isNext default), updateTaskSchema (strict, status enum, missing id), completeTaskSchema
- `tests/unit/stage-schema.test.ts` — Created: 8 behaviors across advance + revert — happy path, uuid enforcement on both fields, missing-field rejection
- `tests/unit/note-schema.test.ts` — Created: 6 behaviors covering createNoteSchema — happy path, empty/whitespace body (both fail min-1 via trim), over-max, non-uuid dealId, trim output

## Decisions Made

- **updateDealSchema field-list (not `.partial()` over createDealSchema):** Spelling the editable fields out means immutable ones (trackCode, fileNo) are absent from the shape — combined with `.strict()`, a payload containing them fails loudly. `.partial()` would have carried trackCode along as optional, silently allowing a client to attempt re-tracking a deal.
- **Omit mainContactName + mainContactEmail from updateDealSchema:** The DB columns exist (DEAL-02 free-text, written by createDeal). Editing them via Overview is a P3 concern when contacts migrate to a FK (D-03). Today's schema is intentionally narrower than the DB; this is documented in the JSDoc.
- **Split Zod schemas per mutation, not per table:** `createTaskSchema` / `updateTaskSchema` / `completeTaskSchema` rather than one `taskSchema.partial()`. Tight per-mutation shapes mean each server action has a minimal input surface (completeTaskSchema is `{id}` — nothing else to validate, nothing else to trust).
- **Error-message copy verbatim from UI-SPEC:** `"Title is required."` / `"Title must be 200 characters or fewer."` / `"Reason must be at least 3 characters."` / `"Note body is required."` are all quoted directly from UI-SPEC Copywriting Contract. Form-level and toast-level messages now match mechanically.

## Deviations from Plan

None — plan executed exactly as written.

The plan's B1 fix (dropping `mainContactName` / `mainContactEmail` from `updateDealSchema`) was already baked into the plan text by the planner's revision iteration 1; I executed that revised plan verbatim. Verified: `grep "mainContact" lib/task-schema.ts lib/stage-schema.ts lib/note-schema.ts` returns 0 matches; the only references in `lib/deal-schema.ts` are in `createDealSchema` (P1, untouched) and my JSDoc comment explaining the intentional omission.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Self-Check

**Files:**
- FOUND: lib/deal-schema.ts (modified)
- FOUND: lib/task-schema.ts
- FOUND: lib/stage-schema.ts
- FOUND: lib/note-schema.ts
- FOUND: tests/unit/deal-schema.test.ts
- FOUND: tests/unit/task-schema.test.ts
- FOUND: tests/unit/stage-schema.test.ts
- FOUND: tests/unit/note-schema.test.ts

**Commits:**
- FOUND: 927ba0a (test RED — deal-schema)
- FOUND: c5f5d7f (feat GREEN — updateDealSchema + killDealSchema)
- FOUND: 2b81162 (test RED — task + stage + note)
- FOUND: d235f6d (feat GREEN — task + stage + note schemas)

**must_haves verification:**
- updateDealSchema exported with `.strict()` — verified grep
- killDealSchema exported with uuid dealId + trimmed reason 3-2000 — verified by tests
- createTaskSchema / updateTaskSchema / completeTaskSchema all exported — verified grep
- advanceStageSchema / revertStageSchema exported — verified grep
- createNoteSchema exported with trim + min(1) + max(5000) — verified by tests
- z.input + z.infer split on createTaskSchema (isNext default) — verified in source
- ≥ 6 `it(` blocks per schema test file — deal=15, task=14, stage=8, note=6 — all pass
- Full suite green: 134/134 ≥ 106 threshold — pass

**Build:**
- FOUND: `npx vitest run` exit 0 (134/134)
- FOUND: `npx tsc --noEmit` exit 0
- FOUND: `npm run build` exit 0 (4 routes)
- FOUND: `grep "mainContact" lib/{task,stage,note}-schema.ts` returns 0 matches (B1 fix enforced)

## Self-Check: PASSED

## Next Phase Readiness

Plans 03, 04, 05, 06 of Phase 2 are unblocked:

- **Plan 03 (task server actions):** Can import `createTaskSchema`, `updateTaskSchema`, `completeTaskSchema` directly; no shape invention needed. TASK-01 auto-advance + TASK-02 is_next invariant + TASK-03 auto-promote land against these contracts.
- **Plan 04 (stage advance/revert/kill):** Can import `advanceStageSchema`, `revertStageSchema`, `killDealSchema`. The kill action's `reason` field validation is already encoded.
- **Plan 05 (Overview edit):** `updateDealSchema` + `UpdateDealFormInput` are ready for react-hook-form's `zodResolver`. Per-card edit pattern (UI-SPEC) will submit partial payloads and `.strict()` catches stray field names.
- **Plan 06 (notes composer):** `createNoteSchema` is ready; the composer's on-blur trim matches the schema's trim.

No blockers. No concerns.

---
*Phase: 02-deal-detail-tasks-stages*
*Completed: 2026-04-18*
