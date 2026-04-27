"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Track,
  type Priority,
  TRACK_LABEL,
  TRACK_COLOR,
  PRIORITY_LABEL,
  PRIORITY_COLOR,
} from "@/mock/types";

/** Dropdown showing "Title" / "Lending" / etc. — NOT the two-letter code. */
export function TrackDropdown({
  value,
  onChange,
}: {
  value: Track;
  onChange: (t: Track) => void;
}) {
  const tracks: Track[] = ["TI", "LN", "DD", "CS", "PT"];
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Track)}>
      <SelectTrigger className={`h-7 px-2 py-0 text-[11px] font-semibold border-0 ${TRACK_COLOR[value]} hover:opacity-90`}>
        <SelectValue>{TRACK_LABEL[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {tracks.map((t) => (
          <SelectItem key={t} value={t}>
            {TRACK_LABEL[t]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PriorityDropdown({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
}) {
  const priorities: Priority[] = ["low", "med", "high"];
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Priority)}>
      <SelectTrigger className={`h-7 px-2 py-0 text-[11px] font-semibold border-0 ${PRIORITY_COLOR[value]} hover:opacity-90`}>
        <SelectValue>{PRIORITY_LABEL[value]} priority</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {priorities.map((p) => (
          <SelectItem key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
