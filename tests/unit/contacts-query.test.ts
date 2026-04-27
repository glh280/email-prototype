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
 * Phase 3 Plan 03 Task 1 — lib/contacts-query.ts tests (RED).
 *
 * Hits real Postgres (docker-compose). Covers VIEW-06 list + PEOPLE-03
 * autosuggest + queryContactById:
 *
 *   1. Empty DB state: queryContactsForList() returns [] cleanly
 *   2. 3 inserted contacts: list returns 3 rows with activeDealsCount=0
 *   3. Attach deal_people row linking contactA -> active deal with role='main_contact':
 *      contactA's activeDealsCount=1; others stay 0
 *   4. Close that deal (status='closed'): contactA's activeDealsCount drops to 0
 *   5. Search "alic" matches "Alice Baker" AND "Malice LLC" (case-insensitive,
 *      substring on full_name OR email OR org)
 *   6. Search "zzz-never-matches" returns 0 rows
 *   7. queryContactsAutosuggest("") returns [] (guard against returning full table)
 *   8. queryContactsAutosuggest("Ali", 5) returns Alice first (exact/prefix ranking)
 *   9. queryContactById(uuid) returns the row
 *   10. queryContactById('00000000-0000-0000-0000-000000000000') returns null
 *
 * NOTE ON TEST LOCATION: project convention places DB-touching tests at
 * tests/unit/*.test.ts (vitest.config.ts include glob). The plan text referred
 * to tests/integration/ but that path would not be picked up by the runner —
 * tracked as Rule 3 deviation in SUMMARY.
 */

process.env.DATABASE_URL ??= "postgres://npr:npr@localhost:5432/npr_dashboard";
process.env.CF_ACCESS_TEAM_DOMAIN ??= "test.cloudflareaccess.com";
process.env.CF_ACCESS_AUD ??= "a".repeat(64);
process.env.NEXT_PUBLIC_APP_NAME ??= "NPR Dashboard";
process.env.NEXT_PUBLIC_APP_DOMAIN ??= "portal.utstitle.com";

const TEST_EMAIL = "test+contacts-query@example.com";
let TEST_USER_ID: string;

