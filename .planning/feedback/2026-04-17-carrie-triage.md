# Carrie's 2026-04-17 Feedback Triage

**Source:** Message received 2026-04-17 (review of Railway prototype at `https://npr-dashboard-prototype-production.up.railway.app`)
**Triaged:** 2026-04-17
**Status:** Awaiting review by Mike

---

## Summary

- Total feedback items: 52
- v1-refine: 24 (spec updates to existing phases)
- v1-gap: 13 (missing from v1 spec but belongs there)
- v2-feature: 13 (legitimate scope for v2 mode — maybe client-facing)
- bug: 2 (defects to fix separately)
- **Items that BLOCK Phase 1 planning: 16**

---

## Phase 1 blockers

Called out separately because Phase 1 is about to be planned. Any of these must be resolved in the spec (ROADMAP.md / REQUIREMENTS.md) before `/gsd:plan-phase 1` runs.

| # | Change | Impact on Phase 1 | Required action |
|---|--------|-------------------|-----------------|
| 1 | Track enum expands from 5 → 8 (add Seller Listing, Buyer Listing, General Inquiry) | DEAL-01 + `tracks` seed data | Update DEAL-01; confirm whether new tracks ship in P1 or are flagged "future" |
| 2 | Track labels renamed ("Title & Escrow", "Funding & Lending", "Deal Planning & Structure", "Partnership Opportunity", "Education & Consulting") | `tracks` seed labels | Update DEAL-01 label text |
| 3 | Stage enum expands from 10 → ~23 (Pre-Screen/Qualification through File Completed) | STAGE-01 + `stages` seed data | Rewrite STAGE-01 stage list; decide what's terminal; re-scope STAGE-04 (post-close stages now in v1 core, not calibration) |
| 4 | `stage` → `milestone` rename (column / UI label) | Column name and UI copy throughout | Decide: DB column stays `stage_id` for terseness, UI label becomes "Milestone"? Or rename column. Lock before P1 migration |
| 5 | `deal_number` → `file_number` rename | DEAL-02 field name, form field, list column | Update DEAL-02; rename across schema before migration lands |
| 6 | File number auto-generation starting with state abbreviation (e.g., `TX-00001`) | Deal insert logic; needs state at creation time | Add requirement DEAL-02a; decide numbering scheme (per-state vs global with state prefix) |
| 7 | Add `loan_type` field | DEAL-02 schema | Add to DEAL-02 field list + list view column |
| 8 | Add `transaction_type` field | DEAL-02 schema | Add to DEAL-02 field list + list view column |
| 9 | `purchase_price` → `sales_price` rename | DEAL-02 field name | Update DEAL-02 + migration naming |
| 10 | `loan_amount` stays but UI label "Loan" → "Loan Amount" | Minor label change | UI copy only — low risk |
| 11 | `down_payment` → `estimated_down` (label: "Estimated Down") | DEAL-02 field name / label | Update DEAL-02 |
| 12 | List view columns (VIEW-01) must match Carrie's ordering: Tracking, Priority, File #, Primary Contact, Address, Milestone, Progress/Next Task, Task Due By, Quick Note, Activity | VIEW-01 column list | Rewrite VIEW-01 column list |
| 13 | "Primary Contact" label ambiguity — could be partner/client/customer/student — Carrie unsure of label | PEOPLE-* + list column name | Open question; resolve before P1 form ships with a column named this |
| 14 | "Task Owner Due" → "Task Due By" column rename | VIEW-01 column label | UI copy |
| 15 | Closing date, funding date, task due date as **filters** on list view | VIEW-02 filters | Add to VIEW-02 filter list; requires closing/funding dates on deals (already in DEAL-02 as `closing_at`; funding date may be new) |
| 16 | Priority values: Carrie says "I'm not really seeing any of the tags as low priority" — implies priority enum needs review (maybe HIGH/MEDIUM only, or per-track default priority) | DEAL-02 `priority` semantics | Decide enum values before P1; current spec doesn't pin them |

---

## Full triage table

