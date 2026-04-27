---
phase: 03-people-map-contacts-registry
plan: 04
subsystem: server-actions
tags: [server-actions, contacts, deal-people, zod, audit, rollback, people-01, people-02, people-05, tdd]

# Dependency graph
requires:
  - phase: 03-people-map-contacts-registry/01
    provides: "contacts + deal_people tables; deal_people_one_per_slot_idx unique index (the UPSERT conflict target); contacts_email_unique_idx partial unique (dedupe safety net)"
  - phase: 03-people-map-contacts-registry/02
    provides: "createContactSchema / updateContactSchema / contactIdSchema / upsertDealPersonSchema / removeDealPersonSchema (all .strict()); isRoleValidForTrack PEOPLE-05 primitive; ROLE_SLOTS registry with per-slot source metadata"
  - phase: 02-deal-detail-tasks-stages/04
    provides: "Canonical D-05 pattern (DML + writeAuditLog inside one db.transaction) and the rollback invariant test shape (vi.doMock audit throw)"
provides:
  - "createContact Server Action — PEOPLE-01 write path for /contacts page forms"
  - "updateContact Server Action — PEOPLE-01 edit with split-parse + empty-diff noop"
  - "upsertDealPerson Server Action — PEOPLE-02 + PEOPLE-05 per-slot assignment with onConflictDoUpdate UPSERT"
  - "removeDealPerson Server Action — idempotent slot clearing"
  - "New audit `source` vocab in the app lexicon: contact_create, contact_update, deal_people_upsert, deal_people_remove"
  - "isUniqueViolation(e) helper — unwraps drizzle-wrapped pg errors via .cause chain to detect code=23505"
affects:
  - "03-05 /contacts page UI (calls createContact/updateContact from forms)"
  - "03-06 deal-detail File Contacts tab (calls upsertDealPerson/removeDealPerson per slot row)"
  - "03-07 D-03 backfill migration 0007 — can rely on deal_people_one_per_slot_idx as the ON CONFLICT DO NOTHING target; runs at DB level, not through these actions"
  - "Future email-template plans that mutate deal_people rows"

# Tech tracking
tech-stack:
  added: []  # Pure server-action plan; zero new deps
  patterns:
    - "isUniqueViolation() unwraps drizzle's wrapping error via .cause chain — drizzle rethrows pg errors with the pg error as .cause, so e.code is the drizzle code ('drizzle.query.error' or similar) and e.cause.code is the pg code ('23505'). The helper recurses through .cause to find 23505 at any depth."
    - "PEOPLE-05 gate runs BEFORE the transaction opens — keeps the error path clean (no wasted BEGIN/ROLLBACK for known-invalid inputs) and makes the error message shape stable for test assertion ('Role \"x\" is not valid for GI deals.')"
    - "UPSERT via drizzle .onConflictDoUpdate({ target: [dealPeople.dealId, dealPeople.role], set: { contactId } }) — leverages the existing deal_people_one_per_slot_idx as the conflict target; pre-read distinguishes INSERT from UPDATE for the audit operation column"
    - "Free-text lender_partner branch synthesizes a minimal contact row INSIDE the same tx (full_name=freeTextValue, role_hint='lender'), wires deal_people.contact_id to it, and writes a secondary contact_create audit row — keeps deal_people shape uniform (every row has a contact_id FK) with full audit coverage"
    - "revalidatePath('/deal/[id]', 'page') for dynamic-route cache invalidation — Next.js 16 signature documented in node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md"
    - "Empty-diff short-circuit in updateContact returns {ok:true, noop:true} and writes NO audit row — mirrors P2 updateDeal noise-reduction (Carrie saving an untouched form shouldn't pollute the Audit tab)"

