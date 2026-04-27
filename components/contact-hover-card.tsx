"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Contact, Deal } from "@/mock/types";
import { DraftEmailButton } from "@/components/draft-email-dialog";

type View = "quick" | "person";

/**
 * Contact popup — hover to open, click to pin.
 *
 * Hover behavior uses mouseenter/mouseleave with a short grace delay so the
 * popup survives the cursor jumping from trigger → popup body. Leaving the
 * popup ALWAYS closes it — this prevents the "pileup" bug where moving between
 * names left multiple popups open.
 *
 * Clicking the trigger "pins" the popup (hover-close disabled). Clicking the
 * contact name inside the popup flips to the person/edit view. Clicking
 * outside closes it regardless of pinned state.
 */
export function ContactHoverCard({
  contact,
  children,
  deal,
}: {
  contact: Contact;
  children: React.ReactNode;
  /** Optional — enables "Draft email" that targets this contact on this deal */
  deal?: Deal;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [view, setView] = useState<View>("quick");
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<Contact>({ ...contact });

  // Delay timers so brief gaps between trigger and popup don't auto-close
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleClose() {
    if (pinned) return;
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 120);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      clearCloseTimer();
      setOpen(true);
    } else {
      // Popover's built-in close path (outside click, esc, etc.) — hard close.
      clearCloseTimer();
      setOpen(false);
      setPinned(false);
      setView("quick");
      setEditing(false);
      setEdit({ ...contact });
    }
  }

  function onTriggerEnter() {
    clearCloseTimer();
    setOpen(true);
  }

  function onPopupEnter() {
    clearCloseTimer();
  }

  function onPopupLeave() {
    if (pinned) return;
    scheduleClose();
  }

  function pinOpen() {
    // Called when user clicks the trigger — keep it open regardless of hover
    setPinned(true);
  }

  function saveEdits() {
    toast.success("Contact updated (simulated)", {
      description: "In production this writes to the contacts registry.",
    });
    setEditing(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <span
            className="cursor-pointer underline-offset-4 hover:underline decoration-dashed decoration-muted-foreground/50 hover:text-foreground"
            onMouseEnter={onTriggerEnter}
            onMouseLeave={scheduleClose}
            onClick={pinOpen}
          >
            {children}
          </span>
        }
      />
      <PopoverContent
        side="top"
        align="start"
        className="w-96 p-0 overflow-hidden"
        onMouseEnter={onPopupEnter}
        onMouseLeave={onPopupLeave}
      >
        {view === "quick" ? (
          <QuickView
            contact={edit}
            deal={deal}
            onOpenPerson={() => {
              setPinned(true);
              setView("person");
            }}
          />
        ) : (
          <PersonView
            contact={edit}
            deal={deal}
            editing={editing}
            onEditingChange={setEditing}
            onContactChange={setEdit}
            onBack={() => {
              setView("quick");
              setEditing(false);
            }}
            onSave={saveEdits}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="text-xs">
      <span className="text-muted-foreground">{label}:</span> <span>{value}</span>
    </div>
  );
}

function QuickView({
  contact,
  deal,
  onOpenPerson,
}: {
  contact: Contact;
  deal?: Deal;
  onOpenPerson: () => void;
}) {
  const website = contact.website?.startsWith("http")
    ? contact.website
    : contact.website
      ? `https://${contact.website}`
      : undefined;
  return (
    <div className="p-3 space-y-2">
      <div>
        <button
          onClick={onOpenPerson}
          className="font-semibold text-left hover:underline decoration-2 underline-offset-2"
          title="Open person view"
        >
          {contact.fullName} →
        </button>
        {contact.title && <div className="text-xs text-muted-foreground">{contact.title}</div>}
        {contact.org && contact.org !== contact.title && (
          <div className="text-xs text-muted-foreground">{contact.org}</div>
        )}
      </div>

      {contact.tags && contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {contact.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px] font-normal">
              {t}
            </Badge>
          ))}
        </div>
      )}

      <div className="space-y-0.5 pt-1">
        <Row label="Phone" value={contact.phone ? <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a> : undefined} />
        <Row label="Email" value={contact.email} />
        <Row label="Address" value={contact.address} />
        <Row label="Website" value={website ? <a href={website} target="_blank" rel="noreferrer" className="hover:underline">{contact.website}</a> : undefined} />
        {contact.licensedStates && contact.licensedStates.length > 0 && (
          <Row label="Licensed" value={contact.licensedStates.join(", ")} />
        )}
      </div>

      {contact.email && deal && (
        <div className="pt-1">
          <DraftEmailButton
            deal={deal}
            taskTitle="Follow-up"
            presetRecipientContactId={contact.id}
            triggerLabel="✉ Draft email"
          />
        </div>
      )}

      <div className="pt-1 text-[10px] text-muted-foreground">Click the name above for the full person view.</div>
    </div>
  );
}

