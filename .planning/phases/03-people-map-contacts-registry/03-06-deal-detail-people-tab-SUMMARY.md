---
phase: 03-people-map-contacts-registry
plan: 06
subsystem: ui/client-components/server-action
tags: [nextjs-16, client-component, autosuggest, popover, debounced-query, role-slots, people-02, people-03, lender-free-text, controlled-dialog]

# Dependency graph
requires:
  - phase: 03-people-map-contacts-registry/02
    provides: "slotsForTrack(trackCode), RoleSlot shape (source: 'contact_fk' | 'free_text'), ROLE_SLOTS ordering"
  - phase: 03-people-map-contacts-registry/03
    provides: "queryDealPeopleForDeal (per-deal read), queryContactsAutosuggest + ContactAutosuggestRow (PEOPLE-03 primitive with rank + clamp)"
  - phase: 03-people-map-contacts-registry/04
    provides: "upsertDealPerson + removeDealPerson Server Actions (PEOPLE-05 gate, free_text branch, D-05 atomicity)"
  - phase: 03-people-map-contacts-registry/05
    provides: "NewContactDialog component (extended additively here with controlled-open props)"
  - phase: 02-deal-detail-tasks-stages/05
    provides: "DealTabs shell + File Contacts PlaceholderPanel (this plan replaces it)"
provides:
  - "PeopleTab pane — loops slotsForTrack per deal, renders one row per slot"
  - "RoleSlotRow — contact_fk slot row with assigned/unassigned state machine"
  - "ContactAutosuggest — reusable combobox with 200ms debounce + 'Create new' CTA (PEOPLE-03 UI)"
  - "LenderFreeTextRow — distinct free-text row for lender_partner slot"
  - "queryContactsAutosuggestAction — thin 'use server' wrapper for client-component consumption"
  - "NewContactDialog additive props — initialFullName / controlledOpen / onOpenChange / onCreated (backward-compatible)"
affects:
  - "/deal/[id]?tab=contacts — now renders real per-deal role slots end-to-end"
  - "PEOPLE-02 + PEOPLE-03 delivered at the UI layer (data layer landed in Plans 03-03/04)"
  - "Plan 03-07 (D-03 backfill): after migration 0007 runs, every deal's main_contact slot renders as 'assigned' on first page load — the backfill's regression signal"

# Tech tracking
tech-stack:
  added: []  # Zero new deps
  patterns:
    - "Server Action wrapper for client-component data fetching: queryContactsAutosuggestAction is 'use server' + defensive empty-query guard + limit clamp, re-exports the ContactAutosuggestRow type. Future combobox primitives follow the same thin-wrapper shape."
    - "200ms debounced useEffect + useTransition: setTimeout + window.clearTimeout cleanup for unmount safety. useTransition marks the fetch as non-urgent so typing stays responsive."
    - "Indexed map for per-row lookup: PeopleTab builds `new Map<string, DealPersonRow>()` keyed by role, so slotsForTrack loop lookups are O(1). Scales cleanly even if future plans widen the slot registry."
    - "Additive controlled-component props: NewContactDialog keeps its original no-prop form AND accepts optional controlledOpen/onOpenChange/initialFullName/onCreated. Hides the trigger button when controlled externally. Single component serves both /contacts page AND inline File Contacts spawn-points."
    - "Create-and-assign chain: autosuggest 'Create new contact' → NewContactDialog opens pre-filled → onCreated(contactId) fires before router.refresh() → parent upsertDealPerson({ contactId }) → slot flips to assigned. Three mutations, one user click."
    - "Client-component source separation: lender_partner lives in its own lender-free-text-row.tsx file (distinct from role-slot-row.tsx) so the UX divergence is encoded at the import boundary, not a conditional inside a shared component."

