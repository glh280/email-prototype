---
phase: 1
slug: core-data-model
status: draft
shadcn_initialized: true
preset: base-nova (baseColor neutral, cssVariables, lucide icons)
created: 2026-04-17
---

# Phase 1 — UI Design Contract

> Visual and interaction contract for the List view (`/`) and New Deal form (`/deal/new`). Locks tokens, copy, per-column/per-field decisions. Consumed by `gsd-planner` to write tasks and `gsd-executor` to implement. Derived from CONTEXT.md D-01 through D-19 and Carrie's 2026-04-17 feedback.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui |
| Preset | `base-nova` style, `baseColor: neutral`, CSS variables mode |
| Component library | Radix primitives (via shadcn) |
| Icon library | `lucide-react` |
| Font | System sans (Tailwind `font-sans` default — Inter-flavored). Mono reserved for `file_no` + numeric monetary columns (`var(--font-geist-mono)`, defined in `app/globals.css`). |
| Theme tokens | `app/globals.css` (OKLCH, light + dark). No new global CSS variables added in Phase 1 — track/priority/milestone color mappings ship as Tailwind utility classes compiled from this spec. |
| Radius | `--radius: 0.625rem` (already set). Badges use `radius-sm`; cards/inputs use `radius-md`; dialogs use `radius-lg`. |

**New primitives to install in Phase 1:**
- `npx shadcn@latest add table` — required for List view (D-07)
- `npx shadcn@latest add form label` — react-hook-form + Zod wiring for `/deal/new` (D-11)
- `npx shadcn@latest add calendar` — date picker for `closing_at` / `funding_at` inputs on the form

No other registries. No third-party blocks. Registry safety gate not applicable beyond the shadcn-official primitives above.

---

## Spacing Scale

Tailwind defaults. All declared values are multiples of 4.

| Token | Tailwind class | Value | Phase 1 usage |
|-------|---------------|-------|---------------|
| xs | `p-1` / `gap-1` | 4 px | Badge inner padding, icon-to-label gap inside chips |
| sm | `p-2` / `gap-2` | 8 px | Table cell vertical padding, filter pill gap, dropdown item padding |
| md | `p-4` / `gap-4` | 16 px | Card padding, form field vertical gap, filter bar internal gap |
| lg | `p-6` / `gap-6` | 24 px | Page horizontal padding, accordion section padding, form section gap |
| xl | `p-8` / `gap-8` | 32 px | Above the filter bar, below the table footer |
| 2xl | — | 48 px | Empty-state vertical padding |

**Exceptions:** Table rows use `py-3` (12 px) to match a 40-px row height density target; this is an exception to the 4/8/16 cadence, approved because row density is the single highest-signal lever for the 5-second glance. All other spacing uses the scale above.

**Container:** Both pages render inside `<main class="mx-auto max-w-[1440px] px-6 py-6">`. Below 1440 px, the page is full-bleed with 24 px gutters. Above 1440 px, the content centers with equal margins.

---

## Typography

| Role | Size | Weight | Line-height | Tailwind | Phase 1 usage |
|------|------|--------|-------------|----------|---------------|
| Body | 14 px | 400 | 1.5 (21 px) | `text-sm leading-6` | Table cells, form inputs, filter labels |
| Label | 12 px | 500 | 1.4 (17 px) | `text-xs font-medium leading-[1.4]` | Column headers (uppercase tracking-wide), field labels, badge text |
| Heading | 20 px | 600 | 1.25 (25 px) | `text-xl font-semibold leading-tight` | Page titles ("Deals", "New Deal"), section titles in accordion |
| Display | 28 px | 600 | 1.2 (34 px) | `text-[28px] font-semibold leading-[1.2]` | Empty-state heading only |

Two weights total: 400 regular, 500 medium, 600 semibold (counts as 2 effective weight tiers — medium is for small-caps labels only, semibold for prominent UI). Within sizes: 4 tiers.

**Numeric / monospace:** `file_no`, monetary fields (sales_price, loan_amount), and date strings in the table use `font-mono text-[13px] leading-6` so columns align vertically on digits. This is a deliberate deviation from Body and is why `file_no` reads as "scanable register number" not "sentence text".

**Column-header treatment:** `text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground`. Flips to `text-foreground` when that column is the active sort.

---

## Color

Built on the existing neutral OKLCH palette in `app/globals.css`. Accent reserved; track/priority/milestone colors declared below.

### Base roles (shipped from globals.css)

