# Phase 1: Core Data Model - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Discussion mode:** interactive (2 areas deep-dived: Schema architecture + Cross-cutting; 2 areas delegated to Claude's Discretion: New Deal form + List view behavior)

<domain>
## Phase Boundary

Phase 1 ships the **data foundation + first usable surface** of NPR Dashboard v1:

- **Tables:** `tracks`, `stages`, `deals` (+ `audit_log` per D-05)
- **Seed data:** 8 tracks, 25 stages (4 universal + 10 Title & Escrow + 11 Funding & Lending)
- **Constraints:** `stages.track_id` nullable FK; CHECK that a deal's stage is either universal (`track_id IS NULL`) or matches the deal's track
- **Auto-generation:** `file_no` in format `{STATE|XX}-{YYYY}-{NNNN}` via Postgres sequence per year
- **Routes:** `/deal/new` (New Deal form), `/` (list view — rewrite of prototype page)
- **Audit:** `audit_log` table + writes on deal-create (extends to other mutations in P2)

**Not in Phase 1:**
- Deal detail page `/deal/[id]` (P2)
- Tasks table + `is_next` semantics (P2)
- Stage advancement flow with two-click confirm (P2)
- Contacts registry + per-deal role slots (P3 — Main Contact shipped as free-text in P1 per D-03)
- Any Gmail / email / LLM / integration work (P4+)

</domain>

<decisions>
## Implementation Decisions

### Schema architecture (from discuss-phase 2026-04-17)

- **D-01:** `tracks` and `stages` ship as **lookup tables with FKs**, not pgEnum.
  - `tracks` columns: `id uuid PK`, `code text UNIQUE NOT NULL` (e.g., `"TE"`), `label text NOT NULL` (e.g., `"Title & Escrow"`), `default_priority` enum (`HIGH|MEDIUM|LOW`), `active boolean NOT NULL DEFAULT true`, `sort_order int NOT NULL`.
  - `stages` columns: `id uuid PK`, `code text UNIQUE NOT NULL` (e.g., `"pre_screen_qualification"`), `label text NOT NULL` (e.g., `"Pre-Screen / Qualification"`), `track_id uuid NULL REFERENCES tracks(id)` (NULL = universal), `sort_order int NOT NULL`, `is_terminal boolean NOT NULL DEFAULT false`.
  - `deals.track_id` FK to `tracks`; `deals.stage_id` FK to `stages`.
  - Rationale: Carrie will add/rename stages in P10 calibration — that becomes an SQL `INSERT`, not a code change + `ALTER TYPE` migration. Also stores metadata (default priority, sort order, terminal flag) cleanly.

- **D-02:** `file_no` auto-generation uses **Postgres sequence per year**.
  - Per-year sequence named `deals_file_no_{YYYY}_seq` (e.g., `deals_file_no_2026_seq`).
  - On insert, the server action calls a SQL function `next_file_no(state_code text)` that:
    1. Computes year from `CURRENT_DATE`
    2. `CREATE SEQUENCE IF NOT EXISTS deals_file_no_{YYYY}_seq START WITH 1;` (idempotent — lazy creation on first deal of a new year)
    3. Returns `{state_code}-{YYYY}-{LPAD(nextval, 4, '0')}`
  - `state_code` is the 2-letter `property_state` upper-cased; falls back to literal `XX` if null.
  - `file_no` is immutable after insert (enforced via trigger or application code).
  - Rationale: Postgres guarantees collision-free atomicity. Low deal volume (≤50/day) makes advisory-lock complexity unnecessary.

