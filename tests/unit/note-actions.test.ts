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
 * Phase 2 Plan 06 Task 1 — createNote Server Action tests.
 *
 * Hits real Postgres. Mirrors deal-actions.test.ts harness.
 *
 * Shape (4 behaviors):
 *   1. createNote happy path: row inserted with is_system=false;
 *      audit row written with operation='create' and table_name='deal_notes'
 *   2. Validation failure (empty body) → {ok:false, errors}; NO DB change
 *   3. Transactional rollback: if writeAuditLog throws,
 *      the note row does NOT exist after (same invariant as Plan 04 Test 9)
 *   4. createNote with body containing 5001 chars → {ok:false, errors}
 */

process.env.DATABASE_URL ??= "postgres://npr:npr@localhost:5432/npr_dashboard";
process.env.CF_ACCESS_TEAM_DOMAIN ??= "test.cloudflareaccess.com";
process.env.CF_ACCESS_AUD ??= "a".repeat(64);
process.env.NEXT_PUBLIC_APP_NAME ??= "NPR Dashboard";
process.env.NEXT_PUBLIC_APP_DOMAIN ??= "portal.utstitle.com";

const TEST_EMAIL = "test+note-actions@example.com";
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

describe("createNote server action", () => {
  let db: typeof import("@/lib/db").db;
  let createNote: typeof import("@/app/deal/[id]/actions/notes").createNote;
  let deals: typeof import("@/db/schema").deals;
  let auditLog: typeof import("@/db/schema").auditLog;
  let dealNotes: typeof import("@/db/schema").dealNotes;
  let stages: typeof import("@/db/schema").stages;
  let tracks: typeof import("@/db/schema").tracks;
  let users: typeof import("@/db/schema").users;

  let preScreenId: string;
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

    const actionsMod = await import("@/app/deal/[id]/actions/notes");
    createNote = actionsMod.createNote;

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
        .values({ email: TEST_EMAIL, name: "Note Test User" })
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

  async function seedDeal(): Promise<string> {
    const [inserted] = await db
      .insert(deals)
      .values({
        trackId: teTrackId,
        stageId: preScreenId,
        fileNo: `XX-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Note-actions test deal",
        priority: "MEDIUM",
        status: "active",
        createdBy: TEST_USER_ID,
        internalOwner: TEST_USER_ID,
      })
      .returning();
    return inserted.id;
  }

  it("Test 1: createNote happy path — row inserted is_system=false; audit row operation='create'", async () => {
    const dealId = await seedDeal();
    const result = await createNote({
      dealId,
      body: "Closing pushed back to May 3.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const notes = await db
      .select()
      .from(dealNotes)
      .where(eq(dealNotes.dealId, dealId));
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe("Closing pushed back to May 3.");
    expect(notes[0].isSystem).toBe(false);
    expect(notes[0].createdBy).toBe(TEST_USER_ID);

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, notes[0].id));
    expect(audit).toHaveLength(1);
    expect(audit[0].tableName).toBe("deal_notes");
    expect(audit[0].operation).toBe("create");
    expect(audit[0].beforeJson).toBeNull();
    const after = audit[0].afterJson as { body?: string; is_system?: boolean };
    expect(after.body).toBe("Closing pushed back to May 3.");
  });

  it("Test 2: createNote rejects empty body; NO DB change", async () => {
    const dealId = await seedDeal();
    const result = await createNote({ dealId, body: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect("errors" in result).toBe(true);
    if (!("errors" in result)) return;
    expect(result.errors.body).toBeDefined();

    const notes = await db
      .select()
      .from(dealNotes)
      .where(eq(dealNotes.dealId, dealId));
    expect(notes).toHaveLength(0);

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    expect(audit).toHaveLength(0);
  });

  it("Test 3 (INVARIANT): createNote rollback — if writeAuditLog throws, note row does NOT exist", async () => {
    vi.resetModules();
    vi.doMock("@/lib/audit", () => ({
      writeAuditLog: vi.fn(async () => {
        throw new Error("boom — simulated audit failure during createNote");
      }),
    }));

    const freshDb = (await import("@/lib/db")).db;
    const freshSchema = await import("@/db/schema");
    const { createNote: freshCreateNote } = await import(
      "@/app/deal/[id]/actions/notes"
    );

    const [freshDeal] = await freshDb
      .insert(freshSchema.deals)
      .values({
        trackId: teTrackId,
        stageId: preScreenId,
        fileNo: `XX-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Note rollback test deal",
        priority: "MEDIUM",
        status: "active",
        createdBy: TEST_USER_ID,
        internalOwner: TEST_USER_ID,
      })
      .returning();

    const result = await freshCreateNote({
      dealId: freshDeal.id,
      body: "Should not persist.",
    });

    if (result && typeof result === "object" && "ok" in result) {
      expect(result.ok).toBe(false);
    }

    // NO note row should exist — tx rolled back
    const notes = await freshDb
      .select()
      .from(freshSchema.dealNotes)
      .where(eq(freshSchema.dealNotes.dealId, freshDeal.id));
    expect(notes).toHaveLength(0);

    vi.doUnmock("@/lib/audit");
    vi.resetModules();
  });

  it("Test 4: createNote rejects body > 5000 chars", async () => {
    const dealId = await seedDeal();
    const longBody = "x".repeat(5001);
    const result = await createNote({ dealId, body: longBody });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect("errors" in result).toBe(true);
    if (!("errors" in result)) return;
    expect(result.errors.body).toBeDefined();

    const notes = await db
      .select()
      .from(dealNotes)
      .where(eq(dealNotes.dealId, dealId));
    expect(notes).toHaveLength(0);
  });
});
