---
phase: 02-deal-detail-tasks-stages
plan: 05
type: execute
wave: 3
depends_on: [02-deal-detail-tasks-stages/01, 02-deal-detail-tasks-stages/02, 02-deal-detail-tasks-stages/03, 02-deal-detail-tasks-stages/04]
files_modified:
  - app/deal/[id]/page.tsx
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
  - lib/deals-query.ts
  - components/ui/alert-dialog.tsx
  - components/ui/textarea.tsx
  - components/ui/scroll-area.tsx
  - package.json
autonomous: true
requirements: [DEAL-04, DEAL-05, DEAL-06, STAGE-02, STAGE-03, VIEW-05]
requirements_addressed: [DEAL-04, DEAL-05, DEAL-06, STAGE-02, STAGE-03, VIEW-05]

must_haves:
  truths:
    - "Route `/deal/[id]` renders real deal data fetched via queryDealById (no placeholder text); returns not-found 404 for bad uuids"
    - "Page header displays: back link 'Back to deals', title (H1), file_no (mono), TrackBadge, PriorityPill, StatusBadge (hidden when status='active')"
    - "Stage stepper renders all universal + track-specific stages in sort_order; current pip is bg-primary; past pips clickable → revert dialog; future pips disabled"
    - "`Advance to {next.label} →` CTA sits under stepper; clicking opens AlertDialog; confirming calls advanceStage server action; success toast `Advanced to {next.label}.`"
    - "Tab strip renders 6 tabs per VIEW-05 order: Overview, File Contacts, Tasks, Emails, Notes, Audit — URL state `?tab=<slug>` preserved on navigation"
    - "Overview tab shows 4 stacked Cards (Tracking / Property / Financials / Dates & Gates); each card has its own Edit → inline-edit → Save/Cancel state; Save calls updateDeal with the diff"
    - "Overflow menu (MoreHorizontal) shows 'Mark as closed' and 'Kill deal…'; kill opens dialog with required reason Textarea (disabled until ≥ 3 chars); close opens simpler confirm"
    - "Killed deal chrome: destructive-color status badge, opacity-80 on body text, overflow menu shows 'Deal is killed' disabled item, Advance CTA hidden"
    - "Shadcn primitives `alert-dialog`, `textarea`, `scroll-area` installed via shadcn CLI and available under components/ui/"
  artifacts:
    - path: "app/deal/[id]/page.tsx"
      provides: "Server Component; resolves params, calls queryDealById, renders header + stepper + tabs shell"
      exports: ["default"]
    - path: "app/deal/[id]/not-found.tsx"
      provides: "Next.js not-found page with 'Deal not found' empty state"
    - path: "app/deal/[id]/_components/deal-header.tsx"
      provides: "Header row (H1 + file_no + badges + overflow menu); client component"
    - path: "app/deal/[id]/_components/stage-stepper.tsx"
      provides: "Pip-and-line horizontal stepper + Advance CTA; client component"
    - path: "app/deal/[id]/_components/overview-tab.tsx"
      provides: "4-card overview with per-card edit state"
    - path: "lib/deals-query.ts"
      provides: "Adds queryDealById(id) peer to existing queryDeals — single-deal loader with tracks/stages joins"
      exports: ["queryDeals", "queryDealById", "DealDetail"]
  key_links:
    - from: "app/deal/[id]/page.tsx"
      to: "lib/deals-query.ts::queryDealById"
      via: "server-side fetch inside the async page component"
      pattern: "queryDealById\\("
    - from: "app/deal/[id]/_components/stage-stepper.tsx"
      to: "app/deal/[id]/actions/stages.ts::advanceStage + revertStage"
      via: "startTransition(() => advanceStage({...}))"
      pattern: "advanceStage\\("
    - from: "app/deal/[id]/_components/overview-card.tsx"
      to: "app/deal/[id]/actions/deals.ts::updateDeal"
      via: "form onSubmit → updateDeal(diff)"
      pattern: "updateDeal\\("
    - from: "app/deal/[id]/_components/kill-deal-dialog.tsx"
      to: "app/deal/[id]/actions/deals.ts::killDeal"
      via: "form submit → killDeal({dealId, reason})"
      pattern: "killDeal\\("
---

