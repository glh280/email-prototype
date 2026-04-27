"use client";

/**
 * Global top-level nav links rendered inside AppHeader.
 *
 * Carved out as a client component so the surrounding `AppHeader`
 * (Server Component, reads Cloudflare Access identity via
 * `getCurrentUser()`) stays SSR. `usePathname` is client-only, and we
 * need it for the "you are here" active-link affordance — same a11y
 * primitive (`aria-current`) the stage-stepper uses for its pips.
 *
 * Active-link match rule: prefix-based so /deal/[id] also activates
 * the Deals link, and /contacts/[id] also activates Contacts. The
 * root "/" link is exact-match because every path starts with "/"
 * and we don't want the wordmark logic colliding with nav state.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Deals", match: "exact-or-deal" },
  { href: "/contacts", label: "Contacts", match: "prefix" },
] as const;

function isActive(pathname: string, href: string, match: string): boolean {
  if (match === "prefix") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  // "exact-or-deal": home link also owns /deal/* (deal list → deal detail)
  return pathname === "/" || pathname.startsWith("/deal");
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Primary">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href, link.match);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={[
              "px-3 py-1.5 rounded-md transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