| ID | Carrie's bullet (quoted, ≤15 words) | Bucket | Phase it affects | Effort | Blocks P1? | Notes |
|----|-------------------------------------|--------|------------------|--------|------------|-------|
| F1 | "Title & Escrow (HIGH)" track label | v1-refine | P1 (DEAL-01) | S | **YES** | Rename from "Title" |
| F2 | "Funding & Lending (HIGH)" track label | v1-refine | P1 (DEAL-01) | S | **YES** | Rename from "Lending" |
| F3 | "Deal Planning & Structure (MEDIUM)" track | v1-refine | P1 (DEAL-01) | S | **YES** | Rename from "Deal Desk" |
| F4 | "Partnership Opportunity (MEDIUM)" track | v1-refine | P1 (DEAL-01) | S | **YES** | Rename from "Partnership" |
| F5 | "Education & Consulting (MEDIUM)" track | v1-refine | P1 (DEAL-01) | S | **YES** | Rename from "Consulting" |
| F6 | Add "Seller Listing" track (future) | v1-gap | P1 (DEAL-01) | S | **YES** | New enum value; priority unknown |
| F7 | Add "Buyer Listing" track (future) | v1-gap | P1 (DEAL-01) | S | **YES** | New enum value; priority unknown |
| F8 | Add "General Inquiry" track | v1-gap | P1 (DEAL-01) | S | **YES** | New enum value |
| F9 | Column: "Tracking (Tag)" first | v1-refine | P1 (VIEW-01) | S | **YES** | Column reorder |
| F10 | Column: "Priority" second; no-low-priority concern | v1-refine | P1 (DEAL-02 priority enum) | S | **YES** | Review enum values |
| F11 | "Deal → File #" column rename | v1-refine | P1 (DEAL-02, VIEW-01) | S | **YES** | Field + column |
| F12 | "Primary Contact Name" label ambiguous | v1-refine | P1/P3 | S | **YES** | Open question — see clarifications |
| F13 | Address column visible even when not every deal has a property | v1-refine | P1 (VIEW-01) | S | **YES** | Already in DEAL-02; column reorder |
| F14 | "Stage → Milestone" column rename | v1-refine | P1 (VIEW-01, STAGE-01 UI) | S | **YES** | Rename throughout |
| F15 | Stage enum: 23 values from Pre-Screen → File Completed | v1-refine | P1 (STAGE-01) | M | **YES** | Major rewrite of stages seed |
| F16 | "Progress/Next Task" column Carrie will build out | v1-refine | P1 (VIEW-01) | S | **YES** | Already covered by TASK-05 is_next |
| F17 | "Task Owner Due → Task Due By" column rename | v1-refine | P1 (VIEW-01) | S | **YES** | Label only |
| F18 | Quick note / last comment column | v1-gap | P1 (VIEW-01) | M | **YES** | Either latest note preview or free-form quick_note on deal |
| F19 | "Activity" moved to last column | v1-refine | P1 (VIEW-01) | S | **YES** | Column reorder |
| F20 | Expanded detail: Directing Agent kept | v1-refine | P3 (PEOPLE-02) | S | No | Already in PEOPLE-02 |
| F21 | Expanded detail: Borrower kept, may pull from primary contact | v1-refine | P3 (PEOPLE-02) | S | No | Behavior note |
| F22 | "Lender Partner → Mortgage Partner" role slot rename | v1-refine | P3 (PEOPLE-02) | S | No | Role name change |
| F23 | Add role slot: Lender Partner (free-text) | v1-gap | P3 (PEOPLE-02) | M | No | Distinct from mortgage partner; free-text implies non-registered contact |
| F24 | Title Partner — dropdown from partners list | v1-refine | P3 | M | No | Requires contacts registry of partners first |
| F25 | TC Partner — dropdown from partners list | v1-refine | P3 | S | No | Same pattern |
| F26 | TL Partner — dropdown from partners list | v1-refine | P3 | S | No | Same pattern |
| F27 | Add role slot: Consultant Partner | v1-gap | P3 (PEOPLE-02) | S | No | New role slot |
| F28 | Internal Owner kept | v1-refine | P3 | S | No | Already in PEOPLE-02 |
| F29 | Tasks checkable (checkboxes) | v1-refine | P2 (TASK-01) | S | No | Wording tweak on TASK — complete via checkbox UI |
| F30 | Add task manually from open-file view | v1-refine | P2 | S | No | Already implied by TASK-01 |
| F31 | "Deal Owners" confusion — duplicates Internal Owner? | bug/refine | P2/P3 | S | No | Prototype surface to remove or clarify |
| F32 | Progress Section moved above property address | v1-refine | P2 (VIEW-05 detail layout) | S | No | UI layout |
| F33 | "Progress Section → TRACKING" rename | v1-refine | P2 | S | No | Section label |
| F34 | "Purchase → Sales Price" label rename | v1-refine | P1/P2 (DEAL-02 field) | S | **YES** | Field rename (see F11 region) |
| F35 | "Loan → Loan Amount" label rename | v1-refine | P1/P2 | S | No | Label only (field stays `loan_amount`) |
| F36 | "Down → Estimated Down" label rename | v1-refine | P1/P2 | S | **YES** | Field rename |
| F37 | "People on File → File Contacts" section rename | v1-refine | P3 (VIEW-05 tab label) | S | No | Label only |
| F38 | Notes section kept | v1-refine | P2 | — | No | Confirmation |
| F39 | Task scroll; completed drop to bottom | v1-refine | P2 (TASK-01 UI) | M | No | Sort/filter behavior; nice-to-have |
| F40 | Emails sent from a task attach back as notes on the task | v1-gap | P5 (EMAIL-02) | M | No | Task ↔ email drafts link |
| F41 | Sub-tasks on tasks (not separate tasks) | v1-gap | P2 (TASK-01 schema) | M | No | Parent/child tasks — schema change |
| F42 | Completing some tasks auto-advances milestone | v1-refine | P2 (STAGE-02 + TASK) | M | No | `task.advances_stage_to` hook |
| F43 | Documents section "so far this looks good" | v1-refine | P5.5 | — | No | Confirmation |
| F44 | Email Threads label acceptable for now | v1-refine | P4/P5 | — | No | Confirmation |
| F45 | Tags on emails (scheduling, title, etc.) | v2-feature | later | M | No | Carrie says "don't have to build now" |
| F46 | Change history "looks good" | v1-refine | P2 (audit) | — | No | Confirmation |
| F47 | Pizza-tracker view for clients (email or app) | v2-feature | v2 mode | L | No | Core of "permanent two modes" direction |
| F48 | Intake form link; JotForm integration? | v2-feature | v2 intake | L | No | New intake path — possibly P4-era but scoped v2 |
| F49 | Client uploads PSA → AI parses → fills file fields | v2-feature | v2 intake | L | No | Extends INTAKE-04 / LLM parsing |
| F50 | Seller Email Chain + Buyer Email Chain per deal | v2-feature | P5 | L | No | Side-aware email threading |
| F51 | Global partner contacts with entity docs, notes, fees | v2-feature | v2 contacts | L | No | Bigger than P3 contacts registry |
| F52 | Fees-per-partner list (spreadsheet?) | v2-feature | v2 | M | No | Could be partner-card field |
| F53 | Store "company docs" for transactions | v1-gap | P5.5 | M | No | Company-level document library distinct from per-deal docs |
| F54 | Cannot download documents from prototype | bug | prototype | S | No | Prototype defect; real P5.5 must support download (already in plan) |
| F55 | Uploading a document clears related tasks (naming convention) | v2-feature | P5.5 + P2 | L | No | Document → task completion automation |
| F56 | Deal details snapshot section TBD | v1-refine | P2 | — | No | Deferred review |
| F57 | Closing calendar with date + time | v1-refine | P9 (VIEW-04) | S | No | Already in VIEW-04 |
| F58 | Filter list by closing date, task due, funding date | v1-gap | P1 (VIEW-02) | M | **YES** | Adds funding_date field on deals; filter spec change |
| F59 | Need `loan_type` field on deals + dashboard | v1-gap | P1 (DEAL-02) | S | **YES** | Schema + list column |
| F60 | Need `transaction_type` field on deals + dashboard | v1-gap | P1 (DEAL-02) | S | **YES** | Schema + list column |
| F61 | File numbers auto-generate with state abbreviation | v1-gap | P1 (DEAL-02/-03) | M | **YES** | Insert logic + numbering scheme |

