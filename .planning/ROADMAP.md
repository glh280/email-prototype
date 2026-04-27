# Roadmap — NPR Dashboard v1

**14 phases** (P0, P0.5, P0.5.1, P1–P5, P5.5, P6–P10) | **81 active requirements** (plus 6 deprecated `AUTH-*` superseded by `CFA-*`) | All v1 requirements covered ✓

Sequential execution. Each phase produces a deployable, testable slice. The app is usable (if incomplete) after every phase.

---

## Overview

| # | Phase | Goal | Requirements | Success criteria |
|---|-------|------|--------------|------------------|
| 0 | Foundation | Scaffold, DB, deploy (Auth.js landed but superseded by P0.5) | 13* | 5 |
| 0.5 | Cloudflare Access + Encryption Scaffolding | Access replaces Auth.js; Tunnel origin isolation; NPI encryption + audit | 12 new (CFA-01..09, NPI-01..04, VENDOR-01..03) | 9 |
| 0.5.1 | Production deploy wire-up | Auto-deploy with migrations, env vars, CF Access still enforcing; P1+P2 shippable via `git push` | 5 new (DEPLOY-07..09, CFA-10, CFA-11) | 7 |
| 1 | Core data model | Deals + milestones + list view + audit_log scaffold | 9 | 4 |
| 2 | Deal detail, tasks, stages | Advance and track individual deals | 11 (DEAL-04..06, STAGE-02/03, TASK-01..05, VIEW-05) | 5 |
| 3 | People map & contacts | Assign people to role slots | 6 | 3 |
| 4 | Gmail integration + intake | Pull threads; three intake paths | 5 | 3 |
| 5 | Email drafting + sending | Templated follow-ups through Gmail | 6 | 3 |
| 5.5 | Documents + R2 | Upload + download + delete, R2 private buckets + pre-signed URLs | TBD at plan time | TBD |
| 6 | LLM polish + intake parse | Anthropic on demand with cost cap | 5 | 3 |
| 7 | ClickUp seed import + link | One-time import; per-deal task links | 2 | 3 |
| 8 | GHL contact lookup | Optional contact enrichment | 2 | 2 |
| 9 | Kanban + Calendar + palette | Additional views and navigation | 5 | 3 |
| 10 | Calibration week | Real-use tuning; post-close Title stages | 3 | 4 |

---

## Phase Details

### Phase 0: Foundation

**Goal:** Scaffold Next.js + Postgres + Auth.js + shadcn/ui. Carrie can sign in to an empty dashboard shell at a Railway dev URL.

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, OPS-03, OPS-04, DEPLOY-01, DEPLOY-02, DEPLOY-04, DEPLOY-05, DEPLOY-06

**Success criteria:**
1. Running `npm run dev` locally serves the app at `localhost:3000` with the sign-in page visible
2. Signing in with an allowlisted Google account produces the empty dashboard shell (header, sign-out)
3. Signing in with a non-allowlisted email is rejected with a clear message
4. Playwright smoke test passes: unauthenticated user is redirected from `/` to `/sign-in`
5. The app is deployed to a Railway URL and Carrie can sign in there end-to-end

**UI hint:** yes (sign-in page + dashboard shell)

**Plan source:** full detailed plan at `.planning/phases/00-foundation/PLAN.md`. Note: the Auth.js work landed in P0 (commits `fc8da45` through `14b902c`) is superseded by Phase 0.5 — P0.5 removes it via forward commits.

**Phase status:** Complete (shipped in commits `fc8da45`..`14b902c`; auth layer superseded by P0.5 which is also complete).

---

### Phase 0.5: Cloudflare Access + Encryption Scaffolding

**Goal:** Replace Auth.js with Cloudflare Access; deploy Cloudflare Tunnel for origin isolation; scaffold NPI column-level encryption (`@47ng/cloak`) with a non-skippable `npi_access_log` audit table; create `.planning/VENDORS.md` register.

**Requirements:** CFA-01..09, NPI-01..04, VENDOR-01..03

