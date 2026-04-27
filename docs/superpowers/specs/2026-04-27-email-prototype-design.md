# Email Prototype — Design Spec

**Date:** 2026-04-27
**Author:** Mike (operator) + Claude (sonnet/opus)
**Status:** Draft pending operator review

---

## Goal

Standalone Next.js app that demonstrates the unified-inbox UI extracted from NPR_Dashboard P4.2, deployable as its own Railway service, suitable for free-form UI/UX iteration without coupling to NPR_Dashboard internals.

Designed so the email functionality can later be lifted into its own SaaS product OR re-merged into NPR_Dashboard once UI is locked.

---

## Scope (in)

- Standalone GitHub repo `glh280/email-prototype` (or similar)
- Local working dir: `C:\npr-email-prototype`
- Deployed as new Railway service in existing `npr-dashboard-prototype` project (or new project — operator choice at deploy time)
- UI shell **bootstrapped from `glh280/npr-dashboard-prototype` branch `design-reference/prototype` @ commit `e4afe73d`**
- New routes:
  - `/` — deals list (inherited from prototype shell)
  - `/deal/[id]` — deal detail (inherited)
  - `/inbox` — **NEW** unified inbox page
- Inbox UI ported from NPR_Dashboard `master` @ commit `a7a31d9b` paths:
  - `app/(authenticated)/inbox/page.tsx` (rewritten as server component without auth)
  - `app/(authenticated)/inbox/_components/*` (rendering components only)
  - `components/inbox-header-button.tsx`
- New `InboxHeaderButton` mounted on existing `components/app-header.tsx` right slot
- Six tabs in **locked order** (matches PROD): All / By File / Multi-File / Unassigned / Team / Spam
- Priority chips, multi-file candidate chips, unassigned suggestion pills, digest panel button — all rendering from local mock data
- Search input (filters fixture array client-side; no FTS)
- Tab switching, row expand, hover preview — all client-side over fixtures

## Scope (out — explicitly deferred)

| Surface | Reason |
|---|---|
| Postgres / Drizzle / migrations | Match existing prototype pattern (mock files only) |
| `@47ng/cloak` encryption | No real NPI in fixtures |
| `npi_access_log` audit | Nothing to audit |
| Anthropic API (Haiku priority + summarize + digest) | Hardcode priority/summary fields directly in fixture data |
| SSE multiplex / `stream-registry.ts` | Static page; no live updates |
| FTS over `body_search` | Filter array client-side |
| `email_read_state` persistence | React `useState` only — refresh resets |
| CF Access middleware (`lib/access.ts`) | Open URL |
| Email send (`lib/email-send.ts`) | Compose dialog renders; Send button toasts "Sent (stub)" |
| Gmail OAuth onboarding (P4.5) | No real mailbox; fixtures only |
| Pub/Sub webhook ingestion (P4.1 plan 07) | No live ingest |
| Watch renewal cron (P4.1 plan 08) | Not applicable |
| Inbox gated banner (partner 403) | No auth roles in prototype |
| File-association confirmation (`addToFileDialog`) | UI present; click handler **no-ops + console.log** |
| Backfill / health-check / watch-renew scripts | Not applicable |

---

## Architecture

Mirrors existing prototype pattern exactly. No new abstractions.

### Data layer

Local TypeScript modules under `mock/` (matches existing prototype convention — see `mock/deals.ts`, `mock/types.ts`, `mock/helpers.ts` on the prototype branch).

```
mock/
  types.ts               # existing — extended with EmailMessage, InboxTab, PriorityTier, DigestGroup, etc.
  deals.ts               # existing — referenced for file_no in inbox rows
  helpers.ts             # existing — relativeTime() reused
  inbox.ts               # NEW — ~30 EmailMessage fixtures across 6 tabs + 4 deal_ids
  email-threads.ts       # NEW — thread fixtures (already partially exists for deal-page email-threads.tsx)
```

UI components import directly:

```ts
import { INBOX_MESSAGES } from "@/mock/inbox";
import type { EmailMessage, InboxTab } from "@/mock/types";
```

No `lib/data/*.ts` abstraction layer. No swap-able implementations. Dead simple.

### Page structure

