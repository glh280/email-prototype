# Proposal — ROADMAP + REQUIREMENTS updates from Carrie's 2026-04-17 feedback

**Status:** ✅ APPLIED — Carrie answered all 10 open questions; edits committed to ROADMAP.md + REQUIREMENTS.md
**Source:** `.planning/feedback/2026-04-17-carrie-triage.md`
**Target files:** `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`
**Date drafted:** 2026-04-17
**Date applied:** 2026-04-17
**Author:** drafted by Claude from triage output

---

## Carrie's answers to the 10 open questions (received 2026-04-17)

| Q | Question | Answer |
|---|----------|--------|
| Q1 | "Primary Contact" label | **Main Contact** |
| Q2 | Priority enum values | **Keep LOW** (3-level: HIGH/MEDIUM/LOW) |
| Q3 | Stage scoping — flat or per-track | **Hybrid** (some track-specific; nullable `track_id` on `stages`) |
| Q4 | Future tracks — ship or defer | **Empty track options** (ship all 8 enum values; SL/BL/GI get universal stages only in P1) |
| Q5 | General Inquiry semantics | **Real track** (not just a triage bucket) |
| Q6 | File number format | **`TX-2026-0001` / `XX-2026-0001`** — state (or `XX` if null) + year + 4-digit per-year counter |
| Q7 | Funding date vs closing date | **Potentially distinct** — added `funding_at` nullable field on `deals` |
| Q8 | Quick Note column | **Free text** (manual `quick_note` field on deals) |
| Q9 | "Permanent two modes" meaning | **Correct: Pizza Tracker is a separate product, NOT a second mode of the internal dashboard** — v2 client-facing items moved to their own epic in REQUIREMENTS.md v2 block |
| Q10 | Stage → Milestone rename scope | **UI only** — DB column stays `stage_id`, table stays `stages`, REQ prefix stays `STAGE-*` |

**Architectural consequence of Q9:** The "v2 mode" framing from earlier in the session is retired. Internal dashboard (this repo, `portal.utstitle.com`) has one trajectory = v1 refined per her feedback → ship. Client-facing product (Pizza Tracker, intake link, AI PSA, side-aware emails, partner cards, doc-triggers-task) is a **separate product**, likely a separate subdomain with magic-link auth, scoped and planned in its own milestone after v1 ships.

---

## How to use this doc

1. Read the **Open questions** section first — these are the 10 items that need answers from Carrie before we can apply anything.
2. For each question, fill in her answer in the `☐ Carrie's answer:` blocks.
3. Walk through the **REQUIREMENTS.md proposed edits** section — revise any `[OPEN: Qn]` markers that are contentious.
4. Walk through the **ROADMAP.md proposed edits** section.
5. When every open question is answered and every proposed edit is approved, run `/gsd:quick apply spec updates from Carrie` to apply the diffs to `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` in a single atomic commit.
6. Then re-run `/gsd:plan-phase 1`.

---

## Open questions (need answers before applying)

Each question has `[OPEN: Qn]` markers throughout the proposed edits. When you answer the question here, update the markers below accordingly.

---

### Q1 — "Primary Contact" label

Carrie explicitly flagged this as ambiguous: *"Roger is our client…not the buyer, but we could get the buyer - so I'm not really sure what is the best label here."*

**Options:**
- A. Keep "Primary Contact"
- B. "File Lead"
- C. "Main Contact"
- D. "Client"
- E. "File Owner" (distinct from Internal Owner)
- F. Something else

**Affects:** `DEAL-02`, `PEOPLE-02`, `VIEW-01` column header, New Deal form label.

☐ **Carrie's answer:** _________________________

---

### Q2 — Priority enum values

Carrie: *"I'm not really seeing any of the tags as low priority."*

**Options:**
- A. Two-level: `HIGH`, `MEDIUM` (drop LOW entirely)
- B. Three-level with LOW unused but available: `HIGH`, `MEDIUM`, `LOW`
- C. Per-track default priority (from track metadata) + manual override per deal
- D. No priority field on deals at all — priority comes from the track badge alone

**Affects:** `DEAL-02` priority field, `VIEW-01` priority column, priority filters in `VIEW-02`.

☐ **Carrie's answer:** _________________________

---

### Q3 — Stage scoping: flat or per-track?

**This is the most impactful question.** Carrie listed 23 stages covering the full Title + Lending + closing lifecycle. Some only apply to certain tracks (e.g., "Title Order Opened" is meaningless for a Consulting deal).

