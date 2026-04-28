// L1 settings fixtures — hand-rolled mock data for /settings workspace.
//
// SOURCE: new (no PROD source — net-new prototype surface)
// CREATED: 2026-04-28
// STATUS: new
// REINTEGRATION: Phase 2+ replaces every export with server queries
//   (`querySettingsForUser`, `queryUsersForOrg`, etc.).

import type { Account, Group } from "./types";

// ---------------------------------------------------------------------------
// Section nav — drives the left column of the /settings shell.
// ---------------------------------------------------------------------------

export type SettingsSectionId =
  | "profile"
  | "preferences"
  | "login-security"
  | "accounts"
  | "calendars"
  | "integrations"
  | "api"
  | "organizations"
  | "users"
  | "guests"
  | "teams"
  | "labels"
  | "ai"
  | "rules"
  | "signatures"
  | "billing";

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  /** Lucide icon name (resolved in the nav component to keep this file lib-agnostic). */
  iconName:
    | "User"
    | "Sliders"
    | "Lock"
    | "Mail"
    | "Calendar"
    | "Plug"
    | "Code2"
    | "Building2"
    | "Users"
    | "UserPlus"
    | "Users2"
    | "Tag"
    | "Sparkles"
    | "Zap"
    | "PenLine"
    | "CreditCard";
  /** Section grouping for the left nav dividers. */
  cluster: "personal" | "mail" | "team" | "build" | "billing";
  /** Marks the L1 priority "build first" sections. */
  priority?: boolean;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  // Personal
  { id: "profile",         label: "Profile",          iconName: "User",        cluster: "personal" },
  { id: "preferences",     label: "Preferences",      iconName: "Sliders",     cluster: "personal", priority: true },
  { id: "login-security",  label: "Login & Security", iconName: "Lock",        cluster: "personal" },
  { id: "signatures",      label: "Signatures",       iconName: "PenLine",     cluster: "personal", priority: true },
  { id: "ai",              label: "AI",               iconName: "Sparkles",    cluster: "personal" },
  // Mail
  { id: "accounts",        label: "Accounts",         iconName: "Mail",        cluster: "mail",     priority: true },
  { id: "calendars",       label: "Calendars",        iconName: "Calendar",    cluster: "mail" },
  { id: "labels",          label: "Labels",           iconName: "Tag",         cluster: "mail",     priority: true },
  { id: "rules",           label: "Rules",            iconName: "Zap",         cluster: "mail",     priority: true },
  // Team
  { id: "organizations",   label: "Organizations",    iconName: "Building2",   cluster: "team",     priority: true },
  { id: "users",           label: "Users",            iconName: "Users",       cluster: "team",     priority: true },
  { id: "guests",          label: "Guests",           iconName: "UserPlus",    cluster: "team" },
  { id: "teams",           label: "Teams",            iconName: "Users2",      cluster: "team",     priority: true },
  // Build
  { id: "integrations",    label: "Integrations",     iconName: "Plug",        cluster: "build" },
  { id: "api",             label: "API",              iconName: "Code2",       cluster: "build" },
  // Billing
  { id: "billing",         label: "Billing",          iconName: "CreditCard",  cluster: "billing" },
];

export const SETTINGS_CLUSTER_LABEL: Record<SettingsSection["cluster"], string> = {
  personal: "Personal",
  mail: "Mail",
  team: "Team",
  build: "Build",
  billing: "Billing",
};

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = "accounts";

// ---------------------------------------------------------------------------
// Users — workspace members
// ---------------------------------------------------------------------------

export type UserRole = "owner" | "admin" | "member" | "viewer";

export type WorkspaceUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** ISO timestamp of last activity. */
  lastActive: string;
  status: "active" | "invited" | "suspended";
  twoFactorEnabled: boolean;
  /** Team memberships by id. */
  teamIds: string[];
};

