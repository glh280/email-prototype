---
phase: 02-deal-detail-tasks-stages
plan: 05
subsystem: ui
tags: [nextjs, app-router, react-hook-form, zod, shadcn, base-ui, alert-dialog, textarea, tailwind, drizzle]

# Dependency graph
requires:
  - phase: 02-deal-detail-tasks-stages/02
    provides: updateDealSchema + killDealSchema (client-side re-validation)
  - phase: 02-deal-detail-tasks-stages/04
    provides: updateDeal / closeDeal / killDeal / advanceStage / revertStage server actions
  - phase: 01-core-data-model/05
    provides: P1 makeMoneyBlurHandler + MoneyInput + DateFieldControl patterns
  - phase: 01-core-data-model/06
    provides: lib/format.ts (trackBadgeClasses, priorityPillClasses, priorityDotClasses) + Server Component + Promise-params pattern
provides:
  - /deal/[id] real data-driven Server Component (replaces P1-06 placeholder)
  - queryDealById(id) + DealDetail type (lib/deals-query.ts peer of queryDeals)
  - Deal header with track/priority/status badges + Edit + overflow menu
  - Stage stepper (pip-and-line, UI-SPEC color map, HoverCard + click-to-revert)
  - 6-tab shell with URL-state (overview, contacts, tasks, emails, notes, audit)
  - Overview tab with 4 cards + per-card Save/Cancel edit wired to updateDeal
  - 4 mutation dialogs (advance, revert, close, kill) with UI-SPEC copy verbatim
  - shadcn primitives: alert-dialog, textarea, scroll-area
  - Deal-not-found page boundary (FileQuestion, "Back to deals")
