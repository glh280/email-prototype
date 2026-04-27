/**
 * Phase 1 Plan 06 Task 2 — shared UI format helpers for the list view.
 *
 * Centralizes track/priority/milestone styling from UI-SPEC Page 1 so that
 * DealRow (list view) and NewDealForm (create form) render the exact same
 * visual language. When the color palette gets tuned in P10 calibration, the
 * edit lands here — not sprinkled across multiple components.
 *
 * Map keys are the track `code` / priority enum values stored in Postgres.
 */

/**
 * Tailwind classes for a track badge (bg + fg). 8 tracks per DEAL-01.
 * Keys MUST match the `tracks.code` values seeded in db/seed/tracks.ts.
 */
export const trackBadgeClasses: Record<string, string> = {
  TE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  FL: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  DP: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  PO: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  EC: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  SL: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  BL: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  GI: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
};

/**
 * Priority pill background + ring + text.
 * HIGH = red, MEDIUM = amber, LOW = hollow gray (deliberate: Carrie noted the
 * LOW bucket is rare; it should read as "quietly backgrounded").
 */
export const priorityPillClasses: Record<string, string> = {
  HIGH: "bg-red-50 text-red-700 ring-1 ring-red-200",
  MEDIUM: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  LOW: "text-muted-foreground ring-1 ring-border",
};

/**
 * Priority dot (8-px disc) — HIGH solid red, MEDIUM solid amber, LOW hollow.
 * Pairs with priorityPillClasses so the dot + label scan as a unit.
 */
export const priorityDotClasses: Record<string, string> = {
  HIGH: "h-2 w-2 rounded-full bg-red-500",
  MEDIUM: "h-2 w-2 rounded-full bg-amber-500",
  LOW: "h-2 w-2 rounded-full border border-gray-400",
};

/** Truncate a string, appending U+2026 ellipsis on overflow. Null/undefined → "". */
export function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Relative timestamp per UI-SPEC: 2m / 15m / 3h / yesterday / Apr 14 / Jan 2025.
 *
 * Bucket rules:
 *   - < 1 min  → "just now"
 *   - < 60 min → "{N}m"
 *   - < 24 hr  → "{N}h"
 *   - ~1 day   → "yesterday"
 *   - < 1 yr   → "Mon D"    (e.g. "Apr 14")
 *   - ≥ 1 yr   → "Mon YYYY" (e.g. "Jan 2025")
 *
 * `now` is injectable for test determinism.
 */
export function relativeTime(
  d: Date | null | undefined,
  now: Date = new Date(),
): string {
  if (!d) return "";
  const diffMs = now.getTime() - d.getTime();
  const min = Math.round(diffMs / 60_000);
  const hr = Math.round(diffMs / 3_600_000);
  const day = Math.round(diffMs / 86_400_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  if (hr < 24) return `${hr}h`;
  if (day === 1) return "yesterday";
  if (day < 365)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