**Success criteria (9):**
1. Direct access to the Railway origin (bypassing Cloudflare) returns 403/404
2. Access JWT with invalid signature / wrong AUD returns 401
3. Valid Access JWT upserts `users` row on first visit; avatar displays real name + email
4. MFA prompt fires on first Access login
5. Access session duration is 24 hours; Purpose justification enabled
6. `encrypt()` / `decrypt()` round-trip cleanly
7. Unit test proves `decrypt()` always writes one row to `npi_access_log`
8. `.planning/VENDORS.md` exists with 6 vendors, all status PENDING
9. All `@auth/*` and `next-auth` packages removed from `package.json`; `lib/auth.ts`, `lib/allowlist.ts`, `app/api/auth/`, `app/(auth)/` deleted

*Dropped Access Logpush criterion — Logpush is Enterprise-only, not applicable on the Free tier we're staying on. See AUDIT.md §1 and §8 for the replacement audit architecture.*

**UI hint:** no (infrastructure + edge auth)

**Plan source:** `.planning/phases/00.5-access-encryption/PLAN.md`

**Phase status:** Complete — 11 commits shipped 2026-04-17, CF Access live at portal.utstitle.com, NPI encryption + audit scaffolding in place, VENDORS.md present. All 9 success criteria met.

---

### Phase 00.5.1: Production deploy wire-up (INSERTED 2026-04-18)

**Rationale:** Surfaced during post-P2 deploy-readiness check — P0.5's `P05-CLOSURE.md` flagged SC1 (direct-origin 403) as "not live-tested" and SC3 (avatar shows real user) as "likely stale Railway deploy — resolves on redeploy" at close time. Those tests were never completed, and the broader production environment has a bigger gap: no Postgres service is provisioned in Railway, no `DATABASE_URL` is wired, and the P1-02 required env vars (`NEXT_PUBLIC_APP_NAME` / `_DOMAIN` / `_BRAND_COLOR`) are absent. Current portal.utstitle.com deploys from `fa52cc5` (pre-P1 code) and survives only because no request reaches a DB query yet. Shipping P1+P2 code without this wire-up will hard-crash the app on first `queryDeals()` call.

**Goal:** Leave Railway production in a state where any push to `origin/master` auto-deploys a healthy app with migrations run, seeds applied, all env vars present, and CF Access still enforcing. After this phase completes, P1+P2 can ship with a single `git push`.

**Requirements:** DEPLOY-07 (new — prod Postgres provisioned + connected), DEPLOY-08 (new — P1 env vars set in prod), DEPLOY-09 (new — prestart/postdeploy migration hook), CFA-10 (new — direct Railway origin returns 403/404 without CF Access JWT, resolves P0.5 SC1 deferral), CFA-11 (new — avatar renders real Google identity after login, resolves P0.5 SC3 deferral)

**Success criteria:**
1. Railway project has 3 services: `tunnel` (existing), `npr-dashboard-prototype` (existing), and `postgres` (NEW — provisioned via Railway Postgres add-on)
2. App service has `DATABASE_URL` wired as a reference variable to the Postgres service (`${{Postgres.DATABASE_URL}}`); `railway variables --service npr-dashboard-prototype --kv` lists it present
3. App service has `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_DOMAIN`, and `NEXT_PUBLIC_APP_BRAND_COLOR` env vars set (Zod schema in `lib/env.ts` would otherwise reject boot)
4. Repo has a `railway.json` declaring a `postdeploy` hook running `npm run db:migrate` OR `package.json` has a `prestart` script that runs migrations — either way, future deploys are self-healing
5. `curl -I https://npr-dashboard-prototype-production.up.railway.app` returns 403/404 (direct origin bypassing CF Access is blocked — resolves P0.5 SC1)
6. After CF Access login at `portal.utstitle.com`, avatar component in `AppHeader` displays real Google name + email (resolves P0.5 SC3)
7. A fresh `git push origin master` with P1+P2 code triggers a Railway build that completes status=SUCCESS (not FAILED), migrations 0003/0004/0005 run automatically, seeds land, and the Next.js server boots without Zod env errors

**UI hint:** no (infrastructure + deploy plumbing; no user-facing UI changes)

**Depends on:** Phase 0.5 (complete)

