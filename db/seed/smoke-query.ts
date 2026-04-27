/**
 * smoke-query.ts — verify queryDeals returns real Date objects post-fix.
 *
 * Calls lib/deals-query.ts::queryDeals directly with Carrie's user_id and
 * default filters. Asserts for each row that:
 *   - activityAt is a Date instance (not a string — the incident bug)
 *   - closingAt/fundingAt are Date | null (same)
 *   - relativeTime(activityAt) runs without throwing
 *
 * If this passes, the list-view render path that crashed earlier is now
 * fixed. If any row has a non-Date timestamp, we'd fail here and surface
 * the shape before it ever hits the browser.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main(): Promise<void> {
  const { db } = await import("@/lib/db");
  const { users } = await import("@/db/schema");
  const { sql } = await import("drizzle-orm");

  const [carrie] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = lower('carrie@unitedtitlesolutions.com')`)
    .limit(1);
  if (!carrie) throw new Error("Carrie not found");

  const { queryDeals } = await import("@/lib/deals-query");
  const { relativeTime } = await import("@/lib/format");

  const { parseFilterParams } = await import("@/lib/filter-params");
  const defaultFilters = parseFilterParams({}); // empty search params = defaults

  const rows = await queryDeals(defaultFilters, carrie.id);
  console.log(`Query returned ${rows.length} rows\n`);

  let dateIssues = 0;
  let relativeTimeIssues = 0;

  for (const r of rows) {
    const activityIsDate = r.activityAt instanceof Date;
    const closingOk = r.closingAt === null || r.closingAt instanceof Date;
    const fundingOk = r.fundingAt === null || r.fundingAt instanceof Date;

    let rt: string;
    try {
      rt = relativeTime(r.activityAt);
    } catch (err) {
      relativeTimeIssues++;
      rt = `THREW: ${(err as Error).message}`;
    }

    const status =
      activityIsDate && closingOk && fundingOk && !rt.startsWith("THREW")
        ? "✓"
        : "✗";
    if (status === "✗") dateIssues++;

    console.log(
      `${status} ${r.fileNo.padEnd(16)} activityAt=${activityIsDate ? "Date" : typeof r.activityAt}  relativeTime="${rt}"`,
    );
  }

  console.log(
    `\n═══ ${dateIssues === 0 ? "PASS" : "FAIL"} — ${rows.length - dateIssues}/${rows.length} rows have correct Date types, ${relativeTimeIssues} relativeTime() throws`,
  );
  if (dateIssues > 0 || relativeTimeIssues > 0) process.exit(1);
}

main().catch((err) => {
  console.error("ERR:", err.message);
  process.exit(1);
});
