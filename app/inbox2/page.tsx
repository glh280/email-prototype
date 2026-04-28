/**
 * SOURCE: new (no PROD source — net-new shell)
 * CREATED: 2026-04-27
 * STATUS: new
 * REINTEGRATION: TBD — Phase 2+ wiring (real account/group context,
 *   URL-driven nav state, server-driven message list).
 *
 * /inbox2 — Workspace shell entry point.
 *
 * Reads the `npr-inbox-view` cookie and redirects to /inbox if the user's
 * preference is "classic" (server redirect — no flicker on cold load).
 *
 * L1 simplification:
 *   - No CF Access (no partner role, no gated banner)
 *   - No URL-driven nav/account/group state — owned by Inbox2Shell useState
 *   - No DB queries — all rows from mock/inbox.ts
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { INBOX_VIEW_COOKIE_NAME } from "@/lib/inbox-view-cookie";
import { Inbox2Shell } from "./_components/inbox2-shell";
import { INBOX_ROWS } from "@/mock/inbox";
import {
  ACCOUNTS,
  GROUPS,
  WORKSPACE_LABEL,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_GROUP_ID,
  DEFAULT_NAV_VIEW,
  MOCK_NOTIFICATION_COUNT,
} from "@/mock/inbox2";

export default async function Inbox2Page() {
  const cookieStore = await cookies();
  const view = cookieStore.get(INBOX_VIEW_COOKIE_NAME)?.value;
  if (view === "classic") redirect("/inbox");

  return (
    <>
      <AppHeader />
      <Inbox2Shell
        rows={INBOX_ROWS}
        accounts={ACCOUNTS}
        groups={GROUPS}
        workspaceLabel={WORKSPACE_LABEL}
        defaultAccountId={DEFAULT_ACCOUNT_ID}
        defaultGroupId={DEFAULT_GROUP_ID}
        defaultNavView={DEFAULT_NAV_VIEW}
        notificationCount={MOCK_NOTIFICATION_COUNT}
      />
    </>
  );
}
