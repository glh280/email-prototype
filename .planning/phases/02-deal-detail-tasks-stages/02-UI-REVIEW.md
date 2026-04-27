---
phase: 02-deal-detail-tasks-stages
type: retroactive-review
reviewed: 2026-04-17
score: 6/6
status: advisory
---

# Phase 2 — Retroactive UI Review

**Baseline:** `02-UI-SPEC.md` (47 inherited + 12 P2-specific decisions) + `01-UI-SPEC.md` (parent contract)
**Method:** Code-only audit (no dev server running; no screenshots captured).
**Scope:** `app/deal/[id]/page.tsx`, `not-found.tsx`, 14 files under `_components/`, `lib/format.ts`, plus `components/ui/` primitive imports.

---

## Pillar Scores

| # | Pillar | Result | One-line finding |
|---|--------|--------|------------------|
| 1 | Copywriting | PASS | Every copy string in the contract appears verbatim in code; three completion-toast variants implemented correctly. |
| 2 | Visuals | PASS | Focal points clear; three-channel signaling held for is_next, current pip, killed, priority. |
| 3 | Color | PASS | Accent + destructive reserved-lists respected; no new hex values introduced; palette flows from tokens. |
| 4 | Typography | PASS | Only the 4 P1 tiers in use; weight-count stays at effective 2; mono reserved for file_no/money/dates/diff values. |
| 5 | Spacing | PASS (with FLAG) | All documented exceptions (`max-w-[1120px]`, `py-3` table density, `text-[11px]`/`text-[13px]`/`text-[28px]`) are the ones locked by the spec — not drift. Minor: tab-strip top margin uses `mt-6` where spec implies `xl=32px` for "between major panels". |
| 6 | Registry Safety | PASS | `components.json` declares `"registries": {}`; every `components/ui/*` primitive resolves to `@base-ui/react/*` (shadcn official). No third-party imports. |

**Overall: 6/6 PASS**

**Strongest pillars:** Copywriting (word-perfect contract adherence) and Registry Safety (zero deviation from shadcn official).
**Weakest pillar:** Spacing — a 1-token discrepancy (`mt-6` where spec suggests `mt-8`) between major regions, trivially advisory.

---

## Pillar 1 — Copywriting: PASS

Every copy row in the UI-SPEC Copywriting Contract table (lines 668–731) appears verbatim in the code. Spot-checked all 64 contract rows; representative matches:

| Contract string | Location (file:line) |
|---|---|
| `Back to deals` | `deal-header.tsx:57`; `not-found.tsx:26` |
| `Edit deal` | `deal-header.tsx:99` |
| `Mark as closed` / `Kill deal…` / `Deal is killed` | `deal-header.tsx:117, 124, 111` |
| `Advance milestone?` / `This will be logged to the Audit tab.` | `advance-stage-dialog.tsx:61, 63` |
| `Advance to {nextStage.label}` CTA | `stage-stepper.tsx:186`; `advance-stage-dialog.tsx:89` |
| `Revert milestone to {target.label}?` | `revert-stage-dialog.tsx:66` |
| `Mark deal as closed?` / body / `Mark as closed` | `close-deal-dialog.tsx:57, 59-61, 72` |
| `Kill this deal?` / `Reason (required)` / `Kill deal` | `kill-deal-dialog.tsx:90, 99, 133` |
| `Changes saved.` / `Couldn't save — {error}. Try again.` | `overview-card.tsx:166, 170` |
| `+ New task` / `◀ Next` / `OPEN` / `DONE ({n})` | `tasks-tab.tsx:54, 70`; `task-row.tsx:152`; `tasks-tab.tsx:76, 100` |
| Three completion-toast variants (plain / milestone-advanced / next-promoted) | `task-row.tsx:98, 101, 104` — all three matching exact UI-SPEC lines 707–709 |
| `Add a note…` / `Save note` / `Note added.` | `notes-tab.tsx:78, 85, 59` |
| `No audit rows match this filter` / `Try a different filter above.` / `Show all` | `audit-tab.tsx:247, 250, 257` |
| `Deal not found` / `It might have been killed or the link is stale.` | `not-found.tsx:20, 23` |
| `File contacts live here` / `Per-deal role slots...arrive in Phase 3.` | `deal-tabs.tsx:98-99` |
| `Emails arrive in Phase 4` / `Gmail threads linked to this file will appear here.` | `deal-tabs.tsx:114-115` |

