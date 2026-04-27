"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryContactsAutosuggestAction } from "@/app/deal/[id]/actions/autosuggest";
import type { ContactAutosuggestRow } from "@/lib/contacts-query";

/**
 * Phase 3 Plan 06 Task 2 — reusable contact autosuggest combobox (PEOPLE-03).
 *
 * Opens a popover anchored to the Assign trigger button. The typed query is
 * debounced 200ms and sent to queryContactsAutosuggestAction (Task 1's thin
 * Server Action wrapper around queryContactsAutosuggest). Results are
 * ordered per the Plan 03 ranking: exact > prefix > substring, tie-broken
 * by alphabetical.
 *
 * Always includes a "Create new contact" row at the bottom when the query
 * is non-empty. Clicking it calls onCreateNew(typedValue) — the parent
 * (role-slot-row) is responsible for opening NewContactDialog pre-filled
 * and auto-assigning the new contact on success.
 *
 * base-nova caveat: PopoverTrigger uses `render={<Button.../>}` (NOT asChild).
 */
export function ContactAutosuggest({
  onPick,
  onCreateNew,
  triggerLabel = "Assign",
}: {
  onPick: (row: ContactAutosuggestRow) => void;
  onCreateNew: (typedValue: string) => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [rows, setRows] = useState<ContactAutosuggestRow[]>([]);
  const [, startTransition] = useTransition();

  // Debounced fetch — 200ms keeps per-keystroke pressure off the server
  // without feeling laggy for Carrie's typing cadence.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        setRows([]);
        return;
      }
      startTransition(async () => {
        const result = await queryContactsAutosuggestAction(trimmed, 8);
        setRows(result);
      });
    }, 200);
    return () => window.clearTimeout(id);
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4" />
            {triggerLabel}
          </Button>
        }
      />
      <PopoverContent className="w-[320px] p-2" align="start">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search name or email…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="mt-2 max-h-[260px] overflow-y-auto">
          {rows.length > 0 ? (
            <ul className="flex flex-col">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(r);
                      setOpen(false);
                      setValue("");
                    }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-muted flex flex-col"
                  >
                    <span className="font-medium text-sm">{r.fullName}</span>
                    {r.email || r.org ? (
                      <span className="text-xs text-muted-foreground">
                        {[r.email, r.org].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : value.trim().length > 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-2">
              No matches.
            </p>
          ) : null}
          {value.trim().length > 0 ? (
            <button
              type="button"
              onClick={() => {
                onCreateNew(value.trim());
                setOpen(false);
                setValue("");
              }}
              className="mt-1 w-full text-left px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2 border-t"
            >
              <Plus className="h-3 w-3" />
              <span className="text-sm">
                Create new contact:{" "}
                <span className="font-medium">&ldquo;{value.trim()}&rdquo;</span>
              </span>
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
