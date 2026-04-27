"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/current-user";
import { createDealSchema } from "@/lib/deal-schema";
import { createDealCore } from "@/lib/deal-actions-core";

/**
 * createDeal — Phase 1 Plan 05, refactored in P3.5 for script reuse.
 *
 * Thin server-action wrapper around `createDealCore` (the request-free core
 * in `lib/deal-actions-core.ts`). This separation lets non-request callers
 * (ClickUp import, future admin tooling, scripts) create deals without a
 * Cloudflare Access JWT cookie while keeping a single source of truth for
 * the transaction body.
 *
 * Responsibilities retained here:
 *   1. Zod validation of raw client input (do not trust the browser).
 *   2. `getCurrentUser()` — reads CF Access JWT; throws if missing/invalid.
 *   3. `revalidatePath('/')` — the list view must re-fetch after create.
 *   4. `redirect(...)` — throws a special NEXT_REDIRECT error by design;
 *      MUST NOT be wrapped in try/catch per
 *      `node_modules/next/dist/docs/01-app/02-guides/redirecting.md`.
 *
 * All DB work (track lookup, default stage, file_no generation, deals
 * INSERT, audit row, P3 deal_people dual-write) lives in `createDealCore`.
 * Behavior is identical pre- and post-refactor — the 298-test suite
 * (including tests/unit/create-deal-people-dual-write.test.ts) is the
 * binding contract.
 */
export type CreateDealResult =
  | { ok: true; fileNo: string; dealId: string }
  | { ok: false; errors: Record<string, string[]> };

export async function createDeal(raw: unknown): Promise<CreateDealResult> {
  // 1. Validate input (server-side re-validate — do not trust the client)
  const parsed = createDealSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // 2. Current user (from Cloudflare Access JWT; throws if missing/invalid)
  const user = await getCurrentUser();

  // 3. Transaction — delegated to the request-free core so scripts can call
  //    it too. Any throw rolls back the whole tx (see core's docstring for
  //    the atomic guarantees).
  const result = await createDealCore(parsed.data, {
    id: user.id,
    email: user.email,
  });

  // 4. Revalidate the list view (new deal must appear) and redirect.
  //    redirect() throws a special navigation error — MUST NOT be inside
  //    try/catch. See node_modules/next/dist/docs/01-app/02-guides/redirecting.md
  revalidatePath("/");
  redirect(`/?created=${encodeURIComponent(result.fileNo)}`);
}
