import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { sql, eq } from "drizzle-orm";

/**
 * Phase 1 Plan 05 Task 2 — createDeal server action tests.
 *
 * These tests hit a REAL Postgres (docker-compose). The action depends on:
 *   - `getCurrentUser()` — stubbed via vi.mock so we don't need a live
 *     Cloudflare Access JWT in tests
 *   - `redirect()` from next/navigation — stubbed to throw a recognizable
 *     NEXT_REDIRECT shape so the test can observe redirect vs. validation
 *     return
 *   - `revalidatePath()` from next/cache — stubbed to a no-op
 *
 * Shape of tests (8 behaviors from plan 05):
 *   1. Valid input → { ok: true, fileNo: /^[A-Z]{2}-\d{4}-\d{4}$/ } + deals row
 *   2. Inserted deal has stage_id of the universal pre_screen_qualification
 *   3. status='active', created_by = stub user, internal_owner = created_by (D-18)
 *   4. One new audit_log row with operation='create', beforeJson=null, afterJson non-null
 *   5. propertyState='TX' → file_no starts with 'TX-'; null → 'XX-'
 *   6. Invalid input (missing title) → { ok: false, errors }; no deals + no audit
 *   7. INVARIANT: if writeAuditLog throws, the deal insert rolls back
 *   8. Money fields round-trip as integer USD (salesPrice=485000, loanAmount=300000)
 */

// Required env for @/lib/env to load BEFORE any @/lib/* import.
process.env.DATABASE_URL ??= "postgres://npr:npr@localhost:5432/npr_dashboard";
process.env.CF_ACCESS_TEAM_DOMAIN ??= "test.cloudflareaccess.com";
process.env.CF_ACCESS_AUD ??= "a".repeat(64);
process.env.NEXT_PUBLIC_APP_NAME ??= "NPR Dashboard";
process.env.NEXT_PUBLIC_APP_DOMAIN ??= "portal.utstitle.com";

// Stubbed user (created in beforeAll, reused for all tests)
const TEST_EMAIL = "test+create-deal@example.com";
let TEST_USER_ID: string;