---

## Open questions for Carrie

Items where her feedback is ambiguous and needs clarification before implementation:

1. **"Primary Contact Name" label** — Carrie is explicitly unsure ("Roger is our client…not the buyer"). Options to propose: "File Lead", "Main Contact", "Client", or keep "Primary Contact". Needed before P1 form + list column ship.
2. **Priority enum** — she sees no low-priority tags. Are there only HIGH / MEDIUM / LOW with LOW unused, or should we drop LOW? Does priority come from track default + override, or always manual?
3. **Stage count** — her 23-item list is a mix of milestones that span Title + Lending lifecycles. Do all 23 apply to every track, or are they track-scoped (e.g., "Title Order Opened" only applies to Title track files)? This drives whether `stages` table is flat (current v1 plan) or scoped by track.
4. **Seller Listing / Buyer Listing priority** — she wrote "Not sure on priority". If they're "future" only, do they ship in P1 as tracks with zero UI affordance, or get deferred to v2 tracks?
5. **General Inquiry track** — is this a real track or a catch-all bucket before triage? If bucket, it may need different lifecycle handling.
6. **File number format** — `TX-00001` vs `TX-2026-0001` vs `TX0001`? Per-state counter or global counter with state prefix?
7. **Funding date** — new field on deal distinct from `closing_at`? Or same-day-same-thing?
8. **"Quick note" column** — does she want (a) a manual free-text field on the deal, (b) a preview of the latest note on the deal, or (c) the most recent email? Different implementations.
9. **"Permanent two modes"** — confirm the v2 mode is client-facing (Pizza Tracker) while v1 stays the internal COO dashboard. Affects whether v2-feature items need separate auth model, separate route tree, etc.
10. **Milestone rename** — change DB column `stage_id` → `milestone_id`, or leave DB column name and only rename in UI? Former is cleaner long-term but a bigger migration.

