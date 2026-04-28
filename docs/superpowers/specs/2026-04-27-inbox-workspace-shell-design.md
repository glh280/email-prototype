# Inbox `/inbox2` Workspace Shell — Design (Phase 1)

**Date:** 2026-04-27
**Status:** Approved, ready for implementation plan
**Scope:** UI/UX iteration on email-prototype L1
**Toggle:** `/inbox` (Classic) ↔ `/inbox2` (Workspace) — cookie-persisted

## 1. Goal

Add a Missive-style "Workspace" shell at a new `/inbox2` route, switchable from the existing `/inbox` page via a `[ Classic | Workspace ]` segmented toggle next to the page title. `/inbox` is left unchanged. The new shell introduces a context hierarchy (workspace · account · group · view) so the user always knows what mailbox, team, and queue they are looking at.

## 2. Non-Goals (out of scope this phase)

- Real thread preview rendering in the right pane
- Real filter / search wiring (clicks log + toast only)
- Drag-and-drop, keyboard navigation, multi-select actions
- Responsive breakpoints below 1024 px
- Real notification panel · settings panel
- Real permissions enforcement (account/group ACLs)

These belong to Phase 2+ and are not blockers for Phase 1 sign-off.

## 3. Architecture

### 3.1 Routes

| Route | Component | Behavior |
|---|---|---|
| `/inbox` | existing `app/inbox/page.tsx` | Unchanged. Renders `<InboxSurface>` as today. |
| `/inbox2` | new `app/inbox2/page.tsx` | Renders new `<Inbox2Shell>` from `app/inbox2/_components/`. |

### 3.2 View toggle

- Component: `components/inbox-view-toggle.tsx` (shared, used on both pages).
- Visual: segmented control with two halves: `[ Classic | Workspace ]`.
- Active half = current pathname (`usePathname()`).
- Click on inactive half:
  1. Set cookie `npr-inbox-view=classic|workspace` (path=/, max-age 1 year).
  2. `router.push('/inbox')` or `router.push('/inbox2')`.

### 3.3 Persistence (no-flicker)

Both `/inbox/page.tsx` and `/inbox2/page.tsx` are server components. Each reads the cookie before render:

```ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const view = cookies().get("npr-inbox-view")?.value;
// /inbox page: if view === "workspace" → redirect("/inbox2")
// /inbox2 page: if view === "classic" → redirect("/inbox")
```

Bookmarks remain valid; cookie wins on revisit.

## 4. `/inbox2` shell layout

```
┌──────────────────────────────────────────────────────────────────┐
│ TopBar:  [Workspace label]  [Account ▾]  [Group ▾]  ··· [Compose] [🔔] [Avatar ▾] │
├──────────────────────────────────────────────────────────────────┤
│ ContextLine:  Workspace · Account · Group · View                 │
├────────┬───────────────────────────────────────┬─────────────────┤
│        │ Sub-header: filter chips · search · placeholder actions │
│ Nav    │ ┌───────────────────────────────────┐                   │
│ Rail   │ │ Message list (dense Workspace rows)│  Preview pane    │
│        │ │ ...                                │  (placeholder)   │
│        │ └───────────────────────────────────┘                   │
└────────┴───────────────────────────────────────┴─────────────────┘
```

The top bar holds **global scope** (workspace · account · group · global actions).
The compact **context line** directly under the top bar restates the scope as text so the user can confirm at a glance what they are looking at.
The left rail holds **navigation mode** (which view).
The sub-header holds **local filters** for the active view.
The main list shows **queue items**.
The preview pane shows the **selected thread** (placeholder in Phase 1).

## 5. Components (`app/inbox2/_components/`)

| Component | Role | Phase 1 behavior |
|---|---|---|
| `inbox2-shell.tsx` | Top-level grid + state owner | Owns `Inbox2ShellState`. Lays out top bar / context line / rail / main / preview. |
| `inbox2-top-bar.tsx` | Workspace label · account selector · group selector · compose · notifications · avatar | Renders sub-components; emits change events to shell. |
| `inbox2-account-selector.tsx` | Account dropdown | Shows current; click options → `onAccountChange`. |
| `inbox2-group-selector.tsx` | Group dropdown | Shows current with member count if available; click → `onGroupChange`. |
| `inbox2-context-line.tsx` | Compact text strip "Workspace · Account · Group · View" | Reads shell state, renders dot-separated. |
| `inbox2-nav-rail.tsx` | Left vertical nav | Renders `NAV_VIEWS`; active highlight by `navView`; click → `onNavChange`. |
| `inbox2-sub-header.tsx` | Filter chips · search input · placeholder action buttons | Local layout only; chip/search clicks are stubs. |
| `inbox2-message-list.tsx` | Scrollable container | Reads `INBOX_ROWS` filtered by `accountId` + `groupId` + `navView`; renders rows. |
| `inbox2-message-row.tsx` | Dense single-line row | sender · subject · snippet · time. Click → `onSelect(messageId)`. |
| `inbox2-preview-pane.tsx` | Right placeholder | Empty state if `selectedMessageId === null`; else shows placeholder card with id + close button. |

