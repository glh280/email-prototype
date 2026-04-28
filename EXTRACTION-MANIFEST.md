# Extraction Manifest — Email Prototype

Per-file source-tracking for reintegration. Spec: [docs/superpowers/specs/2026-04-27-email-prototype-design.md](docs/superpowers/specs/2026-04-27-email-prototype-design.md).

**Bootstrap SHAs** (frozen at L1; refresh before reintegration):
- Shell: `glh280/npr-dashboard-prototype` `design-reference/prototype` @ `e4afe73d`
- Inbox: `glh280/npr-dashboard-prototype` `master` @ `a7a31d9b`

**Status:** `verbatim` byte-identical · `stripped-server-actions` action imports/handlers removed · `stubbed` behavior replaced · `modified` UI iterated beyond source · `new` no PROD source.

## Foundation

| Prototype path | Source | SHA | Status | Notes |
|---|---|---|---|---|
| `mock/types.ts` (email types) | `db/schema/email-types.ts` + `lib/email-query.ts` (InboxRow) + `lib/filter-params.ts` (InboxTab) | `a7a31d9b` | modified | Iter: Account, Group, WorkspaceContext, NavView, Inbox2ShellState; InboxRow.accountId/groupId optional |
| `mock/inbox.ts` | — | — | modified | Iter: each row carries accountId + groupId for /inbox2 scoping |
| `.env.local` | `.env.example` | `a7a31d9b` | stubbed | Inert stubs |
| `components/ui/tooltip.tsx` | same | `a7a31d9b` | verbatim | base-ui |
| `components/inbox-header-button.tsx` | same | `a7a31d9b` | stubbed | UnreadBadge inlined |
| `components/app-header.tsx` | (extends prototype-branch) | `e4afe73d` | modified | Added InboxHeaderButton |

## Inbox surface

All under `app/inbox/_components/` ← `app/(authenticated)/inbox/_components/` @ `a7a31d9b`:

| File | Status | Notes |
|---|---|---|
| `../page.tsx` | modified | Iter: read npr-inbox-view cookie + redirect to /inbox2 when set |
| `inbox-surface.tsx` | modified | Iter: mounts <InboxViewToggle> next to <h1> |
| `inbox-tab-bar.tsx` | stripped-server-actions | URL push → onTabChange |
| `inbox-search-bar.tsx` | stripped-server-actions | URL push → callback props |
| `inbox-email-list.tsx` | stripped-server-actions | Types → mock/types; onMarkRead prop chain |
| `inbox-empty-state.tsx` | verbatim | — |
| `priority-chip.tsx` | verbatim | — |
| `multi-file-candidate-chip.tsx` | new | Written from spec |
| `unassigned-suggestion-pill.tsx` | new | Written from spec |

## Row components (`app/inbox/_components/`)

| File | Status | Notes |
|---|---|---|
| `inbox-row-all.tsx` | stripped-server-actions | markThreadRead → useState; UnreadBadge inlined |
| `inbox-row-byfile.tsx` | stripped-server-actions | onMarkRead chain |
| `inbox-row-multi-file.tsx` | stubbed | Confirm = no-op + console.log + alert |
| `inbox-row-unassigned.tsx` | stubbed | Confirm = no-op; Add-to-File opens dialog |
| `inbox-row-team.tsx` | verbatim | Delegates to InboxRowAll |
| `inbox-row-spam.tsx` | stripped-server-actions | No mark-read in PROD spam path |

## Dialogs (`app/inbox/_components/`)

| File | Status | Notes |
|---|---|---|
| `inbox-digest-button.tsx` | stripped-server-actions | Opens panel only |
| `inbox-digest-panel.tsx` | stripped-server-actions | Reads MOCK_DIGEST |
| `inbox-compose-button.tsx` | verbatim | — |
| `inbox-compose-dialog.tsx` | stubbed | Send → toast "Sent (stub)" |
| `add-thread-to-deal-dialog.tsx` | stubbed | **PRIMARY DEAD CALL** — Confirm = no-op |

## Inbox2 surface (L1 — new, no PROD source)

Phase 1 of the Workspace shell at `/inbox2`. Toggled from `/inbox` via the
cookie-persisted `<InboxViewToggle>`. All files net-new for L1.

