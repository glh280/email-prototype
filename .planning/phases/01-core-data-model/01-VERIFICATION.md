---
phase: 01-core-data-model
verified: 2026-04-17T19:15:00Z
status: human_needed
score: 8/8 must-haves verified (automated); 3 items pending human UAT
re_verification: false
verified_requirements:
  - DEAL-01
  - DEAL-02
  - DEAL-02a
  - DEAL-03
  - STAGE-01
  - OPS-01
  - VIEW-01
  - VIEW-02
failed_requirements: []
human_verification:
  - test: "Visual UAT of /deal/new accordion form"
    expected: "3 sections render, money fields show $ prefix and format on blur, Track selector shows colored dots, Calendar popovers work"
    why_human: "Rendered pixels, icon alignment, color contrast, keyboard focus order cannot be verified by grep; UI-SPEC locks 47 decisions that need visual sign-off"
  - test: "Visual UAT of / list view (10 columns, badges, filter bar)"
    expected: "Column order matches VIEW-01 left→right; track badges show 8 pastel colors; HIGH/MED/LOW pills render with dots; em-dash placeholders are subtle; relative-time renders correctly"
    why_human: "Carrie's 5-second-glance value prop is the phase's core; only a human can confirm the perceptual quality. Automated checks confirm structure but not legibility."
  - test: "End-to-end deal creation through Cloudflare Access"
    expected: "Sign in at portal.utstitle.com → click New Deal → fill form → submit → redirected to / with success toast → deal appears in list with correct file_no"
    why_human: "Cloudflare Access JWT + MFA flow cannot be exercised from a test runner; needs a real browser session against prod/staging"
---

# Phase 1: Core Data Model — Verification Report

**Phase Goal:** Create the `deals`, `stages` (UI "Milestones"), and `tracks` tables; seed 8 tracks and a hybrid stage list (4 universal + 10 Title & Escrow + 11 Funding & Lending = 25 rows); enforce the track→stage relationship; auto-generate `file_no` on insert; and surface a working list view that matches Carrie's column order.

**Verified:** 2026-04-17
**Status:** human_needed (automated checks all pass; 3 UAT items remain)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                               | Status     | Evidence                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | `tracks`, `stages`, `deals`, `audit_log` tables exist in Drizzle schema + migrations                                | ✓ VERIFIED | `db/schema/app.ts:23,51,70,141`; `drizzle/migrations/0003_fat_dark_phoenix.sql:14-75`                       |
| 2   | 8 tracks seeded with correct codes + default priorities                                                             | ✓ VERIFIED | `db/seed/tracks.ts:15-24` — TE/FL=HIGH, DP/PO/EC/SL/BL/GI=MEDIUM                                            |
| 3   | 25 stages seeded (4 universal + 10 TE + 11 FL)                                                                      | ✓ VERIFIED | `db/seed/stages.ts:35-66` — 4+10+11=25; STATE.md 2026-04-17 confirms SQL-verified counts                    |
| 4   | Track→stage relationship enforced: `stages.track_id` nullable FK to tracks                                          | ✓ VERIFIED | `db/schema/app.ts:55` + migration 0003 line 81 (`stages_track_id_tracks_id_fk`)                             |
| 5   | `deals.track_id` + `deals.stage_id` FKs enforce a deal's stage belongs to its track (or is universal)               | ⚠ PARTIAL  | FKs enforce referential integrity; the CHECK "stage is universal OR matches track" is in application code (createDeal picks universal pre_screen_qualification), not a DB constraint. Seed data limits viable combinations |
| 6   | `next_file_no(state)` SQL function exists, atomic under concurrency                                                 | ✓ VERIFIED | `drizzle/migrations/0004_next_file_no_function.sql`; `tests/unit/file-no.test.ts` has 10-way concurrency test (STATE.md log, 36/36 green) |
| 7   | `createDeal` server action generates file_no on insert inside a transaction                                         | ✓ VERIFIED | `app/deal/new/actions.ts:55-126` — `db.transaction(async tx => …)` wraps generateFileNo + insert + audit   |
| 8   | `app/page.tsx` renders a list view matching UI-SPEC column order                                                    | ✓ VERIFIED | `app/_components/deals-table.tsx:39-50` — COLUMNS array in exact VIEW-01 order                              |
| 9   | Audit log writes on every deal create                                                                               | ✓ VERIFIED | `app/deal/new/actions.ts:116-123` + `lib/audit.ts:19-42`; enforced atomically (Test 7 in `create-deal-action.test.ts` per STATE.md)   |
| 10  | 5-second-glance value: list view surfaces stage/priority/track/activity signals                                     | ? UNCERTAIN| Structural correctness confirmed; perceptual correctness needs human UAT                                     |

