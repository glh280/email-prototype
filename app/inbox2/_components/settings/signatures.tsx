"use client";

/**
 * SOURCE: new
 * CREATED: 2026-04-28
 * STATUS: new (mock fixtures; mutations stub)
 * REINTEGRATION: replace fixtures with `querySignaturesForUser()`; wire
 *   create / edit / set-default-for-mailbox actions.
 */

import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  SIGNATURES,
  WORKSPACE_USERS,
  type Signature,
} from "@/mock/settings";
import {
  SettingsListDetail,
  DetailHeader,
  DetailSection,
  FieldRow,
} from "./settings-list-detail";

function userNameFor(s: Signature): string {
  return WORKSPACE_USERS.find((u) => u.id === s.userId)?.name ?? s.userId;
}

export function SignaturesSection() {
  function stub(action: string, payload: Record<string, unknown> = {}) {
    // eslint-disable-next-line no-console
    console.log(`[stub] settings/signatures ${action}`, payload);
    toast.message(`${action} — stub`);
  }

  return (
    <SettingsListDetail
      title="Signatures"
      description={`${SIGNATURES.length} signatures across workspace users.`}
      items={SIGNATURES}
      getId={(s) => s.id}
      matchValue={(s) => `${s.name} ${userNameFor(s)} ${s.body}`}
      toolbar={
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-1.5 text-xs h-7"
          onClick={() => stub("create-signature")}
        >
          <Plus className="h-3.5 w-3.5" />
          New signature
        </Button>
      }
      renderRow={(s) => (
        <div className="min-w-0">
          <div className="text-xs font-medium truncate">{s.name}</div>
          <div className="text-[10.5px] text-muted-foreground truncate">
            {userNameFor(s)}
          </div>
          {s.defaultForMailboxes.length > 0 ? (
            <span className="inline-block mt-1 text-[9px] uppercase tracking-wide text-primary/80">
              default · {s.defaultForMailboxes.length} mailbox
              {s.defaultForMailboxes.length === 1 ? "" : "es"}
            </span>
          ) : null}
        </div>
      )}
      renderDetail={(s: Signature) => (
        <article>
          <DetailHeader
            title={s.name}
            subtitle={`Owned by ${userNameFor(s)}`}
            actions={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => stub("edit-signature", { signatureId: s.id })}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => stub("delete-signature", { signatureId: s.id })}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </>
            }
          />

          <DetailSection label="Preview">
            <pre className="text-xs whitespace-pre-wrap font-sans bg-background border rounded p-3">
{s.body}
            </pre>
          </DetailSection>

          <DetailSection label="Default for mailboxes">
            {s.defaultForMailboxes.length === 0 ? (
              <FieldRow label="Mailboxes">
                <span className="text-muted-foreground italic">
                  Not set as default for any mailbox.
                </span>
              </FieldRow>
            ) : (
              <div className="space-y-1">
                {s.defaultForMailboxes.map((m) => (
                  <div
                    key={m}
                    className="text-xs font-mono bg-background border rounded px-2 py-1.5 flex items-center justify-between"
                  >
                    <span>{m}</span>
                    <button
                      type="button"
                      onClick={() => stub("remove-default-mailbox", { signatureId: s.id, mailbox: m })}
                      className="text-[10px] text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => stub("add-default-mailbox", { signatureId: s.id })}
              className="text-[11px] text-primary hover:underline mt-2"
            >
              + Add mailbox as default
            </button>
          </DetailSection>
        </article>
      )}
    />
  );
}
