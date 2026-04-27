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
 * Phase 3 Plan 04 Task 2 — upsertDealPerson + removeDealPerson Server Action tests.
 *
 * Hits real Postgres. Mirrors note-actions.test.ts harness.
 *
 * NOTE on test location: vitest.config.ts restricts discovery to
 * `tests/unit/**\/*.test.ts` — same decision as Plan 03-03 and Plan 04 Task 1.
 *
 * Shape (12 behaviors — from plan §Tests):
 *   1. upsertDealPerson happy INSERT — row exists, audit op='create' source='deal_people_upsert'
 *   2. Second upsert for same (deal_id, role) — UPDATE not duplicate, audit op='update', contact_id changes
 *   3. PEOPLE-05: role-invalid-for-track — {ok:false, error:/not valid for GI/}, no row
 *   4. Unknown role at Zod → {ok:false, errors}
 *   5. contact_fk slot missing contactId → {ok:false, errors:{contactId}}
 *   6. lender_partner happy — minimal contact row created + wired + ok:true
 *   7. lender_partner missing freeTextValue → {ok:false, errors:{freeTextValue}}
 *   8. ROLLBACK INVARIANT — audit throw leaves NO deal_people row
 *   9. removeDealPerson happy — row deleted, audit op='delete' source='deal_people_remove'
 *  10. removeDealPerson idempotent (slot absent) — {ok:true, noop:true}, NO new audit
 *  11. removeDealPerson unknown role rejected at Zod → {ok:false, errors}
 *  12. Data-integrity across 3 slots + 1 remove — exactly 2 rows remain, unique per slot
 */

process.env.DATABASE_URL ??= "postgres://npr:npr@localhost:5432/npr_dashboard";
process.env.CF_ACCESS_TEAM_DOMAIN ??= "test.cloudflareaccess.com";
process.env.CF_ACCESS_AUD ??= "a".repeat(64);
process.env.NEXT_PUBLIC_APP_NAME ??= "NPR Dashboard";
process.env.NEXT_PUBLIC_APP_DOMAIN ??= "portal.utstitle.com";

const TEST_EMAIL = "test+deal-people-actions@example.com";
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