**Blocks:** Shipping P1+P2 to prod. Does NOT block continued local development (which uses docker-compose Postgres).

**Plans:** 3 plans (1/3 complete)
- [x] 00.5.1-01-prestart-hook-and-runbook-skeleton.md — repo-only: prestart hook in package.json + DEPLOY.md runbook + INITIAL_SEED_VERIFICATION.md template (wave 1, autonomous) — COMPLETE 2026-04-18 (commits 41ecb85 + 10c5817)
- [x] 00.5.1-02-railway-provisioning-checkpoints.md — 3 user-gated checkpoints: provision Railway Postgres, wire DATABASE_URL reference var, set NEXT_PUBLIC_APP_* env vars (wave 2, autonomous=false)
- [x] 00.5.1-03-deploy-and-verify.md — user-gated git push + Claude-monitored deploy + user-gated seed + CFA-11 + CFA-12 verification (wave 3, autonomous=false)

### Phase 1: Core Data Model

**Goal:** Create the `deals`, `stages` (UI "Milestones"), and `tracks` tables; seed 8 tracks and a hybrid stage list (4 universal + 10 Title & Escrow + 11 Funding & Lending = 25 rows); enforce the track→stage relationship; auto-generate `file_no` on insert; and surface a working list view that matches Carrie's column order.

**Requirements:** DEAL-01, DEAL-02, DEAL-02a, DEAL-03, STAGE-01, VIEW-01, VIEW-02, OPS-01

**Success criteria:**
1. Drizzle migration creates `deals`, `stages`, `tracks` tables:
   - `tracks` seeded with 8 rows (TE, FL, DP, PO, EC, SL, BL, GI) with default priorities
   - `stages` seeded with 25 rows (4 universal `track_id=NULL` + 10 TE + 11 FL); DP/PO/EC/SL/BL/GI rely on universal stages in P1, get calibrated in P10
2. "New Deal" form at `/deal/new` creates a deal with required fields; `file_no` auto-generated in format `{STATE|XX}-{YYYY}-{NNNN}`; redirects to list view
3. List view at `/` displays all active deals with columns in the VIEW-01 order: Tracking, Priority, File #, Main Contact, Address, Milestone, Progress/Next Task, Task Due By, Quick Note, Activity
4. "Needs me" filter returns only deals where next-task owner matches current user; closing date, funding date, and task due date filters also present

**UI hint:** yes (New Deal form + list view)

**Plan progress:** 6/6 complete
- [x] Plan 01 — Schema split + core tables + D-04a FK ([summary](./phases/01-core-data-model/01-schema-split-and-core-tables-SUMMARY.md)) — 2026-04-17
- [x] Plan 02 — Env vars + AppHeader brand (D-06) ([summary](./phases/01-core-data-model/02-env-vars-and-app-name-SUMMARY.md)) — 2026-04-17
- [x] Plan 03 — file_no generator (sequence-per-year) ([summary](./phases/01-core-data-model/03-file-no-generator-SUMMARY.md)) — 2026-04-17
- [x] Plan 04 — Seed tracks (8) + stages (25) ([summary](./phases/01-core-data-model/04-seed-tracks-and-stages-SUMMARY.md)) — 2026-04-17
- [x] Plan 05 — New Deal form (`/deal/new`) ([summary](./phases/01-core-data-model/05-new-deal-form-SUMMARY.md)) — 2026-04-17
- [x] Plan 06 — List view rewrite (`/`) ([summary](./phases/01-core-data-model/06-list-view-rewrite-SUMMARY.md)) — 2026-04-17

**Requirements completed:** DEAL-01, DEAL-02, DEAL-02a, DEAL-03, STAGE-01, VIEW-01, VIEW-02, OPS-01

**Phase status:** All 6 plans complete. Ready for phase transition to Phase 2 (Deal Detail, Tasks, Stages).

---

### Phase 2: Deal Detail, Tasks, Stages

**Goal:** Full deal detail page with tabs, task management with `is_next`, stage advancement with audit log.

**Requirements:** DEAL-04, DEAL-05, DEAL-06, STAGE-02, STAGE-03, TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, VIEW-05

