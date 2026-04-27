import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";
// Canonical DB client import (@/lib/db). Dynamic below to allow env setup first,
// but this type-only import documents the contract and is what Plan 05 will use.
import type { db as DbType } from "@/lib/db";
import type { AppTx } from "@/lib/file-no";

/**
 * Phase 1 Plan 03 — file_no generator tests.
 *
 * Tests the `next_file_no(state_code)` Postgres function and its TypeScript
 * wrapper `lib/file-no.ts::generateFileNo(tx, state)`.
 *
 * These tests hit a REAL Postgres (the same local docker-compose Postgres the
 * rest of the repo uses). Each test drops+recreates the current year's
 * sequence in beforeEach so the counter is deterministic.
 *
 * DEAL-02a format: {STATE|XX}-{YYYY}-{NNNN}
 * - STATE: 2-letter property_state upper-cased; literal XX if null/empty
 * - YYYY: 4-digit year at insert
 * - NNNN: zero-padded per-year counter, global-within-year across states
 *
 * Plan 05 will call generateFileNo inside `db.transaction(async tx => ...)`,
 * so these tests exercise the exact calling pattern the server action will use.
 */

// Required env for @/lib/env to load. Set BEFORE importing @/lib/db.
process.env.DATABASE_URL ??= "postgres://npr:npr@localhost:5432/npr_dashboard";
process.env.CF_ACCESS_TEAM_DOMAIN ??= "test.cloudflareaccess.com";
process.env.CF_ACCESS_AUD ??= "a".repeat(64);
process.env.NEXT_PUBLIC_APP_NAME ??= "NPR Dashboard";
process.env.NEXT_PUBLIC_APP_DOMAIN ??= "portal.utstitle.com";

const CURRENT_YEAR = new Date().getFullYear();
const SEQ_NAME = `deals_file_no_${CURRENT_YEAR}_seq`;

describe("file_no generator (next_file_no + generateFileNo)", () => {
  // These imports resolve at describe-run-time, so they can be after env setup.
  // We re-import inside tests via dynamic import so modules see the env.
  let db: typeof DbType;
  let generateFileNo: (
    tx: AppTx,
    state: string | null | undefined,
  ) => Promise<string>;

  beforeAll(async () => {
    const dbMod = await import("@/lib/db");
    db = dbMod.db;
    const fnMod = await import("@/lib/file-no");
    generateFileNo = fnMod.generateFileNo;
  });

  beforeEach(async () => {
    // Reset the current-year sequence so each test starts at 1.
    // DROP is idempotent with IF EXISTS; the function re-creates lazily.
    await db.execute(sql.raw(`DROP SEQUENCE IF EXISTS ${SEQ_NAME}`));
  });

  afterAll(async () => {
    // Final cleanup so a stale sequence doesn't leak between test runs.
    await db.execute(sql.raw(`DROP SEQUENCE IF EXISTS ${SEQ_NAME}`));
  });

  it("Test 1: generateFileNo(tx, 'TX') on clean DB returns TX-YYYY-0001", async () => {
    const out = await db.transaction(async (tx) => {
      return generateFileNo(tx, "TX");
    });
    expect(out).toMatch(new RegExp(`^TX-${CURRENT_YEAR}-0001$`));
  });

  it("Test 2: two sequential calls with same state return sequential counters", async () => {
    const first = await db.transaction(async (tx) => generateFileNo(tx, "TX"));
    const second = await db.transaction(async (tx) => generateFileNo(tx, "TX"));
    expect(first).toBe(`TX-${CURRENT_YEAR}-0001`);
    expect(second).toBe(`TX-${CURRENT_YEAR}-0002`);
  });

  it("Test 3: interleaved states share one counter (global-within-year per DEAL-02a)", async () => {
    const first = await db.transaction(async (tx) => generateFileNo(tx, "TX"));
    const second = await db.transaction(async (tx) => generateFileNo(tx, "CA"));
    const third = await db.transaction(async (tx) => generateFileNo(tx, "TX"));
    expect(first).toBe(`TX-${CURRENT_YEAR}-0001`);
    expect(second).toBe(`CA-${CURRENT_YEAR}-0002`);
    expect(third).toBe(`TX-${CURRENT_YEAR}-0003`);
  });

  it("Test 4: null state_code yields XX prefix", async () => {
    const out = await db.transaction(async (tx) => generateFileNo(tx, null));
    expect(out).toMatch(new RegExp(`^XX-${CURRENT_YEAR}-\\d{4}$`));
  });

  it("Test 5: empty string state_code yields XX prefix", async () => {
    const out = await db.transaction(async (tx) => generateFileNo(tx, ""));
    expect(out).toMatch(new RegExp(`^XX-${CURRENT_YEAR}-\\d{4}$`));
  });

  it("Test 6: lowercase state code is normalized to uppercase", async () => {
    const out = await db.transaction(async (tx) => generateFileNo(tx, "tx"));
    expect(out).toMatch(new RegExp(`^TX-${CURRENT_YEAR}-\\d{4}$`));
  });

  it("Test 7: sequence name matches current year (pg_sequences check)", async () => {
    // Trigger lazy creation
    await db.transaction(async (tx) => generateFileNo(tx, "TX"));
    const result = await db.execute(
      sql.raw(
        `SELECT sequencename FROM pg_sequences WHERE sequencename = '${SEQ_NAME}'`,
      ),
    );
    const rows =
      (result as unknown as { rows?: Array<{ sequencename: string }> }).rows ??
      (result as unknown as Array<{ sequencename: string }>);
    const row = Array.isArray(rows) ? rows[0] : rows;
    expect(row?.sequencename).toBe(SEQ_NAME);
  });

  it("Test 8: concurrent calls produce no duplicate counters (sequence atomicity)", async () => {
    const N = 10;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        db.transaction(async (tx) => generateFileNo(tx, "TX")),
      ),
    );
    const counters = results
      .map((s) => parseInt(s.split("-")[2], 10))
      .sort((a, b) => a - b);
    // No duplicates, all between 1 and N inclusive
    expect(new Set(counters).size).toBe(N);
    expect(counters[0]).toBeGreaterThanOrEqual(1);
    expect(counters[N - 1]).toBeLessThanOrEqual(N);
  });
});