**Score:** 8/10 truths fully verified, 1 partial (enforcement via app code not DB CHECK — acceptable per plans), 1 uncertain (human UAT).

---

### Required Artifacts

| Artifact                                              | Expected                                             | Status     | Details                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| `db/schema/auth.ts`                                   | users + npi_access_log (D-04 split)                  | ✓ VERIFIED | 63 lines; includes D-04a FK `dealId → deals.id` (line 47)                                  |
| `db/schema/app.ts`                                    | tracks, stages, deals, audit_log                     | ✓ VERIFIED | 175 lines; 3 CHECK constraints; 6 FKs; 9 indices                                           |
| `db/schema/index.ts`                                  | Re-export barrel                                      | ✓ VERIFIED | 13 lines, exports both                                                                     |
| `drizzle/migrations/0003_phase1_core_data_model.sql`  | Core-tables migration                                | ⚠ RENAMED  | Exists as `0003_fat_dark_phoenix.sql` (Drizzle auto-generated name); content correct       |
| `drizzle/migrations/0004_next_file_no_function.sql`   | plpgsql function                                     | ✓ VERIFIED | Lazy `CREATE SEQUENCE IF NOT EXISTS`; XX normalization; `lpad(nextval, 4, '0')`            |
| `lib/db.ts`                                           | Canonical Drizzle client                             | ✓ VERIFIED | 9 lines, single `drizzle(pool, { schema })` call                                           |
| `lib/file-no.ts`                                      | generateFileNo(tx, state)                            | ✓ VERIFIED | Typed `AppTx = PgTransaction<NodePgQueryResultHKT, …>` — proper drizzle 0.45.2 tx type     |
| `lib/audit.ts`                                        | writeAuditLog(tx, …) transaction-scoped              | ✓ VERIFIED | `user.email` denormalized per D-05                                                         |
| `lib/deal-schema.ts`                                  | Zod createDealSchema + split input/output types      | ✓ VERIFIED | `CreateDealFormInput` (z.input) / `CreateDealInput` (z.infer) per Zod v4 + RHF pattern     |
| `lib/parse-money.ts`                                  | $-prefix money normalizer                            | ✓ VERIFIED | Handles null/empty/comma/$/whitespace/zero/decimal/negative; 13 tests green                |
| `lib/deals-query.ts`                                  | queryDeals with CTE for activity MAX                 | ✓ VERIFIED | Drizzle `$with` CTE (D-15) with `coalesce(MAX(audit.created_at), updated_at)`              |
| `lib/filter-params.ts`                                | URL parse/serialize                                  | ✓ VERIFIED | Tolerant parser; defaults omitted from serializer                                          |
| `lib/format.ts`                                       | trackBadge/priorityPill/relativeTime helpers         | ✓ VERIFIED | 8 track keys + 3 priority keys; bucketed relativeTime (2m/3h/yesterday/Apr 14/Jan 2025)    |
| `lib/env.ts`                                          | D-06 Zod schema extension                            | ✓ VERIFIED | `NEXT_PUBLIC_APP_NAME/_DOMAIN/_BRAND_COLOR` added; bare-domain regex                       |
| `db/seed/tracks.ts`                                   | 8 track seeds                                        | ✓ VERIFIED | All codes, default_priority values, sort_order correct                                      |
| `db/seed/stages.ts`                                   | 25 stage seeds                                       | ✓ VERIFIED | 4 universal (terminals `file_completed` + `killed`) + 10 TE + 11 FL                        |
| `db/seed/run.ts`                                      | Idempotent seeder                                    | ✓ VERIFIED | `onConflictDoUpdate` keyed by `code`; dynamic imports after dotenv                         |
| `app/page.tsx`                                        | Server Component list view                           | ✓ VERIFIED | Parses searchParams Promise; 2 empty-state branches; footer count                          |
| `app/deal/new/page.tsx`                               | Server wrapper with file_no preview                  | ✓ VERIFIED | Computes best-effort estimate (UI-SPEC Assumption 4)                                       |
| `app/deal/new/new-deal-form.tsx`                      | RHF + Zod + Accordion                                 | ✓ VERIFIED | Imports all expected primitives; uses parseMoney                                           |
| `app/deal/new/actions.ts`                             | createDeal server action                             | ✓ VERIFIED | One transaction wraps FK lookup + generateFileNo + insert + writeAuditLog                  |
| `app/_components/deals-table.tsx`                     | Sortable 10-column table                             | ✓ VERIFIED | COLUMNS[] matches VIEW-01 order exactly                                                     |
| `app/_components/deals-filter-bar.tsx`                | 8-filter URL-driven bar                              | ✓ VERIFIED | Needs me + 3 multi + Overdue + 3 date ranges + Clear all                                   |
| `app/_components/deal-row.tsx`                        | Row renderer                                         | ✓ VERIFIED | Em-dash for null fields; File # stopPropagation; `role="button"` + keyboard support        |
| `app/_components/success-toast.tsx`                   | One-shot ?created= reader                            | ✓ VERIFIED | firedRef guard against StrictMode double-invoke                                             |
| `app/deal/[id]/page.tsx`                              | Neutralized P1 placeholder                            | ✓ VERIFIED | No `@/mock` imports; minimal "coming in Phase 2" message                                    |
| `components/app-header.tsx`                           | Reads NEXT_PUBLIC_APP_NAME                           | ✓ VERIFIED | Line 47: `{env.NEXT_PUBLIC_APP_NAME}`                                                      |

