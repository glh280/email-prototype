// Mock data types for the NPR Dashboard prototype.
// Mirrors the eventual Postgres schema loosely; kept simple for the prototype.

export type Track = "TI" | "LN" | "DD" | "CS" | "PT";

export const TRACK_LABEL: Record<Track, string> = {
  TI: "Title",
  LN: "Lending",
  DD: "Deal Desk",
  CS: "Consulting",
  PT: "Partnership",
};

// Label colors — match the filter chips at the top. Used on row labels + chips.
export const TRACK_COLOR: Record<Track, string> = {
  TI: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  LN: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  DD: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  CS: "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200",
  PT: "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-200",
};

export type StageKey =
  | "pre_screen"
  | "deal_structuring"
  | "deal_team_assigned"
  | "lender_packaging"
  | "lender_shopping"
  | "term_sheet_pending"
  | "pre_qual_approval"
  | "term_sheet_execution"
  | "closed"
  | "killed";

export type Stage = { key: StageKey; label: string; terminal?: boolean };

export const STAGES: Stage[] = [
  { key: "pre_screen", label: "Pre-Screen / Qualification" },
  { key: "deal_structuring", label: "Deal Structuring" },
  { key: "deal_team_assigned", label: "Deal Team Assigned" },
  { key: "lender_packaging", label: "Lender Packaging" },
  { key: "lender_shopping", label: "Lender Shopping / Qualification" },
  { key: "term_sheet_pending", label: "Term Sheet — Pending" },
  { key: "pre_qual_approval", label: "Pre-Qual Approval / Terms" },
  { key: "term_sheet_execution", label: "Term Sheet / LOI Execution" },
  { key: "closed", label: "Closed", terminal: true },
  { key: "killed", label: "Killed", terminal: true },
];

export type Priority = "low" | "med" | "high";
export type DealStatus = "active" | "closed" | "killed";

// Priority colors — chosen to NOT collide with track colors (no amber/emerald/blue tones)
export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  med: "Medium",
  high: "High",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  low: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  med: "bg-orange-200 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  high: "bg-rose-500 text-white dark:bg-rose-600 shadow-sm ring-2 ring-rose-300/60 dark:ring-rose-500/40",
};

export type RoleSlot =
  | "directing_agent"
  | "title_partner"
  | "borrower"
  | "seller"
  | "lender_partner"
  | "mortgage_broker"
  | "tc_partner"
  | "tl_partner"
  | "listing_agent"
  | "internal_owner"
  | "capital_provider"
  | "principal"
  | "deal_source"
  | "board_reviewer";

export const ROLE_LABEL: Record<RoleSlot, string> = {
  directing_agent: "Directing Agent",
  title_partner: "Title Partner",
  borrower: "Borrower",
  seller: "Seller",
  lender_partner: "Lender Partner",
  mortgage_broker: "Mortgage Broker",
  tc_partner: "TC Partner",
  tl_partner: "Transactional Lender",
  listing_agent: "Listing Agent",
  internal_owner: "Internal Owner",
  capital_provider: "Capital Provider",
  principal: "Principal",
  deal_source: "Deal Source",
  board_reviewer: "Board Reviewer",
};

export type Contact = {
  id: string;
  fullName: string;
  org?: string;
  email?: string;
  phone?: string;
  // Enriched fields (shown in hover card)
  title?: string; // e.g. "COO, UTS", "Broker", "Investor"
  address?: string; // short free-form city/state or full street
  website?: string; // url, no protocol required
  tags?: string[]; // "what they do" — e.g. ["Title", "Workshare"]
  licensedStates?: string[]; // two-letter codes or state names — "FL", "TX", etc.
  secondaryName?: string; // alternate contact person (assistant, partner, etc.)
  secondaryEmail?: string;
  secondaryPhone?: string;
};

export type RoleAssignment = {
  roleSlot: RoleSlot;
  contact: Contact;
  notes?: string;
};

// Internal team members who can own tasks. For the prototype this is a fixed list.
export type TeamMemberName = "Carrie" | "Mike" | "Melissa" | "Jais" | "Aunt Steff" | "Taylor";

export const TEAM_MEMBERS: TeamMemberName[] = ["Carrie", "Mike", "Melissa", "Jais", "Aunt Steff", "Taylor"];

