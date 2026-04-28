# Prototype Dead Calls

Wire-up checklist for L1 → L2+ promotion. Each stub: `console.log("[stub] <action>", payload)` + user signal (toast/alert) + SOURCE header comment.

## Register

| # | File | Trigger | Stub | PROD action | PROD source | Restoration |
|---|---|---|---|---|---|---|
| 1 ⭐ | `app/inbox/_components/add-thread-to-deal-dialog.tsx` | Confirm w/ non-empty query | console.log + toast | `addThreadToFile` writes `email_associations` (source='manual') + audit + invalidate | `app/(authenticated)/inbox/actions.ts` `addThreadToFile` | Replace `handleConfirm` body w/ `await addThreadToFile({ threadId, messageId, dealId })` |
| 2 | `app/inbox/_components/inbox-row-multi-file.tsx` | Candidate chip click | console.log + alert | `confirmAssociation` writes assoc + dismisses OTHER candidates (D-06 Option C) + audit + SSE | `inbox/actions.ts` `confirmAssociation` | Restore action; replace `handleConfirm` |
| 3 | `app/inbox/_components/inbox-row-unassigned.tsx` | Suggestion pill click | console.log + alert | Same `confirmAssociation` as #2 | same | Same as #2 |
| 4 | `app/inbox/_components/inbox-compose-dialog.tsx` | Send button | console.log + toast `"Sent (stub) — wire-up deferred to L2+"` | `sendEmailDraft` → Gmail OAuth send + audit + Sent folder | `lib/email-send.ts` + `inbox/actions.ts` `sendEmailDraft` | Wire `sendEmail({from,to,subject,body})` into `handleSend`; drop "(stub)" |
| 5 | `app/inbox/_components/inbox-row-all.tsx` (+ dispatched from siblings) | First click on unread row | Local `setIsUnread(false)`; refresh resets | Optimistic clear + `markThreadRead({threadId})`; revert on `!ok` | `inbox/actions.ts` `markThreadRead` | `useTransition` + action call in `handleClick`; revert `isUnread` on failure |
| 6 | `app/inbox/_components/inbox-search-bar.tsx` (via `inbox-surface.tsx`) | Type in search Input | Client-side filter on subject/sender/snippet/file_no/aiSummary | URL `?q=` → server FTS over `body_search` shadow column (NPI-redacted) | `lib/email-query.ts` + `lib/filter-params.ts` | Replace local filter w/ URL push to `?q=`; restore server query |
| 7 | `app/inbox/_components/inbox-search-bar.tsx` | Toggle priority checkbox | Local state filter on `priorityTier` | URL `?priority=high,medium` → server re-render | `lib/filter-params.ts::serializeFilterParams` | URL state instead of local |
| 8 | `app/inbox/_components/inbox-digest-panel.tsx` | "What came in overnight" | Renders MOCK_DIGEST (`mock/inbox.ts`) | `getDigestForUser` → 15-min cached Haiku summary grouped by file_no, since-last-open window | `lib/email-digest.ts` | Replace `MOCK_DIGEST` w/ `await getDigestForUser({userId})` from server-component wrapper |
| 9 | `app/inbox/_components/inbox-tab-bar.tsx` | Tab click | `onTabChange(tab)` callback prop → parent state | URL `?tab=` push → server re-render | `lib/filter-params.ts` | Replace prop w/ `router.push("?tab=...")` |
| 10 | `components/inbox-header-button.tsx` (top), `inbox-tab-bar.tsx` (per-tab) | Always rendered | `MOCK_INBOX_UNREAD_TOTAL` const + `unreadCountsByTab(rows)` derived locally | `queryUnreadTotalForUser` + `queryUnreadCountsByTab`; SSE on read state changes | `lib/email-query.ts` | Wire SSE listener; restore server queries |
| 11 | `components/inbox-view-toggle.tsx` | Click inactive segment | `document.cookie` write (`npr-inbox-view`) + `router.push` to other route + console.log | unchanged — toggle is L1-only | — | L2 decision: keep toggle as user-pref or retire when one shell wins |
| 12 | `app/inbox2/_components/inbox2-account-selector.tsx` | Account change | `setAccountId` in shell + console.log + toast | Switch active mailbox context (Gmail OAuth identity) | — | Wire `setActiveAccount({accountId})` server action + URL/cookie |
| 13 | `app/inbox2/_components/inbox2-group-selector.tsx` | Group change | `setGroupId` in shell + console.log + toast | Switch active group context | — | Wire `setActiveGroup({groupId})` server action + URL/cookie |
| 14 | `app/inbox2/_components/inbox2-nav-rail.tsx` | Nav rail click | `setNavView` in shell (no router push) + console.log | URL `/inbox2/<view>` push → server re-render | `lib/filter-params.ts` | Replace local state with `router.push("?view=...")` |
| 15 | `app/inbox2/_components/inbox2-sub-header.tsx` | Filter chip click | console.log + toast | URL filter state → server re-render | `lib/filter-params.ts` | Replace stub with URL push |
| 16 | `app/inbox2/_components/inbox2-sub-header.tsx` | Search input Enter | console.log + toast (no client filter) | URL `?q=` → server FTS over `body_search` shadow column | `lib/email-query.ts` | Replace stub with URL push to `?q=` |
| 17 | `app/inbox2/_components/inbox2-sub-header.tsx` | Mark all read / Refresh / Sort buttons | console.log + toast | Bulk `markThreadRead` / re-fetch / re-sort URL push | `inbox/actions.ts` | Wire each handler |
| 18 | `app/inbox2/_components/inbox2-top-bar.tsx` | Notifications icon click | console.log + toast | Open notification panel | — | Wire panel component + server query |
| 19 | `app/inbox2/_components/inbox2-top-bar.tsx` | Avatar menu items | console.log + toast | Profile / preferences / help / sign out | `app/cdn-cgi/access/logout` flow | Delegate to AppHeader's user / logout flow |
| 20 | `app/inbox2/_components/inbox2-message-row.tsx` | Row click | `setSelectedMessageId` in shell + console.log | Optimistic mark-read + load full thread + open preview | `inbox/actions.ts` `markThreadRead` + `getThreadById` | Add `useTransition` + action calls |
| 21 | `app/inbox2/_components/inbox2-preview-pane.tsx` | Close button click | `setSelectedMessageId(null)` + console.log | Close preview / clear thread state | — | Keep behavior; remove "(stub)" log |

⭐ = primary dead call deliberately deferred per spec.

## Reintegration checklist

- [ ] Refresh source SHAs in `EXTRACTION-MANIFEST.md`
- [ ] Diff every `verbatim`/`stripped-server-actions` row against current PROD HEAD
- [ ] Walk register top-to-bottom, restoring each
- [ ] Walk `mock/types.ts` CHANGE LOG; ensure each new field has PROD schema column
- [ ] `npm run build` + manual smoke at `/inbox` after each restoration
- [ ] Drop `mock/inbox.ts` import sites once DB queries wired
- [ ] Delete this file (or `→ docs/`) when zero dead calls remain
