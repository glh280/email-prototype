"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell assignee chips)
 * CREATED: 2026-04-28
 * STATUS: new
 * REINTEGRATION: replace `WORKSPACE_USERS` lookup with the real
 *   `users` query once auth lands; underlying API stays identical.
 *
 * Small circular initials chip for each user assigned to a thread.
 * Hover (native `title`) shows the user's full name. Used in both the
 * message-row dense list (middle pane) and the preview pane header
 * (right pane) so the visual stays consistent across surfaces.
 */

import { cn } from "@/lib/utils";
import { WORKSPACE_USERS } from "@/mock/settings";

const AVATAR_TINTS = [
  "bg-sky-200 text-sky-900 dark:bg-sky-900/60 dark:text-sky-100",
  "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100",
  "bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100",
  "bg-violet-200 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100",
  "bg-rose-200 text-rose-900 dark:bg-rose-900/60 dark:text-rose-100",
  "bg-teal-200 text-teal-900 dark:bg-teal-900/60 dark:text-teal-100",
];

function tintFor(userId: string): string {
  // Stable hash: sum char codes mod tint count. Same user → same color
  // every render so the eye learns the mapping.
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h + userId.charCodeAt(i)) % 997;
  return AVATAR_TINTS[h % AVATAR_TINTS.length]!;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type Size = "sm" | "md";

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-4 w-4 text-[8.5px]",
  md: "h-5 w-5 text-[9.5px]",
};

const RING_CLASS: Record<Size, string> = {
  sm: "ring-1 ring-background",
  md: "ring-2 ring-background",
};

export type AssigneeAvatarsProps = {
  assigneeIds: string[];
  size?: Size;
  /** Cap rendered avatars at this count and show a `+N` badge after. */
  max?: number;
  className?: string;
};

export function AssigneeAvatars({
  assigneeIds,
  size = "sm",
  max = 4,
  className,
}: AssigneeAvatarsProps) {
  if (!assigneeIds || assigneeIds.length === 0) return null;

  const resolved = assigneeIds
    .map((id) => WORKSPACE_USERS.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));
  if (resolved.length === 0) return null;

  const head = resolved.slice(0, max);
  const overflow = resolved.length - head.length;

  return (
    <span
      className={cn("inline-flex items-center -space-x-1", className)}
      aria-label={`Assigned to ${resolved.map((u) => u.name).join(", ")}`}
    >
      {head.map((u) => (
        <span
          key={u.id}
          title={u.name}
          aria-label={u.name}
          className={cn(
            "inline-flex items-center justify-center rounded-full font-semibold shrink-0",
            SIZE_CLASS[size],
            RING_CLASS[size],
            tintFor(u.id),
          )}
        >
          {initialsOf(u.name)}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          title={resolved
            .slice(max)
            .map((u) => u.name)
            .join(", ")}
          className={cn(
            "inline-flex items-center justify-center rounded-full font-semibold shrink-0 bg-muted text-muted-foreground",
            SIZE_CLASS[size],
            RING_CLASS[size],
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}
