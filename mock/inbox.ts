// L1 inbox fixtures — hardcoded mock data for the unified inbox prototype.
//
// SOURCE: shape mirrors NPR_Dashboard@a7a31d9b lib/email-query.ts::InboxRow
// COPIED: 2026-04-27
// STATUS: new
// REINTEGRATION: replaced by `queryInboxForUser()` reading from email_messages
//   table; this file is deleted at L2 (DB-backed reads).

import type {
  DigestGroup,
  EmailMessage,
  InboxRow,
  InboxTab,
  MultiFileCandidate,
  UnassignedSuggestion,
} from "./types";

// 13 mailbox addresses matching PROD UTS/STM mailbox roster.
export const MOCK_MAILBOXES = [
  "orders@unitedtitlesolutions.com",
  "carrie@unitedtitlesolutions.com",
  "steff@unitedtitlesolutions.com",
  "mike@unitedtitlesolutions.com",
  "closings@unitedtitlesolutions.com",
  "title@unitedtitlesolutions.com",
  "support@unitedtitlesolutions.com",
  "wires@unitedtitlesolutions.com",
  "info@unitedtitlesolutions.com",
  "carrie@utstitle.com",
  "info@utstitle.com",
  "carrie@signaturetransactionmanagement.com",
  "carrie@godropbox.com",
] as const;

const NOW = new Date("2026-04-27T14:30:00Z");
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60 * 1000);
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 60 * 60 * 1000);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

// ---------------------------------------------------------------------------
// All tab — base inbox rows (mix of priorities, mailboxes, file associations)
// ---------------------------------------------------------------------------

