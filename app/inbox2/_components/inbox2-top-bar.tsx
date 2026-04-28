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

import { Filter as FilterIcon, Search as SearchIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { InboxViewToggle } from "@/components/inbox-view-toggle";
import { InboxComposeButton } from "@/app/inbox/_components/inbox-compose-button";
import { Inbox2AccountSelector } from "./inbox2-account-selector";
import { DEFAULT_FROM_MAILBOX } from "@/mock/inbox";
import type { Account } from "@/mock/types";

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
};

export function Inbox2TopBar({ accounts, accountId, onAccountChange }: Props) {
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
    </header>
  );
}
