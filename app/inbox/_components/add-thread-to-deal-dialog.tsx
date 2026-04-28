"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/add-thread-to-deal-dialog.tsx
 * COPIED: 2026-04-27
 * STATUS: stubbed — Confirm = no-op + console.log (DEAD CALL)
 * REINTEGRATION: restore `addThreadToFile` server action + deal autosuggest.
 *
 * Iter (2026-04-28): typeahead over known file numbers. Substring match
 * so partial sequences work — typing "0002" matches "FL-2026-0002" and
 * "NM-2026-00023". L1 source = mock/inbox2.ts::searchKnownFileNumbers
 * (rowsForTab union); L2 swaps to a server-driven `deals.file_no`
 * autocomplete query.
 *
 * Phase 04.2 Plan 11 — Manual file-association picker. THE primary dead call —
 * file-assignment is the user's "leave dead, reactivate later" surface per spec.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchKnownFileNumbers } from "@/mock/inbox2";

export function AddThreadToDealDialog({
  open,
  onOpenChange,
  threadId,
  messageId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  messageId: string;
}) {
  const [query, setQuery] = useState("");

  // Recompute on every keystroke; the underlying source is a small
  // in-memory union (~dozen file numbers) so a debounce isn't needed.
  // L2 swaps this for a server query which WILL want a debounce.
  const matches = useMemo(() => searchKnownFileNumbers(query, 12), [query]);

  function commit(value: string) {
    const target = value.trim();
    if (!target) return;
    // DEAD CALL — primary file-assignment stub per spec
    // (PROTOTYPE-DEAD-CALLS.md row 1).
    console.log("[stub] addThreadToFile", {
      threadId,
      messageId,
      query: target,
    });
    toast.success(`Stub: would assign thread to "${target}" (dead call).`);
    onOpenChange(false);
    setQuery("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add thread to file</DialogTitle>
          <DialogDescription>
            Type a file number — partial matches work (e.g. &quot;0002&quot;).
          </DialogDescription>
        </DialogHeader>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Enter commits the top match if any, else the raw query
              // (lets the operator force a value not yet in the index).
              const target = matches[0] ?? query;
              commit(target);
            }
          }}
          placeholder="FL-2026-001 or just 0002…"
          className="text-sm font-mono"
          autoFocus
        />
        <div className="-mt-1 max-h-[260px] overflow-y-auto rounded border bg-muted/20">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-muted-foreground italic">
              No file numbers match. Press Enter to use &quot;{query}&quot;
              anyway.
            </div>
          ) : (
            <ul>
              {matches.map((fileNo) => (
                <li key={fileNo}>
                  <button
                    type="button"
                    onClick={() => commit(fileNo)}
                    className="w-full text-left px-3 py-1.5 text-[12px] font-mono hover:bg-background flex items-center gap-2"
                  >
                    {highlight(fileNo, query)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground italic">
          Stub: dead call — clicking a row fires `addThreadToFile` console
          log + toast (no DB write in L1).
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => commit(matches[0] ?? query)} disabled={!query.trim() && matches.length === 0}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Render a file number with the matched substring highlighted. Pure
 * presentation — the substring search itself is case-insensitive in
 * `searchKnownFileNumbers`, so we re-find the index here at the same
 * casing rules.
 */
function highlight(fileNo: string, query: string): React.ReactNode {
  const needle = query.trim().toLowerCase();
  if (!needle) return fileNo;
  const lower = fileNo.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx < 0) return fileNo;
  return (
    <>
      <span>{fileNo.slice(0, idx)}</span>
      <span className="bg-amber-200 dark:bg-amber-900/60 rounded px-0.5">
        {fileNo.slice(idx, idx + needle.length)}
      </span>
      <span>{fileNo.slice(idx + needle.length)}</span>
    </>
  );
}
