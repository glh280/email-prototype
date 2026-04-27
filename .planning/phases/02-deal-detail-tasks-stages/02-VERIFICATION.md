---
phase: 02-deal-detail-tasks-stages
verified: 2026-04-17T23:15:00Z
status: human_needed
score: 5/5 success criteria verified; 11/11 requirements satisfied by code; 5 items queued for human UAT
re_verification: null
human_verification:
  - test: "Visual UAT of /deal/[id] including all 4 mutation dialogs (advance, revert, close, kill)"
    expected: "Each dialog matches UI-SPEC copy, AlertDialog role, two-click confirm, toasts fire with correct copy, page refreshes post-mutation"
    why_human: "Visual fidelity + UX flow completion cannot be verified by grep"
  - test: "5-second undo toast on task complete — timing + content"
    expected: "Toast persists for ~5 s with Undo button; clicking Undo reverses the mutation and (if auto-promote happened) restores the prior is_next"
    why_human: "Timing + interactive click flow require a running app"
  - test: "Audit tab filter chips URL-state behavior"
    expected: "Click chip → URL updates with ?auditFilter=<key>; page reloads with filtered rows; unknown values silently fall back to 'all'"
    why_human: "URL-state round-trip requires browser; tolerant parser behavior needs live test"
  - test: "Stepper pip-click affordance (revert to past stage)"
    expected: "Past pip is clickable (cursor pointer, focus ring); click opens revert AlertDialog; future pip is disabled"
    why_human: "Interactive affordance + focus/hover visuals need human inspection"
  - test: "E2E through CF Access: create deal → open detail → advance stage → add task → kill → verify audit tab shows all mutations with before/after"
    expected: "Full end-to-end flow works; audit tab renders rows for each mutation in reverse-chron with diff rendering per UI-SPEC"
    why_human: "CF Access edge auth + multi-step E2E flow beyond automated test scope"
---

# Phase 02: Deal Detail, Tasks, Stages Verification Report

**Phase Goal:** Full deal detail page with tabs, task management with `is_next`, stage advancement with audit log.
**Verified:** 2026-04-17
**Status:** human_needed — all automated checks PASS; 5 UAT items queued
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (mapped from ROADMAP Success Criteria)

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | `/deal/[id]` renders with tabs; Overview editable; Notes, Audit visible | ✓ VERIFIED | `app/deal/[id]/page.tsx` (83 lines) fetches deal + tasks + users + notes + audit in parallel; `deal-tabs.tsx` renders all 6 tabs (Overview, File Contacts, Tasks, Emails, Notes, Audit) per VIEW-05 order; `overview-tab.tsx` + `overview-card.tsx` implement per-card Edit wired to `updateDeal`; `notes-tab.tsx` + `audit-tab.tsx` render live data; bad UUID → `not-found.tsx` |
| 2 | Adding/completing tasks maintains exactly-one `is_next` invariant | ✓ VERIFIED | Two-layer defense: DB-level partial unique index `tasks_one_is_next_per_deal_idx ON tasks (deal_id) WHERE is_next = true` (migration 0005, line 6); app-level in `createTask`/`completeTask`/`updateTask` (tasks.ts — clear prior + set new inside ONE db.transaction); Test 11 (INVARIANT) proves 10-way concurrency leaves exactly 1 is_next row; 13/13 task-action tests pass |
| 3 | Stage advance requires two-click confirm, writes audit_log, updates list view | ✓ VERIFIED | `advance-stage-dialog.tsx` uses AlertDialog (role=alertdialog — base-ui primitive); server action `advanceStage` validates forward motion + track compat + writes audit row with `source:"manual_advance"` in same tx; `revalidatePath('/deal/[id]', 'page')` refreshes list view; 10/10 stage-action tests pass |
| 4 | Marking deal `killed` requires reason note; writes audit_log | ✓ VERIFIED | `kill-deal-dialog.tsx` Textarea with `≥3 char` client-side validation (disabled until 3+); `killDealSchema` re-validates server-side (trim + min(3) + max(2000)); `killDeal` action writes 4 rows in ONE tx: UPDATE deals (status='killed'+stage_id='killed'+closedAt) + INSERT deal_notes (is_system=true, kill reason as system note) + 2 audit rows. Test 9 proves tx rollback when audit-throw simulated |
| 5 | Every mutation appears in the Audit tab with before/after | ✓ VERIFIED | `audit-tab.tsx` renders reverse-chron rows from `queryAuditForDeal`; 5 URL-state filter chips (All/Deal/Tasks/Notes/Stage); diff renderer shows before→after with `→` arrow glyph, italic muted `null`, money/date formatting. Every action in Plans 03-06 writes `writeAuditLog` inside its tx: 20 writeAuditLog calls across 4 action files |

