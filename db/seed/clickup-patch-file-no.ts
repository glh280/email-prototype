/**
 * clickup-patch-file-no.ts — one-shot corrective for the initial import.
 *
 * The first run of clickup-import.ts captured clickup_file_no into the
 * supplementary audit row but did NOT pass it through to
 * createDealCore's file_no — so all 17 imported deals got fresh generated
 * file_nos (XX-2026-0001..17) instead of Carrie's real ClickUp values
 * (FL-2026-001, STM-2026-007, WA-2026-008, etc.).
 *
 * This script:
 *   1. Reads audit rows with source='clickup_import' where clickup_file_no
 *      is non-null
 *   2. UPDATEs each referenced deal's file_no IN ONE TRANSACTION
 *   3. Appends a tiny audit row documenting the rename, so both the old
 *      and new file_nos are preserved in history
 *
 * Dry-run by default; requires --apply to write.
 *
 * Idempotent: re-running after a successful apply is a no-op because the
 * file_no will already match clickup_file_no (WHERE clause filters).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  console.log(
    `▶ clickup-patch-file-no ${APPLY ? "APPLY" : "DRY-RUN"} (rewrites deal.file_no to match audit's clickup_file_no)\n`,
  );

  const { db } = await import("@/lib/db");
  const { deals, auditLog, users } = await import("@/db/schema");
  const { eq, and, desc, sql } = await import("drizzle-orm");

  // Load Carrie for audit attribution (same user who ran the import)
  const [carrie] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = lower('carrie@unitedtitlesolutions.com')`)
    .limit(1);
  if (!carrie) throw new Error("Carrie user not found for audit attribution");

  // Candidate audit rows with clickup_file_no provenance
  const auditRows = await db
    .select({
      recordId: auditLog.recordId,
      afterJson: auditLog.afterJson,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tableName, "deals"),
        sql`${auditLog.afterJson}->>'source' = 'clickup_import'`,
        sql`${auditLog.afterJson}->>'clickup_file_no' IS NOT NULL`,
      ),
    );
  console.log(`Found ${auditRows.length} audit row(s) with clickup_file_no provenance`);

  const patches: Array<{
    dealId: string;
    currentFileNo: string;
    targetFileNo: string;
    clickupTaskId: string;
  }> = [];

  for (const a of auditRows) {
    const j = a.afterJson as {
      clickup_file_no?: string;
      clickup_task_id?: string;
    };
    if (!j?.clickup_file_no) continue;
    const [deal] = await db
      .select({ id: deals.id, fileNo: deals.fileNo })
      .from(deals)
      .where(eq(deals.id, a.recordId))
      .limit(1);
    if (!deal) {
      console.log(`  ⚠ deal ${a.recordId} referenced by audit but not found in deals table`);
      continue;
    }
    if (deal.fileNo === j.clickup_file_no) continue; // idempotent skip
    patches.push({
      dealId: deal.id,
      currentFileNo: deal.fileNo,
      targetFileNo: j.clickup_file_no,
      clickupTaskId: j.clickup_task_id ?? "?",
    });
  }

  console.log(`\n─── ${patches.length} file_no rewrite(s) planned ───`);
  console.log("deal_id    current          →  target             clickup_task");
  console.log("".padEnd(100, "─"));
  for (const p of patches) {
    console.log(
      `${p.dealId.slice(0, 8)}  ${p.currentFileNo.padEnd(16)} →  ${p.targetFileNo.padEnd(16)}  ${p.clickupTaskId}`,
    );
  }

  if (!APPLY) {
    console.log(`\nDry-run complete. To apply: npm run db:patch:clickup-file-no -- --apply\n`);
    return;
  }

  // Check for target-value collisions before writing
  for (const p of patches) {
    const [collider] = await db
      .select({ id: deals.id, fileNo: deals.fileNo })
      .from(deals)
      .where(eq(deals.fileNo, p.targetFileNo))
      .limit(1);
    if (collider && collider.id !== p.dealId) {
      throw new Error(
        `Collision: target file_no ${p.targetFileNo} already used by deal ${collider.id}. Aborting without writes.`,
      );
    }
  }

  // Apply — each patch is its own tx with an audit row
  let applied = 0;
  for (const p of patches) {
    await db.transaction(async (tx) => {
      await tx
        .update(deals)
        .set({ fileNo: p.targetFileNo })
        .where(eq(deals.id, p.dealId));

      await tx.insert(auditLog).values({
        tableName: "deals",
        recordId: p.dealId,
        operation: "update",
        beforeJson: { file_no: p.currentFileNo },
        afterJson: {
          file_no: p.targetFileNo,
          source: "clickup_import_file_no_patch",
          original_generated: p.currentFileNo,
          clickup_task_id: p.clickupTaskId,
        },
        userId: carrie.id,
        userEmail: carrie.email,
      });
    });
    console.log(`  ✓ ${p.currentFileNo} → ${p.targetFileNo}`);
    applied++;
  }
  console.log(`\n═══ ${applied} file_no(s) patched ═══\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ERR:", err.message);
    process.exit(1);
  });
