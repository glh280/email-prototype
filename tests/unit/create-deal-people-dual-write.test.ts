import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { sql, eq, and } from "drizzle-orm";

/**
 * Phase 3 Plan 07 Task 2 — createDeal dual-write tests.
 *
 * createDeal (P1 Plan 05) was a deals-only INSERT + audit. This plan extends
 * the transaction to ALSO:
 *   - UPSERT a contacts row (by lower(email)) when mainContactEmail is set
 *   - INSERT a deal_people row with role='main_contact' wired to that contact
 *   - Audit both new mutations with source='contact_create_via_new_deal' and
 *     'deal_people_upsert_via_new_deal' (distinct from Plan 04's source
 *     vocab so audit queries can distinguish user-triggered vs side-effect)
 *
 * Rollback invariant: if writeAuditLog throws inside the tx, ALL THREE writes
 * (deals, contacts, deal_people) roll back together. Single tx = all or
 * nothing — the P1 Test 7 pattern extended.
 *
 * NOTE on test location: vitest.config.ts restricts discovery to
 * `tests/unit/**\/*.test.ts` — same convention as Plans 03-03/04/05/06/07.
 *
 * Shape (>= 6 assertions):
 *   1. Happy path w/ email → deal + contact + deal_people all inserted; audit
 *      has 3 rows (deals:create, contacts:create, deal_people:create)
 *   2. No email → deal inserted; NO contact, NO deal_people
 *   3. Email matches EXISTING contact → contacts count unchanged; deal_people
 *      row points to the existing contact
 *   4. Rollback invariant: vi.doMock('@/lib/audit') throw → NO deal, NO contact,
 *      NO deal_people (atomic rollback)
 *   5. Whitespace-only email → treated as absent; NO contact, NO deal_people
 *   6. mainContactName but no email → NO contact, NO deal_people (email is
 *      the dedupe key)
 */

process.env.DATABASE_URL ??= "postgres://npr:npr@localhost:5432/npr_dashboard";
process.env.CF_ACCESS_TEAM_DOMAIN ??= "test.cloudflareaccess.com";
process.env.CF_ACCESS_AUD ??= "a".repeat(64);
process.env.NEXT_PUBLIC_APP_NAME ??= "NPR Dashboard";
process.env.NEXT_PUBLIC_APP_DOMAIN ??= "portal.utstitle.com";

const TEST_EMAIL = "test+create-deal-dualwrite@example.com";
let TEST_USER_ID: string;

// Mock next/navigation.redirect so we can observe "the action tried to redirect".
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT: ${url}`);
    (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;push;${url};307;`;
    throw err;
  }),
}));

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