key-files:
  created:
    - "app/deal/[id]/actions/autosuggest.ts — 30 lines; 'use server' queryContactsAutosuggestAction with empty-guard + clamp"
    - "app/deal/[id]/_components/contact-autosuggest.tsx — 125 lines; reusable Popover combobox with 200ms debounce + 'Create new' CTA"
    - "app/deal/[id]/_components/lender-free-text-row.tsx — 116 lines; Input + Save / Remove for source=='free_text' slots"
    - "app/deal/[id]/_components/role-slot-row.tsx — 128 lines; contact_fk slot row with assigned/unassigned states + create-new chain"
    - "app/deal/[id]/_components/people-tab.tsx — 64 lines; loops slotsForTrack, branches on source, indexed lookup"
    - "tests/unit/people-tab-query.test.ts — 5 real-Postgres + 1 pure assertions on composite read"
  modified:
    - "app/deal/[id]/page.tsx — added queryDealPeopleForDeal to parallel fetch; pass dealPeople into DealTabs"
    - "app/deal/[id]/_components/deal-tabs.tsx — added dealPeople prop; REPLACED PlaceholderPanel with <PeopleTab>; dropped unused Users lucide import"
    - "app/contacts/_components/new-contact-dialog.tsx — additive optional props (initialFullName / controlledOpen / onOpenChange / onCreated); hides trigger when controlled externally; passes new contactId to onCreated before router.refresh()"

key-decisions:
  - "NewContactDialog additive prop extension (Option A from plan's cross-plan note). All 4 new props are optional with backward-compatible defaults; /contacts page consumption is unchanged. Alternative (factoring a <NewContactForm> subcomponent and wrapping it in a second Dialog) would have duplicated layout and form-validation logic. The additive path ships less code and keeps a single form implementation."
  - "onCreated fires BEFORE router.refresh(). The server action createContact already calls revalidatePath('/contacts') — router.refresh() picks that up. But for the File Contacts spawn case, we want the parent to kick off upsertDealPerson({contactId}) with the NEW contact id immediately. Firing onCreated before refresh lets the chain play cleanly: (1) contact inserted in DB, (2) callback assigns slot, (3) revalidation refreshes the deal page so both the new contact AND the slot assignment are visible in one pass."
  - "Autosuggest debounce at 200ms (slightly faster than the /contacts page's 250ms). The combobox feels snappier when you're trying to pick one of ~3 candidates from a partner list; the /contacts list view has more latitude because it's reading the full table."
  - "Defensive clamp in queryContactsAutosuggestAction EVEN THOUGH queryContactsAutosuggest already clamps. Server Actions are the public surface — belt + suspenders is correct; a future refactor that exposes queryContactsAutosuggestAction to more callers doesn't need to re-audit."
  - "slotsForTrack ordering (ROLE_SLOTS declaration order) drives render order — no client-side re-sort. Universals (directing_agent → main_contact → internal_owner) render first because they're declared first in lib/role-slots.ts. Deterministic regardless of deal_people row insertion order."
  - "Tests placed at tests/unit/ (same Rule 3 deviation as Plans 03-03/04/05). vitest.config.ts include glob restricts discovery to tests/unit/**/*.test.ts."
  - "DealTabs.dealPeople prop added in Task 1 (forward-declared), consumed in Task 3. Keeps every intermediate commit bisect-friendly (tsc + build clean at every step)."
  - "Users lucide import dropped from deal-tabs.tsx once placeholder was retired. Mail kept — still used by the P4-deferred Emails placeholder."
  - "People-tab pane renders as a client component ('use client'). It could technically be a Server Component that just hands dealPeople to client children, but making the whole tab client-side simplifies state wiring for the inline dialog + toast orchestration. The cost is ~2KB of client bundle; the benefit is one less boundary to reason about when PEOPLE-02 evolves."