(Note: OPS-01 moved to Phase 1 per discuss-phase 1 decision D-05 — audit_log table + writes on deal.create ships in P1. P2 extends audit writes to updates, stage advancement, and task mutations.)

**Success criteria:**
1. `/deal/[id]` renders with tabs; Overview editable; Notes, Audit visible
2. Adding/completing tasks maintains exactly-one `is_next` invariant
3. Stage advance requires two-click confirm, writes audit_log, updates list view
4. Marking deal `killed` requires reason note; writes audit_log
5. Every mutation appears in the Audit tab with before/after

**UI hint:** yes (deal detail, task list, stage stepper)

**Plans:** 6/0 plans complete

**Plan progress:** 6/6 complete ✅ **Phase complete**
- [x] Plan 01 — Schema extensions: tasks + deal_notes tables, kill columns, is_next partial unique index (wave 1) — 2026-04-18
- [x] Plan 02 — Shared Zod schemas: updateDeal, killDeal, task/stage/note ([summary](./phases/02-deal-detail-tasks-stages/02-shared-zod-schemas-SUMMARY.md)) — 2026-04-18
- [x] Plan 03 — Task server actions + is_next invariant (TDD) ([summary](./phases/02-deal-detail-tasks-stages/03-task-server-actions-is-next-invariant-SUMMARY.md)) — 2026-04-18
- [x] Plan 04 — Stage advance/revert + deal update/close/kill actions (TDD) ([summary](./phases/02-deal-detail-tasks-stages/04-stage-advance-revert-kill-actions-SUMMARY.md)) — 2026-04-18
- [x] Plan 05 — Deal detail shell + header + stepper + Overview tab + 4 mutation dialogs ([summary](./phases/02-deal-detail-tasks-stages/05-deal-detail-shell-overview-tab-SUMMARY.md)) — 2026-04-18
- [x] Plan 06 — Tasks + Notes + Audit tabs ([summary](./phases/02-deal-detail-tasks-stages/06-tasks-notes-audit-tabs-SUMMARY.md)) — 2026-04-18

**Phase status:** All 6 plans complete. All 5 Phase 2 success criteria proven end-to-end (detail page + tabs + is_next invariant + stage flows + audit tab showing every mutation). Ready for phase transition to Phase 3 (People Map & Contacts Registry).

---

### Phase 3: People Map & Contacts Registry

**Goal:** Global contacts table with per-deal role slot assignments. Autosuggest during assignment.

**Requirements:** PEOPLE-01, PEOPLE-02, PEOPLE-03, PEOPLE-04, PEOPLE-05, VIEW-06

**Success criteria:**
1. `/contacts` lists all contacts with search + "on N active deals" counter
2. On deal detail, People tab shows fixed role slots per track; autosuggest picks existing contacts
3. Invalid role slot (wrong track) is rejected with a clear error

**UI hint:** yes (contacts page + deal People tab)