const baseRows: InboxRow[] = [
  {
    threadId: "t_001",
    messageId: "m_001",
    subject: "Wire instructions for closing today — 1247 Elm St",
    fromName: "Bobbie Sanders",
    fromAddress: "bobbie@lnr.com",
    mailboxAddress: "wires@unitedtitlesolutions.com",
    snippet: "Per our earlier call, here are the updated wire instructions for the 2pm closing. Please confirm receipt before…",
    sentAt: minutesAgo(12),
    hasAttachment: true,
    priorityScore: 96,
    priorityTier: "HIGH",
    priorityReason: "Closing today + wire instructions mentioned",
    aiSummary: "Wire details for 1247 Elm St closing scheduled 2pm today; sender requests confirmation before disbursement.",
    matchBadge: "auto-matched",
    isUnread: true,
    dealId: "d_elm_st",
    fileNo: "FL-2026-001",
    propertyAddress: "1247 Elm St, Tampa, FL",
  },
  {
    threadId: "t_002",
    messageId: "m_002",
    subject: "Title commitment ready for review — Rodriguez refi",
    fromName: "Stewart Title",
    fromAddress: "ops@stewart.com",
    mailboxAddress: "title@unitedtitlesolutions.com",
    snippet: "Attached is the title commitment for the Rodriguez refinance. Please review schedule B-II for the easements…",
    sentAt: hoursAgo(2),
    hasAttachment: true,
    priorityScore: 78,
    priorityTier: "MEDIUM",
    priorityReason: "File active + commitment-stage activity",
    aiSummary: "Title commitment delivered for Rodriguez refi; flag schedule B-II easements before clear-to-close.",
    matchBadge: "auto-matched",
    isUnread: true,
    dealId: "d_rodriguez_refi",
    fileNo: "FL-2026-002",
    propertyAddress: "8829 Pine Ave, Tampa, FL",
  },
  {
    threadId: "t_003",
    messageId: "m_003c",
    subject: "Re: Velocity Office closing schedule",
    fromName: "Jamie Schiltknecht",
    fromAddress: "jamie@epique.com",
    mailboxAddress: "carrie@unitedtitlesolutions.com",
    snippet: "Sounds good. Let's lock Friday at 10am. I'll loop in the buyer's agent. Confirming title is CTC?",
    sentAt: hoursAgo(4),
    hasAttachment: false,
    priorityScore: 72,
    priorityTier: "MEDIUM",
    priorityReason: "Active deal + scheduling request",
    aiSummary: "Buyer agent confirms Friday 10am closing; asking for CTC status.",
    matchBadge: "auto-matched",
    isUnread: false,
    dealId: "d_velocity_office",
    fileNo: "FL-2026-003",
    propertyAddress: "510 Velocity Blvd, Atlanta, GA",
    // Oldest first; UI sorts newest-first on render.
    messages: [
      {
        id: "m_003a",
        fromName: "Jamie Schiltknecht",
        toNames: ["Carrie Davis"],
        sentAt: daysAgo(2).toISOString(),
        snippet: "Wanted to nail down closing time for Velocity Office. Buyer prefers Friday morning.",
        body: "Hi Carrie,\n\nWanted to get on your calendar to lock the Velocity Office closing. Buyer prefers Friday morning if you can swing it. Let me know what windows work.\n\n— Jamie",
      },
      {
        id: "m_003b",
        fromName: "Carrie Davis",
        toNames: ["Jamie Schiltknecht"],
        sentAt: daysAgo(1).toISOString(),
        snippet: "Friday morning works. 10am or 11am? Title should be CTC by EOD Thursday.",
        body: "Jamie —\n\nFriday morning works on our end. I can hold either 10am or 11am for you. Title commitment is in final review; I'm expecting CTC by EOD Thursday so we should be clean.\n\n— Carrie",
      },
      {
        id: "m_003c",
        fromName: "Jamie Schiltknecht",
        toNames: ["Carrie Davis"],
        sentAt: hoursAgo(4).toISOString(),
        snippet: "Sounds good. Let's lock Friday at 10am. I'll loop in the buyer's agent. Confirming title is CTC?",
        body: "Sounds good. Let's lock Friday at 10am — I'll loop in the buyer's agent and seller's side now. Just want to confirm title is CTC before I send the final invite.\n\n— Jamie",
      },
    ] satisfies EmailMessage[],
  },
  {
    threadId: "t_004",
    messageId: "m_004",
    subject: "Workshare invoice — March 2026",
    fromName: "Pegasus Title Ops",
    fromAddress: "billing@pegasus.com",
    mailboxAddress: "orders@unitedtitlesolutions.com",
    snippet: "March workshare summary attached. 47 files at $85 each. Net invoice $3,995. Net 15.",
    sentAt: hoursAgo(6),
    hasAttachment: true,
    priorityScore: 45,
    priorityTier: "LOW",
    priorityReason: "Routine billing — no time-sensitive action",
    aiSummary: "Pegasus March workshare invoice $3,995 due in 15 days.",
    matchBadge: null,
    isUnread: false,
  },
  {
    threadId: "t_005",
    messageId: "m_005",
    subject: "CD package — Palm Way 224",
    fromName: "Loan Depot",
    fromAddress: "cd@loandepot.com",
    mailboxAddress: "closings@unitedtitlesolutions.com",
    snippet: "Final CD attached. Please review borrower fees on page 2 and confirm by EOD.",
    sentAt: hoursAgo(8),
    hasAttachment: true,
    priorityScore: 88,
    priorityTier: "HIGH",
    priorityReason: "CD review + EOD deadline",
    aiSummary: "Final CD for Palm Way 224 — review borrower fees by EOD.",
    matchBadge: "ai-suggested",
    isUnread: true,
    dealId: "d_palm_way",
    fileNo: "FL-2026-004",
    propertyAddress: "224 Palm Way, Sarasota, FL",
  },
  {
    threadId: "t_006",
    messageId: "m_006",
    subject: "Out of office — Mike returning Monday",
    fromName: "Mike Hutton",
    fromAddress: "mike@unitedtitlesolutions.com",
    mailboxAddress: "info@unitedtitlesolutions.com",
    snippet: "Quick note — I'm out through Friday. For urgent items contact Carrie.",
    sentAt: daysAgo(1),
    hasAttachment: false,
    priorityScore: 30,
    priorityTier: "LOW",
    priorityReason: "Internal admin note",
    aiSummary: "Mike out through Friday; reroute urgent items to Carrie.",
    matchBadge: null,
    isUnread: false,
  },
];

// ---------------------------------------------------------------------------
// Multi-File tab — threads matching ≥2 candidate deals (≥70% confidence each)
// ---------------------------------------------------------------------------

const multiFileCandidates: MultiFileCandidate[] = [
  {
    dealId: "d_elm_st",
    fileNo: "FL-2026-001",
    propertyAddress: "1247 Elm St, Tampa, FL",
    confidence: 86,
    topSignal: "matches property address",
    aiReason: "Subject mentions 1247 Elm — direct address match in Tampa file.",
  },
  {
    dealId: "d_oak_dr",
    fileNo: "FL-2026-007",
    propertyAddress: "1247 Oak Dr, St Petersburg, FL",
    confidence: 78,
    topSignal: "matches contact: name",
    aiReason: "Sender Bobbie Sanders is directing agent on both Elm + Oak files.",
  },
];