---

### Key Link Verification

| From                                                | To                                              | Via                                  | Status     | Details                                                                |
| --------------------------------------------------- | ----------------------------------------------- | ------------------------------------ | ---------- | ---------------------------------------------------------------------- |
| `db/schema/index.ts`                                | auth.ts + app.ts                                 | re-export                            | ✓ WIRED    | Lines 11-12 export * from both                                          |
| `npi_access_log.deal_id`                            | `deals.id`                                       | FK constraint                        | ✓ WIRED    | Migration 0003 line 91 adds the FK                                      |
| All server code                                     | `lib/db.ts`                                      | canonical Drizzle client             | ✓ WIRED    | No `@/db/client` imports anywhere in code (grep confirmed)              |
| `components/app-header.tsx`                         | `lib/env.ts::NEXT_PUBLIC_APP_NAME`               | import + read                        | ✓ WIRED    | Imports `env` from `@/lib/env` (line 3); reads at line 47               |
| `lib/file-no.ts::generateFileNo`                    | `next_file_no()` SQL function                    | Drizzle sql`SELECT next_file_no…`    | ✓ WIRED    | Line 57 passes `${normalized}` to the SQL function                      |
| `lib/file-no.ts`                                    | canonical `lib/db.ts`                            | type-level                           | ✓ WIRED    | AppTx type derived from schema; no direct db import (tx passed in)     |
| `db/seed/run.ts`                                    | tracks + stages                                  | insert.onConflictDoUpdate            | ✓ WIRED    | Lines 37-88 upsert keyed by `code`                                     |
| `db/seed/stages.ts`                                 | `db/seed/tracks.ts`                              | trackCode string (not FK)            | ✓ WIRED    | run.ts resolves code→id at insert via read-back map (lines 50-53)       |
| `app/deal/new/new-deal-form.tsx`                    | `actions.ts::createDeal`                         | import + await createDeal            | ✓ WIRED    | Line 45: `import { createDeal } from "./actions"`                       |
| `actions.ts`                                        | `generateFileNo`                                  | inside tx                            | ✓ WIRED    | actions.ts:79 inside `db.transaction` block                             |
| `actions.ts`                                        | `writeAuditLog`                                   | inside same tx as insert             | ✓ WIRED    | actions.ts:116 — all three calls share the same `tx`                    |
| `new-deal-form.tsx`                                 | `parseMoney`                                      | onBlur handlers                      | ✓ WIRED    | Line 46: `import { parseMoney } from "@/lib/parse-money"`               |
| `app/page.tsx`                                      | `lib/deals-query.ts::queryDeals`                 | direct await                         | ✓ WIRED    | Line 38: `const deals = await queryDeals(filters, user.id);`            |
| `deals-filter-bar.tsx`                              | URL (router.push)                                | on every control change              | ✓ WIRED    | Line 78: `router.push(qs ? "/?..." : "/")` in `pushFilters`             |
| `deals-table.tsx`                                   | `deal-row.tsx`                                   | props map                            | ✓ WIRED    | Line 135: `{deals.map((d) => <DealRow key={d.id} deal={d} />)}`         |