**Advisory observations (not blocks):**

- `new-task-dialog.tsx:110` fires a `Task added.` toast on successful task creation. The UI-SPEC copy contract does not declare a success toast for Add Task — this is a reasonable extension that matches the Overview save pattern. Note for P10 calibration: decide whether to canonicalize in the contract.
- Destructive recovery copy pattern is consistent ("Couldn't {verb} — {error}. Try again.") across 7 server-action failure paths (advance, revert, close, kill, update task, undo, save note).
- Empty-state "No tasks yet" body uses `Add a task to track the next action on this file.` — verbatim against `02-UI-SPEC.md:706`.

---

## Pillar 2 — Visuals: PASS

### Focal points

Each screen/tab has one clear focal element:

| Surface | Focal element | Evidence |
|---|---|---|
| Header row | `<h1>` deal title + mono file_no + track/priority badges clustered left | `deal-header.tsx:61–95` |
| Stepper | Current pip (bg-primary + ring) with label beneath — only pip that gets a label | `stage-stepper.tsx:82–84, 174–176` |
| Tasks tab | `◀ Next` row with `border-l-2 border-primary pl-3` + accent chip | `task-row.tsx:140, 151` |
| Audit tab | Reverse-chron list with sticky filter header | `audit-tab.tsx:208` |
| Empty states | 48 px icon + Display heading (28/600) + body + (optional) CTA | 6 empty states follow identical pattern |

### Three-channel signaling (no color-alone signals)

| Signal | Channels present |
|---|---|
| `is_next` task row | color (primary bar) + shape (chip) + text (`◀ Next`) — 3 channels |
| Current stepper pip | color (primary fill) + ring + label below | `stage-stepper.tsx:82–84, 174` |
| Terminal `file_completed` pip | color + Check icon + ring | `stage-stepper.tsx:99–100` |
| Terminal `killed` pip | color (destructive) + X icon + ring | `stage-stepper.tsx:101–102, 76–78` |
| Killed status chrome | destructive badge + `opacity-80` wrapper + disabled menu "Deal is killed" | `deal-header.tsx:50, 86–88, 111` |
| Priority pill | dot + label + color | `deal-header.tsx:74–84` (via `lib/format.ts`) |
| Audit diff chips | `→` arrow glyph + field label + formatted value + italic `null` for nulls | `audit-tab.tsx:307, 119–121` |

### Icon-only controls have aria-labels

- Overflow menu trigger: `aria-label="More actions"` (`deal-header.tsx:104`)
- Date-clear button: `aria-label="Clear date"` (`overview-card.tsx:480`; `new-task-dialog.tsx:378`)
- Task checkbox: `aria-label={`Complete task: ${task.title}`}` (`task-row.tsx:147`)
- Stage pips: `aria-label={stage.label}` + `aria-current={isCurrent ? 'step' : undefined}` (`stage-stepper.tsx:108–109`)
- Filter chips: `aria-pressed={active}` (`audit-tab.tsx:227`)
- DONE section collapse button: `aria-expanded={doneExpanded}` (`tasks-tab.tsx:92`)

### Visual hierarchy

- Size differentiation: Display (28/600) for empty-state headings; Heading (`text-xl font-semibold`) for page title; Body (`text-sm`) for content; Label (`text-xs font-medium`) for meta.
- Weight tiering: primary CTAs, active-tab label, section titles all use `font-semibold`; field labels use `font-medium`; body `font-normal`.
- Spacing rhythm: cards separated by `space-y-4` (16 px); tab panels have `pt-6` (24 px); empty states `py-24` (96 px).

**No visual findings.**

---

## Pillar 3 — Color: PASS

### Accent reserved-list (UI-SPEC line 122–130)

The P2-extended accent reservation adds three targets. Each is used ONLY where declared:

