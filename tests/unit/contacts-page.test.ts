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
 * Phase 3 Plan 05 Task 3 — /contacts page integration test.
 *
 * Exercises the query-layer contract that drives the /contacts page:
 *   1. Module loads cleanly (app/contacts/page.tsx imports resolve)
 *   2. queryContactsForList() returns 3 seeded contacts with correct counts
 *   3. activeDealsCount=1 for the contact attached to an active deal
 *   4. Other contacts have activeDealsCount=0
 *   5. Search("alic") narrows result set
 *   6. Search("zzznomatch") returns empty — drives empty-state-B in the page
 *
 * NOTE ON TEST LOCATION: project convention places DB-touching tests at
 * tests/unit/*.test.ts (vitest.config.ts include glob is tests/unit/**).
 * The plan text referred to tests/integration/ — that path would be orphaned
 * by the runner. Same Rule-3 deviation as Plans 03-03 and 03-04.
 */

process.env.DATABASE_URL ??= "postgres://npr:npr@localhost:5432/npr_dashboard";
process.env.CF_ACCESS_TEAM_DOMAIN ??= "test.cloudflareaccess.com";
process.env.CF_ACCESS_AUD ??= "a".repeat(64);
process.env.NEXT_PUBLIC_APP_NAME ??= "NPR Dashboard";
process.env.NEXT_PUBLIC_APP_DOMAIN ??= "portal.utstitle.com";

const TEST_EMAIL = "test+contacts-page@example.com";
let TEST_USER_ID: string;

describe("/contacts page integration", () => {
  let db: typeof import("@/lib/db").db;
  let queryContactsForList: typeof import("@/lib/contacts-query").queryContactsForList;
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
        .values({ email: TEST_EMAIL, name: "Contacts-Page Test User" })
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

    const [te] = await db.select().from(tracks).where(eq(tracks.code, "TE"));
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

  async function seed3Contacts() {
    const [alice] = await db
      .insert(contacts)
      .values({
        fullName: "Alice Page-Test",
        email: "alice+pagetest@example.com",
        org: "Baker & Co",
        createdBy: TEST_USER_ID,
      })
      .returning();

    const [bob] = await db
      .insert(contacts)
      .values({
        fullName: "Bob Page-Test",
        email: "bob+pagetest@example.com",
        org: "Carver Holdings",
        createdBy: TEST_USER_ID,
      })
      .returning();

    const [charlie] = await db
      .insert(contacts)
      .values({
        fullName: "Charlie Page-Test",
        email: "charlie+pagetest@example.com",
        org: "Davis Corp",
        createdBy: TEST_USER_ID,
      })
      .returning();

    return { alice, bob, charlie };
  }

  async function seedActiveDeal(): Promise<string> {
    const [inserted] = await db
      .insert(deals)
      .values({
        trackId: teTrackId,
        stageId: preScreenId,
        fileNo: `XX-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "Contacts-page test deal",
        priority: "MEDIUM",
        status: "active",
        createdBy: TEST_USER_ID,
        internalOwner: TEST_USER_ID,
      })
      .returning();
    return inserted.id;
  }

  it("Test 1: app/contacts/page.tsx module loads cleanly", async () => {
    // Importing the page as a module proves its imports resolve end-to-end.
    // Actual rendering requires a Next.js request context — not tested here.
    const mod = await import("@/app/contacts/page");
    expect(typeof mod.default).toBe("function");
  });

  it("Test 2: 3 seeded contacts -> queryContactsForList returns 3 with activeDealsCount=0", async () => {
    const { alice, bob, charlie } = await seed3Contacts();
    const rows = await queryContactsForList();
    const mine = rows.filter((r) =>
      [alice.id, bob.id, charlie.id].includes(r.id),
    );
    expect(mine).toHaveLength(3);
    for (const r of mine) expect(r.activeDealsCount).toBe(0);
  });

  it("Test 3: contactA attached to active deal -> activeDealsCount=1", async () => {
    const { alice } = await seed3Contacts();
    const dealId = await seedActiveDeal();
    await db.insert(dealPeople).values({
      dealId,
      contactId: alice.id,
      role: "main_contact",
      createdBy: TEST_USER_ID,
    });

    const rows = await queryContactsForList();
    const aliceRow = rows.find((r) => r.id === alice.id);
    expect(aliceRow?.activeDealsCount).toBe(1);
  });

  it("Test 4: contacts without deal_people rows -> activeDealsCount=0", async () => {
    const { alice, bob, charlie } = await seed3Contacts();
    const dealId = await seedActiveDeal();
    await db.insert(dealPeople).values({
      dealId,
      contactId: alice.id,
      role: "main_contact",
      createdBy: TEST_USER_ID,
    });

    const rows = await queryContactsForList();
    const bobRow = rows.find((r) => r.id === bob.id);
    const charlieRow = rows.find((r) => r.id === charlie.id);
    expect(bobRow?.activeDealsCount).toBe(0);
    expect(charlieRow?.activeDealsCount).toBe(0);
  });

  it("Test 5: search 'alic' narrows to Alice only (case-insensitive prefix of full_name)", async () => {
    const { alice } = await seed3Contacts();
    const rows = await queryContactsForList("alic");
    const mineIds = rows
      .filter((r) => r.id === alice.id)
      .map((r) => r.id);
    expect(mineIds).toContain(alice.id);
    // Bob and Charlie must NOT be in the results for this query
    const rowIds = rows.map((r) => r.id);
    const { bob, charlie } = await (async () => {
      const [b] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.email, "bob+pagetest@example.com"));
      const [c] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.email, "charlie+pagetest@example.com"));
      return { bob: b, charlie: c };
    })();
    expect(rowIds).not.toContain(bob.id);
    expect(rowIds).not.toContain(charlie.id);
  });

  it("Test 6: search 'zzznomatch' -> 0 seeded rows (drives empty-state-B)", async () => {
    const { alice, bob, charlie } = await seed3Contacts();
    const rows = await queryContactsForList("zzznomatch");
    const mine = rows.filter((r) =>
      [alice.id, bob.id, charlie.id].includes(r.id),
    );
    expect(mine).toHaveLength(0);
  });
});
