"use client";

import { useMemo, useRef, useState } from "react";
import type { EmailThread, EmailMessage, LinkedEmail } from "@/mock/types";
import { relativeTime } from "@/mock/helpers";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

/**
 * Gmail-style collapsed thread list with search.
 *
 * - All threads collapsed by default. Click a thread to expand inline.
 * - Search box filters by subject, sender, or snippet.
 * - Hovering a message pops a preview card with the full body.
 *   Leaving the preview closes it automatically.
 */
export function EmailThreads({
  threads = [],
  legacyEmails = [],
}: {
  threads?: EmailThread[];
  legacyEmails?: LinkedEmail[];
}) {
  const [search, setSearch] = useState("");

  const merged: EmailThread[] = useMemo(
    () => [
      ...threads,
      ...legacyEmails.map(
        (e): EmailThread => ({
          id: e.id,
          subject: e.subject,
          messages: [{ id: e.id + "_m", fromName: e.fromName, sentAt: e.receivedAt, snippet: "" }],
        }),
      ),
    ],
    [threads, legacyEmails],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter((t) => {
      if (t.subject.toLowerCase().includes(q)) return true;
      return t.messages.some(
        (m) =>
          m.fromName.toLowerCase().includes(q) ||
          (m.snippet && m.snippet.toLowerCase().includes(q)) ||
          (m.body && m.body.toLowerCase().includes(q)),
      );
    });
  }, [merged, search]);

  if (merged.length === 0) return null;

  const sorted = [...filtered].sort((a, b) => {
    const lastA = lastActivity(a);
    const lastB = lastActivity(b);
    return lastA < lastB ? 1 : -1;
  });

  return (
    <div>
      <div className="px-4 py-2 border-b">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subject, sender, body…"
          className="h-8 text-xs"
        />
      </div>
      {sorted.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No threads match "{search}".</div>
      ) : (
        <ul className="divide-y">
          {sorted.map((t) => (
            <ThreadRow key={t.id} thread={t} query={search} />
          ))}
        </ul>
      )}
    </div>
  );
}

function lastActivity(thread: EmailThread): string {
  if (thread.messages.length === 0) return "";
  return thread.messages.reduce((max, m) => (m.sentAt > max ? m.sentAt : max), thread.messages[0].sentAt);
}

function participantCount(thread: EmailThread): number {
  const names = new Set<string>();
  for (const m of thread.messages) {
    names.add(m.fromName);
    m.toNames?.forEach((n) => names.add(n));
  }
  return names.size;
}

function ThreadRow({ thread, query }: { thread: EmailThread; query: string }) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const sortedMessages = [...thread.messages].sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
  const msgCount = sortedMessages.length;
  const last = sortedMessages[0];
  const participants = participantCount(thread);

  const visibleMessages = showAll ? sortedMessages : sortedMessages.slice(0, 3);
  const hiddenCount = sortedMessages.length - visibleMessages.length;

  const gmailThreadUrl = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(thread.subject)}`;

  return (
    <li>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-muted/40 transition-colors"
      >
        <span className={`text-muted-foreground pt-0.5 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden="true">
          ▸
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium text-sm truncate block">{thread.subject}</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap mt-0.5">
            <span>✍ {participants} {participants === 1 ? "person" : "people"}</span>
            <span>·</span>
            <span>{msgCount} {msgCount === 1 ? "msg" : "msgs"}</span>
            <span>·</span>
            <span>{relativeTime(last.sentAt)}</span>
            <span className="truncate block w-full mt-0.5 text-muted-foreground/80">
              Latest: <span className="font-medium text-foreground/70">{last.fromName}</span>
              {last.snippet ? ` — ${last.snippet}` : ""}
            </span>
          </span>
        </span>
        <a
          href={gmailThreadUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-medium px-2 py-1 rounded border hover:bg-background transition-colors shrink-0"
          title="Open thread in Gmail"
        >
          Gmail ↗
        </a>
      </button>

      {expanded && (
        <div className="pl-8 pr-4 pb-3 bg-muted/20 border-t space-y-2">
          {visibleMessages.map((m) => (
            <MessageRow key={m.id} message={m} threadSubject={thread.subject} query={query} />
          ))}
          {hiddenCount > 0 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
            >
              Show {hiddenCount} earlier {hiddenCount === 1 ? "message" : "messages"}
            </button>
          )}
          {showAll && sortedMessages.length > 3 && (
            <button
              onClick={() => setShowAll(false)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
            >
              Collapse to 3 most recent
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function MessageRow({
  message,
  threadSubject,
  query,
}: {
  message: EmailMessage;
  threadSubject: string;
  query: string;
}) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }
  function schedule() {
    clearTimer();
    closeTimerRef.current = setTimeout(() => {
      setHoverOpen(false);
      closeTimerRef.current = null;
    }, 120);
  }

  const gmailMsgUrl = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(threadSubject)}+from%3A${encodeURIComponent(message.fromName)}`;

  // Highlight matches of the current query in snippet
  const snippet = message.snippet || message.body?.split("\n")[0] || "(no content)";

  return (
    <Popover open={hoverOpen} onOpenChange={setHoverOpen}>
      <PopoverTrigger
        render={
          <div
            className="bg-background rounded border p-2.5 cursor-default"
            onMouseEnter={() => {
              clearTimer();
              setHoverOpen(true);
            }}
            onMouseLeave={schedule}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs">
                  <span className="font-medium">{message.fromName}</span>
                  {message.toNames && message.toNames.length > 0 && (
                    <span className="text-muted-foreground"> → {message.toNames.join(", ")}</span>
                  )}
                  <span className="text-muted-foreground"> · {relativeTime(message.sentAt)}</span>
                </div>
                <div className="text-sm mt-0.5 text-muted-foreground line-clamp-2">
                  <Highlight text={snippet} query={query} />
                </div>
              </div>
              <a
                href={gmailMsgUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-medium px-2 py-0.5 rounded border hover:bg-muted transition-colors shrink-0"
                title="Open this message in Gmail"
              >
                Gmail ↗
              </a>
            </div>
          </div>
        }
      />
      <PopoverContent
        className="w-[480px] max-h-[50vh] overflow-y-auto p-3"
        onMouseEnter={clearTimer}
        onMouseLeave={schedule}
        side="top"
        align="start"
      >
        <div className="text-xs text-muted-foreground mb-2">
          <span className="font-semibold text-foreground">{message.fromName}</span>
          {message.toNames && message.toNames.length > 0 && <span> → {message.toNames.join(", ")}</span>}
          <span> · {new Date(message.sentAt).toLocaleString()}</span>
        </div>
        <div className="text-sm whitespace-pre-wrap font-sans">
          {message.body ?? message.snippet ?? "(no content)"}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-200 text-foreground rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}