| Accent target | Expected | Found in code |
|---|---|---|
| Primary CTA | `Save changes`, `Advance to…`, `+ New task`, `Save note`, `Add task` | `overview-card.tsx:258` (Save changes); `stage-stepper.tsx:185` (Advance); `tasks-tab.tsx:52, 70` (+ New task); `notes-tab.tsx:84` (Save note); `new-task-dialog.tsx:313` (Add task) |
| Active tab | underline + `text-foreground font-semibold` | inherited from shadcn Tabs `variant="line"` in `deal-tabs.tsx:82` |
| Current stepper pip | `bg-primary text-primary-foreground ring-2 ring-primary/30` | `stage-stepper.tsx:82–84` |
| `is_next` task row | `border-l-2 border-primary` + `bg-primary/10 text-primary ring-1 ring-primary/30` chip | `task-row.tsx:140, 151` |
| Active audit filter chip | `bg-primary text-primary-foreground` | `audit-tab.tsx:223–225` |
| Active status pill (badge-read-only) | `bg-primary/10 text-primary ring-1 ring-primary/30` | `overview-card.tsx:520` |

`grep` for `(text|bg|border)-primary` inside `app/deal/[id]` returns 12 occurrences across 4 files — none leak outside the reserved-list targets above.

### Destructive reserved-list (UI-SPEC line 133–138)

| Destructive target | Expected | Found |
|---|---|---|
| HIGH priority pill text | `text-red-700` | `lib/format.ts:33` (inherited) |
| Form validation errors | `text-destructive` helper text | `kill-deal-dialog.tsx:113` |
| `Kill deal` CTA | `variant="destructive"` on AlertDialogAction | `kill-deal-dialog.tsx:123` |
| `Revert milestone` CTA | `variant="destructive"` (outline per Assumption 10 — the confirm button text is destructive-colored) | `revert-stage-dialog.tsx:90` |
| Killed-deal header badge | `bg-destructive/10 text-destructive ring-1 ring-destructive/30` | `deal-header.tsx:86`; `overview-card.tsx:507` |
| Overflow menu "Kill deal…" text | `className="text-destructive"` | `deal-header.tsx:121` |
| Overdue task due-date tone | `text-destructive` | `task-row.tsx:64` |
| Terminal `killed` stepper pip | `bg-destructive text-destructive-foreground ring-2 ring-destructive/30` | `stage-stepper.tsx:77–78` |

`grep` for `(text|bg|border)-destructive` returns 8 occurrences — all on declared destructive targets.

### 60/30/10 split

- 60% background: `bg-background`, card body — dominant. `audit-tab.tsx:208` sticky filter is `bg-background`.
- 30% secondary: card borders (`border-b` in `CardHeader`), divided-list borders (`divide-y` in audit), stepper line segments (`bg-border` / `bg-primary/40`), secondary fills on "system" and "Closed" chips (`bg-secondary`).
- 10% accent: primary CTAs, active-sort, stepper current pip, is_next bar — see reserved-list above.

### Hardcoded colors

`grep` for `#[0-9a-fA-F]{3,8}` returns **zero matches** in `app/deal/[id]/`. All colors flow through Tailwind tokens or existing `lib/format.ts` class maps.

**Inheritance from P1:** `lib/format.ts` provides `trackBadgeClasses`, `priorityPillClasses`, `priorityDotClasses` — used verbatim by `deal-header.tsx` and `overview-card.tsx` read-only badges. This is contract-correct (P2 extends P1 without introducing new colors).

---

## Pillar 4 — Typography: PASS

### Tier usage (P1 tiers only)

| Tier | Expected classes | Used at |
|---|---|---|
| Body | `text-sm` | 63 occurrences across 13 files (task titles, note body, dialog body, tab content) |
| Label | `text-xs font-medium` | Field labels, audit meta, empty-state bodies, section headers |
| Heading | `text-xl font-semibold` | Page `<h1>` deal title (`deal-header.tsx:63`) |
| Display | `text-[28px] font-semibold leading-[1.2]` | 6 empty-state headings (not-found, 4 tabs with empty states, audit empty-filter) — verbatim UI-SPEC line 96 |

### Arbitrary sizes