function PersonView({
  contact,
  deal,
  editing,
  onEditingChange,
  onContactChange,
  onBack,
  onSave,
}: {
  contact: Contact;
  deal?: Deal;
  editing: boolean;
  onEditingChange: (v: boolean) => void;
  onContactChange: (c: Contact) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const website = contact.website?.startsWith("http")
    ? contact.website
    : contact.website
      ? `https://${contact.website}`
      : undefined;

  function field<K extends keyof Contact>(key: K, value: Contact[K]) {
    onContactChange({ ...contact, [key]: value });
  }

  return (
    <div className="flex flex-col max-h-[70vh]">
      <div className="flex items-center gap-1 px-2 py-2 border-b">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          title="Back to quick view"
        >
          ←
        </button>
        <div className="font-semibold text-sm flex-1 truncate">{contact.fullName}</div>
        {editing ? (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => onEditingChange(false)}>Cancel</Button>
            <Button size="sm" onClick={onSave}>Save</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => onEditingChange(true)}>Edit</Button>
        )}
      </div>

      <div className="p-3 space-y-3 overflow-y-auto">
        {editing ? (
          <EditForm contact={contact} onField={field} />
        ) : (
          <ReadView contact={contact} website={website} />
        )}

        {contact.email && deal && (
          <div className="pt-2 border-t">
            <DraftEmailButton
              deal={deal}
              taskTitle="Follow-up"
              presetRecipientContactId={contact.id}
              triggerLabel="✉ Draft email"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ReadView({ contact, website }: { contact: Contact; website?: string }) {
  return (
    <>
      {contact.title && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Title</div>
          <div className="text-sm">{contact.title}</div>
        </div>
      )}
      {contact.org && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Organization</div>
          <div className="text-sm">{contact.org}</div>
        </div>
      )}
      {contact.tags && contact.tags.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tags</div>
          <div className="flex flex-wrap gap-1">
            {contact.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px] font-normal">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        {contact.phone && (
          <div>
            <div className="text-muted-foreground">Phone</div>
            <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
          </div>
        )}
        {contact.email && (
          <div>
            <div className="text-muted-foreground">Email</div>
            <div className="truncate">{contact.email}</div>
          </div>
        )}
      </div>

      {contact.address && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Address</div>
          <div className="text-sm">{contact.address}</div>
        </div>
      )}

      {website && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Website</div>
          <a href={website} target="_blank" rel="noreferrer" className="text-sm hover:underline">{contact.website}</a>
        </div>
      )}

      {contact.licensedStates && contact.licensedStates.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Licensed / operating states</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {contact.licensedStates.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
            ))}
          </div>
        </div>
      )}

      {(contact.secondaryName || contact.secondaryEmail || contact.secondaryPhone) && (
        <div className="pt-2 border-t">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Secondary contact</div>
          <div className="space-y-0.5 text-xs">
            {contact.secondaryName && <div><span className="text-muted-foreground">Name:</span> {contact.secondaryName}</div>}
            {contact.secondaryEmail && <div><span className="text-muted-foreground">Email:</span> {contact.secondaryEmail}</div>}
            {contact.secondaryPhone && <div><span className="text-muted-foreground">Phone:</span> {contact.secondaryPhone}</div>}
          </div>
        </div>
      )}
    </>
  );
}

function EditForm({
  contact,
  onField,
}: {
  contact: Contact;
  onField: <K extends keyof Contact>(key: K, value: Contact[K]) => void;
}) {
  return (
    <div className="space-y-2 text-xs">
      <FieldRow label="Full name" value={contact.fullName} onChange={(v) => onField("fullName", v)} />
      <FieldRow label="Title" value={contact.title ?? ""} onChange={(v) => onField("title", v)} />
      <FieldRow label="Organization" value={contact.org ?? ""} onChange={(v) => onField("org", v)} />
      <FieldRow label="Phone" value={contact.phone ?? ""} onChange={(v) => onField("phone", v)} />
      <FieldRow label="Email" value={contact.email ?? ""} onChange={(v) => onField("email", v)} />
      <FieldRow label="Address" value={contact.address ?? ""} onChange={(v) => onField("address", v)} />
      <FieldRow label="Website" value={contact.website ?? ""} onChange={(v) => onField("website", v)} />
      <FieldRow
        label="Licensed states (comma-sep)"
        value={(contact.licensedStates ?? []).join(", ")}
        onChange={(v) => onField("licensedStates", v.split(",").map((s) => s.trim()).filter(Boolean))}
      />
      <FieldRow
        label="Tags (comma-sep)"
        value={(contact.tags ?? []).join(", ")}
        onChange={(v) => onField("tags", v.split(",").map((s) => s.trim()).filter(Boolean))}
      />
      <div className="pt-2 border-t">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Secondary contact</div>
        <FieldRow label="Name" value={contact.secondaryName ?? ""} onChange={(v) => onField("secondaryName", v)} />
        <FieldRow label="Email" value={contact.secondaryEmail ?? ""} onChange={(v) => onField("secondaryEmail", v)} />
        <FieldRow label="Phone" value={contact.secondaryPhone ?? ""} onChange={(v) => onField("secondaryPhone", v)} />
      </div>
    </div>
  );
}

function FieldRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-muted-foreground">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-0.5 text-xs h-8" />
    </label>
  );
}
