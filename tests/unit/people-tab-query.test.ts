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
 * Phase 3 Plan 06 Task 1 — composite data contract for the /deal/[id]
 * File Contacts tab.
 *
 * This test exercises the exact read composition the page assembles for
 * the People tab pane:
 *   - queryDealPeopleForDeal(dealId) returns the per-deal rows
 *   - slotsForTrack(trackCode) returns the applicable slot set
 *   - UI will render one row per slot, looking up by role
 *
 * Covers:
 *   1. TE deal with 2 contacts assigned (main_contact + title_partner) —
 *      queryDealPeopleForDeal returns both, joined fullName populated.
 *   2. slotsForTrack('TE') contains main_contact AND title_partner (sanity).
 *   3. slotsForTrack('GI') does NOT contain title_partner (universal-only).
 *   4. SET NULL cascade survives DELETE FROM contacts — the deal_people
 *      row for main_contact persists with contactFullName=null so the UI
 *      can still render a role-slot-row (will fall back to "Assign" state).
 *
 * Test location: tests/unit/ per vitest.config.ts include glob
 * ("tests/unit/**\/*.test.ts"). Matches precedent from Plans 03-03/04/05.
 */

process.env.DATABASE_URL ??= "postgres://npr:npr@localhost:5432/npr_dashboard";
process.env.CF_ACCESS_TEAM_DOMAIN ??= "test.cloudflareaccess.com";
process.env.CF_ACCESS_AUD ??= "a".repeat(64);
process.env.NEXT_PUBLIC_APP_NAME ??= "NPR Dashboard";
process.env.NEXT_PUBLIC_APP_DOMAIN ??= "portal.utstitle.com";

const TEST_EMAIL = "test+people-tab-query@example.com";
let TEST_USER_ID: string;

describe("people-tab composite query contract", () => {
  let db: typeof import("@/lib/db").db;
  let queryDealPeopleForDeal: typeof import("@/lib/deal-people-query").queryDealPeopleForDeal;
  let slotsForTrack: typeof import("@/lib/role-slots").slotsForTrack;
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
    const slotsMod = await import("@/lib/role-slots");
    slotsForTrack = slotsMod.slotsForTrack;

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
        .values({ email: TEST_EMAIL, name: "People-Tab Query Test User" })
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

  async function seedTEDeal(): Promise<string> {
    const [inserted] = await db
      .insert(deals)
      .values({
        trackId: teTrackId,
        stageId: preScreenId,
        fileNo: `XX-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        title: "People-tab-query test deal",
        priority: "MEDIUM",
        status: "active",
        createdBy: TEST_USER_ID,
        internalOwner: TEST_USER_ID,
      })
      .returning();
    return inserted.id;
  }

  async function seedContact(
    fullName: string,
    overrides: Partial<typeof contacts.$inferInsert> = {},
  ) {
    const [inserted] = await db
      .insert(contacts)
      .values({ fullName, createdBy: TEST_USER_ID, ...overrides })
      .returning();
    return inserted;
  }

  it("Test 1: TE deal with main_contact + title_partner — queryDealPeopleForDeal returns both with joined fullName", async () => {
    const dealId = await seedTEDeal();
    const alice = await seedContact("Alice Baker", {
      email: "alice@example.com",
    });
    const bob = await seedContact("Bob Carver", {
      email: "bob@example.com",
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
      role: "title_partner",
      createdBy: TEST_USER_ID,
    });

    const rows = await queryDealPeopleForDeal(dealId);
    expect(rows).toHaveLength(2);

    const mainRow = rows.find((r) => r.role === "main_contact");
    const titleRow = rows.find((r) => r.role === "title_partner");
    expect(mainRow?.contactFullName).toBe("Alice Baker");
    expect(mainRow?.contactEmail).toBe("alice@example.com");
    expect(titleRow?.contactFullName).toBe("Bob Carver");
  });

  it("Test 2: slotsForTrack('TE') includes main_contact AND title_partner", async () => {
    const slots = slotsForTrack("TE");
    const codes = slots.map((s) => s.code);
    expect(codes).toContain("main_contact");
    expect(codes).toContain("title_partner");
  });

  it("Test 3: slotsForTrack('GI') does NOT include title_partner (universals only)", async () => {
    const slots = slotsForTrack("GI");
    const codes = slots.map((s) => s.code);
    expect(codes).not.toContain("title_partner");
    // Sanity: universals always present
    expect(codes).toContain("directing_agent");
    expect(codes).toContain("main_contact");
    expect(codes).toContain("internal_owner");
  });

  it("Test 4: SET NULL cascade — main_contact row survives DELETE FROM contacts with contactFullName=null", async () => {
    const dealId = await seedTEDeal();
    const alice = await seedContact("Alice Baker", {
      email: "alice@example.com",
    });
    await db.insert(dealPeople).values({
      dealId,
      contactId: alice.id,
      role: "main_contact",
      createdBy: TEST_USER_ID,
    });

    const before = await queryDealPeopleForDeal(dealId);
    expect(before).toHaveLength(1);
    expect(before[0].contactFullName).toBe("Alice Baker");

    await db.execute(sql`DELETE FROM contacts WHERE id = ${alice.id}`);

    const after = await queryDealPeopleForDeal(dealId);
    expect(after).toHaveLength(1);
    expect(after[0].role).toBe("main_contact");
    expect(after[0].contactId).toBeNull();
    expect(after[0].contactFullName).toBeNull();
  });

  it("Test 5: slotsForTrack ordering is stable across calls (UI render determinism)", async () => {
    const a = slotsForTrack("TE").map((s) => s.code);
    const b = slotsForTrack("TE").map((s) => s.code);
    expect(a).toEqual(b);
    // Universals come first in ROLE_SLOTS declaration order:
    expect(a[0]).toBe("directing_agent");
    expect(a[1]).toBe("main_contact");
    expect(a[2]).toBe("internal_owner");
  });
});
