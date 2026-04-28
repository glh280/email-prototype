"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-search-bar.tsx
 * COPIED: 2026-04-27
 * STATUS: stripped-server-actions — URL state replaced with callback props
 * REINTEGRATION: restore `useRouter`/`usePathname`/`useSearchParams`,
 *   restore 200ms debounced `router.push(?q=)`. Drop callback props.
 *
 * Phase 04.2 Plan 13 — Search + filter popover (EMAIL-20).
 * MVP: priority multi-select only. Date + mailbox filters deferred to Plan 13 follow-up.
 */

import { Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import type { PriorityTier } from "@/mock/types";

const ALL_PRIORITY_TIERS: readonly PriorityTier[] = [
  "HIGH",
  "MEDIUM",
  "LOW",
] as const;

type Props = {
  q: string;
  priority: PriorityTier[];
  onQueryChange: (q: string) => void;
  onPriorityChange: (priority: PriorityTier[]) => void;
};

export function InboxSearchBar({
  q,
  priority,
  onQueryChange,
  onPriorityChange,
}: Props) {
  const [open, setOpen] = useState(false);

  function togglePriority(tier: PriorityTier): void {
    const current = new Set(priority);
    if (current.has(tier)) current.delete(tier);
    else current.add(tier);
    if (current.size === 0 || current.size === ALL_PRIORITY_TIERS.length) {
      onPriorityChange([]);
    } else {
      onPriorityChange(Array.from(current));
    }
  }

  return (
    <div className="px-4 py-2 border-b flex items-center gap-2">
      <Input
        value={q}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search subject, sender, and file number…"
        className="h-8 text-xs flex-1"
        aria-label="Search inbox"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button size="sm" variant="outline" aria-label="Filters">
              <Filter className="h-3.5 w-3.5" />
            </Button>
          }
        />
        <PopoverContent side="bottom" align="end" className="w-[280px] p-4">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Priority
              </div>
              <div className="space-y-1.5">
                {ALL_PRIORITY_TIERS.map((tier) => (
                  <label
                    key={tier}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={priority.includes(tier)}
                      onCheckedChange={() => togglePriority(tier)}
                    />
                    <span>{tier}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* TODO L2+ follow-up: date-range + mailbox multi-select. */}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
