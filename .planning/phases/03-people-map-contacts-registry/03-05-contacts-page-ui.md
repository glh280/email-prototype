---
phase: 03-people-map-contacts-registry
plan: 05
type: execute
wave: 4
depends_on:
  - 03-people-map-contacts-registry/03
  - 03-people-map-contacts-registry/04
files_modified:
  - app/contacts/page.tsx
  - app/contacts/_components/contacts-table.tsx
  - app/contacts/_components/contacts-search-bar.tsx
  - app/contacts/_components/new-contact-dialog.tsx
  - lib/contacts-filter-params.ts
  - tests/unit/contacts-filter-params.test.ts
  - tests/integration/contacts-page.test.ts
autonomous: true
requirements:
  - PEOPLE-04
  - VIEW-06

must_haves:
  truths:
    - "Visiting /contacts renders every contact with fullName, email, org, role_hint, activeDealsCount, and a createdAt relative label"
    - "Typing in the search input updates the URL ?q=<query> (mirrors P1 URL-state-as-source-of-truth per D-07) and the server re-queries"
    - "Search is case-insensitive substring across full_name OR email OR org (already handled by queryContactsForList from Plan 03)"
    - "Two distinct empty states: A) no contacts at all → 'No contacts yet' + New Contact CTA; B) filters return zero rows → 'No contacts match' + Clear search CTA"
    - "New Contact CTA opens a dialog with CreateContactSchema-backed form; submit calls createContact Server Action from Plan 04; on ok:true, dialog closes and list refreshes"
    - "Clicking a contact row navigates to /contacts/[id] (stub detail page — minimal read-only view; edit-in-place lives in a later plan or is added inline here as a stretch)"
  artifacts:
    - path: app/contacts/page.tsx
      provides: "Server Component for /contacts; awaits searchParams Promise (Next.js 16); queries via Plan 03 functions; renders table + search + new contact CTA"
      contains: "queryContactsForList"
    - path: app/contacts/_components/contacts-table.tsx
      provides: "Client/server composite rendering ContactListRow[] with per-row activeDealsCount + createdAt relative time"
      contains: "ContactListRow"
    - path: app/contacts/_components/contacts-search-bar.tsx
      provides: "URL-state ?q search input; debounced router.push"
      contains: "useSearchParams"
    - path: app/contacts/_components/new-contact-dialog.tsx
      provides: "Dialog wrapping createContact Server Action; Zod-backed form"
      contains: "createContact"
    - path: lib/contacts-filter-params.ts
      provides: "Tiny parseQ helper + type — mirrors lib/filter-params.ts pattern but only one param (q)"
      contains: "parseContactsFilterParams"
  key_links:
    - from: app/contacts/page.tsx
      to: lib/contacts-query.ts
      via: "imports queryContactsForList from '@/lib/contacts-query'"
      pattern: "queryContactsForList"
    - from: app/contacts/_components/new-contact-dialog.tsx
      to: app/contacts/actions.ts
      via: "imports createContact Server Action"
      pattern: "createContact"
    - from: app/contacts/_components/contacts-search-bar.tsx
      to: "Next.js useRouter / useSearchParams"
      via: "URL-state convention matching DealsFilterBar (D-07)"
      pattern: "router.push"
---

<objective>
Ship the `/contacts` page at the UI layer. Server Component that consumes `queryContactsForList` (Plan 03) for the list + counter, a URL-state search bar mirroring P1 Plan 06's pattern, and a New Contact dialog that calls `createContact` (Plan 04). This is the final VIEW-06 + PEOPLE-04 deliverable.

**Purpose:** Deliver a glance-scannable global contacts list with search, the "on N active deals" counter, and contact creation — keeping the workflow loop closed when Carrie needs a contact that isn't yet on a deal.

**Output:**
- `app/contacts/page.tsx` — Server Component (Next.js 16 `searchParams: Promise<...>`)
- `app/contacts/_components/contacts-table.tsx` — table rendering
- `app/contacts/_components/contacts-search-bar.tsx` — client component, URL-state search
- `app/contacts/_components/new-contact-dialog.tsx` — client component, dialog + form → createContact
- `lib/contacts-filter-params.ts` — tiny parse/serialize helper (single `q` param) + unit tests
- Integration test covering the page render with seeded data

