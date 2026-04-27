/**
 * Phase 3 Plan 05 Task 1 — /contacts URL-state helper (VIEW-06 / D-07).
 *
 * Mirrors lib/filter-params.ts for /contacts. Only one param today: `q`
 * (case-insensitive substring search — see queryContactsForList in
 * lib/contacts-query.ts, which ILIKEs against full_name OR email OR org).
 *
 * Future filters (on-deals-only, org-filter, role-hint filter) extend by
 * adding fields + cases here; this module stays the only place that talks
 * to the raw URL shape for /contacts.
 *
 * D-07: URL-state is source of truth — links are shareable, no client-side
 * filter state. Defaults are OMITTED from serialize so a fresh visit to
 * /contacts never carries ?q= in the URL.
 */

export type ContactsFilterParams = { q: string };

export function parseContactsFilterParams(
  sp: Record<string, string | string[] | undefined>,
): ContactsFilterParams {
  const raw = sp.q;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return { q: (v ?? "").trim() };
}

export function serializeContactsFilterParams(
  p: Partial<ContactsFilterParams>,
): URLSearchParams {
  const out = new URLSearchParams();
  if (p.q && p.q.length > 0) out.set("q", p.q);
  return out;
}

export function hasAnyContactsFilter(p: ContactsFilterParams): boolean {
  return p.q.length > 0;
}