| Role | Light value (oklch) | Dark value | Usage |
|------|---------------------|------------|-------|
| Dominant (60%) | `oklch(1 0 0)` (`--background`) | `oklch(0.145 0 0)` | Page background, table body rows |
| Secondary (30%) | `oklch(0.97 0 0)` (`--secondary` / `--muted`) | `oklch(0.269 0 0)` | Table header strip, filter bar surface, accordion section header surface, row hover background |
| Accent (10%) | `oklch(0.205 0 0)` (`--primary`) | `oklch(0.922 0 0)` | **Reserved for:** (1) primary CTA button ("Create Deal"), (2) active sort-column header, (3) focused form field ring, (4) "Needs me" toggle in the active state. Nothing else. |
| Destructive | `oklch(0.577 0.245 27.325)` (`--destructive`) | `oklch(0.704 0.191 22.216)` | HIGH priority badge text, inline field validation errors, delete/kill confirmation actions (Phase 2 uses this; Phase 1 reserves it for validation errors only) |
| Muted text | `oklch(0.556 0 0)` (`--muted-foreground`) | `oklch(0.708 0 0)` | Em-dash placeholders (D-16), column headers, Activity timestamps, help text |
| Border | `oklch(0.922 0 0)` (`--border`) | `oklch(1 0 0 / 10%)` | Table row separators, input borders, accordion separators |

### Track badge color mapping (Tracking column + track selector)

Eight tracks. Each gets a low-saturation pastel background + high-contrast foreground. Colors are chosen from the Tailwind palette at the 100 / 700 step for light mode (and 900 / 200 for dark) so they remain readable against the neutral page surface but are distinct enough to recognize at a glance. **Background tone maps to conceptual category, not priority** (priority gets its own column).

| Code | Label | Light bg | Light fg | Dark bg | Dark fg | Tailwind classes (light) |
|------|-------|---------|---------|--------|--------|-------------------------|
| TE | Title & Escrow | `#DBEAFE` | `#1E40AF` | `#1E3A8A` | `#BFDBFE` | `bg-blue-100 text-blue-800` |
| FL | Funding & Lending | `#DCFCE7` | `#15803D` | `#14532D` | `#BBF7D0` | `bg-green-100 text-green-800` |
| DP | Deal Planning & Structure | `#F3E8FF` | `#6B21A8` | `#581C87` | `#E9D5FF` | `bg-purple-100 text-purple-800` |
| PO | Partnership Opportunity | `#FCE7F3` | `#9D174D` | `#831843` | `#FBCFE8` | `bg-pink-100 text-pink-800` |
| EC | Education & Consulting | `#FEF3C7` | `#92400E` | `#78350F` | `#FDE68A` | `bg-amber-100 text-amber-800` |
| SL | Seller Listing | `#FFE4E6` | `#9F1239` | `#881337` | `#FECDD3` | `bg-rose-100 text-rose-800` |
| BL | Buyer Listing | `#CCFBF1` | `#115E59` | `#134E4A` | `#99F6E4` | `bg-teal-100 text-teal-800` |
| GI | General Inquiry | `#E5E7EB` | `#374151` | `#374151` | `#E5E7EB` | `bg-gray-200 text-gray-700` |

**Why by category not priority:** Carrie's first glance on any row is "what kind of file is this?" — answered by category color in the Tracking column. The "how urgent" question is already answered by the separate Priority column. Doubling up would waste a visual channel.

### Priority color mapping (Priority column)

Carrie's note: *"I'm not really seeing any of the tags as low priority"* — LOW is kept in the enum (per D-10-region in CONTEXT) but must render visibly quieter than MEDIUM so it's obvious when something is actually low.

| Priority | Dot | Pill bg | Pill fg | Tailwind |
|----------|-----|---------|---------|----------|
| HIGH | 8 px solid red disc | `bg-red-50` | `text-red-700` | `bg-red-50 text-red-700 ring-1 ring-red-200` |
| MEDIUM | 8 px solid amber disc | `bg-amber-50` | `text-amber-800` | `bg-amber-50 text-amber-800 ring-1 ring-amber-200` |
| LOW | 8 px hollow gray disc | `bg-transparent` | `text-muted-foreground` | `text-muted-foreground ring-1 ring-border` |

Render as: `[dot] HIGH` / `[dot] MEDIUM` / `[dot] LOW`. Dot-plus-label lets Carrie scan either channel at a glance.

### Milestone badge styling

