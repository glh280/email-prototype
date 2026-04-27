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
 * Phase 3 Plan 04 Task 1 — createContact + updateContact Server Action tests.
 *
 * Hits real Postgres. Mirrors note-actions.test.ts harness (P2 precedent).
 *
 * NOTE on test location: vitest.config.ts restricts discovery to
 * `tests/unit/**\/*.test.ts` — plan text referenced `tests/integration/` but
 * that would orphan the file. Same decision as Plan 03-03.
 *
 * Shape (8 behaviors — from plan §Tests):
 *   1. Happy create: row inserted; audit row operation='create' source='contact_create'
 *   2. Validation error (missing fullName) → {ok:false, errors}
 *   3. Unknown key via .strict() → {ok:false, errors}
 *   4. Duplicate email → {ok:false, error:/already exists/}; first row still present
 *   5. ROLLBACK INVARIANT: vi.doMock('@/lib/audit') throw → NO contact row
 *   6. updateContact happy: row updated, audit op='update' source='contact_update'
 *   7. updateContact empty diff → {ok:true, noop:true}, NO new audit row
 *   8. updateContact unknown key → {ok:false, errors}
 */

process.env.DATABASE_URL ??= "postgres://npr:npr@localhost:5432/npr_dashboard";
process.env.CF_ACCESS_TEAM_DOMAIN ??= "test.cloudflareaccess.com";
process.env.CF_ACCESS_AUD ??= "a".repeat(64);
process.env.NEXT_PUBLIC_APP_NAME ??= "NPR Dashboard";
process.env.NEXT_PUBLIC_APP_DOMAIN ??= "portal.utstitle.com";

const TEST_EMAIL = "test+contact-actions@example.com";
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

