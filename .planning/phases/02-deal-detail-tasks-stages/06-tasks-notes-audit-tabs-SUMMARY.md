---
phase: 02-deal-detail-tasks-stages
plan: 06
subsystem: ui
tags: [nextjs, app-router, react-hook-form, zod, shadcn, base-ui, drizzle, audit, tdd, url-state]

# Dependency graph
requires:
  - phase: 02-deal-detail-tasks-stages/01
    provides: "deal_notes table + tasks table (P2 migration 0005)"
  - phase: 02-deal-detail-tasks-stages/02
    provides: "createNoteSchema + createTaskSchema"
  - phase: 02-deal-detail-tasks-stages/03
    provides: "queryTasksForDeal + createTask/completeTask/undoCompleteTask (W2 toLabel + W3 newIsNext.title contract)"
  - phase: 02-deal-detail-tasks-stages/04
    provides: "audit source vocab (manual_advance/revert/close/kill, task_autoadvance, task_autoadvance_undo, user_action)"
  - phase: 02-deal-detail-tasks-stages/05
    provides: "DealDetail type + availableStages array + deal-tabs.tsx shell with URL-state ?tab=<slug>"
  - phase: 01-core-data-model/06
    provides: "lib/format.ts::relativeTime + URL-state pattern from lib/filter-params.ts"
provides:
  - "Tasks tab — OPEN/DONE sections, is_next accent bar, 5s undo toast with contract-correct copy, New Task dialog wired to Plan 03 actions"
  - "Notes tab — composer + newest-first Card list + createNote Server Action"
  - "Audit tab — reverse-chron rows, 5 URL-state filter chips (?auditFilter=all|deal|tasks|notes|stage), before→after diff, empty-filter state"
  - "lib/notes-query.ts::queryNotesForDeal + NoteListRow type"
  - "lib/audit-query.ts::queryAuditForDeal + parseAuditFilter + AuditFilter/AuditRow types"
  - "lib/users-query.ts::listUsers + UserOption type"
  - "app/deal/[id]/actions/notes.ts::createNote (1 tx: insert + audit, rollback proven by Test 3)"
  - "page.tsx Promise.all fetches 4 parallel data sources and threads them through deal-tabs"
