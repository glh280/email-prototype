"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ChangeEntry } from "@/mock/types";
import { relativeTime } from "@/mock/helpers";

/**
 * Change history inline card. Shows up to 5 entries; clicking "View all"
 * opens a scrollable popup dialog. Live — new entries appended by parent.
 */
export function ChangeHistorySection({ entries }: { entries: ChangeEntry[] }) {
  const [open, setOpen] = useState(false);

  if (entries.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Change history</div>
        <div className="text-sm text-muted-foreground">
          No changes yet. History will populate as edits are made to this deal.
        </div>
      </Card>
    );
  }

  const preview = entries.slice(0, 5);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Change history ({entries.length})
        </div>
        {entries.length > 5 && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline">View all</Button>} />
            <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Change history — {entries.length} entries</DialogTitle>
                <DialogDescription>Every edit to this deal, newest first.</DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto -mx-6 px-6">
                <ul className="space-y-2">
                  {entries.map((h) => (
                    <HistoryRow key={h.id} entry={h} />
                  ))}
                </ul>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="ghost">Close</Button>} />
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <ul className="space-y-2">
        {preview.map((h) => (
          <HistoryRow key={h.id} entry={h} />
        ))}
      </ul>
    </Card>
  );
}

function HistoryRow({ entry }: { entry: ChangeEntry }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="text-xs text-muted-foreground whitespace-nowrap w-24 pt-0.5">{relativeTime(entry.at)}</span>
      <Badge variant="secondary" className="text-[10px] w-20 justify-center">
        {entry.kind ?? "other"}
      </Badge>
      <span className="flex-1">
        <span className="font-medium">{entry.actor}</span>{" "}
        <span className="text-muted-foreground">{entry.summary}</span>
      </span>
    </li>
  );
}
