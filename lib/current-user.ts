import type { User } from "@/db/schema";

/**
 * DESIGN-REFERENCE BRANCH STUB — NOT THE PRODUCTION IMPLEMENTATION.
 *
 * This branch (`design-reference/prototype`) runs the prototype UI without
 * a real database or Cloudflare Access gating. The real `getCurrentUser`
 * on master reads the CF Access JWT from request headers, verifies it,
 * and upserts into the users table — none of which works on this branch
 * because DATABASE_URL is a placeholder (`postgresql://disabled@...`)
 * and CF Access is not required for this hostname.
 *
 * This stub returns a hardcoded user so Server Components that render
 * `<AppHeader />` (which calls getCurrentUser() at render time) don't
 * crash with `getaddrinfo ENOTFOUND disabled` trying to resolve the
 * placeholder Postgres hostname.
 *
 * Incident that produced this file: 2026-04-19 21:55 UTC — initial
 * prototype deploy rendered the CF Access reason screen then failed
 * with "This page couldn't load" because AppHeader's DB query could
 * not resolve the placeholder hostname. See .planning/DEPLOY.md §8 for
 * the full incident narrative.
 *
 * This file is BRANCH-SPECIFIC. Master has a real implementation that
 * must never be replaced with this stub. The design-reference/prototype
 * branch is explicitly never merged to master.
 */
export async function getCurrentUser(): Promise<User> {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    email: "mike@unitedtitlesolutions.com",
    name: "Mike Miller (prototype)",
    image: null,
    createdAt: new Date("2026-04-17T00:00:00Z"),
    updatedAt: new Date("2026-04-17T00:00:00Z"),
  };
}
