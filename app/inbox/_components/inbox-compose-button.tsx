"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-compose-button.tsx
 * COPIED: 2026-04-27
 * STATUS: stripped-server-actions — opens dialog only
 * REINTEGRATION: no changes needed (button itself is dumb).
 *
 * Phase 04.2 Plan 12 — Compose CTA in inbox header.
 */

import { useState } from "react";
import { PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InboxComposeDialog } from "./inbox-compose-dialog";

export function InboxComposeButton({
  defaultMailbox,
}: {
  defaultMailbox: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <PenSquare className="h-3.5 w-3.5" />
        Compose
      </Button>
      <InboxComposeDialog
        open={open}
        onOpenChange={setOpen}
        defaultMailbox={defaultMailbox}
      />
    </>
  );
}
