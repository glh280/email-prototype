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
import { EMPTY_INBOX_FILTERS } from "@/mock/types";
import { rowsForTab } from "@/mock/inbox";
import { CURRENT_USER_ID, NAV_VIEW_TO_INBOX_TAB } from "@/mock/inbox2";
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
}: Props) {
  const [state, setState] = useState<Inbox2ShellState>({
    accountId: defaultAccountId,
    groupId: defaultGroupId,
    navView: defaultNavView,
    selectedMessageId: null,
    unreadOverrides: {},
    filters: EMPTY_INBOX_FILTERS,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeContext, setComposeContext] = useState<ComposeContext | undefined>(
    undefined,
  );

  function openCompose(ctx?: ComposeContext) {
    setComposeContext(ctx);
    setComposeOpen(true);
  }
  // Live team-note overrides — appended to the static fixture per threadId.
  // Composer writes here so notes appear immediately. Mentions update the
  // nav-rail Comments badge in the same render.
  const [noteOverrides, setNoteOverrides] = useState<Record<string, TeamNote[]>>({});

  const currentUser = useMemo(
    () => WORKSPACE_USERS.find((u) => u.id === CURRENT_USER_ID),
    [],
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

  function addNote(threadId: string, body: string, mentions: NoteMention[]) {
    const author = currentUser;
    const note: TeamNote = {
      id: `tn_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      threadId,
      authorId: author?.id ?? CURRENT_USER_ID,
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
        if (note.mentions?.some((m) => m.kind === "user" && m.id === CURRENT_USER_ID)) n++;
      }
    }
    for (const list of Object.values(noteOverrides)) {
      for (const note of list) {
        if (note.mentions?.some((m) => m.kind === "user" && m.id === CURRENT_USER_ID)) n++;
      }
    }
    if (n === 0) return undefined;
    return { total: n, urgent: n };
  }, [noteOverrides]);

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

  // Effective row slice for the current NavView + account + group + active
  // top-bar filters, with overrides applied. Single source list passed to
  // the message list and used for matchCount.
  const currentTabRows = useMemo<InboxRow[]>(() => {
    const tab = NAV_VIEW_TO_INBOX_TAB[state.navView];
    if (!tab) return [];
    const base = rowsForTab(tab).filter(
      (r) => r.accountId === state.accountId && r.groupId === state.groupId,
    );
    const overridden = applyOverrides(base);
    return applyFilters(overridden, state.filters);
  }, [state.navView, state.accountId, state.groupId, state.filters, applyOverrides]);

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
    return {
      inbox: badgeFromRows(inboxRows),
      spam: badgeFromRows(spamRows),
      comments: commentsBadge,
    };
  }, [state.accountId, state.groupId, applyOverrides, commentsBadge]);

  // Per-group badge: unread inbox rows in the current account, scoped to
  // each group. Switching account updates all group counts.
  const groupBadges = useMemo<Partial<Record<Group["id"], ViewBadge>>>(() => {
    const accountRows = applyOverrides(rowsForTab("all")).filter(
      (r) => r.accountId === state.accountId,
    );
    const out: Partial<Record<Group["id"], ViewBadge>> = {};
    for (const g of groups) {
      const slice = accountRows.filter((r) => r.groupId === g.id);
      const badge = badgeFromRows(slice);
      if (badge) out[g.id] = badge;
    }
    return out;
  }, [groups, state.accountId, applyOverrides]);


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
        onAccountChange={(id) => patch({ accountId: id, selectedMessageId: null })}
        filters={state.filters}
        onFiltersChange={(next) => patch({ filters: next, selectedMessageId: null })}
      />
      <Inbox2ResizableBody
        initialLeftW={initialLeftW}
        initialCenterW={initialCenterW}
        left={
          <Inbox2NavRail
            navView={state.navView}
            onChange={(v) => patch({ navView: v, selectedMessageId: null })}
            badges={navViewBadges}
            groups={groups}
            groupId={state.groupId}
            onGroupChange={(id) => patch({ groupId: id, selectedMessageId: null })}
            groupBadges={groupBadges}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        }
        center={
          <>
            <Inbox2SubHeader
              navView={state.navView}
              matchCount={matchCount}
              groupName={
                groups.find((g) => g.id === state.groupId)?.name ?? null
              }
            />
            <div className="flex-1 min-h-0 overflow-hidden">
              <Inbox2MessageList
                navView={state.navView}
                rows={currentTabRows}
                selectedMessageId={state.selectedMessageId}
                onSelect={onSelect}
                onToggleUnread={onToggleUnread}
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