**Row-click decision (documented inline):** Click navigates to `/contacts/[id]` — a minimal read-only detail route included as a stub in Task 1. Full edit UX on the detail route is deferred to P10 calibration (or a follow-up plan). This keeps Plan 05 narrow: list + create. Rationale: edit-in-place in the table would re-open the dialog-based form pattern and is a cheap addition later; routing is cleaner than a side panel because the data-model-substrate for detail (activeDealsCount aside) is trivial.
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
@app/page.tsx
@app/_components/deals-table.tsx
@app/_components/deals-filter-bar.tsx
@app/_components/success-toast.tsx
@lib/filter-params.ts
@lib/format.ts
@components/app-header.tsx
@components/ui/button.tsx
@components/ui/dialog.tsx
@components/ui/input.tsx
@components/ui/table.tsx
@lib/contacts-query.ts
@app/contacts/actions.ts
@lib/contact-schema.ts
@.planning/phases/03-people-map-contacts-registry/03-03-contacts-and-deal-people-queries.md
@.planning/phases/03-people-map-contacts-registry/03-04-contact-and-deal-people-server-actions.md

<interfaces>
From lib/contacts-query.ts (Plan 03 — consume, do not redeclare):
```typescript
export type ContactListRow = {
  id: string;
  fullName: string;
  roleHint: string | null;
  org: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: Date;
  activeDealsCount: number;
};

export async function queryContactsForList(q?: string): Promise<ContactListRow[]>;
```

From app/contacts/actions.ts (Plan 04 — invoke, do not redeclare):
```typescript
export type ContactResult =
  | { ok: true; contactId: string; noop?: boolean }
  | { ok: false; errors: Record<string, string[]> }
  | { ok: false; error: string };

export async function createContact(raw: unknown): Promise<ContactResult>;
export async function updateContact(raw: unknown): Promise<ContactResult>;
```

From lib/contact-schema.ts (Plan 02 — consume for client-side pre-validation mirroring server Zod):
```typescript
export const createContactSchema: ZodObject<{
  fullName: ..., roleHint?, org?, email?, phone?, notes?
}>.strict();
```

From lib/filter-params.ts (P1 Plan 06 — canonical pattern to MIRROR):
```typescript
// URL-state is source of truth (D-07). useSearchParams + router.push in client;
// parseFilterParams in server. serializeFilterParams OMITS defaults.
```

From Next.js 16 (per AGENTS.md — verify in node_modules/next/dist/docs before writing):
```typescript
// app/contacts/page.tsx signature:
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) { const sp = await searchParams; ... }
```