**Options:**
- A. **Flat** — all 23 stages apply to every track. Carrie picks the right one per deal. Simplest schema; places the burden on the user.
- B. **Per-track** — each track has its own stage subset. Schema: `stages` has a `track_id` FK; composite unique on `(track_id, slug)`. `deals.stage_id` must match `deals.track_id`.
- C. **Hybrid** — some stages universal (Pre-Screen, Deal Structuring, File Completed), some track-specific. Schema: `stages.track_id` nullable, `NULL` means universal.

**Recommendation:** B (per-track) based on the stage list — "CD/SS - Balanced" / "UW Conditions - Cleared" etc. are plainly track-bound. But if Carrie wants one flat list for simplicity, we'll do A.

**Affects:** `STAGE-01` entire shape, `stages` table schema, migration strategy, `VIEW-01` dropdown behavior, future Kanban columns (P9).

☐ **Carrie's answer:** _________________________

---

### Q4 — Future-flagged tracks: ship in P1 or defer?

Carrie added three new tracks but noted "looking into the future 🙂" on Seller Listing and Buyer Listing, and "Not sure on priority" on General Inquiry.

**Options:**
- A. Ship all 8 tracks in P1 as enum values; leave future ones with no UI affordance (no stages seeded, new-deal form hides them)
- B. Ship 5 active + 3 future-flagged with a `tracks.active` boolean that hides inactive ones from the new-deal form
- C. Ship only the 5 active tracks; add the 3 future ones in a later phase

**Affects:** `DEAL-01` enum, `tracks` seed data, new-deal form.

☐ **Carrie's answer:** _________________________

---

### Q5 — "General Inquiry" semantics

Is General Inquiry a real track or a triage bucket?

**Options:**
- A. Real track — has its own stage list, progresses through stages like other tracks
- B. Triage-only bucket — deals start here, then get re-tracked to a real track within N days. After re-tracking, it never returns to `GI`.
- C. Both — it's a real track but Carrie uses it primarily for triage

**Affects:** `STAGE-01` (does GI get stages?), workflow rules.

☐ **Carrie's answer:** _________________________

---

### Q6 — File number format

Carrie: *"Need file numbers to auto-generate as a new file/inquiry is added to the dashboard - It needs to start with the state abbreviation."*

**Options:**
- A. `TX-00001` — state + zero-padded global counter
- B. `TX-2026-0001` — state + year + per-year counter
- C. `TX-0001` — state + per-state counter
- D. `TX-00001-TE` — state + counter + track code suffix

**Additional question:** What if the deal has no property_state (e.g., Consulting or Partnership deals with no real estate)?
- A. User picks a state at creation
- B. Default to company state (TX?)
- C. Allow file numbers with no state prefix for those deals (e.g., `CON-00001`)

**Affects:** `DEAL-02a` (new requirement for auto-gen), deal insert logic, migration from existing prototype data.

☐ **Carrie's format answer:** _________________________
☐ **Carrie's "no state" answer:** _________________________

---

### Q7 — Funding date vs closing date

Carrie: *"filter by closing date as well as task due date and funding date"* — implies funding_date is distinct from closing_at.

**Options:**
- A. Two distinct fields on `deals`: `closing_at` (scheduled closing), `funding_at` (wire / funding date)
- B. Same date, two labels — rename `closing_at` to `funding_at` or add only one new field

**Affects:** `DEAL-02` schema, `VIEW-02` filters.

☐ **Carrie's answer:** _________________________

---

### Q8 — Quick Note column

Carrie: *"Is there a way for us to put in a Quick note section here, or like have it pull the last comment or note we put on the file?"*

**Options:**
- A. Free-text `quick_note` field on `deals` — Carrie types a one-liner, it shows on the list
- B. Computed: pull the most recent `notes.body` from the deal
- C. Computed: pull the most recent inbound email subject
- D. Hybrid: `quick_note` field that defaults to last note preview but can be overridden

**Affects:** `DEAL-02` (new field or computed), `VIEW-01` column implementation.

☐ **Carrie's answer:** _________________________

---

### Q9 — "Permanent two modes" — confirm v2 scope

