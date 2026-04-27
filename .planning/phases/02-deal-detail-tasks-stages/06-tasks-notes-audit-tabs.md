---
phase: 02-deal-detail-tasks-stages
plan: 06
type: execute
wave: 3
depends_on: [02-deal-detail-tasks-stages/01, 02-deal-detail-tasks-stages/02, 02-deal-detail-tasks-stages/03, 02-deal-detail-tasks-stages/04, 02-deal-detail-tasks-stages/05]
files_modified:
  - app/deal/[id]/_components/tasks-tab.tsx
  - app/deal/[id]/_components/task-row.tsx
  - app/deal/[id]/_components/new-task-dialog.tsx
  - app/deal/[id]/_components/notes-tab.tsx
  - app/deal/[id]/_components/audit-tab.tsx
  - app/deal/[id]/_components/deal-tabs.tsx
  - app/deal/[id]/actions/notes.ts
  - lib/notes-query.ts
  - lib/audit-query.ts
  - lib/users-query.ts
  - tests/unit/note-actions.test.ts
autonomous: true
requirements: [DEAL-04, TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, VIEW-05]
requirements_addressed: [DEAL-04, TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, VIEW-05]

must_haves:
  truths:
    - "Tasks tab renders OPEN section (ordered is_next first then due_date asc nulls last) and collapsible DONE section (collapsed by default when done count ≥ 5), per UI-SPEC lines 320-355"
    - "Each open task row shows a checkbox, optional '◀ Next' chip for is_next=true, title, relative-time due date, @owner label; hovering exposes inline edit popover"
    - "The is_next task row has a left-edge 2px primary accent bar (border-l-2 border-primary) — the P2-NEW accent use from UI-SPEC line 130"
    - "Checking a task fires a 5-second undo toast with Undo button; Undo calls undoCompleteTask action"
    - "When the completed task had advancesStageToId set, the toast copy is `Task completed. Milestone advanced to {stage.label}. Undo?`"
    - "'+ New task' button opens a Dialog with form fields: title (required), owner (select from users), due date (Popover + Calendar), parent task (select — optional), advances_stage_to (select — optional, shows only stages reachable from current with sort_order > current.sort_order), is_next (checkbox, default false)"
    - "Notes tab shows newest-first Card list; composer textarea + `Save note` primary button (only visible when textarea has content); save calls createNote action"
    - "Audit tab renders reverse-chron rows from audit-query; filter chips `All / Deal / Tasks / Notes / Stage` (URL-state `?auditFilter=<key>`); active chip gets primary fill; diff rendering uses arrow glyph `→` and italic muted `null`"
    - "deal-tabs.tsx updated: Tasks / Notes / Audit tab panels now render real components, no placeholders remain"
  artifacts:
    - path: "app/deal/[id]/_components/tasks-tab.tsx"
      provides: "Full Tasks tab — open/done sections, add CTA, empty state"
    - path: "app/deal/[id]/_components/new-task-dialog.tsx"
      provides: "Add-task dialog with all 6 fields from UI-SPEC lines 358-364"
    - path: "app/deal/[id]/_components/notes-tab.tsx"
      provides: "Notes composer + chronological list"
    - path: "app/deal/[id]/_components/audit-tab.tsx"
      provides: "Reverse-chron audit list with 5-chip URL-state filter"
    - path: "app/deal/[id]/actions/notes.ts"
      provides: "createNote server action"
      exports: ["createNote", "CreateNoteResult"]
    - path: "lib/notes-query.ts"
      provides: "queryNotesForDeal"
      exports: ["queryNotesForDeal", "NoteListRow"]
    - path: "lib/audit-query.ts"
      provides: "queryAuditForDeal with filter"
      exports: ["queryAuditForDeal", "AuditRow", "AuditFilter"]
    - path: "lib/users-query.ts"
      provides: "listUsers for owner-select dropdown"
      exports: ["listUsers", "UserOption"]
  key_links:
    - from: "app/deal/[id]/_components/tasks-tab.tsx"
      to: "lib/tasks-query.ts::queryTasksForDeal + app/deal/[id]/actions/tasks.ts"
      via: "server-props + server-action imports"
      pattern: "queryTasksForDeal\\|createTask\\|completeTask\\|undoCompleteTask"
    - from: "app/deal/[id]/_components/audit-tab.tsx"
      to: "lib/audit-query.ts::queryAuditForDeal"
      via: "server-component fetch"
      pattern: "queryAuditForDeal\\("
    - from: "app/deal/[id]/_components/notes-tab.tsx"
      to: "app/deal/[id]/actions/notes.ts::createNote"
      via: "server-action call"
      pattern: "createNote\\("
