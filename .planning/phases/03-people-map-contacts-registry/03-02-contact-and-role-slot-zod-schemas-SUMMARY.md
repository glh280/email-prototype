---
phase: 03-people-map-contacts-registry
plan: 02
subsystem: validation
tags: [zod, schema, role-slots, contacts, deal-people, strict, people-map]

# Dependency graph
requires:
  - phase: 03-people-map-contacts-registry/01
    provides: "contacts + deal_people Drizzle tables, Contact/DealPerson type exports, DB-level one-slot-per-deal unique index"
  - phase: 02-deal-detail-tasks-stages/02
    provides: "Canonical `.strict()` pattern, split-parse convention, email empty-string-or-valid union, Zod error copy style"
provides:
  - "ROLE_SLOTS registry — 12 per-track role-slot entries with source metadata (contact_fk vs free_text)"
  - "ALL_TRACKS + TrackCode type alias (the 8 seeded track codes)"
  - "ROLE_SLOT_CODES array suitable for z.enum([...]) consumption"
  - "RoleSlotCode type union"
  - "isRoleValidForTrack(role, trackCode) — PEOPLE-05 enforcement primitive"
  - "slotsForTrack(trackCode) — UI helper for per-track slot rendering"
  - "createContactSchema, updateContactSchema, contactIdSchema — contact CRUD contracts (all .strict())"
  - "upsertDealPersonSchema, removeDealPersonSchema — deal_people mutation contracts (all .strict())"
affects:
  - "03-04 server actions (createContact / upsertDealPerson / removeDealPerson will import these schemas + isRoleValidForTrack)"
  - "03-05 /contacts page UI (imports createContactSchema for RHF client-side validation)"
  - "03-06 deal-detail File Contacts tab (imports slotsForTrack to render per-track slot rows)"
  - "03-07 D-03 backfill (role='main_contact' must pass isRoleValidForTrack across all 8 tracks — universal slot)"
  - "P10 calibration week (slot applicability edits are a one-file change to lib/role-slots.ts)"

# Tech tracking
tech-stack:
  added: []  # Pure type-layer plan; zero new deps
  patterns:
    - "Role-slot taxonomy encoded as readonly data (ROLE_SLOTS) with per-track applicability matrix + source metadata — changing a slot's track set is a one-file edit, not a server-action patch"
    - "isRoleValidForTrack as pure-function PEOPLE-05 primitive (validates both role membership and track applicability) — called by server actions after they load the deal row"
    - "Role enum in Zod schemas consumed via ROLE_SLOT_CODES array (not hardcoded) — single source of truth"
    - "Asymmetric source rule (contact_fk vs free_text for lender_partner) lives in server-action layer, not Zod — Zod can't know the slot without the role string resolved first"

key-files:
  created:
    - "lib/role-slots.ts — 162 lines; 12-entry ROLE_SLOTS registry + ALL_TRACKS + ROLE_SLOT_CODES + isRoleValidForTrack + slotsForTrack"
    - "lib/contact-schema.ts — 117 lines; 5 Zod schemas (createContactSchema, updateContactSchema, contactIdSchema, upsertDealPersonSchema, removeDealPersonSchema) + 5 type aliases"
    - "tests/unit/role-slots.test.ts — 22 assertions across 3 describe blocks"
    - "tests/unit/contact-schema.test.ts — 24 assertions across 5 describe blocks"
  modified: []  # Pure additive plan

key-decisions:
  - "Conservative title_partner='TE only' default — per PEOPLE-02 note ('autosuggest from partner contacts' = Title-and-Escrow-specific). Documented in module header as a P10 calibration candidate if operator pushes back."
  - "lender_partner is the single free_text slot (source: 'free_text'); the other 11 are contact_fk — reflects PEOPLE-02 note 'actual lender distinct from mortgage partner; often not in registry'"
  - "mortgage_partner applies to TE+FL+DP (not just FL) — title deals commonly surface a mortgage partner; explicit operator assertion in plan behavior"
  - "Universal slots (directing_agent, main_contact, internal_owner) use appliesToTracks='ALL' sentinel instead of enumerating all 8 tracks — cheaper to read, trivially extendable if a 9th track is ever added"
  - "Track-compatibility check stays in the server-action layer (not Zod). Zod validates shape + role-membership; the action loads the deal row and calls isRoleValidForTrack(role, deal.track.code). This keeps the schema module free of DB imports and makes the contract re-usable for client-side RHF validation."
  - "Split-parse convention retained from P2: contactIdSchema is its own .strict() object so server actions parse id + rest separately. Mirrors P2 dealIdSchema pattern."
  - "Role enum in Zod schemas pulls from ROLE_SLOT_CODES array (cast to [string, ...string[]] for z.enum) — adding/removing a slot is a one-file edit to role-slots.ts, with Zod picking up the change automatically."

