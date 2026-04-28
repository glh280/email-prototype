"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell root)
 * CREATED: 2026-04-27
 * STATUS: new
 * REINTEGRATION: Phase 2+ lifts state to URL params + server-driven
 *   message list; preview pane gains real thread reader.
 *
 * Layout (post Missive realignment — context line dropped):
 *   ┌────────────────────────── TopBar ─────────────────────────┐
 *   │ NavRail ║ SubHeader + MessageList ║ Preview pane          │
 *   │ (views  ║       380..520          ║   >= 420 (flex-1)     │
 *   │ + grps) ║         px              ║                       │
 *   └─────────╨─────────────────────────╨───────────────────────┘
 *   ║ = draggable divider
 *
 * Owns Inbox2ShellState. NavRail drives both navView and groupId; top
 * bar drives accountId + actions. workspaceLabel passed in but no longer
 * rendered in shell chrome (kept on props for future header reuse).
 */

import { useMemo, useState } from "react";
import type {
  Account,
  Group,
  Inbox2ShellState,
  InboxRow,
  NavView,
  ViewBadge,
} from "@/mock/types";
import { rowsForTab } from "@/mock/inbox";
import { Inbox2TopBar } from "./inbox2-top-bar";
import { Inbox2NavRail } from "./inbox2-nav-rail";
import { Inbox2SubHeader } from "./inbox2-sub-header";
import { Inbox2MessageList } from "./inbox2-message-list";
import { Inbox2PreviewPane } from "./inbox2-preview-pane";
import { Inbox2ResizableBody } from "./inbox2-resizable-body";

/**
 * Build a ViewBadge { total, urgent } from a row slice.
 * - total = unread count
 * - urgent = unread + HIGH priority count
 */
function badgeFromRows(rows: InboxRow[]): ViewBadge | undefined {
  const unread = rows.filter((r) => r.isUnread);
  if (unread.length === 0) return undefined;
  const urgent = unread.filter((r) => r.priorityTier === "HIGH").length;
  return { total: unread.length, urgent };
}

type Props = {
  rows: InboxRow[];
  accounts: Account[];
  groups: Group[];
  workspaceLabel: string;
  defaultAccountId: Account["id"];
  defaultGroupId: Group["id"];
  defaultNavView: NavView;
};

export function Inbox2Shell({
  rows,
  accounts,
  groups,
  defaultAccountId,
  defaultGroupId,
  defaultNavView,
}: Props) {
  const [state, setState] = useState<Inbox2ShellState>({
    accountId: defaultAccountId,
    groupId: defaultGroupId,
    navView: defaultNavView,
    selectedMessageId: null,
  });

  function patch(partial: Partial<Inbox2ShellState>) {
    setState((s) => ({ ...s, ...partial }));
  }

  const selectedRow = useMemo(
    () =>
      state.selectedMessageId
        ? rows.find((r) => r.messageId === state.selectedMessageId) ?? null
        : null,
    [rows, state.selectedMessageId],
  );

  const matchCount = useMemo(() => {
    return rows.filter(
      (r) => r.accountId === state.accountId && r.groupId === state.groupId,
    ).length;
  }, [rows, state.accountId, state.groupId]);

  // Live badges derived from real row data + current account/group scope.
  // Only the `inbox` and `spam` nav views map to mock data today; other
  // views show no badge (Phase 2+ will populate).
  const navViewBadges = useMemo<Partial<Record<NavView, ViewBadge>>>(() => {
    const inboxRows = rowsForTab("all").filter(
      (r) => r.accountId === state.accountId && r.groupId === state.groupId,
    );
    const spamRows = rowsForTab("spam").filter(
      (r) => r.accountId === state.accountId && r.groupId === state.groupId,
    );
    return {
      inbox: badgeFromRows(inboxRows),
      spam: badgeFromRows(spamRows),
    };
  }, [state.accountId, state.groupId]);

  // Per-group badge: unread inbox rows in the current account, scoped to
  // each group. Switching account updates all group counts.
  const groupBadges = useMemo<Partial<Record<Group["id"], ViewBadge>>>(() => {
    const accountRows = rowsForTab("all").filter(
      (r) => r.accountId === state.accountId,
    );
    const out: Partial<Record<Group["id"], ViewBadge>> = {};
    for (const g of groups) {
      const slice = accountRows.filter((r) => r.groupId === g.id);
      const badge = badgeFromRows(slice);
      if (badge) out[g.id] = badge;
    }
    return out;
  }, [groups, state.accountId]);

  // Bell badge: total unread for the current account (across all groups).
  const notificationBadge = useMemo<ViewBadge>(() => {
    const all = [...rowsForTab("all"), ...rowsForTab("spam")].filter(
      (r) => r.accountId === state.accountId,
    );
    return badgeFromRows(all) ?? { total: 0, urgent: 0 };
  }, [state.accountId]);

  function onSelect(messageId: string) {
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-message-row select", { messageId });
    patch({ selectedMessageId: messageId });
  }

  function onPreviewClose() {
    patch({ selectedMessageId: null });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.25rem)] bg-background">
      <Inbox2TopBar
        accounts={accounts}
        accountId={state.accountId}
        onAccountChange={(id) => patch({ accountId: id, selectedMessageId: null })}
        notificationBadge={notificationBadge}
      />
      <Inbox2ResizableBody
        left={
          <Inbox2NavRail
            navView={state.navView}
            onChange={(v) => patch({ navView: v, selectedMessageId: null })}
            badges={navViewBadges}
            groups={groups}
            groupId={state.groupId}
            onGroupChange={(id) => patch({ groupId: id, selectedMessageId: null })}
            groupBadges={groupBadges}
          />
        }
        center={
          <>
            <Inbox2SubHeader navView={state.navView} matchCount={matchCount} />
            <div className="flex-1 min-h-0 overflow-hidden">
              <Inbox2MessageList
                accountId={state.accountId}
                groupId={state.groupId}
                navView={state.navView}
                selectedMessageId={state.selectedMessageId}
                onSelect={onSelect}
              />
            </div>
          </>
        }
        right={<Inbox2PreviewPane row={selectedRow} onClose={onPreviewClose} />}
      />
    </div>
  );
}