base-nova UI primitive caveats (proven in P2 Plan 05 — MUST honor):
- `Button` does NOT accept `asChild`; use `render={<Link.../>}` for link-styled buttons
- `AlertDialogDescription` renders as `<p>` — no nested `<div>` children
- `Dialog` + `DialogContent` + `DialogHeader` + `DialogTitle` + `DialogDescription` available via @/components/ui/dialog
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Author lib/contacts-filter-params.ts + tests AND write app/contacts/page.tsx with the empty-state branches + stub detail route.</name>
  <files>
    lib/contacts-filter-params.ts
    tests/unit/contacts-filter-params.test.ts
    app/contacts/page.tsx
    app/contacts/[id]/page.tsx
  </files>
  <read_first>
    - lib/filter-params.ts (canonical parseFilterParams / serializeFilterParams / hasAnyFilter — MIRROR cadence; ours has only one param `q`)
    - app/page.tsx (canonical list page: searchParams Promise, await, getCurrentUser() if needed, anyFilter branch, empty-state-A vs empty-state-B)
    - app/_components/success-toast.tsx (shows pattern for toast-from-URL-param — we can reuse for `?created=<id>` after dialog flow in Task 3)
    - components/app-header.tsx (top nav — add a /contacts link in Task 1 if missing)
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md (searchParams Promise shape)
  </read_first>
  <action>
    1. Write `tests/unit/contacts-filter-params.test.ts` FIRST. Assertions:
       - `parseContactsFilterParams({})` → `{ q: "" }`
       - `parseContactsFilterParams({ q: "alice" })` → `{ q: "alice" }`
       - `parseContactsFilterParams({ q: "   " })` → `{ q: "" }` (whitespace trimmed → empty — do NOT pass to query layer)
       - `parseContactsFilterParams({ q: ["a", "b"] })` → `{ q: "a" }` (array form, first wins — Next.js 16 shape)
       - `parseContactsFilterParams({ q: "  hello world  " })` → `{ q: "hello world" }` (trim but keep internal spaces)
       - `serializeContactsFilterParams({ q: "" })` → new URLSearchParams() (default omitted — clean URL)
       - `serializeContactsFilterParams({ q: "alice" }).toString()` → `"q=alice"`
       - `hasAnyContactsFilter({ q: "" })` → false
       - `hasAnyContactsFilter({ q: "x" })` → true

       Run `npm test -- contacts-filter-params`. Expect RED.

    2. Write `lib/contacts-filter-params.ts`:

       ```typescript
       /**
        * Phase 3 Plan 05 Task 1 — /contacts URL-state helper.
        *
        * Mirrors lib/filter-params.ts for /contacts. Only one param today: `q`
        * (case-insensitive substring search — see queryContactsForList in
        * lib/contacts-query.ts). Future filters (on-deals-only, org-filter)
        * extend by adding fields + cases here; the module stays the only
        * place that talks to the raw URL shape for /contacts.
        *
        * D-07: URL-state is source of truth.
        */
       export type ContactsFilterParams = { q: string };

       export function parseContactsFilterParams(
         sp: Record<string, string | string[] | undefined>,
       ): ContactsFilterParams {
         const raw = sp.q;
         const v = Array.isArray(raw) ? raw[0] : raw;
         return { q: (v ?? "").trim() };
       }

       export function serializeContactsFilterParams(
         p: Partial<ContactsFilterParams>,
       ): URLSearchParams {
         const out = new URLSearchParams();
         if (p.q && p.q.length > 0) out.set("q", p.q);
         return out;
       }

       export function hasAnyContactsFilter(p: ContactsFilterParams): boolean {
         return p.q.length > 0;
       }
       ```

       Re-run test. Expect GREEN.

    3. Write `app/contacts/page.tsx` — Server Component:

       ```typescript
       import Link from "next/link";
       import { Users, Search } from "lucide-react";
       import { AppHeader } from "@/components/app-header";
       import { Button } from "@/components/ui/button";
       import { ContactsTable } from "./_components/contacts-table";
       import { ContactsSearchBar } from "./_components/contacts-search-bar";
       import { NewContactDialog } from "./_components/new-contact-dialog";
       import { queryContactsForList } from "@/lib/contacts-query";
       import {
         parseContactsFilterParams,
         hasAnyContactsFilter,
       } from "@/lib/contacts-filter-params";

       /**
        * Phase 3 Plan 05 — /contacts page (VIEW-06 + PEOPLE-04).
        *
        * Mirrors app/page.tsx shape: searchParams Promise (Next.js 16), filter
        * parse, query, two empty-state branches (no contacts vs filtered-empty).
        *
        * URL-state (D-07): `?q=<query>`.
        */
       export default async function ContactsPage({
         searchParams,
       }: {
         searchParams: Promise<Record<string, string | string[] | undefined>>;
       }) {
         const sp = await searchParams;
         const filters = parseContactsFilterParams(sp);
         const contacts = await queryContactsForList(filters.q || undefined);
         const anyFilter = hasAnyContactsFilter(filters);

         return (
           <>
             <AppHeader />
             <main className="mx-auto max-w-[1440px] px-6 py-6">
               <div className="flex items-center justify-between">
                 <h1 className="text-xl font-semibold">Contacts</h1>
                 <NewContactDialog />
               </div>

               <div className="mt-4">
                 <ContactsSearchBar />
               </div>

               <div className="mt-4">
                 {contacts.length === 0 ? (
                   anyFilter ? (
                     <div className="flex flex-col items-center py-24 text-center">
                       <Search className="h-12 w-12 text-muted-foreground" />
                       <h2 className="mt-6 text-[28px] font-semibold leading-[1.2]">
                         No contacts match your search
                       </h2>
                       <p className="mt-2 text-sm text-muted-foreground">
                         Try a different query.
                       </p>
                       <Button
                         render={<Link href="/contacts">Clear search</Link>}
                         variant="outline"
                         className="mt-6"
                       />
                     </div>
                   ) : (
                     <div className="flex flex-col items-center py-24 text-center">
                       <Users className="h-12 w-12 text-muted-foreground" />
                       <h2 className="mt-6 text-[28px] font-semibold leading-[1.2]">
                         No contacts yet
                       </h2>
                       <p className="mt-2 text-sm text-muted-foreground">
                         Add your first contact to start tracking people on deals.
                       </p>
                       <div className="mt-6">
                         <NewContactDialog />
                       </div>
                     </div>
                   )
                 ) : (
                   <ContactsTable contacts={contacts} />
                 )}
               </div>

               <div className="mt-8 text-xs text-muted-foreground">
                 {contacts.length} contact{contacts.length === 1 ? "" : "s"}
               </div>
             </main>
           </>
         );
       }
       ```

    4. Write the stub detail route `app/contacts/[id]/page.tsx` — read-only display calling `queryContactById` from Plan 03. Keep it minimal (renders the fields; no edit UI yet):

       ```typescript
       import Link from "next/link";
       import { notFound } from "next/navigation";
       import { AppHeader } from "@/components/app-header";
       import { Button } from "@/components/ui/button";
       import { queryContactById } from "@/lib/contacts-query";

       export default async function ContactDetailPage({
         params,
       }: {
         params: Promise<{ id: string }>;
       }) {
         const { id } = await params;
         const contact = await queryContactById(id);
         if (!contact) notFound();

         return (
           <>
             <AppHeader />
             <main className="mx-auto max-w-[960px] px-6 py-6">
               <Button render={<Link href="/contacts">← All contacts</Link>} variant="ghost" size="sm" />
               <h1 className="mt-4 text-xl font-semibold">{contact.fullName}</h1>
               <dl className="mt-6 grid grid-cols-[140px_1fr] gap-x-6 gap-y-3 text-sm">
                 <dt className="text-muted-foreground">Email</dt><dd>{contact.email ?? "—"}</dd>
                 <dt className="text-muted-foreground">Phone</dt><dd>{contact.phone ?? "—"}</dd>
                 <dt className="text-muted-foreground">Org</dt><dd>{contact.org ?? "—"}</dd>
                 <dt className="text-muted-foreground">Role hint</dt><dd>{contact.roleHint ?? "—"}</dd>
                 <dt className="text-muted-foreground">Notes</dt><dd className="whitespace-pre-wrap">{contact.notes ?? "—"}</dd>
               </dl>
             </main>
           </>
         );
       }
       ```

    5. Run `npx tsc --noEmit` + `npm run build`. Expect clean build (table component + search bar + dialog are stubs until Task 2 & 3 — use `// TODO` placeholder components OR wire Task 2 files first, then Task 3. Sequence Task 1 LAST to wire, OR make Task 2 & 3 additive — per this plan, Task 1 writes the page with imports that resolve only after Task 2 & 3 commit). **Explicit sequencing note:** the executor should temporarily stub out the 3 _components imports as empty exports so Task 1 builds, then wire them in Task 2/3. Alternatively: write page.tsx LAST. Executor's call — document in SUMMARY which path taken.
  </action>
  <verify>
    <automated>npm test -- contacts-filter-params &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `lib/contacts-filter-params.ts` exists and exports `parseContactsFilterParams`, `serializeContactsFilterParams`, `hasAnyContactsFilter`, `ContactsFilterParams`
    - `tests/unit/contacts-filter-params.test.ts` exists and passes with >= 9 assertions
    - `app/contacts/page.tsx` exists and imports `queryContactsForList` from `@/lib/contacts-query`
    - `grep -n "searchParams: Promise<" app/contacts/page.tsx` returns a match (Next.js 16 shape)
    - `grep -n "queryContactsForList" app/contacts/page.tsx` returns a match
    - `grep -n "anyFilter" app/contacts/page.tsx` returns a match (two-empty-state branching present)
    - `app/contacts/[id]/page.tsx` exists and imports `queryContactById`
    - `grep -n "notFound" app/contacts/[id]/page.tsx` returns a match
    - `npx tsc --noEmit` exits 0 (after Task 2 + 3 ship the imports)
  </acceptance_criteria>
  <done>URL-state helper tested and canonical; `/contacts` server route renders with two empty-state branches; stub detail route exists.</done>
