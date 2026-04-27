---
phase: 03-people-map-contacts-registry
verified: 2026-04-18T22:50:00Z
status: human_needed
score: 6/6 requirements verified (automated); 3 UI items queued for human eyeball review
re_verification: false
human_verification:
  - test: "/contacts page — visual layout + empty-state copy"
    expected: "Header 'Contacts' + New Contact button; search bar with debounce feel; either contact rows OR 'No contacts yet' / 'No contacts match your search' branch depending on data and filter; bottom-left 'N contact(s)' counter. Mobile viewport collapses cleanly."
    why_human: "Visual appearance, empty-state copy tone, mobile/tablet responsiveness, and debounce feel are UX properties that cannot be asserted via grep or unit tests."
  - test: "Deal detail File Contacts tab — autosuggest combobox UX"
    expected: "Typing in the ContactAutosuggest input triggers debounced (~200ms) suggestions rendered in a Popover anchored to the input. Keyboard nav (Up/Down/Enter) selects. 'Create new' CTA opens NewContactDialog with name/email prefilled from the typed query. Assigning chains create→assign atomically and updates the row without full page reload."
    why_human: "Popover positioning, debounce feel, keyboard nav, Create-new chain continuity are behavioral UX qualities requiring real interaction."
  - test: "PEOPLE-05 validation surface in the UI"
    expected: "When a user somehow triggers upsertDealPerson with role=title_partner on a non-TE deal (e.g., via direct server-action call or a latent client-side race), the error surface shows the 'Role \"title_partner\" is not valid for GI deals.' (or equivalent track code) message in a toast or inline error. App-layer gate is unit-tested; UI surfacing is the remaining human check."
    why_human: "Error message display path in the client (toast vs inline field error) is UX, not a code contract — the server-action return shape is verified by unit tests."
---

# Phase 3: People Map & Contacts Registry Verification Report

**Phase Goal:** Ship the People Map & Contacts Registry — a global `contacts` table + per-deal `deal_people` join with role slot, plus a `/contacts` page (VIEW-06) and deal-detail File Contacts tab (PEOPLE-03/04) so Carrie can see *who is on each file* and *what role they play*.

