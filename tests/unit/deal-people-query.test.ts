import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
import { sql, eq, and, isNull } from "drizzle-orm";

/**
 * Phase 3 Plan 03 Task 2 — lib/deal-people-query.ts tests (RED).
 *
 * Hits real Postgres. Covers the per-deal File Contacts tab read primitive
 * (PEOPLE-04 / VIEW-05 deal-detail integration):
 *
 *   1. queryDealPeopleForDeal(unknownDealId) returns []
 *   2. 2 inserted deal_people rows (one contact_fk, one contact-less) ->
 *      returns 2 rows with joined contact fields populated only for the fk row
 *   3. ORDER BY role ASC is deterministic
 *   4. SET NULL cascade: after DELETE FROM contacts, the deal_people row
 *      survives and contactFullName becomes null
 *
 * Test location: tests/unit/ per project vitest.config.ts include glob.
 */

process.env.DATABASE_URL ??= "postgres://npr:npr@localhost:5432/npr_dashboard";
process.env.CF_ACCESS_TEAM_DOMAIN ??= "test.cloudflareaccess.com";
process.env.CF_ACCESS_AUD ??= "a".repeat(64);
process.env.NEXT_PUBLIC_APP_NAME ??= "NPR Dashboard";
process.env.NEXT_PUBLIC_APP_DOMAIN ??= "portal.utstitle.com";

const TEST_EMAIL = "test+deal-people-query@example.com";
let TEST_USER_ID: string;