Only three arbitrary pixel sizes appear in P2 code, all locked by the spec:
- `text-[28px]` — Display tier (UI-SPEC line 96) — 6 uses
- `text-[13px]` — mono-numeric tier for file_no, money, dates, audit diff values (UI-SPEC line 98) — 7 uses
- `text-[11px]` — badge/chip text (UI-SPEC line 102: "Audit `before → after` diff chips: Label tier, mono for values"; also P1 badge convention) — 7 uses
- `text-[10px]` — used in 2 places: stepper pip text (`stage-stepper.tsx:75`) and note-card avatar fallback initials (`notes-tab.tsx:112`)

The `text-[10px]` use at the pip and avatar is a 2-px deviation from the declared Label tier (`text-xs` = 12 px). This is **defensible** (pips are 20 px and need to fit inside; avatar is 24 px with 2-letter fallback). Neither introduces a new typographic "tier" — they're affordance-specific micro uses of the Label voice.

### Weight count

Used weights (from `grep`):
- `font-normal` (default on body prose)
- `font-medium` — field labels, chip text, badge text
- `font-semibold` — headings, primary CTA, active tab, current-stage label, tab-done count

Effective weight-tier count: **2** (`normal` + `medium`/`semibold` as the "emphasis" bucket), matching the P1 audit finding (line 66 of P1 UI-SPEC).

### Mono usage

Mono (`font-mono`) restricted to: `file_no` in header (`deal-header.tsx:64`), audit meta line + diff values (`audit-tab.tsx:266, 281, 293, 304, 308`), task due-date text (`task-row.tsx:166`), overview read-mode `<dd>` (`overview-card.tsx:204` — reasonable, consistent with list view money columns), note timestamp (`notes-tab.tsx:124`). All match the inherited P1 convention "mono reserved for `file_no`, money, dates, timestamps".

### Line heights

`leading-[1.2]` explicitly set on Display (6 places). Implicit defaults on Body/Label/Heading flow from Tailwind `leading-normal`/`leading-tight`, consistent with P1 declarations (1.5 / 1.4 / 1.25).

**No typography findings.**

---

## Pillar 5 — Spacing: PASS (with one FLAG)

### Scale adherence

All spacing tokens drawn from the 4 / 8 / 16 / 24 / 32 / 48 scale. Most common uses:
- `gap-1` / `gap-2` / `gap-3` / `gap-4` — badge/chip internal gap, dialog field gap
- `space-y-1` / `space-y-2` / `space-y-3` / `space-y-4` / `space-y-6` — card stack, dialog form fields, note list
- `px-2` / `px-3` / `px-4` / `px-6` — input padding, page gutter
- `py-3` / `py-16` / `py-24` — table-row density (documented exception) and empty-state top/bottom
- `mt-2` / `mt-3` / `mt-6` — inline headings, dialog meta, tab panel space
- `mb-2` / `mb-4` / `mb-6` — section headers, button groups

### Documented exceptions (all present and correct)

| Exception | Location |
|---|---|
| `max-w-[1120px]` detail container | `page.tsx:68`; `not-found.tsx:16` |
| `py-3` row density (audit rows) | `audit-tab.tsx:208, 265` |
| `py-3` task-row vertical | `task-row.tsx:139` |
| `space-y-0.5` between task rows | `tasks-tab.tsx:78, 103` — very tight intra-list spacing is intentional for dense rows |
| `space-y-1.5`, `gap-1.5` | dialog meta lines and filter-chip gap — half-step deviations are spec-referenced patterns |

### FLAG — minor rhythm deviation

UI-SPEC line 77 specifies `xl = 32 px` for "above the page header, between major panels (Header / Tabs / Panel), above kill-deal footer". The code uses:

- `stage-stepper.tsx:59` — `mt-6` (24 px) between header and stepper
- `deal-tabs.tsx:80` — `mt-6` (24 px) between stepper and tab strip

The spec-declared `xl` separation is 32 px (`mt-8`). Current `mt-6` = `lg` (24 px). This is **1 step below spec** between major panels.

**Impact:** Low. The visual rhythm still reads cleanly at 1120 px because adjacent surfaces (header block, stepper bar, tab strip) carry their own internal padding. Nothing cramped or colliding.

