// L1 /inbox2 Workspace shell fixtures — accounts, groups, defaults.
//
// SOURCE: new (no PROD source — net-new shell)
// CREATED: 2026-04-27
// STATUS: new
// REINTEGRATION: replaced by `queryAccountsForUser` + `queryGroupsForUser`
//   in L2; this file is deleted at L2 (DB-backed reads).

import type { Account, Group, InboxTab, NavView } from "./types";
import { rowsForTab } from "./inbox";

export const WORKSPACE_LABEL = "NPR Funding";

export const ACCOUNTS: Account[] = [
  {
    id: "acct-mike",
    email: "mike@nprfunding.com",
    displayName: "Mike Miller",
  },
  {
    id: "acct-carrie",
    email: "carrie@uts.com",
    displayName: "Carrie Davis",
  },
];

export const GROUPS: Group[] = [
  { id: "grp-title",       name: "Title",       kind: "track", track: "TI", memberCount: 4 },
  { id: "grp-lending",     name: "Lending",     kind: "track", track: "LN", memberCount: 5 },
  { id: "grp-deal-desk",   name: "Deal Desk",   kind: "track", track: "DD", memberCount: 3 },
  { id: "grp-consulting",  name: "Consulting",  kind: "track", track: "CS", memberCount: 2 },
  { id: "grp-partnership", name: "Partnership", kind: "track", track: "PT", memberCount: 2 },
];

export const DEFAULT_ACCOUNT_ID: Account["id"] = "acct-mike";
export const DEFAULT_GROUP_ID: Group["id"] = "grp-lending";
export const DEFAULT_NAV_VIEW: NavView = "inbox";

/**
 * The signed-in workspace user. Hardcoded fallback in L1 — drives the
 * nav-rail Comments badge (counts notes mentioning this user). Aligns
 * with WORKSPACE_USERS[id="u_mike"] in mock/settings.ts.
 *
 * L2 sources this from the Cloudflare Access JWT claim, same path as
 * `getCurrentUser()` in lib/current-user.ts on PROD.
 */
export const CURRENT_USER_ID = "u_mike";

/**
 * Account (mailbox) → workspace user id. Lets the prototype "switch
 * perspective" via the top-bar account selector: nav-rail Comments badge
 * + Comments view filter follow the selected account's owner.
 *
 * L2: derived from gmail_accounts.user_id once auth lands.
 */
export const ACCOUNT_TO_USER_ID: Record<Account["id"], string> = {
  "acct-mike": "u_mike",
  "acct-carrie": "u_carrie",
};

// NavView → backing InboxTab. Only "inbox" + "spam" map to mock data
// today; other views render an empty state in the message list. This map
// is the single source of truth for any consumer that needs to count or
// list rows for the current NavView (sub-header thread count, message
// list, badges).
export const NAV_VIEW_TO_INBOX_TAB: Partial<Record<NavView, InboxTab>> = {
  "inbox": "all",
  "spam": "spam",
  // FILES section — reuses the classic surface's tab slices. The route-
  // to-file workflow (confirm candidate / add to file / dismiss
  // suggestion) is wired through the existing dead-call dialogs in
  // app/inbox/_components.
  "files-by-file": "by-file",
  "files-multi": "multi-file",
  "files-unassigned": "unassigned",
};

export const NAV_VIEW_LABEL: Record<NavView, string> = {
  "inbox": "Inbox",
  "team-inboxes": "Team Inboxes",
  "calendars": "Calendars",
  "assigned-me": "Assigned to me",
  "assigned-others": "Assigned to others",
  "comments": "Comments",
  "trash": "Trash",
  "spam": "Spam",
  "files-by-file": "By File",
  "files-multi": "Multi-File",
  "files-unassigned": "Unassigned",
};

