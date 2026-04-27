import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { sql, eq, and, isNull } from "drizzle-orm";

/**
 * Phase 2 Plan 04 Task 1 — deal update/close/kill server action tests.
 *
 * Hits real Postgres. Actions depend on:
 *   - getCurrentUser (stubbed)
 *   - revalidatePath (stubbed)
 *
 * Shape (9 behaviors):
 *   1. updateDeal happy path: {title:'new'} applies; audit diff shows just title
 *   2. updateDeal rejects unknown key (.strict())
 *   3. updateDeal REJECTS status='killed' (must use killDeal)
 *   4. updateDeal with empty diff → {ok:true, noop:true} and NO audit row
 *   5. closeDeal sets status=closed, stage=file_completed, closedAt; audit written
 *   6. killDeal happy path: status=killed, stage=killed, killedAt+closedAt+killReason set;
 *      deal_notes row with is_system=true; 2 audit rows in same tx
 *   7. killDeal REJECTS empty reason (killDealSchema min 3)
 *   8. killDeal on already-killed deal → {ok:false}; no duplicate system note
 *   9. INVARIANT: killDeal rollback — writeAuditLog throws AFTER UPDATE deals;
 *      deal.status stays 'active'; no system note inserted (whole tx rolls back)
 */

process.env.DATABASE_URL ??= "postgres://npr:npr@localhost:5432/npr_dashboard";
process.env.CF_ACCESS_TEAM_DOMAIN ??= "test.cloudflareaccess.com";
process.env.CF_ACCESS_AUD ??= "a".repeat(64);
process.env.NEXT_PUBLIC_APP_NAME ??= "NPR Dashboard";
process.env.NEXT_PUBLIC_APP_DOMAIN ??= "portal.utstitle.com";

const TEST_EMAIL = "test+deal-actions@example.com";
let TEST_USER_ID: string;

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

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

