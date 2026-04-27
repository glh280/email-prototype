---
phase: 02-deal-detail-tasks-stages
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/deal-schema.ts
  - lib/task-schema.ts
  - lib/stage-schema.ts
  - lib/note-schema.ts
  - tests/unit/deal-schema.test.ts
  - tests/unit/task-schema.test.ts
  - tests/unit/stage-schema.test.ts
  - tests/unit/note-schema.test.ts
autonomous: true
requirements: [DEAL-05, DEAL-06, STAGE-02, STAGE-03, TASK-01]
requirements_addressed: [DEAL-05, DEAL-06, STAGE-02, STAGE-03, TASK-01]

must_haves:
  truths:
    - "`lib/deal-schema.ts` exports `updateDealSchema` (all DEAL-02 fields optional, drops immutable file_no + trackCode) and `killDealSchema` (requires non-empty reason ≥ 3 chars)"
    - "`lib/task-schema.ts` exports `createTaskSchema` (title required 1-200, dealId uuid, optional owner/due/parent/advancesStageTo/isNext default false)"
    - "`lib/task-schema.ts` exports `updateTaskSchema` (all createTask fields optional + id required) and `completeTaskSchema` (id required only)"
    - "`lib/stage-schema.ts` exports `advanceStageSchema` and `revertStageSchema` — both require `dealId uuid` + `targetStageId uuid`"
    - "`lib/note-schema.ts` exports `createNoteSchema` — `body` trimmed, min 1, max 5000; `dealId` uuid"
    - "Every schema exports BOTH input and output types via `z.input` + `z.infer` pattern from P1 plan 05"
    - "Each schema file has a co-located Vitest file with ≥ 6 behavioral tests covering happy path + 5+ invalid inputs"
    - "Full test suite green: `npx vitest run` exits 0 with ≥ 82 + 24 = 106+ tests passing"
  artifacts:
    - path: "lib/deal-schema.ts"
      provides: "createDealSchema (existing) + new updateDealSchema + killDealSchema + associated input/output types"
      exports: ["createDealSchema", "updateDealSchema", "killDealSchema", "CreateDealInput", "UpdateDealInput", "UpdateDealFormInput", "KillDealInput"]
    - path: "lib/task-schema.ts"
      provides: "Zod schemas for all task mutations"
      exports: ["createTaskSchema", "updateTaskSchema", "completeTaskSchema", "CreateTaskInput", "CreateTaskFormInput", "UpdateTaskInput", "CompleteTaskInput"]
    - path: "lib/stage-schema.ts"
      provides: "Zod schemas for stage advance + revert"
      exports: ["advanceStageSchema", "revertStageSchema", "AdvanceStageInput", "RevertStageInput"]
    - path: "lib/note-schema.ts"
      provides: "Zod schema for note creation"
      exports: ["createNoteSchema", "CreateNoteInput"]
  key_links:
    - from: "Plans 03, 04, 06 server actions"
      to: "lib/{task,stage,note}-schema.ts"
      via: "`safeParse(raw)` on the action entry point"
      pattern: "safeParse\\("
    - from: "Overview tab Edit mode (plan 05)"
      to: "lib/deal-schema.ts::updateDealSchema"
      via: "react-hook-form zodResolver"
      pattern: "zodResolver\\(updateDealSchema\\)"
---

<objective>
Extend `lib/deal-schema.ts` and create three new sibling schema files (`lib/task-schema.ts`, `lib/stage-schema.ts`, `lib/note-schema.ts`) to establish the Zod contracts every P2 server action and form will re-use. Zod schemas in this project are ALWAYS shared between client (form validation) and server (action re-validation) per the P1 pattern — this plan ships the contracts so Plans 03–06 can implement against them without inventing shapes.

Every schema file gets a co-located behavioral test covering happy path + invalid-input cases — matching the P1 convention (see `tests/unit/parse-money.test.ts` for the shape). The tests also serve as executable documentation of the schema's validation rules.

Purpose: Interface-first ordering — Plan 03 (task actions) and Plan 04 (stage/kill actions) depend on these schemas existing. Landing them in Wave 1 unblocks Wave 2 without a scavenger hunt.
Output: 4 schema modules + 4 test files; types exported; tsc + tests clean.
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

