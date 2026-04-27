# NPR Dashboard

## What This Is

A visual, deal-centric dashboard for Carrie Davis (COO of UTS/STM) that unifies five deal tracks — Title, Lending, Deal Desk, Consulting, Partnership — into one view. Every screen is built around the two questions Carrie answers all day: *where is this file?* and *whose turn is next?* The dashboard is the source of truth for stage, people-on-file, and tasks; it pulls signals from Gmail, ClickUp, and GHL without attempting two-way sync; and it lets Carrie trigger templated follow-up emails (with optional "polish in Mike's voice" via Anthropic API) directly from each file.

## Core Value

**Carrie can glance at the dashboard and know within 5 seconds what needs her attention today.**

That's the one thing that must work. Everything else — integrations, LLM polish, ClickUp seed import, Kanban views — serves this core.

## Context

- **Operator / primary user:** Carrie Davis, COO of UTS (United Title Solutions) and STM (Signature Transaction Management), 25% profit share, integrator function
- **Secondary user:** Mike Miller (founder) — view-only access via email allowlist
- **Business backdrop:** Mike runs UTS (title insurance / workshare), STM (DSCR + transactional lending), and a Deal Desk (capital-to-deals matching) alongside the No Permission Required content brand. Carrie coordinates across all operational tracks while Mike focuses on thinking and approval layers.
- **Operational reality:** Deal state today is fragmented across ClickUp (partial structure via custom fields), GHL/FundLaunch360 (contacts + pipelines), Gmail (dominant comms), Facebook Messenger (manual-only inbound for lending leads), and Carrie's head. No single system answers "where is this file?" authoritatively.
- **Key shift being absorbed:** Nick-only JotForm for mortgage referrals is being killed. Lending intake is shifting to FB Messenger → manual triage → Gmail, routed to a new broker network.
- **Deployment target:** Railway (web + Postgres), custom domain `dashboard.utstitle.com` eventually.
- **Budget target:** ~$15–20/month runtime (Railway ~$10–15, Anthropic API ~$1–5).

## Requirements

### Validated

