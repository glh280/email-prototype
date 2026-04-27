"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StageStepper } from "@/components/stage-stepper";
import { StageDropdown } from "@/components/stage-dropdown";
import { DraftEmailButton } from "@/components/draft-email-dialog";
import { ContactHoverCard } from "@/components/contact-hover-card";
import { PeoplePicker } from "@/components/people-picker";
import { RefreshButton } from "@/components/refresh-button";
import { DealDetailsButton } from "@/components/deal-details-popup";
import { EmailThreads } from "@/components/email-threads";
import { EditableCurrency } from "@/components/editable-currency";
import { ChangeHistorySection } from "@/components/change-history";
import { TrackDropdown, PriorityDropdown } from "@/components/track-priority-dropdowns";
import { HighlightMentions } from "@/components/notes-popup";
import type { Deal, StageKey, Task, Track, Priority, Note, ChangeEntry, DealDocument } from "@/mock/types";
import { ROLE_LABEL } from "@/mock/types";
import { stageLabel, relativeTime } from "@/mock/helpers";

const CURRENT_USER = "Carrie";

export function DealDetail({ deal: initial }: { deal: Deal }) {
  const [deal, setDeal] = useState<Deal>(initial);

  /* --- change-history helper --- */
  function recordChange(kind: ChangeEntry["kind"], summary: string) {
    setDeal((prev) => ({
      ...prev,
      changeHistory: [
        {
          id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          at: new Date().toISOString(),
          actor: CURRENT_USER,
          kind,
          summary,
        },
        ...(prev.changeHistory ?? []),
      ],
      lastActivityAt: new Date().toISOString(),
    }));
  }

  /* --- stage / track / priority --- */
  function setStage(next: StageKey) {
    if (next === deal.stage) return;
    const summary = `Stage changed: ${stageLabel(deal.stage)} → ${stageLabel(next)}`;
    setDeal((d) => ({ ...d, stage: next }));
    recordChange("stage", summary);
    toast.success(summary);
  }

  function setTrack(next: Track) {
    if (next === deal.track) return;
    const summary = `Track changed to ${next}`;
    setDeal((d) => ({ ...d, track: next }));
    recordChange("other", summary);
    toast.success(summary);
  }

  function setPriority(next: Priority) {
    if (next === deal.priority) return;
    const summary = `Priority changed to ${next}`;
    setDeal((d) => ({ ...d, priority: next }));
    recordChange("other", summary);
    toast.success(summary);
  }

  function setOwners(owners: string[]) {
    const summary = `Owners set to ${owners.join(", ") || "—"}`;
    setDeal((d) => ({ ...d, internalOwners: owners as Deal["internalOwners"] }));
    recordChange("people", summary);
    toast.success("Owners updated");
  }

  /* --- tasks --- */
  function toggleTaskComplete(id: string) {
    setDeal((prev) => {
      const task = prev.tasks.find((t) => t.id === id);
      if (!task) return prev;
      const becomingDone = task.status !== "done";
      const updated = prev.tasks.map((t) => {
        if (t.id !== id) return t;
        return { ...t, status: becomingDone ? ("done" as const) : ("open" as const), isNext: becomingDone ? false : t.isNext };
      });
      // Maintain is_next invariant: promote first open task if none is flagged
      if (becomingDone) {
        const anyNext = updated.some((t) => t.isNext);
        if (!anyNext) {
          const firstOpen = updated.find((t) => t.status === "open");
          if (firstOpen) firstOpen.isNext = true;
        }
      }
      return { ...prev, tasks: updated };
    });
    const task = deal.tasks.find((t) => t.id === id);
    const was = task?.status === "done" ? "re-opened" : "completed";
    recordChange("task", `Task "${task?.title ?? ""}" ${was}`);
    toast.success(`Task ${was}`);
  }

  function setTaskOwners(taskId: string, owners: string[]) {
    const t = deal.tasks.find((x) => x.id === taskId);
    setDeal((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === taskId ? { ...x, owners } : x)) }));
    recordChange("people", `Reassigned task "${t?.title ?? ""}" to ${owners.join(", ") || "—"}`);
  }

  /* --- notes --- */
  function addNote(body: string, urgent: boolean) {
    if (!body.trim()) return;
    const now = new Date().toISOString();
    const note: Note = {
      id: `n_${Date.now()}`,
      body: body.trim(),
      authorName: CURRENT_USER,
      createdAt: now,
      updatedAt: now,
      urgent,
      dealId: deal.id,
    };
    setDeal((d) => ({ ...d, notes: [note, ...d.notes] }));
    recordChange("note", `Added note: ${body.slice(0, 60)}${body.length > 60 ? "…" : ""}`);
    toast.success("Note added");
  }

  function editNote(id: string, body: string) {
    setDeal((d) => ({
      ...d,
      notes: d.notes.map((n) =>
        n.id === id ? { ...n, body: body.trim(), updatedAt: new Date().toISOString(), authorName: CURRENT_USER } : n,
      ),
    }));
    recordChange("note", `Edited note: ${body.slice(0, 60)}${body.length > 60 ? "…" : ""}`);
  }

  function toggleNoteUrgent(id: string) {
    const cur = deal.notes.find((n) => n.id === id);
    setDeal((d) => ({
      ...d,
      notes: d.notes.map((n) =>
        n.id === id ? { ...n, urgent: !n.urgent, updatedAt: new Date().toISOString(), authorName: CURRENT_USER } : n,
      ),
    }));
    recordChange("note", `${cur?.urgent ? "Unmarked" : "Marked"} note as urgent`);
  }

  function removeNote(id: string) {
    const cur = deal.notes.find((n) => n.id === id);
    setDeal((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));
    recordChange("note", `Deleted note: ${cur?.body.slice(0, 40) ?? ""}`);
    toast.success("Note deleted");
  }

  /* --- currency --- */
  function setMoney(field: "purchasePrice" | "loanAmount" | "downPayment", value: number | undefined) {
    const before = deal[field];
    setDeal((d) => ({ ...d, [field]: value }));
    recordChange("other", `${field} changed: ${before ?? "—"} → ${value ?? "—"}`);
  }

  /* --- documents --- */
  function addDocument(doc: DealDocument) {
    setDeal((d) => ({ ...d, documents: [...(d.documents ?? []), doc] }));
    recordChange("document", `Uploaded "${doc.name}"`);
  }

  function removeDocument(id: string) {
    const d = deal.documents?.find((x) => x.id === id);
    setDeal((cur) => ({ ...cur, documents: (cur.documents ?? []).filter((x) => x.id !== id) }));
    recordChange("document", `Removed "${d?.name ?? ""}"`);
  }

  /* --- property / file edit --- */
  const [globalEdit, setGlobalEdit] = useState(false);

  const visibleTasks = deal.tasks.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← All deals
        </Link>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={globalEdit ? "default" : "outline"} onClick={() => setGlobalEdit(!globalEdit)}>
            {globalEdit ? "✓ Done editing" : "✎ Edit file"}
          </Button>
          <DealDetailsButton deal={deal} />
          <RefreshButton />
        </div>
      </div>

      {/* Deal header card (same style as other cards — no red ring) */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <TrackDropdown value={deal.track} onChange={setTrack} />
              <PriorityDropdown value={deal.priority} onChange={setPriority} />
              {deal.titleCTC && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-200">Title CTC</Badge>
              )}
              {deal.lenderCTC && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-200">Lender CTC</Badge>
              )}
            </div>
            <EditableText
              value={deal.propertyAddress ?? deal.title}
              editable={globalEdit || !deal.propertyAddress}
              onChange={(v) => {
                setDeal((d) => ({ ...d, propertyAddress: v }));
                recordChange("other", `Property address updated to ${v}`);
              }}
              className="text-2xl font-semibold tracking-tight mt-2"
            />
            <EditableText
              value={deal.title}
              editable={globalEdit}
              onChange={(v) => {
                setDeal((d) => ({ ...d, title: v }));
                recordChange("other", `Deal title updated to ${v}`);
              }}
              className="text-sm text-muted-foreground mt-0.5"
            />
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>Last activity: {relativeTime(deal.lastActivityAt)}</div>
            {deal.closingAt && (
              <div>
                Closing: {new Date(deal.closingAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Owners:</span>
            <PeoplePicker
              value={deal.internalOwners as string[]}
              onChange={setOwners}
              triggerLabel="Assign owners"
              triggerActiveLabel={(sel) => sel.join(", ")}
            />
          </div>
        </div>
      </Card>

      {/* Progress card — stage dropdown top-right */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Progress</div>
          <StageDropdown value={deal.stage} onChange={setStage} className="min-w-[240px]" />
        </div>
        <StageStepper current={deal.stage} />
      </Card>

      {/* Key figures — inline editable */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Purchase</div>
          <div className="text-lg font-semibold mt-0.5">
            <EditableCurrency value={deal.purchasePrice} onChange={(v) => setMoney("purchasePrice", v)} />
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Loan</div>
          <div className="text-lg font-semibold mt-0.5">
            <EditableCurrency value={deal.loanAmount} onChange={(v) => setMoney("loanAmount", v)} />
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Down</div>
          <div className="text-lg font-semibold mt-0.5">
            <EditableCurrency value={deal.downPayment} onChange={(v) => setMoney("downPayment", v)} />
          </div>
        </Card>
      </div>

      {/* People (left) + Notes (right) */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            People on file ·{" "}
            <span className="text-muted-foreground/70 font-normal normal-case">hover or click a name</span>
          </div>
          <div className="space-y-2">
            {deal.people.map((p) => (
              <div key={p.roleSlot} className="text-sm">
                <ContactHoverCard contact={p.contact} deal={deal}>
                  <span className="font-medium">{p.contact.fullName}</span>
                </ContactHoverCard>
                <div className="text-xs text-muted-foreground">
                  {ROLE_LABEL[p.roleSlot]}
                  {p.contact.org ? ` · ${p.contact.org}` : ""}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <NotesSection
          notes={deal.notes}
          onAdd={addNote}
          onEdit={editNote}
          onToggleUrgent={toggleNoteUrgent}
          onRemove={removeNote}
        />
      </div>

      {/* Tasks */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tasks · {deal.tasks.filter((t) => t.status === "open").length} open
          </div>
          {deal.tasks.length > 5 && <div className="text-xs text-muted-foreground">Showing 5 of {deal.tasks.length}</div>}
        </div>
        <ul className="divide-y">
          {visibleTasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              deal={deal}
              onToggleComplete={toggleTaskComplete}
              onOwnersChange={(owners) => setTaskOwners(t.id, owners)}
            />
          ))}
        </ul>
      </Card>

      {/* Documents */}
      <DocumentsCard docs={deal.documents ?? []} onAdd={addDocument} onRemove={removeDocument} />

      {/* Linked emails (full width) + ClickUp + GHL stacked */}
      <LinkedCards deal={deal} />

      {/* Change history — live */}
      <ChangeHistorySection entries={deal.changeHistory ?? []} />
    </div>
  );
}

/* ---------------- sub-components ---------------- */

function EditableText({
  value,
  onChange,
  editable,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editable) return <h1 className={className}>{value}</h1>;
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onChange(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (draft !== value) onChange(draft);
            setEditing(false);
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`${className} bg-background border rounded px-1 outline-none focus:ring-2 focus:ring-foreground/20`}
      />
    );
  }
  return (
    <button onClick={() => setEditing(true)} className={`${className} text-left hover:bg-muted/40 rounded px-1 -mx-1`} title="Click to edit">
      {value}
    </button>
  );
}

function TaskRow({
  task,
  deal,
  onToggleComplete,
  onOwnersChange,
}: {
  task: Task;
  deal: Deal;
  onToggleComplete: (id: string) => void;
  onOwnersChange: (owners: string[]) => void;
}) {
  return (
    <li className={`px-4 py-3 flex items-start gap-3 ${task.isNext ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}`}>
      <button
        onClick={() => onToggleComplete(task.id)}
        className="mt-0.5"
        title={task.status === "done" ? "Click to re-open" : "Mark complete"}
      >
        {task.status === "done" ? (
          <span className="inline-block h-5 w-5 rounded-full bg-emerald-500 text-white text-xs leading-5 text-center">✓</span>
        ) : task.isNext ? (
          <span className="inline-block h-5 w-5 rounded-full border-2 border-amber-500 hover:bg-amber-100 dark:hover:bg-amber-950" />
        ) : (
          <span className="inline-block h-5 w-5 rounded-full border-2 border-muted-foreground/40 hover:border-foreground" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className={`text-sm ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
          {task.isNext && (
            <Badge variant="outline" className="ml-2 border-amber-500 text-amber-700 dark:text-amber-300">
              next up
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <PeoplePicker
            value={task.owners}
            onChange={onOwnersChange}
            triggerLabel="Assign"
            triggerActiveLabel={(sel) => sel.join(", ")}
          />
          {task.dueAt && <span className="text-xs text-muted-foreground">Due {relativeTime(task.dueAt)}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <DraftEmailButton deal={deal} taskTitle={task.title} />
        <Button size="sm" variant="ghost" onClick={() => onToggleComplete(task.id)}>
          {task.status === "done" ? "Re-open" : "Complete"}
        </Button>
      </div>
    </li>
  );
}

function NotesSection({
  notes,
  onAdd,
  onEdit,
  onToggleUrgent,
  onRemove,
}: {
  notes: Note[];
  onAdd: (body: string, urgent: boolean) => void;
  onEdit: (id: string, body: string) => void;
  onToggleUrgent: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [draftUrgent, setDraftUrgent] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  function commitAdd() {
    if (!draft.trim()) return;
    onAdd(draft, draftUrgent);
    setDraft("");
    setDraftUrgent(false);
  }

  return (
    <Card className="p-4">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Notes</div>

      {/* New-note form */}
      <div className="border rounded-md p-2 mb-3 bg-muted/20">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note… @name to tag a teammate"
          rows={2}
          className="w-full rounded border px-2 py-1 text-sm bg-background"
        />
        <div className="flex items-center gap-2 mt-1.5">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={draftUrgent} onChange={(e) => setDraftUrgent(e.target.checked)} className="accent-foreground" />
            🔥 Urgent
          </label>
          <div className="flex-1" />
          <Button size="sm" onClick={commitAdd} disabled={!draft.trim()}>
            Add note
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="text-sm text-muted-foreground">No notes yet.</div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => {
            const isEditing = editingId === n.id;
            return (
              <div
                key={n.id}
                className={`rounded p-3 ${
                  n.urgent ? "bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900" : "bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <button
                    onClick={() => onToggleUrgent(n.id)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      n.urgent
                        ? "bg-rose-500 text-white border-rose-500"
                        : "bg-background text-muted-foreground border-dashed hover:border-rose-400 hover:text-rose-500"
                    }`}
                    title="Toggle urgent"
                  >
                    {n.urgent ? "🔥 URGENT" : "+ urgent"}
                  </button>
                  <div className="flex-1" />
                  {!isEditing && (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(n.id);
                          setEditDraft(n.body);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground px-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this note?")) onRemove(n.id);
                        }}
                        className="text-[10px] text-destructive hover:text-destructive px-1"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      autoFocus
                      rows={3}
                      className="w-full rounded border px-2 py-1 text-sm bg-background"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          onEdit(n.id, editDraft);
                          setEditingId(null);
                        }}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(n.id);
                      setEditDraft(n.body);
                    }}
                    className="text-sm whitespace-pre-wrap text-left w-full hover:bg-background/50 rounded px-1 -mx-1"
                    title="Click to edit"
                  >
                    <HighlightMentions text={n.body} />
                  </button>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {n.authorName} · {relativeTime(n.updatedAt ?? n.createdAt)}
                  {n.updatedAt && n.updatedAt !== n.createdAt && <span className="italic"> (edited)</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function DocumentsCard({
  docs,
  onAdd,
  onRemove,
}: {
  docs: DealDocument[];
  onAdd: (doc: DealDocument) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onFiles(files: FileList | null) {
    if (!files) return;
    const now = new Date().toISOString();
    for (const f of Array.from(files)) {
      const ext = f.name.split(".").pop()?.toLowerCase();
      const kind =
        ext === "pdf" ? "pdf" : ext === "docx" || ext === "doc" ? "docx" : ext === "xlsx" || ext === "xls" || ext === "csv" ? "xlsx" : ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif" ? "image" : "other";
      onAdd({
        id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        uploadedBy: CURRENT_USER,
        uploadedAt: now,
        size: formatBytes(f.size),
        kind,
      });
    }
    toast.success(`Uploaded ${files.length} file${files.length === 1 ? "" : "s"} (stored in memory only)`);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Documents ({docs.length})
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={(e) => onFiles(e.target.files)}
            className="hidden"
            id="doc-upload-input"
          />
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            ⬆ Upload
          </Button>
          <Button size="sm" variant="ghost" disabled title="Planned: link a Google Drive folder for this deal">
            🔗 Link Drive folder
          </Button>
        </div>
      </div>
      <div
        className="border-2 border-dashed border-border rounded-lg p-4 text-center text-sm text-muted-foreground hover:bg-muted/20 cursor-pointer transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("bg-muted/40");
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove("bg-muted/40");
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("bg-muted/40");
          onFiles(e.dataTransfer.files);
        }}
      >
        Drop files here or click to upload
      </div>

      {docs.length > 0 && (
        <ul className="divide-y mt-3">
          {docs.map((d) => (
            <li key={d.id} className="py-2 flex items-center gap-2">
              <span className="text-lg">
                {d.kind === "pdf" ? "📄" : d.kind === "docx" ? "📝" : d.kind === "xlsx" ? "📊" : d.kind === "image" ? "🖼" : "📎"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {d.uploadedBy} · {relativeTime(d.uploadedAt)}
                  {d.size ? ` · ${d.size}` : ""}
                </div>
              </div>
              <Button size="sm" variant="ghost" disabled>
                Download
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onRemove(d.id)} className="text-destructive hover:text-destructive">
                🗑
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function LinkedCards({ deal }: { deal: Deal }) {
  const threads = deal.emailThreads ?? [];
  const hasEmails = threads.length > 0 || deal.linkedEmails.length > 0;
  const hasClickUp = deal.linkedClickUp.length > 0;
  const hasGHL = (deal.linkedGHL?.length ?? 0) > 0;
  const threadCount = threads.length + deal.linkedEmails.length;

  if (!hasEmails && !hasClickUp && !hasGHL) return null;

  return (
    <div className="grid md:grid-cols-[2fr_1fr] gap-4 items-start">
      {hasEmails && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
            <span>Email threads ({threadCount})</span>
            <span className="text-[10px] font-normal normal-case text-muted-foreground">
              click thread to expand · hover a message to preview
            </span>
          </div>
          <EmailThreads threads={threads} legacyEmails={deal.linkedEmails} />
        </Card>
      )}
      <div className="space-y-4">
        {hasClickUp && (
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Linked ClickUp
            </div>
            <ul className="divide-y">
              {deal.linkedClickUp.map((c) => (
                <li key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="text-sm truncate">{c.label}</div>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium px-2 py-1 rounded border hover:bg-muted transition-colors shrink-0"
                  >
                    Open ↗
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {hasGHL && (
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Linked GHL
            </div>
            <ul className="divide-y">
              {(deal.linkedGHL ?? []).map((g) => (
                <li key={g.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="text-sm truncate">{g.label}</div>
                  <a
                    href={g.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium px-2 py-1 rounded border hover:bg-muted transition-colors shrink-0"
                  >
                    Open ↗
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