export type Task = {
  id: string;
  title: string;
  /** Owners — one or more names (internal team members or external roles like "Pegasus ops"). First = primary. */
  owners: string[];
  dueAt?: string; // ISO date
  status: "open" | "done" | "skipped";
  /** Highlighted as the next up. Can still exist on multiple — but UI highlights one. */
  isNext: boolean;
};

export type Note = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string; // ISO
  /** ISO timestamp of the last edit. Equal to createdAt if never edited. */
  updatedAt?: string;
  /** Optional deal link. Unlinked notes are operational reminders not tied to a file. */
  dealId?: string;
  /** Priority was formerly separate. It's now captured by "urgent" only — high/med/low removed per rev-5 ask. */
  priority?: Priority;
  urgent?: boolean;
  completed?: boolean;
};

/** A single message within an email thread. */
export type EmailMessage = {
  id: string;
  fromName: string;
  /** Optional sender email — preview pane shows `Name <email>` when present. */
  fromAddress?: string;
  toNames?: string[]; // optional — "To" recipients shown when expanded
  ccNames?: string[];
  bccNames?: string[];
  sentAt: string; // ISO
  /** One-line snippet shown when the message is collapsed. */
  snippet: string;
  /** Full body shown when the message is expanded. Optional — falls back to snippet. */
  body?: string;
};

/** A Gmail-style email thread — one subject, many messages. */
export type EmailThread = {
  id: string;
  subject: string;
  messages: EmailMessage[];
};

/**
 * Legacy single-message linked email. Kept as a type alias so older mock entries
 * or code paths compile while the thread migration is in progress. New code should
 * prefer EmailThread.
 */
export type LinkedEmail = {
  id: string;
  subject: string;
  fromName: string;
  receivedAt: string; // ISO
};