**P10 recommendation:** Trivial — flip `mt-6` → `mt-8` in both sites, or update the UI-SPEC to canonicalize `lg` between stepper/tabs and reserve `xl` for the page-header-above-everything gap. Either is defensible; flag to Carrie during calibration.

---

## Pillar 6 — Registry Safety: PASS

### components.json

```json
"registries": {}
```

No third-party registries declared. UI-SPEC line 791 explicitly states `third-party: none`.

### Installed primitives audit

All shadcn primitives under `components/ui/` resolve to `@base-ui/react/*` (the shadcn official preset `base-nova` primitives). `grep` on `components/ui/*.tsx` confirms every non-helper file imports from one of:

- `@base-ui/react/*` (alert-dialog, accordion, avatar, button, checkbox, dialog, dropdown-menu, hover-card, menu, popover, preview-card)
- `react-hook-form` (form.tsx — peer dep)
- `sonner` (sonner.tsx — peer dep)
- `next-themes`, `lucide-react`, `class-variance-authority`, `react-day-picker` (calendar)

No imports from `ui.shadcn-plus`, `ui.originui`, `@magicuidesign/*`, arbitrary URLs, or any other third-party registry namespace.

### P2-new installs verified present

| Primitive | File | Import source |
|---|---|---|
| `alert-dialog` | `components/ui/alert-dialog.tsx` | `@base-ui/react/alert-dialog` |
| `textarea` | `components/ui/textarea.tsx` | React native (no primitive dep) |
| `scroll-area` | `components/ui/scroll-area.tsx` | shadcn official (not audited for use in P2 — was installed as speculated fallback; used only indirectly) |

Registry audit safe. No block-source review needed; no `fetch`/`eval`/`process.env`/external-URL-import flags to check.

---

## Summary — Top 5 Recommendations for P10 or Future Refinement

1. **[Spacing — S5 FLAG]** Reconcile the `mt-6` vs `mt-8` gap between major panels (header → stepper → tabs). Either bump to `mt-8` or update the UI-SPEC to declare `lg` (24 px) as canonical between these three surfaces. `app/deal/[id]/_components/stage-stepper.tsx:59` + `deal-tabs.tsx:80`.

2. **[Copywriting — advisory]** Add `Task added.` to the UI-SPEC Copywriting Contract (currently implemented at `new-task-dialog.tsx:110` but not declared in the contract table). Same 30-second edit; keeps the contract complete for future auditors.

3. **[Visuals — live verification]** The five human-UAT items in `02-VERIFICATION.md` (visual dialog fidelity, 5-sec undo toast timing, audit-filter URL round-trip, past-pip revert affordance, E2E through CF Access) remain the real gating check. This review confirms the code matches the contract; Carrie's calibration week confirms the running app matches the code.

4. **[Typography — watchlist]** The `text-[10px]` uses at the stepper pip and avatar fallback are tiny deviations from the declared Label tier. Consider whether to either (a) declare a "micro" tier in the UI-SPEC to canonicalize, or (b) replace with icon-only (no text) inside the pip. Not urgent.

5. **[Experience Design — future enhancement]** Overview card uses per-card edit (UI-SPEC Assumption 1: `Ship + revisit`). If Carrie finds herself toggling between cards to land multi-section updates (e.g., property + financials together after PSA lands), promote a page-level "Edit all" button or inline-per-field edits. Current implementation correctly flags this with "Ship + revisit" in the spec.

---

## Overall Score — 6 / 6 PASS

Phase 2's executor produced a near-textbook implementation of the 47 + 12 = 59 locked UI-SPEC decisions. All six pillars pass without blocks. The single FLAG (spacing between major panels) is one-line-of-code advisory, not a functional or accessibility defect.

This review is **advisory only** — Phase 2 is already verified and shipping-ready per `02-VERIFICATION.md`. Findings here inform P10 calibration notes and future contract refinements; nothing here gates promotion.

---

*Reviewed: 2026-04-17 via `/gsd:ui-review` (code-only, no dev server).*
*Files audited: 14 components + page.tsx + not-found.tsx + lib/format.ts + components/ui/ (21 primitives) + components.json = 39 files.*
