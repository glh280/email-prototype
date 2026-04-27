import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
import { sql, eq } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Phase 3 Plan 07 Task 1 — Migration 0007 backfill integration test.
 *
 * Validates the D-03 backfill:
 *   deals.main_contact_* (legacy P1 text columns) → contacts + deal_people rows.
 *
 * Test strategy (harness-appropriate):
 *   - Migration 0007 has already been applied by the test harness's db:migrate
 *     step. We can't "un-apply" it in vitest — drizzle-kit's migrator is
 *     forward-only.
 *   - Instead, we seed fresh deals with legacy main_contact_* values, then
 *     EXECUTE the migration 0007 SQL DIRECTLY via `db.execute(sql.raw(...))`
 *     simulating a re-run against the freshly-seeded rows. This is exactly
 *     what we need to validate:
 *       1. The SQL produces the expected contacts + deal_people rows.
 *       2. Running the SQL a second time is a no-op (idempotency via ON CONFLICT).
 *   - The migration file is the audit artifact (committed to git);
 *     running its bytes verbatim against a live DB is the contract proof.
 *
 * NOTE on test location: vitest.config.ts restricts discovery to
 * `tests/unit/**\/*.test.ts` — plan text referenced `tests/integration/` but
 * that would orphan the file. Same decision as Plans 03-03/04/05/06.
 *
 * Shape (>= 7 assertions):
 *   1. Pre-migration state: seed 5 deals
 *   2. Run migration: exactly 2 contacts created (2 distinct emails; whitespace
 *      and null excluded)
 *   3. Exactly 3 deal_people rows (role=main_contact) — one per deal with a
 *      real email; the two deals sharing an email share a contact
 *   4. Deal with NULL main_contact_email has NO deal_people row for role=main_contact
 *   5. Deal with whitespace-only main_contact_email has NO row
 *   6. Idempotency: re-run migration — counts UNCHANGED
 *   7. Legacy columns (main_contact_name + main_contact_email) still exist on
 *      deals table (information_schema check — the DROP is deferred to P10)
 *   8. Contacts have role_hint='main_contact (backfill)'
 */

process.env.DATABASE_URL ??= "postgres://npr:npr@localhost:5432/npr_dashboard";
process.env.CF_ACCESS_TEAM_DOMAIN ??= "test.cloudflareaccess.com";
process.env.CF_ACCESS_AUD ??= "a".repeat(64);
process.env.NEXT_PUBLIC_APP_NAME ??= "NPR Dashboard";
process.env.NEXT_PUBLIC_APP_DOMAIN ??= "portal.utstitle.com";

const TEST_EMAIL = "test+backfill-migration@example.com";
let TEST_USER_ID: string;