The shared toggle lives at `components/inbox-view-toggle.tsx`, reused by `/inbox` (next to `<h1>Inbox</h1>`) and `/inbox2` (next to its top-bar workspace label).

## 6. Shell state (`Inbox2Shell`)

```ts
type Inbox2ShellState = {
  accountId: Account["id"];
  groupId: Group["id"];
  navView: NavView;
  selectedMessageId: InboxRow["messageId"] | null;
};
```

State lives in `Inbox2Shell` (`useState`). Children receive props + change handlers. No URL state in Phase 1; refresh resets `selectedMessageId` and resets nav/account/group to defaults from `mock/inbox2.ts`.

## 7. Type updates (`mock/types.ts` CHANGE LOG entry)

Append to existing CHANGE LOG:

```ts
// 2026-04-27 — /inbox2 Workspace shell (phase 1)
//   Sources: new (no PROD source — net-new shell)
//   - Account: connected mailbox identity
//   - Group: shared inbox / team context, with kind discriminator
//   - WorkspaceContext: active account + group + workspace label
//   - NavView: extends InboxTab with sent | drafts | settings
//   - Inbox2ShellState: shell-owned UI state (accountId, groupId, navView, selectedMessageId)
//   - InboxRow: extended with optional accountId + groupId so rows can scope to context
```

New types:

```ts
export type Account = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
};

export type GroupKind = "track" | "team" | "other";

export type Group = {
  id: string;
  name: string;
  kind: GroupKind;
  /** Set when kind === "track". */
  track?: Track;
  memberCount: number;
  /** Optional unread count if cheap to derive. */
  unreadCount?: number;
};

export type WorkspaceContext = {
  accountId: Account["id"];
  groupId: Group["id"];
  workspaceLabel: string;
};

export type NavView = InboxTab | "sent" | "drafts" | "settings";

export const NAV_VIEW_ORDER: readonly NavView[] = [
  "all",
  "by-file",
  "multi-file",
  "unassigned",
  "team",
  "spam",
  "sent",
  "drafts",
  "settings",
] as const;

export type Inbox2ShellState = {
  accountId: Account["id"];
  groupId: Group["id"];
  navView: NavView;
  selectedMessageId: InboxRow["messageId"] | null;
};
```

`InboxRow` gets two new optional fields (additive only — Classic shell ignores them):

```ts
export type InboxRow = {
  // ... existing fields ...
  /** Which connected account this row belongs to. */
  accountId?: Account["id"];
  /** Which group/team owns this row. */
  groupId?: Group["id"];
};
```

## 8. Mock data (`mock/inbox2.ts`, new)

```ts
export const WORKSPACE_LABEL = "NPR Funding";

export const ACCOUNTS: Account[] = [
  { id: "acct-mike",   email: "mike@nprfunding.com",  displayName: "Mike Miller" },
  { id: "acct-carrie", email: "carrie@uts.com",       displayName: "Carrie Davis" },
];

export const GROUPS: Group[] = [
  { id: "grp-title",       name: "Title",        kind: "track", track: "TI", memberCount: 4 },
  { id: "grp-lending",     name: "Lending",      kind: "track", track: "LN", memberCount: 5 },
  { id: "grp-deal-desk",   name: "Deal Desk",    kind: "track", track: "DD", memberCount: 3 },
  { id: "grp-consulting",  name: "Consulting",   kind: "track", track: "CS", memberCount: 2 },
  { id: "grp-partnership", name: "Partnership",  kind: "track", track: "PT", memberCount: 2 },
];

export const DEFAULT_ACCOUNT_ID = "acct-mike";
export const DEFAULT_GROUP_ID   = "grp-lending";
export const DEFAULT_NAV_VIEW: NavView = "all";

export const NAV_VIEW_LABEL: Record<NavView, string> = {
  "all": "Inbox",
  "by-file": "By File",
  "multi-file": "Multi-File",
  "unassigned": "Unassigned",
  "team": "Team",
  "spam": "Spam",
  "sent": "Sent",
  "drafts": "Drafts",
  "settings": "Settings",
};

export const MOCK_NOTIFICATION_COUNT = 3;
```

`mock/inbox.ts`: each existing `INBOX_ROWS` entry annotated with `accountId` (one of the two accounts) + `groupId` (one of the five groups) so the message list can scope by context.

## 9. Toggle click + cookie

`components/inbox-view-toggle.tsx`:

- Client component (`"use client"` directive — needs `usePathname`, click handler, `document.cookie`).
- Reads `usePathname()` to determine active half.
- Click writes cookie via `document.cookie = "npr-inbox-view=workspace; path=/; max-age=31536000; samesite=lax"` then `router.push("/inbox2")` (or inverse).