User earlier selected "Permanent — v1 and v2 are genuinely two different modes the app supports." Carrie's feedback clusters suggest:
- **Mode A (v1)** — internal COO dashboard (what we're building)
- **Mode B (v2)** — client-facing status view ("Pizza Tracker"), intake link landing page, client portal

**Questions:**
- Same user pool, different auth levels (internal via CF Access, clients via magic-link)? Or different user pools?
- Same database, different UIs? Or separate databases?
- Is Mode B the full URL space of a separate subdomain (e.g., `clients.utstitle.com`)?

☐ **Carrie's intent for Mode B:** _________________________
☐ **Auth model:** _________________________
☐ **Subdomain:** _________________________

---

### Q10 — Milestone rename: column or label?

Carrie: *"Stage - change the name to milestone."*

**Options:**
- A. **Label only** — keep DB column `stage_id`, stages table name, etc. UI copy reads "Milestone." Zero migration impact.
- B. **Full rename** — rename `stages` table → `milestones`, `stage_id` → `milestone_id`, `STAGE-01..04` → `MILESTONE-01..04`. Clean long-term but bigger migration and rewrites.

**Recommendation:** A for P1 (label only) with B deferred to calibration week (P10) if Carrie wants terminology consistency in code. Her word choice is the user-facing word; the DB doesn't need to change to make the UI correct.

☐ **Carrie's preference (or your call):** _________________________

---

## REQUIREMENTS.md proposed edits

Every edit is shown as BEFORE / AFTER. `[OPEN: Qn]` markers reference the open questions above — fill those in before applying.

---

### DEAL-01 — track enum

**BEFORE:**
```markdown
- [ ] **DEAL-01**: System supports 5 tracks: Title (TI), Lending (LN), Deal Desk (DD), Consulting (CS), Partnership (PT)
```

**AFTER:**
```markdown
- [ ] **DEAL-01**: System supports 8 tracks with default priority:
  - Title & Escrow (`TE`) — HIGH
  - Funding & Lending (`FL`) — HIGH
  - Deal Planning & Structure (`DP`) — MEDIUM
  - Partnership Opportunity (`PO`) — MEDIUM
  - Education & Consulting (`EC`) — MEDIUM
  - Seller Listing (`SL`) — [OPEN: Q2, Q4]
  - Buyer Listing (`BL`) — [OPEN: Q2, Q4]
  - General Inquiry (`GI`) — [OPEN: Q2, Q4, Q5]
```

Rationale: F1–F8 in triage. Reflects Carrie's complete track list with her priority labels.

---

### DEAL-02 — deal schema

**BEFORE:**
```markdown
- [ ] **DEAL-02**: A deal has: track, title, stage, priority, opened_at, closing_at, closed_at, status, service_selected, file_no, title_file_no, loan_no, property_address, property_state, property_type, purchase_price, loan_amount, down_payment, earnest_money, est_rehab, arv, title_ctc, lender_ctc
```

**AFTER:**
```markdown
- [ ] **DEAL-02**: A deal has: track, title, milestone (FK to stages; UI label "Milestone"), priority ([OPEN: Q2]), opened_at, closing_at, funding_at [OPEN: Q7], closed_at, status, service_selected, file_no (auto-generated — see DEAL-02a), title_file_no, loan_no, loan_type, transaction_type, property_address, property_state, property_type, sales_price (renamed from purchase_price), loan_amount, estimated_down (renamed from down_payment), earnest_money, est_rehab, arv, title_ctc, lender_ctc, quick_note [OPEN: Q8]
```

Rationale: F11 (file_no as primary id), F34 (sales_price rename), F36 (estimated_down rename), F59 (loan_type), F60 (transaction_type), F58 (funding_at), F18 (quick_note). "Milestone" label per Q10.

---

### DEAL-02a — file_no auto-generation (NEW REQUIREMENT)

**ADD:**
```markdown
- [ ] **DEAL-02a**: `file_no` auto-generates on deal insert in format `[OPEN: Q6]`. If `property_state` is null [OPEN: Q6], fall back to [OPEN: Q6]. The generated `file_no` is immutable after insert.
```

Rationale: F61. New requirement — file number generation is a first-class piece of deal-creation logic.

---

### STAGE-01 — stage enum

**BEFORE:**
```markdown
- [ ] **STAGE-01**: Stages mirror ClickUp `FILE STATUS`: pre_screen, deal_structuring, deal_team_assigned, lender_packaging, lender_shopping, term_sheet_pending, pre_qual_approval, term_sheet_execution, closed (terminal), killed (terminal)
```

**AFTER (pending Q3 — flat vs per-track):**

*If Q3 = Flat (Option A):*
```markdown
- [ ] **STAGE-01**: Stages (23 values + 1 terminal) — flat list, apply to all tracks:
  - pre_screen_qualification
  - deal_structuring
  - deal_team_assigned
  - preparing_lender_review_pkg
  - deal_pkg_submitted_to_lender
  - term_sheets_received
  - approval_decision_received   [OPEN: name — Q3 follow-up, Carrie said "not sure on what this needs to be called"]
  - term_sheet_loi_received
  - uw_conditions_issued
  - uw_conditions_cleared
  - title_order_opened
  - title_not_clear_to_close
  - title_clear_to_close
  - cd_ss_not_balanced
  - cd_ss_balanced
  - lender_docs_received
  - closing_scheduled
  - signing_completed
  - funding_conditions_cleared
  - funding_approval_received
  - disbursed
  - recorded
  - policy_issued
  - file_completed (terminal)
  - killed (terminal)
```

*If Q3 = Per-track (Option B):*
```markdown
- [ ] **STAGE-01**: Stages are track-scoped. `stages` table has `track_id` FK. Each track has its own stage list:

  **Common (all tracks):** pre_screen_qualification, deal_structuring, file_completed (terminal), killed (terminal)

  **Title & Escrow (TE):** title_order_opened → title_not_clear_to_close → title_clear_to_close → cd_ss_not_balanced → cd_ss_balanced → closing_scheduled → signing_completed → disbursed → recorded → policy_issued → file_completed

  **Funding & Lending (FL):** deal_team_assigned → preparing_lender_review_pkg → deal_pkg_submitted_to_lender → term_sheets_received → approval_decision_received → term_sheet_loi_received → uw_conditions_issued → uw_conditions_cleared → lender_docs_received → funding_conditions_cleared → funding_approval_received → file_completed

  **Deal Planning & Structure (DP):** deal_structuring → file_completed
  **Partnership Opportunity (PO):** [TBD with Carrie — simple short list]
  **Education & Consulting (EC):** [TBD with Carrie — simple short list]
  **Seller Listing / Buyer Listing / General Inquiry:** per Q4, Q5
```

*If Q3 = Hybrid (Option C):* similar to B but with `track_id` nullable for the universal stages.

Rationale: F15 + Q3 decision. This is the single biggest spec change.

---

### STAGE-04 — re-scope

**BEFORE:**
```markdown
- [ ] **STAGE-04**: Title-specific post-close stages (cd_prep, scheduled, post_closing) can be added by Carrie during calibration week
```

**AFTER:**
```markdown
- [ ] **STAGE-04**: During calibration week, Carrie tunes stage ordering, stage names, and track-to-stage mapping based on real-deal use. Most post-close stages now ship in v1 core via STAGE-01 (cd_ss_balanced, signing_completed, disbursed, recorded, policy_issued, file_completed). STAGE-04 narrows to tuning, not adding.
```

Rationale: Carrie's 23-stage list already includes post-close Title stages, so STAGE-04 narrows to tuning. From triage "Recommended ROADMAP updates."

---

### VIEW-01 — list view columns

**BEFORE:**
```markdown
- [ ] **VIEW-01**: `/` shows list of active deals with columns: track, file, stage, next task, last activity
```

**AFTER:**
```markdown
- [ ] **VIEW-01**: `/` shows list of active deals with columns in this order (left → right):
  1. Tracking — track badge with priority color
  2. Priority — [OPEN: Q2]
  3. File # — `deal.file_no`
  4. [OPEN: Q1 label] — primary contact name
  5. Address — `deal.property_address` (truncated; may be empty for non-property deals)
  6. Milestone — `deal.stage.label` (UI label; DB column stays `stage_id` per Q10)
  7. Progress / Next Task — next open task, bound by `TASK-05`
  8. Task Due By — due date of the next task (renamed from "Task Owner Due")
  9. Quick Note — [OPEN: Q8]
  10. Activity — last mutation time (column position must be LAST)
```

Rationale: F9, F10, F11, F12, F13, F14, F16, F17, F18, F19.

---

### VIEW-02 — list view filters

**BEFORE:**
```markdown
- [ ] **VIEW-02**: List view has filters: track, stage, "needs me" toggle (deals where next-task owner is the signed-in user), overdue
```

**AFTER:**
```markdown
- [ ] **VIEW-02**: List view has filters:
  - Track
  - Milestone (stage)
  - Priority
  - "Needs me" toggle (deals where next-task owner is the signed-in user)
  - Overdue
  - Closing date — date-range filter on `closing_at`
  - Funding date — date-range filter on `funding_at` [OPEN: Q7]
  - Task due date — date-range filter on next task's due date
```

Rationale: F58 + F15's new priority/stage filters.

---

### PEOPLE-02 — role slots

**BEFORE:**
```markdown
- [ ] **PEOPLE-02**: A deal has `deal_people` link rows mapping contacts to per-track role slots (directing_agent, title_partner, borrower, seller, lender_partner, mortgage_broker, tc_partner, tl_partner, listing_agent, internal_owner)
```

**AFTER:**
```markdown
- [ ] **PEOPLE-02**: A deal has `deal_people` link rows mapping contacts to per-track role slots:
  - directing_agent
  - title_partner (autosuggest from partner contacts)
  - borrower (often equals primary contact — see VIEW-05 binding)
  - seller
  - mortgage_partner (renamed from lender_partner)
  - lender_partner (NEW — free-text, distinct from mortgage_partner)
  - tc_partner (autosuggest from partner contacts)
  - tl_partner (autosuggest from partner contacts)
  - consultant_partner (NEW)
  - listing_agent
  - internal_owner
```

Rationale: F22 (lender → mortgage), F23 (new free-text lender_partner distinct), F24–F26 (autosuggest from partners), F27 (new consultant_partner).

---

### TASK-01 — task schema extended

**BEFORE:**
```markdown
- [ ] **TASK-01**: A deal has a task list (title, owner, due date, status: open/done/skipped, is_next bool)
```

**AFTER:**
```markdown
- [ ] **TASK-01**: A deal has a task list: title, owner, due_date, status (open/done/skipped), is_next bool, parent_task_id (nullable, for sub-tasks), advances_stage_to (nullable stage_id — completing auto-advances the deal's milestone). Task completion UX is a checkbox. Completed tasks sort to the bottom of the list (open tasks stay grouped at top). Email drafts sent from a task attach back as notes on the task.
```

Rationale: F29 (checkbox), F39 (sort completed to bottom), F40 (email → task note), F41 (sub-tasks), F42 (auto-advance milestone).

---

### VIEW-05 — deal detail section labels

**BEFORE:**
```markdown
- [ ] **VIEW-05**: `/deal/[id]` has tabs: Overview, People, Tasks, Emails, Notes, Audit
```

**AFTER:**
```markdown
- [ ] **VIEW-05**: `/deal/[id]` has tabs: Overview, File Contacts (renamed from People), Tasks, Emails, Notes, Audit. On Overview, the "Tracking" section (renamed from "Progress") sits above the property address block.
```

Rationale: F32 (Tracking moves above address), F33 (Progress → Tracking), F37 (People on File → File Contacts).

---

## ROADMAP.md proposed edits

---

### Phase 1 success criteria

**BEFORE:**
```markdown
**Success criteria:**
1. Drizzle migration creates `deals`, `stages`, `tracks` tables; `stages` seeded with 10 rows
2. "New Deal" form at `/deal/new` creates a deal with required fields; redirects to list view
3. List view at `/` displays all active deals with track, file, stage, last activity
4. "Needs me" filter returns only deals where next-task owner matches current user
```

**AFTER:**
```markdown
**Success criteria:**
1. Drizzle migration creates `deals`, `stages`, `tracks` tables:
   - `tracks` seeded with 8 rows (or 5 active + 3 deferred per Q4)
   - `stages` seeded with ~23 rows [OPEN: Q3 — flat or track-scoped]
2. "New Deal" form at `/deal/new` creates a deal with required fields including auto-generated `file_no` ([OPEN: Q6] format); redirects to list view
3. List view at `/` displays all active deals in the VIEW-01 column order: Tracking, Priority, File #, [OPEN: Q1], Address, Milestone, Next Task, Task Due By, Quick Note, Activity
4. "Needs me" filter returns only deals where next-task owner matches current user; closing/funding/task-due date filters also present
```

Rationale: Success criteria 1, 2, 3, 4 all now match Carrie's spec.

---

### Phase 1 requirements line

**BEFORE:**
```markdown
**Requirements:** DEAL-01, DEAL-02, DEAL-03, STAGE-01, VIEW-01, VIEW-02
```

**AFTER:**
```markdown
**Requirements:** DEAL-01, DEAL-02, DEAL-02a, DEAL-03, STAGE-01, VIEW-01, VIEW-02
```

Rationale: Adds new DEAL-02a for file_no auto-generation.

---

### Phase 10 (Calibration) narrowing

**BEFORE:**
```markdown
**Goal:** Carrie uses the dashboard daily for one week. Tune stages, role slots, templates from real use. Add Title post-close stages. Point the custom domain.
```

**AFTER:**
```markdown
**Goal:** Carrie uses the dashboard daily for one week. Tune stage ordering, role-slot coverage, priority enum accuracy, and template copy from real-deal use. (Post-close Title stages now ship in v1 core via STAGE-01; this phase tunes them, not adds them.) Point the custom domain.
```

Rationale: STAGE-04 re-scope; Carrie's 23 stages already cover post-close.

---

### Overview table — Phase 1 requirement count

**BEFORE:**
```markdown
| 1 | Core data model | Deals + stages + list view | 7 | 4 |
```

**AFTER:**
```markdown
| 1 | Core data model | Deals + stages + list view | 8 | 4 |
```

Rationale: +1 for DEAL-02a.

---

### New v2 Mode epic — add to REQUIREMENTS.md `v2 Requirements (deferred)` block

**ADD to v2 Requirements section:**
```markdown
### Client-facing mode (v2 Mode B)

- **V2-PZ-01**: Pizza Tracker view — clients see a read-only status page for their file, with milestone stepper and next-step copy. Accessed via magic link (no login).
- **V2-PZ-02**: Automated status emails — on every milestone advance, an email with a Pizza Tracker snapshot is sent to the file's primary contact.
- **V2-IN-01**: Public intake link per user/brand — generates a form (optionally JotForm-backed) that creates a deal when submitted.
- **V2-IN-02**: AI PSA parser — client uploads a PSA via intake link; Haiku extracts fields (parties, sales price, closing date, property) and pre-fills deal on creation.
- **V2-EM-01**: Side-aware email chains — each deal has a Seller Email Chain and a Buyer Email Chain; drafts auto-include the correct side's team based on contact `side` field.
- **V2-PC-01**: Partner cards (global contacts registry expansion) — each partner contact has entity docs, notes, and a `fees` JSON block.
- **V2-DOC-01**: Company documents library — separate from per-deal documents; global R2 bucket with role-based access.
- **V2-DOC-02**: Document-triggers-task-completion — uploading a document matching a task's naming convention auto-completes that task.
```

Rationale: F45, F47–F55. Captures the client-facing v2 mode scope.

---

## Change summary

| Category | Count |
|----------|-------|
| REQUIREMENTS.md — edits to existing REQs | 9 (DEAL-01, DEAL-02, STAGE-01, STAGE-04, VIEW-01, VIEW-02, PEOPLE-02, TASK-01, VIEW-05) |
| REQUIREMENTS.md — new REQs | 1 (DEAL-02a) |
| REQUIREMENTS.md — new v2 requirements | 8 (V2-PZ-01..02, V2-IN-01..02, V2-EM-01, V2-PC-01, V2-DOC-01..02) |
| ROADMAP.md — edits | 5 (Phase 1 success criteria, Phase 1 requirements, Phase 10 goal, Overview table Phase 1 count, STAGE-04 note in Phase 10) |
| Open questions blocking application | 10 |

---

## What this proposal does NOT touch

- Prototype code (prototype is separate repo; the v2-carrie branch on prototype is its own stream)
- `.planning/phases/01-core-data-model/` (doesn't exist yet; will be created when `/gsd:plan-phase 1` runs with the updated spec)
- `.planning/phases/00.5-access-encryption/` (P0.5 is done and committed)
- `AUDIT.md` (architecture spec — unchanged by Carrie's feedback)
- `lib/*.ts`, `app/*.tsx`, schema files (no code edits — spec-only proposal)

---

## Next steps after Carrie answers

1. Walk through Q1–Q10 with Carrie (can be async message, short call, or shared Google Doc)
2. Fill in the `☐ Carrie's answer:` blocks above
3. Update `[OPEN: Qn]` markers throughout the proposed edits with the concrete choice
4. Run `/gsd:quick apply spec updates from Carrie` — I'll apply every diff above in a single atomic commit
5. Re-run `/gsd:plan-phase 1` against the updated spec

Once applied, this proposal file can be archived (move to `.planning/proposals/applied/`) or deleted.