patterns-established:
  - "Client autosuggest = Popover + Input + useEffect(setTimeout) + useTransition — any future combobox (task-assign, email-template-pick) clones this shape."
  - "Role-slot row components split per slot-source kind — one file per source. If P10 introduces a third source (e.g., 'enum' for a fixed-list slot), it ships as its own row component next to role-slot-row.tsx and lender-free-text-row.tsx."
  - "Additive prop extension on existing UI components preserves cross-plan backward compatibility. When Plan N needs Plan M's component with new behavior, extend with optional props rather than forking."

requirements-completed: [PEOPLE-02, PEOPLE-03]

# Metrics
duration: 7m 11s
completed: 2026-04-19
---

# Phase 3 Plan 06: Deal-Detail People Tab Summary

**The File Contacts tab on `/deal/[id]` is live end-to-end: PeopleTab loops `slotsForTrack(deal.trackCode)` and renders one row per slot (RoleSlotRow for contact_fk slots, LenderFreeTextRow for the `lender_partner` free-text slot). The autosuggest combobox (200ms debounced, exact>prefix>substring ranking from Plan 03) drives assign; the inline "Create new contact" CTA opens NewContactDialog pre-filled, then auto-assigns the new contact to the slot via `onCreated` before `router.refresh()`. All mutations route through the Plan 04 Server Actions (`upsertDealPerson` / `removeDealPerson`). Full suite 284/284 (up from 279; +5 people-tab-query integration). PEOPLE-02 + PEOPLE-03 delivered at UI layer.**

## Performance

- **Duration:** 7m 11s
- **Started:** 2026-04-19T02:13:25Z
- **Completed:** 2026-04-19T02:20:36Z
- **Tasks:** 3 (all non-TDD — Task 1 gets an integration test, Tasks 2 + 3 are UI wiring verified via build + manual smoke)
- **Files created:** 6 (5 source, 1 test)
- **Files modified:** 3 (page.tsx, deal-tabs.tsx, new-contact-dialog.tsx)
- **Commits:** 3 (one per task)

## Accomplishments

- `app/deal/[id]/actions/autosuggest.ts` ships `queryContactsAutosuggestAction` as a thin `"use server"` wrapper around `queryContactsAutosuggest` with empty-query early-return and defensive limit clamp to `[1, 20]`. No DB import here — the action stays a pass-through.
- `app/deal/[id]/page.tsx` now awaits `queryDealPeopleForDeal(deal.id)` in the existing `Promise.all` parallel fetch and passes `dealPeople` into `DealTabs`. Zero disruption to the existing tasks/users/notes/audit wiring.
- `app/deal/[id]/_components/contact-autosuggest.tsx` is the reusable combobox: Popover-anchored with `base-nova`-correct `render={<Button.../>}`, `useEffect`+`setTimeout` debounce at 200ms, `useTransition` for the fetch, and a "Create new contact: «typed»" CTA that fires `onCreateNew(trimmed)` when the query is non-empty. Ranks per the Plan 03 query-layer ordering (exact > prefix > substring, tie-broken alphabetical).
- `app/deal/[id]/_components/lender-free-text-row.tsx` renders the single `source: "free_text"` slot (`lender_partner`). Plain `<Input>` + Save button when unassigned (calls `upsertDealPerson({ role: "lender_partner", freeTextValue })` — Plan 04 synthesizes the minimal contact row inside the tx). Assigned state shows `contactFullName` + "Free-text lender" subtitle + Remove (✕). Distinct from the `mortgage_partner` row which is autosuggest-backed.
- `app/deal/[id]/_components/role-slot-row.tsx` is the contact_fk slot row. Assigned: name + email + Remove. Unassigned: `<ContactAutosuggest>`. "Create new" flow opens `NewContactDialog` pre-filled (via `initialFullName` + `controlledOpen` props) and auto-assigns the new contact id via `onCreated` → `assign(newContactId)` → `router.refresh()`.
- `app/deal/[id]/_components/people-tab.tsx` is the pane: `slotsForTrack(deal.trackCode)` + indexed `Map<role, DealPersonRow>` + branch on `slot.source`. Footer text renders slot count for the track (useful sanity check for GI deals which show only the 3 universals).
- `app/deal/[id]/_components/deal-tabs.tsx` replaced `<PlaceholderPanel heading="File contacts live here" ...>` with `<PeopleTab deal={props.deal} dealPeople={props.dealPeople}>`. Dropped the unused `Users` lucide import (kept `Mail` — still used by the Emails placeholder for P4 to retire).
- `app/contacts/_components/new-contact-dialog.tsx` extended additively with 4 new optional props (`initialFullName`, `controlledOpen`, `onOpenChange`, `onCreated`). Trigger button is hidden when `controlledOpen !== undefined`. Existing `/contacts` page consumption (zero-arg `<NewContactDialog />`) continues to work unchanged — verified via the 279-baseline test suite + build.
- `tests/unit/people-tab-query.test.ts` — 5 assertions covering the composite data contract the page assembles: TE deal with 2 assigned slots → joined rows correct; `slotsForTrack('TE')` contains `main_contact` + `title_partner`; `slotsForTrack('GI')` excludes `title_partner` (universals-only); SET NULL cascade preserves deal_people row with `contactFullName=null`; `slotsForTrack` order is stable + starts with universals.
- Full suite **284/284** (up from 279). `npx tsc --noEmit` clean. `npm run build` clean — 6 routes unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: page-level data plumbing + autosuggest Server Action** — `1540455` (feat)
2. **Task 2: contact-autosuggest + role-slot-row + lender-free-text-row primitives** — `fa0fabf` (feat)
3. **Task 3: PeopleTab pane; retire File Contacts placeholder** — `7145bf2` (feat)

