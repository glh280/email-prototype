"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TEAM_MEMBERS } from "@/mock/types";

/**
 * Multi-select popup for picking 0..N internal team members.
 * Reused by the dashboard "Filter by person" chip and the Owner field on deals/tasks.
 */
export function PeoplePicker({
  value,
  onChange,
  triggerLabel,
  triggerActiveLabel,
  allowClear = true,
  options = TEAM_MEMBERS.map(String),
  align = "start",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  triggerLabel: string; // label shown when nothing selected
  triggerActiveLabel?: (selected: string[]) => string; // optional formatter
  allowClear?: boolean;
  options?: string[];
  align?: "start" | "center" | "end";
}) {
  const activeLabel =
    value.length === 0
      ? triggerLabel
      : triggerActiveLabel
        ? triggerActiveLabel(value)
        : value.length === 1
          ? value[0]
          : `${value.length} selected`;

  function toggle(name: string) {
    if (value.includes(name)) onChange(value.filter((v) => v !== name));
    else onChange([...value, name]);
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant={value.length > 0 ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
          >
            👤 {activeLabel}
          </Button>
        }
      />
      <PopoverContent align={align} className="w-56 p-2">
        <div className="space-y-1">
          {options.map((name) => (
            <label
              key={name}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
            >
              <Checkbox checked={value.includes(name)} onCheckedChange={() => toggle(name)} />
              <span className="flex-1">{name}</span>
            </label>
          ))}
          {allowClear && value.length > 0 && (
            <>
              <div className="h-px bg-border my-1" />
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onChange([])}>
                Clear selection
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