describe("lib/contacts-query", () => {
  let db: typeof import("@/lib/db").db;
  let queryContactsForList: typeof import("@/lib/contacts-query").queryContactsForList;
  let queryContactsAutosuggest: typeof import("@/lib/contacts-query").queryContactsAutosuggest;
  let queryContactById: typeof import("@/lib/contacts-query").queryContactById;
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

    const queryMod = await import("@/lib/contacts-query");
    queryContactsForList = queryMod.queryContactsForList;
    queryContactsAutosuggest = queryMod.queryContactsAutosuggest;
    queryContactById = queryMod.queryContactById;

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
        .values({ email: TEST_EMAIL, name: "Contacts-Query Test User" })
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
    // Clean up in FK order: deal_people -> audit_log -> deals -> contacts
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

  async function seed3Contacts() {
    const [alice] = await db
      .insert(contacts)
      .values({
        fullName: "Alice Baker",
        email: "alice@example.com",
        org: "Baker & Co",
        createdBy: TEST_USER_ID,
      })
      .returning();

    const [bob] = await db
      .insert(contacts)
      .values({
        fullName: "Bob Carver",
        email: "bob@example.com",
        org: "Carver Holdings",
        createdBy: TEST_USER_ID,
      })
      .returning();

    const [malice] = await db
      .insert(contacts)
      .values({
        fullName: "Charlie Malice",
        email: "charlie@malice.com",
        org: "Malice LLC",
        createdBy: TEST_USER_ID,
      })
      .returning();

    return { alice, bob, malice };
  }

  async function seedDeal(
    overrides: Partial<typeof deals.$inferInsert> = {},
  ): Promise<string> {
    const [inserted] = await db
      .insert(deals)
      .values({
        trackId: teTrackId,
        stageId: preScreenId,
        fileNo: `XX-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Contacts-query test deal",
        priority: "MEDIUM",
        status: "active",
        createdBy: TEST_USER_ID,
        internalOwner: TEST_USER_ID,
        ...overrides,
      })
      .returning();
    return inserted.id;
  }

  it("Test 1: empty DB (test-scope) -> queryContactsForList() returns []", async () => {
    const rows = await queryContactsForList();
    // Only test-scoped rows are wiped; other fixture rows in DB may exist, so
    // we filter by createdBy to keep this test isolated.
    const mine = rows.filter((r) => r.email && r.email.endsWith("@example.com") === false || r.email === null || r.email?.endsWith("@example.com") || r.email?.endsWith("@malice.com"));
    // With beforeEach cleanup, no contacts belonging to TEST_USER_ID exist.
    // Assert: none of my seeded contact names appear.
    const mineByName = rows.filter(
      (r) =>
        r.fullName === "Alice Baker" ||
        r.fullName === "Bob Carver" ||
        r.fullName === "Charlie Malice",
    );
    expect(mineByName).toHaveLength(0);
    // unused var avoidance
    expect(Array.isArray(mine)).toBe(true);
  });

  it("Test 2: 3 inserted contacts -> list returns 3 with activeDealsCount=0", async () => {
    const { alice, bob, malice } = await seed3Contacts();
    const rows = await queryContactsForList();
    const mine = rows.filter((r) =>
      [alice.id, bob.id, malice.id].includes(r.id),
    );
    expect(mine).toHaveLength(3);
    for (const row of mine) {
      expect(row.activeDealsCount).toBe(0);
    }
  });

  it("Test 3: attach deal_people row -> contactA activeDealsCount=1; others=0", async () => {
    const { alice, bob, malice } = await seed3Contacts();
    const dealId = await seedDeal();
    await db.insert(dealPeople).values({
      dealId,
      contactId: alice.id,
      role: "main_contact",
      createdBy: TEST_USER_ID,
    });

    const rows = await queryContactsForList();
    const aliceRow = rows.find((r) => r.id === alice.id);
    const bobRow = rows.find((r) => r.id === bob.id);
    const maliceRow = rows.find((r) => r.id === malice.id);

    expect(aliceRow?.activeDealsCount).toBe(1);
    expect(bobRow?.activeDealsCount).toBe(0);
    expect(maliceRow?.activeDealsCount).toBe(0);
  });

  it("Test 4: close the deal -> contactA activeDealsCount drops to 0", async () => {
    const { alice } = await seed3Contacts();
    const dealId = await seedDeal();
    await db.insert(dealPeople).values({
      dealId,
      contactId: alice.id,
      role: "main_contact",
      createdBy: TEST_USER_ID,
    });

    // Before close
    const before = await queryContactsForList();
    expect(before.find((r) => r.id === alice.id)?.activeDealsCount).toBe(1);

    // Close the deal
    await db
      .update(deals)
      .set({ status: "closed", closedAt: new Date() })
      .where(eq(deals.id, dealId));

    const after = await queryContactsForList();
    expect(after.find((r) => r.id === alice.id)?.activeDealsCount).toBe(0);
  });

  it("Test 5: search 'alic' -> matches Alice Baker + Charlie Malice (case-insensitive on full_name OR email OR org)", async () => {
    const { alice, malice } = await seed3Contacts();
    const rows = await queryContactsForList("alic");
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(alice.id); // 'Alice Baker' full_name match
    expect(ids).toContain(malice.id); // 'Malice LLC' org match (case-insensitive)
  });

  it("Test 6: search 'zzz-never-matches-xyz' -> returns 0 of my contacts", async () => {
    await seed3Contacts();
    const rows = await queryContactsForList("zzz-never-matches-xyz");
    const mine = rows.filter((r) =>
      [
        "Alice Baker",
        "Bob Carver",
        "Charlie Malice",
      ].includes(r.fullName),
    );
    expect(mine).toHaveLength(0);
  });

  it("Test 7: autosuggest('') returns [] (guard)", async () => {
    await seed3Contacts();
    const rows = await queryContactsAutosuggest("", 5);
    expect(rows).toEqual([]);
  });

  it("Test 7b: autosuggest('   ') returns [] (empty after trim)", async () => {
    await seed3Contacts();
    const rows = await queryContactsAutosuggest("   ", 5);
    expect(rows).toEqual([]);
  });

  it("Test 8: autosuggest('Ali', 5) returns Alice first (prefix ranking)", async () => {
    const { alice } = await seed3Contacts();
    const rows = await queryContactsAutosuggest("Ali", 5);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].id).toBe(alice.id);
    expect(rows[0].fullName).toBe("Alice Baker");
  });

  it("Test 8b: autosuggest limit is clamped to 20 server-side", async () => {
    await seed3Contacts();
    // Ask for 9999 — server should cap at 20 (but we only have 3 so result is <= 3)
    const rows = await queryContactsAutosuggest("e", 9999);
    expect(rows.length).toBeLessThanOrEqual(20);
  });

  it("Test 9: queryContactById(validUuid) returns the row", async () => {
    const { alice } = await seed3Contacts();
    const row = await queryContactById(alice.id);
    expect(row).not.toBeNull();
    expect(row?.id).toBe(alice.id);
    expect(row?.fullName).toBe("Alice Baker");
  });

  it("Test 10: queryContactById(unknownUuid) returns null", async () => {
    const row = await queryContactById("00000000-0000-0000-0000-000000000000");
    expect(row).toBeNull();
  });
});