export function findAccount(id: Account["id"]): Account {
  const a = ACCOUNTS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown account id: ${id}`);
  return a;
}

export function findGroup(id: Group["id"]): Group {
  const g = GROUPS.find((x) => x.id === id);
  if (!g) throw new Error(`Unknown group id: ${id}`);
  return g;
}

// ---------------------------------------------------------------------------
// File-number helpers — drives the FILES section nav-rail dropdowns under
// "By File" and "Multi-File". Files follow `XX-YYYY-NNN` (prefix - year
// - sequence). Sort default is "newest first" = year DESC, sequence DESC.
//
// REINTEGRATION: at L2 these come from `deals.file_no` (server-driven);
// the parser stays in lib/ so UI sort + display logic does not regress.
// ---------------------------------------------------------------------------

export type ParsedFileNo = {
  prefix: string;
  year: number;
  seq: number;
  raw: string;
};

export type FileNoSortDir = "newest" | "oldest";

export function parseFileNo(s: string | null | undefined): ParsedFileNo | null {
  if (!s) return null;
  const m = s.match(/^([A-Z]+)-(\d{4})-(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], year: Number(m[2]), seq: Number(m[3]), raw: s };
}

export function sortFileNumbers(
  items: readonly string[],
  dir: FileNoSortDir = "newest",
): string[] {
  const parsed: ParsedFileNo[] = [];
  const unparsed: string[] = [];
  for (const s of items) {
    const p = parseFileNo(s);
    if (p) parsed.push(p);
    else unparsed.push(s);
  }
  parsed.sort((a, b) => {
    if (a.year !== b.year) {
      return dir === "newest" ? b.year - a.year : a.year - b.year;
    }
    if (a.seq !== b.seq) {
      return dir === "newest" ? b.seq - a.seq : a.seq - b.seq;
    }
    return a.prefix.localeCompare(b.prefix);
  });
  unparsed.sort();
  return [...parsed.map((p) => p.raw), ...unparsed];
}

/**
 * Distinct file numbers backing the "By File" tab — every fileNo
 * present on a row in `rowsForTab("by-file")`.
 */
export function uniqueByFileNumbers(): string[] {
  const set = new Set<string>();
  for (const r of rowsForTab("by-file")) {
    if (r.fileNo) set.add(r.fileNo);
  }
  return Array.from(set);
}

/**
 * Distinct file numbers backing the "Multi-File" tab — every candidate
 * fileNo across rows in `rowsForTab("multi-file")`. Includes the row's
 * own `fileNo` if set (for rows that already have a primary assignment
 * but matched ≥1 additional candidate).
 */
export function uniqueMultiFileNumbers(): string[] {
  const set = new Set<string>();
  for (const r of rowsForTab("multi-file")) {
    if (r.fileNo) set.add(r.fileNo);
    for (const c of r.candidates ?? []) {
      if (c.fileNo) set.add(c.fileNo);
    }
  }
  return Array.from(set);
}

/**
 * Every file number known to the prototype — union of:
 *   - `rowsForTab("all")` row.fileNo
 *   - multi-file row candidates (row.fileNo + candidate.fileNo)
 *   - unassigned-row suggestions (row.fileNo + suggestion.fileNo)
 *
 * Used by the "Add to file" dialog autocomplete so the operator can
 * search across every file the prototype knows about, not just the
 * subset visible in the active tab.
 *
 * REINTEGRATION: at L2 this is replaced by a server-driven file search
 * (deals.file_no autocomplete) — see AddThreadToDealDialog.
 */
export function allKnownFileNumbers(): string[] {
  const set = new Set<string>();
  for (const r of rowsForTab("all")) {
    if (r.fileNo) set.add(r.fileNo);
  }
  for (const r of rowsForTab("multi-file")) {
    if (r.fileNo) set.add(r.fileNo);
    for (const c of r.candidates ?? []) {
      if (c.fileNo) set.add(c.fileNo);
    }
  }
  for (const r of rowsForTab("unassigned")) {
    if (r.fileNo) set.add(r.fileNo);
    if (r.suggestion?.fileNo) set.add(r.suggestion.fileNo);
  }
  return Array.from(set);
}

/**
 * Prepend `[fileNo] ` to a subject string if not already tagged. Treats
 * any leading `[XX-YYYY-NNN]` (any prefix / year / sequence shape) as
 * an existing tag and returns the subject unchanged — never duplicates.
 *
 * Used by the inbox2 shell on Reply / Reply-all / Forward when the
 * source thread (or the current selectedFileNo) has a known fileNo and
 * the AI setting `prependFileNoToSubject` is on. Outbound subjects
 * carrying the file number make future inbound matching trivial — the
 * counterpart inbox match-by-subject becomes a primary key lookup,
 * sidestepping the AI fallback path.
 */
export function prependFileNoToSubject(
  fileNo: string | null | undefined,
  subject: string | null | undefined,
): string {
  const subjStr = (subject ?? "").trimStart();
  if (!fileNo) return subjStr;
  // Existing tag detection — handles any leading bracketed XX-YYYY-NNN.
  if (/^\[[A-Z]+-\d{4}-\d+\]/.test(subjStr)) return subjStr;
  return `[${fileNo}] ${subjStr}`;
}

/**
 * Substring search over every known file number. Case-insensitive.
 * Matches anywhere in the string so partial sequences work — "0002"
 * hits both "FL-2026-0002" and "NM-2026-00023". Results returned in
 * newest-first sort order; empty / whitespace-only query returns the
 * full sorted list (caller decides whether to render it).
 */
export function searchKnownFileNumbers(
  query: string,
  limit = 10,
): string[] {
  const all = sortFileNumbers(allKnownFileNumbers(), "newest");
  const needle = query.trim().toLowerCase();
  if (!needle) return all.slice(0, limit);
  const matches: string[] = [];
  for (const fileNo of all) {
    if (fileNo.toLowerCase().includes(needle)) {
      matches.push(fileNo);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}
