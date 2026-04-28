/**
 * Shared constant for the /inbox ↔ /inbox2 view-preference cookie.
 *
 * Lives in `lib/` (not `components/inbox-view-toggle.tsx`) because the
 * toggle component is `"use client"`, and exporting non-component values
 * from a client module yields a server-reference proxy when imported by a
 * server component — breaking string equality and `cookies().get(name)`.
 */

export const INBOX_VIEW_COOKIE_NAME = "npr-inbox-view";
export type InboxViewCookieValue = "classic" | "workspace";