- **D-03:** Main Contact ships as **free-text in P1, migrated to FK in P3**.
  - `deals.main_contact_name text NULL`
  - `deals.main_contact_email text NULL`
  - `deals.main_contact_phone text NULL` (nice-to-have; can defer to P3 with other contact fields)
  - Phase 3 adds `contacts` + `deal_people` tables, migrates these fields to `deals.main_contact_id uuid FK REFERENCES contacts(id)`, drops the text fields.
  - VIEW-01 "Main Contact" column reads `deal.main_contact_name` in P1; `deal.main_contact.full_name` after P3 migration.
  - Rationale: P1 is usable (Carrie can tell deals apart by contact name) without dragging P3's relational role-slot model forward.

- **D-04:** Schema files split into **`db/schema/auth.ts` + `db/schema/app.ts`** now.
  - `db/schema/auth.ts` — `users`, `npi_access_log` (moved from existing `db/schema.ts`)
  - `db/schema/app.ts` — `tracks`, `stages`, `deals`, `audit_log` (new)
  - `db/schema/index.ts` — re-exports both so existing `@/db/schema` imports continue working
  - Rationale: creates a clean template-extraction seam. Future starter repo copies `auth.ts` verbatim, strips `app.ts`. Cost: 10-min refactor in P1.

- **D-04a:** Add FK constraint `npi_access_log.dealId → deals.id` during Phase 1 migration.
  - The column exists (from P0.5) but has no FK because `deals` didn't exist. Adding it now closes a dangling reference.

### Cross-cutting concerns (from discuss-phase 2026-04-17)

- **D-05:** **Ship OPS-01 audit log in Phase 1** for deal-create mutations (REQUIREMENTS traceability updated to P1 for OPS-01).
  - New table `audit_log`: `id uuid PK`, `table_name text NOT NULL`, `record_id uuid NOT NULL`, `operation text NOT NULL` (`create|update|delete`), `before_json jsonb NULL`, `after_json jsonb NOT NULL`, `user_id uuid NOT NULL REFERENCES users(id)`, `user_email text NOT NULL` (denormalized for GLBA traceability even if user row is later deleted), `created_at timestamptz NOT NULL DEFAULT now()`.
  - Indices: `(table_name, record_id)`, `(user_id, created_at)`, `(created_at DESC)`.
  - Phase 1 writes audit rows on `deal.create` (`operation='create'`, `before_json=NULL`, `after_json=<full deal row>`).
  - P2 extends writes to `deal.update`, stage advancement, task mutations.
  - Rationale: deal creation IS a GLBA-relevant mutation. Partial P1 audit (only `deals.created_at` + `deals.created_by`) would leave a gap during P1→P2 window. Small P1 scope bump (~1 hour) for much cleaner compliance story.

- **D-06:** Promote app-name / domain hardcoded strings to **`NEXT_PUBLIC_*` env vars** now.
  - Add to `.env` + `.env.example`:
    - `NEXT_PUBLIC_APP_NAME=NPR Dashboard`
    - `NEXT_PUBLIC_APP_DOMAIN=portal.utstitle.com` (also used for CORS + logout redirect URLs)
    - `NEXT_PUBLIC_APP_BRAND_COLOR=` (optional, defaults if absent)
  - Extend `lib/env.ts` Zod schema with these fields (Zod `.default()` for optional ones).
  - Update `components/app-header.tsx` to read `NEXT_PUBLIC_APP_NAME` instead of hardcoded string.
  - Rename "prototype" label to read from env (or drop — see D-10 below).
  - Rationale: template-extraction-friendly; template users change one `.env` line to rebrand.

- **D-07:** List view table uses **shadcn Table primitive + custom filter/sort logic**.
  - Install via `npx shadcn@latest add table`.
  - Filter + sort state lives in **URL search params** (e.g., `/?track=TE&priority=HIGH&sort=activity_desc`), rendered server-side. Shareable URLs, no client JS for state.
  - Filter UI components are client-side (dropdowns, checkboxes) but on change, they `router.push(new URL)` to update the URL, which re-renders the server component with filtered data.
  - Rationale: matches the rest of the stack (Server Components + Drizzle + shadcn). TanStack Table's features don't earn weight at v1's deal volume (≤50).

