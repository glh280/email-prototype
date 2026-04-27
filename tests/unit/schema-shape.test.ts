import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import * as schema from "@/db/schema";

/**
 * Phase 1 Plan 01 — Schema-shape tests.
 *
 * Validates that the split schema (db/schema/auth.ts + db/schema/app.ts) exports
 * every table and column the plan's `must_haves.truths` depend on. These are
 * introspection tests — they read Drizzle's column metadata, they do not hit a
 * real database.
 *
 * Columns are asserted by their SQL column name (snake_case) so that a renamed
 * TypeScript field accidentally flipping to camelCase in the DB surfaces here.
 */
describe("Phase 1 schema exports (db/schema barrel)", () => {
  it("Test 1: exports users, npiAccessLog, tracks, stages, deals, auditLog", () => {
    expect(schema.users).toBeDefined();
    expect(schema.npiAccessLog).toBeDefined();
    expect(schema.tracks).toBeDefined();
    expect(schema.stages).toBeDefined();
    expect(schema.deals).toBeDefined();
    expect(schema.auditLog).toBeDefined();
  });

  it("Test 2: tracks has id, code, label, default_priority, active, sort_order", () => {
    const cols = getTableColumns(schema.tracks);
    const names = Object.values(cols).map((c) => c.name).sort();
    expect(names).toEqual(
      ["active", "code", "default_priority", "id", "label", "sort_order"].sort(),
    );
  });

  it("Test 3: stages has id, code, label, track_id (nullable), sort_order, is_terminal", () => {
    const cols = getTableColumns(schema.stages);
    const byName = Object.fromEntries(
      Object.values(cols).map((c) => [c.name, c]),
    );
    expect(byName.id).toBeDefined();
    expect(byName.code).toBeDefined();
    expect(byName.label).toBeDefined();
    expect(byName.track_id).toBeDefined();
    expect(byName.track_id.notNull).toBe(false);
    expect(byName.sort_order).toBeDefined();
    expect(byName.is_terminal).toBeDefined();
  });

  it("Test 4: deals has the full DEAL-02 field list plus D-17/D-18 ownership", () => {
    const cols = getTableColumns(schema.deals);
    const names = Object.values(cols).map((c) => c.name);
    // DEAL-02 core identity + track/stage
    expect(names).toEqual(
      expect.arrayContaining([
        "id",
        "track_id",
        "stage_id",
        "file_no",
        "title",
        "priority",
        "status",
        // Main contact free-text per D-03
        "main_contact_name",
        "main_contact_email",
        "main_contact_phone",
        // Property fields
        "property_address",
        "property_state",
        "property_type",
        "sales_price",
        // Lending
        "loan_type",
        "transaction_type",
        "loan_amount",
        "estimated_down",
        "earnest_money",
        "est_rehab",
        "arv",
        "title_ctc",
        "lender_ctc",
        // Legacy / misc
        "title_file_no",
        "loan_no",
        "service_selected",
        "quick_note",
        // Dates
        "opened_at",
        "closing_at",
        "funding_at",
        "closed_at",
        // Ownership per D-17 / D-18
        "created_by",
        "internal_owner",
        "created_at",
        "updated_at",
      ]),
    );
    // Nullability per D-02 (funding_at, closing_at nullable; internal_owner nullable)
    const byName = Object.fromEntries(
      Object.values(cols).map((c) => [c.name, c]),
    );
    expect(byName.closing_at.notNull).toBe(false);
    expect(byName.funding_at.notNull).toBe(false);
    expect(byName.internal_owner.notNull).toBe(false);
    expect(byName.created_by.notNull).toBe(true);
    expect(byName.file_no.notNull).toBe(true);
  });

  it("Test 5: auditLog has table_name, record_id, operation, before_json nullable, after_json not-null, user_id, user_email, created_at", () => {
    const cols = getTableColumns(schema.auditLog);
    const byName = Object.fromEntries(
      Object.values(cols).map((c) => [c.name, c]),
    );
    expect(byName.table_name).toBeDefined();
    expect(byName.table_name.notNull).toBe(true);
    expect(byName.record_id).toBeDefined();
    expect(byName.record_id.notNull).toBe(true);
    expect(byName.operation).toBeDefined();
    expect(byName.operation.notNull).toBe(true);
    expect(byName.before_json).toBeDefined();
    expect(byName.before_json.notNull).toBe(false);
    expect(byName.after_json).toBeDefined();
    expect(byName.after_json.notNull).toBe(true);
    expect(byName.user_id).toBeDefined();
    expect(byName.user_id.notNull).toBe(true);
    expect(byName.user_email).toBeDefined();
    expect(byName.user_email.notNull).toBe(true);
    expect(byName.created_at).toBeDefined();
  });

  it("Test 6: npiAccessLog.dealId column is inferred with references to deals.id (D-04a FK)", () => {
    const cols = getTableColumns(schema.npiAccessLog);
    const dealId = Object.values(cols).find((c) => c.name === "deal_id");
    expect(dealId).toBeDefined();
    // Drizzle attaches foreign-key builders on the column's table; we verify the
    // column exists and is the expected uuid type. The actual FK constraint is
    // validated end-to-end by Task 2 (the generated migration SQL grep).
    expect(dealId!.columnType).toMatch(/PgUUID/);
  });

  it("Test 7: the old barrel path @/db/schema still exposes users and npiAccessLog (back-compat for P0.5 consumers)", () => {
    // Smoke check — if the index re-export chain is broken, these would be undefined.
    expect(schema.users).toBeDefined();
    expect(schema.npiAccessLog).toBeDefined();
    // Also confirm the column shapes of the moved tables didn't regress.
    const usersCols = getTableColumns(schema.users);
    const names = Object.values(usersCols).map((c) => c.name).sort();
    expect(names).toEqual(
      ["created_at", "email", "id", "image", "name", "updated_at"].sort(),
    );
  });
});