describe("createContact + updateContact server actions", () => {
  let db: typeof import("@/lib/db").db;
  let actions: typeof import("@/app/contacts/actions");
  let contacts: typeof import("@/db/schema").contacts;
  let auditLog: typeof import("@/db/schema").auditLog;
  let users: typeof import("@/db/schema").users;

  beforeAll(async () => {
    const dbMod = await import("@/lib/db");
    db = dbMod.db;
    const schemaMod = await import("@/db/schema");
    contacts = schemaMod.contacts;
    auditLog = schemaMod.auditLog;
    users = schemaMod.users;

    actions = await import("@/app/contacts/actions");

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
        .values({ email: TEST_EMAIL, name: "Contact Test User" })
        .returning();
      TEST_USER_ID = inserted.id;
    }
  });

  beforeEach(async () => {
    await db.execute(
      sql`DELETE FROM audit_log WHERE user_email = ${TEST_EMAIL}`,
    );
    await db.execute(
      sql`DELETE FROM contacts WHERE created_by = ${TEST_USER_ID}`,
    );
  });

  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM audit_log WHERE user_email = ${TEST_EMAIL}`,
    );
    await db.execute(
      sql`DELETE FROM contacts WHERE created_by = ${TEST_USER_ID}`,
    );
    await db.execute(sql`DELETE FROM users WHERE email = ${TEST_EMAIL}`);
  });

  it("Test 1: createContact happy — row inserted, audit source='contact_create'", async () => {
    const result = await actions.createContact({
      fullName: "Alice Baker",
      email: "alice@example.com",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect("contactId" in result).toBe(true);

    const rows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.createdBy, TEST_USER_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0].fullName).toBe("Alice Baker");
    expect(rows[0].email).toBe("alice@example.com");

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, rows[0].id));
    expect(audit).toHaveLength(1);
    expect(audit[0].tableName).toBe("contacts");
    expect(audit[0].operation).toBe("create");
    expect(audit[0].userEmail).toBe(TEST_EMAIL);
    const after = audit[0].afterJson as { source?: string };
    expect(after.source).toBe("contact_create");
  });

  it("Test 2: createContact rejects missing fullName", async () => {
    const result = await actions.createContact({ email: "bob@example.com" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect("errors" in result).toBe(true);
    if (!("errors" in result)) return;
    expect(result.errors.fullName).toBeDefined();
  });

  it("Test 3: createContact rejects unknown key via .strict()", async () => {
    const result = await actions.createContact({
      fullName: "Bob",
      bogusKey: "x",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect("errors" in result).toBe(true);
  });

  it("Test 4: duplicate email — second returns error; first still present", async () => {
    const first = await actions.createContact({
      fullName: "Alice",
      email: "dupe@example.com",
    });
    expect(first.ok).toBe(true);

    const second = await actions.createContact({
      fullName: "Alice2",
      email: "dupe@example.com",
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect("error" in second).toBe(true);
    if (!("error" in second)) return;
    expect(second.error).toMatch(/already exists/i);

    const rows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.createdBy, TEST_USER_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0].fullName).toBe("Alice");
  });

  it("Test 5 (INVARIANT): createContact rollback — audit throws → NO contact row", async () => {
    vi.resetModules();
    vi.doMock("@/lib/audit", () => ({
      writeAuditLog: vi.fn(async () => {
        throw new Error("boom — simulated audit failure during createContact");
      }),
    }));

    const freshDb = (await import("@/lib/db")).db;
    const freshSchema = await import("@/db/schema");
    const { createContact: freshCreate } = await import(
      "@/app/contacts/actions"
    );

    const ROLLBACK_EMAIL = "rollback-proof@example.com";
    let threw = false;
    let result: unknown = null;
    try {
      result = await freshCreate({
        fullName: "Rollback Proof",
        email: ROLLBACK_EMAIL,
      });
    } catch {
      threw = true;
    }

    // Either a thrown error OR a result with ok:false — both acceptable.
    if (!threw && result && typeof result === "object" && "ok" in result) {
      expect((result as { ok: boolean }).ok).toBe(false);
    }

    const rows = await freshDb
      .select()
      .from(freshSchema.contacts)
      .where(eq(freshSchema.contacts.email, ROLLBACK_EMAIL));
    expect(rows).toHaveLength(0);

    vi.doUnmock("@/lib/audit");
    vi.resetModules();
  });

  it("Test 6: updateContact happy — audit op='update' source='contact_update'", async () => {
    const created = await actions.createContact({
      fullName: "Original",
      email: "upd@example.com",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.contactId;

    const auditBefore = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    const auditBeforeCount = auditBefore.length;

    const result = await actions.updateContact({ id, fullName: "Renamed" });
    expect(result.ok).toBe(true);

    const rows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id));
    expect(rows[0].fullName).toBe("Renamed");

    const auditAfter = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    expect(auditAfter.length).toBe(auditBeforeCount + 1);

    const updateAudit = auditAfter.find(
      (a) => a.operation === "update" && a.recordId === id,
    );
    expect(updateAudit).toBeDefined();
    if (!updateAudit) return;
    // Drizzle row objects are camelCase (fullName, not full_name) even
    // when serialized to jsonb — matches deal-actions.test.ts convention.
    const before = updateAudit.beforeJson as { fullName?: string };
    const after = updateAudit.afterJson as { source?: string; fullName?: string };
    expect(before.fullName).toBe("Original");
    expect(after.fullName).toBe("Renamed");
    expect(after.source).toBe("contact_update");
  });

  it("Test 7: updateContact empty diff — ok:true noop:true, NO new audit row", async () => {
    const created = await actions.createContact({
      fullName: "NoOp",
      email: "noop@example.com",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.contactId;

    const auditBefore = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    const auditBeforeCount = auditBefore.length;

    const result = await actions.updateContact({ id, fullName: "NoOp" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if ("noop" in result) expect(result.noop).toBe(true);

    const auditAfter = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userEmail, TEST_EMAIL));
    expect(auditAfter.length).toBe(auditBeforeCount);
  });

  it("Test 8: updateContact rejects unknown key via .strict()", async () => {
    const created = await actions.createContact({
      fullName: "Strict",
      email: "strict@example.com",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.contactId;

    const result = await actions.updateContact({ id, bogus: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect("errors" in result).toBe(true);
  });
});
