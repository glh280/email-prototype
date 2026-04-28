// L1 /inbox2 Workspace shell fixtures — accounts, groups, defaults.
//
// SOURCE: new (no PROD source — net-new shell)
// CREATED: 2026-04-27
// STATUS: new
// REINTEGRATION: replaced by `queryAccountsForUser` + `queryGroupsForUser`
//   in L2; this file is deleted at L2 (DB-backed reads).

import type { Account, Group, NavView } from "./types";

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
export const DEFAULT_NAV_VIEW: NavView = "all";

export const NAV_VIEW_LABEL: Record<NavView, string> = {
  "all": "Inbox",
  "by-file": "By File",
  "multi-file": "Multi-File",
  "unassigned": "Unassigned",
  "team": "Team",
  "spam": "Spam",
  "sent": "Sent",
  "drafts": "Drafts",
  "settings": "Settings",
};

/** Mock unread count for the bell icon in the top bar. */
export const MOCK_NOTIFICATION_COUNT = 3;

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
