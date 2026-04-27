import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { sql, eq, and, isNull, desc } from "drizzle-orm";

/**
 * Phase 2 Plan 03 Task 1 — task server action tests (RED).
 *
 * These tests hit a REAL Postgres (docker-compose). Until Task 2 lands
 * `app/deal/[id]/actions/tasks.ts`, every `it(...)` fails at module-load
 * with `Cannot find module '@/app/deal/[id]/actions/tasks'` — that's the
 * RED state per TDD.
 *
 * Shape (11 behaviors):
 *   1.  createTask happy path — status='open', is_next=false
 *   2.  createTask isNext:true on a deal with no prior is_next → row lands with is_next=true
 *   3.  createTask isNext:true on a deal with an existing is_next → old cleared atomically
 *   4.  createTask validation failure → {ok:false, errors}; no DB writes
 *   5.  completeTask with no open siblings → task done, no auto-promote
 *   6.  completeTask with 2 other open → next (due_date asc nulls last, created_at asc) promoted
 *   7.  completeTask with advancesStageToId → same-tx stage advance; source=task_autoadvance;
 *       triggeringTaskId breadcrumb in audit afterJson; result.stageAdvanced={toCode,toLabel}
 *   8a. undoCompleteTask reverses case 5 — status=open, is_next restored, compensating audit
 *   8b. undoCompleteTask reverses case 7 — calls revertStageInTx via audit-row lookup (W1)
 *   8c. undoCompleteTask ABORTS when task_autoadvance audit row is missing (race safeguard)
 *   9.  updateTask — partial diff, audit row has before.title != after.title
 *   10. reassignTask — ownerUserId diff + audit row
 *   11. INVARIANT (concurrency): 10 parallel createTask(isNext:true) → exactly 1 is_next row
 */

// Required env for @/lib/env to load BEFORE any @/lib/* import.
process.env.DATABASE_URL ??= "postgres://npr:npr@localhost:5432/npr_dashboard";
process.env.CF_ACCESS_TEAM_DOMAIN ??= "test.cloudflareaccess.com";
process.env.CF_ACCESS_AUD ??= "a".repeat(64);
process.env.NEXT_PUBLIC_APP_NAME ??= "NPR Dashboard";
process.env.NEXT_PUBLIC_APP_DOMAIN ??= "portal.utstitle.com";

const TEST_EMAIL = "test+task-actions@example.com";
let TEST_USER_ID: string;