### Claude's Discretion — New Deal form (user delegated)

- **D-08:** **Form layout — sectioned accordion.** Three collapsible sections: (1) "File basics" — open by default, contains track, priority, title, file_no preview, property_state, main_contact_name/email; (2) "Property details" — collapsed by default, contains property_address, property_type, sales_price, loan_type, transaction_type; (3) "Financials & dates" — collapsed by default, contains loan_amount, estimated_down, earnest_money, est_rehab, arv, closing_at, funding_at, title_ctc, lender_ctc.
  - Rationale: 25-ish fields in a single scroll is intimidating; stepper-with-validation-per-step is heavy for daily use. Accordion lets Carrie fill just the essentials fast and expand sections as needed. User can revisit after seeing it.

- **D-09:** **Property fields always visible but optional.** DP/PO/EC/GI deals simply leave property section blank. `property_address`, `property_type`, `sales_price` are all nullable in schema. No conditional rendering per track — simpler and avoids "why can't I see the property field?" confusion.

- **D-10:** **Default stage on creation = universal `pre_screen_qualification`.** Every deal starts there; Carrie advances from there in P2. If property track is Title & Escrow or Funding & Lending, the next available stage to advance to is the track's first track-specific stage (`title_order_opened` / `deal_team_assigned`).

- **D-11:** **Validation display — shadcn Form + Zod inline field errors + toast on submit success/failure.**
  - Per-field error appears below field on blur when invalid, red border on focus-out.
  - On submit with errors: scroll to first error field, focus it, show toast "Please fix the errors above".
  - On submit success: redirect to `/` (list view) with toast "Deal {file_no} created".
  - Rationale: standard shadcn Form + react-hook-form + Zod resolver pattern.

### Claude's Discretion — List view behavior (user delegated)

- **D-12:** **Multi-filter semantics.** AND across filter groups (track AND milestone AND priority). OR within a multi-select group (select Title & Escrow + Funding & Lending tracks = deals in either).
  - Rationale: most intuitive for multi-dimensional filtering. User can revisit after seeing it.

- **D-13:** **Default sort — Activity column, descending.** Deals with most recent mutation appear first.
  - Rationale: matches Carrie's core question "where is this file" — recent activity surfaces in-flight work. If she wants closing-date sort, she clicks the Closing Date filter and sorts by that.