All milestones use one neutral style: `bg-secondary text-secondary-foreground ring-1 ring-border rounded-md px-2 py-0.5 text-[11px] font-medium`. No color-coding by milestone category in Phase 1 — 25 values is too many for a stable color system, and the track badge already communicates track-specific context. P10 calibration can revisit if Carrie asks.

**Terminal stages** (`file_completed`, `killed`) render with a strikethrough-free but dimmed treatment: `text-muted-foreground` and a trailing `·` `✓` (for completed) or `·` `✕` (for killed) lucide icon at 12 px. No red fill for killed — the deal row itself already moves to the `status=killed` filter bucket.

### Placeholder em-dash (D-16)

When a column has no source data yet (P2/P3 fields): render literal `—` (U+2014) in `text-muted-foreground/70` at the Body text size. No tooltip. No hint. Quiet absence.

**Accent reserved for:**
- Primary CTA button `Create Deal` on the New Deal form (solid `bg-primary text-primary-foreground`)
- Active-sort column header background (subtle `bg-primary/5` and `text-foreground`)
- Focus ring on form inputs (`ring-2 ring-primary/30`)
- "Needs me" toggle when active (`bg-primary text-primary-foreground`)

Everything else (row hover, filter pills, section headers, row borders) stays neutral.

---

## Page 1 — List view (`/`)

### Page chrome

- `<AppHeader />` (existing) at top.
- Page title: `<h1 class="text-xl font-semibold">Deals</h1>` — left-aligned, inside a flex row with the primary CTA right-aligned: `<Button asChild><Link href="/deal/new">New Deal</Link></Button>` — solid primary.
- Below the title row: the filter bar (see below) at 16 px top margin.
- Below the filter bar: the table at 16 px top margin.
- Bottom of page: a 24 px tall `<div>` footer showing `{N} deals` in `text-xs text-muted-foreground`. No pagination in Phase 1 (deal volume ≤ 50 per CONTEXT).

### Filter bar

Horizontal row of controls, left-aligned, wraps on narrow viewports. Sits on a `bg-muted/40` surface with `rounded-md border p-3 flex flex-wrap items-center gap-2`.

Left-to-right order:

