"use client";

/**
 * SOURCE: new
 * CREATED: 2026-04-28
 * STATUS: new (mock fixtures; mutations stub)
 * REINTEGRATION: replace fixtures with `queryOrgsForUser()`; SSO admin
 *   delegates to identity provider console (Workspace Admin / Okta).
 */

import { Plus, Building2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ORGANIZATIONS,
  WORKSPACE_USERS,
  type Organization,
} from "@/mock/settings";
import {
  SettingsListDetail,
  DetailHeader,
  DetailSection,
  FieldRow,
} from "./settings-list-detail";

function parentNameOf(o: Organization): string | null {
  if (!o.parentId) return null;
  return ORGANIZATIONS.find((p) => p.id === o.parentId)?.name ?? null;
}

export function OrganizationsSection() {
  function stub(action: string, payload: Record<string, unknown> = {}) {
    // eslint-disable-next-line no-console
    console.log(`[stub] settings/organizations ${action}`, payload);
    toast.message(`${action} — stub`);
  }

  return (
    <SettingsListDetail
      title="Organizations"
      description={`${ORGANIZATIONS.length} organizations. Hierarchical workspace tree.`}
      items={ORGANIZATIONS}
      getId={(o) => o.id}
      matchValue={(o) => `${o.name} ${o.domain}`}
      toolbar={
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-1.5 text-xs h-7"
          onClick={() => stub("create-org")}
        >
          <Plus className="h-3.5 w-3.5" />
          New organization
        </Button>
      }
      renderRow={(o) => (
        <div className="flex items-start gap-2 min-w-0">
          <Building2 className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">{o.name}</div>
            <div className="text-[10.5px] text-muted-foreground truncate font-mono">
              {o.domain}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="tabular-nums">
                {o.seatCount} / {o.seatLimit} seats
              </span>
              {o.ssoEnabled ? (
                <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  SSO
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}
      renderDetail={(o) => {
        const parentName = parentNameOf(o);
        const seatsPct = Math.round((o.seatCount / o.seatLimit) * 100);
        const users = o.userIds
          .map((id) => WORKSPACE_USERS.find((u) => u.id === id))
          .filter((u): u is NonNullable<typeof u> => Boolean(u));
        return (
          <article>
            <DetailHeader
              title={o.name}
              subtitle={
                <span>
                  <span className="font-mono">{o.domain}</span>
                  {parentName ? <span className="ml-2">· child of <span className="font-medium">{parentName}</span></span> : null}
                </span>
              }
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => stub("edit-org", { orgId: o.id })}
                >
                  Edit
                </Button>
              }
            />

            <DetailSection label="Plan & seats">
              <FieldRow label="Seats">
                <div className="space-y-1">
                  <div className="tabular-nums">
                    {o.seatCount} / {o.seatLimit} ({seatsPct}%)
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden w-48">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.min(100, seatsPct)}%` }}
                    />
                  </div>
                </div>
              </FieldRow>
              <FieldRow label="Billing">
                <button
                  type="button"
                  onClick={() => stub("view-billing", { orgId: o.id })}
                  className="text-primary hover:underline"
                >
                  View invoices →
                </button>
              </FieldRow>
            </DetailSection>

            <DetailSection label="Identity & SSO">
              <FieldRow label="SSO">
                {o.ssoEnabled ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="h-3 w-3" />
                    Enabled
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => stub("configure-sso", { orgId: o.id })}
                    className="text-primary hover:underline"
                  >
                    Configure SSO
                  </button>
                )}
              </FieldRow>
              <FieldRow label="Domain claim">
                <span className="font-mono text-[11px]">{o.domain}</span>
                <button
                  type="button"
                  onClick={() => stub("verify-domain", { orgId: o.id })}
                  className="ml-2 text-primary hover:underline text-[11px]"
                >
                  Re-verify
                </button>
              </FieldRow>
            </DetailSection>

            <DetailSection label={`Members (${users.length})`}>
              {users.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">
                  No users assigned to this org yet.
                </div>
              ) : (
                <ul className="divide-y border rounded bg-background">
                  {users.map((u) => (
                    <li key={u.id} className="flex items-center justify-between px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{u.name}</div>
                        <div className="text-[10.5px] text-muted-foreground truncate">{u.email}</div>
                      </div>
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {u.role}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>
          </article>
        );
      }}
    />
  );
}