// Mock next/navigation.redirect so we can observe "the action tried to redirect".
// Real redirect() throws a NEXT_REDIRECT error that frameworks unwind.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT: ${url}`);
    (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;push;${url};307;`;
    throw err;
  }),
}));

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

describe("createDeal server action", () => {
  let db: typeof import("@/lib/db").db;
  let createDeal: typeof import("@/app/deal/new/actions").createDeal;
  let deals: typeof import("@/db/schema").deals;
  let auditLog: typeof import("@/db/schema").auditLog;
  let stages: typeof import("@/db/schema").stages;
  let users: typeof import("@/db/schema").users;

  beforeAll(async () => {
    const dbMod = await import("@/lib/db");
    db = dbMod.db;
    const schemaMod = await import("@/db/schema");
    deals = schemaMod.deals;
    auditLog = schemaMod.auditLog;
    stages = schemaMod.stages;
    users = schemaMod.users;

    const actionsMod = await import("@/app/deal/new/actions");
    createDeal = actionsMod.createDeal;

    // Insert / resolve the test user
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
  });

  beforeEach(async () => {
    // Clean the rows this test suite creates, keeping other rows untouched.
    // audit_log.record_id FKs deals.id, so audit first.
    // NOTE: we intentionally do NOT drop the per-year sequence here; tests
    // in this file assert prefix + regex shape, not exact counters, so they
    // tolerate any starting value. This avoids a race with
    // tests/unit/file-no.test.ts which DOES drop the sequence between
    // its own tests — vitest parallelizes test files.
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

  /** Minimal valid input — exercise the happy path without optional fields. */
  function minimalInput(overrides: Record<string, unknown> = {}) {
    return {
      trackCode: "TE",
      priority: "HIGH",
      title: "1234 Elm St, Tampa FL",
      propertyState: "TX",
      titleCtc: false,
      lenderCtc: false,
      ...overrides,
    };
  }

  /**
   * Invoke createDeal and unwrap the NEXT_REDIRECT the action throws on
   * success. Returns the validation result if the action returned (ok:false),
   * or a synthetic { ok: true, fileNo, dealId } parsed from the redirect URL
   * if the action redirected. This lets tests assert outcomes without pulling
   * in the full Next.js server-action runtime.
   */
  async function invoke(raw: unknown): Promise<
    { ok: true; fileNo: string } | { ok: false; errors: Record<string, string[]> }
  > {
    try {
      const result = await createDeal(raw);
      // Returned without redirecting → validation failure
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

  it("Test 1: valid input returns { ok: true, fileNo } and inserts a deals row with matching file_no", async () => {
    const result = await invoke(minimalInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fileNo).toMatch(/^[A-Z]{2}-\d{4}-\d{4}$/);

    const rows = await db
      .select()
      .from(deals)
      .where(eq(deals.fileNo, result.fileNo));
    expect(rows).toHaveLength(1);
    expect(rows[0].fileNo).toBe(result.fileNo);
  });

  it("Test 2: inserted deal has stage_id of universal pre_screen_qualification (D-10)", async () => {
    const [defaultStage] = await db
      .select()
      .from(stages)
      .where(eq(stages.code, "pre_screen_qualification"))
      .limit(1);
    expect(defaultStage).toBeDefined();

    const result = await invoke(minimalInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [deal] = await db
      .select()
      .from(deals)
      .where(eq(deals.fileNo, result.fileNo));
    expect(deal.stageId).toBe(defaultStage.id);
  });

  it("Test 3: status=active, created_by=user, internal_owner=created_by (D-18)", async () => {
    const result = await invoke(minimalInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [deal] = await db
      .select()
      .from(deals)
      .where(eq(deals.fileNo, result.fileNo));
    expect(deal.status).toBe("active");
    expect(deal.createdBy).toBe(TEST_USER_ID);
    expect(deal.internalOwner).toBe(TEST_USER_ID);
  });

  it("Test 4: exactly one audit_log row with operation=create, before=null, after non-null (D-05)", async () => {
    const result = await invoke(minimalInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [deal] = await db
      .select()
      .from(deals)
      .where(eq(deals.fileNo, result.fileNo));

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, deal.id));
    expect(audit).toHaveLength(1);
    expect(audit[0].tableName).toBe("deals");
    expect(audit[0].operation).toBe("create");
    expect(audit[0].userEmail).toBe(TEST_EMAIL);
    expect(audit[0].userId).toBe(TEST_USER_ID);
    expect(audit[0].beforeJson).toBeNull();
    expect(audit[0].afterJson).not.toBeNull();
  });

  it("Test 5a: propertyState='TX' → file_no starts with 'TX-'", async () => {
    const result = await invoke(minimalInput({ propertyState: "TX" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fileNo.startsWith("TX-")).toBe(true);
  });

  it("Test 5b: propertyState omitted → file_no starts with 'XX-'", async () => {
    const { propertyState: _omit, ...base } = minimalInput();
    void _omit;
    const result = await invoke(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fileNo.startsWith("XX-")).toBe(true);
  });

  it("Test 6: invalid input (missing title) returns { ok: false, errors } and writes no rows", async () => {
    // Count baseline
    const beforeDeals = await db
      .select()
      .from(deals)
      .where(eq(deals.createdBy, TEST_USER_ID));
    const beforeAudit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));

    const result = await invoke({
      trackCode: "TE",
      priority: "HIGH",
      // title intentionally omitted
      titleCtc: false,
      lenderCtc: false,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.title).toBeDefined();
    expect(result.errors.title?.[0]).toMatch(/required/i);

    // No mutation
    const afterDeals = await db
      .select()
      .from(deals)
      .where(eq(deals.createdBy, TEST_USER_ID));
    const afterAudit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    expect(afterDeals.length).toBe(beforeDeals.length);
    expect(afterAudit.length).toBe(beforeAudit.length);
  });

  it("Test 7 (INVARIANT): if writeAuditLog throws, the deal insert rolls back atomically", async () => {
    // Spy / replace writeAuditLog to throw. We re-import the actions module
    // with a fresh module cache that has writeAuditLog mocked.
    vi.resetModules();
    vi.doMock("@/lib/audit", () => ({
      writeAuditLog: vi.fn(async () => {
        throw new Error("boom — simulated audit failure");
      }),
    }));

    // Re-import db + createDeal with the new mock active
    const freshDb = (await import("@/lib/db")).db;
    const { createDeal: freshCreateDeal } = await import(
      "@/app/deal/new/actions"
    );
    const freshDeals = (await import("@/db/schema")).deals;

    const beforeCount = (
      await freshDb
        .select()
        .from(freshDeals)
        .where(eq(freshDeals.createdBy, TEST_USER_ID))
    ).length;

    let caught: unknown = null;
    try {
      await freshCreateDeal(minimalInput({ title: "ROLLBACK TEST" }));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect((caught as Error).message).toMatch(/boom/);

    const afterCount = (
      await freshDb
        .select()
        .from(freshDeals)
        .where(eq(freshDeals.createdBy, TEST_USER_ID))
    ).length;
    expect(afterCount).toBe(beforeCount);

    // Restore the real module for subsequent tests
    vi.doUnmock("@/lib/audit");
    vi.resetModules();
  });

  it("Test 8: money fields round-trip as integer USD", async () => {
    const result = await invoke(
      minimalInput({
        salesPrice: 485000,
        loanAmount: 300000,
        estimatedDown: 50000,
        earnestMoney: 5000,
        estRehab: 25000,
        arv: 600000,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [deal] = await db
      .select()
      .from(deals)
      .where(eq(deals.fileNo, result.fileNo));
    expect(deal.salesPrice).toBe(485000);
    expect(deal.loanAmount).toBe(300000);
    expect(deal.estimatedDown).toBe(50000);
    expect(deal.earnestMoney).toBe(5000);
    expect(deal.estRehab).toBe(25000);
    expect(deal.arv).toBe(600000);
  });
});
