# Requirements — NPR Dashboard v1

Source of truth for what v1 must deliver. Every requirement has a REQ-ID that maps to exactly one phase in `ROADMAP.md` (see Traceability at the bottom).

---

## v1 Requirements

### Auth & Access Control

**Note:** `AUTH-01` through `AUTH-06` are **DEPRECATED** as of Phase 0.5 — superseded by `CFA-*` below. The Auth.js approach was explored in P0 and replaced with Cloudflare Access for GLBA alignment, edge enforcement, and MFA.

- [ ] ~~**AUTH-01..06**~~ → see `CFA-01..10`

### Cloudflare Access & Encryption (Phase 0.5)

- [ ] **CFA-01**: Authentication happens at the Cloudflare edge via Cloudflare Access (not Auth.js)
- [ ] **CFA-02**: All server actions validate the `Cf-Access-Jwt-Assertion` header against Cloudflare JWKS before acting
- [ ] **CFA-03**: JWT `aud` claim must match the Access application's AUD tag; `iss` claim must match the team domain
- [ ] **CFA-04**: App origin is isolated via Cloudflare Tunnel — direct origin access (bypassing Cloudflare) returns 403/404
- [ ] **CFA-05**: MFA is required on all sessions (enforced in Access policy)
- [ ] **CFA-06**: Sign-out link directs to Cloudflare-hosted logout URL
- [ ] **CFA-07**: Email claim source is the verified JWT; raw `Cf-Access-Authenticated-User-Email` header is never trusted alone
- [ ] **CFA-08**: Access session duration ≤ 24 hours
- [ ] **CFA-09**: Access "Purpose justification" enabled — recorded on every login

*Note: an earlier draft included a CFA-10 for Access Logpush retention. Dropped — Logpush is Enterprise-only, and the app-level `change_history` + `npi_access_log` (layers 1 + 2) are the authoritative GLBA audit trail. Long-term archival of Cloudflare Access API logs is a v2 backlog item (daily cron), not a requirement.*

- [x] **CFA-11**: `curl -I https://npr-dashboard-prototype-production.up.railway.app` returns 403/404 — direct Railway origin cannot be reached without a CF Access JWT (resolves P0.5 SC1 deferral; Phase 0.5.1)
- [x] **CFA-12**: After CF Access login at `portal.utstitle.com`, `AppHeader` avatar renders the real authenticated Google identity (name + email) — not the fallback "CD" initials (resolves P0.5 SC3 deferral; Phase 0.5.1)

- [ ] **NPI-01**: Column-level encryption for NPI fields using `@47ng/cloak` (`lib/crypto.ts`)
- [ ] **NPI-02**: Every `decrypt()` call inserts a row into `npi_access_log` — non-skippable, enforced in tests
- [ ] **NPI-03**: Encryption key rotation supported from day one (multi-key mode) even if not used immediately
- [ ] **NPI-04**: Master key stored in Railway env var (`ENCRYPTION_KEY`, 32-byte base64), with 1Password backup for disaster recovery; never in the repo

- [ ] **VENDOR-01**: `.planning/VENDORS.md` tracks all third-party data processors with data-touched + DPA status + owner
- [ ] **VENDOR-02**: NPI is redacted before any call to Anthropic API (`lib/anthropic.ts::redactNPI`) — P6 deliverable, tracked here
- [ ] **VENDOR-03**: ClickUp task titles and descriptions contain no NPI (policy, enforced in code review) — P7 onward

### Deal Data Model

- [x] **DEAL-01**: System supports 8 tracks with default priority:
  - Title & Escrow (`TE`) — HIGH
  - Funding & Lending (`FL`) — HIGH
  - Deal Planning & Structure (`DP`) — MEDIUM
  - Partnership Opportunity (`PO`) — MEDIUM
  - Education & Consulting (`EC`) — MEDIUM
  - Seller Listing (`SL`) — MEDIUM (future — P1 ships the enum value; UI affordance + stage list calibrated in P10)
  - Buyer Listing (`BL`) — MEDIUM (future — same treatment as SL)
  - General Inquiry (`GI`) — MEDIUM (real track; minimal stages in P1, calibrated in P10)
