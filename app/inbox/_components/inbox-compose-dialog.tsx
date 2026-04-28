"use client";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/inbox/_components/inbox-compose-dialog.tsx
 * COPIED: 2026-04-27
 * STATUS: heavily modified
 *   • Phase 4.1: compose modes (reply / reply-all / forward), Cc field,
 *     urgent toggle.
 *   • Phase 5.1: 3x wider, 2x taller. Cc/Bcc togglable rows. Multi-file
 *     attachment picker.
 *   • Phase 5.2: HTML rich-text body (contenteditable + execCommand
 *     toolbar). Signature derived from active mailbox and rendered
 *     read-only beneath the editor — switching From swaps the
 *     signature instead of appending a second one. Newoldstamp-style
 *     HTML signatures sourced from `mock/signatures.ts`.
 * REINTEGRATION: restore `sendEmail` server action; thread mode + urgent
 *   into action payload (sets `email.priority_tier = 'HIGH'` when
 *   urgent); wire attachment uploads through the existing upload
 *   service. Replace execCommand with a real editor lib (Lexical /
 *   ProseMirror) before shipping — execCommand is deprecated and lossy
 *   on copy-paste.
 *
 * The dialog is the single compose surface for the prototype — mounted
 * by the top-bar Compose button AND lifted into the inbox2 shell for
 * reply / reply-all / forward. Every future "send email" entry point
 * should mount this same component so the look + behavior stay
 * identical (modular by reuse, not by templating).
 *
 * Phase 04.2 Plan 12 — Compose dialog. DEAD CALL on Send.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  Quote,
  Strikethrough,
  Paperclip,
  X as XIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MOCK_MAILBOXES } from "@/mock/inbox";
import { signatureHtmlForMailbox } from "@/mock/signatures";
import { searchContacts, type Contact } from "@/mock/contacts";
import type { Attachment } from "@/mock/types";

export type ComposeMode = "new" | "reply" | "reply-all" | "forward";

export type ComposeContext = {
  mode: ComposeMode;
  /** Pre-filled values when replying / forwarding. */
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  /** Quoted thread body — appended below the composer area. */
  quotedBody?: string;
  /** Mailbox to send from (overrides defaultMailbox). */
  from?: string;
  /**
   * Attachments on the original thread (Reply / Reply all / Forward).
   * The compose dialog renders an "Include original attachments" button
   * that copies them into the outgoing message as forwarded refs.
   */
  originalAttachments?: Attachment[];
};

/**
 * Attachment slots on the outgoing message. Two flavors so a Reply can
 * forward the original thread's attachments (mock refs) alongside any
 * new files the operator adds from disk.
 */
export type ComposeAttachment =
  | { kind: "file"; file: File }
  | { kind: "mock"; ref: Attachment };

const MODE_TITLE: Record<ComposeMode, string> = {
  new: "New message",
  reply: "Reply",
  "reply-all": "Reply all",
  forward: "Forward",
};

const MODE_SEND_LABEL: Record<ComposeMode, string> = {
  new: "Send",
  reply: "Send reply",
  "reply-all": "Send reply",
  forward: "Forward",
};

const FONT_FAMILIES = [
  { id: "Arial, Helvetica, sans-serif", label: "Sans-serif" },
  { id: "Georgia, 'Times New Roman', serif", label: "Serif" },
  { id: "'Courier New', monospace", label: "Mono" },
];

const FONT_SIZES = [
  { id: "1", label: "Small" },
  { id: "3", label: "Normal" },
  { id: "5", label: "Large" },
  { id: "6", label: "Heading" },
];

