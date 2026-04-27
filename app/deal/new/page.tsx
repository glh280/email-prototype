import { AppHeader } from "@/components/app-header";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { TRACK_SEEDS } from "@/db/seed/tracks";
import { NewDealForm } from "./new-deal-form";

/**
 * /deal/new — Server Component wrapper for the New Deal form.
 *
 * Per UI-SPEC Page 2:
 *   - max-w-[720px] column, header + back link + h1 + subtitle + form
 *   - File # preview is a best-effort estimate (UI-SPEC Assumption 4):
 *     count of deals created this calendar year + 1 — labelled with a
 *     leading `~` in the form body so users know it's not atomic. The
 *     real file_no is assigned by Postgres sequence inside the createDeal
 *     transaction (Plan 03 atomicity).
 *
 * Uses the canonical `@/lib/db` client (D-04 convention — @/db/client is
 * forbidden and does not exist).
 */
export default async function NewDealPage() {
  // Best-effort estimate for the File # preview pill. Fail-safe: if the
  // query errors for any reason, fall back to "0001".
  let nextEstimate = "0001";
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM deals
      WHERE created_at >= date_trunc('year', CURRENT_DATE)
    `);
    const rows =
      (result as unknown as { rows?: Array<{ count: number }> }).rows ??
      (result as unknown as Array<{ count: number }>);
    const row = Array.isArray(rows) ? rows[0] : rows;
    const count = Number(row?.count ?? 0);
    nextEstimate = String(count + 1).padStart(4, "0");
  } catch {
    // Best-effort — keep the default estimate on error
  }
  const currentYear = new Date().getFullYear();

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-[720px] px-6 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back to deals
        </Link>
        <h1 className="text-xl font-semibold">New Deal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fill in the basics — you can edit the rest after it&apos;s created.
        </p>
        <div className="mt-6 pb-24">
          <NewDealForm
            tracks={TRACK_SEEDS.map((t) => ({
              code: t.code,
              label: t.label,
              defaultPriority: t.defaultPriority,
              sortOrder: t.sortOrder,
            }))}
            currentYear={currentYear}
            fileNoEstimate={nextEstimate}
          />
        </div>
      </main>
    </>
  );
}
