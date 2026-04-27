import { sql } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";

/**
 * Drizzle transaction type for this app's (node-postgres + typed schema) setup.
 *
 * Derived from lib/db.ts — `drizzle(pool, { schema })` with the node-postgres
 * driver. If Plan 05's `db.transaction(async tx => ...)` caller does NOT match
 * this type, that's a sign the DB client was reconfigured; adjust this alias.
 *
 * The generics come from drizzle-orm 0.45.2's `PgTransaction<TQueryResult,
 * TFullSchema, TSchema>` in node_modules/drizzle-orm/pg-core/session.d.ts
 * (line 49), and `NodePgQueryResultHKT` is re-exported from
 * drizzle-orm/node-postgres (via session.d.ts line 57).
 *
 * Using a PROPER PgTransaction type (not a loose duck-type with an execute
 * method) lets TypeScript catch misuse at compile time: only a real Drizzle
 * tx object will satisfy the contract.
 */
export type AppTx = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * Generates the next file_no for a deal insert.
 *
 * Must be called inside the same transaction that inserts the deal, so the
 * returned file_no is consistent with the deal row. Postgres guarantees
 * atomicity of `nextval()` — two concurrent callers will never get the same
 * number (see Test 8 in tests/unit/file-no.test.ts).
 *
 * DEAL-02a format: {STATE|XX}-{YYYY}-{NNNN}
 *   - STATE: 2-letter property_state upper-cased; null/empty → literal "XX"
 *   - YYYY: 4-digit year at insert (from Postgres CURRENT_DATE)
 *   - NNNN: zero-padded counter, global-within-year (shared across states)
 *
 * @param tx - Drizzle transaction (from `db.transaction(async tx => ...)`)
 * @param stateCode - 2-letter state code; null/empty → "XX"
 * @returns the assigned file_no string (e.g. "TX-2026-0001")
 */
export async function generateFileNo(
  tx: AppTx,
  stateCode: string | null | undefined,
): Promise<string> {
  // Pre-normalize JS-side: collapse undefined → null, trim-empty → null.
  // The SQL function also normalizes, but keeping the boundary explicit makes
  // the wrapper self-documenting and lets us pass `null` to Postgres cleanly.
  const normalized =
    stateCode && stateCode.trim().length > 0 ? stateCode.trim() : null;

  const result = await tx.execute(
    sql`SELECT next_file_no(${normalized}) AS file_no`,
  );

  // Drizzle's node-postgres `.execute()` returns `QueryResult<T>` which has
  // a `.rows` array shape `{ rows: [{ file_no: "..." }] }`. Check defensively
  // in case the driver shape shifts between drizzle-orm minor versions.
  const rows =
    (result as unknown as { rows?: Array<{ file_no: string }> }).rows ??
    (result as unknown as Array<{ file_no: string }>);
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row || typeof row.file_no !== "string") {
    throw new Error("generateFileNo: unexpected SELECT result shape");
  }
  return row.file_no;
}