describe("lib/deal-people-query", () => {
  let db: typeof import("@/lib/db").db;
  let queryDealPeopleForDeal: typeof import("@/lib/deal-people-query").queryDealPeopleForDeal;
  let contacts: typeof import("@/db/schema").contacts;
  let dealPeople: typeof import("@/db/schema").dealPeople;
  let deals: typeof import("@/db/schema").deals;
  let stages: typeof import("@/db/schema").stages;
  let tracks: typeof import("@/db/schema").tracks;
  let users: typeof import("@/db/schema").users;

  let preScreenId: string;
  let teTrackId: string;

  beforeAll(async () => {
    const dbMod = await import("@/lib/db");
    db = dbMod.db;
    const schemaMod = await import("@/db/schema");
    contacts = schemaMod.contacts;
    dealPeople = schemaMod.dealPeople;
    deals = schemaMod.deals;
    stages = schemaMod.stages;
    tracks = schemaMod.tracks;
    users = schemaMod.users;

    const queryMod = await import("@/lib/deal-people-query");
    queryDealPeopleForDeal = queryMod.queryDealPeopleForDeal;

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
        .values({ email: TEST_EMAIL, name: "Deal-People Test User" })
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
      sql`DELETE FROM deal_people WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(
      sql`DELETE FROM audit_log WHERE user_email = ${TEST_EMAIL}`,
    );
    await db.execute(
      sql`DELETE FROM deal_notes WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(sql`DELETE FROM deals WHERE created_by = ${TEST_USER_ID}`);
    await db.execute(
      sql`DELETE FROM contacts WHERE created_by = ${TEST_USER_ID}`,
    );
  });

  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM deal_people WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(
      sql`DELETE FROM audit_log WHERE user_email = ${TEST_EMAIL}`,
    );
    await db.execute(
      sql`DELETE FROM deal_notes WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(sql`DELETE FROM deals WHERE created_by = ${TEST_USER_ID}`);
    await db.execute(
      sql`DELETE FROM contacts WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(sql`DELETE FROM users WHERE email = ${TEST_EMAIL}`);
  });

  async function seedDeal(): Promise<string> {
    const [inserted] = await db
      .insert(deals)
      .values({
        trackId: teTrackId,
        stageId: preScreenId,
        fileNo: `XX-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Deal-people-query test deal",
        priority: "MEDIUM",
        status: "active",
        createdBy: TEST_USER_ID,
        internalOwner: TEST_USER_ID,
      })
      .returning();
    return inserted.id;
  }

  async function seedContact(fullName: string, overrides: Partial<typeof contacts.$inferInsert> = {}) {
    const [inserted] = await db
      .insert(contacts)
      .values({
        fullName,
        createdBy: TEST_USER_ID,
        ...overrides,
      })
      .returning();
    return inserted;
  }

  it("Test 1: queryDealPeopleForDeal(unknownDealId) returns []", async () => {
    const rows = await queryDealPeopleForDeal(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(rows).toEqual([]);
  });

  it("Test 2: 2 inserted rows (one FK, one contact-less) -> 2 rows with correct joined fields", async () => {
    const dealId = await seedDeal();
    const alice = await seedContact("Alice Baker", {
      email: "alice@example.com",
      org: "Baker & Co",
    });

    await db.insert(dealPeople).values({
      dealId,
      contactId: alice.id,
      role: "main_contact",
      createdBy: TEST_USER_ID,
    });
    await db.insert(dealPeople).values({
      dealId,
      contactId: null,
      role: "lender_partner",
      createdBy: TEST_USER_ID,
    });

    const rows = await queryDealPeopleForDeal(dealId);
    expect(rows).toHaveLength(2);

    const mainRow = rows.find((r) => r.role === "main_contact");
    const lenderRow = rows.find((r) => r.role === "lender_partner");

    expect(mainRow).toBeDefined();
    expect(mainRow?.contactId).toBe(alice.id);
    expect(mainRow?.contactFullName).toBe("Alice Baker");
    expect(mainRow?.contactEmail).toBe("alice@example.com");
    expect(mainRow?.contactOrg).toBe("Baker & Co");

    expect(lenderRow).toBeDefined();
    expect(lenderRow?.contactId).toBeNull();
    expect(lenderRow?.contactFullName).toBeNull();
    expect(lenderRow?.contactEmail).toBeNull();
    expect(lenderRow?.contactOrg).toBeNull();
  });

  it("Test 3: ORDER BY role ASC is deterministic", async () => {
    const dealId = await seedDeal();
    const alice = await seedContact("Alice Baker");
    const bob = await seedContact("Bob Carver");
    const carol = await seedContact("Carol Dunn");

    // Insert in non-alphabetical role order
    await db.insert(dealPeople).values({
      dealId,
      contactId: carol.id,
      role: "seller",
      createdBy: TEST_USER_ID,
    });
    await db.insert(dealPeople).values({
      dealId,
      contactId: alice.id,
      role: "main_contact",
      createdBy: TEST_USER_ID,
    });
    await db.insert(dealPeople).values({
      dealId,
      contactId: bob.id,
      role: "borrower",
      createdBy: TEST_USER_ID,
    });

    const rows = await queryDealPeopleForDeal(dealId);
    // ASC on role: borrower < main_contact < seller
    expect(rows.map((r) => r.role)).toEqual([
      "borrower",
      "main_contact",
      "seller",
    ]);
  });

  it("Test 4: SET NULL cascade — after DELETE FROM contacts, deal_people row survives and contactFullName is null", async () => {
    const dealId = await seedDeal();
    const alice = await seedContact("Alice Baker", {
      email: "alice@example.com",
    });

    await db.insert(dealPeople).values({
      dealId,
      contactId: alice.id,
      role: "main_contact",
      createdBy: TEST_USER_ID,
    });

    // Before delete: contactFullName is populated
    const before = await queryDealPeopleForDeal(dealId);
    expect(before).toHaveLength(1);
    expect(before[0].contactFullName).toBe("Alice Baker");
    expect(before[0].contactId).toBe(alice.id);

    // Delete the contact — FK SET NULL should preserve the deal_people row
    await db.execute(sql`DELETE FROM contacts WHERE id = ${alice.id}`);

    const after = await queryDealPeopleForDeal(dealId);
    expect(after).toHaveLength(1);
    expect(after[0].role).toBe("main_contact");
    expect(after[0].contactId).toBeNull();
    expect(after[0].contactFullName).toBeNull();
    expect(after[0].contactEmail).toBeNull();
    expect(after[0].contactOrg).toBeNull();
  });
});
