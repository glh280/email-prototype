"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { relativeTime } from "@/lib/format";
import { createNote } from "@/app/deal/[id]/actions/notes";
import type { DealDetail } from "@/lib/deals-query";
import type { NoteListRow } from "@/lib/notes-query";

/**
 * Phase 2 Plan 06 — Notes tab (UI-SPEC lines 420-447).
 *
 * Composer at top: Textarea with "Add a note…" placeholder + Save note CTA
 * that only appears when the textarea has content. Save calls the createNote
 * server action; on success resets the textarea + toasts `Note added.`
 *
 * Below the composer, notes render newest-first as Cards with:
 *   - Avatar (initials) + author name + relativeTime(createdAt)
 *   - System chip for is_system=true (kill reason mirrors)
 *   - Body in Body tier
 *
 * Empty state (no notes): StickyNote 48px + `No notes yet` + body. The
 * composer is still rendered above the empty state so Carrie can add the
 * first note without finding an empty-state CTA.
 */

function initialsFrom(name: string | null, email: string | null): string {
  const source = name ?? email ?? "?";
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function NotesTab(props: {
  deal: DealDetail;
  notes: NoteListRow[];
}) {
  const { deal, notes } = props;
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const handleSave = () => {
    const trimmed = body.trim();
    if (trimmed.length === 0) return;

    startTransition(async () => {
      const result = await createNote({ dealId: deal.id, body: trimmed });
      if (result.ok) {
        setBody("");
        toast.success("Note added.");
        router.refresh();
      } else if ("errors" in result) {
        const firstMsg =
          result.errors.body?.[0] ?? result.errors.dealId?.[0] ?? "invalid";
        toast.error(`Couldn't save note — ${firstMsg}. Try again.`);
      } else {
        toast.error(`Couldn't save note — ${result.error}. Try again.`);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Composer */}
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
          rows={3}
          disabled={isPending}
        />
        {body.trim().length > 0 ? (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isPending}>
              Save note
            </Button>
          </div>
        ) : null}
      </div>

      {/* Notes list OR empty state */}
      {notes.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <StickyNote
            className="h-12 w-12 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="mt-6 text-[28px] font-semibold leading-[1.2]">
            No notes yet
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Use notes for free-form context that doesn&apos;t fit elsewhere.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <Card key={n.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px]">
                      {initialsFrom(n.authorName, n.authorEmail)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">
                    {n.authorName ?? n.authorEmail ?? "unknown"}
                  </span>
                  {n.isSystem ? (
                    <span className="text-[11px] bg-secondary text-secondary-foreground ring-1 ring-border rounded-md px-1.5 py-0.5 font-medium">
                      system
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground font-mono">
                    {relativeTime(n.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
