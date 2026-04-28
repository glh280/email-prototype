"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell root)
 * CREATED: 2026-04-27
 * STATUS: new
 * REINTEGRATION: Phase 2+ lifts state to URL params + server-driven
 *   message list; preview pane gains real thread reader.
 *
 * Layout (post Missive realignment — context line dropped):
 *   ┌────────────────────────── TopBar ─────────────────────────┐
 *   │ NavRail ║ SubHeader + MessageList ║ Preview pane          │
 *   │ (views  ║       380..520          ║   >= 420 (flex-1)     │
 *   │ + grps) ║         px              ║                       │
 *   └─────────╨─────────────────────────╨───────────────────────┘
 *   ║ = draggable divider
 *
 * Owns Inbox2ShellState. NavRail drives both navView and groupId; top
 * bar drives accountId + actions. workspaceLabel passed in but no longer
 * rendered in shell chrome (kept on props for future header reuse).
 */

import { useCallback, useMemo, useState } from "react";
import type {
  Account,
  Group,
  Inbox2Filters,
  Inbox2ShellState,
  InboxRow,
  NavView,
  NoteMention,
  TeamNote,
  ViewBadge,
} from "@/mock/types";
import { EMPTY_INBOX_FILTERS, FILES_NAV_VIEWS } from "@/mock/types";
import { rowsForTab } from "@/mock/inbox";
import {
  ACCOUNT_TO_USER_ID,
  CURRENT_USER_ID,
  DEFAULT_GROUP_ID,
  NAV_VIEW_TO_INBOX_TAB,
  prependFileNoToSubject,
  type FileNoSortDir,
} from "@/mock/inbox2";
import { getAiSettings } from "@/lib/ai-settings-store";
import { INBOX2_BY_FILE_EXPANDED_COOKIE } from "@/lib/inbox-view-cookie";
import { notesForThread, TEAM_NOTES_BY_THREAD } from "@/mock/team-notes";
import { WORKSPACE_USERS, WORKSPACE_TEAMS } from "@/mock/settings";
import { toast } from "sonner";
import { Inbox2TopBar } from "./inbox2-top-bar";
import { Inbox2NavRail } from "./inbox2-nav-rail";
import { Inbox2SubHeader } from "./inbox2-sub-header";
import { Inbox2MessageList } from "./inbox2-message-list";
import { Inbox2PreviewPane, type Mentionable } from "./inbox2-preview-pane";
import { Inbox2ResizableBody } from "./inbox2-resizable-body";
import { SettingsDialog } from "./settings/settings-dialog";
import {
  InboxComposeDialog,
  type ComposeContext,
} from "@/app/inbox/_components/inbox-compose-dialog";
import { DEFAULT_FROM_MAILBOX } from "@/mock/inbox";

/**
 * Apply the top-bar search input across the row slice.
 *
 * Matches case-insensitively against:
 *   - subject
 *   - snippet
 *   - aiSummary
 *   - per-message body (rendered when expanded; some rows omit it)
 *   - per-message snippet (collapsed-message preview)
 *   - team notes attached to the thread (cross-author chatter)
 *
 * REINTEGRATION (PROD wire-up):
 *   This client-side filter exists ONLY to make search testable in L1.
 *   When Postgres lands, replace `applySearch` with a server-side FTS
 *   query that joins:
 *     - emails.subject + emails.body_text + emails.snippet
 *     - email_thread_ai_summary.summary  (or whatever lib/ai-summary
 *       writes — currently `aiSummary` on the row)
 *     - email_thread_notes.body
 *   See lib/email-query.ts → `queryInboxRowsForUser` for the existing
 *   row pipeline; the search predicate slots in there. Cloudflare D1
 *   FTS5 or Postgres tsvector both work — index the four columns above
 *   in a single tsvector_union and ts_rank_cd the result. Until that
 *   lands, this helper is the contract: any field that participates in
 *   the prototype's match must participate in the PROD query, or the
 *   inbox2 search will silently regress when the surface flips.
 *
 * Notes (per-thread) are passed in via a closure parameter to avoid
 * threading the full notes registry through every list-derivation
 * dependency. Empty / whitespace-only queries no-op.
 */
