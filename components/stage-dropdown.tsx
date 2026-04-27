"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAGES, type StageKey } from "@/mock/types";
import { stageLabel } from "@/mock/helpers";

export function StageDropdown({
  value,
  onChange,
  className,
}: {
  value: StageKey;
  onChange: (next: StageKey) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as StageKey)}>
      <SelectTrigger className={className}>
        {/* Show the human label for the current stage, not the enum key. */}
        <SelectValue>{stageLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STAGES.map((s) => (
          <SelectItem key={s.key} value={s.key}>
            {s.label}
            {s.terminal ? " (terminal)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