## 10. Dead-call register additions (`PROTOTYPE-DEAD-CALLS.md`)

Append (numbering continues from existing 1–10):

| # | File | Trigger | Stub | PROD restoration |
|---|---|---|---|---|
| 11 | `components/inbox-view-toggle.tsx` | Click inactive half | Set cookie + `router.push`; console.log toggle event | unchanged (toggle is L1-only; remove or keep based on Phase 2 decision) |
| 12 | `app/inbox2/_components/inbox2-account-selector.tsx` | Account change | `setAccountId` in shell + console.log + toast | switch active mailbox context (Gmail OAuth identity) |
| 13 | `app/inbox2/_components/inbox2-group-selector.tsx` | Group change | `setGroupId` in shell + console.log + toast | switch active group context |
| 14 | `app/inbox2/_components/inbox2-nav-rail.tsx` | Nav rail click | `setNavView` in shell (no router push) | URL `/inbox2/<view>` push |
| 15 | `app/inbox2/_components/inbox2-sub-header.tsx` | Filter chip click | console.log + toast | URL filter state |
| 16 | `app/inbox2/_components/inbox2-sub-header.tsx` | Search input | console.log on submit only (no client filter) | server FTS |
| 17 | `app/inbox2/_components/inbox2-top-bar.tsx` | Notifications icon click | console.log + toast | notification panel |
| 18 | `app/inbox2/_components/inbox2-top-bar.tsx` | Avatar menu click | console.log + toast | account / logout menu |
| 19 | `app/inbox2/_components/inbox2-message-row.tsx` | Row click | `setSelectedMessageId` in shell + console.log | open thread reader (mark-read + load body) |
| 20 | `app/inbox2/_components/inbox2-preview-pane.tsx` | Close button click | `setSelectedMessageId(null)` + console.log | close preview / clear thread state |

Compose button reuses existing `<InboxComposeButton>` (already registered as dead call #4) — no new entry.

## 11. Manifest updates (`EXTRACTION-MANIFEST.md`)

Add a new section after the Inbox surface tables:

```
## Inbox2 surface (L1 — new, no PROD source)

All under `app/inbox2/_components/`:

| File | Status | Notes |
|---|---|---|
| `../page.tsx` | new | Reads cookie, redirects to /inbox if classic |
| `inbox2-shell.tsx` | new | Owns Inbox2ShellState |
| `inbox2-top-bar.tsx` | new | — |
| `inbox2-account-selector.tsx` | new | Stub onChange |
| `inbox2-group-selector.tsx` | new | Stub onChange |
| `inbox2-context-line.tsx` | new | Reads shell state |
| `inbox2-nav-rail.tsx` | new | Local navView state |
| `inbox2-sub-header.tsx` | new | Stubbed filters/search |
| `inbox2-message-list.tsx` | new | Filters INBOX_ROWS by account+group+nav |
| `inbox2-message-row.tsx` | new | Dense single-line layout |
| `inbox2-preview-pane.tsx` | new | Placeholder card |

| Path | Status | Notes |
|---|---|---|
| `mock/inbox2.ts` | new | Accounts, Groups, defaults, nav labels, notif count |
| `components/inbox-view-toggle.tsx` | new | Cookie-persisted segmented control |
```

`/inbox/page.tsx` row in existing manifest: status flips from `stripped-server-actions` → `modified` with note `Iter: read npr-inbox-view cookie + redirect to /inbox2 when set; render <InboxViewToggle> next to <h1>`.

`mock/inbox.ts` flips from `new` to `modified` with note `Iter: each row carries accountId + groupId for /inbox2 scoping`.

`mock/types.ts` flips from `new` to `modified` with note `Iter: Account, Group, WorkspaceContext, NavView, Inbox2ShellState; InboxRow.accountId/groupId optional`.

## 12. Acceptance criteria (Phase 1 done)

1. `/inbox` renders identically to today, with `[ Classic | Workspace ]` toggle next to title; "Classic" half active.
2. Clicking "Workspace" navigates to `/inbox2` and sets cookie.
3. `/inbox2` renders top bar, context line, left rail, sub-header, message list (dense rows), and preview pane (empty).
4. Account dropdown, group dropdown, nav rail, filter chips, search, notifications, avatar, message-row click, preview-pane close — every stub fires console.log + (where listed) a toast.
5. Refreshing `/inbox` while cookie is `workspace` lands on `/inbox2` with no flicker (server redirect).
6. Refreshing `/inbox2` while cookie is `classic` lands on `/inbox` with no flicker.
7. `npm run build` passes.
8. `mock/types.ts` CHANGE LOG, `EXTRACTION-MANIFEST.md`, `PROTOTYPE-DEAD-CALLS.md` updated per sections 7, 10, 11.

## 13. Open questions

None — all clarifications resolved during brainstorming.
