---
phase: 2
slug: deal-detail-tasks-stages
status: draft
shadcn_initialized: true
preset: base-nova (baseColor neutral, cssVariables, lucide icons) — inherited from Phase 1
created: 2026-04-17
---

# Phase 2 — UI Design Contract

> Visual and interaction contract for the Deal Detail page (`/deal/[id]`), task management, and stage advancement. **Extends Phase 1's 47 locked decisions — does not contradict them.** All tokens, color mappings, copy patterns, and component conventions inherit from `.planning/phases/01-core-data-model/01-UI-SPEC.md` unless explicitly overridden here. Auto-generated (discuss skipped per `workflow.skip_discuss=true`); every decision below reflects Claude's discretion, with rationale inline where the call is non-obvious.

---

## Inheritance Map

| Property | Inherited from P1 UI-SPEC (locked) |
|----------|------------------------------------|
| Design system | shadcn base-nova, neutral, CSS vars |
| Icon library | `lucide-react` |
| Font | System sans; `var(--font-geist-mono)` for `file_no` / numeric columns |
| Spacing scale | 4 / 8 / 16 / 24 / 32 / 48 (Tailwind defaults, multiples of 4) |
| Row/list density exception | `py-3` (12 px) cell padding for tables |
| Typography tiers | Body 14/400, Label 12/500, Heading 20/600, Display 28/600 |
| Track badge palette (8 codes) | TE blue / FL green / DP purple / PO pink / EC amber / SL rose / BL teal / GI gray (100 / 800 steps) |
| Priority pill+dot (HIGH/MEDIUM/LOW) | HIGH red / MEDIUM amber / LOW hollow gray |
| Milestone badge style | Neutral `bg-secondary text-secondary-foreground ring-1 ring-border` |
| Em-dash placeholder | `—` (U+2014) in `text-muted-foreground/70` |
| Base roles (60/30/10) | `--background` / `--secondary` / `--primary` (neutral) |
| Destructive semantic | `--destructive` — **Phase 2 extends** to kill confirm + cancel-advance buttons |
| Container | `max-w-[1440px] mx-auto px-6 py-6` for list-width pages; detail page uses narrower (see below) |
| Button composition | base-nova `<Button render={<Link />}>` — NOT `asChild` |
| Toaster mount | Global Sonner at `app/layout.tsx` |
| URL-state pattern | `useRouter` + `useSearchParams` + serialize module |
| Accent reserved list | Primary CTA + active-sort + focus ring + "Needs me" toggle — **Phase 2 extends** to active tab + current milestone pip |

No color value, spacing token, or type tier is introduced in Phase 2. Everything below is composition of existing tokens into new layouts.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui |
| Preset | `base-nova` (inherited) |
| Component library | base-ui primitives (inherited) |
| Icon library | `lucide-react` |
| Font | System sans + Geist mono for `file_no` / monetary / dates |

**New shadcn primitives to install in Phase 2:**

| Primitive | Why | Install command |
|-----------|-----|-----------------|
| `alert-dialog` | Two-click stage-advance confirm (STAGE-02) + kill-deal confirm with reason note (DEAL-06) | `npx shadcn@latest add alert-dialog` |
| `textarea` | Kill-reason note, quick-note editor, notes tab composer | `npx shadcn@latest add textarea` |
| `scroll-area` | Audit tab virtualization fallback; Tasks tab long list | `npx shadcn@latest add scroll-area` |

**Already available** (shipped in P1): accordion, avatar, badge, button, calendar, card, checkbox, dialog, dropdown-menu, form, hover-card, input, label, popover, select, separator, sonner, table, tabs.

**No third-party registries. No third-party blocks.** Registry safety gate not applicable.

---

## Spacing Scale

Inherit P1 verbatim. No new tokens.

| Token | Value | P2 usage |
|-------|-------|----------|
| xs | 4 px | Stepper pip gap, task-row icon-to-text, audit-row field labels |
| sm | 8 px | Tab trigger padding, task-list row internal gap, field label → input |
| md | 16 px | Card padding, form field vertical gap, section gap |
| lg | 24 px | Page horizontal padding, tab panel top padding, between Overview sections |
| xl | 32 px | Above the page header, between major panels (Header / Tabs / Panel), above kill-deal footer |
| 2xl | 48 px | Empty state vertical padding inside tab panels |

**Inherited row-height exception:** tables (tasks list, audit log) use `py-3` (12 px) cells, same cadence as P1 list view.

**Container for detail page:** `<main class="mx-auto max-w-[1120px] px-6 py-6">`.

