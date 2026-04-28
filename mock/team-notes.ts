// L1 /inbox2 preview-pane Team Notes fixtures.
//
// SOURCE: new (no PROD source — Workspace-shell internal-comment surface)
// CREATED: 2026-04-28
// STATUS: new
// REINTEGRATION: replaced by `queryTeamNotesForThread` against
//   `email_thread_notes` table at L2; Pub/Sub fanout for live updates.

import type { TeamNote } from "./types";

const now = Date.now();
const minutes = (n: number) => new Date(now - n * 60_000).toISOString();
const hours = (n: number) => new Date(now - n * 3_600_000).toISOString();
const days = (n: number) => new Date(now - n * 86_400_000).toISOString();

export const TEAM_NOTES_BY_THREAD: Record<string, TeamNote[]> = {
  t_001: [
    {
      id: "tn_001_1",
      threadId: "t_001",
      authorId: "u_carrie",
      authorName: "Carrie Davis",
      body: "Heads up @Mike Hutton — borrower called me this morning, said they're nervous about the appraisal timing. Probably needs a touch-base before EOD.",
      mentions: [{ kind: "user", id: "u_mike", label: "Mike Hutton" }],
      createdAt: hours(4),
    },
    {
      id: "tn_001_2",
      threadId: "t_001",
      authorId: "u_mike",
      authorName: "Mike Hutton",
      body: "Good catch. I'll loop in Pegasus on the appraisal ETA and send a holding reply.",
      createdAt: hours(2),
    },
  ],
  t_002: [
    {
      id: "tn_002_1",
      threadId: "t_002",
      authorId: "u_ashley",
      authorName: "Ashley Davis",
      body: "Lender flagged the wire instructions don't match what's on the CD. @Closings Desk — need a confirm before we release.",
      mentions: [{ kind: "team", id: "tm_closings", label: "Closings Desk" }],
      createdAt: hours(1),
    },
  ],
  t_005: [
    {
      id: "tn_005_1",
      threadId: "t_005",
      authorId: "u_kenneth",
      authorName: "Kenneth Lezada",
      body: "Already covered this on the Tuesday call — no action required from us.",
      createdAt: days(1),
    },
    {
      id: "tn_005_2",
      threadId: "t_005",
      authorId: "u_jordan",
      authorName: "Jordan Reyes",
      body: "@Mike Hutton — quick FYI, wanted to make sure you saw Kenneth's note before you reply.",
      mentions: [{ kind: "user", id: "u_mike", label: "Mike Hutton" }],
      createdAt: hours(6),
    },
  ],
  t_007: [
    {
      id: "tn_007_1",
      threadId: "t_007",
      authorId: "u_mike",
      authorName: "Mike Hutton",
      body: "@Carrie Davis can you take this one? Title-side question and you've got the relationship with their ops team.",
      mentions: [{ kind: "user", id: "u_carrie", label: "Carrie Davis" }],
      createdAt: minutes(45),
    },
  ],
  t_008: [
    {
      id: "tn_008_1",
      threadId: "t_008",
      authorId: "u_jordan",
      authorName: "Jordan Reyes",
      body: "@Mike Hutton FYI — UW conditions are firm. Pushing back on the appraisal contingency.",
      mentions: [{ kind: "user", id: "u_mike", label: "Mike Hutton" }],
      createdAt: minutes(20),
    },
  ],
  t_009: [
    {
      id: "tn_009_1",
      threadId: "t_009",
      authorId: "u_carrie",
      authorName: "Carrie Davis",
      body: "Closed today — leaving this here for the file. Wire confirmed at 11:42 AM.",
      createdAt: days(2),
    },
    {
      id: "tn_009_2",
      threadId: "t_009",
      authorId: "u_mike",
      authorName: "Mike Hutton",
      body: "Thanks @Carrie Davis. Marking the deal closed in ClickUp.",
      mentions: [{ kind: "user", id: "u_carrie", label: "Carrie Davis" }],
      createdAt: days(2),
    },
  ],
};

export function notesForThread(threadId: string): TeamNote[] {
  return TEAM_NOTES_BY_THREAD[threadId] ?? [];
}

/** Count notes across ALL threads that mention this user id. */
export function mentionCountForUser(userId: string): number {
  let n = 0;
  for (const list of Object.values(TEAM_NOTES_BY_THREAD)) {
    for (const note of list) {
      if (note.mentions?.some((m) => m.kind === "user" && m.id === userId)) n++;
    }
  }
  return n;
}
