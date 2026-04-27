---
phase: 03-people-map-contacts-registry
plan: 06
type: execute
wave: 4
depends_on:
  - 03-people-map-contacts-registry/03
  - 03-people-map-contacts-registry/04
files_modified:
  - app/deal/[id]/_components/people-tab.tsx
  - app/deal/[id]/_components/role-slot-row.tsx
  - app/deal/[id]/_components/contact-autosuggest.tsx
  - app/deal/[id]/_components/lender-free-text-row.tsx
  - app/deal/[id]/actions/autosuggest.ts
  - app/deal/[id]/_components/deal-tabs.tsx
  - app/deal/[id]/page.tsx
  - tests/integration/people-tab-query.test.ts
autonomous: true
requirements:
  - PEOPLE-02
  - PEOPLE-03

must_haves:
  truths:
    - "Clicking the 'File Contacts' tab on /deal/[id] replaces the placeholder div with a real pane rendering one row per applicable role slot for the deal's track"
    - "slotsForTrack(deal.trackCode) from Plan 02 drives which rows render — universal slots always appear, track-specific slots appear only for matching deals"
    - "An assigned slot shows: role label, contact full name, contact email, and a Remove (✕) button that calls removeDealPerson"
    - "An unassigned (contact_fk) slot shows an 'Assign' button that opens an autosuggest combobox; typing queries queryContactsAutosuggest via a Server Action; picking an existing contact calls upsertDealPerson"
    - "Autosuggest also offers a 'Create new contact' option that opens the same NewContactDialog from Plan 05, pre-filled with the typed query; on create success the slot auto-assigns to the new contact"
    - "The lender_partner slot is FREE-TEXT (distinct from contact_fk autosuggest) — shows a text input + Save; Save calls upsertDealPerson with {role:'lender_partner', freeTextValue: <typed text>}"
    - "After any mutation the pane refreshes without a full page reload (router.refresh() after the Server Action resolves)"
  artifacts:
    - path: app/deal/[id]/_components/people-tab.tsx
      provides: "Main pane: loops slotsForTrack → RoleSlotRow or LenderFreeTextRow per slot"
      contains: "slotsForTrack"
    - path: app/deal/[id]/_components/role-slot-row.tsx
      provides: "Per-slot row for contact_fk slots with autosuggest + remove"
      contains: "upsertDealPerson"
    - path: app/deal/[id]/_components/contact-autosuggest.tsx
      provides: "Reusable combobox: debounced server-action query + 'Create new' CTA"
      contains: "queryContactsAutosuggestAction"
    - path: app/deal/[id]/_components/lender-free-text-row.tsx
      provides: "Per-slot row for the lender_partner free-text slot (distinct from autosuggest)"
      contains: "freeTextValue"
    - path: app/deal/[id]/actions/autosuggest.ts
      provides: "Thin Server Action wrapping lib/contacts-query::queryContactsAutosuggest so client components can call it"
      contains: "queryContactsAutosuggestAction"
  key_links:
    - from: app/deal/[id]/_components/people-tab.tsx
      to: lib/role-slots.ts
      via: "imports slotsForTrack to drive per-track slot visibility"
      pattern: "slotsForTrack"
    - from: app/deal/[id]/_components/role-slot-row.tsx
      to: app/deal/[id]/actions/people.ts
      via: "calls upsertDealPerson / removeDealPerson Server Actions from Plan 04"
      pattern: "upsertDealPerson|removeDealPerson"
    - from: app/deal/[id]/_components/deal-tabs.tsx
      to: app/deal/[id]/_components/people-tab.tsx
      via: "Placeholder <PlaceholderPanel> inside TabsContent value='contacts' is REPLACED with <PeopleTab>"
      pattern: "<PeopleTab"
    - from: app/deal/[id]/page.tsx
      to: lib/deal-people-query.ts
      via: "awaits queryDealPeopleForDeal(deal.id) and passes rows into DealTabs"
      pattern: "queryDealPeopleForDeal"
---

<objective>
Replace the P2 placeholder on the deal-detail File Contacts tab with a real pane driven by `slotsForTrack(deal.trackCode)` from Plan 02. Ship the autosuggest combobox (PEOPLE-03) + inline New Contact flow + lender-partner free-text row. Wire assign/remove to the Plan 04 Server Actions.