<objective>
Rebuild `/deal/[id]` as a real data-driven page, replacing the Plan 06 Phase 1 placeholder. Ship header + stage stepper + tabs shell + Overview tab with per-card edit + all four destructive-action dialogs (advance, revert, close, kill). Tasks, Notes, Audit tabs are scaffolded as placeholder panels here and filled in by Plan 06.

This is the UI-heavy plan. Every decision inherits from `02-UI-SPEC.md` — do NOT improvise copy, color, or layout. The spec has 47 decisions locked; stay inside them.

Three new shadcn primitives must be installed: `alert-dialog`, `textarea`, `scroll-area` (see UI-SPEC §Design System). Install first; then compose. The P1 shadcn base-nova convention of `<Button render={<Link />}>` (NOT `asChild`) carries through — links use `render`, nested triggers use `asChild` only if shadcn upstream docs specify it for that primitive.

Purpose: DEAL-04 (tabs rendered), DEAL-05 (Overview edit writes via updateDeal), DEAL-06 (kill dialog), STAGE-02 (advance dialog), STAGE-03 (revert dialog), VIEW-05 (tab order + Tracking-section-first Overview).
Output: working `/deal/[id]` page for Overview + header + stepper + all four mutation dialogs; all copy from UI-SPEC verbatim; Tasks/Notes/Audit tabs are placeholders that Plan 06 replaces.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-deal-detail-tasks-stages/02-CONTEXT.md
@.planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md
@.planning/phases/01-core-data-model/01-UI-SPEC.md

# Patterns this plan must follow:
@app/deal/new/new-deal-form.tsx
@app/deal/new/page.tsx
@app/_components/deals-filter-bar.tsx
@app/_components/deal-row.tsx
@lib/format.ts
@lib/deals-query.ts
@lib/parse-money.ts

# Action modules this UI calls (landed in Wave 2):
@.planning/phases/02-deal-detail-tasks-stages/04-stage-advance-revert-kill-actions.md
@app/deal/[id]/actions/stages.ts
@app/deal/[id]/actions/deals.ts

<interfaces>
From app/deal/[id]/actions/deals.ts (Plan 04):
```typescript
export async function updateDeal(raw: unknown): Promise<{ok:true,noop?:boolean}|{ok:false,errors?:Record<string,string[]>,error?:string}>;
export async function closeDeal(dealId: string): Promise<{ok:true}|{ok:false,error:string}>;
export async function killDeal(raw: unknown): Promise<{ok:true}|{ok:false,error?:string,errors?:Record<string,string[]>}>;
```

From app/deal/[id]/actions/stages.ts (Plan 04):
```typescript
export async function advanceStage(raw: unknown): Promise<{ok:true,toStageCode:string,toStageLabel:string}|{ok:false,error:string}>;
export async function revertStage(raw: unknown): Promise<{ok:true,...}|{ok:false,error:string}>;
```

From lib/deals-query.ts (extended in this plan):
```typescript
export type DealDetail = {
  id: string;
  fileNo: string;
  title: string;
  priority: "HIGH"|"MEDIUM"|"LOW";
  status: "active"|"closed"|"killed";
  trackId: string; trackCode: string; trackLabel: string;
  currentStage: { id: string; code: string; label: string; sortOrder: number; isTerminal: boolean; trackId: string | null };
  availableStages: Array<{ id: string; code: string; label: string; sortOrder: number; isTerminal: boolean; trackId: string | null }>; // universal + track-specific
  /* ...all editable deals columns (propertyAddress, salesPrice, closingAt, etc.) */
  killedAt: Date | null;
  killReason: string | null;
};
export async function queryDealById(id: string): Promise<DealDetail | null>;
```