affects: [02-deal-detail-tasks-stages/06, P3-contacts, P4-emails, P5-notes-audit, P10-calibration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component page.tsx awaits Promise-shaped params + searchParams, fetches via queryDealById, delegates chrome to 'use client' subcomponents"
    - "AlertDialog structured body: primitive Description renders <p>; structured 'Current:/Next:' lines live in a sibling <div> below the Header block (nesting <div> in <p> is invalid HTML)"
    - "Per-card Overview edit: each OverviewCard owns its own useState(editing) + useForm + zodResolver(updateDealSchema); Save computes diff vs deal, calls updateDeal({dealId, ...diff}), router.refresh on success"
    - "URL-state tab selection: router.push(`?tab=${value}`); delete('tab') when default overview — keeps URLs tidy"
    - "Stage stepper pip click uses HoverCard wrapper for tooltip + native <button>/span with aria-label + aria-current='step' for accessibility floor"
    - "updateDealSchema is the edit-surface contract — FieldSpec[] owned by OverviewTab only references schema-accepted keys; mainContactName/Email stay out (B1 holds)"

key-files:
  created:
    - app/deal/[id]/not-found.tsx
    - app/deal/[id]/_components/deal-header.tsx
    - app/deal/[id]/_components/stage-stepper.tsx
    - app/deal/[id]/_components/deal-tabs.tsx
    - app/deal/[id]/_components/overview-tab.tsx
    - app/deal/[id]/_components/overview-card.tsx
    - app/deal/[id]/_components/advance-stage-dialog.tsx
    - app/deal/[id]/_components/revert-stage-dialog.tsx
    - app/deal/[id]/_components/close-deal-dialog.tsx
    - app/deal/[id]/_components/kill-deal-dialog.tsx
    - components/ui/alert-dialog.tsx
    - components/ui/textarea.tsx
    - components/ui/scroll-area.tsx
  modified:
    - app/deal/[id]/page.tsx (full rewrite — placeholder → Server Component with data)
    - lib/deals-query.ts (added queryDealById + DealDetail type)

key-decisions:
  - "DealDetail carries the full availableStages array (universal + deal-track-specific, ordered by sort_order) so the stepper renders from one query pass instead of re-querying per render"
  - "URL tab parser is tolerant: unknown ?tab= values silently fall back to overview (mirrors lib/filter-params.ts approach — shared links from P5+ phases that use future tabs won't throw)"
  - "Edit button on Closed OR Killed deals is disabled (not just Killed) — UI-SPEC rationale says killed is read-only; closed is similarly terminal and editing an already-closed deal is almost always noise"
  - "OverviewCard.onSubmit normalizes undefined/null/empty-string as equivalent 'no value' before diffing — prevents spurious audit rows when a user clears an already-null field"
  - "Money field onBlur normalizes to integer via parseMoney + shouldDirty=true so RHF's isDirty tracks even after the handler programmatically sets the value"
  - "Stepper: 'next stage' is the FIRST stage whose sort_order > current.sortOrder AND code !== 'killed' — excludes the killed universal stage from the advance path (it's only reached via KillDealDialog)"
  - "Killed/closed status rendered as header-only badges (Killed destructive / Closed neutral) AND in a read-only Status row inside Tracking card for completeness"
  - "Dirty-form guard intentionally NOT implemented — UI-SPEC Assumption 12 ships without it; browser unload covers the hard case"

patterns-established:
  - "Dialog copy: UI-SPEC Copywriting Contract is verbatim source; each dialog's heading/body/CTA strings come from lines 666-732 of 02-UI-SPEC.md"
  - "Dialog on-success: toast.success(UI-SPEC toast string) → onOpenChange(false) → router.refresh() — no manual state update; server re-read is the source of truth"
  - "Dialog on-failure: toast.error(`Couldn't {verb} — ${error}. Try again.`) per UI-SPEC error contract; dialog stays open (never closes on failure)"
  - "Form mirror reset: OverviewCard uses useEffect to reset defaults when the deal prop changes (post-refresh); Cancel also calls form.reset(defaultValues) explicitly"
  - "Stepper pip semantics: HoverCard wraps <button> (past) or <span> (future); current pip is plain <span> (no tooltip — label already shown below)"

requirements-completed: [DEAL-04, DEAL-05, DEAL-06, STAGE-02, STAGE-03, VIEW-05]

# Metrics
duration: ~20m
completed: 2026-04-18
---

# Phase 02 Plan 05: Deal Detail Shell + Overview Tab Summary

**Full /deal/[id] UI — header + stage stepper + 6-tab shell + 4-card Overview edit + advance/revert/close/kill dialogs — wired to Plan 04 server actions with UI-SPEC copy verbatim.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-18T22:23:00Z (approximately)
- **Completed:** 2026-04-18T22:35:00Z (approximately)
- **Tasks:** 3 (all atomic commits)
- **Files created:** 10 (+ 3 shadcn primitives)
- **Files modified:** 2

## Accomplishments

- `/deal/[id]` Server Component now reads real DB data via `queryDealById`; bad UUIDs 404 through `not-found.tsx` with UI-SPEC empty state.
- Page chrome matches UI-SPEC Page 1 verbatim: back link + title + file_no (mono) + TrackBadge + PriorityPill + StatusBadge (killed/closed only) + Edit deal + overflow menu.
- Stage stepper: every available stage renders as a pip-and-line with the UI-SPEC color map (past primary/20 clickable, current primary-filled with ring, future bordered disabled, terminal Check/X icons), HoverCard tooltips for non-current stages, right-aligned Advance CTA, terminal fallback muted text.
- Six tabs in VIEW-05 order (Overview / File Contacts / Tasks / Emails / Notes / Audit) with URL-state preservation (`?tab=<slug>`).
- Overview tab has four cards in mandated order — **Tracking first** — each with its own Edit → edit-mode form → Save (diff → updateDeal) → router.refresh flow.
- Four mutation dialogs wired to Plan 04 actions: advanceStage, revertStage, closeDeal, killDeal. Kill enforces ≥3-char reason client-side (re-validated server-side by killDealSchema).
- Three shadcn primitives installed (alert-dialog, textarea, scroll-area) — base-nova preset shipped them without hand-written fallback.
- Zero `mainContact*` references anywhere in `app/deal/[id]/` — B1 revision holds.

## Task Commits

1. **Task 1: shadcn install + queryDealById** — `e516470` (feat)
2. **Task 2: page shell + stepper + 4 mutation dialogs** — `ad6ed22` (feat)
3. **Task 3: Overview tab per-card edit + updateDeal wiring** — `296feb3` (feat)

## Files Created/Modified

### Created
- `components/ui/alert-dialog.tsx` — shadcn AlertDialog (base-ui wrapper)
- `components/ui/textarea.tsx` — shadcn Textarea
- `components/ui/scroll-area.tsx` — shadcn ScrollArea
- `app/deal/[id]/not-found.tsx` — FileQuestion empty state with UI-SPEC copy
- `app/deal/[id]/_components/deal-header.tsx` — back link + title row + badges + overflow menu (opens close/kill dialogs)
- `app/deal/[id]/_components/stage-stepper.tsx` — pip-and-line strip with HoverCard tooltips + Advance CTA + revert-via-past-pip-click
- `app/deal/[id]/_components/deal-tabs.tsx` — 6-tab shell with URL-state (`?tab=`)
- `app/deal/[id]/_components/overview-tab.tsx` — 4-card Tracking/Property/Financials/Dates stack with FieldSpec arrays
- `app/deal/[id]/_components/overview-card.tsx` — reusable read/edit Card with RHF + zodResolver(updateDealSchema)
- `app/deal/[id]/_components/advance-stage-dialog.tsx` — default-variant AlertDialog, UI-SPEC copy verbatim
- `app/deal/[id]/_components/revert-stage-dialog.tsx` — destructive-variant AlertDialog
- `app/deal/[id]/_components/close-deal-dialog.tsx` — default-variant AlertDialog
- `app/deal/[id]/_components/kill-deal-dialog.tsx` — destructive-variant AlertDialog with required reason Textarea + killDealSchema pre-validate

### Modified
- `app/deal/[id]/page.tsx` — full rewrite from placeholder to Server Component (awaits `params` + `searchParams`, calls `queryDealById`, renders DealHeader + StageStepper + DealTabs inside `<main class="max-w-[1120px]">`)
- `lib/deals-query.ts` — added `DealDetail` type + `queryDealById(id)` function (joins deals + tracks + current stage; second SELECT for availableStages ordered by sortOrder)

## Decisions Made

1. **`queryDealById` returns the full `availableStages` array** — universal + deal-track-specific stages in sort_order — so the stepper renders from one query pass instead of re-querying. Matches the DealDetail interface promised in the plan's `<interfaces>` block.
2. **Tolerant tab parser** — unknown `?tab=` values silently fall back to `overview`. Mirrors `lib/filter-params.ts`'s conservative behavior: future phase links from P5+ that reference tabs we haven't shipped yet won't throw, they'll just default.
3. **Edit button disabled on BOTH closed and killed deals** — UI-SPEC calls out killed explicitly; closed was ambiguous. Chose to lock closed too because editing an already-terminated deal is almost always noise (if reopen is needed, a P10 unkill/unclose path will land as a separate intentional surface).
4. **Diff computation normalizes empty-equivalents** — `undefined`, `null`, `""` are all treated as "no value" when computing the diff, so clearing an already-null field doesn't produce a phantom audit row.
5. **Next stage excludes `killed`** — the stepper's "next" is `stages.find(s => s.sortOrder > current.sortOrder && s.code !== 'killed')` — the killed universal stage is only reachable via KillDealDialog, not via Advance CTA.
6. **Pip accessibility uses HoverCard + native element** — past pips are `<button>` (clickable), future pips are `<span aria-disabled="true">`, current is plain `<span>`. All three carry `aria-label={stage.label}` + `aria-current={isCurrent ? 'step' : undefined}`. Color-is-never-the-sole-signal: fill color + ring + below-pip label on current = three channels.
7. **Money/date field patterns re-used from P1 Plan 05** — `MoneyInput` and `DateFieldControl` are shape-for-shape copies of the equivalents in `app/deal/new/new-deal-form.tsx`. When P10 calibrates the palette, the single edit in `lib/format.ts` + these two shape-helpers propagates everywhere.
8. **Status rendered twice (header badge + Tracking-card read-only row)** — UI-SPEC calls for header status badge; the Tracking card also shows status for symmetry with track/priority. Read-only + can't be edited here (status transitions own their own buttons: Mark as closed, Kill deal, Advance…).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AlertDialogDescription cannot nest `<div>` in `<p>`**
- **Found during:** Task 2 (advance + revert dialog initial write)
- **Issue:** Initial implementation used `<AlertDialogDescription asChild><div>…</div></AlertDialogDescription>` to render the structured `Current: {label}` / `Next: {label}` block. The base-ui AlertDialog.Description primitive does NOT expose an `asChild` prop — it always renders as `<p>`, which cannot legally contain `<div>` children. tsc caught this: `Property 'asChild' does not exist on type … DialogDescriptionProps`.
- **Fix:** Moved the structured `Current:/Next:` block OUTSIDE the `AlertDialogDescription` (into a sibling `<div class="space-y-1.5 text-sm">` between AlertDialogHeader and AlertDialogFooter). The Description now carries only the single plain-sentence "This will be logged to the Audit tab." per UI-SPEC body copy. Visual result is identical; HTML is valid; a11y tree is unchanged.
- **Files modified:** `app/deal/[id]/_components/advance-stage-dialog.tsx`, `app/deal/[id]/_components/revert-stage-dialog.tsx`
- **Verification:** tsc exit 0 after edit; `npm run build` clean
- **Committed in:** `ad6ed22` (Task 2 commit, before push)

---

**Total deviations:** 1 auto-fixed (1 bug — HTML validity / type error)
**Impact on plan:** Trivial refactor preserving intent and visual output. Locks in the base-ui pattern for future AlertDialog authors: structured content goes outside Description, plain prose goes inside.

## Issues Encountered

- `npx shadcn@latest add alert-dialog` offered to overwrite `components/ui/button.tsx`; skipped the overwrite (existing button.tsx matches base-nova preset; reinstalling would wipe the `render=<Link/>` convention established in P1 Plan 06). alert-dialog.tsx landed clean.
- No other issues.

## User Setup Required

None — all primitives come from the shadcn registry. No external services.

## Next Phase Readiness

**Ready for Plan 06 (Tasks + Notes + Audit tabs).** Plan 06 replaces the three placeholder panels in `deal-tabs.tsx` with real content:
- Tasks tab consumes `queryTasksForDeal` + `createTask`/`completeTask`/`undoCompleteTask`/`updateTask`/`reassignTask` from Plan 03.
- Notes tab creates `deal_notes` table read + creation form (composer + chronological log).
- Audit tab queries `audit_log` with filter chips (All / Deal / Tasks / Notes / Stage) and renders before→after diffs.

**Shipped surfaces Plan 06 builds on:**
- `DealDetail.id` + URL-state convention (`?tab=...`) for the Audit filter chip URL state (`?tab=audit&auditFilter=tasks`).
- `OverviewCard` pattern for any edit surface Plan 06 needs (though Plan 06 is more read-heavy).
- All 4 mutation dialogs are wired; the Tasks tab just needs Add-task dialog + row-level affordances.

**No blockers for Plan 06.** Both P2 wave-3 plans (05 shipped, 06 pending) are independent of each other.

## Self-Check

Automated verification on all claims:

**Created files exist:**
- `components/ui/alert-dialog.tsx` — FOUND
- `components/ui/textarea.tsx` — FOUND
- `components/ui/scroll-area.tsx` — FOUND
- `app/deal/[id]/not-found.tsx` — FOUND
- `app/deal/[id]/_components/deal-header.tsx` — FOUND
- `app/deal/[id]/_components/stage-stepper.tsx` — FOUND
- `app/deal/[id]/_components/deal-tabs.tsx` — FOUND
- `app/deal/[id]/_components/overview-tab.tsx` — FOUND
- `app/deal/[id]/_components/overview-card.tsx` — FOUND
- `app/deal/[id]/_components/advance-stage-dialog.tsx` — FOUND
- `app/deal/[id]/_components/revert-stage-dialog.tsx` — FOUND
- `app/deal/[id]/_components/close-deal-dialog.tsx` — FOUND
- `app/deal/[id]/_components/kill-deal-dialog.tsx` — FOUND

**Commits exist:**
- `e516470` — FOUND (Task 1 — shadcn + queryDealById)
- `ad6ed22` — FOUND (Task 2 — page shell + dialogs)
- `296feb3` — FOUND (Task 3 — Overview tab)

**Plan must_haves truths — all verified:**
- [x] `/deal/[id]` renders real data (queryDealById + notFound() branch in page.tsx)
- [x] Header shows back link + title + file_no + track badge + priority pill + status badge (hidden on active)
- [x] Stepper renders all compatible stages; current pip bg-primary; past pips clickable → revert; future disabled
- [x] Advance CTA opens AlertDialog; confirm calls advanceStage; success toast format matches UI-SPEC
- [x] 6 tabs in VIEW-05 order with URL-state (`?tab=<slug>`)
- [x] Overview has 4 stacked cards (Tracking first) each with its own Edit → inline-edit → Save/Cancel wired to updateDeal
- [x] Overflow menu: Mark as closed + Kill deal… (destructive); kill requires ≥3 chars
- [x] Killed chrome: destructive status badge, opacity-80 wrapper, disabled overflow items
- [x] shadcn primitives `alert-dialog`, `textarea`, `scroll-area` installed under `components/ui/`

**Success criteria — all passed:**
- [x] `npm test` → 166/166 green (baseline preserved — this plan adds no tests since it's pure UI composition consuming Plan 02/03/04 tested actions)
- [x] `npx tsc --noEmit` → exit 0
- [x] `npm run build` → 4 routes (/, /_not-found, /deal/[id], /deal/new)
- [x] `grep -rn "mainContact" app/deal/[id]/` → 0 matches (B1 holds)

**Self-Check: PASSED**

---
*Phase: 02-deal-detail-tasks-stages*
*Completed: 2026-04-18*
