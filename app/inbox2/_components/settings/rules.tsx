"use client";

/**
 * SOURCE: new
 * CREATED: 2026-04-28
 * STATUS: new (mock fixtures; mutations stub)
 * REINTEGRATION: replace fixtures with `queryWorkspaceRules()`; wire
 *   create / edit / enable / disable / dry-run actions.
 */

import { Plus, Play, Power, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  WORKSPACE_RULES,
  WORKSPACE_LABELS,
  WORKSPACE_TEAMS,
  type Rule,
  type RuleAction,
  type RuleCondition,
} from "@/mock/settings";
import {
  SettingsListDetail,
  DetailHeader,
  DetailSection,
  FieldRow,
} from "./settings-list-detail";

function describeCondition(c: RuleCondition): string {
  return `${c.field} ${c.op} "${c.value}"`;
}

function describeAction(a: RuleAction): string {
  switch (a.kind) {
    case "apply-label": {
      const l = WORKSPACE_LABELS.find((x) => x.id === a.value);
      return l ? `Apply label ${l.name}` : `Apply label ${a.value}`;
    }
    case "assign-team": {
      const t = WORKSPACE_TEAMS.find((x) => x.id === a.value);
      return t ? `Assign to team ${t.name}` : `Assign to team ${a.value}`;
    }
    case "set-priority":
      return `Set priority ${a.value}`;
    case "auto-reply":
      return `Auto-reply with template ${a.value}`;
    case "forward":
      return `Forward to ${a.value}`;
    case "mark-read":
      return "Mark as read";
  }
}

export function RulesSection() {
  function stub(action: string, payload: Record<string, unknown> = {}) {
    // eslint-disable-next-line no-console
    console.log(`[stub] settings/rules ${action}`, payload);
    toast.message(`${action} — stub`);
  }

  return (
    <SettingsListDetail
      title="Rules"
      description={`${WORKSPACE_RULES.length} automation rules.`}
      items={WORKSPACE_RULES}
      getId={(r) => r.id}
      matchValue={(r) => `${r.name} ${r.conditions.map(describeCondition).join(" ")}`}
      toolbar={
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-1.5 text-xs h-7"
          onClick={() => stub("create-rule")}
        >
          <Plus className="h-3.5 w-3.5" />
          New rule
        </Button>
      }
      renderRow={(r) => (
        <div className="flex items-start gap-2 min-w-0">
          <Wand2
            className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${r.enabled ? "text-primary" : "text-muted-foreground/40"}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">{r.name}</div>
            <div className="text-[10.5px] text-muted-foreground truncate">
              {r.matches} match{r.matches === 1 ? "" : "es"}
              {r.lastFired
                ? ` · last fired ${new Date(r.lastFired).toLocaleDateString()}`
                : ""}
            </div>
            {!r.enabled ? (
              <span className="inline-block mt-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                disabled
              </span>
            ) : null}
          </div>
        </div>
      )}
      renderDetail={(r: Rule) => (
        <article>
          <DetailHeader
            title={r.name}
            subtitle={
              r.lastFired
                ? `Last fired ${new Date(r.lastFired).toLocaleString()}`
                : "Never fired"
            }
            actions={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs"
                  onClick={() => stub("dry-run", { ruleId: r.id })}
                >
                  <Play className="h-3 w-3" />
                  Dry-run
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs"
                  onClick={() => stub("toggle-enabled", { ruleId: r.id, next: !r.enabled })}
                >
                  <Power className="h-3 w-3" />
                  {r.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => stub("delete-rule", { ruleId: r.id })}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </>
            }
          />

          <DetailSection label="When (all conditions match)">
            <ul className="space-y-1">
              {r.conditions.map((c, idx) => (
                <li
                  key={idx}
                  className="text-xs font-mono bg-muted/40 rounded px-2 py-1.5 border"
                >
                  {describeCondition(c)}
                </li>
              ))}
            </ul>
          </DetailSection>

          <DetailSection label="Then (run all actions)">
            <ul className="space-y-1">
              {r.actions.map((a, idx) => (
                <li
                  key={idx}
                  className="text-xs bg-primary/5 rounded px-2 py-1.5 border border-primary/20"
                >
                  {describeAction(a)}
                </li>
              ))}
            </ul>
          </DetailSection>

          <DetailSection label="Stats">
            <FieldRow label="Lifetime matches">
              <span className="tabular-nums">{r.matches}</span>
            </FieldRow>
            <FieldRow label="Status">
              <span
                className={
                  r.enabled
                    ? "inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground"
                }
              >
                {r.enabled ? "Active" : "Disabled"}
              </span>
            </FieldRow>
          </DetailSection>
        </article>
      )}
    />
  );
}