function applySearch(
  rows: InboxRow[],
  query: string,
  notesByThread: (threadId: string) => TeamNote[],
): InboxRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((r) => {
    const haystackParts: Array<string | null | undefined> = [
      r.subject,
      r.fromName,
      r.fromAddress,
      r.snippet,
      r.aiSummary,
      r.fileNo,
      r.propertyAddress,
    ];
    if (r.messages) {
      for (const m of r.messages) {
        haystackParts.push(m.snippet, m.body);
      }
    }
    for (const note of notesByThread(r.threadId)) {
      haystackParts.push(note.body);
    }
    const haystack = haystackParts.filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}

/**
 * Apply top-bar Filter popover state to a row slice. Empty / undefined
 * dimensions are ignored. Date range comparisons use sentAt against a
 * single `now` snapshot — fine for the prototype where rows are static.
 */
function applyFilters(rows: InboxRow[], f: Inbox2Filters): InboxRow[] {
  let out = rows;
  if (f.unread) out = out.filter((r) => r.isUnread);
  if (f.highPriority) out = out.filter((r) => r.priorityTier === "HIGH");
  if (f.hasAttachment) out = out.filter((r) => r.hasAttachment);
  if (f.fileLinked) out = out.filter((r) => Boolean(r.fileNo));
  if (f.mailboxes && f.mailboxes.length > 0) {
    const set = new Set(f.mailboxes);
    out = out.filter((r) => r.mailboxAddress !== null && set.has(r.mailboxAddress));
  }
  if (f.dateRange && f.dateRange !== "all") {
    const cutoffMs =
      f.dateRange === "today" ? 24 * 3600e3
        : f.dateRange === "7d" ? 7 * 24 * 3600e3
          : 30 * 24 * 3600e3;
    const cutoff = Date.now() - cutoffMs;
    out = out.filter((r) => r.sentAt.getTime() >= cutoff);
  }
  return out;
}

/**
 * Build a ViewBadge { total, urgent } from a row slice.
 * - total = unread count
 * - urgent = unread + HIGH priority count
 */
function badgeFromRows(rows: InboxRow[]): ViewBadge | undefined {
  const unread = rows.filter((r) => r.isUnread);
  if (unread.length === 0) return undefined;
  const urgent = unread.filter((r) => r.priorityTier === "HIGH").length;
  return { total: unread.length, urgent };
}

type Props = {
  rows: InboxRow[];
  accounts: Account[];
  groups: Group[];
  workspaceLabel: string;
  defaultAccountId: Account["id"];
  defaultGroupId: Group["id"];
  defaultNavView: NavView;
  initialLeftW: number | null;
  initialCenterW: number | null;
  /**
   * File numbers the operator previously expanded in the By File view.
   * Read from a cookie server-side; persisted on every collapse/expand
   * client-side. Default state is "all collapsed" — the cookie only
   * stores overrides.
   */
  initialExpandedFiles: string[];
};

export function Inbox2Shell({
  rows,
  accounts,
  groups,
  defaultAccountId,
  defaultGroupId,
  defaultNavView,
  initialLeftW,
  initialCenterW,
  initialExpandedFiles,
}: Props) {
  const [state, setState] = useState<Inbox2ShellState>({
    accountId: defaultAccountId,
    groupId: defaultGroupId,
    navView: defaultNavView,
    selectedMessageId: null,
    unreadOverrides: {},
    assigneeOverrides: {},
    filters: EMPTY_INBOX_FILTERS,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeContext, setComposeContext] = useState<ComposeContext | undefined>(
    undefined,
  );

  // Live top-bar search query. Empty string = no filter applied. Mirrors
  // the classic surface's `q` state in inbox-surface.tsx; replaced by a
  // URL search-param + server FTS query at L2 (see applySearch comment).
  const [searchQuery, setSearchQuery] = useState("");

  // Custom-group state (additive on top of the static GROUPS fixture):
  //   - customGroups: groups the operator created via the nav-rail "+"
  //     button. Persisted in component state only (refresh resets); a
  //     localStorage layer can be added at L1.5 mirroring the cookie
  //     approach used for pane widths.
  //   - hiddenGroupIds: groups un-checked in the nav-rail "..." filter
  //     dropdown. Hidden from the rail but still queryable; the filter
  //     dropdown lists ALL groups (visible + hidden) so the operator
  //     can re-show.
  const [customGroups, setCustomGroups] = useState<Group[]>([]);
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(
    () => new Set(),
  );

  // Selected file number for the FILES > By File / Multi-File nav-rail
  // dropdowns. Null = no file selected (show all rows in the tab). Set
  // by the nav rail when a file-number sub-item is clicked. Cleared when
  // the operator clicks the parent FILES nav item or switches view.
  const [selectedFileNo, setSelectedFileNo] = useState<string | null>(null);

  // FILES sort direction. Lifted from the nav-rail so the rail's file-
  // number dropdown AND the center-pane "By File" group order stay in
  // sync — flipping one updates both surfaces.
  const [byFileSort, setByFileSort] = useState<FileNoSortDir>("newest");
  const [multiFileSort, setMultiFileSort] = useState<FileNoSortDir>("newest");

  // Expanded file groups in the By File view. Default is empty (every
  // group collapsed). Cookie hydration on initial mount; flipping a
  // group writes the cookie immediately so the next reload remembers.
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(
    () => new Set(initialExpandedFiles),
  );

  function toggleFileExpanded(fileNo: string) {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileNo)) next.delete(fileNo);
      else next.add(fileNo);
      // Persist immediately. Document-cookie write is fine for the
      // prototype — same surface as inbox-view-toggle uses for the
      // classic/workspace cookie. 365-day expiry mirrors pane widths.
      if (typeof document !== "undefined") {
        const value = Array.from(next).join(",");
        document.cookie = `${INBOX2_BY_FILE_EXPANDED_COOKIE}=${encodeURIComponent(
          value,
        )}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
      }
      return next;
    });
  }

  function openCompose(ctx?: ComposeContext) {
    // Default the From mailbox to whichever account is selected in the
    // top-bar dropdown — so Reply / Reply-all / Forward open with the
    // operator's active mailbox, not the global DEFAULT_FROM_MAILBOX.
    const selectedAccount = accounts.find((a) => a.id === state.accountId);

    // Auto-prepend the file number to the outbound subject when:
    //   - AI master + prependFileNoToSubject are both on
    //   - The source thread (or active file filter) has a known fileNo
    //   - The subject doesn't already carry a tag
    // See mock/inbox2.ts::prependFileNoToSubject for the no-duplicate
    // contract. AI settings live in lib/ai-settings-store.ts.
    const ai = getAiSettings();
    const sourceRow = state.selectedMessageId
      ? rows.find((r) => r.messageId === state.selectedMessageId)
      : null;
    const fileNoForOutbound =
      sourceRow?.fileNo ?? selectedFileNo ?? null;
    const shouldPrepend =
      ai.enabled &&
      ai.prependFileNoToSubject &&
      Boolean(fileNoForOutbound) &&
      ctx?.mode !== "new";
    const subject = shouldPrepend
      ? prependFileNoToSubject(fileNoForOutbound, ctx?.subject)
      : ctx?.subject;

    const merged: ComposeContext = {
      mode: ctx?.mode ?? "new",
      ...ctx,
      from: ctx?.from ?? selectedAccount?.email,
      subject,
    };
    setComposeContext(merged);
    setComposeOpen(true);
  }
  // Live team-note overrides — appended to the static fixture per threadId.
  // Composer writes here so notes appear immediately. Mentions update the
  // nav-rail Comments badge in the same render.
  const [noteOverrides, setNoteOverrides] = useState<Record<string, TeamNote[]>>({});

  // Two distinct "current user" concepts in the prototype:
  //
  // - `currentUserId` follows the top-bar account selector. Drives the
  //   Comments nav-rail badge and the Comments view filter so the
  //   operator can flip perspective ("show me Carrie's @-mentions").
  //
  // - `cfUserId` is the Cloudflare-Access signed-in user — fixed for
  //   the session. Notes the operator authors are always stamped with
  //   this identity, regardless of which mailbox is active. Mirrors
  //   PROD `getCurrentUser()` semantics.
  const currentUserId = useMemo(
    () => ACCOUNT_TO_USER_ID[state.accountId] ?? CURRENT_USER_ID,
    [state.accountId],
  );
  const cfUserId = CURRENT_USER_ID;

  const cfUser = useMemo(
    () => WORKSPACE_USERS.find((u) => u.id === cfUserId),
    [cfUserId],
  );

  const mentionables = useMemo<Mentionable[]>(() => {
    const users: Mentionable[] = WORKSPACE_USERS.filter((u) => u.status === "active").map(
      (u) => ({ kind: "user", id: u.id, label: u.name, hint: u.email }),
    );
    const teams: Mentionable[] = WORKSPACE_TEAMS.map((t) => ({
      kind: "team",
      id: t.id,
      label: t.name,
      hint: `${t.memberIds.length} member${t.memberIds.length === 1 ? "" : "s"}`,
    }));
    return [...users, ...teams];
  }, []);

  function notesForCurrentThread(threadId: string): TeamNote[] {
    return [...notesForThread(threadId), ...(noteOverrides[threadId] ?? [])];
  }

  // Combined groups list (static + operator-created). NavRail receives
  // `visibleGroups` for rendering and `allGroups` for the "..." filter
  // dropdown so hidden groups can be re-shown.
  const allGroups = useMemo(() => [...groups, ...customGroups], [
    groups,
    customGroups,
  ]);
  const visibleGroups = useMemo(
    () => allGroups.filter((g) => !hiddenGroupIds.has(g.id)),
    [allGroups, hiddenGroupIds],
  );

  function onCreateGroup() {
    // L1: prompt() is the cheapest possible name input. Replace with a
    // real dialog at L1.5 if operator wants colour / track / member
    // assignment up-front. For now, every custom group is `kind: "other"`
    // — track-typed groups (Title / Lending / etc.) are static fixtures.
    const raw =
      typeof window === "undefined" ? null : window.prompt("Custom group name");
    const name = raw?.trim();
    if (!name) return;
    const id = `grp-custom-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const next: Group = { id, name, kind: "other", memberCount: 0 };
    setCustomGroups((prev) => [...prev, next]);
    // eslint-disable-next-line no-console
    console.log("[stub-state] inbox2-shell create-group", next);
    toast.success(`Group "${name}" created`);
  }

  function onToggleGroupHidden(id: string) {
    setHiddenGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addNote(threadId: string, body: string, mentions: NoteMention[]) {
    // Author is always the CF signed-in user, NOT the account selector
    // perspective. Switching mailboxes does not impersonate the note
    // author — that always reflects who is actually typing.
    const author = cfUser;
    const note: TeamNote = {
      id: `tn_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      threadId,
      authorId: author?.id ?? cfUserId,
      authorName: author?.name ?? "You",
      body,
      mentions: mentions.length > 0 ? mentions : undefined,
      createdAt: new Date().toISOString(),
    };
    setNoteOverrides((prev) => ({
      ...prev,
      [threadId]: [...(prev[threadId] ?? []), note],
    }));
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-shell add-team-note", {
      threadId,
      body,
      mentions,
    });
    toast.success("Team note posted", {
      description:
        mentions.length > 0
          ? `Notified ${mentions.map((m) => m.label).join(", ")} (stub)`
          : body.slice(0, 80),
    });
  }

  // Comments badge — count notes mentioning the current user across all
  // threads (fixtures + live overrides). Total === urgent so the badge
  // shows in the rose tint, signalling unread mentions.
  const commentsBadge = useMemo<ViewBadge | undefined>(() => {
    let n = 0;
    for (const list of Object.values(TEAM_NOTES_BY_THREAD)) {
      for (const note of list) {
        if (note.mentions?.some((m) => m.kind === "user" && m.id === currentUserId)) n++;
      }
    }
    for (const list of Object.values(noteOverrides)) {
      for (const note of list) {
        if (note.mentions?.some((m) => m.kind === "user" && m.id === currentUserId)) n++;
      }
    }
    if (n === 0) return undefined;
    return { total: n, urgent: n };
  }, [noteOverrides, currentUserId]);

  // Thread ids that contain at least one note mentioning the current user.
  // Drives the Comments NavView row slice so that "Comments" lists every
  // thread the operator is @-tagged in, regardless of account/group scope.
  const mentionedThreadIds = useMemo<Set<string>>(() => {
    const out = new Set<string>();
    function scan(list: TeamNote[], threadId: string) {
      if (
        list.some((n) =>
          n.mentions?.some((m) => m.kind === "user" && m.id === currentUserId),
        )
      ) {
        out.add(threadId);
      }
    }
    for (const [threadId, list] of Object.entries(TEAM_NOTES_BY_THREAD)) {
      scan(list, threadId);
    }
    for (const [threadId, list] of Object.entries(noteOverrides)) {
      scan(list, threadId);
    }
    return out;
  }, [noteOverrides, currentUserId]);

  function patch(partial: Partial<Inbox2ShellState>) {
    setState((s) => ({ ...s, ...partial }));
  }

  // Apply row-level mark-read / mark-unread overrides written by the
  // right-click context menu. All downstream derivations (badges, list,
  // matchCount, selectedRow) flow through this so a single toggle updates
  // every consumer in one render.
  const applyOverrides = useCallback(
    (input: InboxRow[]): InboxRow[] => {
      const ov = state.unreadOverrides;
      if (Object.keys(ov).length === 0) return input;
      return input.map((r) =>
        r.messageId in ov ? { ...r, isUnread: ov[r.messageId] } : r,
      );
    },
    [state.unreadOverrides],
  );

  function onToggleUnread(messageId: string, nextUnread: boolean) {
    // eslint-disable-next-line no-console
    console.log("[stub-state] inbox2-shell toggle-unread", {
      messageId,
      nextUnread,
    });
    setState((s) => ({
      ...s,
      unreadOverrides: { ...s.unreadOverrides, [messageId]: nextUnread },
    }));
  }

  /**
   * Add a single assignee to a row (idempotent). Pass null to clear all
   * assignees for the row (the context-menu "Unassign" affordance).
   */
  function onAssign(messageId: string, assigneeId: string | null) {
    // eslint-disable-next-line no-console
    console.log("[stub-state] inbox2-shell assign", { messageId, assigneeId });
    setState((s) => {
      if (assigneeId === null) {
        const next = { ...s.assigneeOverrides };
        delete next[messageId];
        return { ...s, assigneeOverrides: next };
      }
      const current = s.assigneeOverrides[messageId] ?? [];
      if (current.includes(assigneeId)) return s;
      return {
        ...s,
        assigneeOverrides: {
          ...s.assigneeOverrides,
          [messageId]: [...current, assigneeId],
        },
      };
    });
  }

  // Effective row slice for the current NavView + account + group + active
  // top-bar filters, with overrides applied. Single source list passed to
  // the message list and used for matchCount.
  const currentTabRows = useMemo<InboxRow[]>(() => {
    if (state.navView === "comments") {
      // Comments view = every thread the current user is @-mentioned in.
      // Cross-account + cross-group on purpose: a mention is a personal
      // signal, not a mailbox-scoped one.
      const base = rowsForTab("all").filter((r) => mentionedThreadIds.has(r.threadId));
      // Dedupe on threadId — a thread can have several rows in the inbox
      // tab but the Comments list should show each thread once.
      const seen = new Set<string>();
      const deduped: InboxRow[] = [];
      for (const r of base) {
        if (seen.has(r.threadId)) continue;
        seen.add(r.threadId);
        deduped.push(r);
      }
      const overridden = applyOverrides(deduped);
      const filtered = applyFilters(overridden, state.filters);
      return applySearch(filtered, searchQuery, notesForCurrentThread);
    }
    const tab = NAV_VIEW_TO_INBOX_TAB[state.navView];
    if (!tab) return [];
    // FILES section views (by-file / multi-file / unassigned) are triage
    // queues — global on purpose. Skipping the account+group scope means
    // the operator sees every candidate file, not just rows in their
    // active mailbox/group. Standard nav views (inbox / spam) keep the
    // scope so the rail's selected mailbox/group still drives the list.
    const isFilesView = (FILES_NAV_VIEWS as readonly NavView[]).includes(
      state.navView,
    );
    let base = isFilesView
      ? rowsForTab(tab)
      : rowsForTab(tab).filter(
          (r) => r.accountId === state.accountId && r.groupId === state.groupId,
        );
    // FILES dropdowns: when a specific file number is selected under
    // "By File" or "Multi-File", narrow to rows touching that file.
    //   - by-file: row.fileNo must match.
    //   - multi-file: any candidate.fileNo must match (or row.fileNo).
    if (isFilesView && selectedFileNo) {
      if (state.navView === "files-by-file") {
        base = base.filter((r) => r.fileNo === selectedFileNo);
      } else if (state.navView === "files-multi") {
        base = base.filter(
          (r) =>
            r.fileNo === selectedFileNo ||
            r.candidates?.some((c) => c.fileNo === selectedFileNo),
        );
      }
    }
    const overridden = applyOverrides(base);
    const filtered = applyFilters(overridden, state.filters);
    return applySearch(filtered, searchQuery, notesForCurrentThread);
  }, [
    state.navView,
    state.accountId,
    state.groupId,
    state.filters,
    applyOverrides,
    mentionedThreadIds,
    searchQuery,
    noteOverrides,
    selectedFileNo,
  ]);

  const matchCount = currentTabRows.length;

  const selectedRow = useMemo(
    () =>
      state.selectedMessageId
        ? applyOverrides(rows).find(
            (r) => r.messageId === state.selectedMessageId,
          ) ?? null
        : null,
    [rows, state.selectedMessageId, applyOverrides],
  );

  // Live badges. Only the `inbox` and `spam` nav views map to mock data
  // today; other views show no badge (Phase 2+ will populate). Slices
  // run through applyOverrides so toggling unread instantly reflects.
  const navViewBadges = useMemo<Partial<Record<NavView, ViewBadge>>>(() => {
    const inboxRows = applyOverrides(rowsForTab("all")).filter(
      (r) => r.accountId === state.accountId && r.groupId === state.groupId,
    );
    const spamRows = applyOverrides(rowsForTab("spam")).filter(
      (r) => r.accountId === state.accountId && r.groupId === state.groupId,
    );
    // FILES badges are global (cross-account / cross-group) to match the
    // currentTabRows derivation above. Triage queues should reflect the
    // total work waiting, not just the selected mailbox's slice.
    const byFileRows = applyOverrides(rowsForTab("by-file"));
    const multiFileRows = applyOverrides(rowsForTab("multi-file"));
    const unassignedRows = applyOverrides(rowsForTab("unassigned"));
    return {
      inbox: badgeFromRows(inboxRows),
      spam: badgeFromRows(spamRows),
      comments: commentsBadge,
      "files-by-file": badgeFromRows(byFileRows),
      "files-multi": badgeFromRows(multiFileRows),
      "files-unassigned": badgeFromRows(unassignedRows),
    };
  }, [state.accountId, state.groupId, applyOverrides, commentsBadge]);

  // Per-group badge: unread inbox rows in the current account, scoped to
  // each group. Switching account updates all group counts. Custom
  // (operator-created) groups have no rows in L1 fixtures, so their
  // badges stay empty — no special-case needed.
  const groupBadges = useMemo<Partial<Record<Group["id"], ViewBadge>>>(() => {
    const accountRows = applyOverrides(rowsForTab("all")).filter(
      (r) => r.accountId === state.accountId,
    );
    const out: Partial<Record<Group["id"], ViewBadge>> = {};
    for (const g of allGroups) {
      const slice = accountRows.filter((r) => r.groupId === g.id);
      const badge = badgeFromRows(slice);
      if (badge) out[g.id] = badge;
    }
    return out;
  }, [allGroups, state.accountId, applyOverrides]);


  function onSelect(messageId: string) {
    // eslint-disable-next-line no-console
    console.log("[stub] inbox2-message-row select", { messageId });
    // Opening the preview pane marks the row as read — matches every
    // mainstream email client. Stored as an override so the context-menu
    // "Mark as unread" affordance can flip it back if the operator
    // wants to defer action.
    setState((s) => ({
      ...s,
      selectedMessageId: messageId,
      unreadOverrides: { ...s.unreadOverrides, [messageId]: false },
    }));
  }

  function onPreviewClose() {
    patch({ selectedMessageId: null });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.25rem)] bg-background">
      <Inbox2TopBar
        accounts={accounts}
        accountId={state.accountId}
        onAccountChange={(id) => {
          // Account switch is a "go home" gesture — drop any FILES
          // filter so the operator lands in the new mailbox's inbox
          // instead of an empty FILES view.
          if ((FILES_NAV_VIEWS as readonly NavView[]).includes(state.navView)) {
            setSelectedFileNo(null);
          }
          setState((s) => ({
            ...s,
            accountId: id,
            navView: (FILES_NAV_VIEWS as readonly NavView[]).includes(s.navView)
              ? "inbox"
              : s.navView,
            selectedMessageId: null,
          }));
        }}
        filters={state.filters}
        onFiltersChange={(next) => patch({ filters: next, selectedMessageId: null })}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <Inbox2ResizableBody
        initialLeftW={initialLeftW}
        initialCenterW={initialCenterW}
        left={
          <Inbox2NavRail
            navView={state.navView}
            onChange={(v) => {
              // Drop any FILES file-number filter on every nav-view
              // switch. selectedFileNo is sub-state of one specific
              // FILES view; carrying it across (e.g. By File →
              // Unassigned with FL-2026-001 still selected) would
              // narrow the new view's rows to zero and look broken.
              // The file-click path re-sets selectedFileNo after this
              // handler in the same render (React batches), so
              // clicking a file under By File still works.
              setSelectedFileNo(null);
              setState((s) => ({
                ...s,
                navView: v,
                // Re-clicking Inbox while a Custom Group is active should
                // restore the unfiltered Inbox view. Resetting to the
                // default group keeps the initial-load result (matches
                // operator's mental "back to home" expectation).
                groupId: v === "inbox" ? DEFAULT_GROUP_ID : s.groupId,
                selectedMessageId: null,
              }));
            }}
            badges={navViewBadges}
            groups={visibleGroups}
            allGroups={allGroups}
            hiddenGroupIds={hiddenGroupIds}
            onCreateGroup={onCreateGroup}
            onToggleGroupHidden={onToggleGroupHidden}
            groupId={state.groupId}
            onGroupChange={(id) => {
              // Custom-group click belongs to the Inbox view conceptually
              // (groups scope inbox rows). If the operator is on a FILES
              // view and clicks a group, jump back to Inbox with that
              // group active and clear any file filter — otherwise the
              // group click looks broken (no emails load).
              const inFilesView = (
                FILES_NAV_VIEWS as readonly NavView[]
              ).includes(state.navView);
              if (inFilesView) setSelectedFileNo(null);
              setState((s) => ({
                ...s,
                groupId: id,
                navView: (FILES_NAV_VIEWS as readonly NavView[]).includes(s.navView)
                  ? "inbox"
                  : s.navView,
                selectedMessageId: null,
              }));
            }}
            groupBadges={groupBadges}
            onOpenSettings={() => setSettingsOpen(true)}
            selectedFileNo={selectedFileNo}
            onFileNoChange={(next) => {
              setSelectedFileNo(next);
              patch({ selectedMessageId: null });
            }}
            byFileSort={byFileSort}
            onByFileSortChange={setByFileSort}
            multiFileSort={multiFileSort}
            onMultiFileSortChange={setMultiFileSort}
          />
        }
        center={
          <>
            <Inbox2SubHeader
              navView={state.navView}
              matchCount={matchCount}
              groupName={
                allGroups.find((g) => g.id === state.groupId)?.name ?? null
              }
              selectedFileNo={selectedFileNo}
            />
            <div className="flex-1 min-h-0 overflow-hidden">
              <Inbox2MessageList
                navView={state.navView}
                rows={currentTabRows}
                selectedMessageId={state.selectedMessageId}
                onSelect={onSelect}
                onToggleUnread={onToggleUnread}
                onAssign={onAssign}
                assigneeOverrides={state.assigneeOverrides}
                selectedFileNo={selectedFileNo}
                byFileSort={byFileSort}
                onByFileSortChange={setByFileSort}
                expandedFiles={expandedFiles}
                onToggleFileExpanded={toggleFileExpanded}
              />
            </div>
          </>
        }
        right={
          <Inbox2PreviewPane
            row={selectedRow}
            onClose={onPreviewClose}
            notes={selectedRow ? notesForCurrentThread(selectedRow.threadId) : []}
            onAddNote={(body, mentions) => {
              if (!selectedRow) return;
              addNote(selectedRow.threadId, body, mentions);
            }}
            mentionables={mentionables}
            onCompose={openCompose}
            assigneeIds={
              selectedRow
                ? state.assigneeOverrides[selectedRow.messageId] ?? []
                : []
            }
          />
        }
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <InboxComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultMailbox={DEFAULT_FROM_MAILBOX}
        context={composeContext}
      />
    </div>
  );
}
