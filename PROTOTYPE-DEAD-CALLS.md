# Prototype Dead Calls

Catalog of stubbed surfaces in this prototype. Each row is a checklist item for reintegration into NPR_Dashboard or expansion into L2+.

## Why this exists

Per the design spec, file-association is the user's "leave dead, reactivate later" surface. This file is the wire-up checklist for restoring real behavior across all stubs (not just file-assignment) when promoting from L1 → L2+.

## Convention

Every dead call:

1. Runs a `console.log("[stub] <action>", payload)` so devtools shows what would have happened
2. Emits a user-facing signal — `toast.success(...)` for non-blocking, `alert(...)` for blocking confirm flows
3. References this file in a SOURCE: header comment

## Dead call register

### 1. AddThreadToDealDialog — Confirm

| Prop | Value |
|---|---|
| **File** | `app/inbox/_components/add-thread-to-deal-dialog.tsx` |
| **Stub trigger** | Confirm button click with non-empty query |
| **Stub behavior** | `console.log("[stub] addThreadToFile", { threadId, messageId, query })` + toast |
| **PROD behavior** | Calls `addThreadToFile` server action → writes `email_associations` row with source='manual' + audits + invalidates inbox query |
| **PROD source** | `app/(authenticated)/inbox/actions.ts` `addThreadToFile` |
| **Restoration** | Restore action import + replace `handleConfirm` body with `await addThreadToFile({ threadId, messageId, dealId })` |
| **Priority** | **PRIMARY DEAD CALL** — flagged in spec as deliberately deferred |

### 2. InboxRowMultiFile — Candidate chip Confirm

| Prop | Value |
|---|---|
| **File** | `app/inbox/_components/inbox-row-multi-file.tsx` |
| **Stub trigger** | Click any candidate chip |
| **Stub behavior** | `console.log("[stub] confirmAssociation (multi-file)", ...)` + alert |
| **PROD behavior** | `confirmAssociation` server action — writes association + dismisses OTHER candidates in `email_suggestions_dismissed` (D-06 Option C hybrid) + audits + SSE broadcast |
| **PROD source** | `app/(authenticated)/inbox/actions.ts` `confirmAssociation` |
| **Restoration** | Restore action; replace `handleConfirm` |

### 3. InboxRowUnassigned — Suggestion pill Confirm

| Prop | Value |
|---|---|
| **File** | `app/inbox/_components/inbox-row-unassigned.tsx` |
| **Stub trigger** | Click suggestion pill |
| **Stub behavior** | `console.log("[stub] confirmAssociation (unassigned suggestion)", ...)` + alert |
| **PROD behavior** | Same `confirmAssociation` action as multi-file |
| **PROD source** | `app/(authenticated)/inbox/actions.ts` `confirmAssociation` |
| **Restoration** | Same as #2 |

### 4. InboxComposeDialog — Send

| Prop | Value |
|---|---|
| **File** | `app/inbox/_components/inbox-compose-dialog.tsx` |
| **Stub trigger** | Send button |
| **Stub behavior** | `console.log("[stub] sendEmail", { from, to, subject, body })` + toast `"Sent (stub) — wire-up deferred to L2+"` |
| **PROD behavior** | `sendEmail` server action → Gmail API send via OAuth → audit row → updates Sent folder |
| **PROD source** | `lib/email-send.ts` + `app/(authenticated)/inbox/actions.ts` `sendEmailDraft` |
| **Restoration** | Wire `sendEmail({ from, to, subject, body })` into `handleSend`; remove "(stub)" suffix from toast |

### 5. Mark-as-read on row click

| Prop | Value |
|---|---|
| **File** | `app/inbox/_components/inbox-row-all.tsx` (and via dispatch from all other row components) |
| **Stub trigger** | First click on an unread row |
| **Stub behavior** | Local `setIsUnread(false)` only; refresh resets state |
| **PROD behavior** | Optimistic clear + `markThreadRead({ threadId })` server action; failure reverts |
| **PROD source** | `app/(authenticated)/inbox/actions.ts` `markThreadRead` |
| **Restoration** | Add `useTransition` + `markThreadRead` call in `handleClick`; on `!ok` revert `isUnread` |