key-files:
  created:
    - "app/contacts/actions.ts — 175 lines; createContact + updateContact + isUniqueViolation helper; 2 db.transaction blocks, 2 writeAuditLog call sites, 2 revalidatePath calls"
    - "app/deal/[id]/actions/people.ts — 221 lines; upsertDealPerson + removeDealPerson; 2 db.transaction blocks, 3 writeAuditLog call sites (upsert base + free-text contact_create + remove), 1 onConflictDoUpdate, 2 revalidatePath calls"
    - "tests/unit/contact-actions.test.ts — 8 real-Postgres assertions incl. rollback invariant"
    - "tests/unit/deal-people-actions.test.ts — 12 real-Postgres assertions incl. PEOPLE-05 gate + UPSERT semantics + rollback invariant"
  modified: []

key-decisions:
  - "isUniqueViolation() unwraps .cause recursively instead of checking e.code directly — drizzle wraps node-postgres errors, so the native pg 23505 code is on e.cause (or deeper in some driver paths). Recursive .cause walk is stable across drizzle + node-postgres version bumps."
  - "Tests placed at tests/unit/ (not tests/integration/ as plan text said) — same decision as Plan 03-03. vitest.config.ts include glob is 'tests/unit/**/*.test.ts'; putting tests at tests/integration/ would orphan them. Test file docstrings note the decision."
  - "PEOPLE-05 gate runs BEFORE the transaction (not inside) — clean error path without BEGIN/ROLLBACK overhead for known-invalid inputs; stable error message shape for assertion."
  - "Empty-string email coerced to null in createContact before INSERT — createContactSchema accepts z.literal('') as a convenience for forms, but storing empty strings would pollute the partial unique index lookup semantics. Normalize at the storage boundary."
  - "Update path diff computation uses normalize(v) = (v===null||v===undefined||v==='') ? null : v — mirrors P2 OverviewCard diff semantics; saving a form where the caller accidentally sends empty-string for an optional column does not produce a spurious UPDATE."
  - "Free-text lender_partner contact_create runs inside the same tx as the deal_people insert — if the deal_people INSERT fails (shouldn't, onConflictDoUpdate), the orphan contact rolls back too. Single tx = all or nothing."
  - "removeDealPerson pre-read lives OUTSIDE the tx (read) with DELETE+audit INSIDE the tx (write). The pre-read is only for the idempotent short-circuit; the actual mutation is atomic."
  - "audit beforeJson/afterJson for deal_people UPDATE is the full drizzle row object (camelCase keys: contactId, dealId, role) — matches P2 deal-actions.test.ts convention. Tests read both .contactId and .contact_id for forward-compatibility."

patterns-established:
  - "isUniqueViolation helper pattern — reusable for any table with a UNIQUE constraint that we want to translate into a graceful {ok:false, error} response instead of throwing. Future plans extending the write surface can import and reuse."
  - "Application-layer PEOPLE-05 gate (isRoleValidForTrack before tx) — complements the DB-layer PEOPLE-02 safety net (deal_people_one_per_slot_idx). Two independent enforcement points for two different invariants."
  - "Free-text slot source synthesizes a real contact row + writes its own audit trail — future free_text slots (none planned, but if P10 adds one) follow the same pattern."

requirements-completed: [PEOPLE-01, PEOPLE-02, PEOPLE-05]

# Metrics
duration: 8m 7s
completed: 2026-04-18
---

# Phase 3 Plan 04: Contact + Deal-People Server Actions Summary

**Four Server Actions — `createContact`, `updateContact`, `upsertDealPerson`, `removeDealPerson` — land the PEOPLE-01/02/05 write path with strict TDD (RED → GREEN per task), the D-05 atomicity contract (DML + audit in ONE `db.transaction`, rollback invariant proven by mocked audit throw), the PEOPLE-05 track-compat gate running BEFORE the transaction with the exact error shape asserted by Phase 3 Success Criterion 3, UPSERT semantics via `.onConflictDoUpdate` on the existing `deal_people_one_per_slot_idx`, and the `lender_partner` free_text branch that synthesizes a minimal contact row inside the same tx. Full suite 264/264 green (244 baseline + 20 new).**