describe("deal update + close + kill server actions", () => {
  let db: typeof import("@/lib/db").db;
  let updateDeal: typeof import("@/app/deal/[id]/actions/deals").updateDeal;
  let closeDeal: typeof import("@/app/deal/[id]/actions/deals").closeDeal;
  let killDeal: typeof import("@/app/deal/[id]/actions/deals").killDeal;
  let deals: typeof import("@/db/schema").deals;
  let auditLog: typeof import("@/db/schema").auditLog;
  let dealNotes: typeof import("@/db/schema").dealNotes;
  let stages: typeof import("@/db/schema").stages;
  let tracks: typeof import("@/db/schema").tracks;
  let users: typeof import("@/db/schema").users;

  let preScreenId: string;
  let fileCompletedId: string;
  let killedId: string;
  let teTrackId: string;

  beforeAll(async () => {
    const dbMod = await import("@/lib/db");
    db = dbMod.db;
    const schemaMod = await import("@/db/schema");
    deals = schemaMod.deals;
    auditLog = schemaMod.auditLog;
    dealNotes = schemaMod.dealNotes;
    stages = schemaMod.stages;
    tracks = schemaMod.tracks;
    users = schemaMod.users;

    const actionsMod = await import("@/app/deal/[id]/actions/deals");
    updateDeal = actionsMod.updateDeal;
    closeDeal = actionsMod.closeDeal;
    killDeal = actionsMod.killDeal;

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

    const [pre] = await db
      .select()
      .from(stages)
      .where(
        and(eq(stages.code, "pre_screen_qualification"), isNull(stages.trackId)),
      );
    preScreenId = pre.id;

    const [fc] = await db
      .select()
      .from(stages)
      .where(and(eq(stages.code, "file_completed"), isNull(stages.trackId)));
    fileCompletedId = fc.id;

    const [ki] = await db
      .select()
      .from(stages)
      .where(and(eq(stages.code, "killed"), isNull(stages.trackId)));
    killedId = ki.id;

    const [te] = await db
      .select()
      .from(tracks)
      .where(eq(tracks.code, "TE"));
    teTrackId = te.id;
  });

  beforeEach(async () => {
    await db.execute(
      sql`DELETE FROM audit_log WHERE user_email = ${TEST_EMAIL}`,
    );
    // deal_notes CASCADE via deals deletion, but the rollback test may leave rows
    await db.execute(
      sql`DELETE FROM deal_notes WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(sql`DELETE FROM deals WHERE created_by = ${TEST_USER_ID}`);
  });

  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM audit_log WHERE user_email = ${TEST_EMAIL}`,
    );
    await db.execute(
      sql`DELETE FROM deal_notes WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(sql`DELETE FROM deals WHERE created_by = ${TEST_USER_ID}`);
    await db.execute(sql`DELETE FROM users WHERE email = ${TEST_EMAIL}`);
  });

  async function seedDeal(overrides: Partial<typeof deals.$inferInsert> = {}): Promise<string> {
    const [inserted] = await db
      .insert(deals)
      .values({
        trackId: teTrackId,
        stageId: preScreenId,
        fileNo: `XX-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Deal-actions test deal",
        priority: "MEDIUM",
        status: "active",
        createdBy: TEST_USER_ID,
        internalOwner: TEST_USER_ID,
        ...overrides,
      })
      .returning();
    return inserted.id;
  }

  it("Test 1: updateDeal happy path — {title:'new title'} applies; audit row records diff", async () => {
    const dealId = await seedDeal({ title: "Original Title" });
    const result = await updateDeal({ dealId, title: "New Title" });
    expect(result.ok).toBe(true);

    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.title).toBe("New Title");

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, dealId));
    expect(audit).toHaveLength(1);
    expect(audit[0].tableName).toBe("deals");
    expect(audit[0].operation).toBe("update");
    const before = audit[0].beforeJson as { title?: string };
    const after = audit[0].afterJson as { title?: string };
    expect(before.title).toBe("Original Title");
    expect(after.title).toBe("New Title");
  });

  it("Test 2: updateDeal rejects unknown key (strict schema)", async () => {
    const dealId = await seedDeal();
    // fileNo is immutable — omitted from updateDealSchema, .strict() rejects
    const result = await updateDeal({
      dealId,
      fileNo: "AA-9999-9999",
    } as unknown);
    expect(result.ok).toBe(false);
  });

  it("Test 3: updateDeal REJECTS setting status='killed' (must use killDeal)", async () => {
    const dealId = await seedDeal();
    const result = await updateDeal({
      dealId,
      status: "killed",
    } as unknown);
    expect(result.ok).toBe(false);

    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.status).toBe("active");
  });

  it("Test 4: updateDeal with empty diff returns {ok:true, noop:true} and writes NO audit row", async () => {
    const dealId = await seedDeal();
    const result = await updateDeal({ dealId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.noop).toBe(true);
    }
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, dealId));
    expect(audit).toHaveLength(0);
  });

  it("Test 5: closeDeal sets status=closed, stage=file_completed, closedAt set; audit row written", async () => {
    const dealId = await seedDeal();
    const result = await closeDeal({ dealId });
    expect(result.ok).toBe(true);

    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.status).toBe("closed");
    expect(deal.stageId).toBe(fileCompletedId);
    expect(deal.closedAt).toBeInstanceOf(Date);

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, dealId));
    expect(audit).toHaveLength(1);
    expect(audit[0].operation).toBe("update");
  });

  it("Test 6: killDeal happy path — status/stage/killedAt/closedAt/killReason set; deal_notes is_system=true; 2 audit rows", async () => {
    const dealId = await seedDeal();
    const reason = "Buyer ghosted for three weeks";
    const result = await killDeal({ dealId, reason });
    expect(result.ok).toBe(true);

    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.status).toBe("killed");
    expect(deal.stageId).toBe(killedId);
    expect(deal.killedAt).toBeInstanceOf(Date);
    expect(deal.closedAt).toBeInstanceOf(Date);
    expect(deal.killReason).toBe(reason);

    const notes = await db
      .select()
      .from(dealNotes)
      .where(eq(dealNotes.dealId, dealId));
    expect(notes).toHaveLength(1);
    expect(notes[0].isSystem).toBe(true);
    expect(notes[0].body).toBe(reason);
    expect(notes[0].createdBy).toBe(TEST_USER_ID);

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    // Two rows: deals.update + deal_notes.create
    expect(audit.length).toBeGreaterThanOrEqual(2);
    const tables = audit.map((a) => a.tableName).sort();
    expect(tables).toContain("deals");
    expect(tables).toContain("deal_notes");
  });

  it("Test 7: killDeal REJECTS empty reason (killDealSchema min 3)", async () => {
    const dealId = await seedDeal();
    const result = await killDeal({ dealId, reason: "" });
    expect(result.ok).toBe(false);

    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.status).toBe("active");
  });

  it("Test 8: killDeal on already-killed deal — {ok:false}; no duplicate system note", async () => {
    const dealId = await seedDeal();
    const firstReason = "First kill reason";
    const firstResult = await killDeal({ dealId, reason: firstReason });
    expect(firstResult.ok).toBe(true);

    const secondResult = await killDeal({
      dealId,
      reason: "Second kill attempt",
    });
    expect(secondResult.ok).toBe(false);
    if (!secondResult.ok) {
      expect(secondResult.error.toLowerCase()).toMatch(/already killed/);
    }

    const notes = await db
      .select()
      .from(dealNotes)
      .where(eq(dealNotes.dealId, dealId));
    expect(notes).toHaveLength(1); // no duplicate
    expect(notes[0].body).toBe(firstReason);
  });

  it("Test 9 (INVARIANT): killDeal rollback — if writeAuditLog throws, deal stays active and NO system note", async () => {
    // Use module-mock to force writeAuditLog to throw mid-tx
    vi.resetModules();
    vi.doMock("@/lib/audit", () => ({
      writeAuditLog: vi.fn(async () => {
        throw new Error("boom — simulated audit failure during kill");
      }),
    }));

    const freshDb = (await import("@/lib/db")).db;
    const freshSchema = await import("@/db/schema");
    const { killDeal: freshKillDeal } = await import(
      "@/app/deal/[id]/actions/deals"
    );

    // Seed a fresh deal under the mocked module
    const [freshDeal] = await freshDb
      .insert(freshSchema.deals)
      .values({
        trackId: teTrackId,
        stageId: preScreenId,
        fileNo: `XX-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Rollback test deal",
        priority: "MEDIUM",
        status: "active",
        createdBy: TEST_USER_ID,
        internalOwner: TEST_USER_ID,
      })
      .returning();

    const result = await freshKillDeal({
      dealId: freshDeal.id,
      reason: "Rollback test reason",
    });
    // Action should either return ok:false OR throw; either way the tx rolls back
    if (result && typeof result === "object" && "ok" in result) {
      expect(result.ok).toBe(false);
    }

    // Deal should be UNCHANGED (status still active, killReason null, stage unchanged)
    const [deal] = await freshDb
      .select()
      .from(freshSchema.deals)
      .where(eq(freshSchema.deals.id, freshDeal.id));
    expect(deal.status).toBe("active");
    expect(deal.killReason).toBeNull();
    expect(deal.stageId).toBe(preScreenId);

    // NO system note should have been inserted
    const notes = await freshDb
      .select()
      .from(freshSchema.dealNotes)
      .where(eq(freshSchema.dealNotes.dealId, freshDeal.id));
    expect(notes).toHaveLength(0);

    // Restore
    vi.doUnmock("@/lib/audit");
    vi.resetModules();
  });
});
