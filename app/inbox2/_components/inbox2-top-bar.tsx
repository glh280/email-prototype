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

import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { InboxViewToggle } from "@/components/inbox-view-toggle";
import { InboxComposeButton } from "@/app/inbox/_components/inbox-compose-button";
import { Inbox2AccountSelector } from "./inbox2-account-selector";
import { Inbox2FilterPopover } from "./inbox2-filter-popover";
import { DEFAULT_FROM_MAILBOX } from "@/mock/inbox";
import type { Account, Inbox2Filters } from "@/mock/types";

type Props = {
  accounts: Account[];
  accountId: Account["id"];
  onAccountChange: (next: Account["id"]) => void;
  filters: Inbox2Filters;
  onFiltersChange: (next: Inbox2Filters) => void;
  /**
   * Controlled top-bar search query. Live filter — every keystroke
   * updates the message list. Empty string disables the search filter.
   * See inbox2-shell.tsx::applySearch for the matching contract +
   * PROD-FTS reintegration plan.
   */
  searchQuery: string;
  onSearchChange: (next: string) => void;
};

export function Inbox2TopBar({
  accounts,
  accountId,
  onAccountChange,
  filters,
  onFiltersChange,
  searchQuery,
  onSearchChange,
}: Props) {
  return (
    <header className="border-b bg-background px-4 py-2 flex items-center gap-3 flex-wrap">
      <InboxViewToggle />
      <div className="h-5 w-px bg-border mx-1" aria-hidden />
      <InboxComposeButton defaultMailbox={DEFAULT_FROM_MAILBOX} iconOnly />
      <div className="relative flex-1 min-w-[180px] max-w-md">
        <SearchIcon
          className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Search subject, body, AI summary, notes…"
          className="h-8 pl-7 text-xs"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Inbox2FilterPopover filters={filters} onChange={onFiltersChange} />
      <div className="flex-1" />
      <Inbox2AccountSelector
        accounts={accounts}
        accountId={accountId}
        onChange={onAccountChange}
      />
    </header>
  );
}
