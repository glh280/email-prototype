"use client";

/**
 * SOURCE: new
 * CREATED: 2026-04-28
 * STATUS: new (mock fixtures; mutations toast — not persisted)
 * REINTEGRATION: replace local state with `useProfile()` hook backed by
 *   per-user profile row; PATCH on change. Identity fields (email,
 *   primary 2FA, password) stay owned by Cloudflare Access — Profile
 *   only edits app-local preferences and presentation.
 *
 * Profile is a single-page form (not list+detail). Only fields that make
 * sense to change inside this standalone app live here. Identity bits
 * managed by Cloudflare Access (sign-in email, password, 2FA enrollment)
 * are intentionally read-only with a "Managed by Cloudflare Access" note.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CURRENT_USER_ID } from "@/mock/inbox2";
import { WORKSPACE_USERS } from "@/mock/settings";
import { signatureForMailbox } from "@/mock/signatures";
import { DetailHeader, DetailSection, FieldRow } from "./settings-list-detail";

type ProfileState = {
  displayName: string;
  jobTitle: string;
  phone: string;
  timeZone: string;
  locale: string;
  dateFormat: "us" | "iso" | "eu";
  timeFormat: "12h" | "24h";
  defaultMailbox: string;
  defaultGroup: string;
  defaultUrgent: boolean;
  confirmBeforeSend: boolean;
  signatureHtml: string;
  outOfOffice: boolean;
  outOfOfficeMessage: string;
  desktopNotifications: boolean;
  mentionsOnly: boolean;
  notificationSound: "off" | "subtle" | "ding";
};

/**
 * Whether the current user has the multi-inbox privilege. Prototype
 * hardcodes by role: owner/admin → multi-inbox; others → single mailbox.
 * L2: server-side capability flag tied to workspace_user.permissions.
 */
function hasMultiInboxPrivilege(): boolean {
  const u = WORKSPACE_USERS.find((x) => x.id === CURRENT_USER_ID);
  return u?.role === "owner" || u?.role === "admin";
}

function initialState(): ProfileState {
  const u = WORKSPACE_USERS.find((x) => x.id === CURRENT_USER_ID);
  return {
    displayName: u?.name ?? "Mike Hutton",
    jobTitle: "Owner",
    phone: "813-928-8575",
    timeZone: "America/New_York",
    locale: "en-US",
    dateFormat: "us",
    timeFormat: "12h",
    defaultMailbox: u?.email ?? "mike@nprfunding.com",
    defaultGroup: "grp-lending",
    defaultUrgent: false,
    confirmBeforeSend: true,
    signatureHtml: signatureForMailbox(u?.email ?? "mike@nprfunding.com"),
    outOfOffice: false,
    outOfOfficeMessage:
      "Thanks for your message — I'm out of office and will reply when I'm back. For urgent file matters, please contact closings@unitedtitlesolutions.com.",
    desktopNotifications: true,
    mentionsOnly: false,
    notificationSound: "subtle",
  };
}