export const WORKSPACE_USERS: WorkspaceUser[] = [
  {
    id: "u_mike",
    name: "Mike Hutton",
    email: "mike@nprfunding.com",
    role: "owner",
    lastActive: "2026-04-28T14:02:00Z",
    status: "active",
    twoFactorEnabled: true,
    teamIds: ["tm_lending", "tm_admin"],
  },
  {
    id: "u_carrie",
    name: "Carrie Davis",
    email: "Carrie@unitedtitlesolutions.com",
    role: "admin",
    lastActive: "2026-04-28T13:48:00Z",
    status: "active",
    twoFactorEnabled: true,
    teamIds: ["tm_title", "tm_closings", "tm_admin"],
  },
  {
    id: "u_kenneth",
    name: "Kenneth Lezada",
    email: "connect@signaturetransactionmanagement.com",
    role: "admin",
    lastActive: "2026-04-28T11:32:00Z",
    status: "active",
    twoFactorEnabled: true,
    teamIds: ["tm_consulting", "tm_admin"],
  },
  {
    id: "u_ashley",
    name: "Ashley Davis",
    email: "orders@unitedtitlesolutions.com",
    role: "member",
    lastActive: "2026-04-28T13:05:00Z",
    status: "active",
    twoFactorEnabled: true,
    teamIds: ["tm_title", "tm_closings"],
  },
  {
    id: "u_steff",
    name: "Steff Williams",
    email: "steff@unitedtitlesolutions.com",
    role: "member",
    lastActive: "2026-04-28T12:11:00Z",
    status: "active",
    twoFactorEnabled: false,
    teamIds: ["tm_title", "tm_closings"],
  },
  {
    id: "u_jordan",
    name: "Jordan Reyes",
    email: "jordan@nprfunding.com",
    role: "member",
    lastActive: "2026-04-27T22:30:00Z",
    status: "active",
    twoFactorEnabled: true,
    teamIds: ["tm_lending"],
  },
  {
    id: "u_devin",
    name: "Devin Park",
    email: "devin@nprfunding.com",
    role: "viewer",
    lastActive: "2026-04-20T09:15:00Z",
    status: "invited",
    twoFactorEnabled: false,
    teamIds: [],
  },
  {
    id: "u_pat",
    name: "Pat Lee",
    email: "pat@unitedtitlesolutions.com",
    role: "member",
    lastActive: "2026-03-12T17:00:00Z",
    status: "suspended",
    twoFactorEnabled: false,
    teamIds: ["tm_admin"],
  },
];

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export type WorkspaceTeam = {
  id: string;
  name: string;
  description: string;
  color: string;
  /** Group id this team owns; aligns with mock/inbox2.ts GROUPS. */
  groupId: Group["id"] | null;
  memberIds: string[];
  /** Optional auto-rule: route mail with these labels to this team. */
  autoLabels?: string[];
};

export const WORKSPACE_TEAMS: WorkspaceTeam[] = [
  {
    id: "tm_title",
    name: "Title Ops",
    description: "Commitments, exception clearing, recording.",
    color: "bg-blue-500",
    groupId: "grp-title",
    memberIds: ["u_carrie", "u_steff", "u_ashley"],
    autoLabels: ["title-commitment", "recording"],
  },
  {
    id: "tm_lending",
    name: "Lending Ops",
    description: "Lender packages, UW conditions, rate locks.",
    color: "bg-emerald-500",
    groupId: "grp-lending",
    memberIds: ["u_mike", "u_jordan"],
    autoLabels: ["uw-conditions", "rate-lock"],
  },
  {
    id: "tm_closings",
    name: "Closings Desk",
    description: "Settlement coordination, wire ops, post-closing.",
    color: "bg-amber-500",
    groupId: "grp-deal-desk",
    memberIds: ["u_carrie", "u_steff", "u_ashley"],
    autoLabels: ["wire", "closing"],
  },
  {
    id: "tm_consulting",
    name: "Consulting",
    description: "Advisory engagements, billable matters.",
    color: "bg-purple-500",
    groupId: "grp-consulting",
    memberIds: ["u_kenneth"],
  },
  {
    id: "tm_admin",
    name: "Admin",
    description: "Owners + workspace admin.",
    color: "bg-slate-500",
    groupId: null,
    memberIds: ["u_mike", "u_carrie", "u_kenneth", "u_pat"],
  },
];

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export type Organization = {
  id: string;
  name: string;
  /** ID of parent organization, or null for the workspace root. */
  parentId: string | null;
  domain: string;
  ssoEnabled: boolean;
  seatCount: number;
  seatLimit: number;
  /** Aggregated workspace user ids in this org (and descendants in L2+). */
  userIds: string[];
};