## Performance

- **Duration:** 8m 7s
- **Started:** 2026-04-19T01:48:59Z
- **Completed:** 2026-04-19T01:57:06Z
- **Tasks:** 2 (both TDD — RED + GREEN per task = 4 commits)
- **Files created:** 4 (2 source modules, 2 test files)

## Accomplishments

- `app/contacts/actions.ts` ships `createContact` and `updateContact` wrapping DML + audit in one `db.transaction`. Both use the `createContactSchema`/`updateContactSchema`/`contactIdSchema` contracts from Plan 02. `updateContact` uses the P2 split-parse convention so `.strict()` rejects unknown keys. Empty-diff short-circuits with `{ok:true, noop:true}` and writes NO audit row.
- `app/deal/[id]/actions/people.ts` ships `upsertDealPerson` (with PEOPLE-05 gate running BEFORE the tx — exact error shape `"Role \"title_partner\" is not valid for GI deals."` asserted by test 3) and `removeDealPerson` (idempotent on missing slot). UPSERT via drizzle's `.onConflictDoUpdate` on the existing `deal_people_one_per_slot_idx` conflict target. Pre-read distinguishes INSERT from UPDATE for the audit `operation` column.
- Free-text `lender_partner` branch: synthesizes a minimal contact row (`full_name=freeTextValue`, `role_hint='lender'`) inside the same tx, wires `deal_people.contact_id` to it, writes a `contact_create` audit row. Single tx = all-or-nothing.
- `isUniqueViolation(e)` helper unwraps drizzle's wrapping error via `.cause` chain to detect the pg 23505 code — translates duplicate-email INSERTs into `{ok:false, error: 'A contact with this email already exists.'}` instead of throwing to the caller.
- Four new `source` markers added to the app audit vocab: `contact_create`, `contact_update`, `deal_people_upsert`, `deal_people_remove`.
- 20 new assertions (8 contact-actions + 12 deal-people-actions); full suite **264/264** (up from 244 after P3 Plan 03). `npx tsc --noEmit` clean. `npm run build` green (4 routes unchanged — no UI shipped in this plan).

## Task Commits

Each task was committed atomically (TDD produces RED + GREEN as separate commits):

1. **Task 1 RED: failing tests for createContact + updateContact** — `0739e93` (test)
2. **Task 1 GREEN: createContact + updateContact Server Actions (PEOPLE-01)** — `c905b8b` (feat)
3. **Task 2 RED: failing tests for upsertDealPerson + removeDealPerson** — `2d6d25e` (test)
4. **Task 2 GREEN: upsertDealPerson + removeDealPerson (PEOPLE-02 + PEOPLE-05)** — `59e65f0` (feat)

**Plan metadata commit:** _pending_ (docs: complete plan — final commit appended after self-check)

## Files Created/Modified