```
app/
  layout.tsx             # existing — root layout, AppHeader NOT mounted here (each page mounts)
  page.tsx               # existing — deals list (mounts AppHeader itself)
  deal/[id]/page.tsx     # existing — deal detail
  inbox/                 # NEW
    page.tsx             # server component, mounts <AppHeader>, imports fixtures, renders <InboxSurface>
    _components/
      inbox-surface.tsx       # ported from PROD (strip server-action props)
      inbox-tab-bar.tsx       # ported verbatim
      inbox-search-bar.tsx    # ported (client-side filter only)
      inbox-email-list.tsx    # ported
      inbox-row-all.tsx       # ported
      inbox-row-byfile.tsx    # ported
      inbox-row-multi-file.tsx # ported
      inbox-row-unassigned.tsx # ported
      inbox-row-team.tsx      # ported
      inbox-row-spam.tsx      # ported
      inbox-empty-state.tsx   # ported
      priority-chip.tsx       # ported verbatim
      multi-file-candidate-chip.tsx # ported
      unassigned-suggestion-pill.tsx # ported
      inbox-digest-button.tsx # ported (opens digest panel)
      inbox-digest-panel.tsx  # ported (reads from mock/digest.ts canned response)
      inbox-compose-button.tsx # ported (opens dialog)
      inbox-compose-dialog.tsx # ported (Send → toast stub)
      add-thread-to-deal-dialog.tsx # ported — Confirm = no-op + console.log (DEAD CALL)
```

### Header integration

Modify existing `components/app-header.tsx` (prototype branch) to add `InboxHeaderButton` in top-right cluster.

```tsx
// components/app-header.tsx — modified
import { InboxHeaderButton } from "@/components/inbox-header-button";
// ... existing imports

export function AppHeader() {
  return (
    <header className="...">
      {/* ... existing left + center ... */}
      <div className="flex items-center gap-2">
        <InboxHeaderButton unreadTotal={MOCK_UNREAD_COUNT} />
        {/* ... existing nav items ... */}
      </div>
    </header>
  );
}
```

`MOCK_UNREAD_COUNT` = hardcoded constant (e.g., `12`) at top of file or in `mock/inbox.ts`. Iteration may swap to derived count from fixtures.

### Drop list (PROD components NOT ported)

| File | Reason |
|---|---|
| `inbox/actions.ts` | All server actions stubbed inline or removed |
| `inbox/_components/use-inbox-stream.ts` | No SSE |
| `inbox/_components/inbox-gated-banner.tsx` | No auth roles |
| `inbox/_components/inbox-error-state.tsx` | No async fetches that can fail |
| `inbox/_components/inbox-loading-state.tsx` | Static fixtures, no loading state |

---

## Reintegration traceability

### File header convention

Every file copied from NPR_Dashboard gets header comment:

```tsx
/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-tab-bar.tsx
 * COPIED: 2026-04-27
 * STATUS: verbatim | stripped-server-actions | stubbed
 * REINTEGRATION: when merging back, restore server-action props + SSE hook
 */
```

Status values:
- `verbatim` — byte-identical to source
- `stripped-server-actions` — server-action imports removed; UI props now plain values
- `stubbed` — behavior replaced (e.g., Send button toasts instead of calling action)
- `modified` — UI/UX iteration changed component beyond source

### Top-level manifest

`EXTRACTION-MANIFEST.md` at repo root. Table:

| Prototype path | Source path (NPR_Dashboard) | Source SHA | Status | Notes |
|---|---|---|---|---|
| `components/inbox-header-button.tsx` | `components/inbox-header-button.tsx` | `a7a31d9b` | verbatim | — |
| `app/inbox/_components/inbox-tab-bar.tsx` | `app/(authenticated)/inbox/_components/inbox-tab-bar.tsx` | `a7a31d9b` | stripped-server-actions | strip `markRead` action prop |
| ... | ... | ... | ... | ... |

Maintained by hand. Updated on every UI-iteration commit that touches a sourced file (`status` flips to `modified` + a one-line "Iter:" note in the cell).

### Dead-call register

`PROTOTYPE-DEAD-CALLS.md` at repo root. Table:

| UI surface | Dead call | Original behavior (PROD) | Reintegration |
|---|---|---|---|
| `add-thread-to-deal-dialog.tsx` Confirm button | no-op + `console.log("[stub] confirmAssociation", { messageId, dealId })` | Calls `confirmAssociation` server action → writes `email_associations` row + audits + dismisses other candidates | Restore server action import + wire to real `confirmAssociation` |
| `inbox-compose-dialog.tsx` Send button | Toast "Sent (stub)" | Calls `sendEmail` server action → Gmail API send + audit row | Restore server action import + wire to `sendEmail` |
| `inbox-row-*` mark-as-read | Local React state only | Server action `markThreadRead` upserts `email_read_state` | Restore action; remove local state |
| Search input | `INBOX_MESSAGES.filter(...)` client-side | FTS over `body_search` shadow column | Restore server action `searchInbox` |