export const ORGANIZATIONS: Organization[] = [
  {
    id: "org_npr",
    name: "NPR Funding",
    parentId: null,
    domain: "nprfunding.com",
    ssoEnabled: true,
    seatCount: 2,
    seatLimit: 10,
    userIds: ["u_mike", "u_jordan"],
  },
  {
    id: "org_uts",
    name: "United Title Solutions",
    parentId: "org_npr",
    domain: "unitedtitlesolutions.com",
    ssoEnabled: true,
    seatCount: 5,
    seatLimit: 25,
    userIds: ["u_carrie", "u_ashley", "u_steff", "u_devin", "u_pat"],
  },
  {
    id: "org_stm",
    name: "Signature Transaction Mgmt",
    parentId: "org_npr",
    domain: "signaturetransactionmanagement.com",
    ssoEnabled: false,
    seatCount: 1,
    seatLimit: 5,
    userIds: ["u_kenneth"],
  },
];

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export type LabelColor =
  | "rose"
  | "amber"
  | "emerald"
  | "blue"
  | "purple"
  | "slate";

export type WorkspaceLabel = {
  id: string;
  name: string;
  color: LabelColor;
  description: string;
  /** Approximate count of currently labeled threads. */
  threadCount: number;
  /** Whether this label was created by an automation rule. */
  systemManaged: boolean;
};

export const LABEL_COLOR_CLASS: Record<LabelColor, string> = {
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  slate: "bg-slate-500",
};

export const WORKSPACE_LABELS: WorkspaceLabel[] = [
  { id: "lbl_wire",        name: "wire",              color: "rose",    description: "Wire instructions, confirmations, fraud-watch threads.",     threadCount: 14, systemManaged: false },
  { id: "lbl_closing",     name: "closing",           color: "amber",   description: "Anything inside ±5 days of a scheduled closing.",            threadCount: 22, systemManaged: false },
  { id: "lbl_uw",          name: "uw-conditions",     color: "blue",    description: "Underwriter conditions, prior-to-close items.",              threadCount: 9,  systemManaged: true  },
  { id: "lbl_title_comm",  name: "title-commitment",  color: "blue",    description: "Title commitments + schedule B exceptions.",                 threadCount: 7,  systemManaged: true  },
  { id: "lbl_recording",   name: "recording",         color: "emerald", description: "County recording confirmations + book/page stamps.",         threadCount: 11, systemManaged: true  },
  { id: "lbl_compliance",  name: "compliance",        color: "rose",    description: "Manual compliance flag — needs second-channel verify.",      threadCount: 3,  systemManaged: false },
  { id: "lbl_rate_lock",   name: "rate-lock",         color: "amber",   description: "Lender rate-lock notices, expirations, extensions.",         threadCount: 5,  systemManaged: true  },
  { id: "lbl_referral",    name: "referral",          color: "purple",  description: "Inbound deal referrals from agents / brokers / partners.",   threadCount: 18, systemManaged: false },
  { id: "lbl_admin",       name: "admin",             color: "slate",   description: "Internal ops, OOO, payroll, vendor billing.",                threadCount: 32, systemManaged: false },
];

// ---------------------------------------------------------------------------
// Rules — automation
// ---------------------------------------------------------------------------

export type RuleConditionField = "from" | "subject" | "body" | "mailbox" | "hasAttachment";
export type RuleConditionOp = "contains" | "equals" | "matches" | "is";

export type RuleCondition = {
  field: RuleConditionField;
  op: RuleConditionOp;
  value: string;
};

export type RuleActionKind =
  | "apply-label"
  | "assign-team"
  | "set-priority"
  | "auto-reply"
  | "forward"
  | "mark-read";

export type RuleAction = {
  kind: RuleActionKind;
  /** Free-form payload — labelId, teamId, priorityTier, templateId, etc. */
  value: string;
};

export type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  /** AND across conditions in v1; OR support deferred. */
  conditions: RuleCondition[];
  actions: RuleAction[];
  /** Total threads matched lifetime. */
  matches: number;
  /** ISO timestamp the rule last fired. */
  lastFired: string | null;
};