**Purpose:** Deliver PEOPLE-02 + PEOPLE-03 at the UI layer so Carrie can see every person on a file at a glance — the "whose turn is next?" half of the dashboard's core value.

**Output:**
- `app/deal/[id]/_components/people-tab.tsx` — main pane rendering role rows per slot
- `app/deal/[id]/_components/role-slot-row.tsx` — one row for a contact_fk slot
- `app/deal/[id]/_components/contact-autosuggest.tsx` — combobox shared by every row
- `app/deal/[id]/_components/lender-free-text-row.tsx` — distinct row for the lender_partner free-text slot
- `app/deal/[id]/actions/autosuggest.ts` — Server Action wrapping the Plan 03 autosuggest query
- Updates to `app/deal/[id]/_components/deal-tabs.tsx` (replace placeholder) and `app/deal/[id]/page.tsx` (fetch + pass deal_people rows)
- Integration test coverage of the slot-filtering + join behavior end-to-end
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@app/deal/[id]/page.tsx
@app/deal/[id]/_components/deal-tabs.tsx
@app/deal/[id]/_components/overview-tab.tsx
@app/deal/[id]/_components/tasks-tab.tsx
@app/deal/[id]/_components/notes-tab.tsx
@app/deal/[id]/actions/people.ts
@app/contacts/_components/new-contact-dialog.tsx
@lib/role-slots.ts
@lib/deal-people-query.ts
@lib/contacts-query.ts
@lib/contact-schema.ts
@components/ui/popover.tsx
@components/ui/button.tsx
@components/ui/input.tsx
@components/ui/dialog.tsx

<interfaces>
From lib/role-slots.ts (Plan 02 — consume):
```typescript
export const ALL_TRACKS: readonly ["TE","FL","DP","PO","EC","SL","BL","GI"];
export type TrackCode = typeof ALL_TRACKS[number];
export type RoleSlot = { code: string; label: string; appliesToTracks: "ALL" | readonly TrackCode[]; source: "contact_fk" | "free_text"; notes?: string };
export function slotsForTrack(trackCode: TrackCode): readonly RoleSlot[];
export function isRoleValidForTrack(role: string, trackCode: string): boolean;
```

From lib/deal-people-query.ts (Plan 03 — consume):
```typescript
export type DealPersonRow = {
  id: string;
  dealId: string;
  role: string;
  contactId: string | null;
  contactFullName: string | null;
  contactEmail: string | null;
  contactOrg: string | null;
  createdAt: Date;
};
export async function queryDealPeopleForDeal(dealId: string): Promise<DealPersonRow[]>;
```

From lib/contacts-query.ts (Plan 03 — consume via Server Action wrapper):
```typescript
export type ContactAutosuggestRow = { id: string; fullName: string; email: string | null; org: string | null };
export async function queryContactsAutosuggest(q: string, limit: number): Promise<ContactAutosuggestRow[]>;
```

From app/deal/[id]/actions/people.ts (Plan 04 — invoke):
```typescript
export async function upsertDealPerson(raw: unknown): Promise<DealPersonResult>;
export async function removeDealPerson(raw: unknown): Promise<DealPersonResult>;
// raw shape for upsert: { dealId, role, contactId?, freeTextValue? }
// raw shape for remove: { dealId, role }
```

Existing DealTabs placeholder to REPLACE (app/deal/[id]/_components/deal-tabs.tsx lines 95-101):
```tsx
<TabsContent value="contacts" className="pt-6">
  <PlaceholderPanel ... heading="File contacts live here" ... />
</TabsContent>
```
Becomes:
```tsx
<TabsContent value="contacts" className="pt-6">
  <PeopleTab deal={props.deal} dealPeople={props.dealPeople} />
</TabsContent>
```
</interfaces>

<lender_partner_distinction>
**CRITICAL:** `lender_partner` is the ONLY slot with `source === "free_text"`. It renders as a plain `<Input>` + Save button, NOT the autosuggest combobox. Plan 04 already handles it server-side (creates a minimal contact row with `full_name = freeTextValue`, `role_hint = "lender"`). This plan must keep the UX distinct so Carrie doesn't accidentally expect autosuggest for actual lenders.

