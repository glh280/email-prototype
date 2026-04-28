"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-row-team.tsx
 * COPIED: 2026-04-27
 * STATUS: verbatim — delegates to InboxRowAll
 * REINTEGRATION: no changes needed.
 *
 * Phase 04.2 Plan 10 — Team row variant. metaBadge="team" surfaces a muted micro-pill.
 */

import type { InboxRow } from "@/mock/types";
import { InboxRowAll } from "./inbox-row-all";

export function InboxRowTeam({
  row,
  onMarkRead,
}: {
  row: InboxRow;
  onMarkRead?: (threadId: string) => void;
}) {
  return <InboxRowAll row={row} metaBadge="team" onMarkRead={onMarkRead} />;
}