/**
 * P2 Plan 01 schema shape — tasks, deal_notes, kill columns on deals.
 *
 * These assertions encode TASK-01..05 + DEAL-06 kill columns at the schema
 * level. Any rename / drop / nullability flip in db/schema/app.ts fails CI here
 * before it can reach a migration.
 */
describe("P2 schema shape — tasks, deal_notes, kill columns", () => {
  it("P2 Test 1: exports tasks and dealNotes from the barrel", () => {
    expect(schema.tasks).toBeDefined();
    expect(schema.dealNotes).toBeDefined();
  });

  it("P2 Test 2: tasks table has all 13 expected columns", () => {
    const cols = getTableColumns(schema.tasks);
    const names = Object.values(cols).map((c) => c.name).sort();
    expect(names).toEqual(
      [
        "id",
        "deal_id",
        "title",
        "owner_user_id",
        "due_date",
        "status",
        "is_next",
        "parent_task_id",
        "advances_stage_to_id",
        "created_by",
        "created_at",
        "updated_at",
        "completed_at",
      ].sort(),
    );
  });

  it("P2 Test 3: tasks.status defaults to 'open' and is not-null", () => {
    const cols = getTableColumns(schema.tasks);
    const byName = Object.fromEntries(
      Object.values(cols).map((c) => [c.name, c]),
    );
    expect(byName.status).toBeDefined();
    expect(byName.status.notNull).toBe(true);
    expect(byName.status.default).toBe("open");
  });

  it("P2 Test 4: tasks.is_next defaults to false and is not-null", () => {
    const cols = getTableColumns(schema.tasks);
    const byName = Object.fromEntries(
      Object.values(cols).map((c) => [c.name, c]),
    );
    expect(byName.is_next).toBeDefined();
    expect(byName.is_next.notNull).toBe(true);
    expect(byName.is_next.default).toBe(false);
  });

  it("P2 Test 5: tasks FK columns have correct nullability", () => {
    const cols = getTableColumns(schema.tasks);
    const byName = Object.fromEntries(
      Object.values(cols).map((c) => [c.name, c]),
    );
    // deal_id — NOT NULL (tasks must belong to a deal; cascades on delete)
    expect(byName.deal_id.notNull).toBe(true);
    // created_by — NOT NULL (every task has an author)
    expect(byName.created_by.notNull).toBe(true);
    // owner_user_id — nullable (task may be unassigned)
    expect(byName.owner_user_id.notNull).toBe(false);
    // parent_task_id — nullable (top-level tasks)
    expect(byName.parent_task_id.notNull).toBe(false);
    // advances_stage_to_id — nullable (most tasks don't auto-advance)
    expect(byName.advances_stage_to_id.notNull).toBe(false);
    // due_date — nullable (optional)
    expect(byName.due_date.notNull).toBe(false);
    // completed_at — nullable (set only when status flips to done)
    expect(byName.completed_at.notNull).toBe(false);
  });

  it("P2 Test 6: deal_notes table has all 6 expected columns", () => {
    const cols = getTableColumns(schema.dealNotes);
    const names = Object.values(cols).map((c) => c.name).sort();
    expect(names).toEqual(
      ["id", "deal_id", "body", "is_system", "created_by", "created_at"].sort(),
    );
  });

  it("P2 Test 7: deal_notes.is_system defaults to false and is not-null", () => {
    const cols = getTableColumns(schema.dealNotes);
    const byName = Object.fromEntries(
      Object.values(cols).map((c) => [c.name, c]),
    );
    expect(byName.is_system).toBeDefined();
    expect(byName.is_system.notNull).toBe(true);
    expect(byName.is_system.default).toBe(false);
    expect(byName.deal_id.notNull).toBe(true);
    expect(byName.body.notNull).toBe(true);
    expect(byName.created_by.notNull).toBe(true);
  });

  it("P2 Test 8: deals table has new killedAt and killReason columns (both nullable)", () => {
    const cols = getTableColumns(schema.deals);
    const byName = Object.fromEntries(
      Object.values(cols).map((c) => [c.name, c]),
    );
    expect(byName.killed_at).toBeDefined();
    expect(byName.killed_at.notNull).toBe(false);
    expect(byName.kill_reason).toBeDefined();
    expect(byName.kill_reason.notNull).toBe(false);
  });

  it("P2 Test 9: Task / NewTask / DealNote / NewDealNote types compile and match table shape", () => {
    // Runtime proxy for type presence — the types are exported from the barrel
    // via `export * from "./app"`, so a consumer importing them and calling
    // these objects confirms the exports. The actual type check is performed
    // by `npx tsc --noEmit` in the plan's verify step.
    const taskRow: schema.Task = {
      id: "00000000-0000-0000-0000-000000000000",
      dealId: "00000000-0000-0000-0000-000000000000",
      title: "x",
      ownerUserId: null,
      dueDate: null,
      status: "open",
      isNext: false,
      parentTaskId: null,
      advancesStageToId: null,
      createdBy: "00000000-0000-0000-0000-000000000000",
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };
    const newTask: schema.NewTask = { dealId: taskRow.dealId, title: "y", createdBy: taskRow.createdBy };
    const dealNote: schema.DealNote = {
      id: "00000000-0000-0000-0000-000000000000",
      dealId: taskRow.dealId,
      body: "note",
      isSystem: false,
      createdBy: taskRow.createdBy,
      createdAt: new Date(),
    };
    const newDealNote: schema.NewDealNote = { dealId: taskRow.dealId, body: "n", createdBy: taskRow.createdBy };
    expect(taskRow.status).toBe("open");
    expect(newTask.title).toBe("y");
    expect(dealNote.isSystem).toBe(false);
    expect(newDealNote.body).toBe("n");
  });
});
