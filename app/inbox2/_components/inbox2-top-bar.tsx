"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell global top bar)
 * CREATED: 2026-04-27
 * STATUS: new (compose reuses existing InboxComposeButton; notif + avatar
 *   stubbed)
 * REINTEGRATION: Phase 2+ wires real notification panel + avatar menu
 *   (delegates to AppHeader's user/logout in PROD).
 *
 * Global scope controls: workspace label · account · group · spacer ·
 * compose · notifications · avatar.
 *
 * The view toggle [Classic | Workspace] sits at the far left so the user
 * can flip back to /inbox without hunting.
 */

import { Bell, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { InboxViewToggle } from "@/components/inbox-view-toggle";
import { InboxComposeButton } from "@/app/inbox/_components/inbox-compose-button";
import { Inbox2AccountSelector } from "./inbox2-account-selector";
import { Inbox2GroupSelector } from "./inbox2-group-selector";
import { DEFAULT_FROM_MAILBOX } from "@/mock/inbox";
import type { Account, Group } from "@/mock/types";

type Props = {
  workspaceLabel: string;
  accounts: Account[];
  accountId: Account["id"];
  onAccountChange: (next: Account["id"]) => void;
  groups: Group[];
  groupId: Group["id"];
  onGroupChange: (next: Group["id"]) => void;
  notificationCount: number;
};

export function Inbox2TopBar({
  workspaceLabel,
  accounts,
  accountId,
  onAccountChange,
  groups,
  groupId,
  onGroupChange,
  notificationCount,
}: Props) {
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const initials = account.displayName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function notifClick() {
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-top-bar notifications click", { count: notificationCount });
    toast(`${notificationCount} notifications — panel stubbed`);
  }

  function avatarMenuClick(item: string) {
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-top-bar avatar menu", { item });
    toast(`${item} — stub (no wire-up in Phase 1)`);
  }

  return (
    <header className="border-b bg-background px-4 py-2 flex items-center gap-3 flex-wrap">
      <InboxViewToggle />
      <div className="h-5 w-px bg-border mx-1" aria-hidden />
      <span className="text-xs font-semibold tracking-tight">{workspaceLabel}</span>
      <Inbox2AccountSelector
        accounts={accounts}
        accountId={accountId}
        onChange={onAccountChange}
      />
      <Inbox2GroupSelector
        groups={groups}
        groupId={groupId}
        onChange={onGroupChange}
      />
      <div className="flex-1" />
      <InboxComposeButton defaultMailbox={DEFAULT_FROM_MAILBOX} />
      <button
        type="button"
        onClick={notifClick}
        aria-label="Notifications"
        className="relative rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {notificationCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 rounded-full bg-rose-500 text-white text-[9px] font-medium leading-none px-1 py-0.5 tabular-nums">
            {notificationCount}
          </span>
        ) : null}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1 outline-none rounded hover:bg-muted/50 px-1 py-0.5">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px] font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {account.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-xs" onClick={() => avatarMenuClick("Profile")}>
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => avatarMenuClick("Account preferences")}>
            Account preferences
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => avatarMenuClick("Help")}>
            Help
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-xs" onClick={() => avatarMenuClick("Sign out")}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