describe("migration 0007 backfill — deal_people from legacy main_contact_*", () => {
  let db: typeof import("@/lib/db").db;
  let deals: typeof import("@/db/schema").deals;
  let contacts: typeof import("@/db/schema").contacts;
  let dealPeople: typeof import("@/db/schema").dealPeople;
  let tracks: typeof import("@/db/schema").tracks;
  let stages: typeof import("@/db/schema").stages;
  let users: typeof import("@/db/schema").users;

  /**
   * Raw SQL for migration 0007 — read at setup time from the committed file.
   * Splitting on `--> statement-breakpoint` mirrors drizzle's migrator semantics.
   */
  let migrationStatements: string[];

  beforeAll(async () => {
    const dbMod = await import("@/lib/db");
    db = dbMod.db;
    const schemaMod = await import("@/db/schema");
    deals = schemaMod.deals;
    contacts = schemaMod.contacts;
    dealPeople = schemaMod.dealPeople;
    tracks = schemaMod.tracks;
    stages = schemaMod.stages;
    users = schemaMod.users;

    // Load migration file content — the test proves THE ACTUAL SQL works.
    const migrationPath = path.resolve(
      process.cwd(),
      "drizzle/migrations/0007_backfill_deal_main_contact.sql",
    );
    const content = fs.readFileSync(migrationPath, "utf8");
    migrationStatements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

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
        .values({ email: TEST_EMAIL, name: "Backfill Test User" })
        .returning();
      TEST_USER_ID = inserted.id;
    }
  });

  beforeEach(async () => {
    // Full cleanup of test rows (audit FKs deals.id → cascade on delete for
    // audit_log.record_id is NO ACTION, so delete audit rows first).
    await db.execute(
      sql`DELETE FROM audit_log WHERE user_email = ${TEST_EMAIL}`,
    );
    // deal_people.deal_id → deals.id CASCADE, so deleting deals cascades
    // deal_people. But we also want to zap any contacts this test created.
    await db.execute(
      sql`DELETE FROM deal_people WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(sql`DELETE FROM deals WHERE created_by = ${TEST_USER_ID}`);
    await db.execute(
      sql`DELETE FROM contacts WHERE created_by = ${TEST_USER_ID}`,
    );
  });

  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM audit_log WHERE user_email = ${TEST_EMAIL}`,
    );
    await db.execute(
      sql`DELETE FROM deal_people WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(sql`DELETE FROM deals WHERE created_by = ${TEST_USER_ID}`);
    await db.execute(
      sql`DELETE FROM contacts WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(sql`DELETE FROM users WHERE email = ${TEST_EMAIL}`);
  });

  async function runMigration(): Promise<void> {
    for (const stmt of migrationStatements) {
      await db.execute(sql.raw(stmt));
    }
  }

  async function seedDeals(): Promise<{
    dealA: string;
    dealB: string;
    dealC: string;
    dealNull: string;
    dealWhitespace: string;
  }> {
    // Look up a real track + universal pre_screen_qualification stage (seeded).
    const [track] = await db
      .select()
      .from(tracks)
      .where(eq(tracks.code, "TE"))
      .limit(1);
    const [stage] = await db
      .select()
      .from(stages)
      .where(eq(stages.code, "pre_screen_qualification"))
      .limit(1);
    if (!track || !stage) {
      throw new Error(
        "Seed data missing — run `npm run db:seed` to seed tracks + stages.",
      );
    }

    // Use a short ad-hoc file_no tagged with the test marker so we can ensure
    // uniqueness within this test-run without colliding with other suites.
    const prefix = `ZZ-${Date.now().toString().slice(-4)}-`;

    // Deal A + B share an email (different case/whitespace variations to
    // test lower(trim(email)) normalization). Deal C has its own email.
    const [dealA, dealB, dealC, dealNull, dealWhitespace] = await db
      .insert(deals)
      .values([
        {
          trackId: track.id,
          stageId: stage.id,
          fileNo: `${prefix}0001`,
          title: "Deal A (shared email)",
          priority: "HIGH",
          status: "active",
          mainContactName: "Alice Backfill",
          mainContactEmail: "shared@example.com",
          titleCtc: false,
          lenderCtc: false,
          createdBy: TEST_USER_ID,
          internalOwner: TEST_USER_ID,
        },
        {
          trackId: track.id,
          stageId: stage.id,
          fileNo: `${prefix}0002`,
          title: "Deal B (shared email, different case)",
          priority: "MEDIUM",
          status: "active",
          mainContactName: "Alice Backfill",
          mainContactEmail: "  SHARED@EXAMPLE.COM  ",
          titleCtc: false,
          lenderCtc: false,
          createdBy: TEST_USER_ID,
          internalOwner: TEST_USER_ID,
        },
        {
          trackId: track.id,
          stageId: stage.id,
          fileNo: `${prefix}0003`,
          title: "Deal C (distinct email)",
          priority: "LOW",
          status: "active",
          mainContactName: "Bob Distinct",
          mainContactEmail: "bob@example.com",
          titleCtc: false,
          lenderCtc: false,
          createdBy: TEST_USER_ID,
          internalOwner: TEST_USER_ID,
        },
        {
          trackId: track.id,
          stageId: stage.id,
          fileNo: `${prefix}0004`,
          title: "Deal Null (no email)",
          priority: "LOW",
          status: "active",
          mainContactName: null,
          mainContactEmail: null,
          titleCtc: false,
          lenderCtc: false,
          createdBy: TEST_USER_ID,
          internalOwner: TEST_USER_ID,
        },
        {
          trackId: track.id,
          stageId: stage.id,
          fileNo: `${prefix}0005`,
          title: "Deal Whitespace (empty-ish email)",
          priority: "LOW",
          status: "active",
          mainContactName: "Whitespace Carl",
          mainContactEmail: "   ",
          titleCtc: false,
          lenderCtc: false,
          createdBy: TEST_USER_ID,
          internalOwner: TEST_USER_ID,
        },
      ])
      .returning();

    return {
      dealA: dealA.id,
      dealB: dealB.id,
      dealC: dealC.id,
      dealNull: dealNull.id,
      dealWhitespace: dealWhitespace.id,
    };
  }

  it("Test 1: seed deals + run migration → contacts dedupe on lower(email)", async () => {
    await seedDeals();
    await runMigration();

    const backfilled = await db
      .select()
      .from(contacts)
      .where(eq(contacts.createdBy, TEST_USER_ID));

    // 2 deals share 'shared@example.com' (case-insensitive after trim) → 1 contact.
    // 1 deal has 'bob@example.com' → 1 contact. Null/whitespace excluded.
    expect(backfilled).toHaveLength(2);

    const emails = backfilled.map((c) => c.email).sort();
    expect(emails).toEqual(["bob@example.com", "shared@example.com"]);

    // All backfilled rows carry the role_hint marker.
    for (const c of backfilled) {
      expect(c.roleHint).toBe("main_contact (backfill)");
    }
  });

  it("Test 2: 3 deal_people rows inserted — one per deal with a real email", async () => {
    await seedDeals();
    await runMigration();

    const dpRows = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.createdBy, TEST_USER_ID));

    expect(dpRows).toHaveLength(3);
    for (const dp of dpRows) {
      expect(dp.role).toBe("main_contact");
      expect(dp.contactId).not.toBeNull();
    }
  });

  it("Test 3: deal with NULL main_contact_email has NO deal_people row", async () => {
    const { dealNull } = await seedDeals();
    await runMigration();

    const rowsForNull = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.dealId, dealNull));

    expect(rowsForNull).toHaveLength(0);
  });

  it("Test 4: deal with whitespace-only main_contact_email has NO deal_people row", async () => {
    const { dealWhitespace } = await seedDeals();
    await runMigration();

    const rowsForWhitespace = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.dealId, dealWhitespace));

    expect(rowsForWhitespace).toHaveLength(0);
  });

  it("Test 5: deals with shared email share ONE contact_id (case + whitespace-normalized dedupe)", async () => {
    const { dealA, dealB } = await seedDeals();
    await runMigration();

    const [dpA] = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.dealId, dealA));
    const [dpB] = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.dealId, dealB));

    expect(dpA).toBeDefined();
    expect(dpB).toBeDefined();
    expect(dpA.contactId).toBe(dpB.contactId);
  });

  it("Test 6 (IDEMPOTENCY): re-running migration is a no-op", async () => {
    await seedDeals();
    await runMigration();

    const contactsBefore = await db
      .select()
      .from(contacts)
      .where(eq(contacts.createdBy, TEST_USER_ID));
    const dpBefore = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.createdBy, TEST_USER_ID));

    // Second run — ON CONFLICT DO NOTHING should make this a no-op.
    await runMigration();

    const contactsAfter = await db
      .select()
      .from(contacts)
      .where(eq(contacts.createdBy, TEST_USER_ID));
    const dpAfter = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.createdBy, TEST_USER_ID));

    expect(contactsAfter.length).toBe(contactsBefore.length);
    expect(dpAfter.length).toBe(dpBefore.length);

    // Third run for extra safety.
    await runMigration();
    const contactsAfter3 = await db
      .select()
      .from(contacts)
      .where(eq(contacts.createdBy, TEST_USER_ID));
    expect(contactsAfter3.length).toBe(contactsBefore.length);
  });

  it("Test 7: legacy main_contact_name + main_contact_email columns still exist (DROP deferred to P10)", async () => {
    const result = await db.execute<{ column_name: string }>(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_name = 'deals'
            AND column_name IN ('main_contact_name', 'main_contact_email')
          ORDER BY column_name`,
    );
    const rows = (result as unknown as { rows: { column_name: string }[] })
      .rows;
    const names = rows.map((r) => r.column_name).sort();
    expect(names).toEqual(["main_contact_email", "main_contact_name"]);
  });

  it("Test 8: contact rows have the role_hint='main_contact (backfill)' marker", async () => {
    await seedDeals();
    await runMigration();

    const marked = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count FROM contacts
          WHERE role_hint = 'main_contact (backfill)'
            AND created_by = ${TEST_USER_ID}`,
    );
    const rows = (marked as unknown as { rows: { count: string }[] }).rows;
    expect(Number(rows[0].count)).toBe(2);
  });
});