The `mortgage_partner` slot — which IS autosuggest-backed — is a separate row rendered via the standard RoleSlotRow. REQUIREMENTS.md line 85 explicitly names the distinction: `mortgage_partner` is the brokerage partner (in registry), `lender_partner` is the actual lender (often not in registry).
</lender_partner_distinction>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend app/deal/[id]/page.tsx to fetch deal_people rows and write autosuggest Server Action.</name>
  <files>
    app/deal/[id]/page.tsx
    app/deal/[id]/actions/autosuggest.ts
    tests/integration/people-tab-query.test.ts
  </files>
  <read_first>
    - app/deal/[id]/page.tsx (canonical: how tasks + notes + users + auditRows are already fetched in parallel via `await Promise.all([...])` and passed into DealTabs)
    - lib/deal-people-query.ts (Plan 03 — signature)
    - lib/contacts-query.ts (Plan 03 — queryContactsAutosuggest signature + clamp + ranking)
    - app/deal/[id]/actions/people.ts (Plan 04 — canonical Server Action shape; autosuggest action is READ-ONLY so no tx needed but still `"use server"`)
  </read_first>
  <action>
    1. Write `app/deal/[id]/actions/autosuggest.ts`:

       ```typescript
       "use server";

       import { queryContactsAutosuggest, type ContactAutosuggestRow } from "@/lib/contacts-query";

       /**
        * Phase 3 Plan 06 Task 1 — thin Server Action wrapper.
        *
        * Client components cannot call query helpers directly — they must go
        * through a Server Action or a route handler. queryContactsAutosuggest
        * itself is read-only; this wrapper exists so the contact-autosuggest
        * client component can `import { queryContactsAutosuggestAction }` and
        * use it in a useTransition.
        *
        * Clamps limit to [1, 20] defensively (the query helper also clamps).
        * Returns [] for empty/whitespace query.
        */
       export async function queryContactsAutosuggestAction(
         q: string,
         limit = 8,
       ): Promise<ContactAutosuggestRow[]> {
         const trimmed = (q ?? "").trim();
         if (trimmed.length === 0) return [];
         return await queryContactsAutosuggest(trimmed, Math.min(Math.max(limit, 1), 20));
       }
       ```

    2. Extend `app/deal/[id]/page.tsx` — add `queryDealPeopleForDeal` to the parallel fetch and pass into DealTabs. Exact surgical diff:

       ```typescript
       // ADD import:
       import { queryDealPeopleForDeal } from "@/lib/deal-people-query";

       // In the existing `await Promise.all([...])` block, add:
       //   queryDealPeopleForDeal(deal.id)
       // Capture into a `dealPeople` variable.

       // Pass to <DealTabs dealPeople={dealPeople} ... />.
       ```

       No other changes to the page — leave the existing overview/tasks/notes/audit wiring untouched.

    3. Write `tests/integration/people-tab-query.test.ts` — a narrow integration test that fetches the *composite* data the /deal/[id] page assembles for the People tab, proving:
       - Seed 1 track (code='TE'), 1 deal on that track, 2 contacts (A, B)
       - Insert deal_people: one row {role:'main_contact', contactId: A}, one row {role:'title_partner', contactId: B}
       - `queryDealPeopleForDeal(deal.id)` returns 2 rows
       - Joined contactFullName fields match seeded names
       - `slotsForTrack('TE')` includes both 'main_contact' and 'title_partner' (sanity — these are the rows we care about)
       - `slotsForTrack('GI')` does NOT include 'title_partner' (sanity — UI must filter correctly)
       - After `DELETE FROM contacts WHERE id = A` the row for main_contact survives with contactFullName=null (SET NULL cascade invariant)

       Run `npm test -- people-tab-query`. Expect GREEN (queries already live from Plan 03; this test just verifies the composition the UI relies on).

    4. `npx tsc --noEmit` + `npm run build`. Clean.
  </action>
  <verify>
    <automated>npm test -- people-tab-query &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `app/deal/[id]/actions/autosuggest.ts` exists and starts with `"use server";`
    - `grep -n "queryContactsAutosuggestAction" app/deal/[id]/actions/autosuggest.ts` returns a match
    - `grep -n "queryDealPeopleForDeal" app/deal/[id]/page.tsx` returns a match
    - `grep -n "dealPeople" app/deal/[id]/page.tsx` returns a match (passed to DealTabs)
    - `tests/integration/people-tab-query.test.ts` exists and passes with >= 5 assertions including the SET NULL test
    - `npx tsc --noEmit` exits 0
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Page-level data plumbing done; autosuggest action live; query composition is tested.</done>
</task>