**Verified:** 2026-04-18T22:50:00Z
**Status:** human_needed (all code contracts verified; 3 UX spot-checks remain for human eye)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `contacts` + `deal_people` tables exist in schema + DB with correct FKs, cascade rules, and one-slot-per-deal unique | VERIFIED | `db/schema/app.ts:282` (`contacts`), `:330` (`dealPeople`), `:306` (partial unique on lower(email)), `:350` (`deal_people_one_per_slot_idx`); migration `drizzle/migrations/0006_contacts_and_deal_people.sql` + journal tag entry at line 51 |
| 2 | PEOPLE-05 role-compatible-with-track enforcement exists in BOTH app-layer (via `isRoleValidForTrack`) and data-layer invariants | VERIFIED | `lib/role-slots.ts:143-149` defines `isRoleValidForTrack`; `app/deal/[id]/actions/people.ts:85-90` invokes it BEFORE opening the tx with exact Success-Criterion-3 error shape; Zod-layer role enum at `lib/contact-schema.ts:91+` rejects unknown slots; `deal_people_one_per_slot_idx` is the DB safety-net for single-row invariant |
| 3 | `createDeal` dual-writes: legacy `deals.main_contact_*` columns AND new `deal_people` row are created in the SAME transaction | VERIFIED | `app/deal/new/actions.ts:99-131` writes legacy columns; lines `:143-219` add contact upsert + deal_people INSERT + 2 audit rows with `contact_create_via_new_deal` / `deal_people_upsert_via_new_deal` source markers, all inside the same `db.transaction` started at `:73` |
| 4 | Overview Main Contact reads from `deal_people` with legacy fallback | VERIFIED | `lib/deals-query.ts:292-308` LEFT JOINs dealPeople + contacts keyed on `role='main_contact'`; component `app/deal/[id]/_components/overview-card.tsx:555-561` uses `mainContactPerson.contactFullName ?? legacyMainContactName` 3-state render |
| 5 | Migration 0007 backfill is idempotent | VERIFIED | `drizzle/migrations/0007_backfill_deal_main_contact.sql` uses `DISTINCT ON (lower(TRIM(email)))` + `ON CONFLICT DO NOTHING` on both INSERTs (lines 36, 52); legacy columns preserved with COMMENT ON COLUMN markers (lines 56, 58); journal tag entry at line 58 |
| 6 | `/contacts` page (VIEW-06) + deal File Contacts tab (PEOPLE-03/04) render real data from DB queries | VERIFIED | `app/contacts/page.tsx:31` calls `queryContactsForList`; `app/contacts/_components/contacts-table.tsx:53-83` maps rows including `activeDealsCount`; `app/deal/[id]/page.tsx:64` calls `queryDealPeopleForDeal`; `people-tab.tsx:34-58` loops `slotsForTrack(trackCode)` with indexed Map lookup |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `db/schema/app.ts` contacts + dealPeople | Drizzle tables with FK cascade + partial unique + one-per-slot | VERIFIED | lines 282, 330; onDelete cascade on dealId (:336); set null on contactId (:338) |
| `drizzle/migrations/0006_contacts_and_deal_people.sql` | CREATE TABLE + indexes | VERIFIED | file exists; journal tag match |
| `drizzle/migrations/0007_backfill_deal_main_contact.sql` | Idempotent backfill | VERIFIED | DISTINCT ON + ON CONFLICT DO NOTHING; legacy COMMENT ON COLUMN markers |
| `lib/role-slots.ts` | 12 slots + isRoleValidForTrack + slotsForTrack | VERIFIED | `ROLE_SLOTS.length=12` (lines 36-120); `isRoleValidForTrack` (:143); `slotsForTrack` (:156) |
| `lib/contact-schema.ts` | 5 Zod schemas with `.strict()` | VERIFIED | createContactSchema, updateContactSchema, contactIdSchema, upsertDealPersonSchema, removeDealPersonSchema |
| `lib/contacts-query.ts` | queryContactsForList, queryContactsAutosuggest, queryContactById | VERIFIED | Imports from `@/lib/db` (canonical); active-deals CTE with `status='active'` filter |
| `lib/deal-people-query.ts` | queryDealPeopleForDeal with leftJoin(contacts) | VERIFIED | Module exists; LEFT JOIN honored for SET NULL semantics |
| `app/contacts/actions.ts` | createContact + updateContact | VERIFIED | `"use server"`; 2 `db.transaction` blocks; 2 `writeAuditLog` calls; sources `contact_create`/`contact_update`; `revalidatePath("/contacts")` 2x |
| `app/deal/[id]/actions/people.ts` | upsertDealPerson + removeDealPerson with PEOPLE-05 gate | VERIFIED | `isRoleValidForTrack` at line 85; 2 `db.transaction` blocks; `onConflictDoUpdate` on `(dealId, role)` at line 161; sources `deal_people_upsert`/`deal_people_remove`; `revalidatePath("/deal/[id]", "page")` |
| `app/deal/new/actions.ts` (D-03 dual-write) | Legacy cols + deal_people in same tx | VERIFIED | Lines 99-131 legacy insert; 143-219 contact + deal_people inside same `db.transaction` at :73; 2 new audit source markers present |
| `lib/deals-query.ts` (MainContact join) | LEFT JOIN deal_people → contacts on role='main_contact' | VERIFIED | Lines 292-308; exposes `mainContactPerson` + `legacyMainContactName` / `legacyMainContactEmail` |
| `app/contacts/page.tsx` | VIEW-06 page with search + counter | VERIFIED | 89 lines; 2 empty-state branches; counter `{contacts.length} contact(s)` |
| `app/contacts/_components/contacts-table.tsx` | Table with Name/Email/Org/Role/Active deals/Added | VERIFIED | 87 lines; renders `activeDealsCount` |
| `app/contacts/_components/contacts-search-bar.tsx` | URL-state search (D-07) | VERIFIED | 74 lines |
| `app/contacts/_components/new-contact-dialog.tsx` | Dialog wired to createContact | VERIFIED | 223 lines |
| `app/contacts/[id]/page.tsx` | Stub detail route | VERIFIED | 50 lines |
| `app/deal/[id]/_components/people-tab.tsx` | Loops slotsForTrack + indexed map | VERIFIED | 66 lines; `slotsForTrack(trackCode)` iterated; `byRole` Map lookup; lender_partner branches to LenderFreeTextRow |
| `app/deal/[id]/_components/contact-autosuggest.tsx` | Autosuggest combobox (PEOPLE-03) | VERIFIED | 133 lines; consumed by role-slot-row.tsx |
| `app/deal/[id]/_components/lender-free-text-row.tsx` | Distinct free-text row per REQUIREMENTS L85 | VERIFIED | 120 lines; separate from autosuggest combobox |
| `app/deal/[id]/_components/overview-card.tsx` MainContactReadOnly | 3-state read-from-deal_people with legacy fallback | VERIFIED | Lines 546-593; uses `fromDealPeople?.contactFullName ?? deal.legacyMainContactName` + "Edit in File Contacts →" link |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `db/schema/app.ts` dealPeople.dealId | `deals.id` | `onDelete: "cascade"` | WIRED | line 336 |
| `db/schema/app.ts` dealPeople.contactId | `contacts.id` | `onDelete: "set null"` | WIRED | line 338 |
| `db/schema/app.ts` contacts.createdBy | `users.id` | FK reference | WIRED | (references users) |
| `app/deal/[id]/actions/people.ts` | `lib/role-slots.ts` | `isRoleValidForTrack` | WIRED | line 85 — PEOPLE-05 gate invoked before tx |
| `app/deal/[id]/actions/people.ts` | Next.js revalidation | `revalidatePath("/deal/[id]", "page")` | WIRED | lines 179, 219 |
| `app/deal/new/actions.ts` | deal_people via same tx | Inside `db.transaction` at :73 | WIRED | lines 143-219 inside the same tx |
| `app/contacts/actions.ts` | `lib/audit.ts` writeAuditLog | Inside db.transaction | WIRED | 2 calls, one per action |
| `lib/deals-query.ts` | deal_people join | LEFT JOIN on `role='main_contact'` | WIRED | lines 292-308 |
| `app/contacts/page.tsx` | `lib/contacts-query.ts` | `queryContactsForList(filters.q)` | WIRED | line 31 |
| `app/deal/[id]/page.tsx` | `lib/deal-people-query.ts` | `queryDealPeopleForDeal(deal.id)` | WIRED | line 64 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `app/contacts/page.tsx` | `contacts` | `queryContactsForList(filters.q)` → `db.with(...).select(...).from(contacts).leftJoin(activeCount...)` | Yes — real SELECT with CTE for active-deals count | FLOWING |
| `app/deal/[id]/_components/people-tab.tsx` | `dealPeople` prop | `queryDealPeopleForDeal(deal.id)` in page.tsx:64 → real LEFT JOIN select | Yes | FLOWING |
| `app/deal/[id]/_components/overview-card.tsx::MainContactReadOnly` | `deal.mainContactPerson` | `lib/deals-query.ts:292-308` LEFT JOIN dealPeople + contacts filtered to `role='main_contact'` | Yes — includes legacy-column fallback path | FLOWING |
| `app/contacts/_components/contacts-table.tsx` | `contacts` prop | Same CTE path | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type-check clean | `npx tsc --noEmit` | exit 0 (no output) | PASS |
| Full test suite | `npx vitest run` | Test Files 29 passed (29); Tests 298 passed (298); 52.14s | PASS |
| Production build | `npm run build` | Compiled successfully; routes `/`, `/contacts`, `/contacts/[id]`, `/deal/[id]`, `/deal/new` generated | PASS |
| Migration journal tags | grep 0006 + 0007 in `_journal.json` | both tags present (lines 51, 58) | PASS |
| PEOPLE-05 app-layer test | `tests/unit/deal-people-actions.test.ts` referenced by suite | Included in 298/298 passing | PASS |
| D-03 dual-write test | `tests/unit/create-deal-people-dual-write.test.ts` | Included in 298/298 passing | PASS |
| Role slots registry test | `tests/unit/role-slots.test.ts` | Included in 298/298 passing | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PEOPLE-01 | 03-01, 03-04 | Global `contacts` registry (full_name, role_hint, org, email, phone, notes) | SATISFIED | Schema `db/schema/app.ts:282`; CRUD `app/contacts/actions.ts`; migration 0006 + 0007 |
| PEOPLE-02 | 03-01, 03-02, 03-04 | `deal_people` link with per-track role slots; 12 slot taxonomy; one-row-per-slot invariant | SATISFIED | Schema `:330` + unique `deal_people_one_per_slot_idx` at `:350`; `ROLE_SLOTS` with 12 entries; `upsertDealPerson.onConflictDoUpdate` preserves invariant |
| PEOPLE-03 | 03-03, 03-06 | Autosuggest shows existing contacts matching name/email | SATISFIED | `lib/contacts-query.ts::queryContactsAutosuggest`; `app/deal/[id]/_components/contact-autosuggest.tsx` (133 lines); `role-slot-row.tsx` wires it |
| PEOPLE-04 | 03-03, 03-05 | `/contacts` page lists all contacts with "on N active deals" count | SATISFIED | CTE in `lib/contacts-query.ts` with `status='active'` filter; `contacts-table.tsx` renders `activeDealsCount` |
| PEOPLE-05 | 03-02, 03-04 | Role slots enforced per track in application code | SATISFIED | `isRoleValidForTrack` (lib/role-slots.ts:143); gated BEFORE tx at `app/deal/[id]/actions/people.ts:85-90` with exact error shape; Zod enum rejects unknown roles |
| VIEW-06 | 03-03, 03-05 | `/contacts` shows global contacts with search + "on N active deals" | SATISFIED | `/contacts` route built (present in build output); search via URL-state `?q=`; ILIKE on full_name/email/org; counter |

