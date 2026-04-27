"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  parseContactsFilterParams,
  serializeContactsFilterParams,
} from "@/lib/contacts-filter-params";

/**
 * Phase 3 Plan 05 Task 2 — /contacts search bar.
 *
 * URL-state (D-07): `?q=<query>`. Mirrors the P1 DealsFilterBar pattern —
 * all state derives from URL on mount; local `value` is just the controlled
 * input echoing URL while the user types.
 *
 * Debounce: 250ms after the last keystroke before router.push, so typing
 * doesn't thrash the server re-render on every character. When URL state
 * changes externally (e.g., Clear search link), the effect re-syncs the
 * input.
 */
export function ContactsSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const record: Record<string, string> = {};
  searchParams.forEach((v, k) => (record[k] = v));
  const filters = parseContactsFilterParams(record);

  const [value, setValue] = useState(filters.q);

  // Keep local input in sync when URL changes externally (Clear search link)
  useEffect(() => {
    setValue(filters.q);
  }, [filters.q]);

  // Debounced push on typing
  useEffect(() => {
    const id = window.setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed === filters.q) return;
      const serialized = serializeContactsFilterParams({ q: trimmed });
      const qs = serialized.toString();
      router.push(qs ? `/contacts?${qs}` : "/contacts");
    }, 250);
    return () => window.clearTimeout(id);
  }, [value, filters.q, router]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name, email, or org…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="pl-8"
        />
        {value.length > 0 ? (
          <button
            type="button"
            onClick={() => setValue("")}
            className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