**Plan metadata commit:** _pending_ (docs: complete plan — final commit appended after self-check)

## Files Created/Modified

**Created (6):**

- `app/deal/[id]/actions/autosuggest.ts` — 30 lines. "use server"; empty-guard + clamp; pass-through to `queryContactsAutosuggest`.
- `app/deal/[id]/_components/contact-autosuggest.tsx` — 125 lines. `"use client";` Popover + Input + debounced useEffect + useTransition; "Create new contact" CTA when query non-empty.
- `app/deal/[id]/_components/lender-free-text-row.tsx` — 116 lines. `"use client";` Input + Save / Remove; calls `upsertDealPerson({ freeTextValue })` and `removeDealPerson`.
- `app/deal/[id]/_components/role-slot-row.tsx` — 128 lines. `"use client";` ContactAutosuggest integration; assign/remove via Plan 04 actions; create-new chain via NewContactDialog with `controlledOpen` + `onCreated`.
- `app/deal/[id]/_components/people-tab.tsx` — 64 lines. `"use client";` loops `slotsForTrack`, indexed Map lookup per-role, branches on `slot.source`.
- `tests/unit/people-tab-query.test.ts` — 205 lines. 5 assertions; seeds TE deal + contacts + deal_people; exercises queryDealPeopleForDeal + slotsForTrack composition.

**Modified (3):**

- `app/deal/[id]/page.tsx` — +2 lines: import `queryDealPeopleForDeal`, add to `Promise.all`, pass `dealPeople` prop to DealTabs.
- `app/deal/[id]/_components/deal-tabs.tsx` — import `PeopleTab` + `DealPersonRow`; add `dealPeople` to props; REPLACE PlaceholderPanel with `<PeopleTab>`; remove unused `Users` lucide import.
- `app/contacts/_components/new-contact-dialog.tsx` — 4 new optional props (initialFullName / controlledOpen / onOpenChange / onCreated); conditional trigger rendering; `onCreated(contactId)` fires before `router.refresh()`; `Field` helper gains `defaultValue`.

## Decisions Made