// Mock next/cache.revalidatePath — no-op in tests
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock getCurrentUser — returns the pre-seeded test user
vi.mock("@/lib/current-user", () => ({
  getCurrentUser: vi.fn(async () => ({
    id: TEST_USER_ID,
    email: TEST_EMAIL,
    name: "Test User",
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
}));

describe("task server actions + is_next invariant", () => {
  let db: typeof import("@/lib/db").db;
  let createTask: typeof import("@/app/deal/[id]/actions/tasks").createTask;
  let completeTask: typeof import("@/app/deal/[id]/actions/tasks").completeTask;
  let undoCompleteTask: typeof import("@/app/deal/[id]/actions/tasks").undoCompleteTask;
  let updateTask: typeof import("@/app/deal/[id]/actions/tasks").updateTask;
  let reassignTask: typeof import("@/app/deal/[id]/actions/tasks").reassignTask;
  let deals: typeof import("@/db/schema").deals;
  let tasks: typeof import("@/db/schema").tasks;
  let auditLog: typeof import("@/db/schema").auditLog;
  let stages: typeof import("@/db/schema").stages;
  let tracks: typeof import("@/db/schema").tracks;
  let users: typeof import("@/db/schema").users;

  // Seeded ids
  let preScreenId: string;
  let dealStructuringId: string;
  let teTrackId: string;
  let TEST_DEAL_ID: string;

  beforeAll(async () => {
    const dbMod = await import("@/lib/db");
    db = dbMod.db;
    const schemaMod = await import("@/db/schema");
    deals = schemaMod.deals;
    tasks = schemaMod.tasks;
    auditLog = schemaMod.auditLog;
    stages = schemaMod.stages;
    tracks = schemaMod.tracks;
    users = schemaMod.users;

    const actionsMod = await import("@/app/deal/[id]/actions/tasks");
    createTask = actionsMod.createTask;
    completeTask = actionsMod.completeTask;
    undoCompleteTask = actionsMod.undoCompleteTask;
    updateTask = actionsMod.updateTask;
    reassignTask = actionsMod.reassignTask;

    // Seed test user
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, TEST_EMAIL))
      .limit(1);
    if (existing[0]) {
      TEST_USER_ID = existing[0].id;
    } else {
      const [inserted] = await db
        .insert(users)
        .values({ email: TEST_EMAIL, name: "Test User" })
        .returning();
      TEST_USER_ID = inserted.id;
    }

    // Resolve well-known stage + track ids
    const [preScreen] = await db
      .select()
      .from(stages)
      .where(
        and(eq(stages.code, "pre_screen_qualification"), isNull(stages.trackId)),
      );
    preScreenId = preScreen.id;

    const [dealStructuring] = await db
      .select()
      .from(stages)
      .where(
        and(eq(stages.code, "deal_structuring"), isNull(stages.trackId)),
      );
    dealStructuringId = dealStructuring.id;

    const [teTrack] = await db
      .select()
      .from(tracks)
      .where(eq(tracks.code, "TE"));
    teTrackId = teTrack.id;
  });

  beforeEach(async () => {
    // Clean rows this suite creates — audit first, then tasks, then deals
    await db.execute(
      sql`DELETE FROM audit_log WHERE user_email = ${TEST_EMAIL}`,
    );
    await db.execute(
      sql`DELETE FROM tasks WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(
      sql`DELETE FROM deals WHERE created_by = ${TEST_USER_ID}`,
    );

    // Seed a fresh test deal for each test (isolates is_next state)
    const [freshDeal] = await db
      .insert(deals)
      .values({
        trackId: teTrackId,
        stageId: preScreenId,
        fileNo: `XX-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Task action test deal",
        priority: "MEDIUM",
        status: "active",
        createdBy: TEST_USER_ID,
        internalOwner: TEST_USER_ID,
      })
      .returning();
    TEST_DEAL_ID = freshDeal.id;
  });

  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM audit_log WHERE user_email = ${TEST_EMAIL}`,
    );
    await db.execute(
      sql`DELETE FROM tasks WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(
      sql`DELETE FROM deals WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(sql`DELETE FROM users WHERE email = ${TEST_EMAIL}`);
    await db.execute(
      sql`DELETE FROM users WHERE email = 'test+task-actions-second@example.com'`,
    );
  });

  /** Helper: insert a task directly, bypassing the action (for test setup). */
  async function insertTask(overrides: {
    title?: string;
    isNext?: boolean;
    dueDate?: Date | null;
    advancesStageToId?: string | null;
    status?: string;
  } = {}): Promise<string> {
    const [row] = await db
      .insert(tasks)
      .values({
        dealId: TEST_DEAL_ID,
        title: overrides.title ?? "Setup task",
        isNext: overrides.isNext ?? false,
        dueDate: overrides.dueDate ?? null,
        advancesStageToId: overrides.advancesStageToId ?? null,
        status: overrides.status ?? "open",
        createdBy: TEST_USER_ID,
      })
      .returning();
    return row.id;
  }

  it("Test 1: createTask happy path — inserts row with status='open', is_next=false", async () => {
    const result = await createTask({
      dealId: TEST_DEAL_ID,
      title: "First task",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.task.status).toBe("open");
    expect(result.task.isNext).toBe(false);
    expect(result.task.title).toBe("First task");

    const rows = await db.select().from(tasks).where(eq(tasks.id, result.task.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("open");
    expect(rows[0].isNext).toBe(false);
  });

  it("Test 2: createTask isNext:true on a deal with no is_next → new row is_next=true", async () => {
    const result = await createTask({
      dealId: TEST_DEAL_ID,
      title: "Next task",
      isNext: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.task.isNext).toBe(true);

    // Verify exactly one is_next=true on this deal
    const isNextRows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.dealId, TEST_DEAL_ID), eq(tasks.isNext, true)));
    expect(isNextRows).toHaveLength(1);
    expect(isNextRows[0].id).toBe(result.task.id);
  });

  it("Test 3: createTask isNext:true clears prior is_next atomically on the same deal", async () => {
    const priorId = await insertTask({ title: "Prior next", isNext: true });

    const result = await createTask({
      dealId: TEST_DEAL_ID,
      title: "New next",
      isNext: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // New row is_next=true
    expect(result.task.isNext).toBe(true);

    // Prior row now is_next=false
    const [prior] = await db.select().from(tasks).where(eq(tasks.id, priorId));
    expect(prior.isNext).toBe(false);

    // Exactly one is_next=true on this deal (the new one)
    const isNextRows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.dealId, TEST_DEAL_ID), eq(tasks.isNext, true)));
    expect(isNextRows).toHaveLength(1);
    expect(isNextRows[0].id).toBe(result.task.id);

    // Audit: at least 2 rows (one for cleared prior, one for created)
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    const forPrior = audit.filter((a) => a.recordId === priorId);
    const forNew = audit.filter((a) => a.recordId === result.task.id);
    expect(forPrior.length).toBeGreaterThanOrEqual(1);
    expect(forNew.length).toBeGreaterThanOrEqual(1);
  });

  it("Test 4: createTask validation failure → {ok:false, errors}; no DB writes", async () => {
    const beforeTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.dealId, TEST_DEAL_ID));
    const beforeAudit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));

    const result = await createTask({
      dealId: TEST_DEAL_ID,
      // title deliberately missing
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Narrow to the validation-error variant
    expect("errors" in result).toBe(true);
    if (!("errors" in result)) return;
    expect(result.errors.title).toBeDefined();

    const afterTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.dealId, TEST_DEAL_ID));
    const afterAudit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    expect(afterTasks.length).toBe(beforeTasks.length);
    expect(afterAudit.length).toBe(beforeAudit.length);
  });

  it("Test 5: completeTask with no open siblings — task done, no auto-promote, newIsNext=null", async () => {
    const taskId = await insertTask({ title: "Solo task", isNext: true });

    const result = await completeTask({ id: taskId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newIsNext).toBeNull();
    expect(result.stageAdvanced).toBeNull();

    const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    expect(row.status).toBe("done");
    expect(row.isNext).toBe(false);
    expect(row.completedAt).not.toBeNull();
  });

  it("Test 6: completeTask with 2 other open tasks — promotes next by (due_date asc nulls last, created_at asc)", async () => {
    const completing = await insertTask({ title: "Completing", isNext: true });
    // Two other open tasks — one with earlier due_date should be promoted
    const earlier = new Date("2026-05-01T00:00:00Z");
    const later = new Date("2026-06-01T00:00:00Z");
    const candidateEarlier = await insertTask({
      title: "Earlier due",
      isNext: false,
      dueDate: earlier,
    });
    const candidateLater = await insertTask({
      title: "Later due",
      isNext: false,
      dueDate: later,
    });

    const result = await completeTask({ id: completing });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newIsNext).not.toBeNull();
    expect(result.newIsNext?.id).toBe(candidateEarlier);
    expect(result.newIsNext?.title).toBe("Earlier due");

    const [earlierRow] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, candidateEarlier));
    expect(earlierRow.isNext).toBe(true);

    const [laterRow] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, candidateLater));
    expect(laterRow.isNext).toBe(false);

    // Exactly one audit row per affected task (completing + promoted)
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    const forCompleting = audit.filter((a) => a.recordId === completing);
    const forPromoted = audit.filter((a) => a.recordId === candidateEarlier);
    expect(forCompleting.length).toBeGreaterThanOrEqual(1);
    expect(forPromoted.length).toBeGreaterThanOrEqual(1);
  });

  it("Test 7: completeTask with advancesStageToId — same-tx stage advance; triggeringTaskId breadcrumb; stageAdvanced={toCode,toLabel}", async () => {
    // Seed a task that will advance the stage to deal_structuring
    const taskId = await insertTask({
      title: "Advances stage",
      advancesStageToId: dealStructuringId,
    });

    const result = await completeTask({ id: taskId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // stageAdvanced populated with toCode + toLabel
    expect(result.stageAdvanced).not.toBeNull();
    expect(result.stageAdvanced?.toCode).toBe("deal_structuring");
    expect(result.stageAdvanced?.toLabel).toBeDefined();
    expect(typeof result.stageAdvanced?.toLabel).toBe("string");
    expect(result.stageAdvanced?.toLabel.length).toBeGreaterThan(0);

    // Deal stage_id updated
    const [deal] = await db
      .select()
      .from(deals)
      .where(eq(deals.id, TEST_DEAL_ID));
    expect(deal.stageId).toBe(dealStructuringId);

    // Audit rows: tasks.update + deals.update w/ source=task_autoadvance + triggeringTaskId
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    const dealsAudit = audit.filter(
      (a) => a.tableName === "deals" && a.recordId === TEST_DEAL_ID,
    );
    expect(dealsAudit.length).toBeGreaterThanOrEqual(1);
    const after = dealsAudit[0].afterJson as {
      source?: string;
      triggeringTaskId?: string;
    };
    expect(after.source).toBe("task_autoadvance");
    expect(after.triggeringTaskId).toBe(taskId);
  });

  it("Test 8a: undoCompleteTask reverses a simple complete (status=open, is_next restored)", async () => {
    const taskId = await insertTask({ title: "To undo", isNext: true });

    const complete = await completeTask({ id: taskId });
    expect(complete.ok).toBe(true);

    const undo = await undoCompleteTask({
      taskId,
      autoPromotedTaskId: null,
      priorIsNext: true,
    });
    expect(undo.ok).toBe(true);

    const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    expect(row.status).toBe("open");
    expect(row.completedAt).toBeNull();
    expect(row.isNext).toBe(true);

    // Compensating audit row exists
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, taskId));
    // create-audit not written (we inserted directly); we expect at least 2
    // updates (complete + undo)
    const updates = audit.filter((a) => a.operation === "update");
    expect(updates.length).toBeGreaterThanOrEqual(2);
  });

  it("Test 8b: undoCompleteTask reverses an auto-advance via audit-lookup (task_autoadvance_undo)", async () => {
    const taskId = await insertTask({
      title: "Advances then undone",
      advancesStageToId: dealStructuringId,
    });

    const complete = await completeTask({ id: taskId });
    expect(complete.ok).toBe(true);
    if (!complete.ok) return;
    expect(complete.stageAdvanced).not.toBeNull();

    // Verify deal stage advanced
    let [deal] = await db
      .select()
      .from(deals)
      .where(eq(deals.id, TEST_DEAL_ID));
    expect(deal.stageId).toBe(dealStructuringId);

    const undo = await undoCompleteTask({
      taskId,
      autoPromotedTaskId: null,
      priorIsNext: false,
    });
    expect(undo.ok).toBe(true);

    // Stage reverted to pre_screen (the deal's prior stage)
    [deal] = await db.select().from(deals).where(eq(deals.id, TEST_DEAL_ID));
    expect(deal.stageId).toBe(preScreenId);

    // Audit row with source=task_autoadvance_undo written for the revert
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, TEST_DEAL_ID))
      .orderBy(desc(auditLog.createdAt));
    const undoRow = audit.find((a) => {
      const after = a.afterJson as { source?: string };
      return after?.source === "task_autoadvance_undo";
    });
    expect(undoRow).toBeDefined();
  });

  it("Test 8c: undoCompleteTask ABORTS when task_autoadvance audit row is missing (Cannot safely revert stage)", async () => {
    const taskId = await insertTask({
      title: "Advances then audit deleted",
      advancesStageToId: dealStructuringId,
    });

    const complete = await completeTask({ id: taskId });
    expect(complete.ok).toBe(true);

    // Simulate race / tampered audit: delete the task_autoadvance audit row
    await db.execute(
      sql`DELETE FROM audit_log WHERE table_name = 'deals' AND record_id = ${TEST_DEAL_ID} AND after_json->>'source' = 'task_autoadvance'`,
    );

    // Deal is still at dealStructuringId at this point
    const [dealBefore] = await db
      .select()
      .from(deals)
      .where(eq(deals.id, TEST_DEAL_ID));
    expect(dealBefore.stageId).toBe(dealStructuringId);

    const undo = await undoCompleteTask({
      taskId,
      autoPromotedTaskId: null,
      priorIsNext: false,
    });
    expect(undo.ok).toBe(false);
    if (undo.ok) return;
    expect(undo.error).toMatch(/Cannot safely revert stage/);

    // Task row NOT modified — still status=done (tx rollback)
    const [taskRow] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    expect(taskRow.status).toBe("done");

    // Deal stage unchanged
    const [dealAfter] = await db
      .select()
      .from(deals)
      .where(eq(deals.id, TEST_DEAL_ID));
    expect(dealAfter.stageId).toBe(dealStructuringId);
  });

  it("Test 9: updateTask writes audit row with before.title != after.title", async () => {
    const taskId = await insertTask({ title: "Old title" });

    const result = await updateTask({
      id: taskId,
      title: "New title",
    });
    expect(result.ok).toBe(true);

    const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    expect(row.title).toBe("New title");

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, taskId));
    expect(audit.length).toBeGreaterThanOrEqual(1);
    const a = audit[audit.length - 1];
    const before = a.beforeJson as { title?: string };
    const after = a.afterJson as { title?: string };
    expect(before.title).toBe("Old title");
    expect(after.title).toBe("New title");
  });

  it("Test 10: reassignTask writes audit row with ownerUserId change", async () => {
    const taskId = await insertTask({ title: "Reassign me" });

    // Create or resolve a second user to reassign to (tolerant of leftover
    // rows from a prior failed run).
    const secondEmail = "test+task-actions-second@example.com";
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, secondEmail))
      .limit(1);
    let secondUser: { id: string };
    if (existing[0]) {
      secondUser = existing[0];
    } else {
      const [inserted] = await db
        .insert(users)
        .values({ email: secondEmail, name: "Second" })
        .returning();
      secondUser = inserted;
    }

    try {
      const result = await reassignTask(taskId, secondUser.id);
      expect(result.ok).toBe(true);

      const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(row.ownerUserId).toBe(secondUser.id);

      const audit = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.recordId, taskId));
      expect(audit.length).toBeGreaterThanOrEqual(1);
      const a = audit[audit.length - 1];
      const after = a.afterJson as { ownerUserId?: string; owner_user_id?: string };
      // drizzle $inferSelect uses camelCase; DB is snake_case. Accept both.
      expect(after.ownerUserId ?? after.owner_user_id).toBe(secondUser.id);
    } finally {
      // Clean up in FK-safe order: task (references user) → user
      await db.execute(sql`DELETE FROM tasks WHERE owner_user_id = ${secondUser.id}`);
      await db.execute(sql`DELETE FROM users WHERE email = ${secondEmail}`);
    }
  });

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
    const ok = results.filter(
      (r) => r.status === "fulfilled" && r.value.ok === true,
    );
    expect(ok.length).toBeGreaterThanOrEqual(1);
  });
});