const multiFileRows: InboxRow[] = [
  {
    threadId: "t_mf_001",
    messageId: "m_mf_001",
    subject: "1247 — closing logistics",
    fromName: "Bobbie Sanders",
    fromAddress: "bobbie@lnr.com",
    mailboxAddress: "carrie@unitedtitlesolutions.com",
    snippet: "Hey Carrie, we should plan for the 1247 closing — both buyer and seller want a 2pm slot…",
    sentAt: hoursAgo(3),
    hasAttachment: false,
    priorityScore: 81,
    priorityTier: "HIGH",
    priorityReason: "Multi-file ambiguity + closing logistics",
    aiSummary: "Closing logistics for 1247 — ambiguous between Elm St and Oak Dr.",
    matchBadge: null,
    isUnread: true,
    candidates: multiFileCandidates,
  },
];

// ---------------------------------------------------------------------------
// Unassigned tab — single high-confidence suggestion, awaiting confirm
// ---------------------------------------------------------------------------

const unassignedSuggestion: UnassignedSuggestion = {
  dealId: "d_montana_dscr",
  fileNo: "MT-2026-012",
  propertyAddress: "415 Cascade Ridge, Missoula, MT",
  confidence: 81,
  topSignal: "matches contact: email",
};

const unassignedRows: InboxRow[] = [
  {
    threadId: "t_un_001",
    messageId: "m_un_001",
    subject: "Question on the Cascade DSCR file",
    fromName: "Jamie Schiltknecht",
    fromAddress: "jamie@epique.com",
    mailboxAddress: "info@unitedtitlesolutions.com",
    snippet: "Hi — quick Q on the DSCR underwriting for Cascade. Lender wants reserves in seasoning.",
    sentAt: hoursAgo(5),
    hasAttachment: false,
    priorityScore: 72,
    priorityTier: "MEDIUM",
    priorityReason: "Active suggestion — lender Q requires confirmation",
    aiSummary: "Lender requires reserve seasoning for Cascade DSCR; awaiting file confirmation.",
    matchBadge: "ai-suggested",
    isUnread: true,
    suggestion: unassignedSuggestion,
  },
  {
    threadId: "t_un_002",
    messageId: "m_un_002",
    subject: "Marketing pitch — title automation tool",
    fromName: "Title Tools Inc.",
    fromAddress: "sales@titletools.com",
    mailboxAddress: "info@unitedtitlesolutions.com",
    snippet: "Quick demo opportunity — we have an automation suite that could shave 30% off your title prep cycle…",
    sentAt: daysAgo(1),
    hasAttachment: false,
    priorityScore: 18,
    priorityTier: "LOW",
    priorityReason: "Marketing — no file association detected",
    aiSummary: "Cold sales pitch for title automation tool; no current file relevance.",
    matchBadge: null,
    isUnread: false,
    suggestion: null,
  },
];

// ---------------------------------------------------------------------------
// Team tab — emails to the broader team distribution lists
// ---------------------------------------------------------------------------

const teamRows: InboxRow[] = [
  {
    threadId: "t_team_001",
    messageId: "m_team_001",
    subject: "Weekly ops sync — Monday 9am",
    fromName: "Carrie Hutton",
    fromAddress: "carrie@unitedtitlesolutions.com",
    mailboxAddress: "info@unitedtitlesolutions.com",
    snippet: "Reminder — weekly ops sync Monday 9am. Agenda: pipeline review, partner updates, Q2 hiring.",
    sentAt: hoursAgo(20),
    hasAttachment: false,
    priorityScore: 50,
    priorityTier: "MEDIUM",
    priorityReason: "Internal team coordination",
    aiSummary: "Weekly ops sync Monday 9am; standard agenda.",
    matchBadge: null,
    isUnread: true,
  },
  {
    threadId: "t_team_002",
    messageId: "m_team_002",
    subject: "Holiday calendar — Memorial Day coverage",
    fromName: "Aunt Steff",
    fromAddress: "steff@unitedtitlesolutions.com",
    mailboxAddress: "info@unitedtitlesolutions.com",
    snippet: "Need volunteers for Memorial Day on-call. Reply by EOD Friday.",
    sentAt: daysAgo(2),
    hasAttachment: false,
    priorityScore: 35,
    priorityTier: "LOW",
    priorityReason: "Coordination — non-urgent",
    aiSummary: "Memorial Day on-call coverage signup; reply by EOD Friday.",
    matchBadge: null,
    isUnread: false,
  },
];