- [x] **DEAL-02**: A deal has: track, title, stage_id (UI label "Milestone"), priority (`HIGH` | `MEDIUM` | `LOW`), opened_at, closing_at, funding_at (nullable — distinct from closing_at when they differ), closed_at, status, service_selected, file_no (auto-generated — see DEAL-02a), title_file_no, loan_no, loan_type, transaction_type, property_address, property_state, property_type, sales_price (renamed from purchase_price), loan_amount, estimated_down (renamed from down_payment), earnest_money, est_rehab, arv, title_ctc, lender_ctc, quick_note (free-text, optional, shown on list view)
- [x] **DEAL-02a**: `file_no` auto-generates on deal insert in format `{STATE}-{YYYY}-{NNNN}` where STATE is the 2-letter `property_state` upper-cased (or literal `XX` if `property_state` is null), YYYY is the 4-digit year at insert time, and NNNN is a zero-padded per-year counter that resets on January 1. `file_no` is immutable after insert. Counter is global across states within a given year (so `TX-2026-0005` and `CA-2026-0006` are sequential).
- [x] **DEAL-03**: User can create a deal via a form at `/deal/new`
- [x] **DEAL-04**: User can view any deal at `/deal/[id]` showing File Contacts / Tasks / Emails / Notes / Audit tabs (People tab renamed to File Contacts)
- [x] **DEAL-05**: User can edit deal title, property details, and status fields in the detail view
- [x] **DEAL-06**: User can mark a deal as `closed` or `killed` (killed requires a reason note)

### Stages

- [x] **STAGE-01**: Stages (UI label "Milestones") are track-scoped via a hybrid model. `stages` table has a nullable `track_id` FK: NULL = universal (applies to all tracks), non-null = track-specific. A deal's stage must be either a universal stage or a stage whose `track_id` matches the deal's track. Seed values:

  **Universal (4):** `pre_screen_qualification`, `deal_structuring`, `file_completed` (terminal), `killed` (terminal)

  **Title & Escrow (TE) — 10 stages in sequence:** `title_order_opened`, `title_not_clear_to_close`, `title_clear_to_close`, `cd_ss_not_balanced`, `cd_ss_balanced`, `closing_scheduled`, `signing_completed`, `disbursed`, `recorded`, `policy_issued`

  **Funding & Lending (FL) — 11 stages in sequence:** `deal_team_assigned`, `preparing_lender_review_pkg`, `deal_pkg_submitted_to_lender`, `term_sheets_received`, `approval_decision_received`, `term_sheet_loi_received`, `uw_conditions_issued`, `uw_conditions_cleared`, `lender_docs_received`, `funding_conditions_cleared`, `funding_approval_received`

  **Deal Planning & Structure (DP), Partnership Opportunity (PO), Education & Consulting (EC), Seller Listing (SL), Buyer Listing (BL), General Inquiry (GI):** ship with universal stages only in P1. Track-specific stage lists for these six tracks are added during calibration week (P10) as Carrie uses them with real deals.

- [x] **STAGE-02**: User advances stage with a two-click confirmation; every advance writes to `audit_log`
- [x] **STAGE-03**: User can revert a stage via an explicit revert action (separate from advance); revert is also audited
- [ ] **STAGE-04**: During calibration week (P10), Carrie tunes stage ordering, renames, and adds track-specific stages for DP/PO/EC/SL/BL/GI based on real-deal use. Most post-close stages (cd_ss_balanced through policy_issued) already ship in v1 core via STAGE-01, so STAGE-04 is tuning rather than adding.

### People Map & Contacts

- [x] **PEOPLE-01**: System maintains a global `contacts` registry (full_name, role_hint, org, email, phone, notes)
- [x] **PEOPLE-02**: A deal has `deal_people` link rows mapping contacts to per-track role slots:
  - `directing_agent`
  - `main_contact` (formerly "primary contact" — the lead name on the file; could be client, partner, customer, or student depending on deal type)
  - `title_partner` (autosuggest from partner contacts)
  - `borrower` (may be bound to `main_contact` via VIEW-05 behavior)
  - `seller`
  - `mortgage_partner` (renamed from `lender_partner` — the mortgage brokerage partner)
  - `lender_partner` (NEW, free-text — the actual lender on the deal, distinct from the mortgage partner; free-text because lenders are often not in the contacts registry)
  - `tc_partner` (autosuggest from partner contacts)
  - `tl_partner` (autosuggest from partner contacts)
  - `consultant_partner` (NEW)
  - `listing_agent`
  - `internal_owner`
