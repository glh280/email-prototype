---
status: partial
phase: 03-people-map-contacts-registry
source: [03-VERIFICATION.md]
started: 2026-04-18T22:50:00Z
updated: 2026-04-19T15:25:00Z
---

## Current Test

[operator reviewed on deployed build; 1 pass-with-caveat, 2 + 3 deferred until deal data seeded]

## Tests

### 1. /contacts page — visual layout + empty-state copy + mobile responsiveness
expected: Navigate to `/contacts` with and without contacts seeded, and toggle search via `?q=`. Header "Contacts" + New Contact button visible; search bar feels debounced (no jank on rapid typing); either contact rows render OR one of two empty-state branches shows — "No contacts yet" (unfiltered, no data) or "No contacts match your search" (filtered, no data). Bottom-left `N contact(s)` counter updates. Layout collapses cleanly on mobile/tablet viewports; New Contact button remains reachable.
result: partial-pass
notes: |
  Operator created a test contact successfully on deployed build (commit cbe03de, 2026-04-19).
  Create flow works end-to-end: dialog opens, Zod validation present, createContact Server Action fires,
  toast + router.refresh cycle behaves, row appears in table.

  GAP FOUND: no UI to edit or delete a contact. `updateContact` Server Action exists (shipped in Plan 03-04)
  but no dialog / detail page surfaces it; `deleteContact` Server Action does not exist at all.
  PEOPLE-01 in REQUIREMENTS.md says "Global contacts registry (CRUD)" — current implementation is CR, not CRUD.
  This is a requirements-verification blind spot: 03-VERIFICATION.md passed PEOPLE-01 by spot-checking that
  `app/contacts/actions.ts::updateContact` exists as a function, not that the UI surfaces it.

  Follow-up: gap-closure phase (likely 03.1) to ship contact-edit dialog + deleteContact Server Action +
  row-level delete button with confirm-modal + active-deal-count check (refuse delete if contact is
  assigned to any active deal via deal_people).

### 2. Deal detail File Contacts tab — autosuggest combobox UX
expected: Open `/deal/[id]` and switch to File Contacts tab. Click an empty role slot and type a partial name. Debounced (~200ms) suggestions appear in a Popover anchored under the input; Up/Down arrow keys navigate, Enter selects. "Create new" CTA at the bottom opens the NewContactDialog with name/email prefilled from the typed query. Assigning chains create→assign atomically and the row updates without a full page reload. Popover closes cleanly on outside-click and ESC.
result: [pending]

### 3. PEOPLE-05 invalid-role error message surface in the UI
expected: When an invalid role/track pairing is submitted (e.g., `role=title_partner` on a GI-track deal), the error message `"Role \"title_partner\" is not valid for GI deals."` (or equivalent track code) surfaces to the user — either as a toast or as an inline field error. The user is not left staring at a silent failure. App-layer gate is already unit-tested; this is the UX surfacing check only.
result: [pending]

## Summary

total: 3
passed: 0
issues: 1
pending: 2
skipped: 0
blocked: 0
partial-pass: 1

## Gaps

### GAP-01: Contact edit + delete UI missing (PEOPLE-01 CRUD \u2192 CR shipped)
severity: medium
source: UAT Test 1, operator feedback 2026-04-19
scope: |
  - `updateContact` Server Action exists at `app/contacts/actions.ts` but is not wired to any UI
  - `deleteContact` Server Action does not exist
  - Contact rows in `/contacts` have no edit or delete affordance
  - Contact detail page `/contacts/[id]` is a stub (50 lines per Plan 03-05 SUMMARY)
suggested_fix: gap-closure phase 03.1 with ~3 plans:
  1. Ship `deleteContact` Server Action with deal_people active-use refusal + audit row
  2. Ship contact-edit dialog (reuse NewContactDialog shell with props.mode="edit")
  3. Wire row actions (edit pencil + delete trash) into contacts-table.tsx
deferred_until: after ClickUp import lands (so the fix can be tested against real imported data)