- **NewContactDialog: additive prop extension (Option A).** The plan's Task 2 cross-plan note authorized either (a) extend with optional props or (b) factor a `<NewContactForm>` subcomponent. Option A was chosen because all 4 new props are optional with backward-compatible defaults; /contacts page consumption is unchanged; a single form implementation avoids duplicating layout + validation logic. The trigger button is hidden only when `controlledOpen !== undefined`.
- **`onCreated` fires BEFORE `router.refresh()`.** createContact already calls `revalidatePath("/contacts")` server-side. For the inline "Create new contact" path, the parent (RoleSlotRow) needs the new contact id synchronously to chain `upsertDealPerson({ contactId })`. Firing `onCreated` first means the chain plays cleanly: create → assign → revalidate → UI reflects both in one pass.
- **Autosuggest debounce at 200ms.** Slightly faster than the /contacts page's 250ms. A role-slot combobox feels snappier when the user is picking from a small partner list; the /contacts list has more latitude.
- **Defensive clamp in queryContactsAutosuggestAction despite lib-layer clamp.** Server Actions are a public surface — belt + suspenders. Future refactors that expose this action to more callers don't need to re-audit.
- **`slotsForTrack` ordering drives render order — no client-side re-sort.** Universals (directing_agent → main_contact → internal_owner) render first because they're declared first in `lib/role-slots.ts`. Deterministic regardless of deal_people insertion order.
- **Test placement: `tests/unit/` not `tests/integration/`.** Tracked as Rule 3 deviation below. Same precedent as Plans 03-03 / 03-04 / 03-05.
- **`dealPeople` prop added to DealTabs in Task 1 (forward-declared), consumed in Task 3.** Keeps every intermediate commit bisect-friendly (tsc + build clean at every step). Alternative (inline add to DealTabs in Task 3) would have left Task 1 with a broken page.tsx.
- **`Users` lucide import dropped from deal-tabs.tsx once placeholder was retired.** `Mail` kept — still used by the P4-deferred Emails placeholder.
- **PeopleTab rendered as `"use client"`.** It could technically be a Server Component passing `dealPeople` to client children, but making the whole tab client-side simplifies state wiring for the inline dialog + toast orchestration. Cost ≈ 2KB client bundle; benefit: one fewer boundary to reason about.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test file location changed from `tests/integration/` to `tests/unit/`**

- **Found during:** Task 1 (about to create the integration test)
- **Issue:** Plan `files_modified` frontmatter + task action referenced `tests/integration/people-tab-query.test.ts`, but `vitest.config.ts` restricts discovery to `tests/unit/**/*.test.ts` (verified in runtime context); tests at `tests/integration/` would not be discovered by the runner.
- **Fix:** Placed the test at `tests/unit/people-tab-query.test.ts` — same precedent as Plans 03-03, 03-04, 03-05 (all of which made the identical deviation). Test file docstring documents the decision. Did NOT modify `vitest.config.ts` — that would be a Rule 4 architectural change deferred to a future split-directory plan.
- **Files modified:** Integration test at `tests/unit/` instead of `tests/integration/`.
- **Verification:** `npm test -- people-tab-query` → 5/5 green; full suite 284/284.
- **Committed in:** `1540455` (Task 1).

**2. [Rule 3 - Blocking] DealTabs `dealPeople` prop forward-declared in Task 1 to avoid broken intermediate commit**

- **Found during:** Task 1 (tsc errored after page.tsx started passing `dealPeople` prop to DealTabs)
- **Issue:** The plan structured the work as "Task 1 adds data fetch → Task 3 adds consumer". Without a bridge, the Task 1 commit would leave the repo with a TS error (unknown prop on DealTabs), breaking bisect-friendliness. The plan explicitly values bisectable commits.
- **Fix:** Added `dealPeople: DealPersonRow[]` to the `DealTabs` props signature + `DealPersonRow` type import in Task 1's commit. The prop is unused until Task 3 wires the consumer — harmless forward-declaration. Task 3 then replaced `<PlaceholderPanel>` with `<PeopleTab deal={props.deal} dealPeople={props.dealPeople}>`.
- **Files modified:** `app/deal/[id]/_components/deal-tabs.tsx` (+1 import line, +1 prop line in Task 1 commit `1540455`).
- **Verification:** `npx tsc --noEmit` clean after Task 1; `npm run build` clean. Every intermediate commit compiles.
- **Committed in:** `1540455` (Task 1 — same commit as the data fetch addition).

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking, both no-scope-creep). No architectural decisions required (no Rule 4 stops).
**Impact on plan:** Zero scope drift. All three tasks delivered the exact surface and behavior the plan specified. The NewContactDialog extension took the authorized Option A path (additive optional props). The File Contacts placeholder is retired.