| File | Status | Notes |
|---|---|---|
| `app/inbox2/page.tsx` | new | Reads `npr-inbox-view` cookie + redirects to /inbox when classic |
| `app/inbox2/_components/inbox2-shell.tsx` | new | Owns `Inbox2ShellState`; lays out top bar + 3-pane resizable body. Iter (2026-04-27): swapped fixed grid for resizable body — right pane now largest by default (Missive/Outlook layout). Iter (2026-04-27): Missive realignment — context line dropped; nav rail receives groups + groupBadges; top bar trimmed to actions. |
| `app/inbox2/_components/inbox2-resizable-body.tsx` | new | 3-pane resizable container; px constraints (left 200..320, center 380..520, right >=420 flex-1); pointer-capture drag; ResizeObserver auto-shrinks left/center on viewport shrink so right keeps its minimum. |
| `app/inbox2/_components/inbox2-top-bar.tsx` | new | Iter (2026-04-27): Missive realignment — top bar owns ACTIONS only. Layout: [Classic\|Workspace] · Compose · Search input · Filter dropdown · spacer · Account · Notifications · Avatar. View / workspace / group selectors removed (nav rail concerns). |
| `app/inbox2/_components/inbox2-account-selector.tsx` | new | Stubbed onChange — `inbox2-account-selector change` console.log + toast |
| `app/inbox2/_components/inbox2-nav-rail.tsx` | new | Iter (2026-04-27): Missive realignment — NavView union shrunk to 8 left-rail items (Inbox / Team Inboxes / Calendars / Assigned to me / Assigned to others / Comments / Trash / Spam). New "Custom Groups" section at bottom owns group selection (formerly top-bar dropdown). Click stubbed for both views and groups. |
| `app/inbox2/_components/inbox2-sub-header.tsx` | new | Iter (2026-04-27): Missive realignment — search + filter chips moved to top bar. Now: title + thread count + Mark all read / Refresh / Sort actions only. |
| `app/inbox2/_components/inbox2-message-list.tsx` | new | Filters INBOX_ROWS by accountId + groupId + navView. Iter (2026-04-27): NavView union shrunk; only "inbox" and "spam" map to mock data (via NAV_VIEW_TO_INBOX_TAB), other views show "no mock data" placeholder until Phase 2+. |
| `app/inbox2/_components/inbox2-message-row.tsx` | new | Dense single-line row (sender · subject · snippet · time) |
| `app/inbox2/_components/inbox2-preview-pane.tsx` | new | Placeholder reader card; close stubbed. Iter (2026-04-27): drop `border-l` (divider owns line). |

| Path | Status | Notes |
|---|---|---|
| `mock/inbox2.ts` | new | Accounts, Groups (5 deal tracks), defaults, NAV_VIEW_LABEL, MOCK_NOTIFICATION_BADGE (ViewBadge), NAV_VIEW_BADGES, GROUP_BADGES. Iter (2026-04-27): notification count → ViewBadge; added per-view nav-rail badges. Iter (2026-04-27): Missive realignment — NAV_VIEW_LABEL keys rewritten for new union; DEFAULT_NAV_VIEW now "inbox"; added GROUP_BADGES for nav-rail Custom Groups section. |
| `components/inbox-view-toggle.tsx` | new | Cookie-persisted segmented control [Classic \| Workspace] |
| `lib/inbox-view-cookie.ts` | new | Shared cookie name + value union — kept out of the toggle module so server pages can import without crossing the use-client boundary |

## NOT ported (L2+ restoration)

- `inbox/actions.ts` — server actions (markThreadRead, sendEmail, confirmAssociation, getDigestForUser, addThreadToFile)
- `inbox/_components/use-inbox-stream.ts` — SSE
- `inbox/_components/inbox-gated-banner.tsx` — partner 403 (no auth roles in L1)
- `inbox/_components/inbox-error-state.tsx`, `inbox-loading-state.tsx` — async-fetch states
- `app/_components/chat/unread-badge.tsx`, `disconnected-banner.tsx` — chat surface deps

## Refresh trigger

Refresh bootstrap SHAs when: L2 starts · reintegration session opens · PROD bug fixed in a manifested component.
