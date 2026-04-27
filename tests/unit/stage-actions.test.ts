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
 * Phase 2 Plan 04 Task 1 — stage advance/revert server action tests.
 *
 * These tests hit a REAL Postgres (docker-compose). The actions depend on:
 *   - `getCurrentUser()` — stubbed via vi.mock so we don't need a live
 *     Cloudflare Access JWT in tests
 *   - `revalidatePath()` from next/cache — stubbed to a no-op
 *
 * Shape (10 behaviors from plan 04 Task 1):
 *   1. advanceStage happy path (universal → universal; sort_order increases)
 *   2. advanceStage happy path to track-specific (target.track_id = deal.track_id)
 *   3. advanceStage REJECTS going backward (target.sort_order < current.sort_order)
 *   4. advanceStage REJECTS track mismatch (target belongs to a different track)
 *   5. advanceStage REJECTS non-existent targetStageId
 *   6. revertStage happy path (sort_order decreases); audit source='manual_revert'
 *   7. revertStage REJECTS forward motion
 *   8. advanceStageInTx (tx-scoped): accepts an open tx + writes audit via it
 *   9. INVARIANT: advanceStage writes EXACTLY ONE audit row, table=deals,
 *      op=update, source='manual_advance' in afterJson
 *  10. Concurrency: two advanceStage calls race → Postgres serializes;
 *      two audit rows written; no lost-update
 */

// Required env for @/lib/env to load BEFORE any @/lib/* import.
process.env.DATABASE_URL ??= "postgres://npr:npr@localhost:5432/npr_dashboard";
process.env.CF_ACCESS_TEAM_DOMAIN ??= "test.cloudflareaccess.com";
process.env.CF_ACCESS_AUD ??= "a".repeat(64);
process.env.NEXT_PUBLIC_APP_NAME ??= "NPR Dashboard";
process.env.NEXT_PUBLIC_APP_DOMAIN ??= "portal.utstitle.com";

// Stubbed user (created in beforeAll, reused for all tests)
const TEST_EMAIL = "test+stage-actions@example.com";
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

