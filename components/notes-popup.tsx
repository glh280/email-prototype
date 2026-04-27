"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Note } from "@/mock/types";
import { TEAM_MEMBERS } from "@/mock/types";
import { relativeTime } from "@/mock/helpers";
import { getAllNotes, DEALS } from "@/mock/deals";

type SortKey = "smart" | "newest" | "oldest";
const CURRENT_USER = "Carrie";

export function NotesPopupButton() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>(() => getAllNotes());
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [sort, setSort] = useState<SortKey>("smart");

  // Create form
  const [creating, setCreating] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [newUrgent, setNewUrgent] = useState(false);
  const [newDealId, setNewDealId] = useState<string>("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");

  const visible = useMemo(() => {
    let list = notes.filter((n) => (showCompleted ? true : !n.completed));
    if (urgentOnly) list = list.filter((n) => !!n.urgent);

    if (sort === "newest") {
      list = [...list].sort((a, b) => (effectiveSortDate(a) < effectiveSortDate(b) ? 1 : -1));
    } else if (sort === "oldest") {
      list = [...list].sort((a, b) => (effectiveSortDate(a) > effectiveSortDate(b) ? 1 : -1));
    } else {
      // smart default: urgent first, then newest-by-updated-or-created
      list = [...list].sort((a, b) => {
        if (!!a.urgent !== !!b.urgent) return a.urgent ? -1 : 1;
        return effectiveSortDate(a) < effectiveSortDate(b) ? 1 : -1;
      });
    }
    return list;
  }, [notes, urgentOnly, showCompleted, sort]);

  function effectiveSortDate(n: Note) {
    return n.updatedAt ?? n.createdAt;
  }

  function toggleCompleted(id: string) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, completed: !n.completed, updatedAt: new Date().toISOString(), authorName: CURRENT_USER }
          : n,
      ),
    );
  }

  function toggleUrgent(id: string) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, urgent: !n.urgent, updatedAt: new Date().toISOString(), authorName: CURRENT_USER } : n,
      ),
    );
  }

  function startEdit(n: Note) {
    setEditingId(n.id);
    setEditDraft(n.body);
  }

  function saveEdit() {
    if (!editingId) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === editingId
          ? { ...n, body: editDraft.trim(), updatedAt: new Date().toISOString(), authorName: CURRENT_USER }
          : n,
      ),
    );
    setEditingId(null);
    setEditDraft("");
    toast.success("Note updated");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  function removeNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    toast.success("Note deleted (simulated)");
  }

  function createNote() {
    if (!newBody.trim()) {
      toast.warning("Note body is empty");
      return;
    }
    const now = new Date().toISOString();
    const note: Note = {
      id: `n_${Date.now()}`,
      body: newBody.trim(),
      authorName: CURRENT_USER,
      createdAt: now,
      updatedAt: now,
      urgent: newUrgent,
      dealId: newDealId || undefined,
    };
    setNotes((prev) => [note, ...prev]);
    setNewBody("");
    setNewUrgent(false);
    setNewDealId("");
    setCreating(false);
    toast.success("Note created (in-memory only)");
  }

  const dealById = Object.fromEntries(DEALS.map((d) => [d.id, d]));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="gap-1.5" title="All notes across deals">
            📝 Notes <span className="text-xs text-muted-foreground">({notes.filter((n) => !n.completed).length})</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[720px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Notes</DialogTitle>
          <DialogDescription>
            Click a note&apos;s text to edit. Click tags to toggle them. Type @name to tag a teammate.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 pb-3 border-b">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={urgentOnly} onChange={(e) => setUrgentOnly(e.target.checked)} className="accent-foreground" />
            🔥 Urgent only
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border px-2 py-1 text-xs bg-background"
          >
            <option value="smart">Urgent first, then newest</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} className="accent-foreground" />
            Show completed
          </label>
          <div className="flex-1" />
          <Button size="sm" variant={creating ? "secondary" : "default"} onClick={() => setCreating(!creating)}>
            {creating ? "Cancel" : "+ New note"}
          </Button>
        </div>

        {creating && (
          <div className="border rounded-md p-3 my-3 space-y-2 bg-muted/30">
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Note body… (type @name to tag someone)"
              rows={3}
              className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
            />
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={newDealId}
                onChange={(e) => setNewDealId(e.target.value)}
                className="rounded-md border px-2 py-1 text-xs bg-background"
              >
                <option value="">(no deal — standalone)</option>
                {DEALS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.track} · {d.title}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={newUrgent} onChange={(e) => setNewUrgent(e.target.checked)} className="accent-foreground" />
                🔥 Urgent
              </label>
              <div className="flex-1" />
              <Button size="sm" onClick={createNote}>Save</Button>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Tip: @Carrie @Mike @Melissa @Jais @Aunt Steff @Taylor — these get highlighted and (in production) notify the person.
            </div>
          </div>
        )}

        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          {visible.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No notes match the current filters.</div>
          ) : (
            <ul className="divide-y">
              {visible.map((n) => {
                const deal = n.dealId ? dealById[n.dealId] : undefined;
                const isEditing = editingId === n.id;
                return (
                  <li key={n.id} className={`py-3 ${n.urgent ? "bg-rose-50/60 dark:bg-rose-950/20 -mx-6 px-6" : ""}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <button
                            onClick={() => toggleUrgent(n.id)}
                            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                              n.urgent
                                ? "bg-rose-500 text-white border-rose-500"
                                : "bg-background text-muted-foreground border-dashed hover:border-rose-400 hover:text-rose-500"
                            }`}
                            title="Click to toggle urgent"
                          >
                            {n.urgent ? "🔥 URGENT" : "+ urgent"}
                          </button>
                          <button
                            onClick={() => toggleCompleted(n.id)}
                            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                              n.completed
                                ? "bg-emerald-500 text-white border-emerald-500"
                                : "bg-background text-muted-foreground border-dashed hover:border-emerald-400 hover:text-emerald-600"
                            }`}
                            title="Click to mark complete / uncomplete"
                          >
                            {n.completed ? "✓ Done" : "+ done"}
                          </button>
                          {deal && (
                            <span className="text-xs text-muted-foreground truncate">
                              → <span className="font-medium">{deal.track}</span>: {deal.title}
                            </span>
                          )}
                          {!deal && <span className="text-xs text-muted-foreground">Standalone</span>}
                        </div>

                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              rows={3}
                              autoFocus
                              className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveEdit}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(n)}
                            className={`text-sm whitespace-pre-wrap text-left w-full hover:bg-muted/40 rounded px-1 -mx-1 py-0.5 ${
                              n.completed ? "line-through text-muted-foreground" : ""
                            }`}
                            title="Click to edit"
                          >
                            <HighlightMentions text={n.body} />
                          </button>
                        )}

                        <div className="text-xs text-muted-foreground mt-1">
                          {n.authorName} · {relativeTime(n.updatedAt ?? n.createdAt)}
                          {n.updatedAt && n.updatedAt !== n.createdAt && (
                            <span className="italic"> (edited)</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {!isEditing && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("Delete this note?")) removeNote(n.id);
                            }}
                            title="Delete"
                          >
                            🗑
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Highlight @mentions in a note body. */
export function HighlightMentions({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const regex = new RegExp(`@(${TEAM_MEMBERS.map((m) => m.replace(/\s+/g, "\\s?")).join("|")})`, "gi");
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <Badge key={`${match.index}-${match[0]}`} variant="secondary" className="text-[10px] px-1 py-0 mx-0.5 bg-blue-100 text-blue-900 border-0 align-baseline">
        {match[0]}
      </Badge>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
