"use server";

import {
  queryContactsAutosuggest,
  type ContactAutosuggestRow,
} from "@/lib/contacts-query";

/**
 * Phase 3 Plan 06 Task 1 — thin Server Action wrapper for the role-slot
 * autosuggest combobox (PEOPLE-03).
 *
 * Client components cannot call query helpers directly — they must go
 * through a Server Action or a route handler. `queryContactsAutosuggest`
 * itself is read-only; this wrapper exists so the `contact-autosuggest`
 * client component can `import { queryContactsAutosuggestAction }` and
 * drive it inside a useTransition + useEffect debounce.
 *
 * Defensive clamps (belt + suspenders against the lib-layer clamp):
 *   - empty/whitespace `q` → return [] WITHOUT touching the DB
 *   - `limit` clamped to [1, 20]
 *
 * No DB import in this file — we stay a pass-through to keep the action
 * thin and easy to audit.
 */
export async function queryContactsAutosuggestAction(
  q: string,
  limit = 8,
): Promise<ContactAutosuggestRow[]> {
  const trimmed = (q ?? "").trim();
  if (trimmed.length === 0) return [];
  const cappedLimit = Math.min(Math.max(limit, 1), 20);
  return await queryContactsAutosuggest(trimmed, cappedLimit);
}