export function ProfileSection() {
  const u = WORKSPACE_USERS.find((x) => x.id === CURRENT_USER_ID);
  const [p, setP] = useState<ProfileState>(initialState);

  function set<K extends keyof ProfileState>(key: K, value: ProfileState[K]) {
    setP((prev) => ({ ...prev, [key]: value }));
    // eslint-disable-next-line no-console
    console.log("[stub] settings/profile set", { key, value });
  }

  function handleSave() {
    // eslint-disable-next-line no-console
    console.log("[stub] settings/profile save", p);
    toast.success("Profile saved", {
      description: "(local-only — not persisted)",
    });
  }

  function handleReset() {
    setP(initialState());
    toast.message("Reset to defaults");
  }

  const initials = (p.displayName || u?.name || "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="h-full overflow-y-auto bg-muted/10">
      <DetailHeader
        title="Profile"
        subtitle="Settings that govern how you appear and work inside this app. Sign-in identity is managed by Cloudflare Access."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save changes
            </Button>
          </>
        }
      />

      <DetailSection label="Identity">
        <FieldRow label="Photo">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-sky-200 text-sky-900 dark:bg-sky-900/60 dark:text-sky-100 text-base font-semibold">
              {initials}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.message("Upload photo (stub)")}
            >
              <Camera className="h-3.5 w-3.5" aria-hidden />
              Upload
            </Button>
            <span className="text-[11px] text-muted-foreground">
              PNG / JPG · 256×256 recommended
            </span>
          </div>
        </FieldRow>
        <FieldRow label="Display name">
          <Input
            value={p.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            className="h-8 text-xs max-w-md"
          />
        </FieldRow>
        <FieldRow label="Job title">
          <Input
            value={p.jobTitle}
            onChange={(e) => set("jobTitle", e.target.value)}
            className="h-8 text-xs max-w-md"
          />
        </FieldRow>
        <FieldRow label="Phone">
          <Input
            value={p.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="555-123-4567"
            className="h-8 text-xs max-w-xs"
          />
        </FieldRow>
        <FieldRow label="Sign-in email">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-foreground/80">
              {u?.email ?? "—"}
            </span>
            <span className="text-[10px] uppercase tracking-wide rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              Managed by Cloudflare Access
            </span>
          </div>
        </FieldRow>
      </DetailSection>

      <DetailSection label="Out of office">
        <FieldRow label="Out of office">
          <Toggle
            checked={p.outOfOffice}
            onChange={(v) => set("outOfOffice", v)}
          />
        </FieldRow>
        {p.outOfOffice ? (
          <FieldRow label="Auto-reply message">
            <Textarea
              value={p.outOfOfficeMessage}
              onChange={(e) => set("outOfOfficeMessage", e.target.value)}
              rows={3}
              className="text-xs max-w-2xl"
            />
          </FieldRow>
        ) : null}
      </DetailSection>

      <DetailSection label="Locale & time">
        <FieldRow label="Time zone">
          <select
            value={p.timeZone}
            onChange={(e) => set("timeZone", e.target.value)}
            className="h-8 text-xs rounded border bg-background px-2 max-w-md"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Locale">
          <select
            value={p.locale}
            onChange={(e) => set("locale", e.target.value)}
            className="h-8 text-xs rounded border bg-background px-2 max-w-xs"
          >
            <option value="en-US">English (United States)</option>
            <option value="en-GB">English (United Kingdom)</option>
            <option value="es-US">Español (US)</option>
            <option value="fr-CA">Français (Canada)</option>
          </select>
        </FieldRow>
        <FieldRow label="Date format">
          <SegmentedControl
            value={p.dateFormat}
            onChange={(v) => set("dateFormat", v)}
            options={[
              { id: "us", label: "MM/DD/YYYY" },
              { id: "iso", label: "YYYY-MM-DD" },
              { id: "eu", label: "DD/MM/YYYY" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Time format">
          <SegmentedControl
            value={p.timeFormat}
            onChange={(v) => set("timeFormat", v)}
            options={[
              { id: "12h", label: "12-hour" },
              { id: "24h", label: "24-hour" },
            ]}
          />
        </FieldRow>
      </DetailSection>

      <DetailSection label="Mail defaults">
        <FieldRow label="Default From mailbox">
          {hasMultiInboxPrivilege() ? (
            <select
              value={p.defaultMailbox}
              onChange={(e) => set("defaultMailbox", e.target.value)}
              className="h-8 text-xs rounded border bg-background px-2 max-w-md"
            >
              {[
                "mike@nprfunding.com",
                "carrie@unitedtitlesolutions.com",
                "mike@unitedtitlesolutions.com",
                "support@unitedtitlesolutions.com",
                "orders@unitedtitlesolutions.com",
              ].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-foreground/80">{p.defaultMailbox}</span>
              <span className="text-[10px] uppercase tracking-wide rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                Multi-inbox privilege required — request from Admin (CF settings)
              </span>
            </div>
          )}
        </FieldRow>
        <FieldRow label="Default group">
          <SegmentedControl
            value={p.defaultGroup}
            onChange={(v) => set("defaultGroup", v)}
            options={[
              { id: "grp-lending", label: "Lending" },
              { id: "grp-title", label: "Title" },
              { id: "grp-deal-desk", label: "Deal Desk" },
              { id: "grp-consulting", label: "Consulting" },
              { id: "grp-partnership", label: "Partnership" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Mark new messages urgent by default">
          <Toggle
            checked={p.defaultUrgent}
            onChange={(v) => set("defaultUrgent", v)}
          />
        </FieldRow>
        <FieldRow label="Confirm before send">
          <Toggle
            checked={p.confirmBeforeSend}
            onChange={(v) => set("confirmBeforeSend", v)}
          />
        </FieldRow>
      </DetailSection>

      <DetailSection label="Signature">
        <FieldRow label="Compose signature (HTML)">
          <Textarea
            value={p.signatureHtml}
            onChange={(e) => set("signatureHtml", e.target.value)}
            rows={12}
            spellCheck={false}
            className="text-[11px] font-mono leading-relaxed max-w-3xl"
          />
        </FieldRow>
        <FieldRow label="Preview">
          <div
            className="rounded border bg-background px-3 py-2 max-w-3xl text-xs"
            dangerouslySetInnerHTML={{ __html: p.signatureHtml }}
          />
        </FieldRow>
        <FieldRow label="">
          <span className="text-[10px] text-muted-foreground italic">
            HTML accepted — compatible with Newoldstamp-style signatures
            (table layout, inline styles, embedded logos via &lt;img&gt;
            tags). Auto-populated below the body when you compose a new
            email, reply, or forward. Switching the From mailbox swaps the
            default footer to that mailbox's signature.
          </span>
        </FieldRow>
      </DetailSection>

      <DetailSection label="Notifications">
        <FieldRow label="Desktop notifications">
          <Toggle
            checked={p.desktopNotifications}
            onChange={(v) => set("desktopNotifications", v)}
          />
        </FieldRow>
        <FieldRow label="Only notify on @mentions">
          <Toggle checked={p.mentionsOnly} onChange={(v) => set("mentionsOnly", v)} />
        </FieldRow>
        <FieldRow label="Sound">
          <SegmentedControl
            value={p.notificationSound}
            onChange={(v) => set("notificationSound", v)}
            options={[
              { id: "off", label: "Off" },
              { id: "subtle", label: "Subtle" },
              { id: "ding", label: "Ding" },
            ]}
          />
        </FieldRow>
      </DetailSection>

      <DetailSection label="Account">
        <FieldRow label="Sign-in identity">
          <span className="text-[11px] text-muted-foreground">
            Email, password, and two-factor enrollment are managed by
            Cloudflare Access for this workspace. Use the Cloudflare
            dashboard to update those.
          </span>
        </FieldRow>
      </DetailSection>
    </article>
  );
}

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "UTC",
];

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
