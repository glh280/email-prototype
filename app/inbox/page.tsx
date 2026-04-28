/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/page.tsx
 * COPIED: 2026-04-27
 * STATUS: stripped-server-actions — L1 rewrite
 * REINTEGRATION: restore `getCurrentUser`, `parseInboxFilterParams`,
 *   `queryInboxForUser`, `queryUnreadCountsByTab`, `defaultFromMailbox`,
 *   `<InboxGatedBanner />` partner short-circuit. The L1 surface here
 *   collapses to a single client component reading from `mock/inbox.ts`.
 *
 * Phase 04.2 Plan 09 — `/inbox` route entry point (EMAIL-14).
 *
 * L1 simplification:
 *   - No CF Access (no partner role, no gated banner)
 *   - No URL-driven tab/filter state (lifted to client component state)
 *   - No DB queries — all rows from `mock/inbox.ts`
 *   - No SSE — static render
 */

import { AppHeader } from "@/components/app-header";
import { InboxSurface } from "./_components/inbox-surface";
import { INBOX_ROWS, unreadCountsByTab, DEFAULT_FROM_MAILBOX } from "@/mock/inbox";

export default function InboxPage() {
  const allRows = INBOX_ROWS;
  const unreadCounts = unreadCountsByTab(allRows);

  return (
    <>
      <AppHeader />
      <InboxSurface
        userId="prototype-user"
        initialRows={allRows}
        unreadCounts={unreadCounts}
        defaultMailbox={DEFAULT_FROM_MAILBOX}
      />
    </>
  );
}
