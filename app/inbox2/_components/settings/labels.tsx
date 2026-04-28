"use client";

/**
 * SOURCE: new
 * CREATED: 2026-04-28
 * STATUS: new (mock fixtures; mutations stub)
 * REINTEGRATION: replace fixtures with `queryWorkspaceLabels()`; wire
 *   create / rename / delete / merge actions.
 */

import { Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  WORKSPACE_LABELS,
  LABEL_COLOR_CLASS,
  type WorkspaceLabel,
} from "@/mock/settings";
import {
  SettingsListDetail,
  DetailHeader,
  DetailSection,
  FieldRow,
} from "./settings-list-detail";

export function LabelsSection() {
  function stub(action: string, payload: Record<string, unknown> = {}) {
    // eslint-disable-next-line no-console
    console.log(`[stub] settings/labels ${action}`, payload);
    toast.message(`${action} — stub`);
  }

  return (
    <SettingsListDetail
      title="Labels"
      description={`${WORKSPACE_LABELS.length} labels in use across the workspace.`}
      items={WORKSPACE_LABELS}
      getId={(l) => l.id}
      matchValue={(l) => `${l.name} ${l.description}`}
      toolbar={
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-1.5 text-xs h-7"
          onClick={() => stub("create-label")}
        >
          <Plus className="h-3.5 w-3.5" />
          New label
        </Button>
      }
      renderRow={(l) => (
        <div className="flex items-start gap-2 min-w-0">
          <span
            className={`h-3 w-3 rounded-full mt-0.5 shrink-0 ${LABEL_COLOR_CLASS[l.color]}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium font-mono truncate">{l.name}</div>
            <div className="text-[10.5px] text-muted-foreground truncate">
              {l.threadCount} thread{l.threadCount === 1 ? "" : "s"}
              {l.systemManaged ? " · auto" : ""}
            </div>
          </div>
        </div>
      )}
      renderDetail={(l: WorkspaceLabel) => (
        <article>
          <DetailHeader
            title={l.name}
            subtitle={l.description}
            actions={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => stub("apply-to-threads", { labelId: l.id })}
                >
                  Apply to threads…
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => stub("delete-label", { labelId: l.id })}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </>
            }
          />

          <DetailSection label="Identity">
            <FieldRow label="Name">
              <span className="font-mono">{l.name}</span>
            </FieldRow>
            <FieldRow label="Color">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${LABEL_COLOR_CLASS[l.color]}`} />
                <span className="capitalize">{l.color}</span>
              </div>
            </FieldRow>
            <FieldRow label="Source">
              {l.systemManaged ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Wand2 className="h-3 w-3" />
                  System-managed (created by automation rule)
                </span>
              ) : (
                <span className="text-muted-foreground">User-defined</span>
              )}
            </FieldRow>
          </DetailSection>

          <DetailSection label="Usage">
            <FieldRow label="Threads">
              <span className="tabular-nums">{l.threadCount}</span>
            </FieldRow>
            <FieldRow label="Linked rules">
              <button
                type="button"
                onClick={() => stub("view-linked-rules", { labelId: l.id })}
                className="text-primary hover:underline"
              >
                View rules using this label →
              </button>
            </FieldRow>
          </DetailSection>
        </article>
      )}
    />
  );
}