- `app/contacts/actions.ts` — 175 lines. Module header documents the D-05 atomicity pattern inheritance, the new audit source markers added in this plan, the dedupe strategy (partial unique index + isUniqueViolation helper), and the split-parse convention for updateContact. Two `db.transaction` blocks, two `writeAuditLog` call sites, two `revalidatePath("/contacts")` calls.
- `app/deal/[id]/actions/people.ts` — 221 lines. Module header documents the PEOPLE-05 gate-before-tx pattern, the UPSERT semantics via `onConflictDoUpdate`, the free-text lender_partner branch that inserts a minimal contact row inside the same tx, the pre-read for create-vs-update audit `operation`, the new source markers, and the Next.js 16 dynamic-route `revalidatePath` signature. Two `db.transaction` blocks (upsert + remove), three `writeAuditLog` call sites (upsert-base + free-text contact_create + remove), one `onConflictDoUpdate`, two `revalidatePath("/deal/[id]", "page")` calls.
- `tests/unit/contact-actions.test.ts` — 8 assertions: happy create + audit source='contact_create'; missing fullName → errors; unknown key → errors (.strict()); duplicate email → graceful error + first row still present; rollback invariant (vi.doMock audit throw → NO row); updateContact happy + audit source='contact_update'; updateContact empty diff noop (NO new audit row); updateContact unknown key rejected.
- `tests/unit/deal-people-actions.test.ts` — 12 assertions: upsert happy INSERT + audit create/source='deal_people_upsert'; second upsert same slot → UPDATE with contact_id change; PEOPLE-05 gate rejects `title_partner` on `GI` deal with exact error shape; unknown role rejected at Zod; contact_fk slot missing contactId → errors:{contactId}; lender_partner free_text happy + minimal contact row creation + wiring; lender_partner missing freeTextValue → errors:{freeTextValue}; rollback invariant (vi.doMock audit throw); remove happy + audit delete/source='deal_people_remove'; remove idempotent on missing slot (noop, NO audit); remove unknown role at Zod; 3-slot + 1-remove data integrity (2 remain, unique per slot).

## Decisions Made