**Score:** 5/5 truths verified

---

### Required Artifacts

#### Plan 01 — Schema Extensions
| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `db/schema/app.ts` | tasks + dealNotes tables; killedAt/killReason cols | ✓ VERIFIED | `export const tasks`, `export const dealNotes` present; `killedAt: timestamp`, `killReason: text` on deals; type exports (Task, NewTask, DealNote, NewDealNote) |
| `drizzle/migrations/0005_phase2_tasks_notes_kill.sql` | 2 CREATE TABLE + 2 ADD COLUMN + partial unique idx + 7 FKs + CHECK | ✓ VERIFIED | All content present; `WHERE "tasks"."is_next" = true` partial predicate; 7 FKs with correct ON DELETE semantics (CASCADE for deal_id, SET NULL for self-ref/stage, NO ACTION for users) |
| `tests/unit/schema-shape.test.ts` | P2 describe block + new assertions | ✓ VERIFIED | 16 tests pass; includes P2 describe block |

#### Plan 02 — Shared Zod Schemas
| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/deal-schema.ts` | updateDealSchema (.strict) + killDealSchema | ✓ VERIFIED | 215 lines; updateDealSchema omits mainContact* + trackCode + fileNo + disallows status='killed'; killDealSchema has uuid+trimmed reason 3-2000 |
| `lib/task-schema.ts` | createTask + updateTask + completeTask | ✓ VERIFIED | 79 lines; 14 tests pass |
| `lib/stage-schema.ts` | advance + revert | ✓ VERIFIED | 25 lines; 8 tests pass |
| `lib/note-schema.ts` | createNote | ✓ VERIFIED | 21 lines; 6 tests pass |

#### Plan 03 — Task Server Actions
| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/deal/[id]/actions/tasks.ts` | 5 server actions + invariant | ✓ VERIFIED | 579 lines; `use server`; createTask/completeTask/undoCompleteTask/updateTask/reassignTask; 5 db.transaction; 9 writeAuditLog; 10 triggeringTaskId references |
| `lib/tasks-query.ts` | queryTasksForDeal | ✓ VERIFIED | 83 lines; leftJoin users; single SELECT with ORDER BY is_next DESC + due_date ASC NULLS LAST |
| `tests/unit/task-actions.test.ts` | 11+ behaviors including INVARIANT | ✓ VERIFIED | 13 tests pass; INVARIANT 10-way concurrency test present |

#### Plan 04 — Stage/Deal Actions
| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/deal/[id]/actions/stages.ts` | advance/revert + tx-scoped helpers | ✓ VERIFIED | 282 lines; advanceStage, revertStage, advanceStageInTx, revertStageInTx; source markers manual_advance/manual_revert |
| `app/deal/[id]/actions/deals.ts` | updateDeal + closeDeal + killDeal | ✓ VERIFIED | 339 lines; killDeal writes 4 rows in one tx (manual_kill); updateDeal uses split-parse to preserve .strict() rejection |
| Tests | 19 total | ✓ VERIFIED | 10 stage + 9 deal tests pass; Test 9 (kill-rollback via vi.doMock) present |

#### Plan 05 — Detail Shell + Overview
| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/deal/[id]/page.tsx` | Server Component with data | ✓ VERIFIED | 83 lines; Promise.all 4-way parallel fetch; notFound() branch; URL-state for tab + auditFilter |
| `app/deal/[id]/not-found.tsx` | FileQuestion + copy | ✓ VERIFIED | 34 lines; UI-SPEC copy exact |
| `_components/deal-header.tsx` | back + title + badges + overflow | ✓ VERIFIED | 142 lines; opens close/kill dialogs |
| `_components/stage-stepper.tsx` | pips + Advance CTA + revert click | ✓ VERIFIED | 211 lines; HoverCard tooltips; past pips clickable |
| `_components/deal-tabs.tsx` | 6-tab shell with URL-state | ✓ VERIFIED | 148 lines; VIEW-05 order; tolerant parser |
| `_components/overview-tab.tsx` + `overview-card.tsx` | 4 cards with per-card Edit | ✓ VERIFIED | 170 + 540 lines; Tracking first per VIEW-05; RHF + zodResolver(updateDealSchema) |
| 4 mutation dialogs | advance/revert/close/kill | ✓ VERIFIED | advance-stage-dialog (96L), revert-stage-dialog (107L), close-deal-dialog (79L), kill-deal-dialog (140L — Textarea + ≥3 char gate) |
| shadcn primitives | alert-dialog, textarea, scroll-area | ✓ VERIFIED | All present in `components/ui/` |