Copy contract — USE THESE STRINGS VERBATIM (from UI-SPEC §Copywriting Contract, lines 666-732):
- Back link: `Back to deals`
- Edit-deal button: `Edit deal`  (header — Phase 2 can route to per-card edits; this button toggles all cards to edit mode if desired — see UI-SPEC Assumption 9 `Ship` decision; per-card edit is the primary pattern)
- Advance CTA: `Advance to {next.label} →`
- Advance dialog heading: `Advance milestone?`
- Advance confirm CTA: `Advance to {next.label}`
- Advance success toast: `Advanced to {next.label}.`
- Revert dialog heading: `Revert milestone to {target.label}?`
- Revert confirm CTA: `Revert to {target.label}`
- Revert success toast: `Reverted to {target.label}.`
- Close dialog heading: `Mark deal as closed?`
- Close confirm CTA: `Mark as closed`
- Close success toast: `Deal closed.`
- Kill dialog heading: `Kill this deal?`
- Kill reason label: `Reason (required)`
- Kill confirm CTA: `Kill deal`
- Kill success toast: `Deal killed.`
- Cancel: `Cancel`
- Overview section titles: `Tracking` / `Property` / `Financials` / `Dates & Gates`
- Overview Edit button: `Edit`
- Overview Cancel / Save: `Cancel` / `Save changes`
- Overview save toast: `Changes saved.`
- Quick note placeholder: `A short note to surface on the list view.`
- Tab triggers: `Overview` / `File Contacts` / `Tasks` / `Emails` / `Notes` / `Audit`
- Deal-not-found heading: `Deal not found`
- Deal-not-found body: `It might have been killed or the link is stale.`
- Deal-not-found CTA: `Back to deals`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install shadcn alert-dialog + textarea + scroll-area; extend lib/deals-query.ts with queryDealById</name>
  <files>components/ui/alert-dialog.tsx, components/ui/textarea.tsx, components/ui/scroll-area.tsx, lib/deals-query.ts, package.json</files>
  <read_first>
    - components/ui/dialog.tsx (existing — alert-dialog will live alongside)
    - components/ui/input.tsx (pattern for a simple primitive)
    - lib/deals-query.ts (extend — don't rewrite; queryDeals stays)
    - db/schema/app.ts (for the DealDetail shape)
    - .planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md line 56-59 (primitives to install + install commands verbatim)
  </read_first>
  <action>
    Run the three shadcn install commands from UI-SPEC (base-nova preset is already initialized from P1):
    ```bash
    npx shadcn@latest add alert-dialog
    npx shadcn@latest add textarea
    npx shadcn@latest add scroll-area
    ```

    VERIFY the three files landed under `components/ui/`. If the CLI asks an overwrite prompt (it should not — these are new), decline to overwrite existing primitives.

    If the base-nova preset does NOT ship one of the three primitives out-of-the-box (see P1 plan 05's manual shadcn Form primitive hand-write — same thing may be needed here), fall back to hand-writing the primitive by adapting the shadcn/ui upstream source to base-ui, following P1's `components/ui/form.tsx` as the template. Document the situation in the commit message.

    Extend `lib/deals-query.ts`. APPEND (do not modify existing `queryDeals`) a new export `queryDealById(id: string): Promise<DealDetail | null>`:

    ```typescript
    export type DealDetail = {
      id: string;
      fileNo: string;
      title: string;
      priority: "HIGH" | "MEDIUM" | "LOW";
      status: "active" | "closed" | "killed";
      // Track + current stage (joined)
      trackId: string;
      trackCode: string;
      trackLabel: string;
      currentStage: {
        id: string;
        code: string;
        label: string;
        sortOrder: number;
        isTerminal: boolean;
        trackId: string | null;
      };
      // All stages applicable to this deal (universal + deal.track_id-specific), for the stepper
      availableStages: Array<{
        id: string;
        code: string;
        label: string;
        sortOrder: number;
        isTerminal: boolean;
        trackId: string | null;
      }>;
      // All editable deals columns
      propertyAddress: string | null;
      propertyState: string | null;
      propertyType: string | null;
      salesPrice: number | null;
      loanType: string | null;
      transactionType: string | null;
      loanAmount: number | null;
      estimatedDown: number | null;
      earnestMoney: number | null;
      estRehab: number | null;
      arv: number | null;
      titleCtc: boolean;
      lenderCtc: boolean;
      titleFileNo: string | null;
      loanNo: string | null;
      quickNote: string | null;
      openedAt: Date;
      closingAt: Date | null;
      fundingAt: Date | null;
      closedAt: Date | null;
      killedAt: Date | null;
      killReason: string | null;
      createdAt: Date;
      updatedAt: Date;
      internalOwner: string | null;
      createdBy: string;
    };

    export async function queryDealById(id: string): Promise<DealDetail | null> {
      // 1. SELECT deal joined with tracks + stages (current stage)
      //    .leftJoin(tracks, eq(tracks.id, deals.trackId))
      //    .leftJoin(stages, eq(stages.id, deals.stageId))
      //    .where(eq(deals.id, id)).limit(1)
      // 2. If no row, return null
      // 3. SELECT all stages WHERE track_id IS NULL OR track_id = deal.trackId ORDER BY sort_order
      // 4. Assemble DealDetail; return
    }
    ```

    Implementation uses Drizzle's standard leftJoin pattern — match `queryDeals` style. Return `null` for not-found rather than throwing, so the page component can call `notFound()` from `next/navigation`.

    Commit: `feat(02-05): shadcn alert-dialog/textarea/scroll-area + queryDealById`.
  </action>
  <verify>
    <automated>ls components/ui/alert-dialog.tsx components/ui/textarea.tsx components/ui/scroll-area.tsx 2>&1; grep -c "export async function queryDealById" lib/deals-query.ts; npx tsc --noEmit 2>&1 | grep -E "(error|TS)" || echo "tsc clean"</automated>
  </verify>
  <acceptance_criteria>
    - `components/ui/alert-dialog.tsx` exists
    - `components/ui/textarea.tsx` exists
    - `components/ui/scroll-area.tsx` exists
    - `grep -c "export async function queryDealById" lib/deals-query.ts` returns 1
    - `grep -c "export type DealDetail" lib/deals-query.ts` returns 1
    - `grep -c "export async function queryDeals" lib/deals-query.ts` returns 1 (P1 export preserved)
    - `npx tsc --noEmit` exit 0
  </acceptance_criteria>
  <done>Three shadcn primitives available; DealDetail type + queryDealById exported; tsc clean.</done>
</task>

<task type="auto">
  <name>Task 2: Build page.tsx + not-found.tsx + header + stepper + tabs shell + four mutation dialogs</name>
  <files>app/deal/[id]/page.tsx, app/deal/[id]/not-found.tsx, app/deal/[id]/_components/deal-header.tsx, app/deal/[id]/_components/stage-stepper.tsx, app/deal/[id]/_components/deal-tabs.tsx, app/deal/[id]/_components/advance-stage-dialog.tsx, app/deal/[id]/_components/revert-stage-dialog.tsx, app/deal/[id]/_components/close-deal-dialog.tsx, app/deal/[id]/_components/kill-deal-dialog.tsx</files>
  <read_first>
    - .planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md lines 154-240 (page chrome + header + stepper spec with exact Tailwind classes)
    - .planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md lines 522-618 (all 4 dialog specs — copy verbatim)
    - app/deal/new/page.tsx (Server Component pattern)
    - app/deal/new/new-deal-form.tsx (Client Component pattern — 'use client', useRouter, useTransition)
    - app/_components/deals-filter-bar.tsx (URL-state pattern for tabs)
    - components/app-header.tsx (existing header — reuse at top of page)
    - lib/format.ts (trackBadgeClasses, priorityPillClasses, priorityDotClasses)
    - components/ui/alert-dialog.tsx (from Task 1)
    - components/ui/textarea.tsx (from Task 1)
  </read_first>
  <action>
    **`app/deal/[id]/page.tsx`** (Server Component):

    ```typescript
    import { notFound } from "next/navigation";
    import { AppHeader } from "@/components/app-header";
    import { queryDealById } from "@/lib/deals-query";
    import { DealHeader } from "./_components/deal-header";
    import { StageStepper } from "./_components/stage-stepper";
    import { DealTabs } from "./_components/deal-tabs";

    export default async function DealDetailPage({
      params,
      searchParams,
    }: {
      params: Promise<{ id: string }>;
      searchParams: Promise<{ tab?: string; auditFilter?: string }>;
    }) {
      const { id } = await params;
      const sp = await searchParams;
      const deal = await queryDealById(id);
      if (!deal) notFound();
      const activeTab = sp.tab ?? "overview";
      return (
        <>
          <AppHeader />
          <main className="mx-auto max-w-[1120px] px-6 py-6">
            <DealHeader deal={deal} />
            <StageStepper deal={deal} />
            <DealTabs deal={deal} activeTab={activeTab} />
          </main>
        </>
      );
    }
    ```

    Next.js 16 has Promise-shaped `params` / `searchParams` — the P1 list view `app/page.tsx` shows the exact pattern; consult `node_modules/next/dist/docs/` for any detail (per AGENTS.md).

    **`app/deal/[id]/not-found.tsx`**: renders the deal-not-found empty state per UI-SPEC lines 636-640 (FileQuestion icon 48px, `Deal not found` heading, body copy, `Back to deals` outline button). Use `<Button variant="outline" render={<Link href="/" />}>Back to deals</Button>` (base-nova pattern).

    **`app/deal/[id]/_components/deal-header.tsx`** ('use client'):
    - Renders back-link + H1 + file_no + TrackBadge + PriorityPill + StatusBadge (hidden on 'active')
    - Right side: `<Button variant="outline" size="sm">Edit deal</Button>` + DropdownMenu (MoreHorizontal) with items:
      - `Mark as closed` → opens CloseDealDialog
      - `Kill deal…` → opens KillDealDialog (class="text-destructive")
      - When status='killed' or 'closed': both items become `Deal is killed` / `Deal is closed` (disabled)
    - Use existing `lib/format.ts::trackBadgeClasses` + `priorityPillClasses` (do NOT reinvent)

    **`app/deal/[id]/_components/stage-stepper.tsx`** ('use client'):
    - Horizontal strip: pip-and-line pattern per UI-SPEC lines 198-220
    - Pip diameter 20px (w-5 h-5 rounded-full)
    - States per UI-SPEC lines 141-149 stepper color mapping table (Past: bg-primary/20; Current: bg-primary + ring-2 ring-primary/30 ring-offset-2; Future: bg-background ring-1 ring-border; Terminal reached: filled with Check or X icon)
    - Past pips: `<button onClick={() => setRevertTarget(stage)}>` opens RevertStageDialog
    - Future pips: disabled
    - Current pip label rendered below in `text-xs font-semibold`; past/future labels on HoverCard
    - Below stepper, right-aligned: `<Button>Advance to {next.label} →</Button>` → opens AdvanceStageDialog
    - When current.isTerminal: hide Advance CTA, show `text-sm text-muted-foreground` reading `Deal in terminal stage — {stage.label}`

    **`app/deal/[id]/_components/deal-tabs.tsx`** ('use client'):
    - Use `shadcn/ui Tabs` primitive
    - 6 TabsTrigger in VIEW-05 order: Overview / File Contacts / Tasks / Emails / Notes / Audit
    - Active triggers `text-foreground font-semibold` + 2px primary underline
    - On trigger click, `router.push(new URL with ?tab=...)` (URL-state pattern from `lib/filter-params.ts` — follow the same shape)
    - TabsContent:
      - `overview` → `<OverviewTab deal={deal} />` (from Task 3)
      - `contacts` → File Contacts placeholder empty state (UI-SPEC lines 306-316)
      - `tasks` → Tasks placeholder (`<TasksTabPlaceholder />` — Plan 06 replaces)
      - `emails` → Mail-icon empty state (UI-SPEC)
      - `notes` → Notes placeholder (Plan 06 replaces)
      - `audit` → Audit placeholder (Plan 06 replaces)

    **Four dialog components** — each is a Client Component that receives `open`, `onOpenChange`, `deal`, optional `target` props. All use shadcn `AlertDialog` (role='alertdialog'). All copy from UI-SPEC §Copywriting Contract verbatim.

    **`advance-stage-dialog.tsx`**:
    - AlertDialogHeader: `Advance milestone?`
    - Body: `Current: {current.label}` / `Next: {next.label}` / `This will be logged to the Audit tab.`
    - Footer: `Cancel` (AlertDialogCancel) + `Advance to {next.label}` (AlertDialogAction, variant='default')
    - onConfirm: `startTransition(async () => { const r = await advanceStage({dealId, targetStageId}); if (r.ok) { toast.success(\`Advanced to \${r.toStageLabel}.\`); onOpenChange(false); router.refresh(); } else { toast.error(\`Couldn't advance — \${r.error}. Try again.\`); } })`

    **`revert-stage-dialog.tsx`**: destructive variant. `Revert milestone to {target.label}?` heading. Destructive confirm CTA `Revert to {target.label}`. Body: `Current: {current.label}` / `Target: {target.label}` / `Revert is also logged to the Audit tab. Use this sparingly — stage changes are intended to move forward.` Toast: `Reverted to {target.label}.`

    **`close-deal-dialog.tsx`**: default variant. `Mark deal as closed?` heading. `Mark as closed` confirm. Body: `The deal stays visible in the list but is marked complete. This is logged to the Audit tab.` Toast: `Deal closed.`

    **`kill-deal-dialog.tsx`**: destructive variant. Contains a `<Textarea>` for reason (UI-SPEC lines 585-593 — 4 rows, label `Reason (required)`, placeholder none, `required`). Submit button disabled until `reason.trim().length >= 3`. Use `killDealSchema.safeParse` on submit client-side for immediate feedback; server re-validates. Heading: `Kill this deal?`. Confirm CTA: `Kill deal` (destructive). Toast: `Deal killed.`

    **Accessibility floor** (UI-SPEC lines 770-783):
    - Every pip has `aria-label={stage.label}` and `aria-current={isCurrent ? 'step' : undefined}`
    - Clickable past pips: `role="button"`, `tabIndex={0}`, Enter/Space triggers onClick
    - AlertDialogs inherit role='alertdialog' from primitive; primary CTA gets focus on open (shadcn default)

    Run `npm run build` — the route must compile. Run the dev server and navigate to a real deal id — page must render (Overview still shows placeholder from Task 3; Tasks/Notes/Audit panels are placeholders Plan 06 replaces).

    Commit: `feat(02-05): deal-detail page shell + stepper + 4 mutation dialogs`.
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -10; npx tsc --noEmit 2>&1 | grep -E "(error|TS)" || echo "tsc clean"; ls app/deal/[id]/_components/ 2>&1</automated>
  </verify>
  <acceptance_criteria>
    - `app/deal/[id]/page.tsx` contains `queryDealById` call and `notFound()` branch
    - `grep -c "notFound()" app/deal/[id]/page.tsx` returns 1
    - `app/deal/[id]/not-found.tsx` exists with `Deal not found` heading
    - All 7 `_components/*.tsx` files exist
    - `grep -c "'use client'" app/deal/[id]/_components/deal-header.tsx` returns 1
    - `grep -c "AlertDialog" app/deal/[id]/_components/advance-stage-dialog.tsx` ≥ 1
    - `grep -c "AlertDialog" app/deal/[id]/_components/kill-deal-dialog.tsx` ≥ 1
    - `grep -c "Textarea" app/deal/[id]/_components/kill-deal-dialog.tsx` ≥ 1
    - `grep -c "Advance to" app/deal/[id]/_components/advance-stage-dialog.tsx` ≥ 1
    - `grep -c "Kill deal" app/deal/[id]/_components/kill-deal-dialog.tsx` ≥ 1
    - `grep -c "File Contacts\\|Overview\\|Tasks\\|Emails\\|Notes\\|Audit" app/deal/[id]/_components/deal-tabs.tsx` ≥ 6
    - `grep -c "aria-current" app/deal/[id]/_components/stage-stepper.tsx` ≥ 1
    - `grep -c "aria-label" app/deal/[id]/_components/stage-stepper.tsx` ≥ 1
    - `npm run build` exit 0; route `/deal/[id]` appears in build output
    - `npx tsc --noEmit` exit 0
  </acceptance_criteria>
  <done>Deal detail route renders real data; stepper + 4 dialogs wired to Plan 04 actions; all 6 tabs visible; not-found 404 handled; build green.</done>
</task>

<task type="auto">
  <name>Task 3: Build overview-tab + overview-card (per-card edit pattern wired to updateDeal)</name>
  <files>app/deal/[id]/_components/overview-tab.tsx, app/deal/[id]/_components/overview-card.tsx</files>
  <read_first>
    - .planning/phases/02-deal-detail-tasks-stages/02-UI-SPEC.md lines 240-302 (Overview 4-section spec + edit-mode UX + copy contract)
    - app/deal/new/new-deal-form.tsx (RHF + zodResolver + makeMoneyBlurHandler pattern — ALL reusable)
    - lib/deal-schema.ts (updateDealSchema from Plan 02 — this is the validator)
    - lib/parse-money.ts + lib/format.ts
    - components/ui/form.tsx + components/ui/input.tsx + components/ui/card.tsx
  </read_first>
  <action>
    **`app/deal/[id]/_components/overview-tab.tsx`** ('use client'):
    - Renders 4 stacked `<OverviewCard>` components in VIEW-05-mandated order: Tracking / Property / Financials / Dates & Gates (Tracking FIRST per VIEW-05)
    - `space-y-4` between cards (16 px gap per UI-SPEC)
    - Passes `deal` to each card + the list of fields that card owns

    **`app/deal/[id]/_components/overview-card.tsx`** (a reusable, parameterized card):
    - Props: `{ title: string, deal: DealDetail, fields: FieldSpec[] }` where `FieldSpec = { key: keyof DealDetail, label: string, kind: 'text'|'money'|'date'|'bool'|'select', options?: string[] }`
    - Two modes: `read` (default) and `edit` (set by internal state)
    - Read mode: render `<CardHeader>` with title + `<Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>`; body is `<dl class="grid grid-cols-[140px_1fr] gap-y-3 gap-x-4">` with `<dt class="text-xs font-medium text-muted-foreground">{label}</dt><dd class="text-sm font-mono">{value || em-dash}</dd>` per UI-SPEC lines 270-276
    - Edit mode: header shows just title (no Edit button); body becomes a `<Form>` (react-hook-form + zodResolver(updateDealSchema)) with input controls replacing `<dd>`:
      - `kind: 'text'` → `<Input>`
      - `kind: 'money'` → `<Input>` with $-prefix styling + `onBlur={makeMoneyBlurHandler(field)}` exactly as P1 plan 05's form (import pattern from `app/deal/new/new-deal-form.tsx`)
      - `kind: 'date'` → Popover + Calendar (P1 pattern)
      - `kind: 'bool'` → `<Checkbox>`
      - `kind: 'select'` → `<Select>` with provided options
    - Card footer in edit mode: `<Button variant="ghost">Cancel</Button>` `<Button type="submit">Save changes</Button>`
    - onSubmit: compute the diff (only fields that changed vs `deal`), call `updateDeal({...diff})`:
      ```typescript
      startTransition(async () => {
        const result = await updateDeal({ /* diff only */ });
        if (result.ok) {
          toast.success("Changes saved.");
          setEditing(false);
          router.refresh();
        } else if ("errors" in result && result.errors) {
          // Apply field errors to form (setError per field key)
        } else {
          toast.error(`Couldn't save — ${result.error ?? "unknown"}. Try again.`);
        }
      });
      ```
    - On cancel: reset form to `deal`, exit edit mode
    - Validation: inherited from `zodResolver(updateDealSchema)` — inline per-field errors on blur

    **Field definitions** per UI-SPEC §Overview sections (lines 260-266):
    1. **Tracking card** fields: `priority` (select HIGH|MEDIUM|LOW), `quickNote` (text — UI-SPEC actually calls this an "inline-editable textarea with auto-save on blur"; for Phase 2 ship it inside the card's edit mode with Save/Cancel — auto-save-on-blur is the spec's ideal but the per-card Save/Cancel pattern is the locked UI-SPEC Assumption 1). Track + status render read-only (badges).
    2. **Property card** fields: propertyAddress (text), propertyState (text, 2-letter), propertyType (select), titleFileNo (text), loanNo (text)
    3. **Financials card** fields: salesPrice (money), loanAmount (money), estimatedDown (money), earnestMoney (money), estRehab (money), arv (money), loanType (select), transactionType (select)
    4. **Dates & Gates card** fields: closingAt (date), fundingAt (date), titleCtc (bool), lenderCtc (bool). openedAt + closedAt render READ-ONLY (no edit state — opened is on-insert, closed is set by close action). killedAt + killReason render READ-ONLY when status='killed' (derived; user cannot undo kill via Overview — revert is a separate surface per P10 backlog).

    **Labels verbatim from UI-SPEC line 301**: `Sales Price` / `Loan Amount` / `Estimated Down` / `Earnest Money` / `Est. Rehab` / `ARV` / `Closing Date` / `Funding Date` / `Title CTC` / `Lender CTC`.

    **Killed-deal handling**: when `deal.status === 'killed'`, the `<Button>Edit</Button>` on every card becomes `disabled` (opacity-80 wrapper per UI-SPEC line 195).

    Run `npm run build` and test locally by navigating to a real deal (use a seeded test deal or create one via `/deal/new`). Verify:
    - All 4 cards render in correct order (Tracking first!)
    - Clicking Edit switches that card to edit mode
    - Typing in a money field + blurring normalizes to integer USD via parseMoney
    - Save Changes calls updateDeal; toast fires; card re-renders with new values
    - Cancel discards changes

    Commit: `feat(02-05): overview tab with per-card edit + updateDeal wiring`.
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -10; npx tsc --noEmit 2>&1 | grep -E "(error|TS)" || echo "tsc clean"</automated>
  </verify>
  <acceptance_criteria>
    - `app/deal/[id]/_components/overview-tab.tsx` and `overview-card.tsx` exist
    - `grep -c "'use client'" app/deal/[id]/_components/overview-card.tsx` returns 1
    - `grep -c "Tracking" app/deal/[id]/_components/overview-tab.tsx` ≥ 1
    - `grep -c "Property" app/deal/[id]/_components/overview-tab.tsx` ≥ 1
    - `grep -c "Financials" app/deal/[id]/_components/overview-tab.tsx` ≥ 1
    - `grep -c "Dates & Gates" app/deal/[id]/_components/overview-tab.tsx` ≥ 1
    - First section in overview-tab render order is `Tracking` (VIEW-05 mandate — verify by file content order)
    - `grep -c "updateDeal" app/deal/[id]/_components/overview-card.tsx` ≥ 1
    - `grep -c "zodResolver" app/deal/[id]/_components/overview-card.tsx` ≥ 1
    - `grep -c "updateDealSchema" app/deal/[id]/_components/overview-card.tsx` ≥ 1
    - `grep -c "Save changes" app/deal/[id]/_components/overview-card.tsx` ≥ 1
    - `grep -c "Changes saved\\." app/deal/[id]/_components/overview-card.tsx` ≥ 1
    - `grep -c "makeMoneyBlurHandler\\|parseMoney" app/deal/[id]/_components/overview-card.tsx` ≥ 1
    - `npm run build` exit 0
    - `npx tsc --noEmit` exit 0
  </acceptance_criteria>
  <done>Overview tab fully editable; per-card edit → updateDeal → audit trail → UI re-render all working; money + date + select inputs wired; build green.</done>
</task>

</tasks>

<verification>
- `npm run build` exit 0; `/deal/[id]` route compiled
- `npx tsc --noEmit` clean
- Manual walkthrough: create a deal via `/deal/new`, open `/deal/[new-id]`:
  - Header shows title, file_no, track badge, priority pill
  - Stepper shows universal + FL/TE stages (depending on track); current pip is primary-filled
  - Advance button opens dialog; confirming advances stage + toast fires
  - Past pip click opens revert dialog
  - Overflow menu → Kill deal… → dialog with required reason (≥ 3 chars enables confirm) → killing sets status + writes system note + audit row; page re-renders with killed chrome
  - Overview tab Tracking card Edit → change priority → Save → toast "Changes saved." + audit row captured
</verification>

<success_criteria>
- [ ] `/deal/[id]` renders real data (not placeholder) for any active deal
- [ ] Bad UUID → `not-found.tsx` renders 404 with correct copy
- [ ] Page header, stage stepper, tabs strip all match UI-SPEC
- [ ] Overview tab has 4 cards (Tracking, Property, Financials, Dates & Gates — in that order) with per-card edit → updateDeal
- [ ] All 4 mutation dialogs (advance, revert, close, kill) wire to Plan 04 actions with UI-SPEC copy verbatim
- [ ] Tasks/Notes/Audit tabs render placeholders (Plan 06 replaces)
- [ ] Every success toast matches UI-SPEC copywriting contract
- [ ] Killed-deal chrome (opacity, disabled overflow items, hidden Advance CTA) works when status='killed'
- [ ] 3 commits landed: shadcn install + query, page + dialogs, overview tab
</success_criteria>

<output>
After completion, create `.planning/phases/02-deal-detail-tasks-stages/02-05-deal-detail-shell-overview-tab-SUMMARY.md` using the standard SUMMARY template. Document any shadcn primitive fallbacks (hand-written wrappers) if base-nova didn't ship alert-dialog/textarea/scroll-area verbatim.
</output>