// =============================================================================
// Email Inbox (L1 — UI prototype only)
// =============================================================================
//
// CHANGE LOG
// ----------
// 2026-04-27 — initial port from NPR_Dashboard@a7a31d9b
//   Sources:
//     - lib/email-query.ts:687-718  (InboxRow, InboxFilters)
//     - lib/email-query.ts:720-738  (InboxFilters)
//     - lib/email-query.ts:740-...  (InboxThreadMessage)
//     - lib/filter-params.ts        (InboxTab union)
//     - lib/email-suggestion.ts     (MultiFileCandidate, UnassignedSuggestion)
//     - db/schema/email-types.ts    (MatchBadgeVariant, EmailMessageLite)
//
// 2026-04-27 — /inbox2 Workspace shell (phase 1)
//   Sources: new (no PROD source — net-new shell)
//     - Account: connected mailbox identity (model TBD in PROD: likely
//       `gmail_accounts` row)
//     - Group: shared inbox / team context with kind discriminator
//     - WorkspaceContext: active account + group + workspace label
//     - NavView: extends InboxTab with sent | drafts | settings
//     - Inbox2ShellState: shell-owned UI state (accountId, groupId,
//       navView, selectedMessageId)
//     - InboxRow: extended with optional accountId + groupId so rows can
//       scope to context
//
// 2026-04-27 — Badge urgency model (workspace shell visual iteration)
//   Sources: new
//     - ViewBadge { total, urgent }: counts split by severity. UI rule:
//       urgent > 0 ⇒ red badge with urgent count. urgent === 0 ⇒ neutral
//       badge with total. Applies to bell notification + nav rail per-view
//       counts.
//     - "Urgent" semantic: failed match/triage, overdue, unassigned
//       critical, anything that should pull operator attention NOW.
//
// 2026-04-27 — NavView Missive realignment (top-bar / left-rail split)
//   Sources: new
//     - NavView union replaced. Missive pattern: left rail = where I am,
//       top bar = what I can do. NavView is now ONLY the left-rail nav
//       items: inbox | team-inboxes | calendars | assigned-me |
//       assigned-others | comments | trash | spam.
//     - DROPPED from NavView: by-file, multi-file, unassigned, team,
//       sent, drafts, settings. by-file/multi-file/unassigned/team were
//       triage tabs — fold into "inbox" filter chips later. sent/drafts
//       reachable via Compose flow + future per-account expand. settings
//       reachable via Avatar menu only.
//     - Group navigation moves from top-bar dropdown into the nav rail's
//       "Custom groups/teams" section (groupId still owned by
//       Inbox2ShellState; nav rail clicks call onGroupChange).
// 2026-04-28 — Inbox2ShellState.unreadOverrides (row context menu)
//   Sources: new
//     - unreadOverrides: Record<InboxRow["messageId"], boolean>. Local
//       L1 mutation layer for the row right-click menu's mark-read /
//       mark-unread actions. Effective row.isUnread = overrides[id] ??
//       row.isUnread. Lives on shell state so badge derivation re-runs
//       on toggle without mutating the mock fixture. L2+ replaces with
//       a real PATCH against the message store.
//
// 2026-04-28 — InboxRow.suggestedActions (preview pane)
//   Sources: new
//     - SuggestedAction { id, kind, label, hint? } and SuggestedActionKind.
//       Replaces the Snippet bubble in the preview pane with a curated
//       list of next-step affordances ("Move to next stage", "Send wire
//       confirmation template", "Set follow-up", etc.). L1 stub — clicks
//       toast. L2+ wires to real automations + ClickUp / GHL surfaces.
//     - Kinds map to Carrie's "where is this file? whose turn is next?"
//       core value: stage-update, assign, reply-template, follow-up,
//       file-update, flag.
//
// 2026-04-28 — Inbox2Filters + Inbox2ShellState.filters
//   Sources: new
//     - Inbox2Filters: { unread?, highPriority?, hasAttachment?,
//       fileLinked?, dateRange?, mailboxes? }. Lives on shell state.
//       Applied inside currentTabRows derivation. Filter popover in the
//       top bar is the only writer. L2+ moves to URL params for
//       shareable filtered views.
//     - DateRangePreset union: "today" | "7d" | "30d" | "all".
//
// 2026-04-28 — TeamNote (preview pane Team Notes section)
//   Sources: new (no PROD source — Workspace shell internal-comment surface)
//     - TeamNote { id, threadId, authorId, authorName, body, mentions?,
//       createdAt }. Internal team chatter pinned to an email thread.
//       Visible on every message in the chain (scoped by threadId, not
//       messageId). Replaces the "Phase 1 placeholder" footer in
//       `<Inbox2PreviewPane>`.
//     - Mentions: { kind: "user" | "team", id }. Powers nav-rail
//       Comments badge — count of notes mentioning CURRENT_USER_ID.
//     - L1 stub: composer fires console.log + toast, no persistence.
//     - L2+ replaces with `email_thread_notes` table + `note_mentions`
//       join table; mention writes fan out via Pub/Sub.
//
// 2026-04-28 — Attachment + InboxRow.attachments
//   Sources: new (no PROD source — preview-pane file list)
//     - Attachment { id, name, sizeLabel, kind }. Per-thread file list
//       rendered above team notes when row.hasAttachment is true. Lookup
//       lives in `mock/attachments.ts` (keyed by threadId) so the bulk
//       mock/inbox.ts file stays untouched. L2+ joins
//       `gmail_message_attachments` rows server-side.
//
// (add entries below as iteration extends types)

export type InboxTab = "all" | "by-file" | "multi-file" | "unassigned" | "team" | "spam";

export const INBOX_TAB_ORDER: readonly InboxTab[] = [
  "all",
  "by-file",
  "multi-file",
  "unassigned",
  "team",
  "spam",
] as const;

export const INBOX_TAB_LABEL: Record<InboxTab, string> = {
  "all": "All",
  "by-file": "By File",
  "multi-file": "Multi-File",
  "unassigned": "Unassigned",
  "team": "Team",
  "spam": "Spam",
};

export type PriorityTier = "HIGH" | "MEDIUM" | "LOW";

export type InboxMatchBadge = "auto-matched" | "ai-suggested" | "manually-added";

/** Per-candidate row in the Multi-File tab (≥2 candidates ≥70% confidence). */
export type MultiFileCandidate = {
  dealId: string;
  fileNo: string;
  propertyAddress: string | null;
  confidence: number;
  /** Top signal that drove the match (e.g. "matches property address"). */
  topSignal: string;
  /** Haiku-generated explanation; null falls back to "Matched on {topSignal}". */
  aiReason: string | null;
};

/** Suggestion pill in the Unassigned tab (single highest-confidence candidate ≥70%). */
export type UnassignedSuggestion = {
  dealId: string;
  fileNo: string;
  propertyAddress: string | null;
  confidence: number;
  topSignal: string;
};

