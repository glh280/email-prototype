# Phase 1: Core Data Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in [01-CONTEXT.md](./01-CONTEXT.md) — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 01-core-data-model
**Mode:** interactive
**Areas discussed:** Schema architecture, Cross-cutting
**Areas delegated to Claude's Discretion:** New Deal form, List view behavior

---

## Gray area selection

Four candidate areas were presented. User picked 2 for discussion, delegated 2 to Claude.

| Area | User selection |
|------|----------------|
| Schema architecture | ✓ Discuss |
| New Deal form | Claude's Discretion (user: "I'll revisit after I see it working") |
| List view behavior | Claude's Discretion (user: "I'll revisit after I see it working") |
| Cross-cutting (audit, template strings, table lib) | ✓ Discuss |

User's direction: *"Ask me the concrete questions for the two I picked, one section at a time, Schema first."*

---

## Schema architecture

### Q1: tracks and stages — as Drizzle pgEnum values or as lookup tables with FKs?

| Option | Description | Selected |
|--------|-------------|----------|
| Lookup tables with FKs (Recommended) | tracks and stages as separate Postgres tables. deals.track_id FK; deals.stage_id FK; stages.track_id FK (nullable for universal). Lets Carrie add/rename/reorder stages at runtime in P10 via DB inserts. Metadata stored as columns. | ✓ |
| Drizzle pgEnum | pgEnum types. Compile-time type safety. But P10 calibration requires migration + ALTER TYPE each change. No metadata. | |
| Hybrid — pgEnum for tracks, lookup for stages | Tracks as pgEnum, stages as lookup table. Compromise creating pattern inconsistency. | |

**User's choice:** Lookup tables with FKs
**Notes:** Aligns with ROADMAP.md wording ("creates deals, stages, tracks tables"). Supports P10 calibration without code changes.

---

### Q2: file_no auto-generation concurrency strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres sequence per year (Recommended) | CREATE SEQUENCE deals_file_no_{year}_seq; file_no = {STATE}-{year}-{LPAD(nextval, 4, '0')}. Year rollover via CREATE IF NOT EXISTS idiom. Postgres atomic, zero collisions. | ✓ |
| Counter table + advisory lock | counters table with (year, next_value). pg_advisory_xact_lock around increment. More flexible, you own the locking. | |
| Retry on unique-constraint violation | Compute client-side, attempt insert, retry on conflict. Simplest. Observable retry latency under concurrency. | |

**User's choice:** Postgres sequence per year
**Notes:** Low deal volume (≤50/day) makes collision rare, but sequences guarantee correctness.

---

### Q3: Main Contact column — free-text in P1, defer entirely, or pre-ship contacts shell?

| Option | Description | Selected |
|--------|-------------|----------|
| Free-text in P1, migrate to FK in P3 (Recommended) | deals.main_contact_name + _email text NULL. P3 migrates to deals.main_contact_id FK to contacts. | ✓ |
| Defer entirely — column renders — until P3 | No main_contact on deals in P1. List view Main Contact column empty placeholder. Cleanest phase boundary, worst UX. | |
| Pre-ship contacts table shell in P1 | Minimal contacts table (id, full_name, email, phone) in P1. deals.main_contact_id FK day 1. Phase boundary bleed. | |

**User's choice:** Free-text in P1, migrate to FK in P3
**Notes:** P1 usable; P3 owns the relational model without fighting P1 for ownership.

---

### Q4: Schema file organization — split now or later?

| Option | Description | Selected |
|--------|-------------|----------|
| Split into db/schema/auth.ts + db/schema/app.ts now (Recommended) | auth.ts = users + npi_access_log. app.ts = tracks/stages/deals. index.ts re-exports. Template extraction seam. ~10 min refactor. | ✓ |
| Keep single db/schema.ts — split later if unwieldy | Add to existing schema.ts. Template session separates manually. No P1 cost. | |
| Split further — per-domain files | db/schema/auth.ts, deals.ts, tasks.ts, contacts.ts, ... Most granular. Scales best. | |

**User's choice:** Split into db/schema/auth.ts + db/schema/app.ts now
**Notes:** Template-extraction-friendly design; tiny cost now saves future session work.

---

## Cross-cutting concerns

### Q5: OPS-01 audit log for deal mutations — ship in P1 or defer to P2?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship OPS-01 in P1 for deal.create writes (Recommended) | P1 creates audit_log table + writes row on deal.create. P2 extends to update + stage advancement + task mutations. Every deal has cradle-to-grave audit. | ✓ |
| Defer OPS-01 entirely to P2 (current mapping) | P1 uses only deals.created_at + created_by. Full audit_log in P2. | |
| Minimal P1 — just created_by + created_at | Compromise. P1 has attribution; full audit in P2. | |

**User's choice:** Ship OPS-01 in P1 for deal.create writes
**Notes:** REQUIREMENTS traceability will need OPS-01 → P1 update.

---

### Q6: Template-friendly app name strings — how to handle in P1+ code?

| Option | Description | Selected |
|--------|-------------|----------|
| Promote to env vars now (Recommended) | NEXT_PUBLIC_APP_NAME + NEXT_PUBLIC_APP_DOMAIN in .env + .env.example. Extend lib/env.ts Zod schema. Update app-header.tsx. ~20 min in P1. | ✓ |
| lib/constants.ts with exported consts | APP_NAME const in lib/constants.ts. Easier than env but still hardcoded. | |
| Defer entirely — template session handles | Leave hardcoded. Future extraction session does find-and-replace. | |

**User's choice:** Promote to env vars now
**Notes:** Next.js idiomatic pattern; zero runtime cost; makes template extraction trivial.

---

### Q7: Table component for the list view at /

| Option | Description | Selected |
|--------|-------------|----------|
| Shadcn Table + custom filter/sort logic (Recommended) | shadcn/ui table primitive. Filter + sort as URL search params. Server Components. Matches the rest of the stack. | ✓ |
| TanStack Table (headless) | Rich library with built-in features. Client-component model. More weight than P1 needs. | |
| Custom table from scratch | Full control, zero deps. Reinvents shadcn. | |

**User's choice:** Shadcn Table + custom filter/sort logic
**Notes:** Filter state lives in URL search params → shareable URLs, no client JS overhead.

---

## Claude's Discretion — areas delegated

User deferred two areas with the direction: *"Make the call on New Deal form and List view behavior, I'll revisit those after I see them working."*

### New Deal form (D-08 through D-11 in CONTEXT.md)
- **D-08** Form layout: sectioned accordion (3 sections)
- **D-09** Property fields always visible but optional (no per-track hiding)
- **D-10** Default stage on creation: universal `pre_screen_qualification`
- **D-11** Validation: shadcn Form + Zod inline field errors + toast on submit

### List view behavior (D-12 through D-16 in CONTEXT.md)
- **D-12** Multi-filter semantics: AND across groups, OR within multi-select group
- **D-13** Default sort: Activity column descending
- **D-14** "Needs me" filter: tasks.owner fallback to internal_owner before P2
- **D-15** Activity column source: latest audit_log row's created_at
- **D-16** Placeholder rendering: em dash for empty cells, no tooltip

---

## Deferred ideas

No new deferred ideas surfaced during discussion. Existing deferred items (P2 tasks, P3 contacts, P10 calibration, v2 client product, template extraction) are tracked in the CONTEXT.md `<deferred>` section.

---

## Scope creep deflections

None triggered. Discussion stayed within Phase 1 boundary.

---

*Generated: 2026-04-17 via /gsd:discuss-phase 1*