**Shipped in Phase 1 (Core Data Model) — 2026-04-17:**
- **DEAL-01** — 8 deal tracks seeded (TE, FL, DP, PO, EC, SL, BL, GI) with per-track default priority
- **DEAL-02** — `deals` table (35 columns) with file_no, track/stage FKs, money fields, dates, NPI encryption, priority
- **DEAL-02a** — Monotonic state-scoped file numbering via `next_file_no(state)` pg function (sequence-backed, atomic under concurrency)
- **DEAL-03** — `/deal/new` route with shadcn accordion form (RHF + Zod), transactional createDeal server action
- **STAGE-01** — 25 canonical stages seeded (4 universal + 10 Title & Escrow + 11 Funding & Lending); nullable `track_id` FK for universal stages
- **OPS-01** — `audit_log` table + `writeAuditLog` writes inside createDeal's transaction (D-05); public-branding env schema (NEXT_PUBLIC_APP_NAME/DOMAIN/BRAND_COLOR)
- **VIEW-01** — List view column order (Tracking, Priority, File #, Main Contact, Address, Milestone, Progress/Next Task, Task Due By, Quick Note, Activity)
- **VIEW-02** — URL-state filter bar (Needs me toggle, multi-select tracks/stages/priorities, date ranges) with tolerant parser

Pending human UAT (see `.planning/phases/01-core-data-model/01-HUMAN-UAT.md`): visual sign-off on /deal/new + / list view, and E2E deal creation through Cloudflare Access at portal.utstitle.com.

**Shipped in Phase 2 (Deal Detail, Tasks, Stages) — 2026-04-17:**
- **DEAL-04** — `/deal/[id]` renders with 6 tabs (Overview, File Contacts, Tasks, Emails, Notes, Audit) per VIEW-05 order; Overview per-card edit wired to updateDeal
- **DEAL-05** — `updateDeal` server action with strict Zod diff-only mutation; every update writes audit row
- **DEAL-06** — `killDeal` requires ≥3-char reason textarea; writes 4 rows atomically (UPDATE deals + INSERT system note + 2 audit rows); rollback invariant proven (Test 9)
- **STAGE-02** — `advanceStage` with two-click AlertDialog, forward-motion + track-compat validation, audit row, revalidatePath
- **STAGE-03** — `revertStage` with destructive-outline AlertDialog; past-pip click affordance; audit row with source='manual_revert'
- **TASK-01..05** — Full task CRUD: `createTask` / `completeTask` / `undoCompleteTask` / `updateTask` / `reassignTask` with DB-level partial unique index + app-level `is_next` invariant (10-way concurrency test passes); auto-advance on task completion with audit breadcrumb (`triggeringTaskId`); 5-second undo toast
- **VIEW-05** — Deal detail tabs with URL-state (`?tab=...`), tolerant parser; Tasks tab with is_next accent bar; Notes append-only composer; Audit tab with 5 URL-state filter chips (All/Deal/Tasks/Notes/Stage) + before→after diff renderer

Pending human UAT (see `.planning/phases/02-deal-detail-tasks-stages/02-HUMAN-UAT.md`): visual sign-off on 4 mutation dialogs, 5-second undo toast timing, audit filter URL round-trip, stepper pip-click affordance, and E2E flow through Cloudflare Access.

**UI review (advisory):** 6/6 pillars PASS with 1 minor spacing FLAG to address during P10 calibration week — see `.planning/phases/02-deal-detail-tasks-stages/02-UI-REVIEW.md`.

**Shipped in Phase 0.5.1 (Production Deploy Wire-Up) — 2026-04-18:**
- **DEPLOY-07** — Railway production has a `Postgres` service (Hobby tier, ~$5/mo, private network); app service's `DATABASE_URL` is wired as a runtime-resolved reference to `${{Postgres.DATABASE_URL}}` (auto-propagates across password rotations)
- **DEPLOY-08** — Railway production app has `NEXT_PUBLIC_APP_NAME=NPR Dashboard`, `NEXT_PUBLIC_APP_DOMAIN=portal.utstitle.com`, `NEXT_PUBLIC_APP_BRAND_COLOR=#0F172A` (deterministic canonical values pinned at planning time; Zod schema validates at module load)
- **DEPLOY-09** — `package.json` `"prestart": "npm run db:migrate"` hook applies all pending migrations automatically on every container boot; validated in production (Deploy `540160a4` @ `e6a3658` — 6 migrations applied, `[✓] migrations applied successfully!`)
- **CFA-11** — Direct Railway origin URL (`npr-dashboard-prototype-production.up.railway.app`) blocked at Railway edge (HTTP 401 with `server: railway-edge`; body 12 bytes `Unauthorized`); P0.5 SC1 deferral resolved
- **CFA-12** — `AppHeader` avatar renders signed-in user's identity (not P0.5-era stale `"CD"` fallback); P0.5 SC3 deferral resolved (minor UI-polish bug filed as follow-up: avatar shows single-char initial instead of both, see `.planning/todos/pending/2026-04-18-fix-appheader-avatar-to-show-both-initials.md`)

**portal.utstitle.com now serves current P1+P2 code end-to-end.** First time since P0.5 that production reflects the work shipped locally.

**Follow-ups (deferred, tracked in .planning/todos/pending/):**
- Investigate CF Access session persistence across incognito windows (HIGH priority security question — must resolve before written GLBA Safeguards program cites CF Access + MFA as a control)
- Fix AppHeader avatar to show both initials (LOW priority UI polish)
- Resolve CF Access policy blocking mike@/info@ (separate debug thread in `.planning/debug/2026-04-17-portal-access-denied.md`, unblocks P1+P2 human UAT when closed)

### Active

See `.planning/REQUIREMENTS.md` for the full v1 list. Summary:

- **Auth + access control:** Google OAuth with email allowlist; Gmail scopes pre-consented
- **Deal management:** Create, view, update deals across 5 tracks; 10 canonical stages from ClickUp `FILE STATUS`; per-track role slots
- **People map:** Global contacts registry with per-deal role assignments
- **Tasks:** One `is_next` task per deal; manual stage advancement with audit log
- **Intake:** Manual form + Gmail thread import + free-text paste (optional LLM extraction)
- **Email automation:** Templated follow-up with merge fields; optional Anthropic polish; Gmail send
- **Integrations (read-only):** Gmail thread fetch on demand; ClickUp task link; GHL contact lookup
- **Views:** List, Kanban, Calendar, Deal Detail, Contacts
- **Ops:** Audit log on every mutation; MTD LLM cost footer; keyboard-first UX

### Out of Scope (v1)

- Multi-user role-based access / external partner portal
- Two-way sync to ClickUp or GHL
- Background Gmail polling
- Facebook Messenger integration (cannot be automated)
- Automated stage transitions or LLM-driven status inference
- Content / NPR brand production workflows (separate systems)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Dashboard IS source of truth (not aggregator) | "Split/inconsistent" today — no external system holds canonical deal state | — Committed |
| 5 tracks unified in one view | Carrie works across all of them; splitting would require mode-switching | — Committed |
| ClickUp `FILE STATUS` adopted as canonical stage vocabulary | Carrie/Mike already speak it; avoids inventing new terms | — Committed |
| Fixed role slots per track (not free-form) | Templated emails need unambiguous "the directing agent" targeting | — Committed |
| Hybrid emails: templates + optional LLM polish | Zero-cost default; predictable API spend with opt-in polish | — Committed |
| Next.js 15 + Postgres + Google OAuth stack | Best Claude Code maintainability, Railway-native, OAuth double-duty for Gmail | — Committed |
| Single user MVP (Carrie only, Mike allowlisted) | Defer auth/RBAC complexity; adding users later is a one-env-var change | — Committed |
| BC-17 vetting gate enforced in partner profiles | "Operator vetting is primary blind spot" per BRAIN_COMMAND | — Committed |

## Source Documents

The spec and P0 implementation plan are the ground truth for this work:

- Spec: `C:\Users\glh28\.claude\plans\curious-bubbling-lake.md`
- P0 plan: `C:\Users\glh28\.claude\plans\2026-04-16-p0-foundation.md`

Supporting business context (read-only references, not build targets):

- `BRAIN_COMMAND_v3.txt`, `MASTER-INTAKE(compressed)-01.docx`, `STRATEGY(compressed)-01-Master_Plan.docx`, `BUSINESS(compressed)-01-UTS_Reference.docx`, and the `NPR-*` skill files in `C:\Users\glh28\Dropbox\AI Brain Documents\Current Brain Documents\`

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-04-18 after Phase 0.5.1 (Production Deploy Wire-Up) completion — 24 requirements validated across P0/P0.5/P1/P2/P0.5.1 (170 tests, prod deploy live at portal.utstitle.com), 2 follow-up todos filed for post-phase batch + pre-existing P1/P2 human UAT debt carried forward.*
