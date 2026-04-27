---
phase: 03-people-map-contacts-registry
plan: 05
subsystem: ui/server-component/client-form
tags: [nextjs-16, server-component, url-state, debounced-search, shadcn-dialog, form-action, sonner-toast, view-06, people-04]

# Dependency graph
requires:
  - phase: 03-people-map-contacts-registry/02
    provides: "createContactSchema (client-side pre-validation matching server)"
  - phase: 03-people-map-contacts-registry/03
    provides: "queryContactsForList(q?) + ContactListRow (drives the list); queryContactById (drives the stub detail page)"
  - phase: 03-people-map-contacts-registry/04
    provides: "createContact Server Action with { ok, errors | error } result shape + revalidatePath('/contacts')"
  - phase: 01-core-data-model/06
    provides: "URL-state pattern (parseFilterParams / serializeFilterParams) — mirrored here for the single q param"
provides:
  - "app/contacts/page.tsx — Server Component list view with two empty-state branches (no contacts vs filtered-empty) + counter"
  - "app/contacts/[id]/page.tsx — minimal read-only contact detail stub (notFound() on missing id)"
  - "app/contacts/_components/contacts-table.tsx — Name (linked) / Email / Org / Role hint / Active deals / Added (relativeTime) columns"
  - "app/contacts/_components/contacts-search-bar.tsx — 250ms-debounced URL-state search input with inline Clear button"
  - "app/contacts/_components/new-contact-dialog.tsx — client dialog; Zod pre-validation + server action + toast + router.refresh"
  - "lib/contacts-filter-params.ts — single-param parse/serialize/hasAny helper"
  - "tests/unit/contacts-filter-params.test.ts — 9 unit assertions (no DB)"
  - "tests/unit/contacts-page.test.ts — 6 real-Postgres assertions against the page query contract"
affects:
  - "`/contacts` route now live end-to-end — Carrie can open the list, search, and create contacts"
  - "Plan 03-06 (File Contacts tab) can link back to `/contacts/[id]` for per-row detail navigation"
  - "Plan 03-07 (D-03 backfill) — after backfill, existing contacts will render with non-zero activeDealsCount immediately (this plan's counter is the regression signal)"

# Tech tracking
tech-stack:
  added: []  # Zero new deps
  patterns:
    - "URL-state-as-source-of-truth for single-param filter: parseContactsFilterParams / serializeContactsFilterParams / hasAnyContactsFilter — mirrors lib/filter-params.ts cadence but with one param (q). Extends by adding fields + cases when future filters land."
    - "250ms debounce on search typing via setTimeout + cleanup — doesn't thrash router.push on every keystroke; external URL-state changes (Clear link) re-sync local input via useEffect."
    - "Forward-declaration pattern for Server + Client component split: Task 1 wrote 3 client-component stubs (Table, SearchBar, Dialog) so app/contacts/page.tsx compiled atomically; Tasks 2 + 3 overwrote stubs with real implementations. Every commit compiles — bisect-friendly."
    - "Client-side Zod pre-validation using the SAME createContactSchema the server enforces — defense-in-depth identical error shape whether the form posts cleanly or network drops."
    - "Empty-string optional form fields dropped before safeParse — .optional() accepts undefined cleanly; sending '' for optional fields would fail the union with z.literal('')/email check in some edge paths. Required field (fullName) kept regardless so Zod rejects it."
    - "Name-only <Link> inside table row (not full-row anchor) — nesting <a> inside <tr> is invalid HTML; programmatic onClick would force the whole table to 'use client'. Name-link is simplest and preserves cmd-click/middle-click."

key-files:
  created:
    - "lib/contacts-filter-params.ts — 37 lines; 3 exported functions + 1 exported type"
    - "app/contacts/page.tsx — 91 lines; Server Component; two empty-state branches; counter"
    - "app/contacts/[id]/page.tsx — 51 lines; stub detail view; notFound() on missing"
    - "app/contacts/_components/contacts-table.tsx — 85 lines; 6-column table; row-link via Name cell"
    - "app/contacts/_components/contacts-search-bar.tsx — 74 lines; debounced URL-state search"
    - "app/contacts/_components/new-contact-dialog.tsx — 174 lines; Zod-backed form + Server Action"
    - "tests/unit/contacts-filter-params.test.ts — 62 lines; 9 pure-unit assertions"
    - "tests/unit/contacts-page.test.ts — 256 lines; 6 real-Postgres assertions"
  modified: []