#### Plan 06 — Tasks + Notes + Audit Tabs
| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `_components/tasks-tab.tsx` + `task-row.tsx` + `new-task-dialog.tsx` | OPEN/DONE + is_next accent + 5s undo + 6-field add dialog | ✓ VERIFIED | 121 + 181 + 386 lines; `border-l-2 border-primary` (2 matches); `◀ Next` chip; `duration: 5000`; contract-correct `result.stageAdvanced.toLabel` + `result.newIsNext.title` |
| `_components/notes-tab.tsx` | composer + chronological list | ✓ VERIFIED | 136 lines; `Add a note…`, `Save note`, `Note added.` toast verbatim |
| `_components/audit-tab.tsx` | reverse-chron + 5 filter chips + diff | ✓ VERIFIED | 323 lines; URL-state `?auditFilter=`; arrow glyph `→`; italic muted `null` |
| `lib/notes-query.ts` + `lib/audit-query.ts` + `lib/users-query.ts` | readers | ✓ VERIFIED | 49 + 135 + 31 lines; `parseAuditFilter` tolerant; `IS DISTINCT FROM` used in stage-filter SQL |
| `app/deal/[id]/actions/notes.ts` | createNote with tx-rollback | ✓ VERIFIED | 83 lines; 1 db.transaction + writeAuditLog; Test 3 proves rollback |
| `tests/unit/note-actions.test.ts` | 4 behaviors incl. rollback | ✓ VERIFIED | 4 tests pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `tasks.deal_id` | `deals.id` | FK ON DELETE CASCADE | ✓ WIRED | `drizzle/migrations/0005_phase2_tasks_notes_kill.sql:31` — `REFERENCES "public"."deals"("id") ON DELETE cascade` |
| `tasks.advances_stage_to_id` | `stages.id` | FK ON DELETE SET NULL | ✓ WIRED | `drizzle/migrations/0005_phase2_tasks_notes_kill.sql:34` |
| `tasks.parent_task_id` | `tasks.id` | Self-ref FK ON DELETE SET NULL | ✓ WIRED | `drizzle/migrations/0005_phase2_tasks_notes_kill.sql:33` |
| `deal_notes.deal_id` | `deals.id` | FK ON DELETE CASCADE | ✓ WIRED | `drizzle/migrations/0005_phase2_tasks_notes_kill.sql:29` |
| `completeTask` | `advanceStageInTx` | composes same-tx auto-advance | ✓ WIRED | `app/deal/[id]/actions/tasks.ts` imports advanceStageInTx (6 refs); source="task_autoadvance" (7 refs) |
| `undoCompleteTask` | `revertStageInTx` | audit-lookup revert via triggeringTaskId | ✓ WIRED | `tasks.ts` uses triggeringTaskId audit breadcrumb; source="task_autoadvance_undo" (1 ref); `Cannot safely revert stage` abort path (2 refs in tasks.ts, 1 in test) |
| `page.tsx` | `queryDealById + queryTasksForDeal + listUsers + queryNotesForDeal + queryAuditForDeal` | Promise.all | ✓ WIRED | Verified in page.tsx:46,58-63 |
| `deal-tabs.tsx` tabs | 6 TabsTrigger | shadcn Tabs with URL-state | ✓ WIRED | Overview, File Contacts, Tasks, Emails, Notes, Audit — verified in deal-tabs.tsx:83-88 |
| `overview-card.tsx` Save | `updateDeal` | diff → server action → router.refresh | ✓ WIRED | overview-card.tsx imports updateDeal; 540-line implementation shows RHF + diff computation |
| `task-row.tsx` checkbox | `completeTask` + 5s undo toast | with contract-correct result.stageAdvanced.toLabel + result.newIsNext.title | ✓ WIRED | 2 refs each to `result.stageAdvanced.toLabel` + `result.newIsNext.title`; `duration: 5000` |
| `kill-deal-dialog` Textarea | `killDeal` | ≥3 char client + server re-validation | ✓ WIRED | client: disabled until `reason.trim().length >= 3`; server: killDealSchema min(3) |
| `audit-tab.tsx` filter chips | URL `?auditFilter=` | router.push + server re-query | ✓ WIRED | `auditFilter` 4 refs; 5 chip labels (All/Deal/Tasks/Notes/Stage) in JSX |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `page.tsx` → DealTabs | `deal` (DealDetail) | `queryDealById(id)` — Drizzle join deals+tracks+stages | ✓ Yes (real DB query with leftJoin) | ✓ FLOWING |
| `page.tsx` → TasksTab | `tasks` ({open, done}) | `queryTasksForDeal(id)` — real SELECT + leftJoin users | ✓ Yes | ✓ FLOWING |
| `page.tsx` → NotesTab | `notes` | `queryNotesForDeal(id)` — real SELECT | ✓ Yes | ✓ FLOWING |
| `page.tsx` → AuditTab | `auditRows` | `queryAuditForDeal(id, filter)` — real SELECT with JSONB filter | ✓ Yes | ✓ FLOWING |
| `page.tsx` → NewTaskDialog | `users` | `listUsers()` — SELECT ORDER BY name | ✓ Yes | ✓ FLOWING |
| `OverviewCard` → `updateDeal` | `diff` | Computed in-component from RHF values vs `deal` prop | ✓ Yes (real tx UPDATE + audit) | ✓ FLOWING |
| `TaskRow` → `completeTask` → toast | `stageAdvanced.toLabel` / `newIsNext.title` | Returned by `completeTask` after tx UPDATE + auto-promote SELECT | ✓ Yes | ✓ FLOWING |
| `KillDealDialog` → `killDeal` | `reason` | Textarea state | ✓ Yes (writes to deal_notes.body as system note + kill_reason column) | ✓ FLOWING |

