/**
 * SOURCE: NPR_Dashboard@a7a31d9b — components/inbox-header-button.tsx
 * COPIED: 2026-04-27
 * STATUS: stubbed — UnreadBadge inlined here (PROD imports from
 *   `app/_components/chat/unread-badge`; chat surface not ported in L1)
 * REINTEGRATION: replace inlined badge with `import { UnreadBadge } from
 *   "@/app/_components/chat/unread-badge"` once chat is ported.
 *
 * Phase 04.2 Plan 08 — Unified-inbox header entry point (EMAIL-14, EMAIL-19, CFA-01).
 * Renders a 36×36 icon button (lucide `Inbox`) in `AppHeader`'s right cluster.
 * Click navigates to `/inbox`. Self-hides badge when count <= 0.
 */

import Link from "next/link";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

function HighPriorityBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);
  return (
    <span
      aria-label={`${count} high-priority unread message${count === 1 ? "" : "s"}`}
      className={cn(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold leading-none bg-rose-500 text-white ring-2 ring-rose-300/50",
        className,
      )}
    >
      {display}
    </span>
  );
}

export function InboxHeaderButton({
  highPriorityCount,
}: {
  highPriorityCount: number;
}) {
  return (
    <Link
      href="/inbox"
      aria-label={
        highPriorityCount > 0
          ? `Unified inbox — ${highPriorityCount} high-priority unread`
          : "Unified inbox"
      }
      title={
        highPriorityCount > 0
          ? `${highPriorityCount} high-priority unread`
          : "Unified inbox"
      }
      className="relative inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted/40 transition-colors"
    >
      <Inbox className="h-4 w-4" />
      <HighPriorityBadge count={highPriorityCount} className="absolute -top-1 -right-1" />
    </Link>
  );
}
