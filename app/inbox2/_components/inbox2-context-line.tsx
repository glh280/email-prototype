"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell context strip)
 * CREATED: 2026-04-27
 * STATUS: new
 * REINTEGRATION: Phase 2+ may surface ACL banner / sync state here.
 *
 * Compact dot-separated strip restating active scope so the user can
 * always confirm what mailbox / team / queue they are looking at.
 */

import type { Account, Group, NavView } from "@/mock/types";
import { NAV_VIEW_LABEL } from "@/mock/inbox2";

type Props = {
  workspaceLabel: string;
  account: Account;
  group: Group;
  navView: NavView;
};

export function Inbox2ContextLine({
  workspaceLabel,
  account,
  group,
  navView,
}: Props) {
  return (
    <div
      role="status"
      aria-label="Active workspace context"
      className="border-b bg-muted/30 px-6 py-1.5 text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap"
    >
      <span className="font-medium text-foreground">{workspaceLabel}</span>
      <Separator />
      <span>{account.email}</span>
      <Separator />
      <span>{group.name}</span>
      <Separator />
      <span className="text-foreground/80">{NAV_VIEW_LABEL[navView]}</span>
    </div>
  );
}

function Separator() {
  return <span className="opacity-50">·</span>;
}