### Why this works

When ready to reintegrate:
1. `git diff` between prototype's `EXTRACTION-MANIFEST.md` source SHA and current NPR_Dashboard `master` reveals PROD drift on each file
2. `PROTOTYPE-DEAD-CALLS.md` is the wire-up checklist for restoring real behavior
3. UI-iteration changes (status=modified) are the "deltas" to merge back into PROD's component

---

## 1-hour build checklist

| # | Step | Time | Tool |
|---|---|---|---|
| 1 | Create `C:/npr-email-prototype` working tree from `git archive origin/design-reference/prototype` (NPR_Dashboard repo, commit `e4afe73d`) into target dir | 5min | bash |
| 2 | `git init` in target; create new GitHub repo `glh280/email-prototype`; first commit; push `master` | 5min | bash + gh |
| 3 | Verify `npm install` + `npm run dev` boots prototype as-is on `localhost:3000` (deals list visible) | 5min | npm |
| 4 | Extend `mock/types.ts` with email types: `EmailMessage`, `InboxTab`, `PriorityTier`, `DigestGroup`, `MultiFileCandidate`, `UnassignedSuggestion` (copy verbatim from NPR_Dashboard `db/schema/email-types.ts` @ `a7a31d9b`, strip Drizzle imports, keep TS types only) | 10min | Read + Write |
| 5 | Create `mock/inbox.ts` with ~30 typed `EmailMessage` fixtures distributed across 6 tabs + 4 deal_ids from `mock/deals.ts` | 10min | Write |
| 6 | Copy `components/inbox-header-button.tsx` from NPR_Dashboard `master@a7a31d9b` — verbatim. Adjust `UnreadBadge` import to local path or inline a 10-line equivalent | 3min | Read + Write |
| 7 | Modify `components/app-header.tsx` (prototype) — add `<InboxHeaderButton unreadTotal={MOCK_UNREAD_COUNT} />` directly into the right-cluster JSX (NOT as a `rightSlot` prop — every page that mounts `<AppHeader />` then gets the button automatically without per-page changes) | 3min | Edit |
| 8 | Create `app/inbox/page.tsx` — server component; imports fixtures; renders `<InboxSurface>` with hardcoded user `{ id: "prototype", role: "internal" }` | 5min | Write |
| 9 | Copy + strip ~15 inbox `_components/*` files from NPR_Dashboard `master@a7a31d9b`. For each: drop server-action props, replace with local handlers (no-ops or React state) | 10min | Read + Write loop |
| 10 | Add header comments to every copied file per convention above | 3min | Edit |
| 11 | Write `EXTRACTION-MANIFEST.md` + `PROTOTYPE-DEAD-CALLS.md` (table skeletons + filled rows for L1) | 3min | Write |
| 12 | `npm run dev` smoke test: navigate to `/`, click inbox button → `/inbox` renders, all 6 tabs cycle, search filters, digest button opens panel | 5min | manual |
| 13 | `git add . && git commit && git push` | 2min | git |
| 14 | Railway: add new service to existing `npr-dashboard-prototype` project pointing at `glh280/email-prototype` `master` branch; deploy; verify deployed URL renders | 5min | railway CLI |

**Total: ~60–75 min** if no port snags.

### Snag probability + mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| `_components/*.tsx` import server actions or `getCurrentUser` etc. — must be ripped out | High | Budget extra 15min; replace imports with hardcoded values + local handlers |
| `shadcn/ui` components used by inbox not yet in prototype shell | Medium | Run `npx shadcn add <component>` as needed; recheck `components.json` |
| `UnreadBadge` (from `app/_components/chat/unread-badge.tsx`) is chat-coupled in PROD | Low | Inline a minimal version in prototype: `<span>{count > 0 && count}</span>` |
| Tailwind classes use PROD-only theme tokens | Low | Prototype uses Tailwind 4 like PROD; classes should resolve |
| `next@16.2.4` API contract differences | Low | Both prototype + PROD use same version |

### Acceptance criteria for L1 ship

