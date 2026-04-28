"use client";

/**
 * SOURCE: new (no PROD source — Settings dialog left section nav)
 * CREATED: 2026-04-28
 * STATUS: new (state-driven; no router push)
 * REINTEGRATION: ship as-is. RBAC slots in by filtering SETTINGS_SECTIONS
 *   before this renders.
 *
 * Vertical icon+label nav. Active state matches `currentSection` prop;
 * clicks call `onSelect`. Lives inside the Settings dialog — no Link.
 */

import {
  User,
  Sliders,
  Lock,
  Mail,
  Calendar,
  Plug,
  Code2,
  Building2,
  Users,
  UserPlus,
  Users2,
  Tag,
  Sparkles,
  Zap,
  PenLine,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SETTINGS_SECTIONS,
  SETTINGS_CLUSTER_LABEL,
  type SettingsSection,
  type SettingsSectionId,
} from "@/mock/settings";

const ICON: Record<SettingsSection["iconName"], LucideIcon> = {
  User,
  Sliders,
  Lock,
  Mail,
  Calendar,
  Plug,
  Code2,
  Building2,
  Users,
  UserPlus,
  Users2,
  Tag,
  Sparkles,
  Zap,
  PenLine,
  CreditCard,
};

type Props = {
  currentSection: SettingsSectionId;
  onSelect: (next: SettingsSectionId) => void;
};

export function SettingsSectionNav({ currentSection, onSelect }: Props) {
  // Group sections by cluster while preserving definition order.
  const clusters = SETTINGS_SECTIONS.reduce<
    Map<SettingsSection["cluster"], SettingsSection[]>
  >((acc, s) => {
    const list = acc.get(s.cluster) ?? [];
    list.push(s);
    acc.set(s.cluster, list);
    return acc;
  }, new Map());

  return (
    <nav
      aria-label="Settings sections"
      className="w-56 shrink-0 border-r bg-muted/20 px-2 py-3 overflow-y-auto"
    >
      <div className="px-2 mb-3">
        <h2 className="text-sm font-semibold">Settings</h2>
      </div>
      {Array.from(clusters.entries()).map(([cluster, sections]) => (
        <div key={cluster} className="mb-3">
          <div className="px-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1">
            {SETTINGS_CLUSTER_LABEL[cluster]}
          </div>
          <div className="flex flex-col gap-0.5">
            {sections.map((s) => (
              <NavItem
                key={s.id}
                section={s}
                Icon={ICON[s.iconName]}
                active={s.id === currentSection}
                onClick={() => onSelect(s.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function NavItem({
  section,
  Icon,
  active,
  onClick,
}: {
  section: SettingsSection;
  Icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded px-2.5 py-1.5 text-xs text-left transition-colors",
        active
          ? "bg-background font-medium text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{section.label}</span>
      {!section.priority ? (
        <span
          className="text-[9px] text-muted-foreground/60 shrink-0"
          title="Not yet built — placeholder"
        >
          ·
        </span>
      ) : null}
    </button>
  );
}
