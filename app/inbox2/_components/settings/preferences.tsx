"use client";

/**
 * SOURCE: new
 * CREATED: 2026-04-28
 * STATUS: new (mock fixtures; mutations toast — not persisted)
 * REINTEGRATION: replace local state with `usePreferences()` hook backed
 *   by per-user prefs row; PATCH on change.
 *
 * Preferences is a single-page form, not list+detail — full-width
 * sections + inline controls. Toasts confirm changes (no persistence).
 */

import { useState } from "react";
import { toast } from "sonner";
import { DEFAULT_PREFERENCES, type Preferences } from "@/mock/settings";
import { DetailHeader, DetailSection, FieldRow } from "./settings-list-detail";

export function PreferencesSection() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);

  function set<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
    // eslint-disable-next-line no-console
    console.log(`[stub] settings/preferences set`, { key, value });
    toast.message(`Updated ${key}`, { description: `(local-only — not persisted)` });
  }

  return (
    <article className="h-full overflow-y-auto bg-muted/10">
      <DetailHeader
        title="Preferences"
        subtitle="Workspace-wide defaults applied to /inbox2."
      />

      <DetailSection label="Appearance">
        <FieldRow label="Theme">
          <SegmentedControl
            value={prefs.theme}
            onChange={(v) => set("theme", v)}
            options={[
              { id: "system", label: "System" },
              { id: "light", label: "Light" },
              { id: "dark", label: "Dark" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Density">
          <SegmentedControl
            value={prefs.density}
            onChange={(v) => set("density", v)}
            options={[
              { id: "comfortable", label: "Comfortable" },
              { id: "cozy", label: "Cozy" },
              { id: "compact", label: "Compact" },
            ]}
          />
        </FieldRow>
      </DetailSection>

      <DetailSection label="Inbox behavior">
        <FieldRow label="Default sort">
          <SegmentedControl
            value={prefs.defaultSort}
            onChange={(v) => set("defaultSort", v)}
            options={[
              { id: "newest", label: "Newest first" },
              { id: "oldest", label: "Oldest first" },
              { id: "priority", label: "Priority" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Show suggested actions in preview">
          <Toggle
            checked={prefs.showSuggestedActions}
            onChange={(v) => set("showSuggestedActions", v)}
          />
        </FieldRow>
        <FieldRow label="Show AI summary in preview">
          <Toggle checked={prefs.showAiSummary} onChange={(v) => set("showAiSummary", v)} />
        </FieldRow>
        <FieldRow label="Mark as read on preview">
          <Toggle checked={prefs.markReadOnPreview} onChange={(v) => set("markReadOnPreview", v)} />
        </FieldRow>
        <FieldRow label="Auto-expand long threads">
          <Toggle checked={prefs.autoExpandThreads} onChange={(v) => set("autoExpandThreads", v)} />
        </FieldRow>
      </DetailSection>

      <DetailSection label="Notifications">
        <FieldRow label="Sound">
          <SegmentedControl
            value={prefs.notificationSound}
            onChange={(v) => set("notificationSound", v)}
            options={[
              { id: "off", label: "Off" },
              { id: "subtle", label: "Subtle" },
              { id: "ding", label: "Ding" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Desktop notifications">
          <Toggle
            checked={prefs.desktopNotifications}
            onChange={(v) => set("desktopNotifications", v)}
          />
        </FieldRow>
      </DetailSection>

      <DetailSection label="Productivity">
        <FieldRow label="Keyboard shortcuts">
          <Toggle
            checked={prefs.enableKeyboardShortcuts}
            onChange={(v) => set("enableKeyboardShortcuts", v)}
          />
        </FieldRow>
      </DetailSection>
    </article>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={
        "inline-flex h-5 w-9 items-center rounded-full transition-colors " +
        (checked ? "bg-primary" : "bg-muted")
      }
    >
      <span
        className={
          "inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform " +
          (checked ? "translate-x-4" : "translate-x-0.5")
        }
      />
    </button>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ id: T; label: string }>;
}) {
  return (
    <div className="inline-flex items-center rounded border bg-background overflow-hidden">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={
              "px-2.5 py-1 text-[11px] transition-colors " +
              (active
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-muted/50")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
