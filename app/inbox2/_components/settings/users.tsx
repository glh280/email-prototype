"use client";

/**
 * SOURCE: new
 * CREATED: 2026-04-28
 * STATUS: new (mock fixtures; mutations stub)
 * REINTEGRATION: replace fixtures with `queryWorkspaceUsers()`; wire
 *   invite / role / suspend / 2FA reset actions.
 */

import { Plus, ShieldCheck, Mail, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  WORKSPACE_USERS,
  WORKSPACE_TEAMS,
  type WorkspaceUser,
  type UserRole,
} from "@/mock/settings";
import {
  SettingsListDetail,
  DetailHeader,
  DetailSection,
  FieldRow,
} from "./settings-list-detail";

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const STATUS_TONE: Record<WorkspaceUser["status"], string> = {
  active: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  invited: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  suspended: "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-200",
};

function teamNamesFor(user: WorkspaceUser): string[] {
  return user.teamIds
    .map((id) => WORKSPACE_TEAMS.find((t) => t.id === id)?.name)
    .filter((n): n is string => Boolean(n));
}

export function UsersSection() {
  function stub(action: string, payload: Record<string, unknown> = {}) {
    // eslint-disable-next-line no-console
    console.log(`[stub] settings/users ${action}`, payload);
    toast.message(`${action} — stub`);
  }

  return (
    <SettingsListDetail
      title="Users"
      description={`${WORKSPACE_USERS.length} workspace members.`}
      items={WORKSPACE_USERS}
      getId={(u) => u.id}
      matchValue={(u) => `${u.name} ${u.email} ${u.role}`}
      toolbar={
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-1.5 text-xs h-7"
          onClick={() => stub("invite-user")}
        >
          <Plus className="h-3.5 w-3.5" />
          Invite member
        </Button>
      }
      renderRow={(u) => (
        <div className="flex items-start gap-2 min-w-0">
          <div className="h-6 w-6 rounded-full bg-muted shrink-0 flex items-center justify-center text-[10px] font-medium text-muted-foreground">
            {initialsOf(u.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <div className="text-xs font-medium truncate">{u.name}</div>
              {u.twoFactorEnabled ? (
                <ShieldCheck
                  className="h-3 w-3 text-emerald-600 shrink-0"
                  aria-label="2FA enabled"
                />
              ) : null}
            </div>
            <div className="text-[10.5px] text-muted-foreground truncate">
              {u.email}
            </div>
            <div className="mt-1 flex items-center gap-1">
              <span className={`inline-flex rounded px-1.5 py-0.5 text-[9.5px] font-medium ${STATUS_TONE[u.status]}`}>
                {u.status}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {ROLE_LABEL[u.role]}
              </span>
            </div>
          </div>
        </div>
      )}
      renderDetail={(u) => (
        <article>
          <DetailHeader
            title={u.name}
            subtitle={
              <span className="font-mono">{u.email}</span>
            }
            actions={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs"
                  onClick={() => stub("send-message", { userId: u.id })}
                >
                  <Mail className="h-3 w-3" />
                  Message
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs"
                  onClick={() => stub("more-actions", { userId: u.id })}
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </>
            }
          />

          <DetailSection label="Account">
            <FieldRow label="Role">
              <button
                type="button"
                onClick={() => stub("change-role", { userId: u.id })}
                className="text-primary hover:underline"
              >
                {ROLE_LABEL[u.role]} ▾
              </button>
            </FieldRow>
            <FieldRow label="Status">
              <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_TONE[u.status]}`}>
                {u.status}
              </span>
            </FieldRow>
            <FieldRow label="Last active">
              <span className="tabular-nums">
                {new Date(u.lastActive).toLocaleString()}
              </span>
            </FieldRow>
          </DetailSection>

          <DetailSection label="Security">
            <FieldRow label="Two-factor auth">
              {u.twoFactorEnabled ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  Enabled
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => stub("require-2fa", { userId: u.id })}
                  className="text-primary hover:underline"
                >
                  Require 2FA
                </button>
              )}
            </FieldRow>
            <FieldRow label="Active sessions">
              <button
                type="button"
                onClick={() => stub("view-sessions", { userId: u.id })}
                className="text-primary hover:underline"
              >
                View 2 active
              </button>
            </FieldRow>
            <FieldRow label="Reset password">
              <button
                type="button"
                onClick={() => stub("reset-password", { userId: u.id })}
                className="text-primary hover:underline"
              >
                Send reset link
              </button>
            </FieldRow>
          </DetailSection>

          <DetailSection label="Team memberships">
            {teamNamesFor(u).length === 0 ? (
              <div className="text-xs text-muted-foreground italic">
                Not on any teams.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {teamNamesFor(u).map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center rounded border bg-background px-2 py-0.5 text-[11px]"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => stub("manage-teams", { userId: u.id })}
              className="text-[11px] text-primary hover:underline mt-1"
            >
              Manage team memberships
            </button>
          </DetailSection>

          <DetailSection label="Danger zone">
            {u.status === "suspended" ? (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => stub("reactivate", { userId: u.id })}
              >
                Reactivate user
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => stub("suspend", { userId: u.id })}
              >
                Suspend user
              </Button>
            )}
          </DetailSection>
        </article>
      )}
    />
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