All data paths flow through real DB queries. No hollow props, no hardcoded stubs found.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green | `npx vitest run` | 17 files, 170/170 passing in 25.81s | ✓ PASS |
| TypeScript clean | `npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| Build succeeds with 4 routes | `npm run build` | exit 0; routes: `/`, `/_not-found`, `/deal/[id]`, `/deal/new` | ✓ PASS |
| Migration idempotent | (per SUMMARY self-check) | `npm run db:migrate` second run is no-op | ✓ PASS (per prior verification) |
| Partial unique idx enforces is_next | task-actions.test.ts Test 11 INVARIANT | 10-way Promise.allSettled produces exactly 1 is_next=true survivor | ✓ PASS |
| Kill rollback on audit-throw | deal-actions.test.ts Test 9 | vi.doMock('@/lib/audit') → killDeal throws → deals.status='active' + no system note | ✓ PASS |
| Note rollback on audit-throw | note-actions.test.ts Test 3 | vi.doMock('@/lib/audit') → createNote throws → no note row | ✓ PASS |

---

### Requirements Coverage

All 11 Phase 2 requirement IDs are marked `[x]` in `.planning/REQUIREMENTS.md` AND have concrete code evidence.

| Requirement | Source Plan | Description (abbreviated) | Status | Evidence |
|-------------|-------------|---------------------------|--------|----------|
| DEAL-04 | 05, 06 | View deal at `/deal/[id]` with File Contacts/Tasks/Emails/Notes/Audit tabs | ✓ SATISFIED | `deal-tabs.tsx` renders all 6 tabs (VIEW-05 order); `page.tsx` + `not-found.tsx` handle resolve/404 |
| DEAL-05 | 02, 04, 05 | Edit deal title, property details, status in detail view | ✓ SATISFIED | `updateDealSchema` (lib/deal-schema.ts:124); `updateDeal` action (deals.ts); `OverviewCard` per-card edit (540 lines) |
| DEAL-06 | 01, 02, 04, 05 | Mark closed/killed; killed requires reason note | ✓ SATISFIED | `killedAt`+`killReason` cols (schema+migration); `killDealSchema` (3-2000 char reason); `killDeal` 4-row tx action; `kill-deal-dialog` with Textarea + ≥3 char gate |
| STAGE-02 | 02, 04, 05 | Stage advance with 2-click confirm; writes audit_log | ✓ SATISFIED | `advance-stage-dialog` AlertDialog; `advanceStage` server action with `source:"manual_advance"` audit; STAGE-02 acceptance per UAT |
| STAGE-03 | 02, 04, 05 | Revert via explicit action; audited | ✓ SATISFIED | `revert-stage-dialog` destructive AlertDialog; `revertStage` with `source:"manual_revert"`; stepper past-pip click path |
| TASK-01 | 01, 02, 03, 06 | Tasks with is_next + sub-tasks + auto-advance | ✓ SATISFIED | tasks table with advances_stage_to_id + parent_task_id FKs; `completeTask` composes `advanceStageInTx` via triggeringTaskId breadcrumb |
| TASK-02 | 01, 03 | Exactly one is_next per deal | ✓ SATISFIED | DB-level partial unique index `tasks_one_is_next_per_deal_idx`; app-level in `createTask`/`completeTask`/`updateTask`; Test 11 10-way INVARIANT |
| TASK-03 | 03, 06 | Completing is_next auto-promotes next open task | ✓ SATISFIED | `completeTask` selects next open by (due_date ASC NULLS LAST, created_at ASC), flips is_next in same tx; returns `newIsNext:{id,title}` |
| TASK-04 | 03, 06 | 5-second undo toast on task completion | ✓ SATISFIED | `task-row.tsx` — `duration: 5000` + `action: {label: "Undo"}`; `undoCompleteTask` action with audit-lookup revert path |
| TASK-05 | 03, 06 | List view surfaces is_next task | ✓ SATISFIED | `queryTasksForDeal` ORDER BY is_next DESC; Plan 03 provides; list-view wire already existed from Phase 1 em-dash fallback now filled |
| VIEW-05 | 05, 06 | `/deal/[id]` tabs in order; Tracking above Property; field renames | ✓ SATISFIED | `deal-tabs.tsx:83-88` tabs in exact VIEW-05 order; `overview-tab.tsx` section order Tracking/Property/Financials/Dates; field labels "Sales Price"/"Loan Amount"/"Estimated Down" per UI-SPEC |

**Orphaned requirements:** None. All 11 IDs declared in plan frontmatter match REQUIREMENTS.md Phase-2 mapping (DEAL-04..06, STAGE-02..03, TASK-01..05, VIEW-05).

---

### Anti-Patterns Scanned

| File/Area | Pattern | Result | Severity |
|-----------|---------|--------|----------|
| `app/deal/[id]/**` | TODO/FIXME/XXX/HACK/PLACEHOLDER/"Not implemented" | 0 matches | ✓ None |
| `lib/*-query.ts` + `lib/*-schema.ts` | TODO/FIXME/XXX/HACK/PLACEHOLDER | 0 matches | ✓ None |
| Phase 2 files | `@/db/client` imports | 0 matches (only 1 comment in deals-query.ts documenting the ban) | ✓ None — convention held |
| `app/deal/[id]/` | `mainContact` references | 0 matches | ✓ B1 held (contract compliance) |
| `app/deal/[id]/actions/*.ts` | db.transaction pairing | 14 transactions across 4 files; 20 writeAuditLog calls — every mutation wraps mutation + audit in one tx | ✓ D-05 convention held |

---

### Contract Compliance (from revision iteration 1)

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `grep "mainContact" lib/ app/` outside phase-1 files | 0 in `app/deal/[id]/` | 0 matches in `app/deal/[id]/` tree | ✓ B1 HELD |
| `grep "result.stageAdvanced.toLabel" app/` | ≥ 1 | 2 matches in `task-row.tsx` (line 38 comment + line 101 code) | ✓ W2 HELD |
| `grep "result.newIsNext.title" app/` | ≥ 1 | 2 matches in `task-row.tsx` (line 39 comment + line 104 code) | ✓ W3 HELD |
| `grep "Cannot safely revert stage"` | ≥ 1 | 2 in `tasks.ts` (throws), 1 in test (assertion), 1 in JSDoc | ✓ W1 HELD (abort path) |
| `grep "triggeringTaskId"` | ≥ 2 | 10 in `tasks.ts`, 1 in `audit-tab.tsx` IGNORE_KEYS, 5 in tests | ✓ W1 HELD (audit breadcrumb) |

---

### Convention Compliance

| Convention | Status | Evidence |
|------------|--------|----------|
| No `@/db/client` imports | ✓ HELD | Zero imports; only 1 doc-comment in deals-query.ts |
| Every mutation server action wraps DML + audit in ONE db.transaction | ✓ HELD | 14 db.transaction × 20 writeAuditLog across 4 actions/*.ts files |
| audit_log.source values used | ✓ HELD | `user_action`, `task_autoadvance`, `task_autoadvance_undo`, `task_undo_complete`, `manual_advance`, `manual_revert`, `manual_close`, `manual_kill` — all present |
| audit operation kinds | ✓ HELD | `create`, `update` — no `delete` needed for P2 surface |
| Phase 0.5 crypto + audit scaffolding not regressed | ✓ HELD | `tests/unit/crypto.test.ts` 5/5 pass; `tests/unit/access.test.ts` 6/6 pass; `tests/unit/env.test.ts` 10/10 pass |

---

### Behavioral Gaps / Human Verification Required

No automated gaps found. The following items require human UAT due to visual / runtime / external-service nature:

1. **Visual UAT of /deal/[id] including 4 mutation dialogs.** Verify advance/revert/close/kill AlertDialogs render with UI-SPEC copy verbatim, focus management correct (primary CTA auto-focused), keyboard Enter confirms, Escape cancels.

2. **5-second undo toast timing + content on task complete.** Verify toast persists ~5 s with Undo action; clicking Undo reverses the mutation and (if auto-promote happened) restores prior is_next. Three copy variants must match UI-SPEC: plain / milestone-advanced / next-task-promoted.

3. **Audit tab filter chips URL-state behavior.** Verify clicking a chip updates `?auditFilter=<key>` in URL; page re-renders with filtered rows; unknown values silently fall back to 'all'.

4. **Stepper pip-click affordance (revert to past stage).** Verify past pips are clickable with cursor:pointer + focus ring; clicking opens RevertStageDialog with destructive variant; future pips are disabled (no hover/click response).

5. **E2E through Cloudflare Access authentication:** create deal → open detail → advance stage → add task → kill → verify Audit tab shows every mutation in reverse-chron with before/after diff.

---

### Overall Status

**automated: PASSED** — all 5 success criteria verified end-to-end, all 11 requirements satisfied with code evidence, 170/170 tests green, tsc + build clean, no stubs, no convention drift, all contract-compliance greps pass.

**human_verification: 5 items queued** — visual + interactive + E2E behaviors that cannot be proven by grep.

---

## Gaps Summary

No automated gaps. Phase 2 goal is achieved end-to-end; the implementation substantiates every ROADMAP success criterion and every declared requirement ID with concrete code paths, transactional audit writes, and behavioral tests (including invariant + rollback tests). The B1/W1/W2/W3 contract-compliance checks from planner revision iteration 1 all hold.

The 5 items queued for human UAT are standard visual/interactive/E2E spot-checks inherent to shipping a new UI surface — they are not gaps in the code but verification steps that require a running app and human judgment.

---

_Verified: 2026-04-17_
_Verifier: Claude (gsd-verifier)_