</task>

<task type="auto">
  <name>Task 2: Build contacts-table.tsx + contacts-search-bar.tsx — list rendering + URL-state search.</name>
  <files>
    app/contacts/_components/contacts-table.tsx
    app/contacts/_components/contacts-search-bar.tsx
  </files>
  <read_first>
    - app/_components/deals-table.tsx (canonical client component consuming server-queried rows; sortable headers pattern; this table is simpler — no sorting yet, but same Table/TableRow/TableHead primitives)
    - app/_components/deals-filter-bar.tsx (canonical `useRouter() + useSearchParams()` pattern; serializeFilterParams → router.push)
    - app/_components/success-toast.tsx (canonical use of useSearchParams in a small client component)
    - lib/format.ts (relativeTime — already exists per file list in planning context; use for createdAt display)
    - components/ui/table.tsx + input.tsx (shadcn primitives; base-nova Button caveats)
    - lib/contacts-filter-params.ts (Task 1 — mirror deals-filter-bar import/serialize cadence)
  </read_first>
  <action>
    1. Write `app/contacts/_components/contacts-table.tsx`:

       ```typescript
       import Link from "next/link";
       import {
         Table,
         TableHeader,
         TableBody,
         TableRow,
         TableHead,
         TableCell,
       } from "@/components/ui/table";
       import type { ContactListRow } from "@/lib/contacts-query";
       import { relativeTime } from "@/lib/format";

       /**
        * Phase 3 Plan 05 Task 2 — /contacts table.
        *
        * Server-rendered (no interactivity beyond row-click <Link>). Columns per
        * UI-SPEC assumption (Phase 3 Plan 05 decision log): Name, Email, Org,
        * Role hint, On N active deals, Added.
        *
        * Row click → /contacts/[id] via nested <Link className="contents">
        * wrap (the "contents" class removes the anchor from the layout box so
        * the row still flows as a table row; Next.js 16-compatible approach).
        */
       export function ContactsTable({ contacts }: { contacts: ContactListRow[] }) {
         return (
           <Table>
             <TableHeader>
               <TableRow className="hover:bg-transparent">
                 <TableHead className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">Name</TableHead>
                 <TableHead className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">Email</TableHead>
                 <TableHead className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">Org</TableHead>
                 <TableHead className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">Role hint</TableHead>
                 <TableHead className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground text-right">Active deals</TableHead>
                 <TableHead className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">Added</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {contacts.map((c) => (
                 <TableRow key={c.id} className="cursor-pointer">
                   <TableCell>
                     <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                       {c.fullName}
                     </Link>
                   </TableCell>
                   <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                   <TableCell className="text-muted-foreground">{c.org ?? "—"}</TableCell>
                   <TableCell className="text-muted-foreground">{c.roleHint ?? "—"}</TableCell>
                   <TableCell className="text-right">
                     {c.activeDealsCount === 0 ? (
                       <span className="text-muted-foreground">0</span>
                     ) : (
                       <span className="font-medium">{c.activeDealsCount}</span>
                     )}
                   </TableCell>
                   <TableCell className="text-muted-foreground text-xs">
                     {relativeTime(c.createdAt)}
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
         );
       }
       ```

       **Decision recorded inline:** Row click wrapping. Using a `<Link>` inside the name cell (not a full-row anchor) because nesting `<a>` inside `<tr>` is invalid HTML. Alternative: programmatic `onClick` with `useRouter().push` requires client component — the query column count is small enough that server-rendered name-link UX is sufficient. If Carrie wants full-row click later, flip the component to `"use client"` and add `onClick` to TableRow.

    2. Write `app/contacts/_components/contacts-search-bar.tsx`:

       ```typescript
       "use client";

       import { useRouter, useSearchParams } from "next/navigation";
       import { useEffect, useState } from "react";
       import { Search, X } from "lucide-react";
       import { Input } from "@/components/ui/input";
       import { Button } from "@/components/ui/button";
       import {
         parseContactsFilterParams,
         serializeContactsFilterParams,
       } from "@/lib/contacts-filter-params";

       /**
        * Phase 3 Plan 05 Task 2 — /contacts search bar.
        *
        * URL-state (D-07): `?q=<query>`. Debounced 250ms so typing doesn't
        * thrash router.push. Mirrors DealsFilterBar's useRouter/useSearchParams
        * shape — all state derives from URL on mount; local `value` is just
        * the controlled input echoing URL.
        */
       export function ContactsSearchBar() {
         const router = useRouter();
         const searchParams = useSearchParams();
         const record: Record<string, string> = {};
         searchParams.forEach((v, k) => (record[k] = v));
         const filters = parseContactsFilterParams(record);

         const [value, setValue] = useState(filters.q);

         // Keep local input in sync when URL changes externally (e.g., Clear search)
         useEffect(() => {
           setValue(filters.q);
         }, [filters.q]);

         // Debounced push on typing
         useEffect(() => {
           const id = window.setTimeout(() => {
             const trimmed = value.trim();
             if (trimmed === filters.q) return;
             const serialized = serializeContactsFilterParams({ q: trimmed });
             const qs = serialized.toString();
             router.push(qs ? `/contacts?${qs}` : "/contacts");
           }, 250);
           return () => window.clearTimeout(id);
         }, [value, filters.q, router]);

         return (
           <div className="flex items-center gap-2">
             <div className="relative flex-1 max-w-md">
               <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
               <Input
                 type="text"
                 placeholder="Search by name, email, or org…"
                 value={value}
                 onChange={(e) => setValue(e.target.value)}
                 className="pl-8"
               />
               {value.length > 0 ? (
                 <button
                   type="button"
                   onClick={() => setValue("")}
                   className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                   aria-label="Clear search"
                 >
                   <X className="h-4 w-4" />
                 </button>
               ) : null}
             </div>
           </div>
         );
       }
       ```

    3. Run `npx tsc --noEmit` + `npm run build`. Both clean.
  </action>
  <verify>
    <automated>npx tsc --noEmit &amp;&amp; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `app/contacts/_components/contacts-table.tsx` exists and imports `ContactListRow` from `@/lib/contacts-query`
    - `grep -n "activeDealsCount" app/contacts/_components/contacts-table.tsx` returns a match
    - `grep -n "relativeTime" app/contacts/_components/contacts-table.tsx` returns a match (createdAt display)
    - `grep -n "href={\`/contacts/\${c.id}\`}" app/contacts/_components/contacts-table.tsx` returns a match (row navigation)
    - `app/contacts/_components/contacts-search-bar.tsx` exists and starts with `"use client";`
    - `grep -n "useRouter" app/contacts/_components/contacts-search-bar.tsx` returns a match
    - `grep -n "serializeContactsFilterParams" app/contacts/_components/contacts-search-bar.tsx` returns a match
    - `grep -n "setTimeout" app/contacts/_components/contacts-search-bar.tsx` returns a match (debounce)
    - `npx tsc --noEmit` exits 0
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>Table renders list + active-deals counter; search bar reads/writes URL state with 250ms debounce.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Build new-contact-dialog.tsx wired to createContact Server Action + integration test for /contacts page render.</name>
  <files>
    app/contacts/_components/new-contact-dialog.tsx
    tests/integration/contacts-page.test.ts
  </files>
  <read_first>
    - app/deal/new/_components/* (canonical P1 form-with-Server-Action pattern — same Zod contract client-side + server-side; result shape { ok, errors } consumed)
    - app/contacts/actions.ts (Plan 04 — createContact signature; consume, don't re-declare)
    - lib/contact-schema.ts (Plan 02 — use createContactSchema for client-side pre-validation mirroring server; same error messages so the UX is consistent if network drops)
    - components/ui/dialog.tsx (shadcn Dialog primitives; note Dialog inherits Radix-style open/onOpenChange)
    - tests/integration/ (existing harness — fixtures, DB lifecycle)
    - base-nova Button caveats: Button trigger for the dialog can wrap render={<.../>} for consistency with P1/P2, but plain `<Button onClick={...}>` works for opening; honor the no-asChild rule
  </read_first>
  <action>
    1. Write `app/contacts/_components/new-contact-dialog.tsx`:

       ```typescript
       "use client";

       import { useState, useTransition } from "react";
       import { useRouter } from "next/navigation";
       import { Plus } from "lucide-react";
       import { Button } from "@/components/ui/button";
       import {
         Dialog,
         DialogContent,
         DialogDescription,
         DialogFooter,
         DialogHeader,
         DialogTitle,
         DialogTrigger,
       } from "@/components/ui/dialog";
       import { Input } from "@/components/ui/input";
       import { Label } from "@/components/ui/label";
       import { Textarea } from "@/components/ui/textarea";
       import { toast } from "sonner";
       import { createContactSchema } from "@/lib/contact-schema";
       import { createContact } from "@/app/contacts/actions";

       /**
        * Phase 3 Plan 05 Task 3 — New Contact dialog.
        *
        * Client-side pre-validation with createContactSchema mirrors the server;
        * server action result shape { ok, errors } surfaces field errors if the
        * client somehow sends bad data (defense in depth).
        *
        * On ok:true: close dialog, toast "Contact added.", call router.refresh()
        * so the server component re-runs queryContactsForList and the new row
        * appears without a full reload (Next.js 16 cache revalidation happens
        * via createContact's revalidatePath('/contacts')).
        */
       export function NewContactDialog() {
         const router = useRouter();
         const [open, setOpen] = useState(false);
         const [isPending, startTransition] = useTransition();
         const [errors, setErrors] = useState<Record<string, string[]>>({});

         async function onSubmit(formData: FormData) {
           setErrors({});
           const raw = {
             fullName: String(formData.get("fullName") ?? "").trim(),
             email: String(formData.get("email") ?? ""),
             phone: String(formData.get("phone") ?? ""),
             org: String(formData.get("org") ?? ""),
             roleHint: String(formData.get("roleHint") ?? ""),
             notes: String(formData.get("notes") ?? ""),
           };
           // Drop empty-string fields so .optional() + .nullable() accept them
           const cleaned = Object.fromEntries(
             Object.entries(raw).filter(([, v]) => v !== ""),
           );
           const parse = createContactSchema.safeParse(cleaned);
           if (!parse.success) {
             setErrors(parse.error.flatten().fieldErrors);
             return;
           }
           startTransition(async () => {
             const result = await createContact(cleaned);
             if (result.ok === false && "errors" in result) {
               setErrors(result.errors);
               return;
             }
             if (result.ok === false && "error" in result) {
               toast.error(result.error);
               return;
             }
             toast.success("Contact added.");
             setOpen(false);
             router.refresh();
           });
         }

         return (
           <Dialog open={open} onOpenChange={setOpen}>
             <DialogTrigger
               render={
                 <Button size="sm">
                   <Plus className="h-4 w-4" />
                   New Contact
                 </Button>
               }
             />
             <DialogContent className="max-w-lg">
               <DialogHeader>
                 <DialogTitle>New Contact</DialogTitle>
                 <DialogDescription>Add someone to the registry. You can assign them to a deal from the deal's People tab.</DialogDescription>
               </DialogHeader>
               <form action={onSubmit} className="space-y-4">
                 <Field label="Full name" name="fullName" required errors={errors.fullName} />
                 <Field label="Email" name="email" type="email" errors={errors.email} />
                 <Field label="Phone" name="phone" errors={errors.phone} />
                 <Field label="Org" name="org" errors={errors.org} />
                 <Field label="Role hint" name="roleHint" placeholder="e.g. title partner, lender" errors={errors.roleHint} />
                 <div>
                   <Label htmlFor="notes">Notes</Label>
                   <Textarea id="notes" name="notes" rows={3} />
                   {errors.notes ? <p className="mt-1 text-sm text-destructive">{errors.notes.join(" ")}</p> : null}
                 </div>
                 <DialogFooter>
                   <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                   <Button type="submit" disabled={isPending}>{isPending ? "Adding…" : "Add Contact"}</Button>
                 </DialogFooter>
               </form>
             </DialogContent>
           </Dialog>
         );
       }

       function Field({
         label, name, type = "text", required = false, placeholder, errors,
       }: {
         label: string; name: string; type?: string; required?: boolean;
         placeholder?: string; errors?: string[];
       }) {
         return (
           <div>
             <Label htmlFor={name}>{label}{required ? <span className="text-destructive"> *</span> : null}</Label>
             <Input id={name} name={name} type={type} placeholder={placeholder} />
             {errors ? <p className="mt-1 text-sm text-destructive">{errors.join(" ")}</p> : null}
           </div>
         );
       }
       ```

    2. Write `tests/integration/contacts-page.test.ts`. This tests the *page render* (not Playwright — Vitest + a server-component test harness if the project has one; otherwise assert the page module's default export exists and that queryContactsForList returns the expected shape when called directly, which is the pragmatic substitute). Seed: 3 contacts, 1 active deal with one deal_people row to contact A. Assertions:
       - Importing `app/contacts/page.tsx` does not throw at module load
       - Calling `queryContactsForList()` (no q) returns 3 rows
       - Row for contact A has `activeDealsCount === 1`
       - Row for contacts B and C have `activeDealsCount === 0`
       - Calling `queryContactsForList("alic")` (matching contact A's name prefix) returns 1 row
       - Calling `queryContactsForList("zzznomatch")` returns 0 rows (→ this is what drives empty-state-B in the page)

       Note: the integration test here is really just exercising the query layer under the /contacts use case; the rendering is exercised via `npm run build` passing (which type-checks the Server Component + its client component subtree).

    3. Verify:
       - `npm test -- contacts-page`: passes
       - `npm test`: full suite green
       - `npm run build`: clean
       - Manual smoke (optional, documented in SUMMARY): `npm run dev` + visit `/contacts` → empty-state A → click "New Contact" → fill form → submit → toast "Contact added" → row appears → type in search → row filters
  </action>
  <verify>
    <automated>npm test -- contacts-page &amp;&amp; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `app/contacts/_components/new-contact-dialog.tsx` exists and starts with `"use client";`
    - `grep -n "createContact" app/contacts/_components/new-contact-dialog.tsx` returns a match
    - `grep -n "createContactSchema" app/contacts/_components/new-contact-dialog.tsx` returns a match
    - `grep -n "router.refresh()" app/contacts/_components/new-contact-dialog.tsx` returns a match
    - `grep -n "toast.success" app/contacts/_components/new-contact-dialog.tsx` returns a match
    - `grep -n "DialogTrigger" app/contacts/_components/new-contact-dialog.tsx` returns a match; the trigger uses `render={<Button...>}` NOT `asChild` (base-nova caveat)
    - `tests/integration/contacts-page.test.ts` exists and passes with >= 6 assertions
    - `npm run build` exits 0 (all imports resolve end-to-end)
    - Full `npm test` green
  </acceptance_criteria>
  <done>New-contact flow ends-to-end from UI → Zod → Server Action → DB → audit → revalidate → UI refresh. VIEW-06 + PEOPLE-04 live.</done>
</task>

</tasks>

<verification>
- Full `npm test` green
- `npm run build` clean — all `/contacts*` routes compile with no import errors
- `grep -rn "@/db/client" app/contacts/` returns 0 matches (D-04 holds)
- No MFA references; no Auth.js references
- Next.js 16 `searchParams: Promise<...>` shape honored in both `app/contacts/page.tsx` and `app/contacts/[id]/page.tsx`
- base-nova caveats honored: `render={<Link/>}` for link-Buttons, `render={<Button/>}` for DialogTrigger — no `asChild` anywhere
</verification>

<success_criteria>
VIEW-06 delivered: `/contacts` renders global list with search + "on N active deals" counter + empty states. PEOPLE-04 delivered: counter is live per-contact. New Contact creation loop closed.
</success_criteria>

<output>
After completion, create `.planning/phases/03-people-map-contacts-registry/03-05-contacts-page-ui-SUMMARY.md` recording: empty-state branches, URL-state debounce interval chosen, row-navigation decision (stub detail route vs side panel).
</output>