affects: [P3-contacts, P4-emails, P5-notes-extensions, P10-calibration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "3-layer URL-state: page.tsx parses ?auditFilter via tolerant parseAuditFilter; server re-queries audit_log when filter changes; client pushes new URL via router.push — DB filtering is authoritative, memoised rows are not"
    - "AuditRow diff rendering with operation-awareness: create shows after-only, delete strikes through before, update renders before → after with IGNORE_KEYS skip list (id, updated_at, created_at, source, triggeringTaskId) to suppress noise"
    - "Contract keys propagated verbatim from Plan 03: result.stageAdvanced.toLabel (not toCode), result.newIsNext.title (not id), result.newIsNext?.id ?? null passed to undoCompleteTask"
    - "Promise.all parallel fetch in Server Component: queryTasksForDeal + listUsers + queryNotesForDeal + queryAuditForDeal — one wall-clock round-trip"
    - "Tolerant parseAuditFilter mirrors lib/filter-params.ts convention — unknown values silently fall back to 'all'"
    - "Audit diff IGNORE_KEYS suppresses: id, updated_at, created_at (write artifacts), source + triggeringTaskId (audit-internal breadcrumbs from Plan 03/04). Carrie sees only semantic changes"

key-files:
  created:
    - "lib/notes-query.ts (45 lines) — queryNotesForDeal + NoteListRow"
    - "lib/audit-query.ts (126 lines) — queryAuditForDeal + parseAuditFilter + AuditFilter/AuditRow"
    - "lib/users-query.ts (25 lines) — listUsers + UserOption"
    - "app/deal/[id]/actions/notes.ts (76 lines) — createNote Server Action with tx-rollback invariant"
    - "tests/unit/note-actions.test.ts (191 lines) — 4 behaviors including INVARIANT rollback test"
    - "app/deal/[id]/_components/tasks-tab.tsx (113 lines) — OPEN/DONE sections, empty state, add-task CTA"
    - "app/deal/[id]/_components/task-row.tsx (170 lines) — is_next accent bar + undo-toast flow"
    - "app/deal/[id]/_components/new-task-dialog.tsx (300 lines) — 6-field RHF dialog with reachable-stages filter"
    - "app/deal/[id]/_components/notes-tab.tsx (120 lines) — composer + Card list"
    - "app/deal/[id]/_components/audit-tab.tsx (280 lines) — reverse-chron + 5 filter chips + diff renderer"
  modified:
    - "app/deal/[id]/_components/deal-tabs.tsx (signature extended: tasks/users/notes/auditRows/auditFilter props; placeholders replaced for Tasks/Notes/Audit)"
    - "app/deal/[id]/page.tsx (Promise.all adds queryTasksForDeal + listUsers + queryNotesForDeal + queryAuditForDeal; parseAuditFilter threads URL-state into the audit query)"

key-decisions:
  - "Audit filter SQL lives server-side (lib/audit-query.ts). Stage-filter predicate uses Postgres IS DISTINCT FROM on beforeJson->>'stage_id' vs afterJson->>'stage_id' so NULL-handling is explicit (plain != would treat null-to-value changes as equal). Task/Note filters use IN (subquery) joined back to the deal."
  - "createNote returns a 3-way discriminated union like createTask in Plan 03: {ok:true,noteId} | {ok:false,errors} | {ok:false,error}. Zod validation errors stay distinct from runtime errors so RHF can attach field-level messages if the UI grows validation surface beyond the single textarea."
  - "Audit diff IGNORE_KEYS includes `source` and `triggeringTaskId` — they're audit-internal breadcrumbs (Plans 03 + 04) that would otherwise show up in every deals.update row as noise. Keeping them out of the rendered diff keeps the Audit tab signal-to-noise high."
  - "Notes composer always renders, even on empty state — same textarea is the first-note entry point. Empty-state iconography (StickyNote + 'No notes yet') renders below the composer instead of replacing it. Simpler mental model than switching surfaces for the zero-row case."
  - "reachableStages in NewTaskDialog filters to (sort_order > current.sortOrder) + (track_id is null or matches deal.trackId) + (code !== 'killed'). Killed is only reachable via KillDealDialog — it never shows in the 'advances stage to' dropdown."
  - "Task row's handleComplete captures prevIsNext BEFORE calling completeTask so the Undo payload reflects the row's state at-click, not at-undo (the server's mutated is_next would be wrong for undo)."
  - "Audit-tab filter chips push URL via router.push; the Server Component re-fetches with the new filter. Alternative (client-side filter over a single prefetched payload) would have required fetching ALL audit rows for the 'All' case even when Carrie wants only 'Stage'. Server-side filter keeps the payload small."

patterns-established:
  - "URL-state driven Server Component fetch: tolerant parser in lib module → Server Component page.tsx consumes it → Client Component receives the result as prop → Client Component pushes new URL on user action → cycle repeats. Same shape as the list view's filter bar; now re-used for Audit filter."
  - "Create-mutation Server Action: one db.transaction wrapping (a) INSERT with .returning() + (b) writeAuditLog. Plan 04's killDeal (compound) and this plan's createNote (single) both conform. Rollback invariant proven by a test that vi.doMock's @/lib/audit to throw."
  - "Audit diff rendering contract: IGNORE_KEYS + MONEY_KEYS + DATE_KEYS constants + formatValue(key, value) function. Adding a new money/date column requires one constant edit; adding a new noise-filter key requires one IGNORE_KEYS entry. Keeps the diff renderer as a thin table over data."
  - "Client component undo flow: capture row state BEFORE the mutation, pass to toast's onClick closure, use in the undo payload. Ensures 'what to undo' matches 'what was changed' even if the server has since promoted a new is_next."

requirements-completed: [DEAL-04, TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, VIEW-05]

# Metrics
duration: ~11m
completed: 2026-04-18
---

# Phase 2 Plan 06: Tasks + Notes + Audit Tabs Summary

**Three tabs wired from scratch: Tasks (Plan 03 actions + is_next accent + 5s undo toast), Notes (createNote Server Action with tx-rollback invariant), Audit (per-deal reverse-chron with 5 URL-state filter chips + before→after diff). Every mutation in Phase 2 now appears with before/after in the Audit tab — success criterion 5 proven end-to-end.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-04-18T02:39:54Z (baseline 166/166)
- **Completed:** 2026-04-18T02:50:47Z
- **Tasks:** 3 (Task 1 queries/actions/tests, Task 2 tasks UI, Task 3 notes+audit UI + page wiring)
- **Files created:** 10
- **Files modified:** 2 (deal-tabs.tsx, page.tsx)
- **Test delta:** 166 → 170 (+4 note-action tests)

## Accomplishments

- **Tasks tab fully wired:** OPEN section ordered by is_next DESC then due_date ASC NULLS LAST (inherits queryTasksForDeal contract from Plan 03); DONE section collapsible (collapsed by default when count >= 5); empty state with ListChecks icon + primary CTA. Task rows render the `border-l-2 border-primary` accent bar for is_next=true + `◀ Next` chip + Body-tier title + relative-time due date (overdue = destructive, today = amber, future = muted) + `@owner`. Completion fires a 5-second toast with Undo; undo calls undoCompleteTask with the auto-promoted sibling id + prior is_next. Three toast copies (plain / milestone-advanced / next-task-promoted) match UI-SPEC verbatim.

- **Contract compliance (W2/W3 revision) proven by grep:**
  - `result.stageAdvanced.toLabel` used in task-row.tsx (2 occurrences — comment + code) — NOT toCode, NOT to
  - `result.newIsNext.title` used in task-row.tsx (2 occurrences) — return type's .title field
  - `result.newIsNext?.id ?? null` passed to undoCompleteTask (2 occurrences)

- **New-task dialog:** 6 fields per UI-SPEC (title required / owner / due date / parent task / advances_stage_to / is_next). RHF + zodResolver(createTaskSchema); server re-validates. Reachable-stages filter excludes `killed` and non-track-compatible stages. Submit success: close dialog, reset, router.refresh, toast `Task added.` Submit error: toast `Couldn't add task — {error}. Try again.`

- **Notes tab:** Textarea composer with `Add a note…` placeholder; `Save note` button visible only when textarea has content. `createNote` Server Action wraps INSERT + writeAuditLog in ONE db.transaction per D-05. Rollback invariant proven by Test 3 (vi.doMock writeAuditLog → throw → note row does NOT exist). Newest-first Card list with Avatar initials + relativeTime + `system` chip for kill-note rows. Empty state renders StickyNote 48px + copy verbatim.

- **Audit tab:** Sticky filter header with 5 chips (All / Deal / Tasks / Notes / Stage) rendered as shadcn outline Buttons; active chip gets `bg-primary text-primary-foreground`. URL-state via `?auditFilter=<key>`; unknown values fall back to `all` via parseAuditFilter. Rows render reverse-chron: meta line (font-mono 13px muted: `{relativeTime} · {email} · {table}.{op}`) + diff lines per changed field. Diff renders before → after with arrow glyph (→ U+2192); nulls as italic muted `null`; money as `$485,000`; dates as `Apr 17, 2026`; operation='create' shows after-only; operation='delete' strikes through before. IGNORE_KEYS filters audit-internal noise (id, updated_at, source, triggeringTaskId). Empty-filter state with Show all button that clears `?auditFilter`.

- **Server-side audit filter SQL:** Five filters in lib/audit-query.ts. `deal` = `table_name='deals' AND record_id=dealId`. `tasks` = `table_name='tasks' AND record_id IN (SELECT id FROM tasks WHERE deal_id=dealId)`. `notes` = same pattern on deal_notes. `stage` = deal rows where `beforeJson->>'stage_id' IS DISTINCT FROM afterJson->>'stage_id'` (IS DISTINCT FROM handles NULLs explicitly). `all` is the OR of the three table branches.

- **page.tsx Promise.all:** 4 parallel fetches (queryDealById already cached at line above; then queryTasksForDeal + listUsers + queryNotesForDeal + queryAuditForDeal). Audit filter drives the audit query so the server returns only filter-matching rows.

- **Phase 2 success criterion 5 proven:** Every mutation in Plans 03-05 now appears in the Audit tab with full before/after:
  - Overview edits (Plan 05 OverviewCard → updateDeal) → deals.update row
  - Stage advance/revert (Plan 04 advanceStage/revertStage → Plan 05 dialogs) → deals.update row with source marker
  - Task create/complete/undo/update (Plan 03) → tasks.create / tasks.update rows
  - Deal close/kill (Plan 04 → Plan 05 dialogs) → deals.update + deal_notes.create rows
  - Note create (THIS plan) → deal_notes.create row

## Task Commits

1. **Task 1:** notes + audit + users queries + createNote action + 4 tests — `e66ce71` (feat)
2. **Task 2:** tasks tab + task-row + new-task dialog + deal-tabs.tsx wiring + page.tsx partial — `89d7ce2` (feat)
3. **Task 3:** notes + audit tabs + deal-tabs.tsx final wiring + page.tsx Promise.all complete — `a6e93e8` (feat)

**Plan metadata commit:** pending (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md)

## Files Created/Modified

### Created
- `lib/notes-query.ts` — queryNotesForDeal (leftJoin users for author names)
- `lib/audit-query.ts` — queryAuditForDeal + parseAuditFilter + AuditFilter/AuditRow types
- `lib/users-query.ts` — listUsers (ORDER BY name NULLS LAST, email)
- `app/deal/[id]/actions/notes.ts` — createNote Server Action with tx-rollback invariant
- `tests/unit/note-actions.test.ts` — 4 behaviors (happy / validation / INVARIANT rollback / 5001-char)
- `app/deal/[id]/_components/tasks-tab.tsx` — Tasks panel
- `app/deal/[id]/_components/task-row.tsx` — Row with is_next accent + undo-toast flow
- `app/deal/[id]/_components/new-task-dialog.tsx` — 6-field RHF dialog
- `app/deal/[id]/_components/notes-tab.tsx` — composer + list
- `app/deal/[id]/_components/audit-tab.tsx` — reverse-chron + filter chips + diff

### Modified
- `app/deal/[id]/_components/deal-tabs.tsx` — signature gains tasks/users/notes/auditRows/auditFilter props; Tasks/Notes/Audit TabsContent panels replaced with real components
- `app/deal/[id]/page.tsx` — adds queryTasksForDeal + listUsers + queryNotesForDeal + queryAuditForDeal imports; parseAuditFilter parses ?auditFilter; Promise.all parallelizes 4 readers

## Decisions Made

1. **Audit diff IGNORE_KEYS includes `source` and `triggeringTaskId`** — they're audit-internal breadcrumbs (source = manual_kill / task_autoadvance / user_action from Plans 03+04; triggeringTaskId from Plan 03's completeTask → advanceStageInTx merge). Showing them in every diff would drown out the signal. If Carrie wants forensic-level detail during P10 calibration, a "show internals" toggle is a small tweak.
2. **createNote 3-way result union** — `{ok:true, noteId}` | `{ok:false, errors}` (Zod validation) | `{ok:false, error}` (runtime). Mirrors createTask in Plan 03. The Notes tab currently only surfaces body errors through a single toast (Carrie won't see field-level messages on a single-field form), but the shape is there for future multi-field note variants.
3. **Stage-filter SQL uses `IS DISTINCT FROM`, not `!=`** — plain inequality in SQL treats NULL != 'abc' as NULL (not true), which would exclude legitimate null→value transitions from the filter. IS DISTINCT FROM handles NULL explicitly per Postgres semantics. Critical because deals.stage_id is NOT NULL but audit rows may have partial JSONB (e.g., pre-P2 create rows).
4. **Server-side audit filter rather than client-side** — filter chips push URL; Server Component re-queries with the new filter; client receives a filtered payload. Keeps the network trip small when Carrie scopes to "Stage" on a deal with 100+ task-level audit rows.
5. **Notes composer is always rendered** — even on the empty state. Same textarea is the zero-note entry point. Empty-state iconography renders below the composer. Simpler mental model than two surfaces.
6. **Task row captures prevIsNext at click time** — before calling completeTask. The closure in the Undo action refers to the captured value, not a subsequent server state. Otherwise undo would read "is_next=false (because we just cleared it)" instead of "is_next=true (because that was the state we need to restore)".

## Deviations from Plan

None — the plan executed exactly as written. The W2/W3 contract-compliance callouts from the planner revision (result.stageAdvanced.toLabel / result.newIsNext.title / result.newIsNext?.id ?? null) were built in from the first task-row.tsx write and verified by grep at acceptance-criteria checkpoint.

## Issues Encountered

- Transient tsc error in Task 2 where the deal-tabs.tsx import list briefly lost StickyNote + Filter icons while I was swapping out the Tasks placeholder. Fixed inline by restoring the imports (the Notes + Audit panels were still placeholders at that moment). Caught by `npx tsc --noEmit` before the commit. No deviation — this is the normal tsc-guided refactor loop.

## User Setup Required

None — no new env vars, no migrations, no external service configuration. The UI reads existing users (Cloudflare Access upserts on sign-in) and existing audit_log (populated by every mutation from Plans 03-05).

## Self-Check

Automated verification on all claims:

**Created files exist:**
- `lib/notes-query.ts` — FOUND
- `lib/audit-query.ts` — FOUND
- `lib/users-query.ts` — FOUND
- `app/deal/[id]/actions/notes.ts` — FOUND
- `tests/unit/note-actions.test.ts` — FOUND
- `app/deal/[id]/_components/tasks-tab.tsx` — FOUND
- `app/deal/[id]/_components/task-row.tsx` — FOUND
- `app/deal/[id]/_components/new-task-dialog.tsx` — FOUND
- `app/deal/[id]/_components/notes-tab.tsx` — FOUND
- `app/deal/[id]/_components/audit-tab.tsx` — FOUND

**Commits exist:**
- `e66ce71` — FOUND (Task 1)
- `89d7ce2` — FOUND (Task 2)
- `a6e93e8` — FOUND (Task 3)

**Acceptance grep counts (all pass):**

Task 1:
- `writeAuditLog in notes.ts`: 1 ≥ 1 ✓
- `db.transaction in notes.ts`: 1 ≥ 1 ✓
- `eq(auditLog.tableName in audit-query.ts`: 3 ≥ 1 ✓
- `it( blocks in note-actions test`: 4 ≥ 4 ✓

Task 2:
- `border-l-2 border-primary in task-row.tsx`: 2 ≥ 1 ✓
- `◀ Next in task-row.tsx`: 2 ≥ 1 ✓
- `completeTask in task-row.tsx`: 3 ≥ 1 ✓
- `undoCompleteTask in task-row.tsx`: 4 ≥ 1 ✓
- `duration: 5000 in task-row.tsx`: 1 ≥ 1 ✓
- `Milestone advanced to in task-row.tsx`: 2 ≥ 1 ✓
- `result.stageAdvanced.toLabel in task-row.tsx`: 2 ≥ 1 ✓ (W2 compliance)
- `result.newIsNext.title in task-row.tsx`: 2 ≥ 1 ✓ (W3 compliance)
- `result.newIsNext?.id in task-row.tsx`: 2 ≥ 1 ✓ (W3 compliance)
- `createTask in new-task-dialog.tsx`: 6 ≥ 1 ✓
- `zodResolver in new-task-dialog.tsx`: 3 ≥ 1 ✓
- `createTaskSchema in new-task-dialog.tsx`: 3 ≥ 1 ✓
- `+ New task in tasks-tab.tsx`: 4 ≥ 1 ✓
- `No tasks yet in tasks-tab.tsx`: 2 ≥ 1 ✓

Task 3:
- `Add a note… in notes-tab.tsx`: 2 ≥ 1 ✓
- `Save note in notes-tab.tsx`: 2 ≥ 1 ✓
- `createNote in notes-tab.tsx`: 3 ≥ 1 ✓
- `Note added. in notes-tab.tsx`: 2 ≥ 1 ✓
- `No notes yet in notes-tab.tsx`: 2 ≥ 1 ✓
- audit-tab.tsx has all 5 filter labels (All, Deal, Tasks, Notes, Stage): 5 ≥ 5 ✓
- `auditFilter in audit-tab.tsx`: 4 ≥ 1 ✓
- `→ arrow glyph in audit-tab.tsx`: 2 ≥ 1 ✓
- `No audit rows match this filter`: 1 ≥ 1 ✓
- `Show all in audit-tab.tsx`: 2 ≥ 1 ✓
- `Promise.all in page.tsx`: 1 ≥ 1 ✓
- `queryTasksForDeal|queryNotesForDeal|queryAuditForDeal|listUsers in page.tsx`: 8 ≥ 4 ✓

**Build + tests:**
- `npx vitest run tests/unit/note-actions.test.ts` → 4/4 green in 2.20s
- Full suite `npx vitest run` → **170/170 green** (166 baseline + 4 new)
- `npx tsc --noEmit` → exit 0, no errors
- `npm run build` → exit 0, 4 routes (`/`, `/_not-found`, `/deal/[id]`, `/deal/new`)

**Plan must_haves truths — all verified:**
- [x] Tasks tab renders OPEN (is_next surfaced first) + collapsible DONE (collapsed by default when n ≥ 5) — code inspection + grep
- [x] Each open task row shows checkbox + optional `◀ Next` chip + title + relative due + `@owner` — code inspection
- [x] is_next task row has `border-l-2 border-primary` left-edge accent bar — grep 2 matches
- [x] Checking task fires 5-second undo toast with Undo button — grep `duration: 5000` + `action: { label: "Undo" ... }`
- [x] Auto-advance toast copy: `Task completed. Milestone advanced to {stage.label}. Undo?` — grep literal string 2 matches, uses result.stageAdvanced.toLabel
- [x] `+ New task` button opens a Dialog with 6 fields — code inspection: title/owner/dueDate/parentTask/advancesStageToId/isNext
- [x] Notes tab shows newest-first Card list + composer textarea + `Save note` button visible only when content — code inspection
- [x] Audit tab renders reverse-chron rows from audit-query; 5 filter chips (All/Deal/Tasks/Notes/Stage); URL-state `?auditFilter=`; active chip gets primary fill; arrow glyph `→`; italic muted `null` — code inspection + grep
- [x] deal-tabs.tsx — Tasks/Notes/Audit panels now render real components, no placeholders remain for those three — grep `PlaceholderPanel` only matches contacts + emails panels

**Plan success-criteria — all verified:**
- [x] Tasks tab fully functional: open/done, is_next accent, 5s undo toast, auto-advance wiring, add-task dialog
- [x] Notes tab: composer + list + createNote with audit row (Test 1 proves)
- [x] Audit tab: reverse-chron + 5 chips + before→after diff + empty-filter state
- [x] Phase 2 success criterion 5 proven (every mutation appears in Audit tab) — decisions section + code inspection
- [x] deal-tabs.tsx no longer has Tasks/Notes/Audit placeholder content
- [x] 3 commits landed: queries+actions+tests / tasks UI / notes+audit+page wiring

## Self-Check: PASSED

All acceptance criteria met. Three commits landed atomically. Full test suite 170/170 green; tsc + build clean. Phase 2 requirements DEAL-04, TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, VIEW-05 complete (DEAL-05, DEAL-06, STAGE-02, STAGE-03 already complete from Plans 02/04/05).

## P2 Complete — Handoff Note

Phase 2 is now complete end-to-end. All five Phase 2 success criteria from ROADMAP.md are met:

1. **✅ `/deal/[id]` renders a working detail page** (Plans 05 + 06)
2. **✅ Overview tab edits persist** (Plan 05 per-card updateDeal → audit row)
3. **✅ Tasks tab: create/complete/undo/auto-advance/auto-promote** (Plans 03 + 06)
4. **✅ Stage advance/revert/close/kill flows** (Plans 04 + 05)
5. **✅ Every mutation appears in Audit tab with before/after** (this plan — Audit tab wired over Plan 03+04+05+06 audit_log writes)

**UI-SPEC `Ship + revisit` decisions Carrie should evaluate during UAT** (assumptions flagged in `02-UI-SPEC.md` open questions):

- **Assumption 1:** Per-card Overview edit (not whole-page). If Carrie wants to batch-update many fields after a PSA arrives, P10 adds a page-level "Edit all" toggle.
- **Assumption 2:** Overflow menu for Close/Kill (not inline buttons). Promote Close to a first-class button near terminal stages if Carrie requests.
- **Assumption 4:** Append-only notes. If Carrie fat-fingers a note and needs edit/delete, P3 adds the affordance.
- **Assumption 7:** Auto-advance-stage skips the confirm prompt. If Carrie reports surprise stage advances, P10 adds an inline confirm.
- **Assumption 9:** Card-scoped Overview edit (not per-field inline). If Carrie wants one-tap single-field edits, P10 adds click-to-edit per row.
- **Assumption 11:** Accent color extended to active tab underline + is_next task bar + current stepper pip. Flip any of these back to neutral during P10 calibration if they fight the list-view accent economy.
- **Assumption 12:** No dirty-form confirmation on navigate-away. Browser unload handles the hard case; add in-app warning only if Carrie reports losing work.

**Next:** Phase transition to Phase 3 (per-deal contacts + role slots). P3 will rename the File Contacts tab from placeholder to real content, migrate free-text `main_contact_*` columns to a contacts FK (D-03), and add the role-slot edit UI.

---
*Phase: 02-deal-detail-tasks-stages*
*Plan: 06*
*Completed: 2026-04-18*