patterns-established:
  - "Role-slot as typed readonly data in lib/role-slots.ts — P3..P10 consumers import the module rather than re-declaring slot lists"
  - "isRoleValidForTrack as the single PEOPLE-05 enforcement primitive — future server actions and API routes use it uniformly"
  - "P3 Zod tests split into their own file (tests/unit/contact-schema.test.ts) rather than appended to deal-schema.test.ts — keeps P1/P2/P3 slices independently readable"

requirements-completed: [PEOPLE-02, PEOPLE-05]

# Metrics
duration: 3m 45s
completed: 2026-04-18
---

# Phase 3 Plan 02: Role-Slot Registry + Contact/Deal-Person Zod Schemas Summary

**Canonical `ROLE_SLOTS` registry in `lib/role-slots.ts` (12 slots × per-track applicability matrix) plus five `.strict()` Zod contracts in `lib/contact-schema.ts` — PEOPLE-02 taxonomy and PEOPLE-05 enforcement primitive encoded once so server actions (P3-04), UI forms (P3-05/06), and P10 calibration edits all happen in one file.**

## Performance

- **Duration:** 3m 45s
- **Started:** 2026-04-19T01:28:27Z
- **Completed:** 2026-04-19T01:32:12Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 (2 source modules, 2 test files — all new)

## Accomplishments

