"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createContactSchema } from "@/lib/contact-schema";
import { createContact } from "@/app/contacts/actions";

/**
 * Phase 3 Plan 05 Task 3 — New Contact dialog.
 *
 * Client-side pre-validation with createContactSchema mirrors the server
 * contract from Plan 02 / Plan 04. If the client somehow sends bad data,
 * the server action result shape ({ ok: false, errors | error }) surfaces
 * field errors as a defense-in-depth fallback.
 *
 * On ok:true: close dialog, toast "Contact added.", call router.refresh()
 * so the server component re-runs queryContactsForList and the new row
 * appears without a full reload. createContact already calls
 * revalidatePath("/contacts") server-side; router.refresh() is the client
 * nudge that picks up the revalidated cache.
 *
 * base-nova caveat: DialogTrigger uses `render={<Button.../>}` (NOT asChild).
 *
 * Phase 3 Plan 06 Task 2 — additive optional props (backward compatible):
 *   - `initialFullName`: pre-fill the Full name field (used by the File
 *     Contacts autosuggest "Create new contact: «typed»" flow)
 *   - `controlledOpen` + `onOpenChange`: render WITHOUT the trigger button
 *     when open is externally controlled (e.g. spawned from RoleSlotRow)
 *   - `onCreated(contactId)`: callback with the new contact's id so a
 *     parent can immediately upsertDealPerson({ contactId }). Fires BEFORE
 *     router.refresh(); router.refresh() still runs for cache-invalidation.
 *
 * When `controlledOpen` is undefined the component behaves exactly as the
 * /contacts page shipped — trigger button rendered, internal open state.
 */
export function NewContactDialog({
  initialFullName,
  controlledOpen,
  onOpenChange,
  onCreated,
}: {
  initialFullName?: string;
  controlledOpen?: boolean;
  onOpenChange?: (v: boolean) => void;
  onCreated?: (contactId: string) => void;
} = {}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(formData: FormData) {
    setErrors({});
    const raw = {
      fullName: String(formData.get("fullName") ?? "").trim(),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      org: String(formData.get("org") ?? ""),
      roleHint: String(formData.get("roleHint") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    };
    // Drop empty-string optional fields so .optional() accepts them cleanly.
    // fullName is required so we keep it even when empty (Zod rejects).
    const cleaned: Record<string, string> = { fullName: raw.fullName };
    for (const [k, v] of Object.entries(raw)) {
      if (k === "fullName") continue;
      if (v !== "") cleaned[k] = v;
    }
    const parse = createContactSchema.safeParse(cleaned);
    if (!parse.success) {
      setErrors(
        parse.error.flatten().fieldErrors as Record<string, string[]>,
      );
      return;
    }
    startTransition(async () => {
      const result = await createContact(cleaned);
      if (result.ok === false && "errors" in result) {
        setErrors(result.errors);
        return;
      }
      if (result.ok === false && "error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Contact added.");
      // Fire onCreated BEFORE close + refresh so caller can chain (e.g. the
      // File Contacts autosuggest "Create new" flow upserts the new contact
      // into the slot immediately). router.refresh() still runs for cache
      // invalidation on the /contacts list view.
      if (result.ok === true) {
        onCreated?.(result.contactId);
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined ? (
        <DialogTrigger
          render={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New Contact
            </Button>
          }
        />
      ) : null}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Contact</DialogTitle>
          <DialogDescription>
            Add someone to the registry. You can assign them to a deal from
            the deal&rsquo;s People tab.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <Field
            label="Full name"
            name="fullName"
            required
            defaultValue={initialFullName}
            errors={errors.fullName}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            errors={errors.email}
          />
          <Field label="Phone" name="phone" errors={errors.phone} />
          <Field label="Org" name="org" errors={errors.org} />
          <Field
            label="Role hint"
            name="roleHint"
            placeholder="e.g. title partner, lender"
            errors={errors.roleHint}
          />
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} />
            {errors.notes ? (
              <p className="mt-1 text-sm text-destructive">
                {errors.notes.join(" ")}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add Contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
  errors,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  errors?: string[];
}) {
  return (
    <div>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
      {errors ? (
        <p className="mt-1 text-sm text-destructive">{errors.join(" ")}</p>
      ) : null}
    </div>
  );
}