/**
 * Inbox row shape consumed by every tab's row component. Mirrors PROD
 * `lib/email-query.ts::InboxRow`. Per-tab optional fields populated only
 * for the relevant tab (e.g. `candidates` only for multi-file rows).
 */
export type InboxRow = {
  threadId: string;
  /** Latest message id in the thread — used for the read-state cutoff. */
  messageId: string;
  subject: string | null;
  fromName: string | null;
  fromAddress: string;
  /** Which of the 13 mailboxes this thread first appeared in. */
  mailboxAddress: string | null;
  snippet: string | null;
  sentAt: Date;
  hasAttachment: boolean;
  priorityScore: number | null;
  priorityTier: PriorityTier | null;
  priorityReason: string | null;
  aiSummary: string | null;
  matchBadge: InboxMatchBadge | null;
  /** Local toggle in L1 (no email_read_state table). */
  isUnread: boolean;
  // Per-tab optional fields:
  dealId?: string | null;
  /** By File tab: groups by deal.file_no. */
  fileNo?: string | null;
  /** By File tab: header text. */
  propertyAddress?: string | null;
  /** Multi-File tab: ≥2 candidates ≥70%. */
  candidates?: MultiFileCandidate[];
  /** Unassigned tab: highest-confidence suggestion ≥70%, if any. */
  suggestion?: UnassignedSuggestion | null;
  /** Full thread chain shown on expand. Oldest-first; UI sorts newest-first. */
  messages?: EmailMessage[];
  // /inbox2 shell scoping (phase 1, additive — Classic surface ignores)
  /** Which connected account this row belongs to. */
  accountId?: string;
  /** Which group/team owns this row. */
  groupId?: string;
  /**
   * Curated next-step affordances rendered in the /inbox2 preview pane.
   * See CHANGE LOG entry 2026-04-28 — InboxRow.suggestedActions.
   */
  suggestedActions?: SuggestedAction[];
};

export type SuggestedActionKind =
  | "stage-update"
  | "assign"
  | "reply-template"
  | "follow-up"
  | "file-update"
  | "flag";

export type SuggestedAction = {
  id: string;
  kind: SuggestedActionKind;
  label: string;
  /** Sub-line context: deadline, assignee, target stage, etc. */
  hint?: string;
};

export type InboxFilters = {
  q?: string;
  priority?: PriorityTier[];
};

/** Digest row — one file_no with its priority-ordered messages. */
export type DigestGroup = {
  fileNo: string | null;
  propertyAddress: string | null;
  rows: InboxRow[];
};

export type LinkedClickUp = {
  id: string;
  label: string;
  url: string;
};

export type LinkedGHL = {
  id: string;
  label: string;
  url: string;
};

export type DealDocument = {
  id: string;
  name: string;
  uploadedBy: string;
  uploadedAt: string; // ISO
  size?: string; // e.g. "1.2 MB"
  kind?: "pdf" | "docx" | "xlsx" | "image" | "other";
  /** If source is Google Drive this is the drive file URL. For the prototype it's a placeholder. */
  driveUrl?: string;
};

export type ChangeEntry = {
  id: string;
  at: string; // ISO
  actor: string; // e.g. "Carrie"
  /** Human-readable summary, e.g. "Advanced stage from X to Y" or "Assigned Melissa to task 'Pull CD'" */
  summary: string;
  kind?: "stage" | "task" | "people" | "note" | "document" | "other";
};

export type Deal = {
  id: string;
  track: Track;
  title: string;
  stage: StageKey;
  priority: Priority;
  status: DealStatus;
  openedAt: string;
  closingAt?: string;
  lastActivityAt: string;
  propertyAddress?: string;
  propertyState?: string;
  purchasePrice?: number;
  loanAmount?: number;
  downPayment?: number;
  titleCTC?: boolean;
  lenderCTC?: boolean;
  /** Internal owners — multi-select popup targets this. First = primary. */
  internalOwners: TeamMemberName[];
  people: RoleAssignment[];
  tasks: Task[];
  notes: Note[];
  /** Legacy flat email list — kept for back-compat; new deals should use `emailThreads`. */
  linkedEmails: LinkedEmail[];
  /** Preferred email representation: grouped into threads. */
  emailThreads?: EmailThread[];
  linkedClickUp: LinkedClickUp[];
  linkedGHL?: LinkedGHL[];
  documents?: DealDocument[];
  changeHistory?: ChangeEntry[];
};