key-decisions:
  - "Row-click target: navigate to /contacts/[id] (stub detail route) instead of an inline edit panel. Rationale: nesting <a> inside <tr> is invalid HTML; full-row client onClick would force 'use client' on the table; routing is cleaner than a side panel because the P3 detail data model is trivial (no activeDealsCount-aside data to aggregate beyond the row itself). Full edit UX deferred to P10 calibration or a follow-up plan."
  - "Debounce interval: 250ms. Matches typical IME/typing cadence — long enough to avoid per-keystroke server round-trips, short enough to feel responsive. Cleanup on unmount via window.clearTimeout prevents stale pushes after component teardown."
  - "Tests placed at tests/unit/ not tests/integration/ — same Rule 3 deviation as Plans 03-03 and 03-04 (vitest.config.ts include glob is 'tests/unit/**/*.test.ts'). Test file docstring calls out the decision."
  - "Forward-declared _components stubs in Task 1, then overwrote in Tasks 2 + 3. Keeps every commit compilable (bisect-friendly) without requiring a reorder that writes page.tsx last."
  - "Empty-string form field normalization in the dialog: dropped from the cleaned object before safeParse, EXCEPT fullName which is required (Zod rejects empty fullName with the canonical error). createContact server action also coerces empty-string email → null before INSERT — this is the same normalization applied defensively at both layers."
  - "Stub detail route uses Next.js 16 params Promise shape (params: Promise<{id: string}>) — verified against node_modules/next/dist/docs. Consistent with app/page.tsx's searchParams Promise shape."
  - "DialogTrigger wraps Button via `render={<Button.../>}` — base-nova caveat; asChild is not supported. This plan honors the convention already established in Plan 05 of P1."

patterns-established:
  - "Pattern: Server Component list page + Client SearchBar + Client Dialog + Server Component detail stub — the four-file topology for any future CRUD list in this repo. Future list+create surfaces (e.g., a /emails templates page) can clone this shape."
  - "Pattern: single-param URL filter module (parseX / serializeX / hasAnyX) — the canonical minimal extension of the multi-param lib/filter-params.ts pattern. Scales upward as new params arrive."
  - "Pattern: forward-declared client-component stubs so the Server Component lands first in its own commit. Useful whenever a plan has to split work across more than one atomic task."

requirements-completed: [PEOPLE-04, VIEW-06]

# Metrics
duration: 6m 11s
completed: 2026-04-19
---

# Phase 3 Plan 05: /contacts Page UI Summary

