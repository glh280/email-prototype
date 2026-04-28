"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell group dropdown)
 * CREATED: 2026-04-27
 * STATUS: new (stubbed change handler)
 * REINTEGRATION: Phase 2+ replaces with `groups` query + ACL filter.
 */

import { ChevronDown, Users, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Group } from "@/mock/types";

type Props = {
  groups: Group[];
  groupId: Group["id"];
  onChange: (next: Group["id"]) => void;
};

export function Inbox2GroupSelector({ groups, groupId, onChange }: Props) {
  const active = groups.find((g) => g.id === groupId) ?? groups[0];

  function handleSelect(next: Group) {
    if (next.id === groupId) return;
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-group-selector change", {
      from: groupId,
      to: next.id,
    });
    toast(`Group → ${next.name} (stub)`);
    onChange(next.id);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded border bg-background px-2.5 py-1 text-xs hover:bg-muted/50 outline-none">
        <Users className="h-3 w-3 text-muted-foreground" aria-hidden />
        <span className="font-medium">{active.name}</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {active.memberCount}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Groups
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {groups.map((g) => (
          <DropdownMenuItem
            key={g.id}
            onClick={() => handleSelect(g)}
            className="text-xs flex items-center gap-2"
          >
            <span className="flex-1 min-w-0 flex items-center gap-2">
              <span className="font-medium truncate">{g.name}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {g.memberCount}
              </span>
            </span>
            {g.id === groupId ? (
              <Check className="h-3 w-3 text-primary shrink-0" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
