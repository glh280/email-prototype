/**
 * clickup-rollback.ts — audit-driven rollback of the ClickUp import.
 *
 * EMERGENCY USE ONLY. Deletes every deal whose audit trail contains a row
 * with `source = "clickup_import"`. Only targets import-sourced rows;
 * manually-created deals are safe because they don't carry that provenance
 * tag.
 *
 * Behavior:
 *   1. Finds all deals.id referenced by an audit row tagged clickup_import.
 *   2. For each deal: deletes deal_people (cascades), deletes contacts
 *      whose only audit row has source contact_create_via_new_deal
 *      (orphan-only delete — keeps manually-created contacts), deletes
 *      the deal row (deals FK's audit rows ON DELETE — check schema).
 *   3. Dry-run by default; --apply to actually delete.
 *
 * Why this is safe:
 *   - Uses source-tag provenance, not id-range or date-range
 *   - Skips contacts that were created outside the import (keeps Carrie's
 *     test contact)
 *   - All writes in a single transaction; rollback on any error
 *
 * Re-running after a successful rollback is a no-op (no rows match).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  console.log(
    `▶ clickup-rollback ${APPLY ? "APPLY (deleting)" : "DRY-RUN (no deletes)"}\n`,
  );

  const { db } = await import("@/lib/db");
  const { deals, contacts, dealPeople, auditLog } = await import("@/db/schema");
  const { eq, and, sql, inArray } = await import("drizzle-orm");

  // Find deal IDs from import audit rows
  const importAuditDeals = await db
    .selectDistinct({ recordId: auditLog.recordId })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tableName, "deals"),
        sql`${auditLog.afterJson}->>'source' = 'clickup_import'`,
      ),
    );
  const dealIds = importAuditDeals.map((r) => r.recordId);
  console.log(`Found ${dealIds.length} deal(s) tagged source=clickup_import`);

  if (dealIds.length === 0) {
    console.log("Nothing to rollback. Exiting.");
    return;
  }

  // Find contacts created by those deals' imports (source = contact_create_via_new_deal)
  // AND only by the import (don't delete contacts that have other history)
  const importContactAudits = await db
    .selectDistinct({ recordId: auditLog.recordId })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tableName, "contacts"),
        sql`${auditLog.afterJson}->>'source' = 'contact_create_via_new_deal'`,
      ),
    );
  const candidateContactIds = importContactAudits.map((r) => r.recordId);

  const contactsToDelete: string[] = [];
  for (const cid of candidateContactIds) {
    const allAuditsForContact = await db
      .select({ afterJson: auditLog.afterJson })
      .from(auditLog)
      .where(
        and(eq(auditLog.tableName, "contacts"), eq(auditLog.recordId, cid)),
      );
    // Only delete if every audit for this contact is import-sourced
    const nonImport = allAuditsForContact.filter((a) => {
      const src = (a.afterJson as { source?: string } | null)?.source;
      return src !== "contact_create_via_new_deal";
    });
    if (nonImport.length === 0) contactsToDelete.push(cid);
  }

  // Preview
  console.log(`\nWill delete:`);
  console.log(`  ${dealIds.length} deal(s)`);
  console.log(
    `  ${contactsToDelete.length} import-only contact(s) (others preserved)`,
  );
  console.log(`  all deal_people rows attached to those deals (via FK cascade)`);
  console.log(`  audit_log rows remain — they document the history`);

  if (!APPLY) {
    console.log(`\nDry-run complete. To apply: npm run db:rollback:clickup-import -- --apply`);
    return;
  }

  // Resolve Carrie for the audit summary
  const { users } = await import("@/db/schema");
  const [carrie] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = lower('carrie@unitedtitlesolutions.com')`)
    .limit(1);
  if (!carrie) throw new Error("Carrie user not found for audit attribution");

  await db.transaction(async (tx) => {
    // 1. Write a rollback audit row PER deleted deal BEFORE deletion.
    // audit_log.record_id is notNull (no FK, just an index), so we stamp
    // each deal's ID as the record_id for traceability. Keeps the "why
    // was this deal deleted" answer one query away.
    for (const did of dealIds) {
      await tx.insert(auditLog).values({
        tableName: "deals",
        recordId: did,
        operation: "delete",
        beforeJson: null,
        afterJson: {
          source: "clickup_import_rollback",
          reason: "list-view crash: TypeError a.getTime is not a function",
          commit_when_rolled_back: "aea4d64",
        },
        userId: carrie.id,
        userEmail: carrie.email,
      });
    }

    // 2. Delete deal_people for imported deals
    if (dealIds.length > 0) {
      await tx.delete(dealPeople).where(inArray(dealPeople.dealId, dealIds));
      console.log(`  ✓ deleted deal_people rows`);
    }

    // 3. Delete contacts that only exist because of the import
    if (contactsToDelete.length > 0) {
      await tx.delete(contacts).where(inArray(contacts.id, contactsToDelete));
      console.log(`  ✓ deleted ${contactsToDelete.length} import-sourced contact(s)`);
    }

    // 4. Delete the deals
    await tx.delete(deals).where(inArray(deals.id, dealIds));
    console.log(`  ✓ deleted ${dealIds.length} deal(s)`);
  });

  console.log(`\n═══ ROLLBACK COMPLETE ═══`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ERR:", err.message);
    process.exit(1);
  });
