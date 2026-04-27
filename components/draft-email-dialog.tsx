"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import type { Deal, RoleAssignment } from "@/mock/types";
import { ROLE_LABEL } from "@/mock/types";

export function DraftEmailButton({
  deal,
  taskTitle,
  defaultRoleSlot,
  presetRecipientContactId,
  triggerLabel = "Draft email",
  triggerVariant = "outline",
}: {
  deal: Deal;
  taskTitle: string;
  defaultRoleSlot?: string;
  /** If supplied, preselects the matching person on the deal */
  presetRecipientContactId?: string;
  /** Optional custom label shown on the trigger button */
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost" | "secondary";
}) {
  const initialRecipient =
    (presetRecipientContactId
      ? deal.people.find((p) => p.contact.id === presetRecipientContactId)
      : undefined) ??
    deal.people.find((p) => p.roleSlot === defaultRoleSlot) ??
    deal.people.find((p) => p.roleSlot === "directing_agent") ??
    deal.people.find((p) => p.roleSlot === "borrower") ??
    deal.people[0];

  const [recipient, setRecipient] = useState<RoleAssignment | undefined>(initialRecipient);
  const [subject, setSubject] = useState(`${deal.title} — ${taskTitle}`);
  const [body, setBody] = useState(
    initialRecipient
      ? `Hi ${initialRecipient.contact.fullName.split(" ")[0]},\n\nQuick follow-up on ${deal.title}. ${taskTitle}\n\nThanks,\nCarrie`
      : ""
  );
  const [polishing, setPolishing] = useState(false);
  const [open, setOpen] = useState(false);

  function simulatePolish() {
    setPolishing(true);
    setTimeout(() => {
      setBody((current) =>
        current +
        "\n\n— (simulated polish) tone warmed, ambiguity removed, specific next step added. ~$0.006 of token spend would have been burned here."
      );
      setPolishing(false);
      toast.info("Polished in Mike's voice (simulated)", {
        description: "In production this calls Anthropic Sonnet. Here: no API call, no cost.",
      });
    }, 600);
  }

  function simulateSend() {
    toast.success("Email sent (simulated)", {
      description: `Would have gone to ${recipient?.contact.email ?? "no one"} via Gmail.`,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={triggerVariant}>{triggerLabel}</Button>} />
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Draft follow-up</DialogTitle>
          <DialogDescription>
            Task: <span className="font-medium text-foreground">{taskTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</label>
            <select
              className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm bg-background"
              value={recipient?.roleSlot ?? ""}
              onChange={(e) => setRecipient(deal.people.find((p) => p.roleSlot === e.target.value))}
            >
              {deal.people.map((p) => (
                <option key={p.roleSlot} value={p.roleSlot}>
                  {p.contact.fullName} — {ROLE_LABEL[p.roleSlot]}
                  {p.contact.email ? ` · ${p.contact.email}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm bg-background font-mono"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={simulatePolish} disabled={polishing}>
              {polishing ? "Polishing…" : "✨ Polish in Mike's voice"}
            </Button>
            <span className="text-xs text-muted-foreground">~$0.006 per click in production</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={simulateSend}>Send via Gmail</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