**Note:** The automated `gsd-tools verify key-links` tool produced false negatives for: (1) path-aliased "from" paths like `@/db/schema` reported as "Source file not found"; (2) escaped regex patterns like `createDeal\\(` flagged as invalid. All links manually verified via Read + Grep with exact line numbers cited above.

---

### Data-Flow Trace (Level 4)

| Artifact                  | Data Variable          | Source                                                                                 | Produces Real Data | Status         |
| ------------------------- | ---------------------- | -------------------------------------------------------------------------------------- | ------------------ | -------------- |
| `app/page.tsx`            | `deals` array          | `queryDeals(filters, user.id)` — real Drizzle query against `deals` table              | ✓ Yes              | ✓ FLOWING      |
| `app/page.tsx`            | `filters`              | `parseFilterParams(sp)` from URL searchParams                                          | ✓ Yes              | ✓ FLOWING      |
| `deals-table.tsx`         | `deals` prop           | Passed from server component                                                            | ✓ Yes              | ✓ FLOWING      |
| `deals-filter-bar.tsx`    | `filters`              | `parseFilterParams(useSearchParams)`                                                    | ✓ Yes              | ✓ FLOWING      |
| `new-deal-form.tsx`       | `tracks` prop          | Reads `TRACK_SEEDS` (real 8-row array) passed from server page                          | ✓ Yes              | ✓ FLOWING      |
| `new-deal-form.tsx`       | form submission        | `await createDeal(data)` — real server action writes DB                                 | ✓ Yes              | ✓ FLOWING      |
| `deal-row.tsx`            | Progress / Task Due By | No source — em-dash by design (P2 tasks table not yet built)                            | ⚠ Placeholder      | ⚠ STATIC (expected per D-16) |

All list-view data flows through real Postgres queries. The two em-dash columns are explicit P2-data placeholders per design decision D-16 — not a regression.

---

### Behavioral Spot-Checks

| Behavior                                       | Command                                                                | Result                                     | Status  |
| ---------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------ | ------- |
| TypeScript compiles end-to-end                 | `npx tsc --noEmit`                                                     | Exit 0 (no output)                          | ✓ PASS  |
| Full unit test suite green                     | `npm test`                                                             | 9 files / 82 tests passed (11.78s)          | ✓ PASS  |
| Production build succeeds                      | `npm run build`                                                        | Compiled 5.2s; 4 routes registered (`/`, `/_not-found`, `/deal/[id]`, `/deal/new`) | ✓ PASS  |
| No `@/db/client` imports in code               | Grep across `*.{ts,tsx,js,jsx}`                                        | Matches are in 2 comments documenting the ban — zero imports | ✓ PASS  |
| No `@/mock` imports in code                    | Grep across `*.{ts,tsx,js,jsx}`                                        | One match in `app/deal/[id]/page.tsx` comment describing deletion — zero imports | ✓ PASS  |
| `db:seed` runs idempotently                    | Run manually (skipped — DB not running in this session)                | STATE.md 2026-04-17 entry documents "both runs exit 0 with 'Seeded 8 tracks, 25 stages.'" | ? SKIP |
| `db:migrate` idempotent                        | Plan 03 STATE entry: `npm run db:migrate` idempotent                   | Documented                                  | ? SKIP  |