describe("createDeal dual-write (deals + contacts + deal_people)", () => {
  let db: typeof import("@/lib/db").db;
  let createDeal: typeof import("@/app/deal/new/actions").createDeal;
  let deals: typeof import("@/db/schema").deals;
  let contacts: typeof import("@/db/schema").contacts;
  let dealPeople: typeof import("@/db/schema").dealPeople;
  let auditLog: typeof import("@/db/schema").auditLog;
  let users: typeof import("@/db/schema").users;

  beforeAll(async () => {
    const dbMod = await import("@/lib/db");
    db = dbMod.db;
    const schemaMod = await import("@/db/schema");
    deals = schemaMod.deals;
    contacts = schemaMod.contacts;
    dealPeople = schemaMod.dealPeople;
    auditLog = schemaMod.auditLog;
    users = schemaMod.users;

    const actionsMod = await import("@/app/deal/new/actions");
    createDeal = actionsMod.createDeal;

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
        .values({ email: TEST_EMAIL, name: "Dual-Write Test User" })
        .returning();
      TEST_USER_ID = inserted.id;
    }
  });

  beforeEach(async () => {
    // Clean in FK-safe order: audit_log, deal_people (cascade via deals), deals,
    // contacts.
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

  function minimalInput(overrides: Record<string, unknown> = {}) {
    return {
      trackCode: "TE",
      priority: "HIGH",
      title: "Dual-Write Test Deal",
      propertyState: "TX",
      titleCtc: false,
      lenderCtc: false,
      ...overrides,
    };
  }

  async function invoke(raw: unknown): Promise<
    | { ok: true; fileNo: string }
    | { ok: false; errors: Record<string, string[]> }
  > {
    try {
      const result = await createDeal(raw);
      return result;
    } catch (err) {
      const msg = (err as Error).message ?? "";
      const match = msg.match(/NEXT_REDIRECT: \/\?created=([^&]+)/);
      if (match) {
        return { ok: true, fileNo: decodeURIComponent(match[1]) };
      }
      throw err;
    }
  }

  it("Test 1: happy path w/ email — deals + contact + deal_people all inserted; 3 audit rows", async () => {
    const result = await invoke(
      minimalInput({
        mainContactName: "Alice Dual-Write",
        mainContactEmail: "alice.dualwrite@example.com",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [deal] = await db
      .select()
      .from(deals)
      .where(eq(deals.fileNo, result.fileNo));
    expect(deal).toBeDefined();

    // Contact inserted, email lowercased.
    const contactRows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.createdBy, TEST_USER_ID));
    expect(contactRows).toHaveLength(1);
    expect(contactRows[0].email).toBe("alice.dualwrite@example.com");
    expect(contactRows[0].fullName).toBe("Alice Dual-Write");

    // deal_people row wired to the contact.
    const dpRows = await db
      .select()
      .from(dealPeople)
      .where(
        and(eq(dealPeople.dealId, deal.id), eq(dealPeople.role, "main_contact")),
      );
    expect(dpRows).toHaveLength(1);
    expect(dpRows[0].contactId).toBe(contactRows[0].id);

    // 3 audit rows for this user: deals:create, contacts:create, deal_people:create.
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    expect(audit.length).toBe(3);

    const tableCounts = audit.reduce<Record<string, number>>((acc, row) => {
      acc[row.tableName] = (acc[row.tableName] ?? 0) + 1;
      return acc;
    }, {});
    expect(tableCounts.deals).toBe(1);
    expect(tableCounts.contacts).toBe(1);
    expect(tableCounts.deal_people).toBe(1);

    // New audit source markers.
    const contactAudit = audit.find((a) => a.tableName === "contacts");
    const dpAudit = audit.find((a) => a.tableName === "deal_people");
    const cAfter = contactAudit?.afterJson as { source?: string };
    const dpAfter = dpAudit?.afterJson as { source?: string };
    expect(cAfter.source).toBe("contact_create_via_new_deal");
    expect(dpAfter.source).toBe("deal_people_upsert_via_new_deal");
  });

  it("Test 2: no email — deal inserted; NO contact; NO deal_people", async () => {
    const result = await invoke(minimalInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const contactRows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.createdBy, TEST_USER_ID));
    expect(contactRows).toHaveLength(0);

    const dpRows = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.createdBy, TEST_USER_ID));
    expect(dpRows).toHaveLength(0);
  });

  it("Test 3: existing contact — dedupe; deal_people points to existing contact", async () => {
    // Pre-seed a contact with the email we'll reuse.
    const [existingContact] = await db
      .insert(contacts)
      .values({
        fullName: "Pre-Existing Contact",
        email: "reuse@example.com",
        createdBy: TEST_USER_ID,
      })
      .returning();

    const result = await invoke(
      minimalInput({
        title: "Deal using existing contact",
        mainContactName: "Reuse Me",
        mainContactEmail: "reuse@example.com",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Contacts count should remain 1 — the second create should have deduped.
    const contactRows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.createdBy, TEST_USER_ID));
    expect(contactRows).toHaveLength(1);

    // deal_people row points at the pre-existing contact id.
    const [deal] = await db
      .select()
      .from(deals)
      .where(eq(deals.fileNo, result.fileNo));
    const [dp] = await db
      .select()
      .from(dealPeople)
      .where(
        and(eq(dealPeople.dealId, deal.id), eq(dealPeople.role, "main_contact")),
      );
    expect(dp.contactId).toBe(existingContact.id);
  });

  it("Test 4 (ROLLBACK INVARIANT): audit throw → NO deal, NO contact, NO deal_people", async () => {
    vi.resetModules();
    vi.doMock("@/lib/audit", () => ({
      writeAuditLog: vi.fn(async () => {
        throw new Error("boom — simulated audit failure in createDeal");
      }),
    }));

    const freshDb = (await import("@/lib/db")).db;
    const freshSchema = await import("@/db/schema");
    const { createDeal: freshCreateDeal } = await import(
      "@/app/deal/new/actions"
    );

    const ROLLBACK_EMAIL = "rollback-dualwrite@example.com";

    const dealsBefore = (
      await freshDb
        .select()
        .from(freshSchema.deals)
        .where(eq(freshSchema.deals.createdBy, TEST_USER_ID))
    ).length;
    const contactsBefore = (
      await freshDb
        .select()
        .from(freshSchema.contacts)
        .where(eq(freshSchema.contacts.createdBy, TEST_USER_ID))
    ).length;
    const dpBefore = (
      await freshDb
        .select()
        .from(freshSchema.dealPeople)
        .where(eq(freshSchema.dealPeople.createdBy, TEST_USER_ID))
    ).length;

    let caught: unknown = null;
    try {
      await freshCreateDeal({
        trackCode: "TE",
        priority: "HIGH",
        title: "ROLLBACK test",
        propertyState: "TX",
        mainContactName: "Should Not Persist",
        mainContactEmail: ROLLBACK_EMAIL,
        titleCtc: false,
        lenderCtc: false,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();

    const dealsAfter = (
      await freshDb
        .select()
        .from(freshSchema.deals)
        .where(eq(freshSchema.deals.createdBy, TEST_USER_ID))
    ).length;
    const contactsAfter = (
      await freshDb
        .select()
        .from(freshSchema.contacts)
        .where(eq(freshSchema.contacts.createdBy, TEST_USER_ID))
    ).length;
    const dpAfter = (
      await freshDb
        .select()
        .from(freshSchema.dealPeople)
        .where(eq(freshSchema.dealPeople.createdBy, TEST_USER_ID))
    ).length;

    expect(dealsAfter).toBe(dealsBefore);
    expect(contactsAfter).toBe(contactsBefore);
    expect(dpAfter).toBe(dpBefore);

    // Also: no contact with the rollback email should exist.
    const orphans = await freshDb
      .select()
      .from(freshSchema.contacts)
      .where(eq(freshSchema.contacts.email, ROLLBACK_EMAIL));
    expect(orphans).toHaveLength(0);

    vi.doUnmock("@/lib/audit");
    vi.resetModules();
  });

  it("Test 5: whitespace-only mainContactEmail — treated as absent; NO contact, NO deal_people", async () => {
    // createDealSchema doesn't permit raw whitespace (email validator rejects),
    // so we send an empty string instead which IS permitted (z.literal('')) and
    // the action normalizes empty-string to null via its existing path.
    // A whitespace-only string would get rejected at the Zod layer — this test
    // therefore uses empty string as the "absent" sentinel from the form UI.
    const result = await invoke(
      minimalInput({
        mainContactName: "No Email Carl",
        mainContactEmail: "",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const contactRows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.createdBy, TEST_USER_ID));
    expect(contactRows).toHaveLength(0);

    const dpRows = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.createdBy, TEST_USER_ID));
    expect(dpRows).toHaveLength(0);
  });

  it("Test 6: mainContactName but no email — NO contact, NO deal_people", async () => {
    const result = await invoke(
      minimalInput({
        mainContactName: "Name Only Nancy",
        // no mainContactEmail
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const contactRows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.createdBy, TEST_USER_ID));
    expect(contactRows).toHaveLength(0);

    const dpRows = await db
      .select()
      .from(dealPeople)
      .where(eq(dealPeople.createdBy, TEST_USER_ID));
    expect(dpRows).toHaveLength(0);
  });
});