- **D-14:** **"Needs me" filter semantics.**
  - In P1 (no tasks yet): matches deals where `internal_owner = current_user.id` (falls back on the deal's `internal_owner` field).
  - After P2 lands tasks: matches deals where the current `is_next` task's `owner = current_user.id` OR (no `is_next` task AND `internal_owner = current_user.id`).
  - Rationale: graceful degradation; P1 "Needs me" is useful even before tasks exist.

- **D-15:** **Activity column source — `audit_log.created_at` of the most recent row for this deal.** Uses the audit_log table from D-05. Any mutation (create, update, future stage-change / task-add) refreshes Activity.
  - Rationale: single source of truth, naturally comprehensive. No separate "last activity" tracking.

- **D-16:** **Placeholder treatment for P2/P3 data columns.** Columns render `—` (em dash) with muted foreground color when source data doesn't exist yet (e.g., no tasks in P1 → "Progress / Next Task" and "Task Due By" cells show `—`). No tooltip, no "Data in Phase N" hint — just quiet absence. Same treatment for Main Contact when `main_contact_name` is null.
  - Rationale: graceful; doesn't make the empty state look broken. User can revisit if they want to add tooltips.

### Other decisions captured during discussion

- **D-17:** `deals.created_by uuid FK REFERENCES users(id) NOT NULL` — every deal is owned by the user who created it. Populated from `getCurrentUser()` in the server action.
- **D-18:** `deals.internal_owner uuid FK REFERENCES users(id) NULL` — defaults to `created_by` on insert, editable later. Used by "Needs me" filter fallback (D-14).
- **D-19:** `deals.status` text enum `active|closed|killed` (default `active`). P2 adds state machine for closed/killed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before planning or implementing.**

### Project spec
- `.planning/ROADMAP.md` (Phase 1 section) — goal, requirements, 4 success criteria with `file_no` format and list view column order
- `.planning/REQUIREMENTS.md` — DEAL-01, DEAL-02, DEAL-02a, DEAL-03, STAGE-01, VIEW-01, VIEW-02 full text; PEOPLE-02 (P3 Main Contact model to align D-03 migration); OPS-01 (per D-05, now mapped to P1)
- `.planning/PROJECT.md` — user context (Carrie Davis COO, 5-second-glance value prop)
- `.planning/feedback/2026-04-17-carrie-triage.md` — source of track/stage/field decisions
- `.planning/proposals/2026-04-17-spec-updates-from-carrie.md` — before/after spec diffs + Carrie's 10 answers
- `AUDIT.md` (repo root) §1, §3, §8 — audit architecture (3-layer), NPI encryption boundary, GLBA posture
- `.planning/VENDORS.md` — vendor register (informational; Phase 1 doesn't touch third-party vendors)

### Prior phase work
- `.planning/phases/00.5-access-encryption/PLAN.md` — established conventions for `lib/` files and TDD discipline
- `.planning/phases/00-foundation/PLAN.md` (historical — Auth.js superseded by P0.5, but shows the initial Drizzle + Next.js patterns)

### Source-of-truth code (for patterns and types)
- `db/schema.ts` — existing schema (users, npi_access_log); MUST be refactored into `db/schema/auth.ts` per D-04
- `lib/current-user.ts` — getCurrentUser() pattern; Phase 1 server actions use this to resolve `created_by`
- `lib/users.ts` — upsert-by-email pattern; users row exists by the time a deal is created
- `lib/env.ts` — Zod env validation; extend per D-06
- `lib/access.ts` — referenced only for JWT verification (don't touch)
- `proxy.ts` — middleware enforces CF Access before any route handler runs; Phase 1 routes inherit this
- `components/app-header.tsx` — read NEXT_PUBLIC_APP_NAME here per D-06
- `components/ui/*` — shadcn primitives available (card, button, badge, checkbox, dialog, dropdown-menu, input, popover, select, separator, sonner, tabs, hover-card, avatar). Add `table` via shadcn CLI per D-07.
- `mock/deals.ts` — delete entirely after Phase 1 list view is real (tracked as separate todo)

### Template extraction forward-design
- `.planning/template-extraction-plan.md` — read to understand what D-04 + D-06 enable for future extraction

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **`users` table** — already in `db/schema.ts`. Use for `deals.created_by` and `deals.internal_owner` FKs.
- **`npi_access_log.dealId`** — uuid column exists with no FK. Add FK to `deals(id)` in P1 migration (D-04a).
- **`lib/current-user.ts::getCurrentUser()`** — returns the canonical User row for the signed-in user. Use in server actions.
- **`lib/env.ts`** — Zod-validated env module. Extend with `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_APP_DOMAIN` per D-06.
- **shadcn primitives in `components/ui/`** — 14 components ready: avatar, badge, button, card, checkbox, dialog, dropdown-menu, hover-card, input, popover, select, separator, sonner (toast), tabs. Add `table` via `npx shadcn@latest add table`.

### Established patterns
- **Drizzle schema** — single file `db/schema.ts` currently, splits to `db/schema/auth.ts` + `db/schema/app.ts` + `db/schema/index.ts` in P1 per D-04. Use `pgTable`, `uuid("id").defaultRandom().primaryKey()`, `timestamp({ withTimezone: true })`.
- **Server actions** — Next.js 16 App Router pattern: `"use server"` directive in a file, export async functions called from forms or client components. For list view, use Server Components that read Drizzle directly.
- **Zod validation** — used for env in `lib/env.ts`; use for form schemas (`createDealSchema`) and shared DTOs.
- **CF Access identity** — all authenticated user info comes from `getCurrentUser()`; never parse the Cloudflare header directly in app code.
- **TDD discipline** — P0.5 shipped with 16 unit + 3 e2e tests green. Continue: write tests alongside each Drizzle migration, each server action, each non-trivial helper.
- **Migrations** — Drizzle kit commands: `npm run db:generate` → `npm run db:migrate`. Commit both the generated SQL and the meta/*.json snapshot.

### Integration points
- **`app/page.tsx`** — currently renders mock deals from `mock/deals.ts`. Phase 1 rewrites this to query real `deals` from DB and render the 10-column list view.
- **`app/deal/[id]/page.tsx`** — exists as prototype; Phase 1 leaves mostly alone (Phase 2 rebuilds it). Ensure it doesn't break when `deal.id` is a real uuid.
- **`app/deal/new/page.tsx`** — NEW. Server component wrapping a client form component (shadcn Form + react-hook-form + Zod).
- **`app/layout.tsx`** — already wraps with `AppHeader`; no changes needed unless we add a global Toaster (sonner) for form feedback.
- **`proxy.ts`** — already enforces CF Access. New routes inherit protection automatically; no explicit middleware changes needed.

</code_context>

<specifics>
## Specific Ideas

- **Carrie's 10 triage answers** (applied 2026-04-17): `Main Contact` label; 3-level priority enum; Hybrid stages (track-scoped + universal); all 8 tracks ship in P1; General Inquiry is a real track; file_no format `{STATE|XX}-{YYYY}-{NNNN}`; `funding_at` nullable distinct field; quick_note is free-text; v2 Mode = client-facing product (separate); Stage→Milestone is UI-only rename.
- **Carrie's workflow model** (from PROJECT.md): her primary mental question is *"where is this file?"* and *"whose turn is next?"*. Default sort and "Needs me" filter exist to serve this; don't sacrifice that affordance for other design considerations.
- **Phase boundary discipline** (user's own words): user explicitly said "I'll revisit the form + list view after I see them working" — means default pick ships, iteration lands in P2 or P10 calibration. Resist over-engineering the first version.

</specifics>

<deferred>
## Deferred Ideas

### Phase 2 (Deal Detail, Tasks, Stages)
- Full `deal/[id]` detail page with tabs
- Tasks table + `is_next` semantics
- Stage advancement flow with two-click confirm
- Audit log writes extended to updates + stage changes + task changes

### Phase 3 (People Map & Contacts)
- `contacts` table + `deal_people` per-track role slots
- Migration: `deals.main_contact_name/email` → `deals.main_contact_id` FK
- Contact autosuggest on role-slot assignment

### Phase 10 (Calibration Week)
- Track-specific stage lists for DP, PO, EC, SL, BL, GI (ship with universal stages only in P1 per DEAL-01)
- Priority enum usage calibration (LOW may get dropped if truly unused)
- Any UX refinements Carrie flags during daily use (form layout tweaks, filter behavior tweaks, Activity column semantics tweaks)

### v2 Mode (separate product, post-v1 milestone)
- Pizza Tracker client-facing view
- AI PSA parser intake
- Partner cards with fees + entity docs
- Side-aware email chains

### Template extraction (separate Claude Code session)
- See `.planning/template-extraction-plan.md` — D-04 (schema split) and D-06 (env-var strings) make this cheap later

### Out of scope entirely for v1
- Multi-user role-based access (Carrie, Mike, Melissa, TC partners) — v2
- Two-way sync with ClickUp and GHL — v2

</deferred>

---

*Phase: 01-core-data-model*
*Context gathered: 2026-04-17 via /gsd:discuss-phase 1*
*Next step: /gsd:ui-phase 1 (generates UI-SPEC.md) → /gsd:plan-phase 1*