**Plan progress:** 7/7 complete — Phase 3 COMPLETE
- [x] Plan 01 — Schema + migration 0006: contacts + deal_people tables ([summary](./phases/03-people-map-contacts-registry/03-01-schema-contacts-and-deal-people-SUMMARY.md)) — 2026-04-18
- [x] Plan 02 — Role-slot registry + Zod contracts: `lib/role-slots.ts` + `lib/contact-schema.ts` ([summary](./phases/03-people-map-contacts-registry/03-02-contact-and-role-slot-zod-schemas-SUMMARY.md)) — 2026-04-18
- [x] Plan 03 — Contacts + deal_people read-query layer: `lib/contacts-query.ts` + `lib/deal-people-query.ts` ([summary](./phases/03-people-map-contacts-registry/03-03-contacts-and-deal-people-queries-SUMMARY.md)) — 2026-04-19
- [x] Plan 04 — Contact + deal-people Server Actions (TDD): `app/contacts/actions.ts` + `app/deal/[id]/actions/people.ts` with PEOPLE-05 gate + rollback invariant ([summary](./phases/03-people-map-contacts-registry/03-04-contact-and-deal-people-server-actions-SUMMARY.md)) — 2026-04-18
- [x] Plan 05 — `/contacts` page UI (VIEW-06 + PEOPLE-04): Server Component list + URL-state search (250ms debounce) + two empty-state branches + activeDealsCount counter + stub detail route `/contacts/[id]` + New Contact dialog wired to `createContact` ([summary](./phases/03-people-map-contacts-registry/03-05-contacts-page-ui-SUMMARY.md)) — 2026-04-19
- [x] Plan 06 — Deal-detail File Contacts tab (PEOPLE-02 + PEOPLE-03): PeopleTab loops slotsForTrack + indexed Map lookup; ContactAutosuggest combobox (200ms debounced, Popover-anchored, "Create new" CTA); inline create+assign chain via NewContactDialog extended additively with 4 optional props; LenderFreeTextRow distinct from autosuggest per REQUIREMENTS line 85; PlaceholderPanel retired ([summary](./phases/03-people-map-contacts-registry/03-06-deal-detail-people-tab-SUMMARY.md)) — 2026-04-19
- [x] Plan 07 — D-03 backfill migration 0007 + createDeal dual-write + Overview Main Contact read-from-deal_people: idempotent SQL backfill (DISTINCT ON lower(trim(email)) + ON CONFLICT DO NOTHING), legacy columns preserved with COMMENT ON COLUMN markers (DROP deferred to P10), createDeal extended inside existing tx with contact upsert + deal_people INSERT + 2 new audit source markers (contact_create_via_new_deal / deal_people_upsert_via_new_deal), queryDealById extended with LEFT JOIN, MainContactReadOnly component with 3-state render + "Edit in File Contacts →" link ([summary](./phases/03-people-map-contacts-registry/03-07-d03-backfill-main-contact-migration-SUMMARY.md)) — 2026-04-19

**Phase status:** All 7 plans complete. D-03 CLOSED at data + write-path + UI layers. Every existing deal with main_contact_email has a deal_people row (via backfill); every new deal dual-writes on submit; Overview renders from the authoritative source with grace-period legacy fallback. Legacy `deals.main_contact_*` columns preserved until P10 calibration drop. 298/298 full suite green. Ready for phase transition to Phase 4 (Gmail Integration + Intake).

---

### Phase 4: Gmail Integration + Intake

**Goal:** Pull Gmail threads on demand. Three intake paths wired up (manual / Gmail URL / free-text paste).

**Requirements:** INTEG-01, INTAKE-01, INTAKE-02, INTAKE-03

**Success criteria:**
1. Pasting a Gmail thread URL/ID fetches subject/from/received_at and prefills the New Deal form
2. "Linked Emails" tab on deal detail displays stored message metadata; clicking a row opens Gmail
3. Pasting arbitrary text on intake stores it as notes on the new deal

**UI hint:** yes (intake form variants, Linked Emails tab)

---

### Phase 5: Email Drafting + Sending

**Goal:** Templated follow-up email flow — choose template, merge deal/person data, edit, send via Gmail.

**Requirements:** EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-05, EMAIL-06, INTEG-02

**Success criteria:**
1. "Draft follow-up" from a task opens modal with preselected template + recipient role
2. Merged body shows deal/contact fields substituted
3. "Send via Gmail" creates a sent message in Carrie's Gmail; draft stored in `email_drafts` with `sent_at`

**UI hint:** yes (draft email modal)

---

### Phase 5.5: Documents + R2

**Goal:** Ship real file uploads. Create Cloudflare R2 buckets (`npr-dashboard-docs-prod`, `npr-dashboard-docs-staging`), add pre-signed URL helpers for upload (5-min PUT) and download (15-min GET), wire the Documents section on the deal detail page to write/read `documents` rows in Postgres, support soft delete, and make every mutation flow through `recordChange()`.

**Requirements:** defined at plan time when the phase is reached. Will include REQ-IDs in a `DOC-*` / `STORAGE-*` block. See `AUDIT.md` §3.8 for the operative spec.

