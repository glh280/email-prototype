"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-tab-bar.tsx
 * COPIED: 2026-04-27
 * STATUS: stripped-server-actions — URL state replaced with `onTabChange` callback prop
 * REINTEGRATION: restore `useRouter`/`usePathname`/`useSearchParams`,
 *   replace `onTabChange` prop with `params.set("tab", ...)` push.
 *
 * Phase 04.2 Plan 09 — Inbox tab bar (EMAIL-14, VIEW-05, D-02, D-14).
 * Tab order LOCKED per D-02: All / By File / Multi-File / Unassigned / Team / Spam.
 */

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  INBOX_TAB_ORDER,
  INBOX_TAB_LABEL,
  type InboxTab,
} from "@/mock/types";

function UnreadBadge({
  count,
  variant = "accent",
  className,
}: {
  count: number;
  variant?: "accent" | "muted";
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} unread message${count === 1 ? "" : "s"}`}
      className={cn(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold leading-none",
        variant === "accent"
          ? "bg-rose-500 text-white"
          : "bg-primary-foreground/30 text-primary-foreground",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

type Props = {
  currentTab: InboxTab;
  unreadCounts: Record<InboxTab, number>;
  onTabChange: (tab: InboxTab) => void;
};

export function InboxTabBar({ currentTab, unreadCounts, onTabChange }: Props) {
  function handleSelectChange(next: string | null) {
    if (next === null) return;
    if ((INBOX_TAB_ORDER as readonly string[]).includes(next)) {
      onTabChange(next as InboxTab);
    }
  }

  return (
    <>
      <div className="hidden md:flex px-4 py-3 border-b items-center gap-1 overflow-x-auto">
        {INBOX_TAB_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={currentTab === key}
            data-state={currentTab === key ? "active" : "inactive"}
            onClick={() => onTabChange(key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center",
              "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
              "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/40",
            )}
          >
            {INBOX_TAB_LABEL[key]}
            {unreadCounts[key] > 0 && (
              <UnreadBadge
                count={unreadCounts[key]}
                variant={currentTab === key ? "muted" : "accent"}
                className="ml-1.5 inline-flex"
              />
            )}
          </button>
        ))}
      </div>

      <div className="md:hidden px-4 py-3 border-b">
        <Select value={currentTab} onValueChange={handleSelectChange}>
          <SelectTrigger className="w-full">
            <SelectValue>
              <span className="flex items-center gap-2">
                {INBOX_TAB_LABEL[currentTab]}
                {unreadCounts[currentTab] > 0 && (
                  <UnreadBadge count={unreadCounts[currentTab]} variant="accent" />
                )}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {INBOX_TAB_ORDER.map((key) => (
              <SelectItem key={key} value={key}>
                <span className="flex items-center justify-between gap-4 w-full">
                  <span>{INBOX_TAB_LABEL[key]}</span>
                  {unreadCounts[key] > 0 && (
                    <UnreadBadge count={unreadCounts[key]} variant="accent" />
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
