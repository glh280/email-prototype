"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-empty-state.tsx
 * COPIED: 2026-04-27
 * STATUS: verbatim — pure render
 * REINTEGRATION: no changes needed.
 *
 * Phase 04.2 Plan 13 — Per-tab tailored empty-state copy (UI-SPEC §Copywriting §Empty state per tab).
 */

import type { InboxTab } from "@/mock/types";

const COPY: Record<InboxTab, { title: string; body: string }> = {
  all: {
    title: "Nothing in the inbox in the last 30 days.",
    body: "When new messages land in any of the 13 mailboxes they'll appear here.",
  },
  "by-file": {
    title: "No file-associated emails right now.",
    body: "Messages get auto-linked when their subject or body mentions a file number (e.g., FL-2026-001).",
  },
  "multi-file": {
    title: "No ambiguous matches.",
    body: "When AI matches an email to ≥2 deals, you'll resolve the conflict here.",
  },
  unassigned: {
    title: "Inbox is clean.",
    body: "All messages are either auto-linked, AI-suggested, or marked as team / spam.",
  },
  team: {
    title: "No team-distribution emails.",
    body: "Mailing-list and broadcast emails to internal addresses appear here.",
  },
  spam: {
    title: "No spam.",
    body: "Gmail-flagged spam lands here for review — never auto-deleted.",
  },
};

export function InboxEmptyState({ tab }: { tab: InboxTab }) {
  const copy = COPY[tab];
  return (
    <div className="py-16 text-center px-6">
      <div className="text-sm font-medium">{copy.title}</div>
      <div className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto">
        {copy.body}
      </div>
    </div>
  );
}
