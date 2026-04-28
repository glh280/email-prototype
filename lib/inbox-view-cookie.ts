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

/**
 * Workspace pane width cookies. Two integers (px) — left rail + center
 * (message list). Right pane is flex-1 (no cookie). Read server-side in
 * `app/inbox2/page.tsx` and threaded down to `<Inbox2ResizableBody>`;
 * written client-side at drag-end.
 */
export const INBOX2_PANE_LEFT_COOKIE = "npr-inbox2-pane-left";
export const INBOX2_PANE_CENTER_COOKIE = "npr-inbox2-pane-center";

export function parsePaneWidth(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
