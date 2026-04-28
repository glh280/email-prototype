"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell filter popover)
 * CREATED: 2026-04-28
 * STATUS: new (real client-side filter applied in Inbox2Shell)
 * REINTEGRATION: L2+ moves filter state to URL params
 *   (`?unread=1&priority=high&...`) so views are shareable; popover stays
 *   but reads/writes router push instead of local callbacks.
 *
 * Top-bar Filter popover. Operator picks any combination of:
 *   - Quick toggles: Unread / High priority / Has attachment / File-linked
 *   - Date range: Today / 7d / 30d / All
 *   - Mailbox: multi-select against the 13 mock mailbox addresses
 *
 * Reset clears every dimension. Active filter count badges the trigger.
 */

import { Filter as FilterIcon, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  countActiveFilters,
  EMPTY_INBOX_FILTERS,
  type DateRangePreset,
  type Inbox2Filters,
} from "@/mock/types";
import { MOCK_MAILBOXES } from "@/mock/inbox";

const DATE_PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

type Props = {
  filters: Inbox2Filters;
  onChange: (next: Inbox2Filters) => void;
};

export function Inbox2FilterPopover({ filters, onChange }: Props) {
  const activeCount = countActiveFilters(filters);

  function toggle<K extends keyof Inbox2Filters>(key: K, value: Inbox2Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function toggleMailbox(addr: string) {
    const current = new Set(filters.mailboxes ?? []);
    if (current.has(addr)) current.delete(addr);
    else current.add(addr);
    toggle("mailboxes", current.size === 0 ? undefined : Array.from(current));
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={
              activeCount > 0
                ? `Filter — ${activeCount} active`
                : "Filter"
            }
            className={cn(
              "inline-flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs hover:bg-muted/50 outline-none",
              activeCount > 0 && "border-primary/40 bg-primary/5",
            )}
          >
            <FilterIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <span>Filter</span>
            {activeCount > 0 ? (
              <span className="ml-0.5 rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-medium tabular-nums leading-none">
                {activeCount}
              </span>
            ) : null}
          </button>
        }
      />
      <PopoverContent side="bottom" align="start" className="w-[320px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Filter inbox
          </div>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={() => onChange(EMPTY_INBOX_FILTERS)}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" aria-hidden />
              Reset all
            </button>
          ) : null}
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-3 py-2 space-y-4">
          <Section label="Quick filters">
            <ToggleRow
              label="Unread only"
              checked={!!filters.unread}
              onChange={(v) => toggle("unread", v || undefined)}
            />
            <ToggleRow
              label="High priority only"
              checked={!!filters.highPriority}
              onChange={(v) => toggle("highPriority", v || undefined)}
            />
            <ToggleRow
              label="Has attachment"
              checked={!!filters.hasAttachment}
              onChange={(v) => toggle("hasAttachment", v || undefined)}
            />
            <ToggleRow
              label="File-linked only"
              checked={!!filters.fileLinked}
              onChange={(v) => toggle("fileLinked", v || undefined)}
            />
          </Section>

          <Section label="Date range">
            <div className="grid grid-cols-2 gap-1">
              {DATE_PRESETS.map((p) => {
                const active = (filters.dateRange ?? "all") === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle("dateRange", p.id === "all" ? undefined : p.id)}
                    className={cn(
                      "rounded border px-2 py-1 text-[11px] text-left transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-foreground font-medium"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section label="Mailbox">
            <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
              {MOCK_MAILBOXES.map((addr) => {
                const checked = (filters.mailboxes ?? []).includes(addr);
                return (
                  <label
                    key={addr}
                    className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleMailbox(addr)}
                    />
                    <span className="font-mono text-[10.5px] truncate">{addr}</span>
                  </label>
                );
              })}
            </div>
          </Section>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[12px] cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span>{label}</span>
    </label>
  );
}
