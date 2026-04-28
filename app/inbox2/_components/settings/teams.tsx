"use client";

/**
 * SOURCE: new
 * CREATED: 2026-04-28
 * STATUS: new (mock fixtures; mutations stub)
 * REINTEGRATION: replace fixtures with `queryWorkspaceTeams()`; wire
 *   create / rename / member-add / member-remove / delete actions.
 */

import { Plus, UserPlus2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  WORKSPACE_TEAMS,
  WORKSPACE_USERS,
  WORKSPACE_LABELS,
} from "@/mock/settings";
import {
  SettingsListDetail,
  DetailHeader,
  DetailSection,
  FieldRow,
} from "./settings-list-detail";

export function TeamsSection() {
  function stub(action: string, payload: Record<string, unknown> = {}) {
    // eslint-disable-next-line no-console
    console.log(`[stub] settings/teams ${action}`, payload);
    toast.message(`${action} — stub`);
  }

  return (
    <SettingsListDetail
      title="Teams"
      description={`${WORKSPACE_TEAMS.length} teams. Used for assignment + auto-routing.`}
      items={WORKSPACE_TEAMS}
      getId={(t) => t.id}
      matchValue={(t) => `${t.name} ${t.description}`}
      toolbar={
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-1.5 text-xs h-7"
          onClick={() => stub("create-team")}
        >
          <Plus className="h-3.5 w-3.5" />
          New team
        </Button>
      }
      renderRow={(t) => (
        <div className="flex items-start gap-2 min-w-0">
          <div className={`h-6 w-6 rounded shrink-0 ${t.color} flex items-center justify-center text-[10px] font-medium text-white`}>
            {t.name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">{t.name}</div>
            <div className="text-[10.5px] text-muted-foreground truncate">
              {t.memberIds.length} member{t.memberIds.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      )}
      renderDetail={(t) => {
        const members = t.memberIds
          .map((id) => WORKSPACE_USERS.find((u) => u.id === id))
          .filter((u): u is NonNullable<typeof u> => Boolean(u));
        const labels = (t.autoLabels ?? [])
          .map((id) => WORKSPACE_LABELS.find((l) => l.id === `lbl_${id.replace(/-/g, "_")}`) ?? WORKSPACE_LABELS.find((l) => l.name === id))
          .filter((l): l is NonNullable<typeof l> => Boolean(l));
        return (
          <article>
            <DetailHeader
              title={t.name}
              subtitle={t.description}
              actions={
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 h-7 text-xs"
                    onClick={() => stub("add-members", { teamId: t.id })}
                  >
                    <UserPlus2 className="h-3 w-3" />
                    Add members
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => stub("delete-team", { teamId: t.id })}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                </>
              }
            />

            <DetailSection label="Routing">
              <FieldRow label="Linked group">
                {t.groupId ? (
                  <span className="font-mono text-[11px]">{t.groupId}</span>
                ) : (
                  <span className="text-muted-foreground italic">None</span>
                )}
              </FieldRow>
              <FieldRow label="Auto-route labels">
                {labels.length === 0 ? (
                  <span className="text-muted-foreground italic">No auto-routing</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {labels.map((l) => (
                      <span
                        key={l.id}
                        className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[11px]"
                      >
                        <span className={`h-2 w-2 rounded-full ${l.color === "rose" ? "bg-rose-500" : l.color === "amber" ? "bg-amber-500" : l.color === "emerald" ? "bg-emerald-500" : l.color === "blue" ? "bg-blue-500" : l.color === "purple" ? "bg-purple-500" : "bg-slate-500"}`} />
                        {l.name}
                      </span>
                    ))}
                  </div>
                )}
              </FieldRow>
            </DetailSection>

            <DetailSection label={`Members (${members.length})`}>
              {members.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">
                  No members yet.
                </div>
              ) : (
                <ul className="divide-y border rounded bg-background">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-6 w-6 rounded-full bg-muted shrink-0 flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                          {m.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">{m.name}</div>
                          <div className="text-[10.5px] text-muted-foreground truncate">{m.email}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => stub("remove-member", { teamId: t.id, userId: m.id })}
                        className="text-[10px] text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
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