**Success criteria (indicative — finalized at plan time):**
1. `/deal/[id]` documents section: upload a file → `documents` row created with R2 metadata; file is in the private bucket
2. Download button produces a pre-signed R2 GET URL that expires in 15 min
3. Soft delete (`documents.deleted_at`) removes the row from list; R2 object preserved
4. No R2 object key leaks to the browser — all access mediated by server actions
5. CORS on R2 bucket restricted to `portal.utstitle.com`

**UI hint:** yes (Documents section becomes real)

**Plan source:** to be written via `/gsd:plan-phase 5.5` when reached (placeholder phase — no `.planning/phases/05.5-documents/` directory yet). Current `AUDIT.md` §3.8 is the reference spec.

---

### Phase 6: LLM Polish + Intake Parse

**Goal:** Optional Anthropic integration — "Polish in Mike's voice" button on drafts; optional intake text parsing; cost footer.

**Requirements:** EMAIL-04, INTAKE-04, LLM-01, LLM-02, LLM-03, LLM-04

**Success criteria:**
1. "Polish in Mike's voice" button produces a Sonnet-polished draft; original remains available via undo
2. Intake free-text paste shows optional "Extract fields (Haiku)" button; fills form fields when clicked
3. Dashboard footer displays month-to-date Anthropic spend, updated after every API call

**UI hint:** yes (polish button, cost footer)

---

### Phase 7: ClickUp Seed Import + Link

**Goal:** One-time import of existing ClickUp MAIN WORKFLOW tasks (with custom fields) into Postgres. Per-deal ClickUp link action.

**Requirements:** INTEG-03, INTEG-04

**Success criteria:**
1. `/settings/clickup-import` shows a diff/review screen with all 11 tasks mapped to dashboard fields
2. On commit, deals and contacts are created from the ClickUp data; idempotent if re-run
3. Per-deal "Link ClickUp task" action stores `linked_clickup` row; deal detail shows clickable link

**UI hint:** yes (import review screen)

---

### Phase 8: GHL Contact Lookup

**Goal:** Optional contact enrichment from GHL. Single-click lookup by email.

**Requirements:** INTEG-05, INTEG-06

**Success criteria:**
1. On new-contact form, "Pull from GHL" button populates phone/notes if match found
2. GHL API failure shows inline affordance and does not block the form

**UI hint:** yes (contacts form)

---

### Phase 9: Kanban + Calendar + Command Palette

**Goal:** Additional views on the same data; Cmd-K global search; full keyboard nav; mobile/tablet responsive.

**Requirements:** VIEW-03, VIEW-04, VIEW-07, VIEW-08, VIEW-09

**Success criteria:**
1. `/kanban` groups deals into stage columns; drag-to-advance with confirm
2. `/calendar` shows scheduled closings (Title + Lending) in week/month
3. Cmd-K opens a palette that searches deals/contacts and jumps to them; keyboard shortcuts work globally

**UI hint:** yes (Kanban, Calendar, Command Palette)

---

### Phase 10: Calibration Week

**Goal:** Carrie uses the dashboard daily for one week. Tune milestone ordering, role-slot coverage, priority enum accuracy, and template copy from real-deal use. Add track-specific stage lists for DP / PO / EC / SL / BL / GI (these ship in P1 with universal stages only). Point the custom domain. (Post-close Title stages now ship in v1 core via STAGE-01; STAGE-04 tunes them, not adds them.)

**Requirements:** STAGE-04, DEPLOY-03, OPS-02

**Success criteria:**
1. Post-close Title stages (cd_prep, scheduled, post_closing) added and tested against a real closing
2. `dashboard.utstitle.com` (or chosen subdomain) resolves to the Railway app over HTTPS
3. Postgres restore drill succeeds on a throwaway service
4. Carrie signs off: "where is this file" and "whose turn is next" answered correctly at a glance across all active deals

**UI hint:** no (mostly ops + calibration tuning)

---

## Acceptance Gate (Milestone 1 complete)

- [ ] All 81 v1 requirements checked off
- [ ] Every phase has passed its success criteria
- [ ] Carrie has signed off on calibration week
- [ ] Railway monthly bill within $15–20 target
- [ ] Zero secrets in the git repo; audit passes