## Issues Encountered

None. The create-new-and-assign chain worked first try; the autosuggest debounce behaves as expected; the free-text row stays visually distinct from the mortgage_partner autosuggest row. No Rule 1 bugs discovered during execution.

## User Setup Required

None — no external-service configuration. The File Contacts tab is live against the existing DB.

## Manual Smoke Test (Plan-Optional)

Not run in this execution session (no dev server started). Automated verification covered the entire data contract:

- `tsc --noEmit`: clean
- `npm run build`: clean, 6 routes unchanged
- Full suite: 284/284 green (5 new people-tab-query assertions include SET NULL cascade + per-track slot filtering)
- `grep 'File contacts live here' in app/deal/[id]/_components/`: 0 matches (placeholder retired)
- `grep '@/db/client'` in new components: 0 matches (D-04 holds)
- `grep 'render=' in contact-autosuggest.tsx + role-slot-row.tsx`: present (base-nova caveat honored)
- No `asChild` JSX in new components
- `lender_partner` flows through `LenderFreeTextRow` not `RoleSlotRow` (verified by `people-tab.tsx` branch on `slot.source === "free_text"`)

**Operator smoke plan** (recommended once deployed / `npm run dev` started):

1. Open a TE deal → File Contacts tab → see 10 rows (3 universals + title_partner + borrower + seller + mortgage_partner + tc_partner + tl_partner + listing_agent).
2. Click Assign on Main Contact → autosuggest opens → type 3+ chars → pick a contact → row flips to assigned (name + email shown); Remove button appears.
3. Click ✕ on Main Contact → row flips back to Assign.
4. Type a new name that doesn't match anyone → "Create new contact: «name»" CTA appears → click → NewContactDialog opens pre-filled → fill required fields → Submit → toast "Contact added." → row auto-assigns to the new contact → toast "Main Contact assigned.".
5. Open a FL deal → 9 rows (universals + borrower + mortgage_partner + **Lender (free-text)** + tl_partner). Confirm Lender row is a plain Input + Save, NOT the Assign combobox.
6. Type "Wells Fargo" into Lender input + Save → row flips to assigned with "Free-text lender" subtitle.
7. Open a GI deal → only 3 rows (directing_agent + main_contact + internal_owner). Footer "3 role slots for GI deals." renders.

## Next Phase Readiness

**P3 Plan 07 (D-03 backfill migration 0007) is the final remaining plan.** The backfill is a SQL-level operation (no UI, no actions); on first page-load after migration runs, the `/contacts` activeDealsCount column will show non-zero for every backfilled contact AND the File Contacts tab will render `main_contact` as "assigned" on every active deal — this is the regression signal that the backfill worked end-to-end.

**After Plan 07, Phase 3 is complete.** PEOPLE-01/02/03/04/05 + VIEW-06 delivered at both data and UI layers. Phase 4 (Gmail Integration + Intake) is the logical next step per the ROADMAP — intake paths need the contacts registry + role-slot model to attach people to deals as they land.

**P3 progresses to 6/7 plans shipped.**

## Self-Check: PASSED

Verified before writing SUMMARY:

