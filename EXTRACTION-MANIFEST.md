# Extraction Manifest — Email Prototype

Maps every prototype file to its NPR_Dashboard source for reintegration. See [docs/superpowers/specs/2026-04-27-email-prototype-design.md](docs/superpowers/specs/2026-04-27-email-prototype-design.md) for the layered design rationale.

## Source SHAs (frozen at L1 bootstrap)

- **UI shell:** `glh280/npr-dashboard-prototype` branch `design-reference/prototype` @ commit `e4afe73d`
- **Inbox components:** `glh280/npr-dashboard-prototype` branch `master` @ commit `a7a31d9b`

When PROD drift accumulates, refresh these SHAs and diff each `verbatim`/`stripped-server-actions` row against the new HEAD before reintegrating.

## Status legend

| Status | Meaning |
|---|---|
| `verbatim` | Byte-identical to source |
| `stripped-server-actions` | Server-action imports + handlers removed; UI props now plain values + callbacks |
| `stubbed` | Behavior replaced (e.g., Send button toasts instead of calling action) |
| `modified` | UI/UX iteration changed component beyond source |
| `new` | Has no PROD source — written for L1 (e.g., mock fixtures) |

## File map

### Foundation

| Prototype path | Source path | Source SHA | Status | Notes |
|---|---|---|---|---|
| `mock/types.ts` (email types section) | `db/schema/email-types.ts` + `lib/email-query.ts` (InboxRow shape) + `lib/filter-params.ts` (InboxTab) | `a7a31d9b` | new | TS-only types; Drizzle imports stripped |
| `mock/inbox.ts` | (no PROD source — fixtures replace `queryInboxForUser`) | — | new | L1 hardcoded data |
| `.env.local` | `.env.example` (template) | `a7a31d9b` | stubbed | DB + CF Access values are stubs (inert in L1) |
| `components/ui/tooltip.tsx` | `components/ui/tooltip.tsx` | `a7a31d9b` | verbatim | base-ui wrapper |
| `components/inbox-header-button.tsx` | `components/inbox-header-button.tsx` | `a7a31d9b` | stubbed | UnreadBadge inlined (chat surface not ported) |
| `components/app-header.tsx` | (extends prototype-branch existing file) | `e4afe73d` | modified | Added InboxHeaderButton to right cluster |

### Inbox surface

| Prototype path | Source path | Source SHA | Status | Notes |
|---|---|---|---|---|
| `app/inbox/page.tsx` | `app/(authenticated)/inbox/page.tsx` | `a7a31d9b` | stripped-server-actions | No CF Access, no DB queries, no URL filter parsing |
| `app/inbox/_components/inbox-surface.tsx` | `app/(authenticated)/inbox/_components/inbox-surface.tsx` | `a7a31d9b` | stripped-server-actions | URL state → useState; no SSE; no surfaceState machine |
| `app/inbox/_components/inbox-tab-bar.tsx` | `app/(authenticated)/inbox/_components/inbox-tab-bar.tsx` | `a7a31d9b` | stripped-server-actions | URL push → onTabChange callback |
| `app/inbox/_components/inbox-search-bar.tsx` | `app/(authenticated)/inbox/_components/inbox-search-bar.tsx` | `a7a31d9b` | stripped-server-actions | URL push → callback props |
| `app/inbox/_components/inbox-email-list.tsx` | `app/(authenticated)/inbox/_components/inbox-email-list.tsx` | `a7a31d9b` | stripped-server-actions | Types swapped to mock/types; onMarkRead prop chain added |
| `app/inbox/_components/inbox-empty-state.tsx` | `app/(authenticated)/inbox/_components/inbox-empty-state.tsx` | `a7a31d9b` | verbatim | Per-tab tailored copy from UI-SPEC |
| `app/inbox/_components/priority-chip.tsx` | `app/(authenticated)/inbox/_components/priority-chip.tsx` | `a7a31d9b` | verbatim | — |
| `app/inbox/_components/multi-file-candidate-chip.tsx` | `app/(authenticated)/inbox/_components/multi-file-candidate-chip.tsx` | `a7a31d9b` | new | L1 written from spec; PROD source not read in detail |
| `app/inbox/_components/unassigned-suggestion-pill.tsx` | `app/(authenticated)/inbox/_components/unassigned-suggestion-pill.tsx` | `a7a31d9b` | new | L1 written from spec; PROD source not read in detail |

