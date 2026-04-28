"use client";

/**
 * SOURCE: new
 * CREATED: 2026-04-28
 * STATUS: new — placeholder for non-priority settings sections.
 * REINTEGRATION: each placeholder gets its own real implementation in
 *   Phase 2+ (or whenever the operator prioritizes that section).
 */

import { Construction } from "lucide-react";

export function PlaceholderSection({ title }: { title: string }) {
  return (
    <div className="h-full flex items-center justify-center bg-muted/10">
      <div className="max-w-sm text-center px-6">
        <Construction className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" aria-hidden />
        <h3 className="text-sm font-semibold mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground">
          Placeholder. This section is part of the L1 settings scaffold but
          hasn&apos;t been built yet. Wired up in a later iteration.
        </p>
      </div>
    </div>
  );
}
