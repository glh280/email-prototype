"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell account dropdown)
 * CREATED: 2026-04-27
 * STATUS: new (stubbed change handler)
 * REINTEGRATION: Phase 2+ replaces with `gmail_accounts` query and
 *   server-driven context switch.
 */

import { ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Account } from "@/mock/types";

type Props = {
  accounts: Account[];
  accountId: Account["id"];
  onChange: (next: Account["id"]) => void;
};

export function Inbox2AccountSelector({ accounts, accountId, onChange }: Props) {
  const active = accounts.find((a) => a.id === accountId) ?? accounts[0];

  function handleSelect(next: Account) {
    if (next.id === accountId) return;
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-account-selector change", {
      from: accountId,
      to: next.id,
    });
    toast(`Account → ${next.displayName} (stub)`);
    onChange(next.id);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded border bg-background px-2.5 py-1 text-xs hover:bg-muted/50 outline-none">
        <span className="font-medium">{active.displayName}</span>
        <span className="text-muted-foreground hidden lg:inline truncate max-w-[140px]">
          {active.email}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Accounts
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accounts.map((a) => (
          <DropdownMenuItem
            key={a.id}
            onClick={() => handleSelect(a)}
            className="text-xs flex items-center gap-2"
          >
            <span className="flex-1 min-w-0">
              <div className="font-medium truncate">{a.displayName}</div>
              <div className="text-muted-foreground truncate">{a.email}</div>
            </span>
            {a.id === accountId ? (
              <Check className="h-3 w-3 text-primary shrink-0" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
