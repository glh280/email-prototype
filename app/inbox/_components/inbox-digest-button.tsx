"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-digest-button.tsx
 * COPIED: 2026-04-27
 * STATUS: stripped-server-actions — digest data sourced from MOCK_DIGEST
 * REINTEGRATION: restore `getDigestForUser` server action.
 *
 * Phase 04.2 Plan 12 — Digest CTA. Opens digest panel with grouped overnight summary.
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InboxDigestPanel } from "./inbox-digest-panel";

export function InboxDigestButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="default"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-3.5 w-3.5" />
        What came in overnight
      </Button>
      <InboxDigestPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