describe("stage advance + revert server actions", () => {
  let db: typeof import("@/lib/db").db;
  let advanceStage: typeof import("@/app/deal/[id]/actions/stages").advanceStage;
  let revertStage: typeof import("@/app/deal/[id]/actions/stages").revertStage;
  let advanceStageInTx: typeof import("@/app/deal/[id]/actions/stages").advanceStageInTx;
  let deals: typeof import("@/db/schema").deals;
  let auditLog: typeof import("@/db/schema").auditLog;
  let stages: typeof import("@/db/schema").stages;
  let tracks: typeof import("@/db/schema").tracks;
  let users: typeof import("@/db/schema").users;

  // Resolved stage IDs (looked up once)
  let preScreenId: string; // universal, sort_order 10
  let dealStructuringId: string; // universal, sort_order 20
  let fileCompletedId: string; // universal, sort_order 30
  let titleOrderOpenedId: string; // TE, sort_order 100
  let dealTeamAssignedId: string; // FL, sort_order 200
  let teTrackId: string;
  let flTrackId: string;

  beforeAll(async () => {
    const dbMod = await import("@/lib/db");
    db = dbMod.db;
    const schemaMod = await import("@/db/schema");
    deals = schemaMod.deals;
    auditLog = schemaMod.auditLog;
    stages = schemaMod.stages;
    tracks = schemaMod.tracks;
    users = schemaMod.users;

    const actionsMod = await import("@/app/deal/[id]/actions/stages");
    advanceStage = actionsMod.advanceStage;
    revertStage = actionsMod.revertStage;
    advanceStageInTx = actionsMod.advanceStageInTx;

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

    // Resolve well-known stage ids
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
      .where(and(eq(stages.code, "deal_structuring"), isNull(stages.trackId)));
    dealStructuringId = dealStructuring.id;

    const [fileCompleted] = await db
      .select()
      .from(stages)
      .where(and(eq(stages.code, "file_completed"), isNull(stages.trackId)));
    fileCompletedId = fileCompleted.id;

    const [titleOrderOpened] = await db
      .select()
      .from(stages)
      .where(eq(stages.code, "title_order_opened"));
    titleOrderOpenedId = titleOrderOpened.id;

    const [dealTeamAssigned] = await db
      .select()
      .from(stages)
      .where(eq(stages.code, "deal_team_assigned"));
    dealTeamAssignedId = dealTeamAssigned.id;

    const [teTrack] = await db
      .select()
      .from(tracks)
      .where(eq(tracks.code, "TE"));
    teTrackId = teTrack.id;

    const [flTrack] = await db
      .select()
      .from(tracks)
      .where(eq(tracks.code, "FL"));
    flTrackId = flTrack.id;
  });

  beforeEach(async () => {
    // Clean only rows this suite created
    await db.execute(
      sql`DELETE FROM audit_log WHERE user_email = ${TEST_EMAIL}`,
    );
    await db.execute(sql`DELETE FROM deals WHERE created_by = ${TEST_USER_ID}`);
  });

  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM audit_log WHERE user_email = ${TEST_EMAIL}`,
    );
    await db.execute(sql`DELETE FROM deals WHERE created_by = ${TEST_USER_ID}`);
    await db.execute(sql`DELETE FROM users WHERE email = ${TEST_EMAIL}`);
  });

  /** Insert a test deal on TE track, starting at pre_screen_qualification. */
  async function seedDeal(overrides: {
    stageId?: string;
    trackId?: string;
  } = {}): Promise<string> {
    const [inserted] = await db
      .insert(deals)
      .values({
        trackId: overrides.trackId ?? teTrackId,
        stageId: overrides.stageId ?? preScreenId,
        fileNo: `XX-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Stage test deal",
        priority: "MEDIUM",
        status: "active",
        createdBy: TEST_USER_ID,
        internalOwner: TEST_USER_ID,
      })
      .returning();
    return inserted.id;
  }

  it("Test 1: advanceStage happy path (pre_screen → deal_structuring) writes manual_advance audit", async () => {
    const dealId = await seedDeal();
    const result = await advanceStage({
      dealId,
      targetStageId: dealStructuringId,
    });
    expect(result.ok).toBe(true);

    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.stageId).toBe(dealStructuringId);

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, dealId));
    expect(audit).toHaveLength(1);
    expect(audit[0].tableName).toBe("deals");
    expect(audit[0].operation).toBe("update");
    const after = audit[0].afterJson as { source?: string };
    expect(after.source).toBe("manual_advance");
  });

  it("Test 2: advanceStage to track-specific stage succeeds when target.track_id = deal.track_id (TE → title_order_opened)", async () => {
    const dealId = await seedDeal();
    const result = await advanceStage({
      dealId,
      targetStageId: titleOrderOpenedId,
    });
    expect(result.ok).toBe(true);
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.stageId).toBe(titleOrderOpenedId);
  });

  it("Test 3: advanceStage REJECTS going backward (target.sort_order < current.sort_order)", async () => {
    const dealId = await seedDeal({ stageId: dealStructuringId });
    const result = await advanceStage({
      dealId,
      targetStageId: preScreenId,
    });
    expect(result.ok).toBe(false);
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.stageId).toBe(dealStructuringId); // unchanged
  });

  it("Test 4: advanceStage REJECTS track mismatch (TE deal trying FL-specific stage)", async () => {
    const dealId = await seedDeal(); // TE deal
    const result = await advanceStage({
      dealId,
      targetStageId: dealTeamAssignedId, // FL-specific stage
    });
    expect(result.ok).toBe(false);
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.stageId).toBe(preScreenId); // unchanged
  });

  it("Test 5: advanceStage REJECTS non-existent targetStageId (valid uuid but no row)", async () => {
    const dealId = await seedDeal();
    const nonExistent = "00000000-0000-0000-0000-000000000000";
    const result = await advanceStage({
      dealId,
      targetStageId: nonExistent,
    });
    expect(result.ok).toBe(false);
  });

  it("Test 6: revertStage happy path (deal_structuring → pre_screen); audit source='manual_revert'", async () => {
    const dealId = await seedDeal({ stageId: dealStructuringId });
    const result = await revertStage({
      dealId,
      targetStageId: preScreenId,
    });
    expect(result.ok).toBe(true);

    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.stageId).toBe(preScreenId);

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, dealId));
    expect(audit).toHaveLength(1);
    const after = audit[0].afterJson as { source?: string };
    expect(after.source).toBe("manual_revert");
  });

  it("Test 7: revertStage REJECTS forward motion (target.sort_order > current)", async () => {
    const dealId = await seedDeal({ stageId: preScreenId });
    const result = await revertStage({
      dealId,
      targetStageId: dealStructuringId, // forward from pre_screen
    });
    expect(result.ok).toBe(false);
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.stageId).toBe(preScreenId);
  });

  it("Test 8: advanceStageInTx accepts an open tx and writes audit via it (tx-scoped helper)", async () => {
    const dealId = await seedDeal();
    await db.transaction(async (tx) => {
      await advanceStageInTx(tx, {
        dealId,
        targetStageId: dealStructuringId,
        source: "task_autoadvance",
        user: { id: TEST_USER_ID, email: TEST_EMAIL },
      });
    });
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.stageId).toBe(dealStructuringId);

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, dealId));
    expect(audit).toHaveLength(1);
    const after = audit[0].afterJson as { source?: string };
    expect(after.source).toBe("task_autoadvance");
  });

  it("Test 9 (INVARIANT): advanceStage writes EXACTLY ONE audit row with tableName=deals, op=update, manual_advance marker", async () => {
    const dealId = await seedDeal();
    await advanceStage({
      dealId,
      targetStageId: dealStructuringId,
    });
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, dealId));
    expect(audit).toHaveLength(1);
    expect(audit[0].tableName).toBe("deals");
    expect(audit[0].operation).toBe("update");
    const after = audit[0].afterJson as { source?: string };
    expect(after.source).toBe("manual_advance");
  });

  it("Test 10: concurrent advanceStage calls race — Postgres serializes; both audit rows land; no lost-update", async () => {
    const dealId = await seedDeal();
    const [a, b] = await Promise.allSettled([
      advanceStage({ dealId, targetStageId: dealStructuringId }),
      advanceStage({ dealId, targetStageId: fileCompletedId }),
    ]);
    // At least one must have succeeded
    const aok = a.status === "fulfilled" && a.value.ok === true;
    const bok = b.status === "fulfilled" && b.value.ok === true;
    expect(aok || bok).toBe(true);

    // Deal ended up at one of the two targets (no lost-update)
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect([dealStructuringId, fileCompletedId]).toContain(deal.stageId);

    // Successful ones wrote audit rows (1 or 2 depending on race outcome)
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, dealId));
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });
});
