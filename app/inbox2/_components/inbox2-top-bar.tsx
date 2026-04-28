"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell global top bar)
 * CREATED: 2026-04-27
 * STATUS: new (compose reuses existing InboxComposeButton; notif + avatar
 *   stubbed; search + filter stubbed)
 * REINTEGRATION: Phase 2+ wires real notification panel + avatar menu
 *   (delegates to AppHeader's user/logout in PROD), real search input
 *   (server-driven FTS), real filter dropdown.
 *
 * Iter (2026-04-27): Missive realignment. Top bar now owns ACTIONS only:
 * Compose, Search, Filter, Account, Notifications, Avatar. View / group /
 * workspace selectors removed — those are nav-rail concerns. The
 * [Classic|Workspace] surface toggle stays at the far left.
 */

import { Bell, ChevronDown, Filter as FilterIcon, Search as SearchIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InboxViewToggle } from "@/components/inbox-view-toggle";
import { InboxComposeButton } from "@/app/inbox/_components/inbox-compose-button";
import { Inbox2AccountSelector } from "./inbox2-account-selector";
import { DEFAULT_FROM_MAILBOX } from "@/mock/inbox";
import type { Account, ViewBadge } from "@/mock/types";

const FILTER_OPTIONS = [
  "Unread",
  "High priority",
  "Has attachment",
  "AI flagged",
  "File-linked",
] as const;

type Props = {
  accounts: Account[];
  accountId: Account["id"];
  onAccountChange: (next: Account["id"]) => void;
  notificationBadge: ViewBadge;
};

export function Inbox2TopBar({
  accounts,
  accountId,
  onAccountChange,
  notificationBadge,
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
    console.log("[stub] inbox2-top-bar notifications click", { badge: notificationBadge });
    const { total, urgent } = notificationBadge;
    toast(
      urgent > 0
        ? `${urgent} urgent · ${total} total — panel stubbed`
        : `${total} notifications — panel stubbed`,
    );
  }

  function searchSubmit(value: string) {
    if (!value.trim()) return;
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-top-bar search submit", { q: value });
    toast(`Search "${value}" — stub (no client filter in Phase 1)`);
  }

  function filterClick(option: string) {
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-top-bar filter toggle", { option });
    toast(`Filter "${option}" — stub (no wire-up in Phase 1)`);
  }

  const isUrgent = notificationBadge.urgent > 0;
  const badgeCount = isUrgent ? notificationBadge.urgent : notificationBadge.total;

  function avatarMenuClick(item: string) {
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-top-bar avatar menu", { item });
    toast(`${item} — stub (no wire-up in Phase 1)`);
  }

  return (
    <header className="border-b bg-background px-4 py-2 flex items-center gap-3 flex-wrap">
      <InboxViewToggle />
      <div className="h-5 w-px bg-border mx-1" aria-hidden />
      <InboxComposeButton defaultMailbox={DEFAULT_FROM_MAILBOX} />
      <div className="relative flex-1 min-w-[180px] max-w-md">
        <SearchIcon
          className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Search…"
          className="h-8 pl-7 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") searchSubmit(e.currentTarget.value);
          }}
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Filter"
          className="inline-flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs hover:bg-muted/50 outline-none"
        >
          <FilterIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span>Filter</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Filter
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {FILTER_OPTIONS.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt}
              className="text-xs"
              checked={false}
              onCheckedChange={() => filterClick(opt)}
            >
              {opt}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex-1" />
      <Inbox2AccountSelector
        accounts={accounts}
        accountId={accountId}
        onChange={onAccountChange}
      />
      <button
        type="button"
        onClick={notifClick}
        aria-label={
          isUrgent
            ? `Notifications — ${notificationBadge.urgent} urgent of ${notificationBadge.total}`
            : `Notifications — ${notificationBadge.total}`
        }
        className="relative rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {badgeCount > 0 ? (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 rounded-full text-[9px] font-medium leading-none px-1 py-0.5 tabular-nums",
              isUrgent
                ? "bg-rose-500 text-white"
                : "bg-muted-foreground/80 text-background",
            )}
          >
            {badgeCount}
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
          <DropdownMenuItem className="text-xs" onClick={() => avatarMenuClick("Settings")}>
            Settings
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
