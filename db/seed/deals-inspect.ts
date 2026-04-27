/**
 * deals-inspect.ts — read-only sampler for operator debugging.
 *
 * Usage:
 *   npm run db:deals:inspect                 # most recent 25 deals
 *   npm run db:deals:inspect -- --limit 50
 *   npm run db:deals:inspect -- --source clickup_import   # only import-tagged rows
 *
 * Prints file_no + title + track code + source tag (from the most recent
 * audit row's `afterJson.source` field) so operators can verify what
 * landed in prod without needing to open a SQL shell.
 *
 * No writes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 25;
  const sourceIdx = args.indexOf("--source");
  const sourceFilter = sourceIdx !== -1 ? args[sourceIdx + 1] : null;

  const { db } = await import("@/lib/db");
  const { deals, tracks, auditLog } = await import("@/db/schema");
  const { desc, eq, sql } = await import("drizzle-orm");

  // Total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deals);
  console.log(`Total deals in DB: ${count}`);

  // Most recent N with their track code
  const rows = await db
    .select({
      id: deals.id,
      fileNo: deals.fileNo,
      title: deals.title,
      trackCode: tracks.code,
      createdAt: deals.createdAt,
    })
    .from(deals)
    .leftJoin(tracks, eq(deals.trackId, tracks.id))
    .orderBy(desc(deals.createdAt))
    .limit(limit);

  console.log(`\nMost recent ${rows.length} deals:`);
  console.log("file_no          track  title");
  console.log("".padEnd(100, "─"));
  for (const r of rows) {
    console.log(
      `${(r.fileNo ?? "").padEnd(16)}  ${(r.trackCode ?? "??").padEnd(4)}  ${r.title.slice(0, 70)}`,
    );
  }

  // Most recent audit rows for source tracing — filter if requested
  const auditRows = await db
    .select({
      recordId: auditLog.recordId,
      tableName: auditLog.tableName,
      operation: auditLog.operation,
      afterJson: auditLog.afterJson,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  const tagged = auditRows.filter((a) => {
    const src = (a.afterJson as { source?: string } | null)?.source;
    if (!sourceFilter) return src !== undefined;
    return src === sourceFilter;
  });
  console.log(
    `\nMost recent audit rows with source tag${sourceFilter ? ` (== '${sourceFilter}')` : ""}: ${tagged.length}`,
  );
  console.log(
    "record_id  table         op      source                             clickup_file_no   clickup_task",
  );
  console.log("".padEnd(140, "─"));
  for (const a of tagged) {
    const j = a.afterJson as {
      source?: string;
      clickup_task_id?: string;
      clickup_file_no?: string;
    } | null;
    console.log(
      `${a.recordId.slice(0, 8)}  ${(a.tableName ?? "").padEnd(12)}  ${(a.operation ?? "").padEnd(6)}  ${(j?.source ?? "-").padEnd(34)}  ${(j?.clickup_file_no ?? "-").padEnd(16)}  ${j?.clickup_task_id ?? "-"}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ERR:", err.message);
    process.exit(1);
  });