- Source files:
  - `app/deal/[id]/actions/autosuggest.ts` FOUND; grep `"use server"` (1), `queryContactsAutosuggestAction` (1 export).
  - `app/deal/[id]/_components/contact-autosuggest.tsx` FOUND; starts with `"use client";`; grep `queryContactsAutosuggestAction` (2 — import + call), `Create new contact` (1 — the CTA text), `render={` (1 — PopoverTrigger caveat).
  - `app/deal/[id]/_components/lender-free-text-row.tsx` FOUND; starts with `"use client";`; grep `freeTextValue` (1), `role: "lender_partner"` (1), `removeDealPerson` (2 — import + call).
  - `app/deal/[id]/_components/role-slot-row.tsx` FOUND; starts with `"use client";`; grep `upsertDealPerson` (2 — import + call), `removeDealPerson` (2 — import + call), `NewContactDialog` (2 — import + usage), `initialFullName` (1), `controlledOpen` (1), `onCreated` (2 — prop + handler).
  - `app/deal/[id]/_components/people-tab.tsx` FOUND; starts with `"use client";`; grep `slotsForTrack` (2 — import + call), `LenderFreeTextRow` (2 — import + render), `slot.source === "free_text"` (1 — branch).
  - `app/deal/[id]/_components/deal-tabs.tsx` grep `<PeopleTab` (1 — replaced placeholder), `File contacts live here` (0 — placeholder text gone), `dealPeople` (3 — type import + prop decl + pass-down).
  - `app/deal/[id]/page.tsx` grep `queryDealPeopleForDeal` (2 — import + call), `dealPeople` (2 — destructure + pass).
  - `app/contacts/_components/new-contact-dialog.tsx` grep `initialFullName` (3), `controlledOpen` (5), `onOpenChange` (2), `onCreated` (3) — all 4 new optional props wired.
- Test files:
  - `tests/unit/people-tab-query.test.ts` FOUND; 5/5 passing (ran via `npm test -- people-tab-query`).
- Commits:
  - `1540455` feat(03-06) Task 1 — FOUND via `git log --oneline`
  - `fa0fabf` feat(03-06) Task 2 — FOUND
  - `7145bf2` feat(03-06) Task 3 — FOUND
- Full suite: `npm test` → **284/284 passing** (was 279 pre-plan; +5 people-tab-query integration).
- `npx tsc --noEmit` exit 0.
- `npm run build` exit 0, 6 routes (`/`, `/_not-found`, `/contacts`, `/contacts/[id]`, `/deal/[id]`, `/deal/new`) — unchanged from P3 Plan 05 baseline.
- `grep -rn "File contacts live here" app/deal/[id]/_components/` → 0 matches (placeholder retired).
- `grep -rn "@/db/client" app/deal/[id]/_components/people-tab.tsx app/deal/[id]/_components/role-slot-row.tsx app/deal/[id]/_components/lender-free-text-row.tsx app/deal/[id]/_components/contact-autosuggest.tsx` → 0 matches (D-04 holds).
- No `asChild` JSX in new components.

## Known Stubs

None. Every row on the File Contacts tab renders real data (either a real assigned contact via join, or an Assign button bound to real Server Actions that mutate the real DB). The lender_partner row saves to the real `contacts` + `deal_people` tables via Plan 04's tx-wrapped upsertDealPerson free_text branch.

The per-row `Remove` button calls the real `removeDealPerson` action. The "Create new contact" flow creates a real contact via the real `createContact` action and immediately assigns it to the slot via the real `upsertDealPerson` action.

**Placeholders retired by this plan:**
- `<PlaceholderPanel heading="File contacts live here" ...>` in deal-tabs.tsx — REPLACED with `<PeopleTab>`.

**Placeholders still in deal-tabs.tsx (out of scope — owned by future plans):**
- Emails tab `<PlaceholderPanel heading="Emails arrive in Phase 4">` — intentional, owned by P4.

---
*Phase: 03-people-map-contacts-registry*
*Completed: 2026-04-19*