export const WORKSPACE_RULES: Rule[] = [
  {
    id: "rl_wire_compliance",
    name: "Wire emails → compliance flag + Closings Desk",
    enabled: true,
    conditions: [
      { field: "subject", op: "contains", value: "wire" },
      { field: "mailbox", op: "equals", value: "wires@unitedtitlesolutions.com" },
    ],
    actions: [
      { kind: "apply-label", value: "lbl_wire" },
      { kind: "apply-label", value: "lbl_compliance" },
      { kind: "assign-team", value: "tm_closings" },
      { kind: "set-priority", value: "HIGH" },
    ],
    matches: 47,
    lastFired: "2026-04-28T13:50:00Z",
  },
  {
    id: "rl_uw_conditions",
    name: "UW conditions → label + Lending Ops",
    enabled: true,
    conditions: [
      { field: "from", op: "contains", value: "uw@" },
    ],
    actions: [
      { kind: "apply-label", value: "lbl_uw" },
      { kind: "assign-team", value: "tm_lending" },
    ],
    matches: 28,
    lastFired: "2026-04-28T11:02:00Z",
  },
  {
    id: "rl_title_commitments",
    name: "Stewart Title commitments → Title Ops",
    enabled: true,
    conditions: [
      { field: "from", op: "contains", value: "@stewart.com" },
      { field: "subject", op: "contains", value: "commitment" },
    ],
    actions: [
      { kind: "apply-label", value: "lbl_title_comm" },
      { kind: "assign-team", value: "tm_title" },
    ],
    matches: 19,
    lastFired: "2026-04-28T08:45:00Z",
  },
  {
    id: "rl_ooo_mute",
    name: "OOO auto-replies → mark read",
    enabled: true,
    conditions: [
      { field: "subject", op: "contains", value: "out of office" },
    ],
    actions: [
      { kind: "mark-read", value: "true" },
      { kind: "apply-label", value: "lbl_admin" },
    ],
    matches: 132,
    lastFired: "2026-04-27T16:20:00Z",
  },
  {
    id: "rl_recording_confirm",
    name: "County recording confirmations",
    enabled: false,
    conditions: [
      { field: "from", op: "contains", value: "fultoncountyga.gov" },
    ],
    actions: [
      { kind: "apply-label", value: "lbl_recording" },
    ],
    matches: 4,
    lastFired: "2026-04-26T10:14:00Z",
  },
];

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

export type Signature = {
  id: string;
  name: string;
  /** Owner workspace user id. */
  userId: string;
  /** Default-by-mailbox map: which mailboxes auto-use this signature. */
  defaultForMailboxes: string[];
  body: string;
};

export const SIGNATURES: Signature[] = [
  {
    id: "sig_mike_short",
    name: "Mike — short",
    userId: "u_mike",
    defaultForMailboxes: ["mike@unitedtitlesolutions.com"],
    body: "— Mike\nNPR Funding · 813.555.0100",
  },
  {
    id: "sig_mike_full",
    name: "Mike — full",
    userId: "u_mike",
    defaultForMailboxes: [],
    body: "Mike Hutton\nManaging Partner · NPR Funding\nmike@nprfunding.com · 813.555.0100\nnprfunding.com",
  },
  {
    id: "sig_carrie_uts",
    name: "Carrie — UTS",
    userId: "u_carrie",
    defaultForMailboxes: [
      "carrie@unitedtitlesolutions.com",
      "carrie@utstitle.com",
    ],
    body: "Carrie Davis\nCOO · United Title Solutions\ncarrie@unitedtitlesolutions.com · 813.555.0102",
  },
  {
    id: "sig_carrie_stm",
    name: "Carrie — STM",
    userId: "u_carrie",
    defaultForMailboxes: ["carrie@signaturetransactionmanagement.com"],
    body: "Carrie Davis\nSignature Transaction Management\nCONFIDENTIAL — see footer for compliance terms.",
  },
  {
    id: "sig_steff",
    name: "Steff — default",
    userId: "u_steff",
    defaultForMailboxes: ["steff@unitedtitlesolutions.com"],
    body: "Steff Williams\nTitle Officer · UTS\nsteff@unitedtitlesolutions.com · 813.555.0107",
  },
  {
    id: "sig_ashley",
    name: "Ashley — orders",
    userId: "u_ashley",
    defaultForMailboxes: ["orders@unitedtitlesolutions.com"],
    body: "Ashley Davis\nOrder Coordinator · UTS\norders@unitedtitlesolutions.com · 813.555.0110",
  },
  {
    id: "sig_kenneth",
    name: "Kenneth — STM",
    userId: "u_kenneth",
    defaultForMailboxes: ["connect@signaturetransactionmanagement.com"],
    body: "Kenneth Lezada\nPartner · Signature Transaction Management\nconnect@signaturetransactionmanagement.com",
  },
];