---

<objective>
Fill in the three remaining tabs (Tasks, Notes, Audit) that Plan 05 stubbed as placeholders. This plan completes Phase 2 success criterion 5 (`Every mutation appears in the Audit tab with before/after`) and DEAL-04 in full (all tabs rendered per VIEW-05).

Two new server-action / query modules land here: `createNote` action + notes/audit/users query modules. The three tab components compose existing primitives and the Wave-2 action modules — no new primitives required (alert-dialog, textarea, scroll-area already installed in Plan 05).

Purpose: TASK-01..05 UI (tasks tab completes the TASK functionality), Notes tab per DEAL-04, Audit tab per success criterion 5.
Output: three fully-functional tabs; deal-tabs.tsx no longer has any placeholder content.
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

# Patterns + Wave 2 action modules:
@app/deal/new/new-deal-form.tsx
@app/deal/[id]/actions/tasks.ts
@app/deal/[id]/actions/deals.ts
@lib/tasks-query.ts
@lib/audit.ts
@lib/note-schema.ts
@lib/format.ts
@lib/parse-money.ts

# Plan 05 shell that this plan extends:
@.planning/phases/02-deal-detail-tasks-stages/05-deal-detail-shell-overview-tab.md

<interfaces>
From Plan 03:
```typescript
export async function createTask(raw): Promise<CreateTaskResult>;
export async function completeTask(raw): Promise<CompleteTaskResult>;
export async function undoCompleteTask(raw): Promise<...>;
export async function updateTask(raw): Promise<...>;
export async function reassignTask(id, ownerUserId): Promise<...>;

export type TaskListRow = { id, title, dueDate, status, isNext, ownerUserId, completedAt, createdAt, advancesStageToId, parentTaskId, ownerName };
export async function queryTasksForDeal(dealId): Promise<{ open: TaskListRow[]; done: TaskListRow[] }>;
```

From Plan 02:
```typescript
export const createNoteSchema;
export type CreateNoteInput;
```

From Plan 05 (DealDetail type):
```typescript
type DealDetail = { ..., availableStages: [...], currentStage: {...}, ... };
```

From db/schema/app.ts (Plan 01):
```typescript
tasks, dealNotes, auditLog, users;
```