- [ ] `npm run build` succeeds
- [ ] `npm run dev` boots; `/` renders deals list (unchanged)
- [ ] Click inbox icon top-right → navigates to `/inbox`
- [ ] All 6 tabs cycle and show distinct fixture sets
- [ ] Priority chips render in HIGH/MED/LOW with reasons
- [ ] Multi-File tab shows candidate chips
- [ ] Unassigned tab shows suggestion pills
- [ ] Spam tab shows muted opacity rows, no priority chips
- [ ] Search input filters fixtures
- [ ] Digest button opens panel with grouped fixture summary
- [ ] Compose dialog opens; Send button toasts "Sent (stub)"
- [ ] Confirm-association dialog opens; Confirm button no-ops + console.logs
- [ ] Deployed URL on Railway renders identical to local
- [ ] `EXTRACTION-MANIFEST.md` + `PROTOTYPE-DEAD-CALLS.md` exist and reflect L1 reality

---

## Future layers (out of scope for this spec)

If/when scope expands, these layers plug in additively without rewriting L1:

- **L2 — DB-backed reads:** Postgres + Drizzle, schema port, fixtures become seeded rows tagged `is_test_fixture=true`, `npm run prototype:purge` script
- **L3 — Mutating actions:** server actions for read state, association confirm (still dead-call for SaaS), real client-server roundtrips
- **L4 — AI + encryption + audit:** Anthropic Haiku, `@47ng/cloak`, `npi_access_log`
- **L5 — SSE live updates:** stream-registry multiplex
- **L6 — Auth:** CF Access OR basic password gate
- **L7 — Real Gmail ingestion:** OAuth + Pub/Sub webhook

Each layer = its own spec doc when triggered. Current spec covers L1 only.

---

## UI/UX iteration discipline

Even at L1 scope, two rules prevent reintegration drift:

**Rule 1 — Type-first edits.** Any new field added to a UI component during iteration must FIRST extend the relevant type in `mock/types.ts`, then update fixtures. This way fixtures stay schema-shaped and reintegration to L2's DB schema is mechanical.

**Rule 2 — Status flip on edit.** When iteration modifies a sourced file, flip its `EXTRACTION-MANIFEST.md` row status to `modified` and add a one-line "Iter:" note. This is the punch list when reintegrating PROD.

A small **Contract Change Log** at top of `mock/types.ts`:

```ts
// CHANGE LOG
// 2026-04-27 — initial port from NPR_Dashboard@a7a31d9b
// (add entries below as iteration extends types)
```

---

## Reintegration paths

### Path A — re-merge into NPR_Dashboard

When UI is locked, merge prototype changes back into NPR_Dashboard PROD:

1. For each `modified` row in `EXTRACTION-MANIFEST.md`, diff prototype file against PROD source (current SHA, not bootstrap SHA — accounts for PROD drift since 2026-04-27)
2. Apply UI-only deltas to PROD file (server-action wiring stays PROD-side)
3. Walk `mock/types.ts` Change Log → ensure each new field has corresponding column in PROD `email_messages` schema (migration if needed)
4. Walk `PROTOTYPE-DEAD-CALLS.md` → verify each dead call has live counterpart in PROD (should already; nothing to add)

### Path B — extract as SaaS

When ready to spin out as standalone product:

1. Already standalone (own repo, own Railway service)
2. Add L2-L7 layers per their own specs
3. Genericize file-association: rename `confirmAssociation(messageId, dealId)` → `assignToRecord(messageId, recordId)`; deal_id becomes opaque FK to customer-defined entity
4. Add multi-tenant data partitioning (out of scope here)

---

## Risks

- **PROD drift during iteration.** NPR_Dashboard `master` advances daily. Manifest source SHAs go stale. Acceptable for L1 (no reintegration yet); becomes critical at reintegration time. Mitigation: refresh manifest SHAs before reintegration starts.
- **UI iteration outpaces type updates.** Engineer adds inline JSX hardcoded values without extending `mock/types.ts`. Result: fixtures and L2 DB schema drift apart. Mitigation: Rule 1 above + spot check during code review.
- **Compose-dialog send stub gets reused as real send.** Engineer thinks "this works" because toast fires. Mitigation: Dead-call register + visible "(stub)" suffix in toast text.

---

## Open questions

(none at spec time — answer before execution)

- [ ] Railway: new project OR new service in existing `npr-dashboard-prototype` project? (Operator preference — affects deploy URL pattern)
- [ ] GitHub repo name: `glh280/email-prototype` OR alternative?
- [ ] Custom domain or default `*.up.railway.app`?

---

## Approval

Operator sign-off required before execution.