### Row components

| Prototype path | Source path | Source SHA | Status | Notes |
|---|---|---|---|---|
| `app/inbox/_components/inbox-row-all.tsx` | `app/(authenticated)/inbox/_components/inbox-row-all.tsx` | `a7a31d9b` | stripped-server-actions | `markThreadRead` → local useState; chat-coupled UnreadBadge inlined |
| `app/inbox/_components/inbox-row-byfile.tsx` | `app/(authenticated)/inbox/_components/inbox-row-byfile.tsx` | `a7a31d9b` | stripped-server-actions | onMarkRead prop chain |
| `app/inbox/_components/inbox-row-multi-file.tsx` | `app/(authenticated)/inbox/_components/inbox-row-multi-file.tsx` | `a7a31d9b` | stubbed | Confirm = no-op + console.log + alert |
| `app/inbox/_components/inbox-row-unassigned.tsx` | `app/(authenticated)/inbox/_components/inbox-row-unassigned.tsx` | `a7a31d9b` | stubbed | Confirm = no-op; Add-to-File opens dialog |
| `app/inbox/_components/inbox-row-team.tsx` | `app/(authenticated)/inbox/_components/inbox-row-team.tsx` | `a7a31d9b` | verbatim | Delegates to InboxRowAll |
| `app/inbox/_components/inbox-row-spam.tsx` | `app/(authenticated)/inbox/_components/inbox-row-spam.tsx` | `a7a31d9b` | stripped-server-actions | No mark-read in PROD spam path either |

### Dialogs

| Prototype path | Source path | Source SHA | Status | Notes |
|---|---|---|---|---|
| `app/inbox/_components/inbox-digest-button.tsx` | `app/(authenticated)/inbox/_components/inbox-digest-button.tsx` | `a7a31d9b` | stripped-server-actions | Opens panel only |
| `app/inbox/_components/inbox-digest-panel.tsx` | `app/(authenticated)/inbox/_components/inbox-digest-panel.tsx` | `a7a31d9b` | stripped-server-actions | Reads MOCK_DIGEST instead of `getDigestForUser` |
| `app/inbox/_components/inbox-compose-button.tsx` | `app/(authenticated)/inbox/_components/inbox-compose-button.tsx` | `a7a31d9b` | verbatim | — |
| `app/inbox/_components/inbox-compose-dialog.tsx` | `app/(authenticated)/inbox/_components/inbox-compose-dialog.tsx` | `a7a31d9b` | stubbed | Send → toast "Sent (stub)" |
| `app/inbox/_components/add-thread-to-deal-dialog.tsx` | `app/(authenticated)/inbox/_components/add-thread-to-deal-dialog.tsx` | `a7a31d9b` | stubbed | **Primary dead call** per spec — Confirm = no-op |

### NOT ported (drop list)

These PROD components have no L1 equivalent. Restoration is part of L2+:

- `inbox/actions.ts` — server actions (markThreadRead, sendEmail, confirmAssociation, getDigestForUser, addThreadToFile)
- `inbox/_components/use-inbox-stream.ts` — SSE hook
- `inbox/_components/inbox-gated-banner.tsx` — partner 403 banner (no auth roles in L1)
- `inbox/_components/inbox-error-state.tsx` — async-fetch error states (no async fetches in L1)
- `inbox/_components/inbox-loading-state.tsx` — async-fetch loading states
- `app/_components/chat/unread-badge.tsx` — chat surface dependency (inlined where used)
- `app/_components/chat/disconnected-banner.tsx` — chat-SSE dependency

### Planned refresh trigger

Refresh manifest source SHAs when ANY of:

- L2 (DB-backed reads) starts — needs current schema migration set
- A reintegration session is opened (full re-diff against HEAD)
- A PROD bug is fixed in a manifested component (cherry-pick into prototype)
