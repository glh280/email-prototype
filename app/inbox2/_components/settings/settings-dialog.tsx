"use client";

/**
 * SOURCE: new
 * CREATED: 2026-04-28
 * STATUS: new
 * REINTEGRATION: ship as-is. Could deep-link via `?settings=<section>`
 *   query param if shareable links become a requirement.
 *
 * Full-viewport overlay dialog hosting the Settings 3-col workspace.
 * Settings is intentionally NOT a route — operator stays in their inbox
 * context and dismisses with esc / close to return to where they were.
 *
 * Internal state: which section is currently selected.
 */

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "@/mock/settings";
import { SettingsSectionNav } from "./settings-section-nav";
import { AccountsSection } from "./accounts";
import { UsersSection } from "./users";
import { TeamsSection } from "./teams";
import { OrganizationsSection } from "./organizations";
import { LabelsSection } from "./labels";
import { RulesSection } from "./rules";
import { SignaturesSection } from "./signatures";
import { PreferencesSection } from "./preferences";
import { ProfileSection } from "./profile";
import { PlaceholderSection } from "./placeholder";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function renderSection(id: SettingsSectionId): React.ReactNode {
  switch (id) {
    case "profile":       return <ProfileSection />;
    case "accounts":      return <AccountsSection />;
    case "users":         return <UsersSection />;
    case "teams":         return <TeamsSection />;
    case "organizations": return <OrganizationsSection />;
    case "labels":        return <LabelsSection />;
    case "rules":         return <RulesSection />;
    case "signatures":    return <SignaturesSection />;
    case "preferences":   return <PreferencesSection />;
    default: {
      const label =
        SETTINGS_SECTIONS.find((s) => s.id === id)?.label ?? id;
      return <PlaceholderSection title={label} />;
    }
  }
}

export function SettingsDialog({ open, onOpenChange }: Props) {
  const [section, setSection] = useState<SettingsSectionId>(
    DEFAULT_SETTINGS_SECTION,
  );

  // Always reset to the default section (Profile) when the dialog opens.
  // Operator expectation: closing + reopening should land back on the
  // canonical entry point, not wherever they left off.
  useEffect(() => {
    if (open) setSection(DEFAULT_SETTINGS_SECTION);
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 isolate z-50 bg-black/30 supports-backdrop-filter:backdrop-blur-sm duration-100",
            "data-open:animate-in data-open:fade-in-0",
            "data-closed:animate-out data-closed:fade-out-0",
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed inset-4 sm:inset-8 z-50 grid grid-rows-[auto_1fr] overflow-hidden rounded-xl bg-background ring-1 ring-foreground/10 shadow-2xl outline-none duration-100",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          <header className="flex items-center justify-between border-b px-4 py-2">
            <DialogPrimitive.Title className="text-sm font-semibold">
              Settings
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close settings"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </header>
          <div className="flex min-h-0 overflow-hidden">
            <SettingsSectionNav
              currentSection={section}
              onSelect={setSection}
            />
            <div className="flex-1 min-w-0 overflow-hidden">
              {renderSection(section)}
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