**The `/contacts` page ships end-to-end: Server Component list with URL-state search (250ms debounce), two empty-state branches (no contacts vs filtered-empty), per-contact active-deals counter (from Plan 03's CTE), row-link to stub detail route, and a New Contact dialog with Zod pre-validation + createContact Server Action + sonner success toast + router.refresh. Full suite 279/279 (up from 264; +9 contacts-filter-params unit + 6 contacts-page real-Postgres). Zero new deps. VIEW-06 + PEOPLE-04 delivered at the UI layer.**

## Performance

- **Duration:** 6m 11s
- **Started:** 2026-04-19T02:02:11Z
- **Completed:** 2026-04-19T02:08:22Z
- **Tasks:** 3 (Task 1 TDD RED+GREEN; Tasks 2 + 3 non-TDD additive)
- **Files created:** 8 (6 source, 2 test)
- **Commits:** 5 (RED + Task 1 + Task 2 + integration test + Task 3)

## Accomplishments

- `lib/contacts-filter-params.ts` ships `parseContactsFilterParams`, `serializeContactsFilterParams`, `hasAnyContactsFilter` + `ContactsFilterParams` type. 9 pure-unit assertions cover defaults, array-form first-wins, whitespace trimming, internal-space preservation, URL serialization with default omission.
- `app/contacts/page.tsx` is the Server Component entry: awaits `searchParams` Promise (Next.js 16), parses via the helper, queries `queryContactsForList(filters.q || undefined)` (Plan 03), branches on `anyFilter` to render Empty-state A (no contacts → Users icon + New Contact CTA) vs Empty-state B (filtered-empty → Search icon + Clear search link), otherwise renders `<ContactsTable>`.
- `app/contacts/[id]/page.tsx` stub detail route: reads `params` Promise, calls `queryContactById(id)`, `notFound()` on null, renders a read-only `<dl>` grid with Email / Phone / Org / Role hint / Notes + a back link to `/contacts`.
- `app/contacts/_components/contacts-table.tsx` renders the 6-column list: **Name** (linked to `/contacts/[id]`), Email, Org, Role hint, **Active deals** (right-aligned, muted-zero styling), **Added** (relativeTime). Em-dash substitution on nulls.
- `app/contacts/_components/contacts-search-bar.tsx` is the client-side URL-state search input: Search icon left, clear X right, 250ms debounced `router.push`, `useEffect` re-sync when URL changes externally (Clear search link case).
- `app/contacts/_components/new-contact-dialog.tsx` wraps `createContact` in a form-action dialog: Zod pre-validation with `createContactSchema`; `useTransition` for pending state; sonner `toast.success("Contact added.")` on ok, `toast.error(result.error)` on top-level server errors; `router.refresh()` after success so the revalidated server component re-queries and the new row appears.
- `tests/unit/contacts-filter-params.test.ts` — 9 assertions covering parse + serialize + hasAny semantics.
- `tests/unit/contacts-page.test.ts` — 6 real-Postgres assertions covering module-load, 3-contact seed with zero counts, contactA activeDealsCount=1 after deal_people attach, others stay 0, search narrows, zzz-no-match returns empty.
- Full suite **279/279** (up from 264 after P3 Plan 04). `npx tsc --noEmit` clean. `npm run build` clean — 6 routes registered (`/`, `/_not-found`, `/contacts`, `/contacts/[id]`, `/deal/[id]`, `/deal/new`).

## Task Commits

1. **Task 1 RED: contacts-filter-params tests (9 assertions, all fail on missing module)** — `0a89768` (test)
2. **Task 1 GREEN: contacts-filter-params helper + /contacts page + [id] stub** — `f9b7eef` (feat; includes forward-declared Component stubs so page.tsx compiles)
3. **Task 2: ContactsTable + ContactsSearchBar** — `ef9bc39` (feat)
4. **Task 3 integration test: /contacts page query contract** — `468fd35` (test; 6 assertions green)
5. **Task 3 GREEN: NewContactDialog wired to createContact** — `ef641dc` (feat)

**Plan metadata:** _pending_ (docs: complete plan — final commit appended after self-check)

## Files Created/Modified

- `lib/contacts-filter-params.ts` — 37 lines. Module header documents D-07 URL-state source of truth and the extension path for future filter params. No DB imports; suitable for client + server consumption.
- `app/contacts/page.tsx` — 91 lines. Server Component entry; `searchParams: Promise<Record<string, string|string[]|undefined>>`; two empty-state branches; counter text at bottom; base-nova `render={<Link/>}` for the Clear search button.
- `app/contacts/[id]/page.tsx` — 51 lines. Next.js 16 params Promise shape; calls `queryContactById`; `notFound()` on null; back-link via `<Button render={<Link.../>} variant="ghost" size="sm" />`; `<dl>` grid for field display.
- `app/contacts/_components/contacts-table.tsx` — 85 lines. Uses shadcn Table primitive + lib/format.ts `relativeTime`; Name cell wraps `<Link href={\`/contacts/${c.id}\`}>`; active-deals count renders muted-zero or bold-non-zero.
- `app/contacts/_components/contacts-search-bar.tsx` — 74 lines. Client component; `useRouter` + `useSearchParams`; local `value` state + dual `useEffect` (one for external URL sync, one for debounced push); absolute-positioned Search icon + Clear X button.
- `app/contacts/_components/new-contact-dialog.tsx` — 174 lines. Client component; Zod pre-validation; `useTransition`; `createContact` server action call; toast + router.refresh orchestration; DialogTrigger `render={<Button.../>}`. Internal `Field` helper component for Label+Input+error-message triplet.
- `tests/unit/contacts-filter-params.test.ts` — 62 lines. 9 assertions across 3 `describe` blocks (parse, serialize, hasAny). No DB.
- `tests/unit/contacts-page.test.ts` — 256 lines. 6 real-Postgres assertions; beforeAll seeds user + resolves TE track + pre_screen_qualification stage; beforeEach cleans test-scoped rows; afterAll drops the test user.

## Decisions Made

- **Row-click target: stub detail route at `/contacts/[id]`.** Click navigates rather than opens an inline edit drawer. Nesting `<a>` inside `<tr>` is invalid HTML; programmatic `onClick` would force `"use client"` on the whole table. Full edit UX deferred — this plan ships list + create only, per its own narrow scope statement.
- **Debounce interval: 250ms.** Standard search-input cadence — short enough to feel responsive, long enough to collapse bursts of keystrokes. Cleanup timer on unmount prevents stale pushes.
- **Tests at `tests/unit/` not `tests/integration/`.** Tracked as Rule 3 deviation below. `vitest.config.ts` include glob is `tests/unit/**/*.test.ts`; putting tests at `tests/integration/` would orphan them. Same precedent as Plans 03-03 and 03-04.
- **Forward-declared `_components` stubs in Task 1.** Enabled the Server Component + stub detail route + URL-state helper to land together in Task 1 (bisect-friendly: every commit compiles). Tasks 2 + 3 overwrote the stubs with real client components. Alternative — write page.tsx LAST — would have forced an awkward task reorder.
- **Empty-string form fields dropped before client-side Zod parse.** Required field (`fullName`) kept regardless. Optional fields (`email`, `phone`, `org`, `roleHint`, `notes`) omitted from the cleaned object so `.optional()` accepts them as `undefined` without tripping the email union validator on empty strings. Server (Plan 04) also coerces empty-string email → null at the storage boundary — defense in depth.
- **DialogTrigger via `render={<Button.../>}`.** base-nova caveat: `asChild` is not supported. Comment in the file flags this for future readers; no `asChild` JSX appears anywhere in the new code (verified via grep).
- **router.refresh() after success:** `createContact` already calls `revalidatePath("/contacts")` server-side; `router.refresh()` is the client nudge that picks up the revalidated cache without a full page reload.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test file location changed from `tests/integration/` to `tests/unit/`**

- **Found during:** Task 3 (integration test file placement)
- **Issue:** The plan's `files_modified` frontmatter + task action referenced `tests/integration/contacts-page.test.ts`, but `vitest.config.ts` has `include: ["tests/unit/**/*.test.ts"]` — tests placed at `tests/integration/` would not be discovered.
- **Fix:** Placed the test at `tests/unit/contacts-page.test.ts` (same precedent as Plan 03-03 and Plan 03-04). Test file docstring documents the decision. Did NOT modify `vitest.config.ts` — that would be a Rule 4 architectural change.
- **Files modified:** Integration test at `tests/unit/` instead of `tests/integration/`.
- **Verification:** Test discovered and runs; 6/6 pass. Full suite 279/279 green.
- **Committed in:** `468fd35` (Task 3 integration test).

**2. [Rule 3 - Blocking] Executor sequencing: wrote _components stubs in Task 1 so page.tsx compiled**

- **Found during:** Task 1 (app/contacts/page.tsx imports 3 _components that don't exist yet)
- **Issue:** The plan explicitly called this out as an executor's choice: "the executor should temporarily stub out the 3 _components imports as empty exports so Task 1 builds, then wire them in Task 2/3. Alternatively: write page.tsx LAST." This isn't strictly a deviation — it's one of two documented paths the plan authorized. Noting it for completeness.
- **Fix:** Wrote 3 minimal client-component stubs (ContactsTable returns null with props, ContactsSearchBar returns null, NewContactDialog returns null) in Task 1. Tasks 2 + 3 overwrote them with full implementations. Every commit compiles.
- **Verification:** `npx tsc --noEmit` clean after Task 1; `npm run build` clean after Task 2; full suite green after Task 3.
- **Committed in:** `f9b7eef` (Task 1 GREEN, stubs included).

---

**Total deviations:** 1 tracked blocking (test path) + 1 documented-path-choice.
**Impact on plan:** Zero scope creep. All 3 tasks delivered the exact surface and behavior the plan specified, in the order it specified, with the acceptance-criteria grep checks all passing (9 source + 2 detail + 3 table + 1 search + 6 dialog greps; 0 `@/db/client`, 0 `asChild` JSX).

## Issues Encountered

None. The integration test exercises Plan 03's query layer + Task 1's page module — both already shipped when the test ran, so it went green first try (not RED). Plan language acknowledged this would be the case: "the integration test here is really just exercising the query layer under the /contacts use case; the rendering is exercised via `npm run build` passing." No RED-GREEN cycle needed for Task 3's test.

## User Setup Required

None — no external-service configuration. The route is live at `/contacts` against the existing DB.

## Manual Smoke Test (Plan-Optional)

Not run this session (no dev server started). The plan marked manual smoke as optional ("documented in SUMMARY which path taken"). Given the integration test + build + tsc + 279/279 suite, I opted for the automated path. Operator can smoke-test via `npm run dev` + visit `/contacts` — expected: empty-state A → click New Contact → fill form → submit → toast "Contact added." → row appears → type in search → row filters via URL `?q=`.

## Next Phase Readiness

Remaining P3 plans are unblocked:

- **Plan 03-06 (deal-detail File Contacts tab):** can link to `/contacts/[id]` for per-slot contact detail navigation. Also demonstrates that `createContact` + toast + router.refresh wiring pattern is reusable for the File Contacts tab's "new person on this slot" flow if one ships.
- **Plan 03-07 (D-03 backfill migration 0007):** will surface immediately in the `/contacts` activeDealsCount column — existing contacts attached to active deals via the backfilled `main_contact` deal_people rows will show a non-zero count on first page load after 0007 runs. This is the regression signal that the backfill worked end-to-end.

**P3 progresses to 5/7 plans shipped** (waves 1 + 2 + 3 + 4a done: 01, 02, 03, 04, 05). Wave 4b is Plan 06 (File Contacts tab); Wave 5 is Plan 07 (D-03 backfill).

## Self-Check: PASSED

Verified before writing SUMMARY:

- Source files:
  - `lib/contacts-filter-params.ts` — FOUND; exports parseContactsFilterParams / serializeContactsFilterParams / hasAnyContactsFilter / ContactsFilterParams.
  - `app/contacts/page.tsx` — FOUND; grep: `searchParams: Promise<` (1), `queryContactsForList` (3), `anyFilter` (2).
  - `app/contacts/[id]/page.tsx` — FOUND; grep: `queryContactById` (2), `notFound` (2).
  - `app/contacts/_components/contacts-table.tsx` — FOUND; grep: `activeDealsCount` (3), `relativeTime` (2), `href={\`/contacts/${c.id}\`}` (1).
  - `app/contacts/_components/contacts-search-bar.tsx` — FOUND; starts with `"use client";`; `useRouter` (2), `serializeContactsFilterParams` (2), `setTimeout` (1).
  - `app/contacts/_components/new-contact-dialog.tsx` — FOUND; starts with `"use client";`; `createContact` (6), `createContactSchema` (3), `router.refresh()` (3), `toast.success` (1), `DialogTrigger` (3).
- Test files:
  - `tests/unit/contacts-filter-params.test.ts` — FOUND; 9/9 passing.
  - `tests/unit/contacts-page.test.ts` — FOUND; 6/6 passing.
- Commits:
  - `0a89768` test(03-05) RED contacts-filter-params — FOUND
  - `f9b7eef` feat(03-05) Task 1 GREEN — FOUND (contacts-filter-params + /contacts page + [id] stub + component stubs)
  - `ef9bc39` feat(03-05) Task 2 — FOUND (table + search bar)
  - `468fd35` test(03-05) integration test — FOUND
  - `ef641dc` feat(03-05) Task 3 — FOUND (new contact dialog)
- Full suite: `npm test` → **279/279 passing** (was 264 pre-plan; 15 new: 9 contacts-filter-params + 6 contacts-page).
- `npx tsc --noEmit` exit 0.
- `npm run build` exit 0, 6 routes (added `/contacts` and `/contacts/[id]`).
- `grep -rn "@/db/client" app/contacts/` returns 0 matches (D-04 holds).
- `grep -rn "asChild" app/contacts/` returns 1 match — a comment reference to the caveat; 0 JSX uses.

## Known Stubs

**1. Stub detail route `app/contacts/[id]/page.tsx`** — intentional and documented. Renders read-only fields only; no edit UI. Plan 05 explicitly scoped this as list + create; full contact-edit UX deferred to a later plan (P10 calibration or follow-up). This is the "stub" in the "not yet wired to its full UX" sense, not in the "renders empty mock data" sense — the detail page reads real DB rows for real contacts and renders them correctly.

**2. P2/P3 em-dash placeholders on the list table** — the Email / Org / Role hint cells render `—` when the underlying field is null. This is intentional rendering of real null-state data, NOT a stub. The activeDealsCount column renders a real integer from the CTE.

No other stubs. The `/contacts` route is fully functional end-to-end for VIEW-06 + PEOPLE-04.

---
*Phase: 03-people-map-contacts-registry*
*Completed: 2026-04-19*