- [x] **PEOPLE-03**: When assigning a contact to a role slot, autosuggest shows existing contacts matching name/email
- [x] **PEOPLE-04**: `/contacts` page lists all contacts with "on N active deals" count
- [x] **PEOPLE-05**: Role slots are enforced per track in application code (unknown slot = validation error) — Phase 3 Plan 02

### Tasks

- [x] **TASK-01**: A deal has a task list with columns: title, owner, due_date, status (open/done/skipped), is_next bool, parent_task_id (nullable — for sub-tasks), advances_stage_to (nullable stage_id — completing auto-advances the deal's milestone if set). Completion UX is a checkbox. Completed tasks sort to the bottom of the list; open tasks stay grouped at top (so the task list remains scannable without the old ones disappearing). Email drafts sent from a task are attached back as notes on that task. Users can add tasks manually from the deal detail view.
- [x] **TASK-02**: Exactly one task per deal can have `is_next = true` at any time
- [x] **TASK-03**: Completing the current `is_next` task auto-promotes the next open task to `is_next`
- [x] **TASK-04**: Task completion has a 5-second undo toast
- [x] **TASK-05**: The dashboard list view surfaces the `is_next` task per deal in its own column

### Intake

- [ ] **INTAKE-01**: User can create a deal from scratch via a manual "New Deal" form
- [ ] **INTAKE-02**: User can paste a Gmail thread URL or message ID; the app fetches sender/subject/body and prefills the new-deal form
- [ ] **INTAKE-03**: User can paste arbitrary text (e.g., copied FB Messenger message); the text is stored as intake notes on the new deal
- [ ] **INTAKE-04**: Optional LLM extraction (Haiku) parses pasted text into structured fields (name, email, phone, property) when Carrie opts in per intake

### Email Automation

- [ ] **EMAIL-01**: System stores named email templates with subject/body and merge fields (deal fields, role-slot contact references)
- [ ] **EMAIL-02**: User can open a "Draft follow-up" modal from any task; it preselects template, recipient role, and renders merged content
- [ ] **EMAIL-03**: User can edit the rendered draft before sending
- [ ] **EMAIL-04**: User can click "Polish in Mike's voice" to re-render via Anthropic Sonnet (opt-in per click, cost shown on button)
- [ ] **EMAIL-05**: User can send the draft via Gmail API (uses the signed-in user's Gmail)
- [ ] **EMAIL-06**: Every draft (sent or not) is stored in `email_drafts` with `tokens_used` and `polished_by_llm` flags

### LLM Cost Controls

- [ ] **LLM-01**: All Anthropic calls log input/output token counts and model used
- [ ] **LLM-02**: Dashboard footer shows month-to-date Anthropic spend, computed from `email_drafts.tokens_used` aggregated with model pricing
- [ ] **LLM-03**: Haiku used for cheap/routine operations (intake extraction); Sonnet only on explicit user opt-in (email polish)
- [ ] **LLM-04**: Anthropic API key is read from env var only; never logged or displayed

### Integrations

- [ ] **INTEG-01**: Gmail API: fetch a thread by message_id on demand; store in `linked_emails` with message_id, thread_id, subject, from_addr, received_at
- [ ] **INTEG-02**: Gmail API: send a drafted email as the signed-in user
- [ ] **INTEG-03**: ClickUp: user can paste a ClickUp task URL; app extracts task_id and stores in `linked_clickup` (no data copy — just a link)
- [ ] **INTEG-04**: ClickUp: one-time seed import imports the 11 existing MAIN WORKFLOW tasks + custom fields into Postgres, with a review/diff screen before committing
- [ ] **INTEG-05**: GHL: on new-contact creation, optional "pull from GHL by email" button enriches phone/notes
- [ ] **INTEG-06**: All external API calls wrapped with timeout + error boundary; failures show inline affordance, do not crash the view

### Views

- [x] **VIEW-01**: `/` shows list of active deals with these columns in order (left → right):
  1. **Tracking** — track badge colored by track's default priority
  2. **Priority** — per-deal override of track default (`HIGH` | `MEDIUM` | `LOW`)
  3. **File #** — `deal.file_no`
  4. **Main Contact** — name of the `main_contact` role-slot contact
  5. **Address** — `deal.property_address` (truncated; may be empty for non-property deals)
  6. **Milestone** — `deal.stage.label` (UI label; DB column remains `stage_id`)
  7. **Progress / Next Task** — next open task title (bound by TASK-05 `is_next`)
  8. **Task Due By** — due date of the next task
  9. **Quick Note** — `deal.quick_note` (free-text, truncated)
  10. **Activity** — last mutation timestamp (must be last column)
- [x] **VIEW-02**: List view has filters: track, milestone (stage), priority, "Needs me" toggle (deals where next-task owner is the signed-in user), overdue, closing date (range on `closing_at`), funding date (range on `funding_at`), task due date (range on next task's due_date)
- [ ] **VIEW-03**: `/kanban` groups deals into columns by milestone with drag-to-advance (two-click confirm)
- [ ] **VIEW-04**: `/calendar` shows scheduled closings (Title + Lending) in week/month view
- [x] **VIEW-05**: `/deal/[id]` has tabs: Overview, File Contacts (renamed from People), Tasks, Emails, Notes, Audit. On Overview, the "Tracking" section (renamed from "Progress") is placed above the property address block. Rename of field labels on Overview: "Purchase" → "Sales Price", "Loan" → "Loan Amount", "Down" → "Estimated Down".
- [x] **VIEW-06**: `/contacts` shows global contacts with search + "on N active deals"
- [ ] **VIEW-07**: Cmd-K palette for searching deals, jumping to deals, creating new deals/tasks
- [ ] **VIEW-08**: Keyboard nav: j/k between list rows, Enter to open, Esc to close, N new deal, T new task
- [ ] **VIEW-09**: Mobile/tablet: list collapses to cards; deal detail becomes single-scroll column

### Operational

- [x] **OPS-01**: Every mutation (deal create/update, stage change, task change, people change, email send) writes a row to `audit_log` with before/after JSON
- [ ] **OPS-02**: Postgres daily backup via Railway (included on plan); first-month weekly restore drill documented
- [ ] **OPS-03**: Environment variables are read via a Zod-validated `lib/env.ts` module; app refuses to start on missing/invalid env
- [ ] **OPS-04**: No secrets in the repo; real values in Railway env vars; `.env.example` has placeholders only

### Deployment

- [ ] **DEPLOY-01**: App builds cleanly via `next build`
- [ ] **DEPLOY-02**: App runs on Railway with managed Postgres service (`${{Postgres.DATABASE_URL}}` reference)
- [ ] **DEPLOY-03**: Custom domain (e.g., `dashboard.utstitle.com`) wired through Railway + DNS
- [ ] **DEPLOY-04**: `AUTH_TRUST_HOST=true` set for Auth.js v5 behind Railway proxy
- [ ] **DEPLOY-05**: Google OAuth credentials: production redirect URI registered in Google Cloud Console
- [ ] **DEPLOY-06**: Playwright smoke test validates unauthenticated → redirect to /sign-in flow on Railway dev URL
- [x] **DEPLOY-07**: Railway production has a Postgres service provisioned; `DATABASE_URL` is wired to the Next.js app service as a reference variable (`${{Postgres.DATABASE_URL}}`) so it stays in sync across Postgres password rotations (Phase 0.5.1)
- [x] **DEPLOY-08**: Railway production app service has `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_DOMAIN`, and `NEXT_PUBLIC_APP_BRAND_COLOR` env vars set — P1-02 `lib/env.ts` Zod schema requires these and refuses to boot without them (Phase 0.5.1)
- [x] **DEPLOY-09**: Repo declares a deploy-time migration hook — either `railway.json` with a `postdeploy` step running `npm run db:migrate` OR `package.json` with a `prestart` script — so every push auto-applies pending migrations and the prod DB schema stays in sync with `drizzle/migrations/meta/_journal.json` (Phase 0.5.1)

---

## v2 Requirements (deferred)

### Internal dashboard v2 — existing deferrals

- Multi-user with role-based access (Carrie, Mike, Melissa, TC, external partners)
- Two-way sync to ClickUp and GHL
- Background Gmail polling with webhook-style updates
- Automated stage transition inference (e.g., "CTC received" email auto-advances to `cd_prep`)
- Partner profile "BC-17 cleared" warning chip on deal assignments (pull from ClickUp Partner Profiles list)
- LLM-powered weekly "what moved, what stalled" digest

### Client-facing product (separate from internal dashboard — v2 epic)

Per 2026-04-17 feedback from Carrie: these are a **separate product** from the internal dashboard (a client-facing portal, not a second mode of `portal.utstitle.com`). Likely a separate subdomain (e.g., `clients.utstitle.com`) with magic-link auth. Captured here for traceability; scoped and planned in its own milestone after v1 ships.

- **V2-PZ-01**: Pizza Tracker view — clients see a read-only status page for their file, with milestone stepper and next-step copy. Accessed via magic link (no login required).
- **V2-PZ-02**: Automated status emails — on every milestone advance, an email with a Pizza Tracker snapshot is sent to the file's `main_contact`.
- **V2-IN-01**: Public intake link per user/brand — generates a form (optionally JotForm-backed) that creates a deal when submitted.
- **V2-IN-02**: AI PSA parser — client uploads a PSA via intake link; Haiku extracts fields (parties, sales price, closing date, property) and pre-fills the deal on creation.
- **V2-EM-01**: Side-aware email chains — each deal has a Seller Email Chain and a Buyer Email Chain; drafts auto-include the correct side's team based on each contact's `side` field.
- **V2-PC-01**: Partner cards (global contacts registry expansion) — each partner contact has entity docs, notes, and a `fees` JSON block for per-partner fee schedules.
- **V2-DOC-01**: Company documents library — separate from per-deal documents; global R2 bucket with role-based access for transaction templates.
- **V2-DOC-02**: Document-triggers-task-completion — uploading a document matching a task's naming convention auto-completes that task.
- **V2-EMAIL-TAGS**: Tag emails by subject (scheduling, title, etc.) — surfaces in email threads tab.

---

## Out of Scope

- **FB Messenger integration** — cannot be automated per user. Remains manual triage into Gmail.
- **Content / NPR brand production workflows** — separate systems. Not this dashboard.
- **Financial / accounting features** — dashboard is operational, not a ledger.
- **Document generation** (title docs, CDs, closing packages) — remains in existing title/escrow software.
- **Real-time collaboration / multi-cursor editing** — single user v1.

---

## Traceability

| REQ-ID | Phase |
|--------|-------|
| ~~AUTH-01 → AUTH-06~~ (DEPRECATED) | ~~Phase 0~~ → replaced by CFA-* in Phase 0.5 |
| OPS-03, OPS-04 | Phase 0 |
| DEPLOY-01, DEPLOY-02, DEPLOY-04, DEPLOY-05, DEPLOY-06 | Phase 0 |
| CFA-01 → CFA-09 | Phase 0.5 |
| CFA-11, CFA-12 | Phase 0.5.1 (resolves P05-CLOSURE deferrals) |
| DEPLOY-07, DEPLOY-08, DEPLOY-09 | Phase 0.5.1 (inserted 2026-04-18) |
| NPI-01 → NPI-04 | Phase 0.5 |
| VENDOR-01 | Phase 0.5 |
| VENDOR-02 | Phase 6 (with Anthropic integration) |
| VENDOR-03 | Phase 7 (with ClickUp integration) |
| DEAL-01, DEAL-02, DEAL-02a, DEAL-03 | Phase 1 |
| STAGE-01 | Phase 1 |
| VIEW-01, VIEW-02 | Phase 1 |
| DEAL-04, DEAL-05, DEAL-06 | Phase 2 |
| STAGE-02, STAGE-03 | Phase 2 |
| TASK-01 → TASK-05 | Phase 2 |
| VIEW-05 | Phase 2 |
| OPS-01 | Phase 1 (D-05 in phase 1 CONTEXT moved from Phase 2) |
| PEOPLE-01 → PEOPLE-05 | Phase 3 |
| VIEW-06 | Phase 3 |
| INTEG-01 | Phase 4 |
| INTAKE-01, INTAKE-02, INTAKE-03 | Phase 4 |
| EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-05, EMAIL-06 | Phase 5 |
| INTEG-02 | Phase 5 |
| EMAIL-04 | Phase 6 |
| INTAKE-04 | Phase 6 |
| LLM-01, LLM-02, LLM-03, LLM-04 | Phase 6 |
| INTEG-03, INTEG-04 | Phase 7 |
| INTEG-05 | Phase 8 |
| INTEG-06 | Phase 8 |
| VIEW-03, VIEW-04 | Phase 9 |
| VIEW-07, VIEW-08, VIEW-09 | Phase 9 |
| STAGE-04 | Phase 10 |
| DEPLOY-03 | Phase 10 |
| OPS-02 | Phase 10 |