// ---------------------------------------------------------------------------
// Spam tab — Gmail SPAM-labeled (rendered with muted opacity, no priority chip)
// ---------------------------------------------------------------------------

const spamRows: InboxRow[] = [
  {
    threadId: "t_spam_001",
    messageId: "m_spam_001",
    subject: "URGENT: Your account has been compromised — verify now",
    fromName: "Security Team",
    fromAddress: "noreply@phishy-domain.tk",
    mailboxAddress: "info@unitedtitlesolutions.com",
    snippet: "Click here within 24 hours to verify your account or it will be suspended permanently.",
    sentAt: hoursAgo(7),
    hasAttachment: false,
    priorityScore: null,
    priorityTier: null,
    priorityReason: null,
    aiSummary: null,
    matchBadge: null,
    isUnread: true,
  },
  {
    threadId: "t_spam_002",
    messageId: "m_spam_002",
    subject: "🎉 You won a $500 gift card!",
    fromName: "Promo Bot",
    fromAddress: "promo@suspicious.biz",
    mailboxAddress: "info@unitedtitlesolutions.com",
    snippet: "Congratulations! You're our 1,000th visitor. Claim your $500 gift card by entering your details below.",
    sentAt: daysAgo(1),
    hasAttachment: false,
    priorityScore: null,
    priorityTier: null,
    priorityReason: null,
    aiSummary: null,
    matchBadge: null,
    isUnread: false,
  },
];

// ---------------------------------------------------------------------------
// Aggregate fixtures + per-tab helpers
// ---------------------------------------------------------------------------

/**
 * All inbox rows. The L1 surface filters this by tab on the client.
 * In L2+ this is replaced by `queryInboxForUser(userId, tab, filters)`.
 */
export const INBOX_ROWS: InboxRow[] = [
  ...baseRows,
  ...multiFileRows,
  ...unassignedRows,
  ...teamRows,
  ...spamRows,
];

/** Per-tab predicate — matches PROD `queryInboxForUser` per-tab base filter. */
export function rowsForTab(tab: InboxTab): InboxRow[] {
  switch (tab) {
    case "all":
      return baseRows;
    case "by-file":
      return baseRows.filter((r) => Boolean(r.fileNo));
    case "multi-file":
      return multiFileRows;
    case "unassigned":
      return unassignedRows;
    case "team":
      return teamRows;
    case "spam":
      return spamRows;
  }
}

/** Per-tab unread counts. Mirrors PROD `queryUnreadCountsByTab`. */
export function unreadCountsByTab(rows: InboxRow[] = INBOX_ROWS): Record<InboxTab, number> {
  const count = (tab: InboxTab) =>
    rowsForTab(tab).filter((r) => r.isUnread).length;
  return {
    all: count("all"),
    "by-file": count("by-file"),
    "multi-file": count("multi-file"),
    unassigned: count("unassigned"),
    team: count("team"),
    spam: count("spam"),
  };
}

/** Top-of-AppHeader unread badge — sum of internal-relevant tabs (excludes spam). */
export const MOCK_INBOX_UNREAD_TOTAL = INBOX_ROWS.filter(
  (r) => r.isUnread,
).length;

// ---------------------------------------------------------------------------
// Digest — canned grouped summary for the "What came in overnight" panel.
// ---------------------------------------------------------------------------

export const MOCK_DIGEST: DigestGroup[] = [
  {
    fileNo: "FL-2026-001",
    propertyAddress: "1247 Elm St, Tampa, FL",
    rows: [baseRows[0]], // wire instructions
  },
  {
    fileNo: "FL-2026-004",
    propertyAddress: "224 Palm Way, Sarasota, FL",
    rows: [baseRows[4]], // CD package
  },
  {
    fileNo: "FL-2026-002",
    propertyAddress: "8829 Pine Ave, Tampa, FL",
    rows: [baseRows[1]], // title commitment
  },
  {
    fileNo: null,
    propertyAddress: null,
    rows: [baseRows[3]], // workshare invoice (unfiled)
  },
];

export const DEFAULT_FROM_MAILBOX = "carrie@unitedtitlesolutions.com";