---

## Recommended ROADMAP / REQUIREMENTS updates

Specific edits to `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` to absorb the v1-refine + v1-gap items. **Do not apply yet — user will review first.**

### REQUIREMENTS.md

- **DEAL-01**: replace track list with: Title & Escrow (`TE`), Funding & Lending (`FL`), Deal Planning & Structure (`DP`), Partnership Opportunity (`PO`), Education & Consulting (`EC`), Seller Listing (`SL` — future-flag), Buyer Listing (`BL` — future-flag), General Inquiry (`GI`).
- **DEAL-02**: rename fields — `file_no` becomes primary identifier (auto-generated), `purchase_price` → `sales_price`, `down_payment` → `estimated_down`. Add new fields: `loan_type`, `transaction_type`, `funding_date` (if confirmed distinct from `closing_at`), `quick_note` (if we pick option (a) above).
- **Add DEAL-02a (new)**: `file_no` auto-generates on insert with format `{STATE}-{NNNNN}` where STATE is `property_state` or, if missing, a user-selected state at creation.
- **STAGE-01**: replace 10-value list with Carrie's 23 values (confirm track-scoped or flat first). Mark `file_completed` as terminal alongside `killed`. Open question: is "Approval Decision Received" a distinct stage or renamed "Pre-Qual Approval"?
- **STAGE-04**: re-scope — most post-close stages now land in v1 core via STAGE-01 expansion. Calibration week still tunes order / naming.
- **VIEW-01**: rewrite list view columns to: Tracking (track badge), Priority, File #, Primary Contact, Address, Milestone, Next Task, Task Due By, Quick Note, Activity (last).
- **VIEW-02**: add filters — closing_date, funding_date, task_due_date.
- **PEOPLE-02**: role slot renames — `lender_partner` → `mortgage_partner`; add `lender_partner` (free-text, distinct) and `consultant_partner`. Add requirement that Title/TC/TL partners autosuggest from a curated "partners" subset of contacts (implies a `contacts.is_partner` flag or separate table — resolve in P3 planning).
- **TASK-01**: clarify that completion UX is a checkbox; tasks support optional `parent_task_id` (sub-tasks); tasks can optionally carry `advances_stage_to` to auto-advance milestone on completion; email drafts sent from a task attach back as notes on that task.
- **VIEW-05**: tab/section label changes — "Progress" section → "Tracking" and moves above the property address block on deal detail; "People on File" → "File Contacts".

### ROADMAP.md

- **Phase 1 goal**: update from "10 canonical stages" to "~23 stages" and note new fields (`loan_type`, `transaction_type`, `file_no` auto-gen, renames) in success criteria.
- **Phase 1 success criterion 1**: change row count — `stages` seeded with ~23 rows; `tracks` seeded with 8 rows (5 active + 3 future-flagged if we go that way).
- **Phase 1 success criterion 2**: new-deal form assigns an auto-generated `file_no` on create.
- **Phase 1 success criterion 3**: list view columns match the new spec and ordering.
- **Phase 10 (Calibration)**: scope narrows — the 23-stage list absorbs most post-close tuning. Calibration week focuses on ordering refinements, priority enum validation, and quick-note behavior.
- **New "v2 Mode" track (not a phase yet)**: capture items F45, F47–F52, F55 as a v2 epic under the existing `v2 Requirements` block in REQUIREMENTS.md, organized as: (a) Pizza Tracker client view, (b) Intake link + JotForm + AI PSA parse, (c) Side-aware email chains, (d) Partner cards / fee registry / company doc library, (e) Document-triggers-task-completion. These become the scope of the v2 prototype the user mentioned.

### Prototype-side bug list (separate from ROADMAP)

- F54 Document download broken — applies to prototype only; real build ships via P5.5. No action needed in ROADMAP.
- F31 "Deal Owners" field duplicates Internal Owner — prototype-only mislabel; confirm and drop in v2 prototype rebuild.