Copy contract (UI-SPEC lines 700-723) — USE VERBATIM:
- `+ New task` / `◀ Next` / `OPEN` / `DONE ({n})`
- `No tasks yet` / `Add a task to track the next action on this file.`
- `Task completed. Undo?` / `Task completed. Milestone advanced to {stage.label}. Undo?` / `Task completed. Next task is now "{title}". Undo?`
- `Couldn't update task — {error}. Try again.`
- `New task` dialog title; `Add task` submit; `Cancel`
- Notes: `Add a note…` placeholder; `Save note` CTA; `Note added.` success; `Couldn't save note — {error}. Try again.` error; empty-state `No notes yet` / `Use notes for free-form context that doesn't fit elsewhere.`
- Audit chips: `All` / `Deal` / `Tasks` / `Notes` / `Stage`; empty-filter `No audit rows match this filter` / `Try a different filter above.` / `Show all`
- Arrow glyph: `→` (U+2192); null rendered as italic muted `null`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ship notes + audit + users query modules + createNote server action + RED/GREEN note test</name>
  <files>lib/notes-query.ts, lib/audit-query.ts, lib/users-query.ts, app/deal/[id]/actions/notes.ts, tests/unit/note-actions.test.ts</files>
  <read_first>
    - lib/deals-query.ts (Drizzle pattern)
    - lib/tasks-query.ts (Plan 03 peer)
    - lib/audit.ts (audit row shape)
    - lib/note-schema.ts (Zod contract from Plan 02)
    - db/schema/app.ts (auditLog + dealNotes columns)
    - .planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md lines 451-520 (Audit tab row anatomy + filter chip semantics)
  </read_first>
  <action>
    **`lib/notes-query.ts`**:
    ```typescript
    export type NoteListRow = {
      id: string;
      body: string;
      isSystem: boolean;
      createdAt: Date;
      authorName: string | null;
      authorEmail: string | null;
    };
    export async function queryNotesForDeal(dealId: string): Promise<NoteListRow[]> {
      // SELECT notes left-joined with users, WHERE deal_id=$1, ORDER BY created_at DESC
    }
    ```

    **`lib/audit-query.ts`**:
    ```typescript
    export type AuditFilter = "all" | "deal" | "tasks" | "notes" | "stage";
    export type AuditRow = {
      id: string;
      tableName: string;
      recordId: string;
      operation: "create" | "update" | "delete";
      beforeJson: Record<string, unknown> | null;
      afterJson: Record<string, unknown>;
      userEmail: string;
      createdAt: Date;
    };
    export async function queryAuditForDeal(dealId: string, filter: AuditFilter): Promise<AuditRow[]>;
    ```

    Filter semantics (UI-SPEC lines 483-487):
    - `all`: rows where `(table_name='deals' AND record_id=dealId) OR (table_name='tasks' AND recordId IN tasks.deal_id=dealId subquery) OR (table_name='deal_notes' AND deal_notes.deal_id=dealId)`
    - `deal`: only `table_name='deals'` for this deal
    - `tasks`: only `table_name='tasks'` where the task belongs to this deal (join audit_log.record_id → tasks.id → tasks.deal_id)
    - `notes`: only `table_name='deal_notes'` joined back to deal_id
    - `stage`: `table_name='deals' AND (beforeJson->>'stage_id') IS DISTINCT FROM (afterJson->>'stage_id')` (stage_id changed in the diff)

    Order DESC by created_at. Return all matched rows (pagination deferred to P10 if needed).

    **`lib/users-query.ts`**:
    ```typescript
    export type UserOption = { id: string; name: string | null; email: string };
    export async function listUsers(): Promise<UserOption[]>;
    // SELECT id, name, email FROM users ORDER BY name nulls last, email. Scope ≤ 50 users per scope doc in AUDIT.md — no pagination.
    ```

    **`app/deal/[id]/actions/notes.ts`** (`"use server"`):
    ```typescript
    export type CreateNoteResult = { ok: true; noteId: string } | { ok: false; errors?: Record<string,string[]>; error?: string };
    export async function createNote(raw: unknown): Promise<CreateNoteResult> {
      // 1. createNoteSchema.safeParse
      // 2. getCurrentUser
      // 3. db.transaction:
      //    a. INSERT dealNotes (dealId, body, isSystem: false, createdBy: user.id) RETURNING row
      //    b. writeAuditLog(tx, { tableName:'deal_notes', recordId: row.id, operation:'create', beforeJson: null, afterJson: row, user })
      // 4. revalidatePath('/deal/{dealId}') + revalidatePath('/')
      // 5. return {ok:true, noteId}
    }
    ```

    **`tests/unit/note-actions.test.ts`** — 4 behaviors:
    1. createNote happy path: row inserted with isSystem=false; audit row written with operation='create'
    2. Validation failure (empty body) → {ok:false, errors}; no DB change
    3. Transactional rollback: if writeAuditLog mocked to throw, note row does NOT exist after (same invariant as P1 plan 05 test 7)
    4. createNote with body containing 5001 chars → {ok:false, errors}

    Use the P1 test harness (vi.mock getCurrentUser, real Postgres).

    Commit: `feat(02-06): notes + audit + users queries + createNote action + tests`.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/note-actions.test.ts 2>&1 | tail -10; npx tsc --noEmit 2>&1 | grep -E "(error|TS)" || echo "tsc clean"; npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `lib/notes-query.ts` exists with `export async function queryNotesForDeal`
    - `lib/audit-query.ts` exists with `export async function queryAuditForDeal` and the AuditFilter type exported
    - `lib/users-query.ts` exists with `export async function listUsers`
    - `app/deal/[id]/actions/notes.ts` exists with `"use server"` and `export async function createNote`
    - `grep -c "writeAuditLog" app/deal/[id]/actions/notes.ts` ≥ 1
    - `grep -c "db.transaction" app/deal/[id]/actions/notes.ts` ≥ 1
    - `grep -c "table_name='deals'\\|tableName.*deals\\|eq(auditLog.tableName" lib/audit-query.ts` ≥ 1
    - `grep -c "^  it(" tests/unit/note-actions.test.ts` ≥ 4
    - `npx vitest run tests/unit/note-actions.test.ts` exit 0
    - `npx tsc --noEmit` exit 0; `npm run build` exit 0
  </acceptance_criteria>
  <done>Notes/audit/users readers exist; createNote action audits + rolls back atomically; tests green.</done>