// ---------------------------------------------------------------------------
// Preferences — workspace-wide + per-user
// ---------------------------------------------------------------------------

export type Preferences = {
  theme: "system" | "light" | "dark";
  density: "comfortable" | "cozy" | "compact";
  defaultSort: "newest" | "oldest" | "priority";
  showSnippet: boolean;
  showAiSummary: boolean;
  markReadOnPreview: boolean;
  autoExpandThreads: boolean;
  enableKeyboardShortcuts: boolean;
  notificationSound: "off" | "subtle" | "ding";
  desktopNotifications: boolean;
  weekStartsOn: "sun" | "mon";
  composeFontSize: "sm" | "md" | "lg";
};

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  density: "cozy",
  defaultSort: "priority",
  showSnippet: false,
  showAiSummary: true,
  markReadOnPreview: true,
  autoExpandThreads: false,
  enableKeyboardShortcuts: true,
  notificationSound: "subtle",
  desktopNotifications: true,
  weekStartsOn: "mon",
  composeFontSize: "md",
};

// ---------------------------------------------------------------------------
// Accounts — connected mailboxes (extends mock/inbox2.ts ACCOUNTS)
// ---------------------------------------------------------------------------

export type ConnectedAccount = {
  id: string;
  email: string;
  displayName: string;
  /** Underlying provider. */
  provider: "gmail" | "google-workspace" | "imap";
  /** Whether OAuth refresh token is healthy. */
  status: "connected" | "needs-reauth" | "error";
  /** ISO last successful sync. */
  lastSyncedAt: string;
  /** Whether this account is the workspace default sender. */
  isDefault: boolean;
  /** Owner workspace user id (multi-account-per-user supported). */
  ownerUserId: string;
  /** Mailbox addresses this account routes to (1+). */
  mailboxes: string[];
  /** Which workspace user / Account binding. */
  accountId: Account["id"];
};

export const CONNECTED_ACCOUNTS: ConnectedAccount[] = [
  {
    id: "ca_mike_npr",
    email: "mike@nprfunding.com",
    displayName: "Mike Hutton",
    provider: "google-workspace",
    status: "connected",
    lastSyncedAt: "2026-04-28T14:02:30Z",
    isDefault: true,
    ownerUserId: "u_mike",
    mailboxes: [
      "mike@unitedtitlesolutions.com",
      "wires@unitedtitlesolutions.com",
      "closings@unitedtitlesolutions.com",
    ],
    accountId: "acct-mike",
  },
  {
    id: "ca_carrie_uts",
    email: "carrie@uts.com",
    displayName: "Carrie Davis",
    provider: "google-workspace",
    status: "connected",
    lastSyncedAt: "2026-04-28T13:55:10Z",
    isDefault: false,
    ownerUserId: "u_carrie",
    mailboxes: [
      "carrie@unitedtitlesolutions.com",
      "carrie@utstitle.com",
      "info@unitedtitlesolutions.com",
    ],
    accountId: "acct-carrie",
  },
  {
    id: "ca_carrie_stm",
    email: "carrie@signaturetransactionmanagement.com",
    displayName: "Carrie Davis (STM)",
    provider: "gmail",
    status: "needs-reauth",
    lastSyncedAt: "2026-04-25T08:11:00Z",
    isDefault: false,
    ownerUserId: "u_carrie",
    mailboxes: ["carrie@signaturetransactionmanagement.com"],
    accountId: "acct-carrie",
  },
];
