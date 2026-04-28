"use client";

/**
 * SOURCE: new (no PROD source — L1 prototype-only toggle)
 * CREATED: 2026-04-27
 * STATUS: new
 * REINTEGRATION: L1-only. Remove or rebuild based on Phase 2 decision.
 *
 * Cookie-persisted segmented control for switching between the Classic
 * inbox surface (`/inbox`) and the Workspace shell (`/inbox2`).
 *
 * Click writes the cookie `npr-inbox-view=classic|workspace` and pushes
 * the corresponding route. Each page's server component reads this cookie
 * pre-render and redirects when the URL doesn't match preference, so a
 * cold-load bookmark of either route lands on the user's last-used view
 * with no client-side flicker.
 */

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  INBOX_VIEW_COOKIE_NAME,
  type InboxViewCookieValue,
} from "@/lib/inbox-view-cookie";

const ONE_YEAR = 60 * 60 * 24 * 365;

const ROUTES: Record<InboxViewCookieValue, string> = {
  classic: "/inbox",
  workspace: "/inbox2",
};

export function InboxViewToggle() {
  const router = useRouter();
  const pathname = usePathname();

  const active: InboxViewCookieValue = pathname?.startsWith("/inbox2")
    ? "workspace"
    : "classic";

  function selectView(next: InboxViewCookieValue) {
    if (next === active) return;
    if (typeof document !== "undefined") {
      document.cookie = `${INBOX_VIEW_COOKIE_NAME}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    }
    // eslint-disable-next-line no-console
    console.log("[stub] inbox-view-toggle change", { from: active, to: next });
    router.push(ROUTES[next]);
  }

  return (
    <div
      role="group"
      aria-label="Inbox view"
      className="inline-flex items-center rounded-md border bg-muted/40 p-0.5 text-xs"
    >
      <Segment
        active={active === "classic"}
        label="Classic"
        onClick={() => selectView("classic")}
      />
      <Segment
        active={active === "workspace"}
        label="Workspace"
        onClick={() => selectView("workspace")}
      />
    </div>
  );
}

function Segment({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "px-3 py-1 rounded-[5px] transition-colors font-medium",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