</task>

<task type="auto">
  <name>Task 2: Build tasks-tab + task-row + new-task-dialog (wires Plan 03 actions)</name>
  <files>app/deal/[id]/_components/tasks-tab.tsx, app/deal/[id]/_components/task-row.tsx, app/deal/[id]/_components/new-task-dialog.tsx, app/deal/[id]/_components/deal-tabs.tsx</files>
  <read_first>
    - .planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md lines 320-410 (Tasks tab full spec — layout, task-row anatomy, add-task dialog fields, auto-advance toast, undo)
    - lib/tasks-query.ts (queryTasksForDeal return shape)
    - app/deal/[id]/actions/tasks.ts (Plan 03 actions)
    - app/deal/new/new-deal-form.tsx (RHF + zodResolver + Popover + Calendar pattern for due date)
    - components/ui/checkbox.tsx + dialog.tsx (primitives)
  </read_first>
  <action>
    **`app/deal/[id]/_components/tasks-tab.tsx`** ('use client'):
    - Receives `deal: DealDetail` and `initialTasks: { open, done }` as props (parent Server Component `deal-tabs.tsx` fetches via queryTasksForDeal)
    - Renders:
      - Top-right `<Button variant="default" onClick={() => setNewTaskOpen(true)}>+ New task</Button>`
      - `<section aria-label="OPEN">`: header `OPEN` (Label tier uppercase — `text-xs font-medium uppercase tracking-wider text-muted-foreground`); maps `open` → `<TaskRow task={t} deal={deal} />`
      - `<section aria-label="DONE">`: header `DONE ({doneCount})` + collapse chevron (`ChevronDown` rotates); collapsed by default when doneCount >= 5; expanded list maps `done` → `<TaskRow ... />`
      - Empty state when open+done both zero: `ListChecks` icon 48px + `No tasks yet` heading + `Add a task to track the next action on this file.` body + primary `+ New task` button (matches UI-SPEC lines 383-395)
    - `<NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} deal={deal} users={users} />` — users prop comes from Task 1's listUsers() call in the Server Component parent

    **`app/deal/[id]/_components/task-row.tsx`** ('use client'):
    - Renders row anatomy per UI-SPEC lines 344-355:
      - `<div class="flex items-center gap-3 py-3 px-2 rounded-md hover:bg-muted/40 {isNext ? 'border-l-2 border-primary pl-3' : ''}">`  ← the is_next accent bar (UI-SPEC line 130 P2-NEW accent use)
      - `<Checkbox checked={task.status==='done'} onCheckedChange={handleComplete} />`
      - If `task.isNext`: `<span class="text-[11px] bg-primary/10 text-primary ring-1 ring-primary/30 rounded-md px-1.5 py-0.5 font-medium">◀ Next</span>`
      - Title (text-sm, truncated with `title={task.title}` tooltip)
      - Relative due date (font-mono text-[13px]) — overdue in text-destructive, today in text-amber-700, future in text-muted-foreground. Compute via `lib/format.ts::relativeTime` (extend if needed to return `{text, tone: 'overdue'|'today'|'future'|null}`).
      - `@{ownerName ?? 'unassigned'}` in text-xs text-muted-foreground
      - On hover: `<ChevronRight>` to open inline edit popover (Popover + form with owner / due date / advancesStageTo — calls `updateTask`)
    - handleComplete:
      ```typescript
      const prevIsNext = task.isNext;
      const [pending, startTransition] = useTransition();
      startTransition(async () => {
        const result = await completeTask({ id: task.id });
        if (!result.ok) {
          toast.error(`Couldn't update task — ${result.error}. Try again.`);
          return;
        }
        // Toast copy selection — W2/W3 contract from Plan 03:
        //   result.stageAdvanced = { toCode, toLabel } | null — use toLabel for human copy
        //   result.newIsNext     = { id, title }       | null — use title for human copy
        let message = `Task completed. Undo?`;
        if (result.stageAdvanced) {
          message = `Task completed. Milestone advanced to ${result.stageAdvanced.toLabel}. Undo?`;
        } else if (result.newIsNext) {
          message = `Task completed. Next task is now "${result.newIsNext.title}". Undo?`;
        }
        toast(message, {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: () => {
              startTransition(async () => {
                await undoCompleteTask({
                  taskId: task.id,
                  autoPromotedTaskId: result.newIsNext?.id ?? null,
                  priorIsNext: prevIsNext,
                });
                router.refresh();
              });
            },
          },
        });
        router.refresh();
      });
      ```

    **`app/deal/[id]/_components/new-task-dialog.tsx`** ('use client'):
    - shadcn `Dialog` with title `New task`
    - Form (RHF + zodResolver(createTaskSchema)):
      - Title (Input, required)
      - Owner (Select from `users` prop — options are UserOption from Task 1)
      - Due date (Popover + Calendar — same pattern as P1 new-deal-form)
      - Parent task (Select — shows only `open` tasks on this deal; optional)
      - Advances stage to (Select — shows only stages where `sort_order > deal.currentStage.sortOrder AND (track_id = deal.trackId OR track_id IS NULL)`; optional)
      - Is next (Checkbox, default false)
    - Footer: `Cancel` + `Add task` submit. `Add task` button disabled while pending.
    - onSubmit: `createTask({dealId: deal.id, ...values})`; on ok close dialog, `router.refresh()`, toast `Task added.`; on err toast the error message.

    **Update `app/deal/[id]/_components/deal-tabs.tsx`**: change the `tasks` TabsContent to render `<TasksTab deal={deal} initialTasks={tasks} users={users} />`. Tasks + users loaded by the parent Server Component (`app/deal/[id]/page.tsx` or a new `deal-tabs.tsx` server wrapper — executor's call which. Preferred: keep deal-tabs as the client component and have page.tsx pass pre-fetched props into it, matching the Plan 05 pattern).

    Commit: `feat(02-06): tasks tab + task-row with is_next accent + new-task dialog`.
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -10; npx tsc --noEmit 2>&1 | grep -E "(error|TS)" || echo "tsc clean"</automated>
  </verify>
  <acceptance_criteria>
    - `app/deal/[id]/_components/tasks-tab.tsx` exists with `'use client'` directive
    - `app/deal/[id]/_components/task-row.tsx` exists
    - `app/deal/[id]/_components/new-task-dialog.tsx` exists
    - `grep -c "border-l-2 border-primary" app/deal/[id]/_components/task-row.tsx` ≥ 1
    - `grep -c "◀ Next" app/deal/[id]/_components/task-row.tsx` ≥ 1
    - `grep -c "completeTask" app/deal/[id]/_components/task-row.tsx` ≥ 1
    - `grep -c "undoCompleteTask" app/deal/[id]/_components/task-row.tsx` ≥ 1
    - `grep -c "duration: 5000" app/deal/[id]/_components/task-row.tsx` ≥ 1
    - `grep -c "Milestone advanced to" app/deal/[id]/_components/task-row.tsx` ≥ 1
    - `grep -c "result.stageAdvanced.toLabel" app/deal/[id]/_components/task-row.tsx` ≥ 1  (W2 — uses toLabel not toCode)
    - `grep -c "result.newIsNext.title" app/deal/[id]/_components/task-row.tsx` ≥ 1  (W3 — uses returned title)
    - `grep -c "result.newIsNext?.id" app/deal/[id]/_components/task-row.tsx` ≥ 1  (W3 — undo passes id via new shape)
    - `grep -c "createTask" app/deal/[id]/_components/new-task-dialog.tsx` ≥ 1
    - `grep -c "zodResolver" app/deal/[id]/_components/new-task-dialog.tsx` ≥ 1
    - `grep -c "createTaskSchema" app/deal/[id]/_components/new-task-dialog.tsx` ≥ 1
    - `grep -c "\\+ New task" app/deal/[id]/_components/tasks-tab.tsx` ≥ 1
    - `grep -c "No tasks yet" app/deal/[id]/_components/tasks-tab.tsx` ≥ 1
    - deal-tabs.tsx no longer contains "Tasks placeholder" comment/content — replaced with real `<TasksTab .../>`
    - `npm run build` exit 0; `npx tsc --noEmit` exit 0
  </acceptance_criteria>
  <done>Tasks tab fully functional; add/complete/undo/auto-advance/auto-promote all wired; is_next accent bar visible; build green.</done>
</task>

<task type="auto">
  <name>Task 3: Build notes-tab + audit-tab + final deal-tabs.tsx wiring</name>
  <files>app/deal/[id]/_components/notes-tab.tsx, app/deal/[id]/_components/audit-tab.tsx, app/deal/[id]/_components/deal-tabs.tsx</files>
  <read_first>
    - .planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md lines 420-520 (Notes + Audit tabs full spec)
    - lib/notes-query.ts + app/deal/[id]/actions/notes.ts (Task 1)
    - lib/audit-query.ts (Task 1)
    - app/_components/deals-filter-bar.tsx (URL-state chip pattern — reuse)
  </read_first>
  <action>
    **`app/deal/[id]/_components/notes-tab.tsx`** ('use client'):
    - Receives `notes: NoteListRow[]` and `deal: DealDetail` from parent
    - Composer at top:
      ```tsx
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add a note…"
          rows={3}
        />
        {body.trim().length > 0 && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={pending}>Save note</Button>
          </div>
        )}
      </div>
      ```
    - handleSave: `startTransition(async () => { const r = await createNote({dealId: deal.id, body}); if (r.ok) { setBody(""); toast.success("Note added."); router.refresh(); } else { toast.error(\`Couldn't save note — \${r.error ?? 'unknown'}. Try again.\`); } })`
    - Notes list below composer, newest first — `<Card>` per note with Avatar + name + relativeTime(createdAt) header line, body below in Body tier
    - System notes (isSystem=true) render with a muted `system` chip next to the author name
    - Empty state (no notes): StickyNote icon 48px, `No notes yet` heading, `Use notes for free-form context that doesn't fit elsewhere.` body

    **`app/deal/[id]/_components/audit-tab.tsx`** ('use client'):
    - Receives `rows: AuditRow[]` and `currentFilter: AuditFilter` from parent (Server Component re-fetches on filter change via URL)
    - Sticky filter header: `<div class="flex gap-2 items-center sticky top-0 bg-background py-3 border-b">`
      - Filter chips: `All / Deal / Tasks / Notes / Stage` using `<Button variant="outline" class={activeFilter === key ? 'bg-primary text-primary-foreground' : ''}>` (inherits P1 "Needs me" treatment)
      - On click: `router.push(...)` updating `?tab=audit&auditFilter=<key>`
      - `Sort: Newest first` static text on the right (read-only per UI-SPEC line 462)
    - Rows (reverse-chron): `<div class="py-3 border-b">`
      - Line 1 meta: `font-mono text-[13px] text-muted-foreground`. Format: `{relativeTime(createdAt)} · {userEmail} · {tableName}.{operation}`
      - Line 2+ diff: iterate changed fields (compute diff between beforeJson and afterJson); for each changed field render:
        ```tsx
        <div>
          <span class="text-xs font-medium text-muted-foreground">{formatFieldLabel(key)}:</span>
          {' '}
          <span class="font-mono text-[13px]">{formatValue(beforeJson?.[key])}</span>
          <span class="text-muted-foreground"> → </span>
          <span class="font-mono text-[13px]">{formatValue(afterJson[key])}</span>
        </div>
        ```
      - For operation='create': only render after values (no arrow). For operation='delete': strikethrough the before values.
      - formatValue: nulls → italic muted `null`; dates → `Apr 17, 2026` via `lib/format.ts::formatDate` (may need to add the helper); money fields (salesPrice, loanAmount, estimatedDown, earnestMoney, estRehab, arv) → `$485,000` via existing `lib/format.ts` formatters
    - Empty state when filter returns zero rows: Filter icon 48px, `No audit rows match this filter` + `Try a different filter above.` body + `<Button variant="outline">Show all</Button>` that pushes to `?tab=audit` (clears auditFilter)

    **Update `app/deal/[id]/_components/deal-tabs.tsx`** — ensure all three panels now receive real props, no placeholder content remains:
    - Tasks panel: `<TasksTab deal={deal} initialTasks={tasks} users={users} />`
    - Notes panel: `<NotesTab deal={deal} notes={notes} />`
    - Audit panel: `<AuditTab rows={auditRows} currentFilter={auditFilter} />`
    - File Contacts + Emails remain placeholders (P3, P4 scope)

    The parent Server Component (`app/deal/[id]/page.tsx`) must fetch `queryTasksForDeal`, `queryNotesForDeal`, `queryAuditForDeal(dealId, auditFilter)`, `listUsers()` in parallel using `Promise.all([...])` and pass results down. Update page.tsx accordingly:

    ```typescript
    const [tasks, notes, auditRows, users] = await Promise.all([
      queryTasksForDeal(id),
      queryNotesForDeal(id),
      queryAuditForDeal(id, (sp.auditFilter ?? "all") as AuditFilter),
      listUsers(),
    ]);
    ```

    `sp.auditFilter` default `all` if missing; invalid values fall back to `all` (tolerant parser, same philosophy as P1 filter-params.ts).

    Final manual walkthrough on a seeded deal:
    1. Create a deal via `/deal/new` — land on `/deal/[id]`
    2. Overview tab Tracking card: change priority HIGH → MEDIUM; Save → toast `Changes saved.`; open Audit tab → row exists with `priority: HIGH → MEDIUM`
    3. Tasks tab: click `+ New task` → add "Order title" with due date + is_next=true → task appears with `◀ Next` chip + left primary bar
    4. Check the task → undo toast fires; clicking Undo reverts
    5. Check again (no undo); next open task auto-promotes to is_next
    6. Set the current is_next task's `advances_stage_to` to `title_order_opened` (via inline edit); check it → toast reads `Task completed. Milestone advanced to Title order opened. Undo?`; stepper advances
    7. Notes tab: add a note → appears newest-first; Audit tab shows `deal_notes.create` row
    8. Overflow menu → Kill deal → open dialog, enter 3+ char reason → Kill; page re-renders killed chrome; Audit tab shows `deals.update` (status + stage + kill fields changed) AND `deal_notes.create` (system note with reason)

    Commit: `feat(02-06): notes + audit tabs; page.tsx wired with Promise.all fetches; deal-tabs placeholders removed`.
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -10; npx tsc --noEmit 2>&1 | grep -E "(error|TS)" || echo "tsc clean"; npx vitest run 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `app/deal/[id]/_components/notes-tab.tsx` exists with `'use client'`
    - `grep -c "Add a note…" app/deal/[id]/_components/notes-tab.tsx` ≥ 1
    - `grep -c "Save note" app/deal/[id]/_components/notes-tab.tsx` ≥ 1
    - `grep -c "createNote" app/deal/[id]/_components/notes-tab.tsx` ≥ 1
    - `grep -c "Note added\\." app/deal/[id]/_components/notes-tab.tsx` ≥ 1
    - `grep -c "No notes yet" app/deal/[id]/_components/notes-tab.tsx` ≥ 1
    - `app/deal/[id]/_components/audit-tab.tsx` exists with `'use client'`
    - `grep -c "All\\|Deal\\|Tasks\\|Notes\\|Stage" app/deal/[id]/_components/audit-tab.tsx` ≥ 5
    - `grep -c "auditFilter" app/deal/[id]/_components/audit-tab.tsx` ≥ 1
    - `grep -c "→" app/deal/[id]/_components/audit-tab.tsx` ≥ 1  (arrow glyph U+2192 or `\u2192`)
    - `grep -c "No audit rows match this filter" app/deal/[id]/_components/audit-tab.tsx` ≥ 1
    - `grep -c "Show all" app/deal/[id]/_components/audit-tab.tsx` ≥ 1
    - `app/deal/[id]/page.tsx` contains `Promise.all(` with at least 4 query calls
    - `grep -c "queryTasksForDeal\\|queryNotesForDeal\\|queryAuditForDeal\\|listUsers" app/deal/[id]/page.tsx` ≥ 4
    - `grep -c "placeholder\\|Coming in Phase" app/deal/[id]/_components/deal-tabs.tsx` — only matches File Contacts / Emails placeholders (NOT Tasks / Notes / Audit)
    - `npm run build` exit 0
    - `npx tsc --noEmit` exit 0
    - Full vitest suite exit 0
  </acceptance_criteria>
  <done>All 6 tabs render real data where applicable; end-to-end flow (create deal → edit overview → add tasks → complete → advance stage → add note → kill with reason) works with every mutation appearing in the Audit tab; build green; tests green.</done>
</task>

</tasks>

<verification>
- `npm run build` exit 0; `/deal/[id]` route renders all 6 tabs
- `npx tsc --noEmit` clean
- Full vitest suite green (≥ 82 P1 + ~30 P2 = ~110+ tests)
- Manual walkthrough checklist (from Task 3) all pass
- Every mutation in Task 3 step 8 produces an audit row visible in the Audit tab
</verification>

<success_criteria>
- [ ] Tasks tab fully functional: open/done sections, is_next accent bar, 5-second undo toast, auto-advance-stage wiring, add-task dialog with all 6 fields
- [ ] Notes tab: composer + chronological list + createNote action with audit row
- [ ] Audit tab: reverse-chron rows, 5 URL-state filter chips, before→after diff rendering, empty-filter state
- [ ] Phase 2 success criterion 5 proven: every mutation (Overview edit, stage advance/revert, task create/complete/update, deal close/kill, note create) appears in the Audit tab
- [ ] `deal-tabs.tsx` no longer contains Tasks/Notes/Audit placeholder content
- [ ] 3 commits landed: queries/actions/tests, tasks UI, notes+audit UI + page wiring
</success_criteria>

<output>
After completion, create `.planning/phases/02-deal-detail-tasks-stages/02-06-tasks-notes-audit-tabs-SUMMARY.md` using the standard SUMMARY template. Include a "P2 complete" handoff note listing which Phase 2 success criteria (1-5) are now met end-to-end, and flag any UI-SPEC `Ship + revisit` decisions (Assumptions 1, 2, 4, 7, 9, 11, 12) that Carrie should review during the Phase 2 UAT.
</output>