<task type="auto">
  <name>Task 2: Build contact-autosuggest.tsx + lender-free-text-row.tsx + role-slot-row.tsx primitives.</name>
  <files>
    app/deal/[id]/_components/contact-autosuggest.tsx
    app/deal/[id]/_components/lender-free-text-row.tsx
    app/deal/[id]/_components/role-slot-row.tsx
  </files>
  <read_first>
    - components/ui/popover.tsx (Popover primitives — render-prop variant used by P1 DealsFilterBar; autosuggest reuses the same Popover pattern)
    - components/ui/input.tsx + button.tsx (shadcn; base-nova caveat reminder: Button has no asChild)
    - app/deal/[id]/actions/autosuggest.ts (Task 1 — consume)
    - app/deal/[id]/actions/people.ts (Plan 04 — upsertDealPerson + removeDealPerson invocations)
    - app/contacts/_components/new-contact-dialog.tsx (Plan 05 — reuse the dialog shell; autosuggest "Create new" CTA opens it pre-filled)
    - lib/role-slots.ts (Plan 02 — RoleSlot shape)
  </read_first>
  <action>
    1. Write `app/deal/[id]/_components/contact-autosuggest.tsx` — the combobox used by every contact_fk slot:

       ```typescript
       "use client";

       import { useEffect, useState, useTransition } from "react";
       import { Plus, Search } from "lucide-react";
       import {
         Popover,
         PopoverContent,
         PopoverTrigger,
       } from "@/components/ui/popover";
       import { Button } from "@/components/ui/button";
       import { Input } from "@/components/ui/input";
       import { queryContactsAutosuggestAction } from "@/app/deal/[id]/actions/autosuggest";
       import type { ContactAutosuggestRow } from "@/lib/contacts-query";

       /**
        * Phase 3 Plan 06 Task 2 — reusable contact autosuggest.
        *
        * Opens a popover anchored to the Assign trigger button. Typed query is
        * debounced 200ms and sent to queryContactsAutosuggestAction (Task 1).
        * Results list is ordered per the Plan 03 ranking (exact > prefix > substring).
        * Always includes a "Create new contact" row at the bottom that calls
        * onCreateNew(value) — the parent (role-slot-row) is responsible for
        * opening the NewContactDialog pre-filled.
        */
       export function ContactAutosuggest({
         onPick,
         onCreateNew,
         triggerLabel = "Assign",
       }: {
         onPick: (row: ContactAutosuggestRow) => void;
         onCreateNew: (typedValue: string) => void;
         triggerLabel?: string;
       }) {
         const [open, setOpen] = useState(false);
         const [value, setValue] = useState("");
         const [rows, setRows] = useState<ContactAutosuggestRow[]>([]);
         const [, startTransition] = useTransition();

         // Debounced fetch
         useEffect(() => {
           const id = window.setTimeout(() => {
             const trimmed = value.trim();
             if (trimmed.length === 0) { setRows([]); return; }
             startTransition(async () => {
               const result = await queryContactsAutosuggestAction(trimmed, 8);
               setRows(result);
             });
           }, 200);
           return () => window.clearTimeout(id);
         }, [value]);

         return (
           <Popover open={open} onOpenChange={setOpen}>
             <PopoverTrigger
               render={
                 <Button variant="outline" size="sm">
                   <Plus className="h-4 w-4" />
                   {triggerLabel}
                 </Button>
               }
             />
             <PopoverContent className="w-[320px] p-2" align="start">
               <div className="relative">
                 <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                 <Input
                   autoFocus
                   placeholder="Search name or email…"
                   value={value}
                   onChange={(e) => setValue(e.target.value)}
                   className="pl-8"
                 />
               </div>
               <div className="mt-2 max-h-[260px] overflow-y-auto">
                 {rows.length > 0 ? (
                   <ul className="flex flex-col">
                     {rows.map((r) => (
                       <li key={r.id}>
                         <button
                           type="button"
                           onClick={() => { onPick(r); setOpen(false); setValue(""); }}
                           className="w-full text-left px-2 py-1.5 rounded hover:bg-muted flex flex-col"
                         >
                           <span className="font-medium text-sm">{r.fullName}</span>
                           {r.email || r.org ? (
                             <span className="text-xs text-muted-foreground">
                               {[r.email, r.org].filter(Boolean).join(" · ")}
                             </span>
                           ) : null}
                         </button>
                       </li>
                     ))}
                   </ul>
                 ) : value.trim().length > 0 ? (
                   <p className="text-xs text-muted-foreground px-2 py-2">No matches.</p>
                 ) : null}
                 {value.trim().length > 0 ? (
                   <button
                     type="button"
                     onClick={() => { onCreateNew(value.trim()); setOpen(false); setValue(""); }}
                     className="mt-1 w-full text-left px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2 border-t"
                   >
                     <Plus className="h-3 w-3" />
                     <span className="text-sm">Create new contact: <span className="font-medium">“{value.trim()}”</span></span>
                   </button>
                 ) : null}
               </div>
             </PopoverContent>
           </Popover>
         );
       }
       ```

    2. Write `app/deal/[id]/_components/lender-free-text-row.tsx` — distinct from the autosuggest row:

       ```typescript
       "use client";

       import { useState, useTransition } from "react";
       import { useRouter } from "next/navigation";
       import { X } from "lucide-react";
       import { Button } from "@/components/ui/button";
       import { Input } from "@/components/ui/input";
       import { toast } from "sonner";
       import { upsertDealPerson, removeDealPerson } from "@/app/deal/[id]/actions/people";
       import type { DealPersonRow } from "@/lib/deal-people-query";

       /**
        * Phase 3 Plan 06 Task 2 — lender_partner free-text slot row.
        *
        * DISTINCT from the contact_fk autosuggest flow (REQUIREMENTS.md line 85:
        * "free-text because lenders are often not in the contacts registry").
        * Plan 04's upsertDealPerson + freeTextValue branch creates a minimal
        * contact row (full_name=value, role_hint='lender') behind the scenes.
        *
        * Assigned state: show the resolved contactFullName + Remove (✕)
        * Unassigned state: show a plain Input + Save button
        */
       export function LenderFreeTextRow({
         dealId,
         current,
       }: {
         dealId: string;
         current: DealPersonRow | null;
       }) {
         const router = useRouter();
         const [value, setValue] = useState("");
         const [isPending, startTransition] = useTransition();

         async function onSave() {
           const trimmed = value.trim();
           if (trimmed.length === 0) return;
           startTransition(async () => {
             const result = await upsertDealPerson({
               dealId,
               role: "lender_partner",
               freeTextValue: trimmed,
             });
             if (result.ok === false) {
               toast.error("error" in result ? result.error : "Could not save lender.");
               return;
             }
             toast.success("Lender saved.");
             setValue("");
             router.refresh();
           });
         }

         async function onRemove() {
           startTransition(async () => {
             const result = await removeDealPerson({ dealId, role: "lender_partner" });
             if (result.ok === false) {
               toast.error("error" in result ? result.error : "Could not remove lender.");
               return;
             }
             toast.success("Lender removed.");
             router.refresh();
           });
         }

         return (
           <div className="flex items-center justify-between gap-3 py-2 border-b">
             <div className="w-[160px] text-sm font-medium">Lender</div>
             <div className="flex-1">
               {current && current.contactFullName ? (
                 <div className="flex items-center justify-between">
                   <div>
                     <div className="text-sm font-medium">{current.contactFullName}</div>
                     <div className="text-xs text-muted-foreground">Free-text lender</div>
                   </div>
                   <Button variant="ghost" size="sm" onClick={onRemove} disabled={isPending} aria-label="Remove lender">
                     <X className="h-4 w-4" />
                   </Button>
                 </div>
               ) : (
                 <div className="flex items-center gap-2">
                   <Input
                     placeholder="Lender name (e.g., Wells Fargo)"
                     value={value}
                     onChange={(e) => setValue(e.target.value)}
                   />
                   <Button size="sm" onClick={onSave} disabled={isPending || value.trim().length === 0}>
                     Save
                   </Button>
                 </div>
               )}
             </div>
           </div>
         );
       }
       ```

    3. Write `app/deal/[id]/_components/role-slot-row.tsx`:

       ```typescript
       "use client";

       import { useState, useTransition } from "react";
       import { useRouter } from "next/navigation";
       import { X } from "lucide-react";
       import { Button } from "@/components/ui/button";
       import { toast } from "sonner";
       import { ContactAutosuggest } from "./contact-autosuggest";
       import { upsertDealPerson, removeDealPerson } from "@/app/deal/[id]/actions/people";
       import { NewContactDialog } from "@/app/contacts/_components/new-contact-dialog";
       import type { DealPersonRow } from "@/lib/deal-people-query";
       import type { RoleSlot } from "@/lib/role-slots";
       import type { ContactAutosuggestRow } from "@/lib/contacts-query";

       /**
        * Phase 3 Plan 06 Task 2 — contact_fk role slot row.
        *
        * Two states:
        *   A) Assigned — shows contact name + email + Remove (✕)
        *   B) Unassigned — shows ContactAutosuggest; on pick → upsertDealPerson
        *
        * Create-new path: when user clicks "Create new contact" in the autosuggest,
        * we open NewContactDialog pre-filled. The dialog's onSuccess callback
        * hands the new contact id back here so we immediately upsert the slot.
        * (Implementation uses a small `pendingCreate` state; NewContactDialog
        * must be extended minimally to accept initialFullName + onCreated props —
        * documented as a Plan 05 follow-up if not already supported; if the
        * version shipped by Plan 05 does not expose these, Task 2 adds them as
        * an additive non-breaking change and notes it in the plan SUMMARY.)
        */
       export function RoleSlotRow({
         dealId,
         slot,
         current,
       }: {
         dealId: string;
         slot: RoleSlot;
         current: DealPersonRow | null;
       }) {
         const router = useRouter();
         const [isPending, startTransition] = useTransition();
         const [prefillName, setPrefillName] = useState<string | null>(null);

         async function assign(contactId: string) {
           startTransition(async () => {
             const result = await upsertDealPerson({ dealId, role: slot.code, contactId });
             if (result.ok === false) {
               toast.error("error" in result ? result.error : "Could not assign.");
               return;
             }
             toast.success(`${slot.label} assigned.`);
             router.refresh();
           });
         }

         async function remove() {
           startTransition(async () => {
             const result = await removeDealPerson({ dealId, role: slot.code });
             if (result.ok === false) {
               toast.error("error" in result ? result.error : "Could not remove.");
               return;
             }
             toast.success(`${slot.label} removed.`);
             router.refresh();
           });
         }

         function onPick(row: ContactAutosuggestRow) { assign(row.id); }
         function onCreateNew(typed: string) { setPrefillName(typed); }
         function onCreated(newContactId: string) { setPrefillName(null); assign(newContactId); }

         return (
           <div className="flex items-center justify-between gap-3 py-2 border-b">
             <div className="w-[160px] text-sm font-medium">{slot.label}</div>
             <div className="flex-1">
               {current && current.contactId && current.contactFullName ? (
                 <div className="flex items-center justify-between">
                   <div>
                     <div className="text-sm font-medium">{current.contactFullName}</div>
                     {current.contactEmail ? (
                       <div className="text-xs text-muted-foreground">{current.contactEmail}</div>
                     ) : null}
                   </div>
                   <Button variant="ghost" size="sm" onClick={remove} disabled={isPending} aria-label={`Remove ${slot.label}`}>
                     <X className="h-4 w-4" />
                   </Button>
                 </div>
               ) : (
                 <ContactAutosuggest
                   triggerLabel="Assign"
                   onPick={onPick}
                   onCreateNew={onCreateNew}
                 />
               )}
             </div>
             {prefillName !== null ? (
               <NewContactDialog
                 initialFullName={prefillName}
                 controlledOpen={true}
                 onOpenChange={(v) => { if (!v) setPrefillName(null); }}
                 onCreated={onCreated}
               />
             ) : null}
           </div>
         );
       }
       ```

       **Cross-plan additive note:** the `NewContactDialog` shipped by Plan 05 exposes only a trigger-button variant with no props. Task 2 either (a) extends NewContactDialog to accept `initialFullName`, `controlledOpen`, `onOpenChange`, `onCreated` in a backward-compatible way (all optional — trigger still renders when controlledOpen is undefined), OR (b) factors a smaller `<NewContactForm>` out of NewContactDialog and wraps it in a second dialog instance here. Executor picks the cleaner path; record decision in SUMMARY.

    4. `npx tsc --noEmit` — clean. Build will succeed once Task 3 wires the pane.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `app/deal/[id]/_components/contact-autosuggest.tsx` exists and starts with `"use client";`
    - `grep -n "queryContactsAutosuggestAction" app/deal/[id]/_components/contact-autosuggest.tsx` returns a match
    - `grep -n "Create new contact" app/deal/[id]/_components/contact-autosuggest.tsx` returns a match (the CTA row)
    - `app/deal/[id]/_components/lender-free-text-row.tsx` exists and starts with `"use client";`
    - `grep -n "freeTextValue" app/deal/[id]/_components/lender-free-text-row.tsx` returns a match
    - `grep -n "role: \"lender_partner\"" app/deal/[id]/_components/lender-free-text-row.tsx` returns a match
    - `app/deal/[id]/_components/role-slot-row.tsx` exists and starts with `"use client";`
    - `grep -n "upsertDealPerson" app/deal/[id]/_components/role-slot-row.tsx` returns a match
    - `grep -n "removeDealPerson" app/deal/[id]/_components/role-slot-row.tsx` returns a match
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Three primitive components shipped: combobox, free-text lender row, contact-fk slot row.</done>
</task>

