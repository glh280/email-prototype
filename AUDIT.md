# Prototype → Production Audit

Every interactive surface in the prototype, what it does today, what it must do in production, and the module/script needed to bridge the gap. Use this as the build backlog.

**Convention:**
- 🎨 **UI-only** — visual, no backend ever needed
- 🧪 **Simulated** — UI fully works client-side, resets on refresh; needs persistence + integration
- ⚠️ **Partially real** — uses a real external URL or browser primitive but data isn't wired
- 🌐 **External** — already hits a real service (Gmail deeplinks, tel: links, etc.), no backend work needed

---

## Table of contents

0. [Scope](#scope)
1. [Infrastructure the whole app needs before anything else](#1-infrastructure-baseline)
2. [Dashboard page](#2-dashboard-page)
3. [Deal detail page](#3-deal-detail-page)
4. [Shared components](#4-shared-components)
5. [Backend modules to build (summary)](#5-backend-modules-to-build)
6. [Third-party integrations (summary)](#6-third-party-integrations)
7. [Build order recommendation](#7-build-order-recommendation)
8. [Compliance layer (GLBA scope)](#8-compliance-layer-glba-scope)

---

## Scope

**Internal-only portal.** This application is not client-facing.

- **Users:** Mike, Carrie, Steff, and a bounded set of named deal desk partners (Nick, Jais, Jamey, Corey, Peter, Nehemiah, Tinos, Keleisha, Edward, Jeremiah).
- **Seat cap:** ≤50 users total, deliberately chosen to stay on the Cloudflare Zero Trust Free tier.
- **No client-facing login surfaces.** Borrowers, sellers, and other external counterparties never receive accounts on this portal.
- **Client document intake (if ever needed)** will be handled via separate magic-link upload pages with time-limited pre-signed R2 URLs — out of scope for this portal, tracked as a future consideration only.

---

## 1. Infrastructure baseline

These aren't features — they're the foundation every feature below depends on.

| Module | What it does | Notes |
|---|---|---|
| **Postgres schema + Drizzle migrations** | Replaces `mock/deals.ts` as source of truth | Tables: `users`, `contacts`, `deals`, `deal_people`, `tasks`, `notes`, `email_threads`, `email_messages`, `linked_clickup`, `linked_ghl`, `documents`, `change_history`, `stages`, `npi_access_log` |
| **Cloudflare Access** (auth at the edge) | Replaces Auth.js entirely. MFA, Google IdP, JWT validated per-request in `lib/access.ts`. Origin isolated via Cloudflare Tunnel. | Env vars `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`. Allowlist managed in CF dashboard, not code. |
| **Cloudflare Tunnel sidecar** | Origin isolation — app origin accepts ZERO public traffic except via Cloudflare | Deployed as a separate Railway service (`cloudflared`). Any direct origin access returns 403 |
| **Column-level encryption for NPI** (`lib/crypto.ts`) | Encrypts NPI columns with `@47ng/cloak` before they hit Postgres. Protects NPI even if DB creds leak or backup is mishandled. | Master key in Railway env var (`ENCRYPTION_KEY`), 32-byte base64-encoded. Key rotation supported via dual-key read window. 1Password backup of current key for disaster recovery. |
| **NPI read audit** (`npi_access_log` + wrapped `decrypt()`) | Every call to `decrypt()` inserts a row recording who read which NPI field. Non-skippable. | Implemented inside `lib/crypto.ts::decrypt()` — impossible to decrypt without logging |
| **API layer (Next.js server actions)** | Every simulated mutation needs a typed endpoint. All server actions call `getCurrentUser()` from `lib/access.ts` first to verify the Access JWT. | Co-locate with components |
| **Shared audit-log writer** (`lib/audit.ts`) | Every mutation → `change_history` row before/after JSON | One function, called from every write path |
| **Shared API error wrapper** | Every external call (Gmail/ClickUp/GHL/Anthropic) needs timeout + error boundary | Fail-soft UX: toast + inline retry, never crash the view |
| **Env validation** (`lib/env.ts`, Zod-based) | App refuses to start on missing/invalid env | One-time setup, catches 90% of deploy bugs |

**Three audit layers, explicit:**

1. **App mutation audit** — every write via `recordChange()` → `change_history`
2. **NPI read audit** — every `decrypt()` → `npi_access_log` (NEW, required by GLBA)
3. **Cloudflare Access dashboard logs** — retained per Cloudflare's Free tier window (~6 hours of detail, longer for summaries). **Supplementary only** — the app-level `change_history` and `npi_access_log` are the authoritative GLBA audit trail. *V2 backlog: daily cron polling the Cloudflare Access API to archive logs to R2 for long-term retention — not in MVP.*

---

## 2. Dashboard page (`/`)

### 2.1 Header (top bar)

| Element | Today | Needs | Module |
|---|---|---|---|
| Logo + "NPR Dashboard" link | 🎨 Works (nav only) | — | — |
| User avatar (initials "CD") + menu | 🧪 Menu shows "Signed in (simulated)" | User identity read from Cloudflare Access via `getCurrentUser()` in `lib/access.ts`. Sign-out links to Cloudflare-hosted logout URL (`https://<team>.cloudflareaccess.com/cdn-cgi/access/logout`). | `lib/access.ts::getCurrentUser()`; `app-header.tsx` renders `user.email`/`user.name` from Access claims |
| 📅 **Calendar** button | 🧪 Opens a popup with in-memory due dates | Live calendar backed by `tasks.due_at` + `deals.closing_at`; changes persist and log to history | `lib/tasks.ts` (updateTaskDueDate); calendar reads from DB not `DEALS` |
| 📝 **Notes** button | 🧪 Opens popup with all deal notes + standalones; all edits in-memory | `notes` table with CRUD; @mentions trigger notifications | `lib/notes.ts`, `lib/notifications.ts` (email/Slack/in-app for mentions) |
| ↻ **Refresh** button | 🧪 Toast only | Re-query deals + linked emails from server | Server action `getActiveDeals()`; add `router.refresh()` after mutations |
| **+ New Deal** button | 🧪 Disabled | New-deal form at `/deal/new` with the three intake paths (form / Gmail thread / paste) | `app/deal/new/page.tsx`, `lib/deals.ts` create, `lib/gmail.ts` thread fetch, optional `lib/anthropic.ts` Haiku extraction for paste |

### 2.2 Filter bar

| Element | Today | Needs | Module |
|---|---|---|---|
| Track chips (All/Title/Lending/Deal Desk/Consulting/Partnership) | 🎨 Client-side filter | Keep client-side — but filter must work against server-paginated results for large deal sets | When deal count > ~200, move filter to a URL param and re-query |
| 👤 **Filter by person** popup | 🎨 Client-side | Options populated from real `users` table (internal team members) | Read `users.role = 'internal'` |
| Search box | 🎨 Client-side text match | Server-side full-text search when results > 200 | Postgres `tsvector` on deals.title + property_address + contact names; GIN index |

### 2.3 Deal row (collapsed)

| Element | Today | Needs | Module |
|---|---|---|---|
| ▾ Expand/collapse | 🎨 UI-only | — | — |
| Track label chip | 🎨 | — | — |
| Priority label chip | 🎨 | — | — |
| Property address / owners text | 🎨 Reads from mock | Reads from `deals` + `deal_people` join | Same server action as list |
| **Inline StageDropdown** | 🧪 In-memory stage change + toast | Writes `deals.stage_key`, appends `change_history` row, refreshes | Server action `updateDealStage(dealId, stageKey)` |
| MiniStageBar | 🎨 Derived from stage | — | — |
| Next task column | 🎨 Reads `tasks[].isNext` | — | — |
| Last activity | 🎨 `relativeTime(deal.lastActivityAt)` | `deals.last_activity_at` maintained by every write | Updated inside `recordChange()` helper |

### 2.4 Deal row (expanded)

| Element | Today | Needs | Module |
|---|---|---|---|
| People list with hover cards | 🧪 Hover works; opens the same ContactHoverCard as detail | Real contacts from `contacts` + `deal_people` | Same as detail page (see 3.5) |
| Tasks summary | 🧪 Read-only | Keep read-only from list view; edits live on detail page | — |
| Deal owners PeoplePicker | 🧪 In-memory | Writes `deals.internal_owners` (array column or link table); audit | Server action `updateDealOwners(dealId, owners[])` |
| "Open file →" link | 🎨 Route navigation | — | — |

---

## 3. Deal detail page (`/deal/[id]`)

### 3.1 Top bar

| Element | Today | Needs | Module |
|---|---|---|---|
| ← All deals link | 🎨 | — | — |
| ✎ **Edit file** toggle | 🧪 Toggles local `globalEdit` state | Same toggle, just tracks edit-mode UI state; individual saves hit server actions | — |
| 🗂 **Deal details** button | 🧪 Read-only popup | Writable — track-specific fields save to deal row | Server action `updateDealFields(dealId, partial)`; reuse existing popup UI with inputs |
| ↻ Refresh | 🧪 Toast | `router.refresh()` | — |

### 3.2 Deal header card

| Element | Today | Needs | Module |
|---|---|---|---|
| **TrackDropdown** (click "Lending" to change) | 🧪 In-memory | Writes `deals.track`; audit | Server action `updateDealTrack` |
| **PriorityDropdown** | 🧪 In-memory | Writes `deals.priority`; audit | Server action `updateDealPriority` |
| Title / Lender CTC badges | 🧪 Read booleans | Read from `deals.title_ctc` / `deals.lender_ctc` | DB columns |
| Property address (editable when `globalEdit`) | 🧪 | Writes `deals.property_address`; audit | Part of `updateDealFields` |
| Deal title (secondary, editable when `globalEdit`) | 🧪 | Writes `deals.title`; audit | Same |
| Last activity + Closing datestamps | 🎨 | `deals.last_activity_at`, `deals.closing_at` | DB columns |
| Owners PeoplePicker | 🧪 | Same as dashboard (2.4) | `updateDealOwners` |

### 3.3 Progress card

| Element | Today | Needs | Module |
|---|---|---|---|
| StageStepper (visual) | 🎨 Derived | — | — |
| StageDropdown (top-right of card) | 🧪 | Same as dashboard stage dropdown (2.3) | `updateDealStage` |

### 3.4 Key figures (Purchase / Loan / Down)

| Element | Today | Needs | Module |
|---|---|---|---|
| EditableCurrency (click-to-edit) | 🧪 | Writes `deals.purchase_price` / `loan_amount` / `down_payment`; audit | Server action `updateDealMoney(dealId, field, value)` |

### 3.5 People on file

| Element | Today | Needs | Module |
|---|---|---|---|
| Each person (ContactHoverCard trigger) | 🧪 Opens popup | — | — |
| **Quick view** in popup | 🧪 Read-only | Reads `contacts` row via `deal_people` join | `lib/contacts.ts` getContact |
| **Person view** (after click) | 🧪 Editable form, in-memory save | Writes `contacts` row; audit | Server action `updateContact(id, partial)` |
| Secondary contact fields | 🧪 | Writes to `contacts.secondary_*` columns | Same |
| Licensed states | 🧪 | `contacts.licensed_states text[]` | Same |
| **✉ Draft email** inside popup | 🧪 Opens DraftEmailDialog | Preselect recipient → compose → send via Gmail (see 3.6) | Same as task draft-email (3.7) |

**Missing v1:** Add a person, remove a person, change role slot. Currently the popup only edits the contact — not the `deal_people` row. Needs UI + server actions `addPersonToDeal`, `removePersonFromDeal`, `updatePersonRole`.

**GLBA / NPI note:** If NPI-class fields are ever added to `contacts` (SSN, DOB, driver-license, income, credit score), they MUST be encrypted via `lib/crypto.ts` column-level encryption. Every read triggers an `npi_access_log` insert via the wrapped `decrypt()`. For searchable NPI (e.g., SSN lookup), add a plaintext blind-index column (`ssn_last4`) — never search on the encrypted column. None of these columns exist today — this is a forward constraint, not current scope.

### 3.6 Notes section (per-deal)

| Element | Today | Needs | Module |
|---|---|---|---|
| New-note textarea + Urgent checkbox + Add button | 🧪 Prepends to array in state | Writes `notes` row with `deal_id`; audit | Server action `createNote(dealId, body, urgent)` |
| Urgent tag toggle | 🧪 | Writes `notes.urgent`; audit | `updateNoteUrgent` |
| Click body to edit | 🧪 | Writes `notes.body`, `notes.updated_at`, `notes.author_name`; audit | `updateNoteBody` |
| Delete button | 🧪 `confirm()` then removes | Soft-delete preferred (set `notes.deleted_at`); audit | `deleteNote` |
| @mentions (HighlightMentions) | 🎨 Regex highlight | Parse mentions, write to `note_mentions` join table, enqueue notifications (in-app toast + email + future Slack) | `lib/mentions.ts` + `lib/notifications.ts` |
| Author / "edited" timestamp | 🎨 Reads `updatedAt` vs `createdAt` | Same, from DB | — |

### 3.7 Tasks

| Element | Today | Needs | Module |
|---|---|---|---|
| Check circle (click to complete/re-open) | 🧪 | Writes `tasks.status`; maintain one-`is_next` invariant across open tasks; audit | Server action `toggleTaskComplete(taskId)`; trigger/invariant enforced server-side |
| Task title + "next up" badge | 🎨 | — | — |
| PeoplePicker (assign owners) | 🧪 | Writes `tasks.owners text[]` (or `task_owners` link table); audit | `updateTaskOwners(taskId, owners[])` |
| Due date text | 🎨 | `tasks.due_at` | — |
| **✉ Draft email** button | 🧪 | Renders template → user edits → send via Gmail API; write `email_drafts` row | See draft-email pipeline below |
| Complete / Re-open button | 🧪 | Same as checkmark | — |

**Draft email pipeline** (shared with sections 3.5, 3.7):
| Step | Today | Needs | Module |
|---|---|---|---|
| Choose recipient | 🎨 Dropdown from `deal.people` | — | — |
| Pre-fill subject + body | 🎨 | Templates stored in DB, merge fields filled from deal + contact + task | `lib/email-templates.ts`, `email_templates` table |
| **✨ Polish in Mike's voice** | 🧪 Appends static text with delay | Call Anthropic Sonnet with deal context + body; show per-call cost; log tokens to `email_drafts.tokens_used` | `lib/anthropic.ts`; $25/mo hard cap in Anthropic Console |
| **Send via Gmail** | 🧪 Toast | Gmail API `users.messages.send` with signed-in user's OAuth token; write `email_drafts` row with `sent_at`, update thread | `lib/gmail.ts` |
| Subject/body editing | 🎨 Local state | Persist drafts before send (`email_drafts.sent_at = null`) so refresh doesn't lose work | `createDraft`, `updateDraft` server actions |

**Missing v1:** Add a task, edit a task title, delete a task, change due date. Currently the UI shows existing tasks but can't create new ones. Needs a "+ Add task" button and `createTask` / `updateTask` / `deleteTask` server actions.

### 3.8 Documents

**Storage target (LOCKED): Cloudflare R2.** No egress fees, S3-compatible, SSE-R2 managed keys by default, pre-signed URLs with expiration, same vendor as Access → one DPA, one bill, one vendor management entry. Google Drive was considered and rejected.

**Bucket configuration (P5.5):**
- Buckets: `npr-dashboard-docs-prod`, `npr-dashboard-docs-staging`
- Access: **private**, no public anonymous access
- Encryption: SSE-R2 managed keys (default)
- CORS: restricted to the Access-protected app domain (`portal.utstitle.com`)
- Lifecycle rules: TBD when GLBA document retention policy is formalized — not blocking v1

**URL patterns:**
- **Upload:** pre-signed PUT, 5-minute expiration, from `lib/storage.ts::getUploadUrl(dealId, filename)`
- **Download:** pre-signed GET, 15-minute expiration, from `lib/storage.ts::getDownloadUrl(docId)`
- **Object keys are never returned to the browser.** All access is mediated by server actions.

**`documents` table additions (P5.5):** `r2_bucket` (text), `r2_key` (text, UUID), `original_filename` (text, for display), `content_type` (text, MIME), `size_bytes` (int), `uploaded_by_email` (text, denormalized for audit), `deleted_at` (timestamp, soft delete).

| Element | Today | Needs | Module |
|---|---|---|---|
| **⬆ Upload** button / drag-and-drop zone | 🧪 Files accepted; in-memory metadata only | Pre-signed R2 PUT → client uploads directly → server action writes `documents` row | `lib/storage.ts` (R2 adapter), `lib/documents.ts`, `recordChange()` |
| 🔗 **Link Drive folder** button | 🎨 Disabled | Removed per spec update. Drive is no longer a first-class storage path. If ever needed for a specific deal, link as a normal external URL. | — |
| File icon by extension | 🎨 Derived from name | — | — |
| Download button | 🎨 Disabled | Server action returns pre-signed GET URL; browser navigates to it | `lib/storage.ts::getDownloadUrl(docId)` |
| Delete button | 🧪 Removes from state | Soft-delete (`documents.deleted_at`); leave R2 object until retention policy lands; audit | `deleteDocument(docId)` |
| File size display | 🎨 From File API | Read from `documents.size_bytes` (set at upload) | — |

### 3.9 Email threads

| Element | Today | Needs | Module |
|---|---|---|---|
| Thread list with subject + participant count + msg count + last activity | 🎨 Derived from mock | Read from `email_threads` + `email_messages` (cached snapshot of Gmail) | `lib/gmail.ts` thread sync |
| Search box | 🎨 Client-side string match | Same, but over cached thread+message corpus; or punt to Gmail search | — |
| ▸ Click to expand | 🎨 | — | — |
| 3-most-recent + "Show N earlier" | 🎨 | — | — |
| **Hover message → full body popover** | ⚠️ Hovers work; body from mock | Body from Gmail API `messages.get(format=FULL)`; cache `body_text` in DB after first fetch | `lib/gmail.ts` fetchMessage |
| **Gmail ↗** per-thread link | ⚠️ Links to Gmail search by subject | Switch to direct thread permalinks (`https://mail.google.com/mail/u/0/#inbox/THREAD_ID`) once we have `thread_id` from API | — |
| **Gmail ↗** per-message link | ⚠️ Links to Gmail search by subject+sender | Same — direct message permalinks | — |

**Thread ingestion pipeline (new — the biggest piece of work in emails):**
| Step | Module | Notes |
|---|---|---|
| Fetch a thread on demand (paste a URL into intake) | `lib/gmail.ts::fetchThread(threadId)` | Triggered from new-deal intake only in v1 |
| Store thread header + message headers | `email_threads`, `email_messages` | Don't store bodies until viewed |
| Lazy body fetch on first hover/expand | `fetchMessageBody(messageId)` | Cache in `email_messages.body_text` |
| Refresh thread ("pull new messages") | `syncThread(threadId)` | Optional v1 button; v2 webhooks |
| No background polling | ✅ | Spec is explicit about on-demand only |

### 3.10 Linked ClickUp

| Element | Today | Needs | Module |
|---|---|---|---|
| Label + URL | ⚠️ Row from mock; link goes to `app.clickup.com` homepage | Store real task URLs from a "link ClickUp task" UI that accepts a task URL, extracts the task_id, validates via ClickUp API | `lib/clickup.ts` getTask; `linked_clickup` table |
| Open ↗ link | 🌐 Works | — | — |

**Missing v1:** "+ Link ClickUp task" button + URL paste input. Also the one-time ClickUp seed import referenced in the spec/roadmap — pulls existing MAIN_WORKFLOW tasks into deals with a diff screen before commit.

### 3.11 Linked GHL

| Element | Today | Needs | Module |
|---|---|---|---|
| Label + URL | ⚠️ Row from mock; link goes to `app.gohighlevel.com` homepage | Store real GHL pipeline/opportunity URLs; UI to link them | `lib/ghl.ts`; `linked_ghl` table |
| Open ↗ link | 🌐 Works | — | — |

**Missing v1:** "+ Link GHL" button; optional GHL contact lookup-by-email on new-contact creation (per spec).

### 3.12 Change history

| Element | Today | Needs | Module |
|---|---|---|---|
| Preview list (5 entries) | 🧪 Derived from `deal.changeHistory` written by `recordChange()` | Read from `change_history` where `deal_id = $1` order by at desc limit 5 | `lib/audit.ts` read |
| "View all" popup | 🧪 Scrollable full list | Same, no limit | — |
| Entry format (time / kind badge / actor / summary) | 🎨 | Format function in `lib/audit.ts` | — |

**What's already correct:** every mutation in the prototype calls `recordChange()`. Porting means the server action writes the DB row instead of appending to in-memory array.

---

## 4. Shared components

### 4.1 ContactHoverCard (`components/contact-hover-card.tsx`)
Used in: dashboard expanded row, deal detail People, notes popup (potentially, future).

| Behavior | Today | Needs | Module |
|---|---|---|---|
| Hover-to-open with debounce | 🎨 | — | — |
| Click to pin | 🎨 | — | — |
| Quick view / Person view / Back | 🎨 | — | — |
| Edit form | 🧪 Saves to local state | `updateContact` server action | `lib/contacts.ts` |
| Draft email button | 🧪 | See 3.7 draft-email pipeline | — |

### 4.2 NotesPopupButton (`components/notes-popup.tsx`)
Global (from dashboard). Reads `getAllNotes()` which merges all deal notes + standalones.

| Behavior | Today | Needs |
|---|---|---|
| List across deals | 🧪 | `SELECT * FROM notes` filter server-side |
| CRUD | 🧪 | Same server actions as per-deal notes (3.6) |
| Standalone notes (no `deal_id`) | 🎨 Supported in type | `notes.deal_id NULL` is valid |
| @mentions | 🎨 Highlight only | Notifications (see 3.6) |

### 4.3 CalendarButton (`components/calendar-popup.tsx`)

| Behavior | Today | Needs |
|---|---|---|
| Aggregate all task due dates + closings | 🧪 `collectItems(DEALS)` | Server action `getScheduledItems(range)` |
| Reschedule a task from calendar | 🧪 In-memory `overrides` dict | `updateTaskDueDate(taskId, iso)` |
| Hover detail card | 🎨 | — |
| Day/week/month views | 🎨 | — |

### 4.4 DraftEmailButton (`components/draft-email-dialog.tsx`)
See 3.7 draft-email pipeline. Cross-cutting module.

### 4.5 DealDetailsButton (`components/deal-details-popup.tsx`)
Today read-only. To make writable: track-specific forms + `updateDealFields(dealId, partial)`.

### 4.6 PeoplePicker (`components/people-picker.tsx`)
Options come from `TEAM_MEMBERS` constant. Needs to read from `users` table where `role = 'internal'`.

### 4.7 RefreshButton (`components/refresh-button.tsx`)
Currently toast-only. One-liner to call `router.refresh()`.

---

## 5. Backend modules to build

Grouped by domain. Each bullet is roughly one file in `lib/`.

### Data access (7)
- `lib/db.ts` — Drizzle client (one-liner once schema exists)
- `lib/deals.ts` — list, get, create, update(fields partial), updateStage, updateOwners, updateMoney, updateTrack, updatePriority
- `lib/contacts.ts` — list, get, create, update, searchByName, searchByEmail
- `lib/deal-people.ts` — addToDeal, removeFromDeal, updateRole
- `lib/tasks.ts` — list(dealId), create, update, delete, toggleComplete, updateOwners, updateDueDate, maintain is_next invariant
- `lib/notes.ts` — list(dealId|null), create, update, delete, toggleUrgent, toggleCompleted, mentionsOf(userId)
- `lib/documents.ts` — list(dealId), upload (wraps storage), delete, getDownloadUrl

### Cross-cutting (5)
- `lib/audit.ts` — `recordChange(dealId, actor, kind, summary, beforeJson, afterJson)` called by every mutation
- `lib/access.ts` — Cloudflare Access JWT validation against CF JWKS; `getCurrentUser()` returns the authenticated user and upserts the `users` row on first visit. Source of truth for identity — replaces Auth.js entirely.
- `lib/crypto.ts` — `encrypt(plaintext)` / `decrypt(ciphertext)` using `@47ng/cloak`. `decrypt()` inserts an `npi_access_log` row on every call (non-skippable). Supports key rotation from day one.
- `lib/users.ts` — find/upsert by email (called from `lib/access.ts`), list internal users (powers `PeoplePicker` options)
- `lib/env.ts` — Zod env validation

### Integrations (6)
- `lib/gmail.ts` — fetchThread, fetchMessage, fetchMessageBody, sendDraft, syncThread. Uses per-user Gmail OAuth (separate from Access auth).
- `lib/anthropic.ts` — extractIntake(text), polishEmail(body, dealContext), with tokens logging. **Must call `redactNPI(text)` before any API request** — removes SSN, DOB, account numbers, driver-license numbers from prompts.
- `lib/email-templates.ts` — list, render(templateId, context)
- `lib/clickup.ts` — getTask, linkToDeal, seedImport. **Policy: no NPI in task titles/descriptions** — enforced by code review.
- `lib/ghl.ts` — getContactByEmail, linkToDeal
- `lib/storage.ts` — Cloudflare R2 adapter only. Pre-signed PUT (upload, 5 min TTL) and pre-signed GET (download, 15 min TTL). Object keys never leak to browser.

### UI plumbing (2)
- `lib/mentions.ts` — parse @mentions, resolve to users, enqueue notifications
- `lib/notifications.ts` — in-app toast channel + email channel (and future Slack)

### Cron / webhooks (v2)
- `cron/gmail-sync.ts` — optional v2, pulls new messages for tracked threads
- `cron/reminder-digest.ts` — optional, daily "what moved / what's stuck" email to Carrie

**Total: ~20 backend files to write. Most are 50–200 lines each.** (Cross-cutting grew from 3 to 5 with the addition of `lib/access.ts` and `lib/crypto.ts`; `lib/auth.ts` removed.)

---

## 6. Third-party integrations

| Service | Scope | Auth | Cost |
|---|---|---|---|
| **Cloudflare Access** | Authentication at the edge — MFA, Google IdP, policy-based allowlist, session management, per-request JWT. **Replaces Auth.js entirely.** | JWT validated per-request against CF JWKS in `lib/access.ts`. `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD` env vars. | Free (Zero Trust Free tier, ≤50 users) |
| **Cloudflare Tunnel** | Origin isolation — app origin accepts no public traffic except via Cloudflare. Deployed as `cloudflared` sidecar on Railway. | Tunnel token from CF dashboard, stored in Railway env | Free |
| **Cloudflare R2** | Document storage (P5+). Private buckets, SSE-R2, pre-signed URLs with TTL. | R2 access key from CF dashboard | ~$0–5/mo at MVP volume; **zero egress fees** |
| **Google OAuth + Gmail API** | Read threads/messages, send drafts (P4/P5). **Not used for authentication** — per-user consent only for Gmail API access. | Scopes: `gmail.readonly`, `gmail.send` only. Per-user OAuth (each team member consents once for their account). `GMAIL_OAUTH_CLIENT_ID` + `GMAIL_OAUTH_CLIENT_SECRET` env vars. | Free at normal volume |
| **Anthropic API** | Haiku for intake extraction; Sonnet for email polish (P6). **`lib/anthropic.ts::redactNPI()` strips NPI from text before every API call.** | API key from Anthropic Console; $25/mo hard cap | ~$1–5/mo expected at MVP volume |
| **ClickUp API** | Read task metadata, one-time seed import (P7). **Policy: no NPI in task titles/descriptions.** | Personal API token | Free |
| **GHL (FundLaunch360) API** | Contact lookup by email (P8) | API key | Free |
| **Railway** | Web host + managed Postgres + `cloudflared` sidecar. Encrypted DB content protected further by column-level encryption (`lib/crypto.ts`). | — | $10–15/mo |

**Vendor management tracked in `.planning/VENDORS.md`.** Each vendor has an entry listing data touched, agreement type, and DPA status. Mike reviews annually (minimum).

**Notifications wiring (for @mentions) not required v1** — can be in-app toast only. Email/Slack channels are v1.1.

---

## 7. Build order recommendation

Follows the P0 → P10 phasing in `.planning/ROADMAP.md`. Prototype directly maps to these phases — I'm annotating which prototype surfaces each phase unblocks.

| Phase | Delivers | Prototype surfaces that start working |
|---|---|---|
| **P0 Foundation** | DB + deploy pipeline (Auth.js work in P0 is superseded by P0.5 — see below) | Drizzle schema, env validation, Playwright test harness |
| **P0.5 Cloudflare Access + Encryption Scaffolding** | CF Access (replaces Auth.js), CF Tunnel, `@47ng/cloak` encryption, `npi_access_log`, VENDORS.md | Login/avatar via Access; every server action verifies JWT; future NPI writes/reads auto-encrypted + audited |
| **P1 Data model** | `deals` + `stages` + list view | 2.1 load from DB; 2.3 row data; 2.2 filters |
| **P2 Detail + tasks + stages + audit** | `tasks`, `notes` (partial), `change_history` | 2.3 stage dropdown; 2.4 read-only; 3.1–3.4; 3.7 task CRUD + toggle complete; 3.6 notes v1; 3.12 change history |
| **P3 People map + contacts** | `contacts`, `deal_people` | 3.5 People (quick + person view + contact edit); 2.4 people in expanded row |
| **P4 Gmail + intake** | Gmail thread fetch, new-deal intake | 3.9 Email threads display (without polish); 2.1 New Deal flow |
| **P5 Email drafting + sending** | Templates + send | 3.7 Draft email button goes live on all 3 entry points (task, person popup, quick view) |
| **P5.5 Documents + R2** | R2 buckets + pre-signed URLs + upload/download/delete + soft-delete + audit | 3.8 Documents upload, download, delete all become real |
| **P6 LLM polish + intake parse** | Anthropic integration + cost footer | ✨ Polish button; MTD cost footer; Haiku intake extraction |
| **P7 ClickUp seed + per-deal link** | ClickUp API | 3.10 Linked ClickUp becomes real; + seed import UI |
| **P8 GHL lookup** | GHL API | 3.11 Linked GHL + contact enrichment on create |
| **P9 Kanban + Calendar + palette** | Alt views + Cmd-K | 2.1 Calendar button wires to real data; new Kanban/Calendar routes |
| **P10 Calibration** | Domain hookup + Title post-close stages | Custom domain; Title-specific stages |
| **Post-MVP** | @mentions notifications across channels; daily cron archiving Cloudflare Access API logs to R2 for long-term retention | 3.6 mentions side-effects (email/Slack) |

### Top 5 riskiest / slowest items
1. **Encryption key custody + NPI access log invariants** (P0.5) — key loss = data loss; audit log must be non-skippable
2. **Gmail thread sync + body caching** (P4/P5) — OAuth refresh token handling, rate limits, pagination edge cases
3. **ClickUp seed import diff screen** (P7) — one-time but needs careful UX to preview before commit
4. **@mentions notifications across channels** (post-MVP) — in-app toast is easy; email/Slack each add a channel
5. **Stage audit invariants** (P2) — is_next uniqueness + forward-only advance + killed-with-reason

### Quick-win items that are nearly free
- Refresh button → `router.refresh()` (1 line)
- `"Carrie"` hardcodes → `getCurrentUser().name` from Access (global find/replace)
- Gmail deeplinks → real thread/message permalinks once thread_id is stored
- "Linked ClickUp/GHL" Open buttons → already work; just need real URLs stored

---

## 8. Compliance layer (GLBA scope)

STM handles mortgage data. That places portions of this app in-scope for GLBA's Safeguards Rule. The compliance posture is layered into the design rather than bolted on as a separate afterthought.

### What counts as NPI
Non-public personal information, as defined by GLBA §313.3(n): name + financial info combined, SSN, DOB, driver-license number, account numbers, income, credit scores, loan applications. Names alone are not NPI. Property addresses alone are not NPI.

### Columns that must be encrypted when they first exist
- `contacts.ssn` (if ever stored)
- `contacts.dob` (if ever stored)
- `contacts.driver_license_number` (if ever stored)
- Any future loan-application fields (income, employment, credit score)

**FLAG — `deals.purchase_price`:** price alone is not NPI; borrower + price together can be. Default: unencrypted for MVP, revisit at P1 review.

### Three audit layers (referenced in §1)
1. **App mutation audit** — `recordChange()` → `change_history` (every write)
2. **NPI read audit** — wrapped `decrypt()` → `npi_access_log` (every read of encrypted field)
3. **Access dashboard logs** — retained per Cloudflare Free tier window; supplementary only. Authoritative GLBA audit trail lives in layers 1 and 2 above. *V2 backlog: daily cron polling the Cloudflare Access API to archive to R2 for long-term retention.*

### NPI redaction at third-party boundaries
- `lib/anthropic.ts::redactNPI(text)` — strips SSN patterns, DOB patterns, account numbers, driver-license numbers from any text sent to Anthropic
- Enforced in code review for ClickUp (no NPI in task metadata)

### Vendor management
`.planning/VENDORS.md` tracks every third-party data processor: what data they touch, DPA status, owner. Mike reviews annually. All rows start at status PENDING until Mike confirms each DPA.

### Open compliance items (tracked but not blocking code)
- Document retention policy — deferred to GLBA program finalization; add R2 lifecycle rules when defined
- `purchase_price` encryption decision — revisit at P1 review
- Formal incident response plan — separate doc, not in this repo

---

## Appendix: prototype files inventory

```
mock/
  types.ts      — all types (Deal, Contact, Task, Note, EmailThread, etc.)
  deals.ts      — 10 mock deals + standalone notes
  helpers.ts    — formatCurrency, relativeTime, stageLabel, stageIndex, priorityColor

components/
  app-header.tsx                  — header + avatar
  deals-view.tsx                  — dashboard list + filter bar
  deal-detail.tsx                 — entire deal detail page
  mini-stage-bar.tsx              — inline stage progress dots
  stage-stepper.tsx               — big visual stage stepper
  stage-dropdown.tsx              — stage select
  track-priority-dropdowns.tsx    — track + priority selects
  people-picker.tsx               — multi-select team member popover
  contact-hover-card.tsx          — quick view / person view / edit
  editable-currency.tsx           — click-to-edit $ field
  notes-popup.tsx                 — cross-deal notes dialog + HighlightMentions
  calendar-popup.tsx              — day/week/month scheduled items
  refresh-button.tsx              — refresh with spin + toast
  email-threads.tsx               — collapsed threads + hover preview
  deal-details-popup.tsx          — track-aware details dialog
  draft-email-dialog.tsx          — templated email compose + polish
  change-history.tsx              — inline list + scrollable popup
  ui/*                            — shadcn/ui primitives

app/
  layout.tsx                      — root layout + PROTOTYPE banner + Toaster
  page.tsx                        — home (dashboard)
  deal/[id]/page.tsx              — deal detail route
```