No ORPHANED requirements — all 6 requirement IDs mapped to plans, and all plans' `requirements:` frontmatter is accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No blocker anti-patterns. No TODO/FIXME/placeholder comments in the P3 implementation files. Legacy `deals.main_contact_*` columns retained intentionally with `COMMENT ON COLUMN` LEGACY markers (migration 0007) — scheduled for drop in P10. |

### Human Verification Required

1. **`/contacts` page — visual layout + empty-state copy**
   - Test: Navigate to `/contacts` with and without contacts seeded; toggle search `?q=`
   - Expected: Header "Contacts" + New Contact button; search bar with debounce feel; either contact rows OR "No contacts yet" / "No contacts match your search" branch; bottom counter.
   - Why human: Visual appearance + empty-state copy tone + mobile responsiveness cannot be asserted programmatically.

2. **Deal detail File Contacts tab — autosuggest combobox UX**
   - Test: Open `/deal/[id]` File Contacts tab; click an empty role slot; type a partial name
   - Expected: Debounced (~200ms) suggestions in an anchored Popover; keyboard nav; "Create new" CTA prefilled; inline create+assign chain
   - Why human: Popover positioning + debounce feel + keyboard nav are behavioral UX.

3. **PEOPLE-05 error message surfacing in the UI**
   - Test: Force an invalid role/track pairing via server-action direct call
   - Expected: "Role \"{role}\" is not valid for {track} deals." surfaced in toast/inline error
   - Why human: UI error-message render path is UX, not a code contract. Server-action return shape is already unit-tested.

### Gaps Summary

No code gaps. Every Phase 3 must-have is present in the codebase, wired end-to-end, and covered by tests (298/298 passing; tsc + build clean). The D-03 closure is complete at three layers as claimed by the ROADMAP: data (migration 0007 backfill idempotent + preserves legacy columns), write-path (`createDeal` dual-writes in one transaction), and UI (Overview Main Contact reads from `deal_people` with legacy fallback).

The only remaining verification work is human eyeball review of three UI behaviors (listed above) that cannot be asserted via grep or unit tests. No blocker, warning, or regression anti-patterns were found.

---

*Verified: 2026-04-18T22:50:00Z*
*Verifier: Claude (gsd-verifier)*
