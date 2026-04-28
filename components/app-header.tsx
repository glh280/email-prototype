import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { env } from "@/lib/env";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavLinks } from "@/components/nav-links";
import { InboxHeaderButton } from "@/components/inbox-header-button";
import { MOCK_INBOX_HIGH_PRIORITY_UNREAD } from "@/mock/inbox";

/**
 * Header with the real Cloudflare Access user pulled in at render time.
 *
 * Rendered inside Server Components (app/page.tsx, app/deal/[id]/page.tsx).
 * `proxy.ts` has already verified the Access JWT before this component
 * executes, but `getCurrentUser()` re-reads + re-verifies via the same
 * pure function so this component can be trusted independently of proxy
 * ordering.
 *
 * Sign out posts to the app-domain logout URL (`/cdn-cgi/access/logout`).
 * Cloudflare intercepts `/cdn-cgi/*` at the edge before origin, and the
 * app-domain variant clears the `CF_Authorization` cookie scoped to
 * `portal.utstitle.com` — the team-level variant
 * (`https://<team>/cdn-cgi/access/logout`) only clears team-level cookies
 * and can leave the app-specific cookie intact, allowing immediate
 * re-entry. No app-side sign-out state to clear.
 */
export async function AppHeader() {
  const user = await getCurrentUser();

  const initials = (user.name ?? user.email)
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const logoutUrl = `/cdn-cgi/access/logout`;

  return (
    <header className="flex items-center justify-between border-b px-6 py-3 bg-background">
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight hover:opacity-80"
        >
          <div className="h-6 w-6 rounded bg-slate-900 dark:bg-slate-100" />
          {env.NEXT_PUBLIC_APP_NAME}
        </Link>
        <NavLinks />
      </div>
      <div className="flex items-center gap-2">
        <InboxHeaderButton highPriorityCount={MOCK_INBOX_HIGH_PRIORITY_UNREAD} />
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <Avatar className="h-8 w-8">
              {user.image ? <AvatarImage src={user.image} alt="" /> : null}
              <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              {user.email}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<a href={logoutUrl}>Sign out</a>} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
