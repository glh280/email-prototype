"use client";

/**
 * SOURCE: new
 * CREATED: 2026-04-28
 * STATUS: new (mock fixtures from `mock/settings.ts`; all mutations stub)
 * REINTEGRATION: replace fixtures with `queryConnectedAccounts()` + Gmail
 *   OAuth bridge; wire reauth + sync triggers.
 */

import { CheckCircle2, AlertTriangle, RefreshCw, Trash2, Plus, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CONNECTED_ACCOUNTS, type ConnectedAccount } from "@/mock/settings";
import {
  SettingsListDetail,
  DetailHeader,
  DetailSection,
  FieldRow,
} from "./settings-list-detail";

const STATUS_LABEL: Record<ConnectedAccount["status"], string> = {
  connected: "Connected",
  "needs-reauth": "Needs re-authentication",
  error: "Error",
};

const PROVIDER_LABEL: Record<ConnectedAccount["provider"], string> = {
  gmail: "Gmail (personal)",
  "google-workspace": "Google Workspace",
  imap: "IMAP / POP",
};

export function AccountsSection() {
  function stub(action: string, payload: Record<string, unknown> = {}) {
    // eslint-disable-next-line no-console
    console.log(`[stub] settings/accounts ${action}`, payload);
    toast.message(`${action} — stub`, {
      description: "L1 prototype — wires up in Phase 2+.",
    });
  }

  return (
    <SettingsListDetail
      title="Accounts"
      description={`${CONNECTED_ACCOUNTS.length} connected mailbox identities.`}
      items={CONNECTED_ACCOUNTS}
      getId={(a) => a.id}
      matchValue={(a) => `${a.email} ${a.displayName} ${a.provider}`}
      toolbar={
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-1.5 text-xs h-7"
          onClick={() => stub("connect-account")}
        >
          <Plus className="h-3.5 w-3.5" />
          Connect account
        </Button>
      }
      renderRow={(a) => (
        <div className="flex items-start gap-2 min-w-0">
          <Mail className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">{a.displayName}</div>
            <div className="text-[10.5px] text-muted-foreground truncate font-mono">
              {a.email}
            </div>
            <div className="mt-1 inline-flex items-center gap-1">
              <StatusBadge status={a.status} />
              {a.isDefault ? (
                <span className="text-[9px] uppercase tracking-wide text-primary/80">
                  default
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}
      renderDetail={(a) => (
        <article>
          <DetailHeader
            title={a.displayName}
            subtitle={
              <span className="font-mono">{a.email}</span>
            }
            actions={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs"
                  onClick={() => stub("sync-now", { accountId: a.id })}
                >
                  <RefreshCw className="h-3 w-3" />
                  Sync now
                </Button>
                {a.status === "needs-reauth" ? (
                  <Button
                    size="sm"
                    className="gap-1 h-7 text-xs"
                    onClick={() => stub("reauth", { accountId: a.id })}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Reconnect
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => stub("disconnect", { accountId: a.id })}
                >
                  <Trash2 className="h-3 w-3" />
                  Disconnect
                </Button>
              </>
            }
          />
          <DetailSection label="Status">
            <FieldRow label="Connection">
              <StatusBadge status={a.status} />
            </FieldRow>
            <FieldRow label="Last sync">
              <span className="tabular-nums">
                {new Date(a.lastSyncedAt).toLocaleString()}
              </span>
            </FieldRow>
            <FieldRow label="Provider">{PROVIDER_LABEL[a.provider]}</FieldRow>
            <FieldRow label="Default sender">
              {a.isDefault ? (
                <span className="text-foreground">Yes</span>
              ) : (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => stub("make-default", { accountId: a.id })}
                >
                  Make default
                </button>
              )}
            </FieldRow>
          </DetailSection>

          <DetailSection label="Linked mailboxes">
            <div className="flex flex-col gap-1">
              {a.mailboxes.map((m) => (
                <div
                  key={m}
                  className="flex items-center justify-between text-xs border rounded px-2 py-1.5 bg-background"
                >
                  <span className="font-mono text-[11px] truncate">{m}</span>
                  <button
                    type="button"
                    onClick={() => stub("unlink-mailbox", { accountId: a.id, mailbox: m })}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    Unlink
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => stub("add-mailbox", { accountId: a.id })}
                className="text-[11px] text-primary hover:underline self-start mt-1"
              >
                + Add mailbox alias
              </button>
            </div>
          </DetailSection>

          <DetailSection label="Sync settings">
            <FieldRow label="Folders synced">All folders</FieldRow>
            <FieldRow label="History retention">12 months (workspace default)</FieldRow>
            <FieldRow label="Push notifications">Enabled (Gmail watch)</FieldRow>
          </DetailSection>
        </article>
      )}
    />
  );
}

function StatusBadge({ status }: { status: ConnectedAccount["status"] }) {
  const tone =
    status === "connected"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      : status === "needs-reauth"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        : "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200";
  const Icon = status === "connected" ? CheckCircle2 : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>
      <Icon className="h-2.5 w-2.5" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