### 6. Search input

| Prop | Value |
|---|---|
| **File** | `app/inbox/_components/inbox-search-bar.tsx` (consumed by `inbox-surface.tsx`) |
| **Stub trigger** | Typing in the search Input |
| **Stub behavior** | Filters local fixture array client-side via substring match on subject/sender/snippet/file_no/aiSummary |
| **PROD behavior** | URL `?q=` param → server re-render → FTS over `body_search` shadow column (NPI-redacted index) |
| **PROD source** | `lib/email-query.ts` + `lib/filter-params.ts` |
| **Restoration** | Replace local filter with URL push to `?q=`; restore server-side query |

### 7. Priority filter

| Prop | Value |
|---|---|
| **File** | `app/inbox/_components/inbox-search-bar.tsx` |
| **Stub trigger** | Toggle priority checkbox in Filter popover |
| **Stub behavior** | Local state filter on `priorityTier` |
| **PROD behavior** | URL `?priority=high,medium` → server re-render |
| **PROD source** | `lib/filter-params.ts::serializeFilterParams` |
| **Restoration** | Same as #6 — URL state instead of local |

### 8. Digest panel

| Prop | Value |
|---|---|
| **File** | `app/inbox/_components/inbox-digest-panel.tsx` |
| **Stub trigger** | "What came in overnight" button |
| **Stub behavior** | Renders MOCK_DIGEST (canned data in `mock/inbox.ts`) |
| **PROD behavior** | `getDigestForUser` server action → 15-min cached Haiku-generated summary grouped by file_no, since-last-inbox-open window |
| **PROD source** | `lib/email-digest.ts` |
| **Restoration** | Replace `MOCK_DIGEST` import with `await getDigestForUser({ userId })` call from a server component wrapper |

### 9. Tab switching

| Prop | Value |
|---|---|
| **File** | `app/inbox/_components/inbox-tab-bar.tsx` |
| **Stub trigger** | Tab click |
| **Stub behavior** | Calls `onTabChange(tab)` callback prop → parent component lifts state |
| **PROD behavior** | URL `?tab=` push → server re-render |
| **PROD source** | `lib/filter-params.ts` |
| **Restoration** | Replace `onTabChange` prop with `router.push("?tab=...")` |

### 10. Unread badges (top-of-AppHeader + per-tab)

| Prop | Value |
|---|---|
| **File** | `components/inbox-header-button.tsx` (top), `app/inbox/_components/inbox-tab-bar.tsx` (per-tab) |
| **Stub trigger** | (always rendered) |
| **Stub behavior** | Reads `MOCK_INBOX_UNREAD_TOTAL` constant + `unreadCountsByTab(rows)` derived locally |
| **PROD behavior** | `queryUnreadTotalForUser` + `queryUnreadCountsByTab` server queries; SSE updates on read state changes |
| **PROD source** | `lib/email-query.ts` |
| **Restoration** | Wire SSE listener; restore server queries |

## Reintegration checklist

When advancing L1 → L2+ (or merging back into NPR_Dashboard):

- [ ] Refresh source SHAs in `EXTRACTION-MANIFEST.md`
- [ ] Diff every `verbatim` / `stripped-server-actions` row against current PROD HEAD
- [ ] Walk this file top-to-bottom, restoring each dead call
- [ ] Walk `mock/types.ts` Change Log; ensure each new field has a corresponding PROD schema column
- [ ] Run `npm run build` + manual smoke at `/inbox` after each restoration
- [ ] Drop `mock/inbox.ts` import sites once DB queries are wired
- [ ] Delete this file (or move to `docs/`) when zero dead calls remain
