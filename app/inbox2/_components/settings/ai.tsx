"use client";

/**
 * SOURCE: new
 * CREATED: 2026-04-28
 * STATUS: new (admin-gated; mutations write to module store + persist to localStorage)
 * REINTEGRATION: replace local store hook with `useAiSettings()` server
 *   query + admin role gate enforced server-side.
 *
 * Settings > AI section. Workspace-wide controls for AI match / search
 * behaviour. Master `enabled` toggle gates every sub-feature; non-admins
 * see a read-only summary explaining who controls it.
 */

import { AlertTriangle, Sparkles, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { CURRENT_USER_ID } from "@/mock/inbox2";
import { WORKSPACE_USERS } from "@/mock/settings";
import type { AiSettings } from "@/mock/settings";
import {
  setAiSetting,
  useAiSettings,
} from "@/lib/ai-settings-store";
import { DetailHeader, DetailSection, FieldRow } from "./settings-list-detail";

function isAdmin(): boolean {
  const u = WORKSPACE_USERS.find((x) => x.id === CURRENT_USER_ID);
  return u?.role === "owner" || u?.role === "admin";
}

export function AiSection() {
  const settings = useAiSettings();
  const admin = isAdmin();

  function set<K extends keyof AiSettings>(key: K, value: AiSettings[K]) {
    setAiSetting(key, value);
    // eslint-disable-next-line no-console
    console.log("[stub-state] settings/ai set", { key, value });
    toast.message(`Updated AI · ${key}`, {
      description: "(workspace-wide; persisted in localStorage in L1)",
    });
  }

  const masterOff = !settings.enabled;

  return (
    <article className="h-full overflow-y-auto bg-muted/10">
      <DetailHeader
        title="AI"
        subtitle="Workspace-wide AI match, summary, and outbound-tagging controls. Admin-only."
      />

      {!admin ? (
        <div className="mx-6 my-3 rounded border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[12px] text-amber-900 dark:text-amber-200 flex gap-2 items-start">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <div>
            <div className="font-medium">Admin only</div>
            <div className="opacity-80">
              You can view current settings but only an Owner or Admin can
              change them. Contact your workspace administrator.
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-6 my-3 rounded-lg border bg-background px-4 py-3 flex items-center gap-3">
        <div className="rounded bg-primary/10 p-2 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">
            AI match &amp; assist {settings.enabled ? "on" : "off"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Master switch. When off, every sub-feature below is paused —
            no candidate chips, no AI summaries, no auto-prepend. Useful
            for cost / privacy / debugging.
          </div>
        </div>
        <Toggle
          large
          disabled={!admin}
          checked={settings.enabled}
          onChange={(v) => set("enabled", v)}
        />
      </div>

      <DetailSection label="File matching">
        <FieldRow label="Show candidate / suggestion chips">
          <Toggle
            disabled={!admin || masterOff}
            checked={settings.enabled && settings.autoMatchSuggestions}
            onChange={(v) => set("autoMatchSuggestions", v)}
          />
        </FieldRow>
        <FieldRow label="AI summary in preview">
          <Toggle
            disabled={!admin || masterOff}
            checked={settings.enabled && settings.autoSummary}
            onChange={(v) => set("autoSummary", v)}
          />
        </FieldRow>
        <FieldRow label="Subject-line learning on confirm">
          <Toggle
            disabled={!admin || masterOff}
            checked={settings.enabled && settings.subjectLineLearning}
            onChange={(v) => set("subjectLineLearning", v)}
          />
        </FieldRow>
        <p className="px-6 pb-3 -mt-1 text-[11px] text-muted-foreground italic max-w-prose">
          Subject lines are stored as a <em>supplementary</em> match
          signal — not a primary key. If the contact, sender, or other
          fingerprint data changes, the match degrades and falls back to
          fresh AI scoring.
        </p>
      </DetailSection>

      <DetailSection label="Outbound tagging">
        <FieldRow label="Prepend file number to outbound subject">
          <Toggle
            disabled={!admin || masterOff}
            checked={settings.enabled && settings.prependFileNoToSubject}
            onChange={(v) => set("prependFileNoToSubject", v)}
          />
        </FieldRow>
        {!settings.prependFileNoToSubject || masterOff ? (
          <div className="mx-6 mb-3 rounded border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[12px] text-amber-900 dark:text-amber-200 flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <div>
              <div className="font-medium">
                Outbound auto-tag is{" "}
                {masterOff ? "paused (master off)" : "off"} — match
                failures likely
              </div>
              <div className="opacity-80">
                Without the file number on the subject line, future
                replies have to fall back to subject-line learning + AI
                scoring. Both are slower and have a higher miss rate
                when the original sender drops the prefix.
              </div>
            </div>
          </div>
        ) : (
          <p className="px-6 pb-3 -mt-1 text-[11px] text-muted-foreground italic max-w-prose">
            Outgoing Reply / Reply-all / Forward subjects get
            <code className="font-mono mx-1 rounded bg-muted px-1 py-0.5 text-[10px]">
              [FL-2026-001]
            </code>
            (or the active file number) prepended automatically — never
            duplicates a tag already in the subject.
          </p>
        )}
      </DetailSection>

      <p className="px-6 py-4 text-[11px] text-muted-foreground italic">
        Settings persist locally per browser in L1. PROD writes to
        <code className="font-mono mx-1">workspace_settings.ai</code>.
      </p>
    </article>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  large,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  large?: boolean;
}) {
  const sizeOuter = large ? "h-6 w-11" : "h-5 w-9";
  const sizeKnob = large ? "h-5 w-5" : "h-4 w-4";
  const knobOn = large ? "translate-x-5" : "translate-x-4";
  const knobOff = "translate-x-0.5";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "inline-flex items-center rounded-full transition-colors",
        sizeOuter,
        checked ? "bg-primary" : "bg-muted",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block rounded-full bg-background shadow-sm transition-transform",
          sizeKnob,
          checked ? knobOn : knobOff,
        ].join(" ")}
      />
    </button>
  );
}