describe("upsertDealPerson + removeDealPerson server actions", () => {
  let db: typeof import("@/lib/db").db;
  let actions: typeof import("@/app/deal/[id]/actions/people");
  let deals: typeof import("@/db/schema").deals;
  let dealPeople: typeof import("@/db/schema").dealPeople;
  let contacts: typeof import("@/db/schema").contacts;
  let auditLog: typeof import("@/db/schema").auditLog;
  let stages: typeof import("@/db/schema").stages;
  let tracks: typeof import("@/db/schema").tracks;
  let users: typeof import("@/db/schema").users;

  let preScreenId: string;
  let teTrackId: string;
  let giTrackId: string;

  beforeAll(async () => {
    const dbMod = await import("@/lib/db");
    db = dbMod.db;
    const schemaMod = await import("@/db/schema");
    deals = schemaMod.deals;
    dealPeople = schemaMod.dealPeople;
    contacts = schemaMod.contacts;
    auditLog = schemaMod.auditLog;
    stages = schemaMod.stages;
    tracks = schemaMod.tracks;
    users = schemaMod.users;

    actions = await import("@/app/deal/[id]/actions/people");

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
        .values({ email: TEST_EMAIL, name: "Deal People Test User" })
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

    const [gi] = await db
      .select()
      .from(tracks)
      .where(eq(tracks.code, "GI"));
    giTrackId = gi.id;
  });

  async function cleanupTestData() {
    // Delete deal_people first (FK to deals + contacts)
    await db.execute(
      sql`DELETE FROM deal_people WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(
      sql`DELETE FROM audit_log WHERE user_email = ${TEST_EMAIL}`,
    );
    await db.execute(sql`DELETE FROM deals WHERE created_by = ${TEST_USER_ID}`);
    await db.execute(
      sql`DELETE FROM contacts WHERE created_by = ${TEST_USER_ID}`,
    );
  }

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await db.execute(sql`DELETE FROM users WHERE email = ${TEST_EMAIL}`);
  });

  async function seedDeal(trackId: string = teTrackId): Promise<string> {
    const [inserted] = await db
      .insert(deals)
      .values({
        trackId,
        stageId: preScreenId,
        fileNo: `XX-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Deal-people test deal",
        priority: "MEDIUM",
        status: "active",
        createdBy: TEST_USER_ID,
        internalOwner: TEST_USER_ID,
      })
      .returning();
    return inserted.id;
  }

  async function seedContact(fullName = "Test Contact"): Promise<string> {
    const [inserted] = await db
      .insert(contacts)
      .values({
        fullName,
        createdBy: TEST_USER_ID,
      })
      .returning();
    return inserted.id;
  }

  it("Test 1: upsertDealPerson happy INSERT — row + audit create source='deal_people_upsert'", async () => {
    const dealId = await seedDeal();
    const contactId = await seedContact("Alice Main");

    const result = await actions.upsertDealPerson({
      dealId,
      role: "main_contact",
      contactId,
    });
    expect(result.ok).toBe(true);

    const rows = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.dealId, dealId));
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("main_contact");
    expect(rows[0].contactId).toBe(contactId);

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, rows[0].id));
    expect(audit).toHaveLength(1);
    expect(audit[0].tableName).toBe("deal_people");
    expect(audit[0].operation).toBe("create");
    const after = audit[0].afterJson as { source?: string };
    expect(after.source).toBe("deal_people_upsert");
  });

  it("Test 2: second upsert same slot — UPDATE, not duplicate, contact_id changes", async () => {
    const dealId = await seedDeal();
    const contact1 = await seedContact("First Contact");
    const contact2 = await seedContact("Second Contact");

    const r1 = await actions.upsertDealPerson({
      dealId,
      role: "main_contact",
      contactId: contact1,
    });
    expect(r1.ok).toBe(true);

    const r2 = await actions.upsertDealPerson({
      dealId,
      role: "main_contact",
      contactId: contact2,
    });
    expect(r2.ok).toBe(true);

    const rows = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.dealId, dealId));
    expect(rows).toHaveLength(1);
    expect(rows[0].contactId).toBe(contact2);

    // Find the update audit — the second call's audit should be operation='update'
    const allAudit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, rows[0].id));
    // At least 2 audits: the first create + second update
    const updateAudit = allAudit.find((a) => a.operation === "update");
    expect(updateAudit).toBeDefined();
    if (!updateAudit) return;
    const before = updateAudit.beforeJson as { contactId?: string; contact_id?: string };
    const after = updateAudit.afterJson as { contactId?: string; contact_id?: string; source?: string };
    const beforeId = before.contactId ?? before.contact_id;
    const afterId = after.contactId ?? after.contact_id;
    expect(beforeId).toBe(contact1);
    expect(afterId).toBe(contact2);
    expect(after.source).toBe("deal_people_upsert");
  });

  it("Test 3 (PEOPLE-05): role invalid for track → {ok:false, error:/not valid for GI/}, no row", async () => {
    const dealId = await seedDeal(giTrackId); // GI track
    const contactId = await seedContact("Nobody");

    // title_partner is TE-only; GI deal should reject it.
    const result = await actions.upsertDealPerson({
      dealId,
      role: "title_partner",
      contactId,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toMatch(/not valid for GI/);

    const rows = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.dealId, dealId));
    expect(rows).toHaveLength(0);
  });

  it("Test 4: unknown role rejected at Zod layer", async () => {
    const dealId = await seedDeal();
    const result = await actions.upsertDealPerson({
      dealId,
      role: "banana",
      contactId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect("errors" in result).toBe(true);
  });

  it("Test 5: contact_fk slot missing contactId → errors:{contactId}", async () => {
    const dealId = await seedDeal();
    const result = await actions.upsertDealPerson({
      dealId,
      role: "main_contact",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect("errors" in result).toBe(true);
    if (!("errors" in result)) return;
    expect(result.errors.contactId).toBeDefined();
  });

  it("Test 6: lender_partner happy — minimal contact row created + wired", async () => {
    const dealId = await seedDeal(
      (await db.select().from(tracks).where(eq(tracks.code, "FL")))[0].id,
    );

    const result = await actions.upsertDealPerson({
      dealId,
      role: "lender_partner",
      freeTextValue: "Wells Fargo",
    });
    expect(result.ok).toBe(true);

    const rows = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.dealId, dealId));
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("lender_partner");
    expect(rows[0].contactId).not.toBeNull();

    if (rows[0].contactId) {
      const [c] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, rows[0].contactId));
      expect(c.fullName).toBe("Wells Fargo");
      expect(c.roleHint).toBe("lender");
    }
  });

  it("Test 7: lender_partner missing freeTextValue → errors:{freeTextValue}", async () => {
    const dealId = await seedDeal(
      (await db.select().from(tracks).where(eq(tracks.code, "FL")))[0].id,
    );

    const result = await actions.upsertDealPerson({
      dealId,
      role: "lender_partner",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect("errors" in result).toBe(true);
    if (!("errors" in result)) return;
    expect(result.errors.freeTextValue).toBeDefined();
  });

  it("Test 8 (INVARIANT): upsertDealPerson rollback — audit throws → NO row", async () => {
    vi.resetModules();
    vi.doMock("@/lib/audit", () => ({
      writeAuditLog: vi.fn(async () => {
        throw new Error("boom — simulated audit failure during upsertDealPerson");
      }),
    }));

    const freshDb = (await import("@/lib/db")).db;
    const freshSchema = await import("@/db/schema");
    const { upsertDealPerson: freshUpsert } = await import(
      "@/app/deal/[id]/actions/people"
    );

    // Seed a deal + contact with the fresh module
    const [pre] = await freshDb
      .select()
      .from(freshSchema.stages)
      .where(
        and(
          eq(freshSchema.stages.code, "pre_screen_qualification"),
          isNull(freshSchema.stages.trackId),
        ),
      );
    const [te] = await freshDb
      .select()
      .from(freshSchema.tracks)
      .where(eq(freshSchema.tracks.code, "TE"));

    const [freshDeal] = await freshDb
      .insert(freshSchema.deals)
      .values({
        trackId: te.id,
        stageId: pre.id,
        fileNo: `XX-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Rollback test deal",
        priority: "MEDIUM",
        status: "active",
        createdBy: TEST_USER_ID,
        internalOwner: TEST_USER_ID,
      })
      .returning();

    const [freshContact] = await freshDb
      .insert(freshSchema.contacts)
      .values({ fullName: "Rollback Contact", createdBy: TEST_USER_ID })
      .returning();

    let threw = false;
    try {
      await freshUpsert({
        dealId: freshDeal.id,
        role: "main_contact",
        contactId: freshContact.id,
      });
    } catch {
      threw = true;
    }
    // Either threw or returned error — OK.

    const rows = await freshDb
      .select()
      .from(freshSchema.dealPeople)
      .where(eq(freshSchema.dealPeople.dealId, freshDeal.id));
    expect(rows).toHaveLength(0);

    // Belt-and-suspenders: the deal row itself is unchanged.
    const [dealAfter] = await freshDb
      .select()
      .from(freshSchema.deals)
      .where(eq(freshSchema.deals.id, freshDeal.id));
    expect(dealAfter.id).toBe(freshDeal.id);

    vi.doUnmock("@/lib/audit");
    vi.resetModules();
    // Silence unused-var warning
    void threw;
  });

  it("Test 9: removeDealPerson happy — row deleted, audit op='delete' source='deal_people_remove'", async () => {
    const dealId = await seedDeal();
    const contactId = await seedContact("To Remove");

    const upsertRes = await actions.upsertDealPerson({
      dealId,
      role: "main_contact",
      contactId,
    });
    expect(upsertRes.ok).toBe(true);

    const removeRes = await actions.removeDealPerson({
      dealId,
      role: "main_contact",
    });
    expect(removeRes.ok).toBe(true);

    const rows = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.dealId, dealId));
    expect(rows).toHaveLength(0);

    // Find the delete audit
    const allAudit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    const deleteAudit = allAudit.find(
      (a) => a.operation === "delete" && a.tableName === "deal_people",
    );
    expect(deleteAudit).toBeDefined();
    if (!deleteAudit) return;
    const after = deleteAudit.afterJson as { source?: string };
    expect(after.source).toBe("deal_people_remove");
  });

  it("Test 10: removeDealPerson idempotent (slot absent) — ok+noop, NO new audit", async () => {
    const dealId = await seedDeal();

    const auditBefore = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    const auditBeforeCount = auditBefore.length;

    const result = await actions.removeDealPerson({
      dealId,
      role: "main_contact",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if ("noop" in result) expect(result.noop).toBe(true);

    const auditAfter = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    expect(auditAfter.length).toBe(auditBeforeCount);
  });

  it("Test 11: removeDealPerson unknown role rejected at Zod", async () => {
    const dealId = await seedDeal();
    const result = await actions.removeDealPerson({
      dealId,
      role: "banana",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect("errors" in result).toBe(true);
  });

  it("Test 12: 3 slots + remove 1 — exactly 2 remain, unique per slot", async () => {
    const dealId = await seedDeal(); // TE
    const c1 = await seedContact("C1");
    const c2 = await seedContact("C2");
    const c3 = await seedContact("C3");

    const r1 = await actions.upsertDealPerson({
      dealId,
      role: "main_contact",
      contactId: c1,
    });
    expect(r1.ok).toBe(true);
    const r2 = await actions.upsertDealPerson({
      dealId,
      role: "directing_agent",
      contactId: c2,
    });
    expect(r2.ok).toBe(true);
    const r3 = await actions.upsertDealPerson({
      dealId,
      role: "title_partner",
      contactId: c3,
    });
    expect(r3.ok).toBe(true);

    let rows = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.dealId, dealId));
    expect(rows).toHaveLength(3);
    const roles = rows.map((r) => r.role).sort();
    expect(new Set(roles).size).toBe(3); // uniqueness per slot

    const rem = await actions.removeDealPerson({
      dealId,
      role: "directing_agent",
    });
    expect(rem.ok).toBe(true);

    rows = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.dealId, dealId));
    expect(rows).toHaveLength(2);
    const remaining = rows.map((r) => r.role).sort();
    expect(remaining).toEqual(["main_contact", "title_partner"]);
  });
});