---

### Requirements Coverage

| Requirement | Source Plan(s)              | Description                                                                                                     | Status     | Evidence                                                                                                                                     |
| ----------- | --------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| DEAL-01     | Plan 01, Plan 04            | 8 tracks with default priorities                                                                                | ✓ SATISFIED | `db/seed/tracks.ts:15-24` enumerates all 8 codes with TE/FL=HIGH, rest=MEDIUM; `db/schema/app.ts:23-39` defines tracks table with CHECK constraint |
| DEAL-02     | Plan 01, Plan 05            | Deal columns (track, title, stage_id, priority, …, file_no, quick_note, etc.)                                   | ✓ SATISFIED | `db/schema/app.ts:70-131` defines all 35 columns; CHECKs on priority + status                                                                 |
| DEAL-02a    | Plan 03, Plan 05            | file_no auto-generates `{STATE\|XX}-{YYYY}-{NNNN}` with per-year counter, immutable, atomic                     | ✓ SATISFIED | `drizzle/migrations/0004_next_file_no_function.sql`; `lib/file-no.ts::generateFileNo`; 10-way concurrency test + null→XX test (tests/unit/file-no.test.ts per STATE.md) |
| DEAL-03     | Plan 05                     | Deal creation via form at `/deal/new`                                                                           | ✓ SATISFIED | `app/deal/new/page.tsx` + `new-deal-form.tsx` + `actions.ts::createDeal`; form uses RHF + Zod + Accordion per D-08/D-11                        |
| STAGE-01    | Plan 01, Plan 04            | Hybrid stages — 4 universal + 10 TE + 11 FL; DP/PO/EC/SL/BL/GI use universal only                               | ✓ SATISFIED | `db/seed/stages.ts:35-66`; nullable `stages.track_id` FK at `db/schema/app.ts:55`; 2 terminals (file_completed, killed)                       |
| OPS-01      | Plan 01, Plan 05            | Every mutation writes `audit_log` with before/after JSON                                                        | ✓ SATISFIED (P1 scope: create only) | `db/schema/app.ts:141-165` defines audit_log; `lib/audit.ts::writeAuditLog` transaction-scoped; `actions.ts:116` writes on deal create. P2 extends to update/stage/task mutations per D-05. |
| VIEW-01     | Plan 06                     | `/` lists active deals in 10-column order (Tracking, Priority, File #, Main Contact, Address, Milestone, Progress/Next Task, Task Due By, Quick Note, Activity) | ✓ SATISFIED | `deals-table.tsx:39-50` COLUMNS exact order; `deal-row.tsx` renders each cell in order. Progress/Next Task + Task Due By = em-dash placeholders per D-16 (P2 data) |
| VIEW-02     | Plan 06                     | Filters: track, milestone, priority, Needs me, overdue, closing, funding, task due                              | ✓ SATISFIED | `deals-filter-bar.tsx` ships all 8 + Clear all; `filter-params.ts` parses URL state; `deals-query.ts` applies AND/OR semantics (D-12). Overdue + taskDue filters UI-present but P2-data-dependent |

**Orphaned requirements check:** No orphaned requirements for Phase 1 — ROADMAP.md Phase 1 maps 8 requirements, and all 8 appear in the aggregated plan requirements list.

---

### Anti-Patterns Found

Scanned files modified during Phase 1 for TODO/FIXME, empty returns, hardcoded empty data, console-log-only implementations, and hollow props.

| File                              | Line   | Pattern                    | Severity   | Impact                                                                                              |
| --------------------------------- | ------ | -------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| `app/deal/[id]/page.tsx`          | 24-33  | Placeholder render "coming in Phase 2" | ℹ Info | **Intentional** per Plan 06 Task 3A — phase-boundary stub; P2 rebuilds. No DB query. Documented in code and STATE.md. |
| `app/_components/deal-row.tsx`    | 125, 130 | Em-dash literals for Progress/Next Task + Task Due By | ℹ Info | **Intentional** per D-16 — "quiet absence" for P2 data. Not a stub. |
| `app/deal/new/page.tsx`           | 38-40  | `catch {}` swallows error on file_no preview | ℹ Info | Best-effort UI estimate per UI-SPEC Assumption 4; real file_no is atomic on insert. Fallback "0001" on error is documented. |

No blocker or warning-level anti-patterns. All flagged items are deliberate design decisions documented in CONTEXT.md, UI-SPEC.md, or plan summaries.

**Convention compliance:**
- ✓ No `@/db/client` imports in any TS/TSX file (only in comments documenting the ban)
- ✓ No `@/mock` imports in any TS/TSX file (only in a comment describing deletion)
- ✓ `createDeal` wraps file_no + insert + audit_log in ONE `db.transaction` (actions.ts:55-126)
- ✓ Phase 0.5 artifacts not regressed: `lib/access.ts`, `lib/crypto.ts`, `npi_access_log` table, `users` table all intact; `npi_access_log.deal_id` FK was ADDED (D-04a), not removed

---

### Human Verification Required

#### 1. Visual UAT of `/deal/new` accordion form

**Test:** Navigate to `/deal/new` in a browser. Verify:
- Three accordion sections render: "File basics" (open), "Property details" (collapsed), "Financials & dates" (collapsed)
- Track selector shows 8 options with colored dots matching the UI-SPEC palette (TE blue, FL green, DP purple, PO pink, EC amber, SL rose, BL teal, GI gray)
- Selecting a track pre-fills Priority with the track's default_priority
- Property State shows US state codes
- File # preview pill appears, reads `Will be assigned: ~XX-2026-{nnnn}` then updates to `~{STATE}-2026-{nnnn}` after state selection
- Money fields (sales_price, loan_amount, estimated_down, earnest_money, est_rehab, arv) have `$` prefix and format on blur (e.g., "485000" → "$485,000")
- Closing / Funding date popover shows a calendar and lets you pick a date
- Sticky footer with Cancel (outline) + Create Deal (primary) buttons
- Inline field errors on blur; toast on submit with errors

**Expected:** Pixel-level match to UI-SPEC Page 2.

**Why human:** Rendered pixels, icon alignment, color contrast, keyboard focus order, and subjective "feel" of the form cannot be verified by grep. UI-SPEC locks 47 decisions that need visual sign-off from Carrie.

#### 2. Visual UAT of `/` list view (5-second-glance test)

**Test:** Sign in, create 8-10 sample deals across multiple tracks/priorities, then open `/`. Verify:
- Columns appear left-to-right in VIEW-01 order (Tracking, Priority, File #, Main Contact, Address, Milestone, Progress/Next Task, Task Due By, Quick Note, Activity)
- Track badges render with 8 distinct pastel backgrounds
- Priority pills show HIGH (red dot+pill), MEDIUM (amber dot+pill), LOW (hollow gray)
- File # is mono-spaced, clickable
- Em-dash placeholder is visually subtle (muted-foreground/70)
- Activity column renders relative time (e.g., "2m", "yesterday")
- Row click navigates to `/deal/{id}`; File # cmd-click opens new tab
- Filter bar: Needs me toggles primary fill when active; multi-selects show count; date range popovers work; Clear all appears only when a filter is set
- Default sort is activity_desc

**Expected:** Carrie can glance at the dashboard and identify what needs attention within 5 seconds.

**Why human:** The core-value question ("Carrie knows what needs her attention today") is a perceptual/subjective quality. Automated checks confirm structure; a human must confirm legibility at realistic deal density.

#### 3. End-to-end deal creation through Cloudflare Access (production)

**Test:** From a fresh browser session:
1. Navigate to https://portal.utstitle.com
2. Cloudflare Access challenges with Google IdP + MFA
3. Land on `/` (dashboard list)
4. Click "New Deal"
5. Fill out a deal (track=TE, priority inherited, title, property_state=TX, money fields)
6. Submit
7. Verify redirect to `/?created=TX-2026-NNNN` with success toast
8. Verify the new row appears in the list with the correct file_no
9. Check `audit_log` table (via psql or a P2 Audit tab preview) for the create row

**Expected:** End-to-end flow completes without error; deal row and audit row present; Access session cookie valid.

**Why human:** Cloudflare Access JWT + MFA flow cannot be exercised from a unit-test runner; needs a real browser session against staging/prod. Smoke-tests cf-access behavior, tunnel origin, and app-side Access JWT verification together.

---

### Gaps Summary

**No automated gaps found.** All 8 Phase-1 requirements (DEAL-01, DEAL-02, DEAL-02a, DEAL-03, STAGE-01, VIEW-01, VIEW-02, OPS-01) are implemented with real code, real migrations, real seed data, and 82 passing tests. The 4 ROADMAP success criteria are met:

1. ✓ Drizzle migration creates `deals`, `stages`, `tracks` — 0003 migration + seed data = 8 tracks, 25 stages
2. ✓ New Deal form at `/deal/new` auto-generates file_no in `{STATE|XX}-{YYYY}-{NNNN}` format and redirects to list view
3. ✓ List view at `/` has 10 columns in VIEW-01 order
4. ✓ 8-filter bar including "Needs me" toggle; D-14 P1 semantics = internalOwner match

**Minor observations (not gaps):**

- **Artifact filename cosmetic:** The Plan 01 artifact list named migration `0003_phase1_core_data_model.sql` but Drizzle generated `0003_fat_dark_phoenix.sql`. Content is correct; rename is not necessary.
- **Stage-track CHECK is app-level, not DB-level:** A deal's `stage_id` could theoretically reference any seeded stage (including one that doesn't match the deal's track) at the DB layer. In practice, `createDeal` always assigns `pre_screen_qualification` (universal); stage advancement (P2 STAGE-02) will need to validate the pairing. Flag for P2 planning — consider a DB-level CHECK or trigger, or continue to rely on application-layer validation.
- **Tooling note:** `gsd-tools verify key-links` has false-positive "Source file not found" results for `@/…` path-aliased sources, and malformed escaped-regex patterns like `createDeal\\(`. All links were manually verified; tool may need a fix in a future GSD tooling pass.

**Phase goal achievement (from ROADMAP):**
- Tables + seed + FK + file_no + list view — all shipped.
- Core value proposition ("5-second glance") — structural scaffolding in place; perceptual validation pending UAT.

---

### Previous-Phase Regression Check (Phase 0.5)

Verified Phase 0.5 artifacts are intact / not regressed:

| Artifact                             | Status                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `lib/access.ts` (CF Access JWT verify) | ✓ Present (imported by `lib/current-user.ts` / proxy)                       |
| `lib/crypto.ts` (NPI encrypt/decrypt) | ✓ Present; tests passing in crypto.test.ts (2/2 invariant tests)              |
| `npi_access_log` table                | ✓ Present in `db/schema/auth.ts:42-60`; D-04a adds FK `deal_id → deals.id`    |
| `users` table                         | ✓ Present in `db/schema/auth.ts:15-23`                                        |
| CFA env vars                          | ✓ `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD` required in `lib/env.ts`           |
| `@auth/*` / `next-auth` removed       | ✓ No Auth.js imports in codebase (confirmed by Phase 0.5 verification earlier) |

---

_Verified: 2026-04-17T19:15:00Z_
_Verifier: Claude (gsd-verifier) — automated checks + manual link audit_
_Status: human_needed — all automated checks PASS; 3 UAT items remain (form visuals, list-view glance test, end-to-end Cloudflare Access flow)_