- `lib/role-slots.ts` ships the 12-entry `ROLE_SLOTS` registry with per-track applicability matrix; 3 slots are universal (`directing_agent`, `main_contact`, `internal_owner`), 1 is free-text (`lender_partner`), 8 are track-scoped contact_fk slots.
- `isRoleValidForTrack(role, trackCode)` returns `true` iff role exists in ROLE_SLOTS AND the track is in ALL_TRACKS AND (`appliesToTracks === "ALL"` OR trackCode is in the slot's list). Returns `false` on unknown role, unknown track, or cross-track misuse. This is the PEOPLE-05 primitive.
- `slotsForTrack(trackCode)` returns the readonly subset of ROLE_SLOTS applicable to a given track — used by Plan 06's File Contacts tab UI.
- `lib/contact-schema.ts` ships 5 Zod schemas, all `.strict()`: `createContactSchema`, `updateContactSchema`, `contactIdSchema`, `upsertDealPersonSchema`, `removeDealPersonSchema`. Role enum consumed from `ROLE_SLOT_CODES` — no hardcoding.
- Email fields use the P2 pattern: `z.union([z.literal(""), z.string().trim().email("That email doesn't look right.")]).nullable().optional()` — blank-or-valid, no third-state ambiguity.
- 46 new assertions (22 role-slots + 24 contact-schema); full suite **228/228** (up from 182 baseline). `npx tsc --noEmit` clean. `npm run build` green (4 routes unchanged).

## Task Commits

Each task was committed atomically (TDD produces RED + GREEN as separate commits):

1. **Task 1 RED: failing tests for role-slot registry and isRoleValidForTrack** — `443965c` (test)
2. **Task 1 GREEN: canonical role-slot registry (ROLE_SLOTS + helpers)** — `e899279` (feat)
3. **Task 2 RED: failing tests for contact + deal_people Zod schemas** — `30763b2` (test)
4. **Task 2 GREEN: 5 Zod contracts for contacts + deal_people** — `0aface1` (feat)

**Plan metadata:** _pending_ (docs: complete plan — final commit appended after self-check)

## Files Created/Modified

- `lib/role-slots.ts` — 162 lines. Module header documents the source-enum semantics, the conservative `title_partner='TE only'` default as a P10 calibration candidate, and the free_text storage strategy for `lender_partner` (minimal contact row with `org=<lender name>`, `role_hint='lender'`). Exports: `ALL_TRACKS`, `TrackCode`, `RoleSlotSource`, `RoleSlot`, `ROLE_SLOTS`, `ROLE_SLOT_CODES`, `RoleSlotCode`, `isRoleValidForTrack`, `slotsForTrack`.
- `lib/contact-schema.ts` — 117 lines. Module header calls out the P2 pattern inheritance, the split-parse rationale, and the asymmetric source rule (contact_fk vs free_text) that lives in the server-action layer. Exports: `createContactSchema`, `updateContactSchema`, `contactIdSchema`, `upsertDealPersonSchema`, `removeDealPersonSchema` + 5 paired type aliases.
- `tests/unit/role-slots.test.ts` — 22 assertions. ROLE_SLOTS length+set+free_text uniqueness; isRoleValidForTrack positive/negative matrix (universal, track-specific, unknown role, unknown track, both-unknown); slotsForTrack membership (TE ≥ 8 incl `title_partner`, GI ≥ 3 incl 3 universals, lender_partner present in FL+DP absent in TE).
- `tests/unit/contact-schema.test.ts` — 24 assertions. createContactSchema (happy/trim/empty-email/garbage-email/unknown-key/empty-after-trim), updateContactSchema (partial/empty/unknown-key/garbage-email/201-char-fullName), contactIdSchema (uuid/non-uuid), upsertDealPersonSchema (happy+contactId / happy+freeText / unknown role / non-uuid dealId / unknown-key / lender_partner shape / freeText empty-after-trim), removeDealPersonSchema (happy / unknown role / unknown-key / missing dealId).

## Decisions Made

- **Conservative `title_partner='TE only'` default.** REQUIREMENTS PEOPLE-02 line notes "autosuggest from partner contacts" in a Title-and-Escrow context. Rather than broadening to TE+FL and rolling back later, shipped TE-only with a module-header note documenting this as a P10 calibration candidate. If Carrie pushes back during calibration week, it's a one-line edit to `appliesToTracks`.
- **`mortgage_partner` applies to TE+FL+DP (not just FL).** Plan behavior explicitly calls out that title deals commonly surface a mortgage partner; this keeps the common case valid without extra ceremony.
- **Universal slots use `appliesToTracks: "ALL"` sentinel** instead of enumerating all 8 codes. Cheaper to read, trivially extendable if a 9th track is ever added in P10.
- **`lender_partner` is the sole `source: "free_text"` slot.** Per PEOPLE-02 note: "actual lender on the deal, distinct from the mortgage partner; free-text because lenders are often not in the contacts registry." Storage strategy documented in module header — server action (Plan 04) will synthesize a minimal contact row rather than introducing a sidecar column.
- **Track-compat check stays in server-action layer, not Zod.** Zod can only validate shape + role membership; the deal's track is loaded from DB at action time. This keeps `lib/contact-schema.ts` free of DB imports and lets it double as client-side RHF validation later.
- **Role enum consumed from `ROLE_SLOT_CODES` array** (cast to `[string, ...string[]]` for `z.enum`). Changing a slot is a single edit to `lib/role-slots.ts` — Zod picks up the change automatically.
- **Split-parse `contactIdSchema` mirrors P2 `dealIdSchema`** — server actions receive `{id, ...rest}`, parse id first, then `updateContactSchema.safeParse(rest)`. `.and()` does not propagate `.strict()`, so keeping them separate is correct.

## Deviations from Plan

None — plan executed exactly as written.

All 2 tasks, 4 task commits (TDD RED + GREEN each), all acceptance criteria verified:

| Check | Requirement | Result |
| --- | --- | --- |
| `lib/role-slots.ts` exports surface | ROLE_SLOTS, RoleSlotCode, TrackCode, ROLE_SLOT_CODES, isRoleValidForTrack, slotsForTrack, ALL_TRACKS | all exported |
| `grep -c "code:" lib/role-slots.ts` | ≥ 12 | 13 (12 slots + 1 in JSDoc) |
| `grep "lender_partner" lib/role-slots.ts` shows `source: "free_text"` | present | confirmed via grep -B1 -A3 |
| `tests/unit/role-slots.test.ts` passing | ≥ 16 assertions | 22/22 passing |
| `lib/contact-schema.ts` exports surface | createContactSchema, updateContactSchema, contactIdSchema, upsertDealPersonSchema, removeDealPersonSchema + type aliases | all exported |
| `grep -c "\.strict()" lib/contact-schema.ts` | ≥ 5 | 7 |
| `grep "import.*role-slots" lib/contact-schema.ts` | present | confirmed |
| `tests/unit/contact-schema.test.ts` passing | ≥ 24 assertions | 24/24 passing |
| `npx tsc --noEmit` | exit 0 | clean |
| Full `npm test` | green (no regressions) | 228/228 |
| `npm run build` | green | 4 routes, unchanged |

**Total deviations:** 0.
**Impact on plan:** Zero scope creep. Slot taxonomy matrix values matched the plan's draft; no operator-confirm surfaced.

## Issues Encountered

None. Draft matrix values in Task 1 action step 3 matched the REQUIREMENTS slot list + the plan's behavior-section invariants. No test-vs-code arbitration was needed.

## User Setup Required

None — pure type-layer plan, no external-service configuration.

## Next Phase Readiness

Remaining P3 plans (03-03 through 03-07) are unblocked:

- **Plan 03-03 (read-query layer):** `queryContactsForList` + `queryDealPeopleForDeal` can resolve display names via Drizzle joins; no dependency on this plan's Zod shapes, but slot-label lookups for UI (`ROLE_SLOTS.find(s => s.code === dp.role)?.label`) are ready.
- **Plan 03-04 (server actions):** imports `createContactSchema` / `updateContactSchema` / `upsertDealPersonSchema` / `removeDealPersonSchema` directly; calls `isRoleValidForTrack(role, deal.track.code)` after loading the deal row to enforce PEOPLE-05; synthesizes a minimal contact row for `lender_partner` free_text per the documented storage strategy; `deal_people_one_per_slot_idx` (landed in 03-01) is the DB-level safety net.
- **Plan 03-05 (`/contacts` page):** imports `createContactSchema` for the "New contact" dialog RHF validation (client-side + server-side same shape).
- **Plan 03-06 (deal-detail File Contacts tab):** calls `slotsForTrack(deal.track.code)` to render the right set of slot rows; calls `upsertDealPersonSchema` via the action.
- **Plan 03-07 (D-03 backfill migration 0007):** the backfill uses `role='main_contact'` which is a universal slot — `isRoleValidForTrack('main_contact', anyTrack)` returns `true`, so the backfill won't hit the application-level gate. (The DB-level invariant is the real safety net here; application gating runs at action time.)

**P3 contract layer is complete.** Plan 03 progresses to 2/7 plans shipped.

## Self-Check: PASSED

Verified before writing SUMMARY:

- Source files:
  - `lib/role-slots.ts` FOUND; contains `export const ROLE_SLOTS` (1), `export function isRoleValidForTrack` (1), `export function slotsForTrack` (1), `export const ALL_TRACKS` (1), `export const ROLE_SLOT_CODES` (1), `code: "lender_partner"` with `source: "free_text"` (1).
  - `lib/contact-schema.ts` FOUND; contains `export const createContactSchema` (1), `export const updateContactSchema` (1), `export const contactIdSchema` (1), `export const upsertDealPersonSchema` (1), `export const removeDealPersonSchema` (1); 7 `.strict()` invocations; 1 `import { ROLE_SLOT_CODES } from "@/lib/role-slots"`.
- Test files:
  - `tests/unit/role-slots.test.ts` FOUND; 22/22 passing.
  - `tests/unit/contact-schema.test.ts` FOUND; 24/24 passing.
- Commits:
  - `443965c` test(03-02) RED role-slots — FOUND via `git log --oneline | grep 443965c`
  - `e899279` feat(03-02) GREEN role-slots — FOUND
  - `30763b2` test(03-02) RED contact-schema — FOUND
  - `0aface1` feat(03-02) GREEN contact-schema — FOUND
- Full suite: `npm test` → **228/228 passing** (was 182 pre-plan; 46 new assertions landed cleanly — 22 role-slots + 24 contact-schema)
- `npx tsc --noEmit` exit 0
- `npm run build` exit 0, 4 routes (`/`, `/_not-found`, `/deal/[id]`, `/deal/new`) — unchanged

## Known Stubs

None. This plan ships two pure-logic modules (type/contract layer) with no UI surface and no placeholder data. Downstream plans (03-03 through 03-07) will consume these exports; until then, no surface renders stub data for contacts or deal_people.

---
*Phase: 03-people-map-contacts-registry*
*Completed: 2026-04-18*
