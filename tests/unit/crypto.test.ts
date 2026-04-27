import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * Tests for lib/crypto.ts.
 *
 * The NON-SKIPPABLE invariant is the single most important thing in this
 * module: every call to decrypt() MUST insert a row into npi_access_log.
 * If a developer ever tries to decrypt without logging, these tests fail.
 *
 * We mock @/lib/db so the test doesn't need a live Postgres connection.
 */

// `insertValuesSpy` records every call to `db.insert(...).values(...)` in the
// module under test. Each decrypt() should produce exactly one call.
type InsertedRow = {
  userEmail: string;
  fieldAccessed: string;
  dealId: string | null;
  contactId: string | null;
  purpose: string | null;
};
const insertValuesSpy = vi.fn<(row: InsertedRow) => Promise<undefined>>(async () => undefined);

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({ values: insertValuesSpy }),
  },
}));

// Set a valid-looking key BEFORE the env module + lib/crypto load.
// ENCRYPTION_KEY must be 44-char base64 = 32 raw bytes, per env schema.
const TEST_KEY_RAW_BASE64 = randomBytes(32).toString("base64");

describe("lib/crypto", () => {
  beforeEach(() => {
    insertValuesSpy.mockClear();
    // Minimal valid env for the module to load
    process.env.DATABASE_URL = "postgres://u:p@localhost:5432/db";
    process.env.CF_ACCESS_TEAM_DOMAIN = "test.cloudflareaccess.com";
    process.env.CF_ACCESS_AUD = "a".repeat(64);
    process.env.ENCRYPTION_KEY = TEST_KEY_RAW_BASE64;
    // D-06 public branding (required from Plan 01-02 onwards)
    process.env.NEXT_PUBLIC_APP_NAME = "NPR Dashboard";
    process.env.NEXT_PUBLIC_APP_DOMAIN = "portal.utstitle.com";
  });

  it("encrypt() produces ciphertext distinct from plaintext", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix is a Vite pattern, not typed
    const { encrypt } = await import("@/lib/crypto?ct-distinct");
    const ciphertext = await encrypt("sensitive-value-123");
    expect(ciphertext).not.toBe("sensitive-value-123");
    expect(ciphertext).toMatch(/^v1\.aesgcm256\./); // cloak output format
  });

  it("encrypt() then decrypt() round-trips cleanly", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix
    const { encrypt, decrypt } = await import("@/lib/crypto?roundtrip");
    const ciphertext = await encrypt("the quick brown fox");
    const plaintext = await decrypt(ciphertext, {
      userEmail: "carrie@utstitle.com",
      fieldAccessed: "contacts.ssn",
    });
    expect(plaintext).toBe("the quick brown fox");
  });

  it("INVARIANT: decrypt() always inserts exactly one npi_access_log row", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix
    const { encrypt, decrypt } = await import("@/lib/crypto?invariant");
    const ciphertext = await encrypt("x");

    await decrypt(ciphertext, {
      userEmail: "carrie@utstitle.com",
      fieldAccessed: "contacts.ssn",
      dealId: "00000000-0000-0000-0000-000000000000",
    });

    expect(insertValuesSpy).toHaveBeenCalledTimes(1);
    const insertedRow = insertValuesSpy.mock.calls[0][0];
    expect(insertedRow.userEmail).toBe("carrie@utstitle.com");
    expect(insertedRow.fieldAccessed).toBe("contacts.ssn");
    expect(insertedRow.dealId).toBe("00000000-0000-0000-0000-000000000000");
    expect(insertedRow.contactId ?? null).toBeNull();
    expect(insertedRow.purpose ?? null).toBeNull();
  });

  it("INVARIANT: two decrypts produce two log rows", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix
    const { encrypt, decrypt } = await import("@/lib/crypto?multi");
    const ct1 = await encrypt("one");
    const ct2 = await encrypt("two");

    await decrypt(ct1, { userEmail: "a@x.com", fieldAccessed: "contacts.ssn" });
    await decrypt(ct2, { userEmail: "b@x.com", fieldAccessed: "contacts.dob" });

    expect(insertValuesSpy).toHaveBeenCalledTimes(2);
    const users = insertValuesSpy.mock.calls.map((c) => c[0].userEmail);
    expect(users).toEqual(["a@x.com", "b@x.com"]);
  });

  it("decrypt() propagates purpose when supplied", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix
    const { encrypt, decrypt } = await import("@/lib/crypto?purpose");
    const ciphertext = await encrypt("secret");
    await decrypt(ciphertext, {
      userEmail: "carrie@utstitle.com",
      fieldAccessed: "contacts.income",
      purpose: "Loan application review",
    });
    const insertedRow = insertValuesSpy.mock.calls[0][0];
    expect(insertedRow.purpose).toBe("Loan application review");
  });
});
