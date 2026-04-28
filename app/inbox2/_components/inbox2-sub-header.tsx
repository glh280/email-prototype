"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell local-filter strip)
 * CREATED: 2026-04-27
 * STATUS: new (stubbed filter chips, stubbed search, stubbed actions)
 * REINTEGRATION: Phase 2+ wires filter state to URL params + server FTS.
 *
 * Sub-header for the active view. Filter chips · search · placeholder
 * action buttons. All clicks log + toast in Phase 1.
 */

import { Search, Filter, ArrowDownUp, RefreshCw, MailOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { NavView } from "@/mock/types";
import { NAV_VIEW_LABEL } from "@/mock/inbox2";

const FILTER_CHIPS = [
  "Unread",
  "High priority",
  "Has attachment",
  "AI flagged",
  "File-linked",
] as const;

type Props = {
  navView: NavView;
  matchCount: number;
};

export function Inbox2SubHeader({ navView, matchCount }: Props) {
  function chipClick(label: string) {
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-sub-header filter chip", { label, navView });
    toast(`Filter "${label}" — stub (no wire-up in Phase 1)`);
  }

  function actionClick(action: string) {
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-sub-header action", { action, navView });
    toast(`${action} — stub (no wire-up in Phase 1)`);
  }

  function searchSubmit(value: string) {
    if (!value.trim()) return;
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-sub-header search submit", { q: value, navView });
    toast(`Search "${value}" — stub (no client filter in Phase 1)`);
  }

  return (
    <div className="border-b bg-background">
      <div className="px-4 py-2 flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold mr-2">{NAV_VIEW_LABEL[navView]}</h2>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {matchCount} {matchCount === 1 ? "thread" : "threads"}
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => actionClick("Mark all read")}
          className="h-7 text-xs gap-1"
        >
          <MailOpen className="h-3.5 w-3.5" />
          Mark all read
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => actionClick("Refresh")}
          className="h-7 text-xs gap-1"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => actionClick("Sort")}
          className="h-7 text-xs gap-1"
        >
          <ArrowDownUp className="h-3.5 w-3.5" />
          Sort
        </Button>
      </div>
      <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search this view…"
            className="h-8 pl-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") searchSubmit(e.currentTarget.value);
            }}
          />
        </div>
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
        <ul className="flex items-center gap-1.5 flex-wrap">
          {FILTER_CHIPS.map((chip) => (
            <li key={chip}>
              <button
                type="button"
                onClick={() => chipClick(chip)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                  "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {chip}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