- **`isUniqueViolation` unwraps `.cause` recursively.** Drizzle wraps node-postgres errors — `e.code` is the drizzle-level code (e.g. `drizzle.query.error`), and the actual pg `23505` lives on `e.cause.code` (or deeper in some driver code paths). A recursive `.cause` walk is stable across drizzle + node-postgres version bumps; static `e.cause.code` checks are brittle.
- **Test file location: `tests/unit/` not `tests/integration/`.** Same decision as Plan 03-03 (documented as a Rule 3 deviation there). `vitest.config.ts` restricts discovery to `tests/unit/**/*.test.ts`; placing tests at `tests/integration/` would orphan them. Did NOT modify vitest config — that would have been Rule 4 architectural. Test file docstrings call out the decision.
- **PEOPLE-05 gate runs BEFORE the transaction, not inside it.** Clean error path (no wasted `BEGIN`/`ROLLBACK` for known-invalid inputs) and stable error message shape for assertion. Test 3 matches the exact string `"Role \"title_partner\" is not valid for GI deals."` — the Phase 3 Success Criterion 3 primary proof point.
- **Empty-string email coerced to `null` before INSERT in createContact.** `createContactSchema` accepts `z.literal("")` as a form convenience, but storing empty strings would pollute the partial unique index lookup semantics (empty string is not null). Normalize at the storage boundary.
- **Update diff normalizer treats `null`, `undefined`, and `""` as equivalent.** Mirrors P2 OverviewCard diff semantics. A form that sends `email: ""` for an already-null column does not produce a spurious UPDATE row.
- **Free-text `lender_partner` `contact_create` runs inside the same tx as the `deal_people` insert.** If the `deal_people` insert fails (shouldn't, given `onConflictDoUpdate`), the orphan contact rolls back too. Single tx = all or nothing.
- **`removeDealPerson` pre-read outside the tx; DELETE + audit inside.** Pre-read is only for the idempotent short-circuit; the actual mutation is atomic. No race risk because the worst case is a concurrent INSERT between the pre-read and the DELETE — the DELETE is idempotent-equivalent (would just delete the row that got re-added), and the audit row captures the beforeJson correctly.
- **`onConflictDoUpdate` `set: { contactId: resolvedContactId }` — only updates `contactId`, not `created_by`.** Preserves the original creator for audit trail. The updated-on-upsert row semantically represents a re-assignment, not a re-creation.
- **Audit `beforeJson`/`afterJson` read as camelCase in tests** — drizzle `$inferSelect` row objects are camelCase (`fullName`, `contactId`), and jsonb stores them as-is. Matches P2 `deal-actions.test.ts` convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test file location changed from `tests/integration/` to `tests/unit/`**

- **Found during:** Task 1 RED phase (about to create the test file)
- **Issue:** Plan `files_modified` frontmatter and `<read_first>` instructions referenced `tests/integration/contact-actions.test.ts` and `tests/integration/deal-people-actions.test.ts`, but `vitest.config.ts` has `include: ["tests/unit/**/*.test.ts"]`. Tests placed at `tests/integration/` would not be discovered by the runner.
- **Fix:** Placed both test files at `tests/unit/` matching the P2 convention (deal-actions.test.ts, task-actions.test.ts, note-actions.test.ts, stage-actions.test.ts) and the Plan 03-03 precedent. Did NOT modify `vitest.config.ts`.
- **Files modified:** Test files placed at `tests/unit/` instead of `tests/integration/`.
- **Verification:** `npm test` discovers and runs both files; 20/20 new tests pass; full suite 264/264 green.
- **Committed in:** `0739e93` (Task 1 RED) and `2d6d25e` (Task 2 RED).

**2. [Rule 1 - Bug] `isUniqueViolation` required to unwrap drizzle-wrapped errors**

- **Found during:** Task 1 GREEN (after initial implementation used `e?.code === "23505"` directly)
- **Issue:** The plan's code sketch used `if (e?.code === "23505") return {ok:false, error: ...}`. In practice drizzle wraps node-postgres errors; the thrown error is a drizzle error and `e.code` is not `23505` — the pg error is on `e.cause`. Test 4 (duplicate email) failed because the error escaped the try/catch with the 23505 on `.cause` rather than the top level.
- **Fix:** Added `isUniqueViolation(e)` helper that recurses through `.cause` chain looking for `code === "23505"`. Catches both the direct pg error (future-proof if drizzle stops wrapping) and the wrapped case (current behavior).
- **Files modified:** `app/contacts/actions.ts` — added helper function, updated both createContact and updateContact catch blocks.
- **Verification:** Test 4 now passes; `second.error` matches `/already exists/i`; first Alice row still present.
- **Committed in:** `c905b8b` (Task 1 GREEN).

**3. [Rule 1 - Bug] Test 6 assertion used snake_case (`full_name`) but drizzle emits camelCase**

- **Found during:** Task 1 GREEN (Test 6 failed with `expected undefined to be 'Original'`)
- **Issue:** Initial test wrote `expect(before.full_name).toBe("Original")`. Drizzle's `$inferSelect` rows serialize to jsonb with camelCase keys (`fullName`), not Postgres snake_case. Existing P2 `deal-actions.test.ts` reads `before.title` (camelCase) — same pattern.
- **Fix:** Updated Test 6 to read `before.fullName` / `after.fullName` / `after.source`. Kept the comment noting the convention.
- **Files modified:** `tests/unit/contact-actions.test.ts`.
- **Verification:** Test 6 passes; before.fullName='Original', after.fullName='Renamed', after.source='contact_update'.
- **Committed in:** `c905b8b` (Task 1 GREEN).

---

**Total deviations:** 3 auto-fixed (1 blocking + 2 bugs). No architectural decisions required (no Rule 4 stops).
**Impact on plan:** Zero scope creep. All behavior contracts and acceptance criteria met exactly as specified (modulo the test-path rename).

## Issues Encountered

- **Drizzle error wrapping** — initially caught as a plain `e.code === "23505"` check; ~30 seconds to diagnose and add the recursive `.cause` walker. Resolved; `isUniqueViolation` helper now documented in the module header as a reusable pattern.
- **camelCase vs snake_case audit body keys** — Test 6 assertion miswritten against snake_case. Fixed to match drizzle `$inferSelect` output (camelCase). Documented in SUMMARY key-decisions.
- **No other issues** — UPSERT, free-text branch, rollback invariant, PEOPLE-05 gate, and idempotent remove all worked first try in Task 2 GREEN (12/12 passed on initial run).

## User Setup Required

None — pure server-action plan, no external-service configuration.

## Next Phase Readiness

Remaining P3 plans are unblocked:

- **Plan 03-05 (`/contacts` page):** can freely import `createContact`/`updateContact` from `@/app/contacts/actions` and wire them into the "New contact" dialog form + per-row edit panel. RHF client-side validation uses `createContactSchema`/`updateContactSchema` from Plan 02 (same contracts, same shape, same error messages).
- **Plan 03-06 (deal-detail File Contacts tab):** imports `upsertDealPerson`/`removeDealPerson` from `@/app/deal/[id]/actions/people` and wires them into per-slot row controls. Slot rendering uses `slotsForTrack(deal.track.code)` from Plan 02; autosuggest uses `queryContactsAutosuggest` from Plan 03.
- **Plan 03-07 (D-03 backfill migration 0007):** no direct dependency on these actions — the backfill runs at the SQL level against the existing `deal_people_one_per_slot_idx` unique index with `ON CONFLICT DO NOTHING`. The actions here share the same conflict-target index, so once 0007 runs, subsequent user-driven upserts continue to work (the backfilled rows become the pre-read result in `upsertDealPerson`).

**P3 progresses to 4/7 plans shipped** (waves 1 + 2 + 3 done: 01, 02, 03, 04). Wave 4 is Plan 05 + 06 (UI), Wave 5 is Plan 07 (backfill).

## Self-Check: PASSED

Verified before writing SUMMARY:

- Source files:
  - `app/contacts/actions.ts` FOUND; `"use server"` on line 1; `createContact` + `updateContact` + `isUniqueViolation` exported/defined; 2 `db.transaction` call sites; 2 `writeAuditLog` call sites; 2 `revalidatePath("/contacts")` calls; 1 `source: "contact_create"` literal; 1 `source: "contact_update"` literal. No `@/db/client` import (D-04 holds). No `mainContact` reference (Plan 06 boundary holds).
  - `app/deal/[id]/actions/people.ts` FOUND; `"use server"` on line 1; `upsertDealPerson` + `removeDealPerson` exported; 2 `db.transaction` call sites; 3 `writeAuditLog` call sites (base upsert + free-text contact_create + remove); 1 `onConflictDoUpdate`; 2 `revalidatePath("/deal/[id]", "page")` calls; 1 `isRoleValidForTrack` call site; 1 `source: "deal_people_upsert"` literal; 1 `source: "deal_people_remove"` literal. No `@/db/client`, no `mainContact`.
- Test files:
  - `tests/unit/contact-actions.test.ts` FOUND; 8/8 passing.
  - `tests/unit/deal-people-actions.test.ts` FOUND; 12/12 passing.
- Commits:
  - `0739e93` test(03-04) RED contact-actions — FOUND via `git log --oneline | grep 0739e93`
  - `c905b8b` feat(03-04) GREEN contact-actions — FOUND
  - `2d6d25e` test(03-04) RED deal-people-actions — FOUND
  - `59e65f0` feat(03-04) GREEN deal-people-actions — FOUND
- Full suite: `npm test` → **264/264 passing** (244 baseline + 20 new: 8 contact-actions + 12 deal-people-actions).
- `npx tsc --noEmit` exit 0.
- `npm run build` exit 0, 4 routes (`/`, `/_not-found`, `/deal/[id]`, `/deal/new`) — unchanged (no UI shipped in this plan).

## Known Stubs

None. This plan ships server actions (write path). Plans 05 and 06 will consume these actions to wire UI forms and per-slot row controls; until then, no surface renders stub data for contacts or deal_people. The deal-detail File Contacts tab continues to show its P2 placeholder content (documented in P2 Plan 05 SUMMARY as intentionally deferred to P3 Plan 06). That stub is tracked in the P2 summary and will be resolved in Plan 06.

---
*Phase: 03-people-map-contacts-registry*
*Completed: 2026-04-18*