> **Rationale (narrower than list view's 1440 px):** Detail is a reading-and-editing page, not a scannable table of records. A max width of 1120 px keeps line length readable for Notes/Audit text (≈ 75–80 chars at 14 px body) without the empty gutters that 1440 px would produce on a single-column detail form. List view stays 1440 px because it's horizontally information-dense.

---

## Typography

Inherit P1 tiers verbatim. Phase 2 adds no new sizes or weights.

| Role | Size / Weight / Line-height | P2 usage |
|------|-----------------------------|----------|
| Body | 14 / 400 / 1.5 | Tab panel content, task titles, audit field labels, notes text |
| Label | 12 / 500 / 1.4 | Field labels in Overview, tab trigger text, stepper pip labels, audit meta |
| Heading | 20 / 600 / 1.25 | Page `<h1>` (deal title + file_no), tab-section titles ("Tasks", "File Contacts") |
| Display | 28 / 600 / 1.2 | Empty state headings inside tab panels (only) |

**Inherited mono usage:** `file_no` (page header breadcrumb), money fields in Overview edit mode, dates in Audit rows, timestamps — all `font-mono text-[13px]`.

**New Phase 2 subtle uses, all within existing tiers:**
- Deal title heading: `text-xl font-semibold` (H) + adjacent file_no in mono label tier
- Tab trigger: Label tier; active tab same size + `font-semibold` → still weight-count-legal (400 / 500 / 600, = 2 effective tiers per P1's audit)
- Audit "before → after" diff chips: Label tier, mono for values

---

## Color

Extend P1's reserved-accent list; no new hex values introduced.

### Base roles (unchanged from P1)

| Role | Token | P2 usage |
|------|-------|----------|
| Dominant (60%) | `--background` | Page body, tab panel body, audit row background |
| Secondary (30%) | `--secondary` / `--muted` | Card surfaces on detail page, tab strip hover, stepper track, audit row stripe |
| Accent (10%) | `--primary` | See reserved list below |
| Destructive | `--destructive` | HIGH priority pill text, kill-deal CTA, revert-stage CTA, validation errors, destructive confirm dialog accent |
| Muted text | `--muted-foreground` | Tab-trigger inactive text, audit meta, em-dash placeholders, helper text |
| Border | `--border` | Card borders, tab underline, stepper line between pips |

### Accent reserved for (extends P1 list)

- (P1) Primary CTA button (`Create Deal`, `Save Changes`, `Advance Milestone`)
- (P1) Active-sort column header
- (P1) Focus ring on form inputs
- (P1) "Needs me" toggle active state
- **(P2 NEW)** Active tab trigger — `data-state=active` gets `text-foreground` + 2 px underline in `bg-primary` (inherit tab primitive's default, keep accent use)
- **(P2 NEW)** Current milestone pip in stage stepper — filled `bg-primary` circle; all other pips neutral
- **(P2 NEW)** `is_next = true` task row — left-edge 2 px accent bar (`border-l-2 border-primary`) so Carrie can see the next-action task at a glance inside a long list

### Destructive reserved for (extends P1 list)

- (P1) HIGH priority badge text
- (P1) Form validation error messages
- **(P2 NEW)** "Kill deal" button label + AlertDialog primary confirm button
- **(P2 NEW)** "Revert milestone" button (stage regression per STAGE-03) — outline variant with destructive text, to signal danger without the weight of a solid-destructive CTA
- **(P2 NEW)** Killed-deal badge on page header (`bg-destructive/10 text-destructive ring-1 ring-destructive/30 rounded-md px-2 py-0.5 text-[11px] font-medium`)

### Stepper color mapping

| Pip state | Background | Foreground | Ring |
|-----------|-----------|-----------|------|
| Past (completed) | `bg-primary/20` | `text-primary` | none |
| Current | `bg-primary` | `text-primary-foreground` | `ring-2 ring-primary/30 ring-offset-2` |
| Future | `bg-background` | `text-muted-foreground` | `ring-1 ring-border` |
| Terminal reached (`file_completed`) | `bg-primary` | `text-primary-foreground` | + lucide `Check` icon inside pip |
| Terminal reached (`killed`) | `bg-destructive` | `text-destructive-foreground` | + lucide `X` icon inside pip |

Line segments between pips: `bg-primary/40` between past+current, `bg-border` between current+future.

---

## Page Layout — `/deal/[id]`

### Page chrome

- `<AppHeader />` (existing) at top.
- `<main class="mx-auto max-w-[1120px] px-6 py-6">`.
- Top row: back link → tab strip → page-level destructive actions menu.

### Header region (above tabs)

Two lines:

**Line 1 (meta / breadcrumb):** `<Link href="/" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft class="h-4 w-4" /> Back to deals</Link>` (copy matches P1).

**Line 2 (title row):** flex row, align-baseline, justify-between.

Left cluster:
```
<h1 class="text-xl font-semibold">{deal.title}</h1>
<span class="font-mono text-[13px] text-muted-foreground">{deal.fileNo}</span>
<TrackBadge code={deal.trackCode} label={deal.trackLabel} />
<PriorityPill value={deal.priority} />
<StatusBadge status={deal.status} />   // hidden when status === 'active'
```

Right cluster (action menu):
```
<Button variant="outline" size="sm">Edit deal</Button>
<DropdownMenu>                          // overflow menu — keeps header clean
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem>Mark as closed</DropdownMenuItem>
    <DropdownMenuItem class="text-destructive">Kill deal…</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

> **Rationale (overflow menu, not prominent buttons):** Close + Kill are rare, one-way mutations. Parking them in an overflow menu keeps the destructive action out of muscle-memory range during routine scanning, and the two-click confirm is still enforced via AlertDialog.

**Killed deal chrome:** `StatusBadge` renders as the killed pill (destructive color); page body gets `opacity-80` on all non-interactive text; the "Kill deal…" menu item replaces with "Deal is killed" (disabled). The "Revert" path for a killed deal is NOT in Phase 2 (deferred to post-calibration).

### Stage stepper (below header, above tabs)

Full-width horizontal strip showing track-specific stages in order. Rendered as a compact pip-and-line pattern to fit all 11 FL or 10 TE stages at 1120 px without truncation.

```
○—○—●—○—○—○—○—○—○—○—○
        ^ current
```

- Pip diameter: 20 px (small but tappable for revert action on past pips).
- Line height: 2 px, centered on pip baseline.
- Pip hover: tooltip via shadcn `HoverCard` shows stage label, `is_terminal` flag, and sort_order.
- Past pip click (revert): opens revert AlertDialog; future pip click is disabled (advance must proceed stage-by-stage).
- Current pip: tighter label below (`text-xs font-semibold text-foreground`); all other pips show label on hover only (avoids label collision at 10+ stages).

**Below the stepper, right-aligned:**
```
<Button variant="default" size="sm">Advance to {nextStage.label} →</Button>
```

- When current stage is terminal: button disappears and is replaced by `text-sm text-muted-foreground` reading `Deal in terminal stage — {stage.label}`.
- Clicking opens two-click-confirm AlertDialog (see Interactions).

**Universal-stage fallback for DP/PO/EC/SL/BL/GI tracks (P10-deferred track-specific stages):** same stepper renders universal stages only (pre_screen → deal_structuring → file_completed, with `killed` branching). Carrie sees exactly the stages available to her track; no ghost future stages.

### Tabs strip

Order — matches VIEW-05:

1. **Overview** (default)
2. **File Contacts** (renamed from People per VIEW-05 — P2 ships as read-only "Coming in Phase 3" panel; stepper + header + tasks are the working P2 surface, contacts are the P3 scope)
3. **Tasks**
4. **Emails** (placeholder — P4 scope; renders empty state A with "Coming in Phase 4" copy)
5. **Notes**
6. **Audit**

Tab trigger rendering: shadcn `Tabs` with underline variant (2 px primary underline on active). Active trigger `text-foreground font-semibold`, inactive `text-muted-foreground font-medium`.

URL state: `?tab=overview|contacts|tasks|emails|notes|audit` (default = `overview`). This mirrors P1's URL-state convention so a shared detail-link opens to the right tab.

> **Rationale (render placeholder tabs now, not hide them):** VIEW-05 locks tab order. Showing all six from P2 means later phases land data behind existing UI, not a re-add. Cheap graceful degradation.

---

## Tab 1 — Overview (editable)

Per VIEW-05: **"Tracking" section placed above the property address block.** Field renames: "Purchase" → "Sales Price", "Loan" → "Loan Amount", "Down" → "Estimated Down".

### Sections (four stacked cards, top→bottom)

Each section is a `<Card>`:
```
<Card>
  <CardHeader class="flex-row justify-between items-center py-3 px-4 border-b">
    <CardTitle class="text-sm font-semibold">{sectionTitle}</CardTitle>
    <Button variant="ghost" size="sm" onClick={toggleEdit}>Edit</Button>
  </CardHeader>
  <CardContent class="p-4">{fields}</CardContent>
</Card>
```

Gap between cards: 16 px (`space-y-4`).

**Section order:**

1. **Tracking** — track (read-only badge), priority (editable), status badge, quick_note (inline-editable textarea with auto-save on blur)
2. **Property** — property_address, property_state, property_type, title_file_no, loan_no
3. **Financials** — sales_price, loan_amount, estimated_down, earnest_money, est_rehab, arv, loan_type, transaction_type
4. **Dates & Gates** — opened_at (read-only), closing_at, funding_at, closed_at (read-only — set when status changes), title_ctc (checkbox), lender_ctc (checkbox)

### Edit pattern — two modes (read / edit per card)

- **Read mode (default):** Fields render as `<dl>` definition lists:
  ```
  <dl class="grid grid-cols-[140px_1fr] gap-y-3 gap-x-4">
    <dt class="text-xs font-medium text-muted-foreground">Sales Price</dt>
    <dd class="text-sm font-mono">{formatted or em-dash}</dd>
    ...
  </dl>
  ```
  Null values render em-dash per P1 D-16.

- **Edit mode (on "Edit" click):** Fields switch to input controls inline (same layout grid; `<dt>` becomes `<label>`, `<dd>` becomes the input). Section footer adds `Cancel` + `Save changes` buttons.

- **Validation + save:** Reuse `createDealSchema` from P1, extended to `updateDealSchema` in `lib/deal-schema.ts` with all fields optional + audit-payload derivation. Money fields reuse `makeMoneyBlurHandler` + `parseMoney` from P1 Plan 05 verbatim.

- **Save action:** Server action `updateDeal(dealId, diff)` wraps the UPDATE + audit row in ONE `db.transaction` (same pattern as `createDeal`). On success: card exits edit mode, toast fires `Changes saved.`, stepper + header badges re-render if track/priority changed.

> **Rationale (per-card edit, not whole-page edit):** Overview has ~20 fields spread across 4 logical groupings. Whole-page edit creates a huge form with "why did I need to touch this field?" fatigue. Per-card edit limits the blast radius of any single change, and the audit log naturally captures smaller before/after diffs that are easier to read in the Audit tab.

### Overview copy contract

| Element | Copy |
|---------|------|
| Section 1 title | `Tracking` |
| Section 2 title | `Property` |
| Section 3 title | `Financials` |
| Section 4 title | `Dates & Gates` |
| Edit button | `Edit` |
| Cancel button (inside section) | `Cancel` |
| Save button (inside section) | `Save changes` |
| Save success toast | `Changes saved.` |
| Save error toast | `Couldn't save — {error}. Try again.` |
| Quick note placeholder | `A short note to surface on the list view.` |
| Field labels | `Sales Price` / `Loan Amount` / `Estimated Down` / `Earnest Money` / `Est. Rehab` / `ARV` / `Closing Date` / `Funding Date` / `Title CTC` / `Lender CTC` (matches P1 form verbatim where overlap exists) |

---

## Tab 2 — File Contacts (P2 placeholder)

Per VIEW-05 rename. Empty state A pattern:

```
[ Users icon, 48 px, text-muted-foreground ]

File contacts live here
Per-deal role slots (title partner, TC, lender, etc.) arrive in Phase 3.
```

No CTA; this is a waiting state, not an actionable empty. Centered `py-24`.

---

## Tab 3 — Tasks

The working surface for TASK-01 through TASK-05.

### Layout

```
[ + New task ]                                      ← top-right, primary CTA
────────────────────────────────────────────────────
OPEN  (grouped, is_next surfaced first)
[ ] ◀ Next · Follow up with lender               due in 2d   @Carrie  ▸
[ ]     Order title search                       due tomorrow @TC     ▸
[ ]     Schedule closing                         no due date  @Carrie ▸
────────────────────────────────────────────────────
DONE  (collapsible — collapsed by default after 5+)
[✓]     Collect earnest money                    Apr 14  @Carrie
[✓]     Send PSA to seller                       Apr 12  @Mike
────────────────────────────────────────────────────
```

Per TASK-01: completed tasks sort to bottom, grouped separately; open stays at top. Email-drafts-from-task attach back as notes on that task (Phase 5 wiring — P2 reserves the UI slot below the title row).

### Task row anatomy

| Element | Treatment |
|---------|-----------|
| Checkbox | shadcn `Checkbox`, 16 px, leading the row. On check → 5-second undo toast fires (TASK-04). |
| `is_next` affordance | `border-l-2 border-primary` on the row + `◀ Next` chip before the title (`text-[11px] bg-primary/10 text-primary ring-1 ring-primary/30 rounded-md px-1.5 py-0.5 font-medium`). Only one row in the list ever carries this. |
| Title | Body tier (14 / 400). Truncate at row width with `title={full}` tooltip. |
| Due date | `font-mono text-[13px]`. Relative format: `due in 2d` / `due tomorrow` / `due today` / `overdue 3d`. Overdue in `text-destructive`; today in `text-amber-700 dark:text-amber-300`; future in `text-muted-foreground`. |
| Owner | `@{name}` in `text-xs text-muted-foreground` |
| Row affordance | `▸` chevron on hover opens an inline edit popover (change owner, due date, advances_stage_to) |
| Row hover | `bg-muted/40` |
| Row height | 48 px min, flexible when wrapping (rarely needed at 1120 px detail width) |

### Add-task affordance

Top-right `<Button variant="default">+ New task</Button>`. Opens a shadcn `Dialog` with a short form:

- Title (required)
- Owner (select — users list)
- Due date (popover + calendar, same as new-deal form)
- Parent task (select — optional, shows only open tasks of same deal — enables sub-tasks per TASK-01)
- `advances_stage_to` (select — optional, shows only stages reachable from current with `sort_order > current.sort_order` — enables auto-advance per TASK-01)
- `is_next` (checkbox — default false)

**Invariant enforcement (TASK-02, one `is_next` per deal):** if the user checks `is_next` on a new task while another exists, on save the server action atomically clears the previous `is_next` and sets the new one in one transaction. Database-level partial unique index (`CREATE UNIQUE INDEX ON tasks (deal_id) WHERE is_next = true;`) is the safety net — the server action is the happy path.

**Auto-promote (TASK-03):** when the current `is_next` is checked off, the server action atomically picks the next open task by `(due_date asc nulls last, created_at asc)` and flips it to `is_next = true`. This is one transaction containing: update task A (done + is_next=false) + update task B (is_next=true) + audit log row for each. If no open tasks remain, `is_next` is simply cleared — no error.

### Auto-advance-stage (TASK-01 `advances_stage_to`)

When a task with a non-null `advances_stage_to` is completed, the server action additionally runs the same two-click-confirmed stage advance — but **without the confirm prompt**. The task's configuration IS the confirmation. The audit row notes `source: task_autoadvance` to distinguish from manual advances.

**Visual affordance during completion:** the undo toast (TASK-04) explicitly says `Task completed. Milestone advanced to {stage.label}. Undo?` — the user knows the side-effect happened.

### Undo behavior (TASK-04)

- Checking a task fires `toast.success("Task completed. Undo?", { duration: 5000, action: { label: "Undo", onClick: revertTask } })`
- Toast shows for 5 s with an Undo button. Clicking Undo runs a reverse-mutation server action: flips `status` back to `open`, restores the prior `is_next` owner if auto-promotion happened, and writes a compensating audit row (`operation: "update"`, with reasoning).
- After 5 s with no click, the toast dismisses; no other action needed.

### Tasks tab empty state (no tasks yet)

```
[ ListChecks icon, 48 px, text-muted-foreground ]

No tasks yet
Add a task to track the next action on this file.

[ Button — + New task ]   (primary)
```

### Tasks tab copy contract

| Element | Copy |
|---------|------|
| Add CTA | `+ New task` |
| `is_next` chip | `◀ Next` |
| Open section header | `OPEN` (small caps via Label tier uppercase) |
| Done section header | `DONE` + `({n})` count + expand/collapse chevron (collapsed by default when count ≥ 5) |
| Empty state heading | `No tasks yet` |
| Empty state body | `Add a task to track the next action on this file.` |
| Empty state CTA | `+ New task` |
| Completion toast (no side effects) | `Task completed. Undo?` |
| Completion toast (with auto-advance) | `Task completed. Milestone advanced to {stage.label}. Undo?` |
| Completion toast (with auto-promote) | `Task completed. Next task is now "{newNextTaskTitle}". Undo?` |
| Completion error | `Couldn't update task — {error}. Try again.` |
| Add-task dialog title | `New task` |
| Add-task dialog submit | `Add task` |
| Add-task dialog cancel | `Cancel` |

---

## Tab 4 — Emails (P4 placeholder)

Same empty-state-A pattern as File Contacts, with Mail icon and "Coming in Phase 4" copy. No CTA.

---

## Tab 5 — Notes

Per DEAL-04 the Notes tab is visible in Phase 2. Ship as a simple chronological note log:

- Top: a `<Textarea>` composer with placeholder `Add a note…` and a `Save note` primary button (appears only when textarea has content).
- Notes render below, newest first, as `<Card>` with: author avatar + name + `relativeTime(created_at)` header line, body in Body tier, 14 px top padding on body.
- Empty state (no notes):
  ```
  [ StickyNote icon, 48 px, text-muted-foreground ]

  No notes yet
  Use notes for free-form context that doesn't fit elsewhere.
  ```

**Storage scope:** Phase 2 adds a `deal_notes` table if none exists; one note row per submit. Writes `audit_log` row per note creation (OPS-01 surface widened). No edit / delete in P2 (keep notes append-only for audit integrity; edit/delete lands in P3 or P10 if Carrie asks).

> **Rationale (append-only in P2):** Free-form context is worth preserving verbatim when looking back at a deal; the cost of adding edit UI is not zero and Carrie has not flagged the need. Ship + revisit if real use demands edit.

### Notes copy contract

| Element | Copy |
|---------|------|
| Composer placeholder | `Add a note…` |
| Composer CTA | `Save note` |
| Save success toast | `Note added.` |
| Save error toast | `Couldn't save note — {error}. Try again.` |
| Empty state heading | `No notes yet` |
| Empty state body | `Use notes for free-form context that doesn't fit elsewhere.` |

---

## Tab 6 — Audit

The P2 source of truth for "every mutation appears with before/after" (success criterion 5). Every row in `audit_log` where `table_name IN ('deals','tasks','deal_notes')` AND `record_id = deal.id OR record_id.deal_id = deal.id` shows up here.

### Layout

Reverse-chronological list. One row per audit entry. Sticky filter header at top:

```
Filter: [ All · Deal · Tasks · Notes · Stage ]        Sort: Newest first
```

Rows are `<div class="py-3 border-b">`, density consistent with list view's `py-3` convention.

### Row anatomy

```
Apr 17, 2:34 pm · Carrie Davis · deals.update
    Priority:  MEDIUM → HIGH
    Quick note: null → "Closing pushed to May"
```

- Line 1 (meta): `font-mono text-[13px] text-muted-foreground`. Format: `{relativeTime} · {user.email or name} · {table_name}.{operation}`.
- Line 2+ (diff): each changed field on its own line with `{Label}:` (Label tier, muted) followed by a diff chip. For `create`, only the `after` value is shown (no arrow). For `delete`, only `before` with strikethrough. Values render as:
  - Strings: `font-mono text-[13px]` with before/after separated by an arrow glyph (`→` in `text-muted-foreground`).
  - Nulls: literal word `null` in `text-muted-foreground italic`.
  - Dates: formatted `Apr 17, 2026` for readability, not raw ISO.
  - Money fields: formatted `$485,000` (reuse `lib/format.ts` helpers).

### Filter chip row

Segmented-control style using shadcn `Button variant="outline"` toggles:
- `All` (default)
- `Deal` — rows where `table_name = 'deals'`
- `Tasks` — rows where `table_name = 'tasks'`
- `Notes` — rows where `table_name = 'deal_notes'`
- `Stage` — rows where `table_name = 'deals'` AND the diff touches `stage_id`

State in URL: `?tab=audit&auditFilter=tasks`. Active chip uses primary fill (inherits P1 "Needs me" treatment).

### Empty state

On a just-created deal with only the creation audit row, the Audit tab shows the `Deal created` row and nothing else. Never truly empty — creation writes at least one row. If the filter returns zero, show the P1-pattern empty-state-B:

```
[ Filter icon, 48 px, text-muted-foreground ]

No audit rows match this filter
Try a different filter above.

[ Button — Show all ]   (outline, clears ?auditFilter)
```

### Audit copy contract

| Element | Copy |
|---------|------|
| Filter chips | `All` / `Deal` / `Tasks` / `Notes` / `Stage` |
| Sort label | `Sort: Newest first` (read-only in Phase 2; reverse-chron locked) |
| Empty-filter heading | `No audit rows match this filter` |
| Empty-filter body | `Try a different filter above.` |
| Empty-filter CTA | `Show all` |
| Operation labels (diff header) | `deals.create` / `deals.update` / `deals.delete` (raw — Carrie reads operation from table name + before/after, no need for humanized strings) |
| Diff separator glyph | `→` (U+2192) in `text-muted-foreground` |
| Null value | `null` italic muted |

> **Rationale (raw operation labels instead of "Deal created"):** The Audit tab exists for forensic reconstruction, not for glanceable narrative. Raw `table.operation` language matches the GLBA audit posture and keeps the Audit tab unambiguous when it's eventually used to answer a compliance question. If Carrie later says "this is too terse", P10 calibration can humanize.

---

## Interactions

### Stage advance (STAGE-02 — two-click confirm)

Triggered by the `Advance to {nextStage.label} →` button beneath the stepper.

**First click** → AlertDialog opens:

```
Advance milestone?

Current:  {current.label}
Next:     {next.label}

This will be logged to the Audit tab.

[ Cancel ]   [ Advance to {next.label} ]   (primary)
```

**Second click** (on `Advance` inside dialog) → server action `advanceStage(dealId, targetStageId)` runs:
1. Verify `targetStage.sort_order > current.sort_order` AND `(targetStage.track_id IS NULL OR targetStage.track_id = deal.track_id)` — reject otherwise.
2. UPDATE `deals.stage_id = targetStage.id, updated_at = now()`.
3. Write `audit_log` row: `operation: 'update'`, `before_json.stage_id`, `after_json.stage_id`, plus a note field `{source: 'manual_advance'}`.
4. `revalidatePath('/deal/{id}')` so the stepper re-renders.

On success: toast `Advanced to {next.label}.` fires, stepper animates the current pip forward (150 ms transform on `translateX` + fill transition on pip color).

On failure (e.g., concurrent edit raced): toast destructive `Couldn't advance — {error}. Try again.`, dialog closes, stepper state unchanged.

### Stage revert (STAGE-03)

Triggered by clicking any **past pip** in the stepper.

**First click** → AlertDialog (destructive variant):

```
Revert milestone to {target.label}?

Current:  {current.label}
Target:   {target.label}

Revert is also logged to the Audit tab. Use this sparingly — stage changes are
intended to move forward.

[ Cancel ]   [ Revert to {target.label} ]   (destructive)
```

**Second click** → server action `revertStage(dealId, targetStageId)`:
- Same transactional pattern as advance.
- Audit row's `source` field = `manual_revert`.
- Toast: `Reverted to {target.label}.` (success variant — the user confirmed, no need for destructive color on the toast).

### Kill deal (DEAL-06)

Triggered from the overflow menu → `Kill deal…`.

**First click** opens AlertDialog with a REQUIRED reason textarea:

```
Kill this deal?

This marks the deal as killed and stops the active list view from showing it
by default. You can no longer advance milestones on a killed deal. This
action is logged to the Audit tab.

Reason (required)
┌────────────────────────────────────────┐
│                                        │   ← shadcn Textarea, 4 rows
│                                        │
│                                        │
└────────────────────────────────────────┘

[ Cancel ]   [ Kill deal ]   (destructive — disabled until reason has ≥ 3 chars)
```

**Second click** → server action `killDeal(dealId, reason)`:
- UPDATE `deals.status = 'killed'`, `stage_id = {killed universal stage}`, `closed_at = now()` (terminal).
- Write audit row with `after_json.status = 'killed'`, `after_json.kill_reason = reason`.
- Reason also added as a note row in `deal_notes` with `is_system = true`.
- Toast: `Deal killed.` (destructive variant, 4 s).
- Page re-renders: header shows `killed` badge, stepper shows killed terminal pip filled, Overview cards become read-only, overflow menu shows `Deal is killed` (disabled).

### Close deal (DEAL-06)

Close is the benign counterpart to kill — no reason required. Triggered from overflow menu → `Mark as closed`.

**AlertDialog** (default variant, not destructive):

```
Mark deal as closed?

The deal stays visible in the list but is marked complete. This is logged to
the Audit tab.

[ Cancel ]   [ Mark as closed ]
```

No reason textarea. Server action: `closeDeal(dealId)` → UPDATE `status = 'closed'`, `stage_id = {file_completed universal stage}`, `closed_at = now()`, + audit row. Toast: `Deal closed.`

### Keyboard affordances

Detail page Phase 2:

- `Tab` / `Shift+Tab`: cycle through interactive elements (header actions → stepper pips → tab triggers → active panel content → page-level destructive overflow).
- Stepper past pips: `Enter` / `Space` to open revert dialog.
- `Advance` button: `Enter` to open dialog, `Enter` again inside dialog to confirm.
- Task checkboxes: `Space` to toggle.
- Tab triggers: `Left` / `Right` arrow keys cycle panels (shadcn default).

Global shortcuts (`j/k`, `n`, `t`) deferred to VIEW-08 in Phase 9.

---

## Empty states — complete inventory for `/deal/[id]`

| Context | Icon | Heading | Body | CTA |
|---------|------|---------|------|-----|
| Deal not found (bad UUID / deleted) | `FileQuestion` | `Deal not found` | `It might have been killed or the link is stale.` | `Button — Back to deals` (outline) |
| Tab 2 — File Contacts | `Users` | `File contacts live here` | `Per-deal role slots (title partner, TC, lender, etc.) arrive in Phase 3.` | none |
| Tab 3 — Tasks | `ListChecks` | `No tasks yet` | `Add a task to track the next action on this file.` | `Button — + New task` (primary) |
| Tab 4 — Emails | `Mail` | `Emails arrive in Phase 4` | `Gmail threads linked to this file will appear here.` | none |
| Tab 5 — Notes | `StickyNote` | `No notes yet` | `Use notes for free-form context that doesn't fit elsewhere.` | none (textarea composer above handles entry) |
| Tab 6 — Audit (filtered empty) | `Filter` | `No audit rows match this filter` | `Try a different filter above.` | `Button — Show all` (outline) |

All use the same pattern as P1: centered wrapper `py-24`, 48 px icon, Display tier heading, Body subtitle.

---

## Error states

**Server action failure (any of: updateDeal, advanceStage, revertStage, closeDeal, killDeal, createTask, updateTask, revertTask, createNote):**

- Toast (destructive variant, 6 s): `Couldn't {verb} — {error message}. Try again.`
  - Verbs: `save changes`, `advance milestone`, `revert milestone`, `close deal`, `kill deal`, `add task`, `update task`, `undo`, `save note`
- The UI element that triggered the action re-enables (button unlocks; dialog stays open for retry; checkbox reverts its visual state).
- No field-level recovery is required for Phase 2 — every action has a single natural retry path.

**Concurrent edit (e.g., Mike advanced a stage while Carrie was looking at the deal):**
- Phase 2 does not implement optimistic concurrency control. If a mutation targets a state that has already changed, the server action re-reads the deal after the mutation and the toast reads: `Advanced to {actual.label}. (Note: the deal had changed.)`. This is a surface-level signal; v1 single-operator context makes deeper CAS unnecessary. Revisit in v2 (multi-user).

**Validation failure inside Overview edit mode:**
- Same pattern as P1 form: on blur, destructive border + inline message; on submit with errors, scroll-to-first and toast `Please fix the errors above.`

---

## Copywriting Contract (consolidated)

Single source of truth. Phase 2 executor must use these exact strings.

| Element | Copy |
|---------|------|
| Back link | `Back to deals` |
| Page title (deal detail) | `{deal.title}` — no decoration; use the actual title |
| Edit-deal button (header) | `Edit deal` |
| Overflow menu — close | `Mark as closed` |
| Overflow menu — kill | `Kill deal…` |
| Overflow menu — killed state | `Deal is killed` (disabled) |
| Advance CTA | `Advance to {nextStage.label} →` |
| Advance dialog heading | `Advance milestone?` |
| Advance dialog confirm CTA | `Advance to {next.label}` |
| Revert dialog heading | `Revert milestone to {target.label}?` |
| Revert dialog confirm CTA | `Revert to {target.label}` |
| Close dialog heading | `Mark deal as closed?` |
| Close dialog confirm CTA | `Mark as closed` |
| Kill dialog heading | `Kill this deal?` |
| Kill dialog reason label | `Reason (required)` |
| Kill dialog confirm CTA | `Kill deal` |
| Cancel (any dialog) | `Cancel` |
| Advance success toast | `Advanced to {next.label}.` |
| Revert success toast | `Reverted to {target.label}.` |
| Close success toast | `Deal closed.` |
| Kill success toast | `Deal killed.` |
| Stage-update error toast | `Couldn't advance — {error}. Try again.` / `Couldn't revert — {error}. Try again.` |
| Overview section titles | `Tracking` / `Property` / `Financials` / `Dates & Gates` |
| Overview Edit | `Edit` |
| Overview Cancel / Save | `Cancel` / `Save changes` |
| Overview save toast | `Changes saved.` |
| Overview save error | `Couldn't save — {error}. Try again.` |
| Quick-note placeholder | `A short note to surface on the list view.` |
| Tab triggers | `Overview` / `File Contacts` / `Tasks` / `Emails` / `Notes` / `Audit` |
| Tasks — add CTA | `+ New task` |
| Tasks — is_next chip | `◀ Next` |
| Tasks — open header | `OPEN` |
| Tasks — done header | `DONE ({n})` |
| Tasks — empty heading | `No tasks yet` |
| Tasks — empty body | `Add a task to track the next action on this file.` |
| Tasks — completion toast (plain) | `Task completed. Undo?` |
| Tasks — completion toast + auto-advance | `Task completed. Milestone advanced to {stage.label}. Undo?` |
| Tasks — completion toast + auto-promote | `Task completed. Next task is now "{title}". Undo?` |
| Tasks — task error | `Couldn't update task — {error}. Try again.` |
| Tasks — new-task dialog title | `New task` |
| Tasks — new-task submit | `Add task` |
| Notes — composer placeholder | `Add a note…` |
| Notes — composer CTA | `Save note` |
| Notes — add success | `Note added.` |
| Notes — add error | `Couldn't save note — {error}. Try again.` |
| Notes — empty heading | `No notes yet` |
| Notes — empty body | `Use notes for free-form context that doesn't fit elsewhere.` |
| Audit — filter chips | `All` / `Deal` / `Tasks` / `Notes` / `Stage` |
| Audit — empty-filter heading | `No audit rows match this filter` |
| Audit — empty-filter body | `Try a different filter above.` |
| Audit — empty-filter CTA | `Show all` |
| Audit — null value | `null` (italic, muted) |
| Deal-not-found heading | `Deal not found` |
| Deal-not-found body | `It might have been killed or the link is stale.` |
| Deal-not-found CTA | `Back to deals` |
| File Contacts placeholder heading | `File contacts live here` |
| File Contacts placeholder body | `Per-deal role slots (title partner, TC, lender, etc.) arrive in Phase 3.` |
| Emails placeholder heading | `Emails arrive in Phase 4` |
| Emails placeholder body | `Gmail threads linked to this file will appear here.` |

**Destructive confirmations** — both `Kill deal` and `Revert milestone` use shadcn `AlertDialog` (NOT plain `Dialog`) for the role="alertdialog" accessibility semantics, and their primary confirm button gets `variant="destructive"`.

---

## Iconography

All `lucide-react`, 16 px default (`h-4 w-4`) unless noted.

| Icon | Usage |
|------|-------|
| `ChevronLeft` | Back link |
| `MoreHorizontal` | Header overflow menu trigger |
| `Check` | Terminal milestone pip (`file_completed`) |
| `X` | Terminal milestone pip (`killed`); Close-dialog cancel |
| `ArrowRight` | Stepper advance affordance in CTA |
| `Users` | File Contacts empty state (48 px) |
| `ListChecks` | Tasks empty state (48 px) |
| `Mail` | Emails empty state (48 px) |
| `StickyNote` | Notes empty state (48 px) |
| `Filter` | Audit empty-filter state (48 px) |
| `FileQuestion` | Deal-not-found state (48 px) |
| `Plus` | "+ New task" — inline before text (not separate icon) |
| `Loader2` | Submit / advance spinner (`animate-spin`) |
| `CalendarIcon` | Task date picker trigger |

---

## Responsive behavior

Desktop-first, consistent with P1.

- **≥ 1120 px:** Design target. Overview cards full-width, stepper shows all pips with current label visible beneath.
- **768–1119 px:** Page fits (max-w-[1120px] means `w-full` below 1120). Stepper pips remain, but past-pip labels only show on hover. Overview grid collapses `grid-cols-[140px_1fr]` → `grid-cols-1` (label above value).
- **< 768 px:** Tabs strip becomes horizontally scrollable. Stepper pips shrink to 16 px. Overview cards single-column. **Tasks add-task dialog becomes full-screen** (shadcn Dialog has this affordance via Tailwind breakpoints). Mobile polish is VIEW-09 (Phase 9); Phase 2 ships "usable but not optimized" below 768 px.

---

## Accessibility floor

Inherited from P1. Specific Phase 2 requirements:

- Tabs: full keyboard nav (shadcn default — left/right to cycle, tab to enter panel).
- Stepper pips: every pip must have `aria-label={stage.label}` + `aria-current={isCurrent ? 'step' : undefined}`. Past pips that are clickable need `role="button"` + `tabIndex={0}`.
- AlertDialog: shadcn's default role is `alertdialog` with focus trap; primary CTA receives focus on open so Enter confirms.
- Task checkbox: label programmatically linked; the row `<tr>` is not itself a click target for task rows (taskbar uses discrete checkbox + popover trigger pattern rather than full-row click like list view, to keep the checkbox click surface clear).
- Color-is-never-the-sole-signal audit:
  - `is_next` task: border + chip + icon (three channels, not just color)
  - Current stepper pip: fill color + ring + label (three channels)
  - Killed status: badge + opacity + disabled-state language (three channels)
  - Priority pill (inherit P1): dot + label + color (three channels)
- Contrast audit: all new surfaces use inherited tokens — no new contrast math needed.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `alert-dialog`, `textarea`, `scroll-area` (new in P2) + all P1 primitives (accordion, avatar, badge, button, calendar, card, checkbox, dialog, dropdown-menu, form, hover-card, input, label, popover, select, separator, sonner, table, tabs) | not required — shadcn official |
| third-party | none | not applicable |

No third-party registry is declared. Vetting gate not invoked.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

## Open questions / assumptions

Marked `Ship + revisit` — the planner ships the call below; Carrie confirms or flips during use.

1. **Per-card edit (not whole-page edit) on Overview.** Chose per-card because 20 fields across 4 groups makes whole-page-edit fatiguing. If Carrie wants to edit many fields at once (e.g., after a PSA comes in and Property + Financials both need updating), promote a page-level "Edit all" button in P10. **Ship + revisit.**

2. **Overflow menu for kill/close, not inline buttons.** Put both destructive-ish actions in a `MoreHorizontal` dropdown to keep the header clean and reduce accidental clicks. Carrie may want `Mark as closed` as a first-class button when a deal is near terminal. **Ship + revisit during calibration.**

3. **Stage stepper pips at 20 px, not a more compact 12 px.** 20 px reads as clickable on first pass; 12 px reads as a passive progress bar. Since past pips ARE interactive (revert), visible affordance wins. Shrinks gracefully below 768 px. **Ship.**

4. **Append-only notes in Phase 2.** Edit / delete of notes is NOT supported. Rationale: audit integrity + lower UI cost. If Carrie fat-fingers a note and needs an edit, P3 adds the affordance. **Ship + revisit.**

5. **Audit tab filters by table, not by user or date range.** Filter chips cover the common "show me only stage changes" use case. Date-range filters land in P10 if Carrie requests during calibration. **Ship.**

6. **File Contacts tab renders a placeholder in Phase 2.** VIEW-05 calls for the tab; P3 builds the content. Shipping an empty, clearly-labeled tab is less confusing than hiding a tab that appears in P3 (which would look like the UI moved). **Ship.**

7. **Auto-advance-stage confirmation is skipped when a task's `advances_stage_to` triggers it.** The task's configuration is the confirmation. Toast makes the side-effect visible with Undo. If Carrie reports surprise stage advances, a second click in the completion dialog is a small P10 tweak. **Ship + revisit.**

8. **"Needs me" bar on detail page** — NOT part of Phase 2 scope. The detail page presumes the user is already on a file. Whether the current user is the is_next owner is visible on the Tasks tab via the `◀ Next` chip + `@{owner}` display. **Ship.**

9. **No inline-edit-via-click-to-edit on individual Overview fields.** Edit is card-scoped. Rationale: simpler model (card is either in read or edit mode) vs per-field edit (eleven separate edit/save toggles). Known cost: tapping Edit loads all fields into editable state, even the one the user wanted to change. P10 can add single-field inline edit as an enhancement. **Ship + revisit.**

10. **Destructive-color Revert CTA is outline-only, not solid destructive.** Revert is destructive-ish (takes the deal backward) but less catastrophic than kill. Solid destructive is reserved for `Kill deal`. Outline destructive signals "this is a backward move, not a permanent one". **Ship.**

11. **Accent color extension to active-tab underline + is_next task bar + current stepper pip.** These are the only three new accent uses beyond P1's four. All three are "where the user's attention should land RIGHT NOW" — consistent with P1's accent-is-attention convention. **Ship.**

12. **No dirty-form confirmation on tab-change or navigate-away while in edit mode.** Same reasoning as P1 Assumption 2 — browser unload warning handles the hard case; in-app confirmation would slow daily use. **Ship + revisit.**

---

*Phase: 02-deal-detail-tasks-stages*
*UI spec written: 2026-04-17 via /gsd:ui-phase 2 (auto-accept mode, discuss skipped)*
*Next step: gsd-ui-checker review → /gsd:plan-phase 2*
