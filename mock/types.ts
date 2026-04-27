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
  toNames?: string[]; // optional — "To" recipients shown when expanded
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
