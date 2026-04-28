"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell root)
 * CREATED: 2026-04-27
 * STATUS: new
 * REINTEGRATION: Phase 2+ lifts state to URL params + server-driven
 *   message list; preview pane gains real thread reader.
 *
 * Phase 1 layout grid (body is now resizable, see Inbox2ResizableBody):
 *   ┌────────────────────────── TopBar ─────────────────────────┐
 *   ├───────────────────────── ContextLine ─────────────────────┤
 *   │ NavRail ║ SubHeader + MessageList ║ Preview pane          │
 *   │  200..  ║       280..520          ║   >= 420 (flex-1)     │
 *   │  320 px ║         px              ║                       │
 *   └─────────╨─────────────────────────╨───────────────────────┘
 *   ║ = draggable divider
 *
 * Owns Inbox2ShellState. All children receive props + change handlers.
 * No URL state in Phase 1; refresh resets selectedMessageId and resets
 * accountId / groupId / navView to defaults from `mock/inbox2.ts`.
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
import { Inbox2TopBar } from "./inbox2-top-bar";
import { Inbox2ContextLine } from "./inbox2-context-line";
import { Inbox2NavRail } from "./inbox2-nav-rail";
import { Inbox2SubHeader } from "./inbox2-sub-header";
import { Inbox2MessageList } from "./inbox2-message-list";
import { Inbox2PreviewPane } from "./inbox2-preview-pane";
import { Inbox2ResizableBody } from "./inbox2-resizable-body";

type Props = {
  rows: InboxRow[];
  accounts: Account[];
  groups: Group[];
  workspaceLabel: string;
  defaultAccountId: Account["id"];
  defaultGroupId: Group["id"];
  defaultNavView: NavView;
  notificationBadge: ViewBadge;
  navViewBadges?: Partial<Record<NavView, ViewBadge>>;
};

export function Inbox2Shell({
  rows,
  accounts,
  groups,
  workspaceLabel,
  defaultAccountId,
  defaultGroupId,
  defaultNavView,
  notificationBadge,
  navViewBadges,
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

  const account = useMemo(
    () => accounts.find((a) => a.id === state.accountId) ?? accounts[0],
    [accounts, state.accountId],
  );
  const group = useMemo(
    () => groups.find((g) => g.id === state.groupId) ?? groups[0],
    [groups, state.groupId],
  );

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
        workspaceLabel={workspaceLabel}
        accounts={accounts}
        accountId={state.accountId}
        onAccountChange={(id) => patch({ accountId: id, selectedMessageId: null })}
        groups={groups}
        groupId={state.groupId}
        onGroupChange={(id) => patch({ groupId: id, selectedMessageId: null })}
        navView={state.navView}
        onNavViewChange={(v) => patch({ navView: v, selectedMessageId: null })}
        notificationBadge={notificationBadge}
      />
      <Inbox2ContextLine
        workspaceLabel={workspaceLabel}
        account={account}
        group={group}
        navView={state.navView}
      />
      <Inbox2ResizableBody
        left={
          <Inbox2NavRail
            navView={state.navView}
            onChange={(v) => patch({ navView: v, selectedMessageId: null })}
            badges={navViewBadges}
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