<task type="auto">
  <name>Task 3: Build people-tab.tsx pane; wire into deal-tabs.tsx (replace placeholder); full build + manual smoke.</name>
  <files>
    app/deal/[id]/_components/people-tab.tsx
    app/deal/[id]/_components/deal-tabs.tsx
  </files>
  <read_first>
    - app/deal/[id]/_components/deal-tabs.tsx (current: lines 95-101 render the placeholder inside `<TabsContent value="contacts">` — this is the exact replacement target)
    - lib/role-slots.ts (Plan 02 — slotsForTrack returns RoleSlot[] in a stable order; pane renders in that order)
    - lib/deal-people-query.ts (DealPersonRow[] from page.tsx — indexed by role to look up current assignment per slot)
    - app/deal/[id]/_components/role-slot-row.tsx + lender-free-text-row.tsx (Task 2)
  </read_first>
  <action>
    1. Write `app/deal/[id]/_components/people-tab.tsx`:

       ```typescript
       "use client";

       import { RoleSlotRow } from "./role-slot-row";
       import { LenderFreeTextRow } from "./lender-free-text-row";
       import { slotsForTrack, type TrackCode } from "@/lib/role-slots";
       import type { DealDetail } from "@/lib/deals-query";
       import type { DealPersonRow } from "@/lib/deal-people-query";

       /**
        * Phase 3 Plan 06 Task 3 — File Contacts tab pane.
        *
        * Loops slotsForTrack(deal.trackCode) — Plan 02's canonical per-track
        * applicability map — and renders one row per slot. For every slot,
        * look up the matching deal_people row (by role) to determine
        * assigned vs unassigned state.
        *
        * lender_partner gets a distinct row component (source==='free_text')
        * per REQUIREMENTS.md line 85.
        */
       export function PeopleTab({
         deal,
         dealPeople,
       }: {
         deal: DealDetail;
         dealPeople: DealPersonRow[];
       }) {
         const trackCode = deal.trackCode as TrackCode;
         const slots = slotsForTrack(trackCode);

         // Index deal_people by role for O(1) lookup per slot
         const byRole = new Map<string, DealPersonRow>();
         for (const row of dealPeople) byRole.set(row.role, row);

         return (
           <div className="max-w-3xl">
             <div className="flex flex-col">
               {slots.map((slot) =>
                 slot.source === "free_text" ? (
                   <LenderFreeTextRow
                     key={slot.code}
                     dealId={deal.id}
                     current={byRole.get(slot.code) ?? null}
                   />
                 ) : (
                   <RoleSlotRow
                     key={slot.code}
                     dealId={deal.id}
                     slot={slot}
                     current={byRole.get(slot.code) ?? null}
                   />
                 ),
               )}
             </div>
             <p className="mt-6 text-xs text-muted-foreground">
               {slots.length} role slot{slots.length === 1 ? "" : "s"} for {trackCode} deals.
             </p>
           </div>
         );
       }
       ```

    2. Edit `app/deal/[id]/_components/deal-tabs.tsx`:
       - Add import: `import { PeopleTab } from "./people-tab";`
       - Add import: `import type { DealPersonRow } from "@/lib/deal-people-query";`
       - Extend `DealTabs` props: add `dealPeople: DealPersonRow[]`
       - REPLACE the placeholder block (current lines 95-101) — change:
         ```tsx
         <TabsContent value="contacts" className="pt-6">
           <PlaceholderPanel
             icon={<Users className="h-12 w-12 text-muted-foreground" />}
             heading="File contacts live here"
             body="Per-deal role slots (title partner, TC, lender, etc.) arrive in Phase 3."
           />
         </TabsContent>
         ```
         to:
         ```tsx
         <TabsContent value="contacts" className="pt-6">
           <PeopleTab deal={props.deal} dealPeople={props.dealPeople} />
         </TabsContent>
         ```
       - Remove the now-unused `Users` lucide import ONLY IF no other reference remains (check — grep the file after edit). Leave `Mail` (still used for emails placeholder).

    3. Full verification:
       - `npx tsc --noEmit` — clean
       - `npm run build` — clean
       - `npm test` — full green
       - **Manual smoke (documented in SUMMARY):** `npm run dev`, open a TE deal, click File Contacts tab:
         * See rows for: Directing Agent, Main Contact, Internal Owner, Title Partner, Borrower, Seller, Mortgage Partner, TC Partner, TL Partner, Listing Agent (10 slots for TE per slotsForTrack — lender_partner only applies to FL/DP per Plan 02's registry — note TE deals have no lender_partner row)
         * Click Assign on Main Contact → autosuggest opens → type a few chars → pick a contact → row flips to assigned
         * Click the ✕ on Main Contact → row flips back to Assign
         * Open a FL deal → confirm a Lender (free-text) row appears distinct from Mortgage Partner
         * Type "Wells Fargo" into the lender input + Save → row flips to assigned with "Free-text lender" subtitle
         * Open a GI deal → confirm only the universal slots show (Directing Agent, Main Contact, Internal Owner) per slotsForTrack('GI')
  </action>
  <verify>
    <automated>npx tsc --noEmit &amp;&amp; npm run build &amp;&amp; npm test</automated>
  </verify>
  <acceptance_criteria>
    - `app/deal/[id]/_components/people-tab.tsx` exists and starts with `"use client";`
    - `grep -n "slotsForTrack" app/deal/[id]/_components/people-tab.tsx` returns a match
    - `grep -n "LenderFreeTextRow" app/deal/[id]/_components/people-tab.tsx` returns a match
    - `grep -n "slot.source === \"free_text\"" app/deal/[id]/_components/people-tab.tsx` returns a match (the branch)
    - `grep -n "<PeopleTab" app/deal/[id]/_components/deal-tabs.tsx` returns a match (placeholder replaced)
    - `grep -n "File contacts live here" app/deal/[id]/_components/deal-tabs.tsx` returns NO match (placeholder text gone)
    - `grep -n "dealPeople" app/deal/[id]/_components/deal-tabs.tsx` returns a match (new prop)
    - `npx tsc --noEmit` exits 0
    - `npm run build` exits 0
    - Full `npm test` green
    - Plan SUMMARY records the manual smoke outcome (each of the 6 smoke steps passes)
  </acceptance_criteria>
  <done>File Contacts tab pane is live end-to-end. PEOPLE-02 + PEOPLE-03 delivered at UI layer. Placeholder removed.</done>
</task>

</tasks>

<verification>
- Full `npm test` green
- `npm run build` clean
- `grep -rn "File contacts live here" app/deal/[id]/_components/` returns 0 matches (placeholder retired)
- `grep -rn "@/db/client" app/deal/[id]/_components/people-tab.tsx app/deal/[id]/_components/role-slot-row.tsx app/deal/[id]/_components/lender-free-text-row.tsx app/deal/[id]/_components/contact-autosuggest.tsx` returns 0 (D-04)
- No MFA / Auth.js references
- lender_partner row uses `freeTextValue` NOT `contactId`; mortgage_partner row uses the standard autosuggest — distinction preserved
- Next.js 16 route/page signatures honored (searchParams/params Promise)
- base-nova: Button uses `render=` not `asChild`; DialogTrigger uses `render=`; PopoverTrigger uses `render=`
</verification>

<success_criteria>
PEOPLE-02 delivered at UI — every applicable role slot renders per track, with assigned/unassigned UX. PEOPLE-03 delivered — autosuggest ranks and offers create-new. Lender_partner free-text distinction preserved from REQUIREMENTS.md. Placeholder retired from deal-tabs.tsx.
</success_criteria>

<output>
After completion, create `.planning/phases/03-people-map-contacts-registry/03-06-deal-detail-people-tab-SUMMARY.md` recording: NewContactDialog prop-extension path (additive vs factored subform), lender_partner row UX notes, any slot-track calibration surprises surfaced during manual smoke.
</output>
