import { auditLog } from "@/db/schema";
import type { User } from "@/db/schema";
import type { AppTx } from "@/lib/file-no";

/**
 * Write one audit_log row inside an open transaction.
 *
 * Part of the OPS-01 / D-05 contract: every mutation leaves a trail. This
 * helper MUST be called inside the same transaction as the mutation being
 * audited so that if the audit write fails the mutation rolls back too.
 *
 * The transaction type comes from `lib/file-no.ts::AppTx` — re-using it here
 * keeps the parameter type consistent across both helpers that a server
 * action composes inside `db.transaction(async tx => ...)`.
 *
 * `user.email` is denormalized into the audit row (per D-05) so GLBA
 * traceability survives later deletion of the users row.
 */
export async function writeAuditLog(
  tx: AppTx,
  params: {
    tableName: string;
    recordId: string;
    operation: "create" | "update" | "delete";
    beforeJson: unknown | null;
    afterJson: unknown;
    user: Pick<User, "id" | "email">;
  },
): Promise<void> {
  await tx.insert(auditLog).values({
    tableName: params.tableName,
    recordId: params.recordId,
    operation: params.operation,
    // drizzle-orm's jsonb columns accept any JSON-serializable shape; the
    // `unknown` at the call site lets callers pass full row objects without
    // casting, and Postgres handles the serialization.
    beforeJson: params.beforeJson as never,
    afterJson: params.afterJson as never,
    userId: params.user.id,
    userEmail: params.user.email,
  });
}