# Canonical Zod pattern in this project — DO NOT deviate.
@lib/deal-schema.ts
@lib/parse-money.ts
@tests/unit/parse-money.test.ts
@tests/unit/create-deal-action.test.ts

<interfaces>
<!-- P1 established the Zod input/output split for .default() schemas. Re-use. -->

From lib/deal-schema.ts (existing P1 export to extend — DO NOT REWRITE):
```typescript
export const createDealSchema = z.object({
  trackCode: z.enum(["TE","FL","DP","PO","EC","SL","BL","GI"], {...}),
  priority: z.enum(["HIGH","MEDIUM","LOW"], {...}),
  title: z.string().trim().min(1).max(200),
  propertyState: z.string().trim().length(2).transform(v => v.toUpperCase()).nullable().optional(),
  // ... 20+ more fields
});
export type CreateDealInput = z.infer<typeof createDealSchema>;
export type CreateDealFormInput = z.input<typeof createDealSchema>;
```

Pattern: when a schema has `z.boolean().default(false)` or `.transform()`, ALWAYS export both:
  - `z.input<typeof X>` type for `react-hook-form` form state (fields with defaults are optional on input)
  - `z.infer<typeof X>` type for the server action (fields with defaults are resolved)

Seed values — use these enum strings verbatim:
  - Track codes: `"TE" | "FL" | "DP" | "PO" | "EC" | "SL" | "BL" | "GI"`
  - Priority: `"HIGH" | "MEDIUM" | "LOW"`
  - Task status: `"open" | "done" | "skipped"` (matches `tasks_status_check` from plan 01)
  - Deal status: `"active" | "closed" | "killed"` (matches existing `deals_status_check`)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend lib/deal-schema.ts with updateDealSchema + killDealSchema + behavioral tests</name>
  <files>lib/deal-schema.ts, tests/unit/deal-schema.test.ts</files>
  <read_first>
    - lib/deal-schema.ts (extend; note exact error message style "{Field} is required.")
    - .planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md lines 240-300 (Overview edit contract + copy), lines 573-595 (Kill dialog reason label + min chars)
    - .planning/REQUIREMENTS.md lines 52-54 (DEAL-04, DEAL-05, DEAL-06)
    - tests/unit/parse-money.test.ts (shape reference for co-located schema tests)
  </read_first>
  <behavior>
    updateDealSchema:
      - All createDealSchema fields become optional (Zod `.partial()` on the extensible shape, but with EXCLUSIONS — immutable fields MUST be dropped: trackCode, file_no cannot be edited post-create per DEAL-02a)
      - `priority` must still satisfy the enum when provided
      - `title` when provided still 1–200 chars
      - `status` new field: optional enum `"active" | "closed" | "killed"` (plan 04 is the sole caller for killed transition; kill action uses killDealSchema but update may transition active↔closed)
      - Rejects unknown keys via `.strict()` so stray payload fields fail loudly

    killDealSchema:
      - `dealId`: z.string().uuid()
      - `reason`: z.string().trim().min(3, "Reason must be at least 3 characters.").max(2000, "Reason must be 2000 characters or fewer.")

    Tests (deal-schema.test.ts) — ≥ 8 behaviors:
      - updateDealSchema accepts `{}` (no changes, valid) — editability of single field
      - updateDealSchema accepts `{ title: "new title" }`
      - updateDealSchema rejects `{ title: "" }` with "Title is required."
      - updateDealSchema rejects `{ title: "x".repeat(201) }` with max-length error
      - updateDealSchema rejects `{ priority: "URGENT" }` (not in enum)
      - updateDealSchema rejects `{ trackCode: "TE" }` (immutable — .strict rejects unknown keys OR the shape omits trackCode)
      - killDealSchema requires reason ≥ 3 chars → rejects `{ reason: "ok" }` (2 chars)
      - killDealSchema accepts `{ dealId: "<valid uuid>", reason: "Client backed out of PSA" }`
  </behavior>
  <action>
    Open `lib/deal-schema.ts`. APPEND (do not modify `createDealSchema` itself — P1 consumers still use it) these new exports at the bottom of the file:

    ```typescript
    /**
     * updateDealSchema — Phase 2 Overview-tab edit (DEAL-05).
     *
     * Every deal field that CAN be edited in Overview is optional here;
     * immutable fields (trackCode, fileNo — see DEAL-02a) are omitted entirely
     * so a stray payload with `trackCode: "FL"` fails `.strict()` validation.
     *
     * The server action (plan 05) re-validates raw FormData against this and
     * computes the before→after diff to persist in audit_log.
     *
     * Deal status transitions: `active` → `closed` is allowed here (the
     * "Mark as closed" overflow action uses updateDeal internally). The
     * `active` → `killed` transition has its own action (killDeal) because
     * it requires a reason note.
     */
    export const updateDealSchema = z
      .object({
        priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
        status: z.enum(["active", "closed"]).optional(), // killed handled by killDealSchema
        title: z
          .string()
          .trim()
          .min(1, "Title is required.")
          .max(200, "Title must be 200 characters or fewer.")
          .optional(),
        propertyAddress: z.string().trim().max(300).nullable().optional(),
        propertyState: z
          .string()
          .trim()
          .length(2, "Property state must be a 2-letter code.")
          .transform((v) => v.toUpperCase())
          .nullable()
          .optional(),
        propertyType: z
          .enum(["single_family","multi_family","condo","townhome","commercial","land","other"])
          .nullable()
          .optional(),
        salesPrice: z.number().int().nonnegative().nullable().optional(),
        loanType: z
          .enum(["conventional","dscr","hard_money","bridge","transactional","cash","other"])
          .nullable()
          .optional(),
        transactionType: z
          .enum(["purchase","refinance","wholesale","double_close","other"])
          .nullable()
          .optional(),
        loanAmount: z.number().int().nonnegative().nullable().optional(),
        estimatedDown: z.number().int().nonnegative().nullable().optional(),
        earnestMoney: z.number().int().nonnegative().nullable().optional(),
        estRehab: z.number().int().nonnegative().nullable().optional(),
        arv: z.number().int().nonnegative().nullable().optional(),
        closingAt: z.coerce.date().nullable().optional(),
        fundingAt: z.coerce.date().nullable().optional(),
        titleCtc: z.boolean().optional(),
        lenderCtc: z.boolean().optional(),
        titleFileNo: z.string().trim().max(100).nullable().optional(),
        loanNo: z.string().trim().max(100).nullable().optional(),
        quickNote: z.string().trim().max(2000).nullable().optional(),
      })
      .strict();

    export type UpdateDealInput = z.infer<typeof updateDealSchema>;
    export type UpdateDealFormInput = z.input<typeof updateDealSchema>;

    /**
     * killDealSchema — DEAL-06 kill action.
     *
     * Reason min 3 / max 2000 matches UI-SPEC kill dialog:
     *   "(destructive — disabled until reason has ≥ 3 chars)"
     */
    export const killDealSchema = z.object({
      dealId: z.string().uuid(),
      reason: z
        .string()
        .trim()
        .min(3, "Reason must be at least 3 characters.")
        .max(2000, "Reason must be 2000 characters or fewer."),
    });

    export type KillDealInput = z.infer<typeof killDealSchema>;
    ```

    Create `tests/unit/deal-schema.test.ts` with ≥ 8 behaviors enumerated above. Use pure Zod `.safeParse(...)` — no DB, no mocks needed. Follow the shape of `tests/unit/parse-money.test.ts`.

    Commit: `feat(02-02): updateDealSchema + killDealSchema + behaviors`.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/deal-schema.test.ts 2>&1 | tail -10; npx tsc --noEmit 2>&1 | grep -E "(error|TS)" || echo "tsc clean"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "export const updateDealSchema" lib/deal-schema.ts` returns 1
    - `grep -c "export const killDealSchema" lib/deal-schema.ts` returns 1
    - `grep -c "export type UpdateDealInput" lib/deal-schema.ts` returns 1
    - `grep -c "\\.strict()" lib/deal-schema.ts` returns 1
    - `grep -c "Reason must be at least 3 characters" lib/deal-schema.ts` returns 1
    - `tests/unit/deal-schema.test.ts` exists and contains ≥ 8 `it(` blocks (`grep -c "^  it(" tests/unit/deal-schema.test.ts` ≥ 8)
    - `npx vitest run tests/unit/deal-schema.test.ts` exit 0
    - `npx tsc --noEmit` exit 0
  </acceptance_criteria>
  <done>Overview edit + kill contract locked in Zod; tests encode rules; commit landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create lib/task-schema.ts + lib/stage-schema.ts + lib/note-schema.ts + tests</name>
  <files>lib/task-schema.ts, lib/stage-schema.ts, lib/note-schema.ts, tests/unit/task-schema.test.ts, tests/unit/stage-schema.test.ts, tests/unit/note-schema.test.ts</files>
  <read_first>
    - lib/deal-schema.ts (reference pattern — just extended in Task 1)
    - .planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md lines 354-375 (Add-task dialog fields), lines 522-572 (stage advance/revert params), lines 420-445 (note composer)
    - .planning/REQUIREMENTS.md lines 93-98 (TASK-01..05 full text)
  </read_first>
  <behavior>
    task-schema:
      - createTaskSchema accepts {dealId:uuid, title:"x", ownerUserId?:uuid, dueDate?:date, isNext?:bool default false, parentTaskId?:uuid, advancesStageToId?:uuid}
      - createTaskSchema REJECTS {title:""} → "Title is required."
      - createTaskSchema REJECTS {title:"x".repeat(201)} → max-length
      - createTaskSchema REJECTS {dealId:"not-a-uuid"} → uuid error
      - updateTaskSchema requires {id:uuid} + at least one optional field; allows {status:"done"}
      - completeTaskSchema: {id:uuid} only (the simplest shape; undo uses same)

    stage-schema:
      - advanceStageSchema: {dealId:uuid, targetStageId:uuid} — no other fields
      - revertStageSchema: same shape as advance
      - Both REJECT non-uuid fields

    note-schema:
      - createNoteSchema: {dealId:uuid, body:string(1-5000 trimmed)}
      - REJECTS {body:"   "} (whitespace-only, trims to empty → min(1) fails) with "Note body is required."
      - REJECTS {body:"x".repeat(5001)} with max-length

    ≥ 6 test cases per file. Zod-only (no DB).
  </behavior>
  <action>
    Create `lib/task-schema.ts` with these exact exports. Match `lib/deal-schema.ts` header-comment style:

    ```typescript
    import { z } from "zod";

    /**
     * Shared Zod schemas for task mutations (Phase 2 Plan 03).
     *
     * createTaskSchema validates the "New task" dialog input (UI-SPEC lines
     * 354-375). updateTaskSchema validates the inline edit popover. Both are
     * re-validated server-side inside the transactional task actions.
     *
     * Error copy mirrors UI-SPEC "Copywriting Contract" (Tasks tab section):
     *   - Title blank:       "Title is required."
     *   - Title too long:    "Title must be 200 characters or fewer."
     *
     * Database-side constraints (plan 01):
     *   - tasks.status CHECK → ('open' | 'done' | 'skipped')
     *   - tasks_one_is_next_per_deal_idx — partial unique index enforces TASK-02
     *     at DB level; server action (plan 03) is happy path.
     */
    export const createTaskSchema = z.object({
      dealId: z.string().uuid(),
      title: z
        .string({ message: "Title is required." })
        .trim()
        .min(1, "Title is required.")
        .max(200, "Title must be 200 characters or fewer."),
      ownerUserId: z.string().uuid().nullable().optional(),
      dueDate: z.coerce.date().nullable().optional(),
      isNext: z.boolean().default(false),
      parentTaskId: z.string().uuid().nullable().optional(),
      advancesStageToId: z.string().uuid().nullable().optional(),
    });
    export type CreateTaskInput = z.infer<typeof createTaskSchema>;
    export type CreateTaskFormInput = z.input<typeof createTaskSchema>;

    export const updateTaskSchema = z
      .object({
        id: z.string().uuid(),
        title: z
          .string()
          .trim()
          .min(1, "Title is required.")
          .max(200, "Title must be 200 characters or fewer.")
          .optional(),
        ownerUserId: z.string().uuid().nullable().optional(),
        dueDate: z.coerce.date().nullable().optional(),
        status: z.enum(["open", "done", "skipped"]).optional(),
        isNext: z.boolean().optional(),
        advancesStageToId: z.string().uuid().nullable().optional(),
      })
      .strict();
    export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

    export const completeTaskSchema = z.object({
      id: z.string().uuid(),
    });
    export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
    ```

    Create `lib/stage-schema.ts`:

    ```typescript
    import { z } from "zod";

    /**
     * Shared Zod schemas for stage advance + revert (Phase 2 Plan 04).
     *
     * advanceStageSchema and revertStageSchema take identical shapes; the
     * distinction is semantic (advance validates forward motion; revert
     * validates backward motion) and enforced by the server actions, not
     * by Zod. Both require the target stage id — the client sends which
     * stage it clicked; the server re-resolves sort_order and track_id
     * against the seeded stages to reject invalid targets.
     */
    export const advanceStageSchema = z.object({
      dealId: z.string().uuid(),
      targetStageId: z.string().uuid(),
    });
    export type AdvanceStageInput = z.infer<typeof advanceStageSchema>;

    export const revertStageSchema = z.object({
      dealId: z.string().uuid(),
      targetStageId: z.string().uuid(),
    });
    export type RevertStageInput = z.infer<typeof revertStageSchema>;
    ```

    Create `lib/note-schema.ts`:

    ```typescript
    import { z } from "zod";

    /**
     * createNoteSchema — Phase 2 Plan 06 Notes tab.
     *
     * Notes are append-only in P2 (UI-SPEC assumption 4) — no edit/delete
     * schemas. If Carrie requests editing during calibration, P3 adds them.
     *
     * `body` is trimmed so whitespace-only submissions fail the min(1) check
     * with the same error users see for empty input.
     */
    export const createNoteSchema = z.object({
      dealId: z.string().uuid(),
      body: z
        .string()
        .trim()
        .min(1, "Note body is required.")
        .max(5000, "Note body must be 5000 characters or fewer."),
    });
    export type CreateNoteInput = z.infer<typeof createNoteSchema>;
    ```

    Create three test files (`tests/unit/task-schema.test.ts`, `tests/unit/stage-schema.test.ts`, `tests/unit/note-schema.test.ts`), each with ≥ 6 behaviors enumerated above. All pure Zod — no DB.

    Commit: `feat(02-02): task + stage + note Zod schemas + behaviors`.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/task-schema.test.ts tests/unit/stage-schema.test.ts tests/unit/note-schema.test.ts 2>&1 | tail -15; npx tsc --noEmit 2>&1 | grep -E "(error|TS)" || echo "tsc clean"; npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `lib/task-schema.ts`, `lib/stage-schema.ts`, `lib/note-schema.ts` all exist
    - `grep -c "export const createTaskSchema" lib/task-schema.ts` returns 1
    - `grep -c "export const advanceStageSchema" lib/stage-schema.ts` returns 1
    - `grep -c "export const revertStageSchema" lib/stage-schema.ts` returns 1
    - `grep -c "export const createNoteSchema" lib/note-schema.ts` returns 1
    - `grep -c "Note body is required" lib/note-schema.ts` returns 1
    - `grep -c "^  it(" tests/unit/task-schema.test.ts` ≥ 6
    - `grep -c "^  it(" tests/unit/stage-schema.test.ts` ≥ 6
    - `grep -c "^  it(" tests/unit/note-schema.test.ts` ≥ 6
    - `npx vitest run tests/unit/task-schema.test.ts tests/unit/stage-schema.test.ts tests/unit/note-schema.test.ts` exit 0
    - `npx tsc --noEmit` exit 0
    - `npm run build` exit 0
  </acceptance_criteria>
  <done>All 4 Zod contracts exported with types; co-located tests enforce validation rules; full suite green; build clean.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` → clean (no new errors)
- `npx vitest run` → full suite green, ≥ 24 new test cases added (8 deal + 6 task + 6 stage + 4+ note minimum)
- `npm run build` → exits 0
- Every schema file has an accompanying `tests/unit/{name}.test.ts`
</verification>

<success_criteria>
- [ ] `lib/deal-schema.ts` exports `updateDealSchema`, `killDealSchema`, and associated types
- [ ] `lib/task-schema.ts`, `lib/stage-schema.ts`, `lib/note-schema.ts` all exist with the enumerated exports
- [ ] Every schema uses the P1 `z.input` / `z.infer` split pattern where `.default(...)` appears
- [ ] Each schema has ≥ 6 behavioral tests covering happy path + invalid-input cases
- [ ] Full test suite green
- [ ] Two commits landed (deal-schema extension, new schema files)
</success_criteria>

<output>
After completion, create `.planning/phases/02-deal-detail-tasks-stages/02-02-shared-zod-schemas-SUMMARY.md` using the standard SUMMARY template.
</output>