// =============================================================================
// /inbox2 Workspace shell (L1 — phase 1)
// =============================================================================
//
// See `mock/types.ts` CHANGE LOG entry 2026-04-27 — /inbox2 Workspace shell.

export type Account = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
};

export type GroupKind = "track" | "team" | "other";

export type Group = {
  id: string;
  name: string;
  kind: GroupKind;
  /** Set when kind === "track". */
  track?: Track;
  memberCount: number;
  /** Optional unread count if cheap to derive. */
  unreadCount?: number;
};

export type WorkspaceContext = {
  accountId: Account["id"];
  groupId: Group["id"];
  workspaceLabel: string;
};

/**
 * Left-rail navigation items. Missive pattern — `where I am` lives here,
 * `what I can do` lives in the top bar.
 *
 * "inbox" is the default landing view (formerly "all"). Other entries are
 * queue-shaped placeholders in L1 (no row data wired yet).
 */
export type NavView =
  | "inbox"
  | "team-inboxes"
  | "calendars"
  | "assigned-me"
  | "assigned-others"
  | "comments"
  | "trash"
  | "spam";

export const NAV_VIEW_ORDER: readonly NavView[] = [
  "inbox",
  "team-inboxes",
  "calendars",
  "assigned-me",
  "assigned-others",
  "comments",
  "trash",
  "spam",
] as const;

export type Inbox2ShellState = {
  accountId: Account["id"];
  groupId: Group["id"];
  navView: NavView;
  selectedMessageId: InboxRow["messageId"] | null;
  // Row-level mark-read / mark-unread overrides from the right-click
  // context menu. Keyed by messageId. See CHANGE LOG entry 2026-04-28.
  unreadOverrides: Record<InboxRow["messageId"], boolean>;
  // Top-bar Filter popover state. Applied inside currentTabRows
  // derivation. See CHANGE LOG entry 2026-04-28 — Inbox2Filters.
  filters: Inbox2Filters;
};

export type DateRangePreset = "today" | "7d" | "30d" | "all";

export type Inbox2Filters = {
  unread?: boolean;
  highPriority?: boolean;
  hasAttachment?: boolean;
  fileLinked?: boolean;
  dateRange?: DateRangePreset;
  /** Empty array = no mailbox filter; non-empty = include only these. */
  mailboxes?: string[];
};

export const EMPTY_INBOX_FILTERS: Inbox2Filters = {};

/**
 * Internal team chatter pinned to an email thread. Visible on every
 * message in the chain (scoped by threadId, not messageId). See
 * CHANGE LOG entry 2026-04-28 — TeamNote.
 */
export type NoteMention = {
  kind: "user" | "team";
  /** WorkspaceUser.id or WorkspaceTeam.id. */
  id: string;
  /** Display label captured at write time so renderers don't have to look up. */
  label: string;
};

export type TeamNote = {
  id: string;
  threadId: InboxRow["threadId"];
  authorId: string;
  authorName: string;
  /** Plain text body — may contain `@Label` substrings echoing entries in `mentions`. */
  body: string;
  /** Tagged users / teams. Drives nav-rail Comments badge for the current user. */
  mentions?: NoteMention[];
  createdAt: string; // ISO
};

/**
 * One row of the per-thread attachment list rendered in the preview pane.
 * See CHANGE LOG entry 2026-04-28 — Attachment.
 */
export type Attachment = {
  id: string;
  name: string;
  /** Pre-formatted human-readable size, e.g. "1.2 MB". */
  sizeLabel: string;
  kind: "pdf" | "docx" | "xlsx" | "image" | "other";
};

/** Count of active filter dimensions — used for the top-bar button badge. */
export function countActiveFilters(f: Inbox2Filters): number {
  let n = 0;
  if (f.unread) n++;
  if (f.highPriority) n++;
  if (f.hasAttachment) n++;
  if (f.fileLinked) n++;
  if (f.dateRange && f.dateRange !== "all") n++;
  if (f.mailboxes && f.mailboxes.length > 0) n++;
  return n;
}

/**
 * Badge counter split by urgency. UI rule:
 *   urgent > 0 ⇒ red badge showing `urgent`
 *   urgent === 0 && total > 0 ⇒ neutral badge showing `total`
 *   total === 0 ⇒ no badge
 */
export type ViewBadge = {
  total: number;
  urgent: number;
};