1. **"Needs me" toggle** — first position (single most important filter per Carrie's priority). Rendered as a shadcn `Button` with `variant="outline"` when inactive, `variant="default"` (primary) when active. Label: `Needs me`. Icon: `lucide-react/UserCheck` at 16 px, leading the label. Click toggles the `needsMe=1` URL param.

2. **Track** — shadcn `Select` multi-select. Trigger text: `Track: All` / `Track: TE, FL` / `Track: 3 selected`. OR within the group (D-12). Width: `min-w-[160px]`.

3. **Milestone** — shadcn `Select` multi-select (or combobox — see assumption 3). Trigger text: `Milestone: All` / `Milestone: 2 selected`. Width: `min-w-[200px]`.

4. **Priority** — shadcn `Select` multi-select. Trigger: `Priority: All` / `Priority: HIGH, MEDIUM`. Width: `min-w-[160px]`.

5. **Overdue** — toggle button (same pattern as Needs me). Label: `Overdue`. Icon: `lucide-react/AlertCircle` at 16 px.

6. **Closing date** — shadcn `Popover` + `Calendar` range picker. Trigger: `Closing: Any` / `Closing: Apr 1 – Apr 30`. Width: `min-w-[200px]`.

7. **Funding date** — same pattern as Closing. Trigger: `Funding: Any` / `Funding: Apr 1 – Apr 30`.

8. **Task due** — same pattern. Trigger: `Task due: Any`.

9. **Spacer + "Clear all"** — right-aligned in the bar, only visible when at least one filter is active. Text button: `Clear all` in `text-sm text-muted-foreground hover:text-foreground`. Clicking strips all filter params and navigates to `/`.

**Semantics (per D-12):** AND across groups; OR within a multi-select. State lives in URL params (per D-07) using kebab/shortname keys: `?needsMe=1&track=TE,FL&priority=HIGH&overdue=1&closing=2026-04-01..2026-04-30&funding=2026-04-01..2026-04-30&taskDue=2026-04-17..2026-04-24&sort=activity_desc`.

### Sort indicators

Default sort is `activity_desc` (D-13). Only **Activity**, **Task Due By**, **Priority**, and **File #** columns are sortable in Phase 1. Other columns render as plain labels (not clickable).

- Column header wraps its label in a `<button>` with `cursor-pointer hover:text-foreground`.
- Active sort column has `text-foreground` and a 12-px `lucide-react/ArrowDown` or `ArrowUp` icon trailing the label.
- Inactive sortable columns show an 12-px `ArrowUpDown` icon in `text-muted-foreground/50` that darkens on hover.
- Clicking a sortable header cycles: desc → asc → default (activity_desc).

### Columns — exact order, widths, alignment, rendering

All widths are `min-width`s; the table uses `table-layout: auto` inside a `w-full` container with horizontal scroll on viewports narrower than 1120 px (see Responsive below). Every cell has `py-3 px-3` (12 / 12).

| # | Header | Min width | Align | Source | Render |
|---|--------|-----------|-------|--------|--------|
| 1 | Tracking | 120 px | left | `deal.track.code` → label + color from the Track badge table above | `<span class="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium {bg}{fg}">{label}</span>` |
| 2 | Priority | 104 px | left | `deal.priority` | dot + label per Priority table above |
| 3 | File # | 136 px | left | `deal.file_no` | `<Link href="/deal/{id}" class="font-mono text-[13px] text-foreground hover:underline">{file_no}</Link>` |
| 4 | Main Contact | 180 px | left | `deal.main_contact_name` (D-03 — P1 text field) | Name only. Null → em-dash. Truncate with `truncate` + `title={fullName}` tooltip. |
| 5 | Address | 260 px | left | `deal.property_address` | Truncate at ~42 chars with `truncate`; native `title` attribute shows the full string on hover. Null → em-dash. |
| 6 | Milestone | 180 px | left | `deal.stage.label` | Neutral badge per Milestone styling above. Always populated (default `pre_screen_qualification` per D-10). |
| 7 | Progress / Next Task | 220 px | left | P2 data (tasks table) — not yet in DB | Em-dash placeholder in Phase 1. When task data lands in P2, render task title truncated with `title={full}`. |
| 8 | Task Due By | 128 px | left | P2 data | Em-dash in Phase 1. P2: relative date `Tomorrow` / `In 3 days` / `Overdue 2d` in `font-mono text-[13px]`. Overdue in destructive color. |
| 9 | Quick Note | 240 px | left | `deal.quick_note` | Truncate at ~38 chars; `title` shows full. Empty → em-dash. |
| 10 | Activity | 112 px | right | `max(audit_log.created_at) where record_id=deal.id` (D-15); fallback `deal.updated_at` | Relative timestamp: `2m`, `15m`, `3h`, `yesterday`, `Apr 14`, `Jan 2025`. Always populated (create mutation writes audit row). `text-muted-foreground text-xs font-mono`. |

**Row height:** 48 px (1.5 × 32-px baseline). Above that = noisy; below that = cramped with a badge + mono text combo. This is the single most-tuned number for the 5-second-glance value prop.

### Row states

| State | Treatment |
|-------|-----------|
| Default | `bg-background`, `border-b border-border` |
| Hover | `bg-muted/40 cursor-pointer` (entire row is clickable — see below) |
| Keyboard focus | `outline-2 outline-primary/60 outline-offset-[-2px]` |
| Active (click pressed) | `bg-muted/60` (200-ms transition on bg) |
| `status=killed` | Row fg dims to `text-muted-foreground`; not filtered out in Phase 1 (filter UI for status lands in P2 when the status-change flow ships). |

**Row click target:** Entire row is clickable and navigates to `/deal/{id}` (the P2 detail page). Implementation: the `<tr>` gets `role="button" tabIndex={0}` and an `onClick`; keyboard `Enter` or `Space` activates. **Exception:** the File # column's link gets `onClick={e => e.stopPropagation()}` so middle-click + cmd-click open a new tab cleanly. No nested buttons elsewhere in the row.

### Empty states (two distinct)

**A. No deals exist yet** (`SELECT count(*) FROM deals = 0`):

```
[ icon: FolderOpen, 48 px, text-muted-foreground ]

No deals yet
Create your first deal to start tracking.

[ Button — Create Deal ]   (primary, routes to /deal/new)
```

- Heading: `text-[28px] font-semibold` (Display)
- Body: `text-sm text-muted-foreground`
- CTA: primary button, same as header
- Wrapper: centered, `py-24`

**B. Filters match no deals** (deals exist, but filtered set is empty):

```
[ icon: Filter, 48 px, text-muted-foreground ]

No deals match your filters
Try adjusting or clearing the filters above.

[ Button — Clear all filters ]   (outline variant, clears all URL params)
```

Same vertical padding and typography. Button variant is `outline`, not primary — the action isn't creating work, it's backing up.

### Loading state

List view is server-rendered (Server Component reading Drizzle, per D-07). No client-side fetch. During `next build` / SSR hydration, no skeleton is shown — the page arrives already hydrated.

For the client-side navigation case (e.g., after creating a deal and being redirected), Next.js 16 App Router `loading.tsx` at `app/loading.tsx` renders a skeleton:

- 8 skeleton rows (covers an above-the-fold view at 1440 × 900)
- Each row: 48-px tall, `bg-muted/40` shimmering `rounded-md` blocks sized to approximate each column's min-width
- `aria-label="Loading deals"` on the table wrapper
- `animate-pulse` (Tailwind)

### Responsive behavior

Phase 1 is desktop-first (Carrie works from a laptop). Breakpoints:

- **≥ 1120 px:** Table renders in full. This is the design target.
- **768–1119 px:** Table retains all columns; outer wrapper gets `overflow-x-auto`. Horizontal scroll with a sticky left edge on the Tracking + File # columns (`sticky left-0 bg-background z-10 shadow-[1px_0_0_0_var(--border)]` on both `<th>` and `<td>`).
- **< 768 px:** Same horizontal scroll; filter bar wraps each control to its own row. Card-based mobile view is **out of scope for Phase 1** — it's VIEW-09 (Phase 9) per ROADMAP.

### Filter presentation — "Needs me"

Already specified above: a first-position toggle button, with `variant="default"` when active (primary fill) and `variant="outline"` when inactive. Reasoning: a toggle chip reads instantly — "is this on? yes." A dropdown or checkbox within a panel buries the single most important filter.

Copy: `Needs me` — matches VIEW-02 verbatim. Not "Assigned to me" or "My turn" — Carrie saw "Needs me" in the spec; consistency wins.

**P1 semantics (from D-14):** matches deals where `deals.internal_owner = getCurrentUser().id`. The tooltip on the button (`title` attribute and `aria-label`) reads: `Deals where you're the internal owner`.

### Toasts

Mounted once globally at `app/layout.tsx` via shadcn `<Sonner />`. Phase 1 emits:

- **On redirect after create:** `Deal {file_no} created` — e.g., `Deal TX-2026-0004 created`. Duration 4 s. Default (success) variant.

No error toast for the list view in Phase 1 — SSR failure renders `error.tsx` (out of scope here).

---

## Page 2 — New Deal form (`/deal/new`)

### Page chrome

- `<AppHeader />` at top.
- Inside `<main>`: a `max-w-[720px] mx-auto` column.
- Top row: `<Link href="/" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft class="h-4 w-4" /> Back to deals</Link>` — 24 px above the heading. Clicking plain-links back to `/`; no dirty-form confirmation in Phase 1 (see assumption 2).
- `<h1 class="text-xl font-semibold">New Deal</h1>` — 16 px below the back link.
- `<p class="text-sm text-muted-foreground">Fill in the basics — you can edit the rest after it's created.</p>` — 4 px below the heading.
- 24 px gap, then the sectioned accordion (D-08).
- Sticky footer at the bottom of the viewport with the submit + cancel buttons (see below).

### Section layout (D-08)

Three `<Accordion type="multiple">` sections. Shadcn `Accordion` primitive — to add: `npx shadcn@latest add accordion`. Default open values: `["file-basics"]` (only Section 1 open initially).

Each section header:
```
[ ChevronRight / ChevronDown, 16 px ]  File basics         3 / 5 filled
                                       Property details    0 / 5 filled
                                       Financials & dates  0 / 10 filled
```

- Section title: `text-base font-semibold`
- Right-side meta: `text-xs text-muted-foreground` showing `N filled / N total` where N counts only required + filled-optional fields. Recomputes live as the user types.
- Chevron at left: `ChevronRight` when collapsed, `ChevronDown` when open; 150-ms transform transition.
- Section header background: `bg-muted/30` on hover, `bg-muted/50` when the panel is open.
- Panel body: `p-6 pt-2 space-y-4` — field gap is 16 px.

### Section 1 — File basics (open by default)

Layout: **single column** on all widths. Rationale: the 720-px container with generous field height is easier to scan than a 2-column grid at this density, and Carrie explicitly said "don't over-engineer the first version".

Fields (in order):

| Field | Required? | Component | Options | Notes |
|-------|-----------|-----------|---------|-------|
| Track | **yes** | shadcn `Select` (single) | 8 tracks from `tracks` table, sorted by `sort_order` | Renders each option as `[color dot] {label}` so the color mapping is visible at selection time. Default: unselected. On selection, the default priority pre-fills the Priority field but is editable. |
| Priority | **yes** | shadcn `Select` (single) | `HIGH`, `MEDIUM`, `LOW` | Renders each option with the dot treatment. Default: whatever the selected track's `default_priority` says; editable afterward. |
| Title | **yes** | shadcn `Input` | — | Free text, e.g., "1234 Elm St, Tampa FL". Hint text below: `A short name to recognize this file at a glance.` |
| Property state | no (but recommended) | shadcn `Select` (single) | 50 US state codes + `XX` option | Label: `Property state`. Help text: `Used in the file number. Leave blank and the file number will start with XX.` Default: unselected (→ file_no uses literal `XX`). |
| File # preview | n/a | read-only pill | — | Rendered as a small pill: `Will be assigned: {STATE or XX}-{YYYY}-{next_available}` — a best-effort preview computed server-side on initial form load. If the state is changed, only the prefix updates optimistically on the client; the `{next_available}` digit is a live count + 1 read at page-load time and **labeled as an estimate** (`~TX-2026-0004` with the leading `~`). Real `file_no` is assigned atomically on insert (D-02). |
| Main Contact name | no | `Input` | — | D-03 — free text in P1. Migrated to FK in P3. |
| Main Contact email | no | `Input type="email"` | — | Inline email format validation on blur. |

All required fields carry a red asterisk after the label: `Track *`. The asterisk renders as `<span class="text-destructive">*</span>`. The rest are plain labels. No "(required)" wording.

### Section 2 — Property details (collapsed by default)

Per D-09, always present regardless of track. Layout: single column.

| Field | Required? | Component | Notes |
|-------|-----------|-----------|-------|
| Property address | no | `Input` | Placeholder: `Street, city, state` |
| Property type | no | shadcn `Select` | Options: `single_family`, `multi_family`, `condo`, `townhome`, `commercial`, `land`, `other`. Render labels Title Case. |
| Sales price | no | `Input type="text" inputMode="decimal"` | Leading `$` prefix inside input; formatted on blur to `$485,000`. Stored as cents or integer USD (planner decides). |
| Loan type | no | shadcn `Select` | Options: `conventional`, `dscr`, `hard_money`, `bridge`, `transactional`, `cash`, `other`. Rendered Title Case. |
| Transaction type | no | shadcn `Select` | Options: `purchase`, `refinance`, `wholesale`, `double_close`, `other`. Rendered Title Case. |

### Section 3 — Financials & dates (collapsed by default)

Layout: 2-column grid **above 640 px**, single column below. `grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4`.

| Field | Component | Notes |
|-------|-----------|-------|
| Loan amount | `Input` | `$` prefix; same formatting as sales price |
| Estimated down | `Input` | `$` prefix |
| Earnest money | `Input` | `$` prefix |
| Est. rehab | `Input` | `$` prefix |
| ARV | `Input` | `$` prefix |
| Closing date | `Popover` + `Calendar` | Trigger button: `Pick a date` → on pick shows `Apr 24, 2026`. Clear button (`X` lucide icon) inside the trigger when a date is set. Stored as `date` (no time) in Phase 1. |
| Funding date | `Popover` + `Calendar` | Same pattern. Help text: `Leave blank if same as closing.` |
| Title CTC | `Checkbox` + label `Title Clear-to-Close` | Boolean default false |
| Lender CTC | `Checkbox` + label `Lender Clear-to-Close` | Boolean default false |

### Field layout (within a section)

- Label above input: `<label class="text-xs font-medium leading-[1.4] mb-1 block">`. 2 px below the label, the input. 4 px below the input, any help text: `<p class="text-xs text-muted-foreground">`. 4 px below help text (or input if no help), any error: `<p class="text-xs text-destructive">`.
- Input height: 36 px (`h-9`).
- Input radius: `rounded-md` (`radius-md`).
- Input focus ring: `ring-2 ring-primary/30 ring-offset-0`.
- Invalid input: `border-destructive focus-visible:ring-destructive/30`.

### Validation (D-11)

- Zod schema defines required + shape. react-hook-form resolver.
- **On blur** of a required field that's empty or of a typed field with invalid format (email, decimal) → border turns destructive + error message appears below the field.
- **On submit with errors** → do not POST. `requestAnimationFrame` → scroll the first invalid field into view with `scrollIntoView({ block: "center", behavior: "smooth" })`, then `.focus()` that field. Toast fires: `Please fix the errors above`.
- **On submit success** → server action inserts the deal, writes the audit_log row (D-05), and the server action redirects to `/`. The redirected list view emits the success toast `Deal {file_no} created`.

### Submit + cancel buttons — sticky footer

Rendered in a sticky container pinned to the bottom of the viewport:

```
<div class="sticky bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur px-6 py-3 flex items-center justify-end gap-2">
  <Link href="/"><Button variant="outline">Cancel</Button></Link>
  <Button type="submit" variant="default">Create Deal</Button>
</div>
```

- Distance from content: footer always visible on scroll; form content gets `pb-24` so the last fields aren't hidden behind the footer.
- Cancel: outline variant, routes to `/`. No dirty-form confirmation in Phase 1 (see Assumption 2).
- Submit: solid primary. Label: `Create Deal`. Disabled when form is submitting: label becomes `Creating…` with a 14-px spinner icon (`lucide-react/Loader2` with `animate-spin`) leading it.

### Toast feedback

- **Blur on a field that's invalid:** no toast (inline only — avoids noise).
- **Submit with errors:** toast `Please fix the errors above.` (destructive variant). 3 s.
- **Submit success:** toast `Deal {file_no} created.` fires after redirect lands on `/`. 4 s.
- **Submit server error:** toast `Couldn't create deal — {error message from server}. Try again.` (destructive variant). 6 s. Submit button re-enables.

---

## Copywriting Contract

| Element | Exact copy |
|---------|------------|
| List page title | `Deals` |
| List page CTA | `New Deal` |
| Filter bar: Needs-me toggle | `Needs me` |
| Filter bar: overdue toggle | `Overdue` |
| Filter bar: clear all | `Clear all` |
| Empty state A (no deals) heading | `No deals yet` |
| Empty state A body | `Create your first deal to start tracking.` |
| Empty state A CTA | `Create Deal` |
| Empty state B (filtered empty) heading | `No deals match your filters` |
| Empty state B body | `Try adjusting or clearing the filters above.` |
| Empty state B CTA | `Clear all filters` |
| Loading skeleton aria-label | `Loading deals` |
| New-deal page title | `New Deal` |
| New-deal subtitle | `Fill in the basics — you can edit the rest after it's created.` |
| New-deal back link | `Back to deals` |
| New-deal primary CTA | `Create Deal` |
| New-deal cancel | `Cancel` |
| New-deal section 1 header | `File basics` |
| New-deal section 2 header | `Property details` |
| New-deal section 3 header | `Financials & dates` |
| Field help — property state | `Used in the file number. Leave blank and the file number will start with XX.` |
| Field help — funding date | `Leave blank if same as closing.` |
| Field help — title input | `A short name to recognize this file at a glance.` |
| File # preview (before state chosen) | `Will be assigned: ~XX-2026-{nnnn}` |
| File # preview (after state chosen) | `Will be assigned: ~TX-2026-{nnnn}` |
| Validation — required field blank | `{Field label} is required.` |
| Validation — email format | `That email doesn't look right.` |
| Validation — decimal format | `Enter a number like 485000 or 485,000.` |
| Submit toast — errors | `Please fix the errors above.` |
| Submit toast — success (on list view) | `Deal {file_no} created.` |
| Submit toast — server error | `Couldn't create deal — {error}. Try again.` |
| Destructive confirmation | Not applicable in Phase 1. Deal close/kill flows land in P2 (DEAL-06 requires reason note + two-click confirm); reserve destructive color + text for P2. |

---

## Iconography

All icons from `lucide-react`. Phase 1 uses:

| Icon | Usage |
|------|-------|
| `UserCheck` | Needs me toggle |
| `AlertCircle` | Overdue toggle |
| `Filter` | Empty state B |
| `FolderOpen` | Empty state A |
| `ChevronLeft` | Back link on form |
| `ChevronRight` / `ChevronDown` | Accordion collapse/expand |
| `ArrowDown` / `ArrowUp` / `ArrowUpDown` | Sort indicators |
| `Loader2` | Submit-in-progress spinner (with `animate-spin`) |
| `Check` / `X` | Terminal milestone decorators |
| `Calendar` | Date picker trigger |

All icons render at 16 px (`h-4 w-4`) unless specified otherwise; empty-state icons at 48 px.

---

## Accessibility floor

- All interactive elements reachable via keyboard; tab order: filter bar left→right, then table rows top→bottom.
- Row activation via `Enter` / `Space`; also document `j` / `k` shortcuts are **out of scope for Phase 1** (VIEW-08, Phase 9).
- Form labels programmatically linked via `htmlFor` / `id`. Errors linked via `aria-describedby`.
- Focus ring visible (`ring-2 ring-primary/30`) on every focusable element — default shadcn behavior is preserved.
- Color is never the sole carrier of a signal: priority has dot + text; track has label text beside color; overdue has icon beside color.
- Contrast: every text-on-background combo in the light theme passes WCAG AA at body size (14 px). OKLCH lightness math: `0.205` foreground on `1.0` background = > 8:1. Badge text on pastel 100-level backgrounds audits at ≥ 4.5:1.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `table`, `form`, `label`, `calendar`, `accordion` (plus already-installed: avatar, badge, button, card, checkbox, dialog, dropdown-menu, hover-card, input, popover, select, separator, sonner, tabs) | not required — shadcn official |
| third-party | none | not applicable |

No third-party block vetting gate runs because no third-party registries are declared.

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

Explicit assumptions made in this spec that planner/executor should surface back to Carrie or Mike if they bite during implementation. None of these block Phase 1 — they're marked as "ship + revisit".

1. **Track color mapping chosen by category, not priority.** CONTEXT.md did not specify either approach. I picked category because the Priority column already handles urgency. If Carrie in practice scans by urgency first on a mixed list, P10 calibration can flip to a priority-keyed color scheme (simple CSS class remap, no schema change). **Ship + revisit.**

2. **No dirty-form confirmation on Cancel.** CONTEXT.md is silent. Phase 1 form has short sections and the only destructive side-effect of Cancel is losing typed data. Native browser unload warning ("Reload site? Changes you made may not be saved.") covers the hard-loss case. Adding an in-app confirm dialog costs more than it prevents at v1 volume. If Carrie reports data loss, add `Dialog` with `Discard changes?` / `Keep editing` in P2. **Ship + revisit.**

3. **Milestone filter as `Select` multi-select, not Combobox.** With 25 options, a searchable combobox (shadcn `Combobox` via `Command` + `Popover`) would be more scannable. The shadcn `Combobox` pattern is not one of the primitives yet installed; adding it is cheap but it's a new install decision. Phase 1 ships `Select` with all 25 options in a 320-px-tall scrollable panel; P2 (stage advancement UI) is a natural time to upgrade to combobox for both filter and deal-detail selectors. **Ship + revisit.**

4. **File # preview on the form is best-effort, not atomic.** The actual `NNNN` counter increments on insert via the Postgres sequence (D-02). The preview shows `~TX-2026-0004` (leading `~`) computed as `SELECT count(*) FROM deals WHERE created_at >= start_of_year + 1` at page render. Two users creating simultaneously would see the same preview; only the first to submit gets that number. At ≤ 50 deals/year and a single-operator v1, the risk is near-zero. **Ship.**

5. **Killed / closed deals render dimmed but remain in the default list view.** Status filter lands in P2. Carrie can manually filter via URL in P1 (`?status=active`) but the UI doesn't expose a status chip. If daily use reveals the default list feeling cluttered with killed deals, add a status chip to the filter bar as a small P2 follow-up. **Ship + revisit.**

6. **Accent color = neutral `--primary` (near-black).** The existing theme is monochrome. CONTEXT D-06 mentions `NEXT_PUBLIC_APP_BRAND_COLOR` as an optional env var that "defaults if absent". Phase 1 ships with the default (neutral primary). If Carrie wants a brand-tinted primary (e.g., UTS navy), set the env var in P1 or later — the token system accommodates a single-color swap without further refactor. **Ship as neutral. Tint later.**

7. **Sort on Main Contact, Milestone, Quick Note not exposed.** Only Activity, Task Due By, Priority, and File # are sortable headers in Phase 1. Sorting by milestone requires a stable ordering of the 25 values (possible via `stages.sort_order`, but the UX semantics — "does Title stages sort interleave with Funding stages?" — need Carrie's input). **Revisit in P10 calibration or on request.**

8. **Single-column layout in Section 1 of the form.** Two columns would fit in 720 px but forces eye-jumping between track-selector and priority-selector, which have a dependency (track default prefills priority). Single column preserves top-to-bottom reading. **Ship + revisit.**

---

*Phase: 01-core-data-model*
*UI spec written: 2026-04-17 via /gsd:ui-phase 1*
*Next step: gsd-ui-checker review → /gsd:plan-phase 1*