const TEXT_COLORS = [
  "#0F172A",
  "#374151",
  "#0E4D2F",
  "#0F2C5A",
  "#B91C1C",
  "#D68A00",
  "#5B21B6",
];

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function InboxComposeDialog({
  open,
  onOpenChange,
  defaultMailbox,
  context,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMailbox: string;
  context?: ComposeContext;
}) {
  const mode = context?.mode ?? "new";
  const [from, setFrom] = useState(context?.from ?? defaultMailbox);
  const [to, setTo] = useState(context?.to ?? "");
  const [cc, setCc] = useState(context?.cc ?? "");
  const [bcc, setBcc] = useState(context?.bcc ?? "");
  const [showCcRow, setShowCcRow] = useState(
    Boolean(context?.cc) || mode === "reply-all" || mode === "forward",
  );
  const [showBccRow, setShowBccRow] = useState(Boolean(context?.bcc));
  const [subject, setSubject] = useState(context?.subject ?? "");
  // Body draft is the editable HTML the operator types ABOVE the
  // signature. The signature itself is derived from `from` and rendered
  // read-only — this is what makes "switch From mailbox" replace the
  // footer instead of appending a new one (Phase 5.2 fix).
  const [bodyDraftHtml, setBodyDraftHtml] = useState<string>("");
  const [urgent, setUrgent] = useState(false);
  const [attachments, setAttachments] = useState<ComposeAttachment[]>([]);
  const [originalIncluded, setOriginalIncluded] = useState(false);
  const [quotedExpanded, setQuotedExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const signatureHtml = useMemo(() => signatureHtmlForMailbox(from), [from]);

  // Sync state to incoming context when the dialog re-opens with a new
  // reply / forward target. Body draft starts empty so the operator
  // sees a clean canvas; signature renders below it derived from From.
  useEffect(() => {
    if (!open) return;
    const nextFrom = context?.from ?? defaultMailbox;
    setFrom(nextFrom);
    setTo(context?.to ?? "");
    setCc(context?.cc ?? "");
    setBcc(context?.bcc ?? "");
    setShowCcRow(
      Boolean(context?.cc) ||
        context?.mode === "reply-all" ||
        context?.mode === "forward",
    );
    setShowBccRow(Boolean(context?.bcc));
    setSubject(context?.subject ?? "");
    setBodyDraftHtml("");
    setUrgent(false);
    setAttachments([]);
    setOriginalIncluded(false);
    setQuotedExpanded(false);
  }, [open, context, defaultMailbox]);

  // Push the (possibly empty) draft HTML into the editor whenever it
  // resets — contenteditable lives outside React's render tree, so we
  // imperatively sync. Subsequent edits flow back via onInput.
  useEffect(() => {
    if (!open) return;
    if (editorRef.current && editorRef.current.innerHTML !== bodyDraftHtml) {
      editorRef.current.innerHTML = bodyDraftHtml;
    }
    // We intentionally only run on `open` to seed the editor, NOT on
    // every state change — otherwise typing would constantly stomp the
    // caret position. Subsequent updates come from the onInput handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function exec(command: string, value?: string) {
    // execCommand is deprecated but still the easiest cross-browser
    // path for a prototype rich-text toolbar. Real editor lib at L2.
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    if (editorRef.current) setBodyDraftHtml(editorRef.current.innerHTML);
  }

  function handleInsertLink() {
    const url = window.prompt("Link URL", "https://");
    if (!url) return;
    exec("createLink", url);
  }

  function handlePickFiles() {
    fileInputRef.current?.click();
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setAttachments((prev) => [
      ...prev,
      ...picked.map<ComposeAttachment>((f) => ({ kind: "file", file: f })),
    ]);
    // eslint-disable-next-line no-console
    console.log("[stub] inbox-compose-dialog attachments-picked", {
      count: picked.length,
      names: picked.map((f) => f.name),
    });
    e.target.value = "";
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  function includeOriginalAttachments() {
    const list = context?.originalAttachments ?? [];
    if (list.length === 0) return;
    setAttachments((prev) => {
      const existing = new Set(
        prev
          .filter((a): a is { kind: "mock"; ref: Attachment } => a.kind === "mock")
          .map((a) => a.ref.id),
      );
      const additions = list
        .filter((a) => !existing.has(a.id))
        .map<ComposeAttachment>((a) => ({ kind: "mock", ref: a }));
      return [...prev, ...additions];
    });
    setOriginalIncluded(true);
    // eslint-disable-next-line no-console
    console.log("[stub] inbox-compose-dialog include-original-attachments", {
      count: list.length,
      names: list.map((a) => a.name),
    });
  }

  function handleSend() {
    const composedHtml = `${bodyDraftHtml}<br/><br/>${signatureHtml}`;
    // DEAD CALL — see PROTOTYPE-DEAD-CALLS.md #4 + #30 + #32
    // eslint-disable-next-line no-console
    console.log("[stub] sendEmail", {
      mode,
      from,
      to,
      cc,
      bcc,
      subject,
      bodyHtml: composedHtml,
      urgent,
      attachments: attachments.map((a) =>
        a.kind === "file"
          ? { kind: "file", name: a.file.name, size: a.file.size }
          : { kind: "forwarded", id: a.ref.id, name: a.ref.name, sizeLabel: a.ref.sizeLabel },
      ),
      hasQuotedBody: Boolean(context?.quotedBody),
    });
    toast.success(
      urgent
        ? `${MODE_SEND_LABEL[mode]} (URGENT) — stub`
        : `${MODE_SEND_LABEL[mode]} — stub`,
      {
        description:
          attachments.length > 0
            ? `${subject || to} · ${attachments.length} attachment${attachments.length === 1 ? "" : "s"}`
            : subject || to,
      },
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-[1500px] h-[85vh] !flex flex-col gap-3",
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {MODE_TITLE[mode]}
            {urgent ? (
              <span className="inline-flex items-center gap-1 rounded bg-rose-500 text-white px-1.5 py-0.5 text-[10px] font-semibold">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                URGENT
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
          <div className="grid grid-cols-[60px_1fr_auto] items-center gap-2">
            <label className="text-xs text-muted-foreground">From</label>
            <Select value={from} onValueChange={(v) => v && setFrom(v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue>{from}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MOCK_MAILBOXES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span />
          </div>

          <div className="grid grid-cols-[60px_1fr_auto] items-start gap-2">
            <label className="text-xs text-muted-foreground pt-1.5">To</label>
            <ContactAutocompleteInput
              value={to}
              onChange={setTo}
              placeholder="Name or recipient@example.com — type to search contacts"
            />
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-1.5">
              {!showCcRow ? (
                <button
                  type="button"
                  onClick={() => setShowCcRow(true)}
                  className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Add Cc"
                >
                  Cc
                </button>
              ) : null}
              {!showBccRow ? (
                <button
                  type="button"
                  onClick={() => setShowBccRow(true)}
                  className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Add Bcc"
                >
                  Bcc
                </button>
              ) : null}
            </div>
          </div>

          {showCcRow ? (
            <div className="grid grid-cols-[60px_1fr_auto] items-start gap-2">
              <label className="text-xs text-muted-foreground pt-1.5">Cc</label>
              <ContactAutocompleteInput
                value={cc}
                onChange={setCc}
                placeholder="Cc — type to search contacts"
              />
              <button
                type="button"
                onClick={() => {
                  setShowCcRow(false);
                  setCc("");
                }}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground mt-1.5"
                aria-label="Remove Cc"
                title="Remove Cc"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          {showBccRow ? (
            <div className="grid grid-cols-[60px_1fr_auto] items-start gap-2">
              <label className="text-xs text-muted-foreground pt-1.5">Bcc</label>
              <ContactAutocompleteInput
                value={bcc}
                onChange={setBcc}
                placeholder="Bcc — type to search contacts"
              />
              <button
                type="button"
                onClick={() => {
                  setShowBccRow(false);
                  setBcc("");
                }}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground mt-1.5"
                aria-label="Remove Bcc"
                title="Remove Bcc"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          <div className="grid grid-cols-[60px_1fr_auto] items-center gap-2">
            <label className="text-xs text-muted-foreground">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-8 text-xs"
            />
            <span />
          </div>

          <RichTextEditor
            editorRef={editorRef}
            onInput={() => {
              if (editorRef.current) setBodyDraftHtml(editorRef.current.innerHTML);
            }}
            onCommand={exec}
            onInsertLink={handleInsertLink}
          />

          {/* Read-only signature footer — auto-replaces when From changes. */}
          <div className="rounded border bg-muted/10 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Signature ({from})
            </div>
            <div
              className="text-xs"
              // The HTML comes from our own `signatureHtmlForMailbox`
              // builder — no untrusted input. Safe to render.
              dangerouslySetInnerHTML={{ __html: signatureHtml }}
            />
          </div>

          {context?.quotedBody ? (
            <QuotedOriginal
              body={context.quotedBody}
              expanded={quotedExpanded}
              onToggle={() => setQuotedExpanded((v) => !v)}
            />
          ) : null}

          {/*
            Forward-attachments affordance — shown only on Reply / Reply
            all / Forward when the original thread had attachments and
            the operator hasn't already pulled them in.
          */}
          {(context?.originalAttachments?.length ?? 0) > 0 && !originalIncluded ? (
            <button
              type="button"
              onClick={includeOriginalAttachments}
              className="w-full text-left rounded-md border border-dashed border-amber-400 bg-amber-50/60 dark:bg-amber-900/20 px-3 py-2 text-[12px] text-amber-900 dark:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors flex items-center gap-2"
            >
              <Paperclip className="h-3.5 w-3.5" aria-hidden />
              Include original attachments
              <span className="ml-1 rounded-full bg-amber-200/80 dark:bg-amber-800 px-1.5 py-0.5 text-[10px] tabular-nums text-amber-900 dark:text-amber-100">
                {context!.originalAttachments!.length}
              </span>
              <span className="ml-auto text-[10.5px] text-amber-800/70 dark:text-amber-200/70 truncate">
                {context!.originalAttachments!.map((a) => a.name).join(", ")}
              </span>
            </button>
          ) : null}

          {attachments.length > 0 ? (
            <AttachmentTray attachments={attachments} onRemove={removeAttachment} />
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
            aria-hidden
          />
        </div>

        <DialogFooter className="flex-wrap">
          <label className="flex items-center gap-2 text-xs text-muted-foreground mr-auto cursor-pointer select-none">
            <input
              type="checkbox"
              checked={urgent}
              onChange={(e) => setUrgent(e.target.checked)}
              className="h-3.5 w-3.5 accent-rose-500"
            />
            <span
              className={cn(
                "inline-flex items-center gap-1",
                urgent && "text-rose-600 dark:text-rose-400 font-medium",
              )}
            >
              <AlertTriangle
                className={cn(
                  "h-3 w-3",
                  urgent ? "text-rose-500" : "text-muted-foreground",
                )}
                aria-hidden
              />
              Mark urgent
            </span>
          </label>
          <Button variant="outline" onClick={handlePickFiles} type="button">
            <Paperclip className="h-3.5 w-3.5" aria-hidden />
            Attach files
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            className={cn(urgent && "bg-rose-600 hover:bg-rose-700 text-white")}
          >
            {MODE_SEND_LABEL[mode]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RichTextEditor({
  editorRef,
  onInput,
  onCommand,
  onInsertLink,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onInput: () => void;
  onCommand: (command: string, value?: string) => void;
  onInsertLink: () => void;
}) {
  // Operator may scroll past the editor (signature / quoted body /
  // attachments live below). When they click back into the body and
  // the editor's top is OFF-screen above the visible scroll viewport,
  // snap so the cursor lands where the operator expects to type. If
  // the editor is already in view (operator hasn't scrolled), do
  // nothing — earlier version snapped unconditionally and caused an
  // unwanted jump on the first click.
  function handleFocus() {
    const editor = editorRef.current;
    if (!editor) return;
    let parent: HTMLElement | null = editor.parentElement;
    while (parent && parent !== document.body) {
      const overflowY = getComputedStyle(parent).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") break;
      parent = parent.parentElement;
    }
    if (!parent) return;
    const editorRect = editor.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    // Editor top above the viewport top → operator scrolled past it.
    // Add a tiny slack so a 1-2px rounding diff doesn't trigger.
    if (editorRect.top < parentRect.top - 4) {
      editor.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }
  return (
    <div className="rounded border bg-background overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
        <select
          aria-label="Font family"
          onChange={(e) => onCommand("fontName", e.target.value)}
          className="h-7 rounded border bg-background px-1.5 text-[11px]"
          defaultValue=""
        >
          <option value="" disabled>
            Font
          </option>
          {FONT_FAMILIES.map((f) => (
            <option key={f.id} value={f.id} style={{ fontFamily: f.id }}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Font size"
          onChange={(e) => onCommand("fontSize", e.target.value)}
          className="h-7 rounded border bg-background px-1.5 text-[11px]"
          defaultValue=""
        >
          <option value="" disabled>
            Size
          </option>
          {FONT_SIZES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <ToolbarDivider />
        <ToolbarButton label="Bold" icon={Bold} onClick={() => onCommand("bold")} />
        <ToolbarButton
          label="Italic"
          icon={Italic}
          onClick={() => onCommand("italic")}
        />
        <ToolbarButton
          label="Underline"
          icon={Underline}
          onClick={() => onCommand("underline")}
        />
        <ToolbarButton
          label="Strikethrough"
          icon={Strikethrough}
          onClick={() => onCommand("strikeThrough")}
        />
        <ToolbarDivider />
        <ToolbarButton
          label="Bullet list"
          icon={List}
          onClick={() => onCommand("insertUnorderedList")}
        />
        <ToolbarButton
          label="Numbered list"
          icon={ListOrdered}
          onClick={() => onCommand("insertOrderedList")}
        />
        <ToolbarButton
          label="Quote"
          icon={Quote}
          onClick={() => onCommand("formatBlock", "blockquote")}
        />
        <ToolbarDivider />
        <ToolbarButton label="Insert link" icon={LinkIcon} onClick={onInsertLink} />
        <ColorPicker onPick={(color) => onCommand("foreColor", color)} />
        <ToolbarDivider />
        <button
          type="button"
          onClick={() => onCommand("removeFormat")}
          className="h-7 rounded px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Clear formatting"
          title="Clear formatting"
        >
          Clear
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        onFocus={handleFocus}
        role="textbox"
        aria-multiline="true"
        aria-label="Message body"
        className="min-h-[24rem] max-h-[55vh] overflow-y-auto px-3 py-3 text-sm leading-relaxed outline-none focus:bg-background"
        data-placeholder="Write your message…"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}

function ColorPicker({ onPick }: { onPick: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseDown={(e) => e.preventDefault()}
        aria-label="Text color"
        title="Text color"
        className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-sm border"
          style={{
            background:
              "linear-gradient(135deg,#0F172A 0 25%,#B91C1C 25% 50%,#D68A00 50% 75%,#0E4D2F 75%)",
          }}
        />
        Color
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 flex gap-1 rounded border bg-popover p-1 shadow-md ring-1 ring-foreground/10">
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              aria-label={`Color ${c}`}
              title={c}
              className="h-5 w-5 rounded-sm border"
              style={{ background: c }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QuotedOriginal({
  body,
  expanded,
  onToggle,
}: {
  body: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  // Count lines once so we only show the expand affordance when the
  // quoted body actually exceeds the 4-line collapsed view.
  const lineCount = useMemo(() => body.split("\n").length, [body]);
  const exceeds = lineCount > 4;
  // 4-line collapsed (text-[11px] line-height-relaxed ≈ 1.625) ≈ 4.5rem
  // padding-included; 20-line expanded ≈ 22rem with internal scroll.
  const heightClass = expanded
    ? "max-h-[22rem] overflow-y-auto"
    : "max-h-[4.75rem] overflow-hidden";

  return (
    <div className="rounded border-l-2 border-muted-foreground/30 bg-muted/30">
      <div className="flex items-center justify-between px-3 pt-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Quoted from original
        </div>
        {exceeds ? (
          <button
            type="button"
            onClick={onToggle}
            className="text-[10.5px] text-foreground/70 hover:text-foreground rounded px-1.5 py-0.5 hover:bg-muted transition-colors"
            aria-expanded={expanded}
          >
            {expanded ? "Show less" : `Show more (${lineCount} lines)`}
          </button>
        ) : null}
      </div>
      <div className={`px-3 pb-2 ${heightClass}`}>
        <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
          {body}
        </pre>
      </div>
      {!expanded && exceeds ? (
        <div className="pointer-events-none -mt-6 h-6 bg-gradient-to-t from-muted/30 to-transparent rounded-b" />
      ) : null}
    </div>
  );
}

function ContactAutocompleteInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Multi-recipient inputs split on ',' or ';'. The ACTIVE token (the
  // one being typed and matched against contacts) is whatever follows
  // the last separator.
  const split = useMemo(() => {
    const lastSep = Math.max(value.lastIndexOf(","), value.lastIndexOf(";"));
    const head = lastSep >= 0 ? value.slice(0, lastSep + 1) : "";
    const token = (lastSep >= 0 ? value.slice(lastSep + 1) : value).trimStart();
    return { head, token };
  }, [value]);

  const matches = useMemo<Contact[]>(() => {
    if (!open) return [];
    return searchContacts(split.token, 8);
  }, [open, split.token]);

  useEffect(() => {
    setActiveIdx(0);
  }, [matches.length]);

  function commit(c: Contact) {
    const next = `${split.head}${split.head.length > 0 ? " " : ""}${c.fullName} <${c.email}>, `;
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so onMouseDown on the suggestion list can fire first.
          setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (!open || matches.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => (i + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => (i - 1 + matches.length) % matches.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            const m = matches[activeIdx];
            if (m) {
              e.preventDefault();
              commit(m);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
      {open && matches.length > 0 ? (
        <div
          role="listbox"
          aria-label="Contact suggestions"
          className="absolute left-0 right-0 top-full mt-1 z-30 rounded-md border bg-popover shadow-md ring-1 ring-foreground/10 overflow-hidden"
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
            {matches.length} match{matches.length === 1 ? "" : "es"} ·{" "}
            {split.token.length > 0 ? `"${split.token}"` : "all contacts"}
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {matches.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(c);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "w-full text-left flex items-center gap-2 px-2 py-1.5 text-[12px]",
                    i === activeIdx ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground/90 truncate">
                      {c.fullName}
                    </span>
                    <span className="block text-[10.5px] text-muted-foreground truncate">
                      {c.email}
                      {c.org ? ` · ${c.org}` : ""}
                      {c.roleHint ? ` · ${c.roleHint}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function AttachmentTray({
  attachments,
  onRemove,
}: {
  attachments: ComposeAttachment[];
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
          <Paperclip className="h-3 w-3" aria-hidden />
          Attachments
          <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-foreground/70">
            {attachments.length}
          </span>
        </div>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {attachments.map((a, i) => {
          const name = a.kind === "file" ? a.file.name : a.ref.name;
          const size =
            a.kind === "file" ? formatBytes(a.file.size) : a.ref.sizeLabel;
          const sourceLabel = a.kind === "file" ? "Local" : "Forwarded";
          const sourceTint =
            a.kind === "file"
              ? "bg-muted text-muted-foreground"
              : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200";
          return (
            <li
              key={`${name}-${i}`}
              className="flex items-center gap-2 rounded border bg-background px-2 py-1 text-[11.5px]"
            >
              <Paperclip
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground/90">
                  {name}
                </span>
                <span className="block text-[10px] text-muted-foreground tabular-nums">
                  {size}
                </span>
              </span>
              <span
                className={
                  "rounded-full px-1.5 py-0.5 text-[9.5px] font-medium " + sourceTint
                }
              >
                {sourceLabel}
              </span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${name}`}
                title={`Remove ${name}`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
