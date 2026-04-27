"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MiniStageBar } from "@/components/mini-stage-bar";
import { NotesPopupButton } from "@/components/notes-popup";
import { PeoplePicker } from "@/components/people-picker";
import { RefreshButton } from "@/components/refresh-button";
import { ContactHoverCard } from "@/components/contact-hover-card";
import { CalendarButton } from "@/components/calendar-popup";
import { StageDropdown } from "@/components/stage-dropdown";
import type { Deal, Track, StageKey } from "@/mock/types";
import { TRACK_LABEL, TRACK_COLOR, PRIORITY_LABEL, PRIORITY_COLOR } from "@/mock/types";
import { stageLabel, relativeTime } from "@/mock/helpers";

const TRACKS: (Track | "ALL")[] = ["ALL", "TI", "LN", "DD", "CS", "PT"];

export function DealsView({ deals: initialDeals }: { deals: Deal[] }) {
  // Local mutable copy so stage + owners edits persist in-session
  const [deals, setDeals] = useState<Deal[]>(initialDeals);

  const [track, setTrack] = useState<Track | "ALL">("ALL");
  const [peopleFilter, setPeopleFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateDeal(id: string, mut: (d: Deal) => Deal) {
    setDeals((prev) => prev.map((d) => (d.id === id ? mut(d) : d)));
  }

  function changeStage(id: string, next: StageKey) {
    updateDeal(id, (d) => ({ ...d, stage: next, lastActivityAt: new Date().toISOString() }));
    toast.success(`Stage updated to "${stageLabel(next)}"`, { description: "Simulated." });
  }

  function changeOwners(id: string, owners: string[]) {
    updateDeal(id, (d) => ({
      ...d,
      internalOwners: owners as Deal["internalOwners"],
      lastActivityAt: new Date().toISOString(),
    }));
    toast.success("Owners updated (simulated)");
  }

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (track !== "ALL" && d.track !== track) return false;
      if (peopleFilter.length > 0) {
        const dealOwners = d.internalOwners ?? [];
        const nextTask = d.tasks.find((t) => t.isNext);
        const taskOwners = nextTask?.owners ?? [];
        const hit = peopleFilter.some((p) => dealOwners.includes(p as never) || taskOwners.includes(p));
        if (!hit) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = [
          d.title,
          d.propertyAddress ?? "",
          ...d.people.map((p) => p.contact.fullName + " " + (p.contact.org ?? "")),
          ...d.tasks.map((t) => t.title),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [deals, track, peopleFilter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your deals</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {deals.length} active · Mock data only</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarButton />
          <NotesPopupButton />
          <RefreshButton />
          <Button disabled className="gap-2" title="Prototype — creating deals is simulated in Phase 1">
            + New Deal
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            {TRACKS.map((t) => {
              const active = track === t;
              const isAll = t === "ALL";
              return (
                <button
                  key={t}
                  onClick={() => setTrack(t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors font-medium ${
                    active
                      ? isAll
                        ? "bg-foreground text-background border-foreground"
                        : `${TRACK_COLOR[t as Track]} border-transparent ring-2 ring-offset-1 ring-current/20`
                      : isAll
                        ? "bg-background text-muted-foreground border-border hover:bg-muted"
                        : `${TRACK_COLOR[t as Track]} border-transparent opacity-70 hover:opacity-100`
                  }`}
                >
                  {isAll ? "All" : TRACK_LABEL[t as Track]}
                </button>
              );
            })}
          </div>
          <div className="h-5 w-px bg-border mx-1" />
          <PeoplePicker
            value={peopleFilter}
            onChange={setPeopleFilter}
            triggerLabel="Filter by person"
            triggerActiveLabel={(sel) => (sel.length === 1 ? sel[0] : `${sel.length} people`)}
          />
          <div className="flex-1" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals, people, tasks…"
            className="max-w-xs"
          />
        </div>
      </Card>

      {/* Column headers */}
      <div className="grid grid-cols-[24px_110px_100px_1fr_200px_1.4fr_200px_80px] gap-3 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        <span></span>
        <span>Track</span>
        <span>Priority</span>
        <span>Deal</span>
        <span>Stage</span>
        <span>Progress / Next task</span>
        <span>Task owner · Due</span>
        <span className="text-right">Activity</span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          No deals match the current filters.
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden">
          {filtered.map((d) => (
            <DealRow
              key={d.id}
              deal={d}
              expanded={expandedIds.has(d.id)}
              onToggle={() => toggleExpanded(d.id)}
              onChangeStage={(s) => changeStage(d.id, s)}
              onChangeOwners={(o) => changeOwners(d.id, o)}
            />
          ))}
        </Card>
      )}
    </div>
  );
}

function DealRow({
  deal,
  expanded,
  onToggle,
  onChangeStage,
  onChangeOwners,
}: {
  deal: Deal;
  expanded: boolean;
  onToggle: () => void;
  onChangeStage: (s: StageKey) => void;
  onChangeOwners: (owners: string[]) => void;
}) {
  const nextTask = deal.tasks.find((t) => t.isNext);

  return (
    <div className="group">
      {/* Main row */}
      <div className="grid grid-cols-[24px_110px_100px_1fr_200px_1.4fr_200px_80px] gap-3 px-3 py-2.5 items-center">
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground flex items-center justify-center h-6 w-6 rounded hover:bg-muted"
          title={expanded ? "Collapse" : "Expand"}
          aria-label={expanded ? "Collapse row" : "Expand row"}
        >
          <span className={`inline-block transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
        </button>

        <Badge
          variant="secondary"
          className={`${TRACK_COLOR[deal.track]} border-0 text-[10px] font-semibold tracking-wide justify-self-start`}
        >
          {TRACK_LABEL[deal.track]}
        </Badge>

        <Badge
          variant="secondary"
          className={`${PRIORITY_COLOR[deal.priority]} border-0 text-[10px] font-semibold tracking-wide justify-self-start`}
        >
          {PRIORITY_LABEL[deal.priority]}
        </Badge>

        <Link href={`/deal/${deal.id}`} className="min-w-0 block hover:underline">
          <div className="font-medium truncate">{deal.propertyAddress ?? deal.title}</div>
          <div className="text-xs text-muted-foreground truncate">
            Owners: {deal.internalOwners.join(", ") || "—"}
          </div>
        </Link>

        {/* Inline stage dropdown on main row */}
        <div onClick={(e) => e.stopPropagation()}>
          <StageDropdown value={deal.stage} onChange={onChangeStage} className="h-8 text-xs" />
        </div>

        <div className="min-w-0">
          <MiniStageBar current={deal.stage} />
          <div className="text-xs text-muted-foreground mt-1 truncate">
            {nextTask ? nextTask.title : "(no next task)"}
          </div>
        </div>

        <div className="text-xs min-w-0">
          <div className="truncate font-medium">{nextTask ? nextTask.owners.join(", ") : "—"}</div>
          <div className="text-muted-foreground truncate">
            {nextTask?.dueAt ? `Due ${relativeTime(nextTask.dueAt)}` : "No due date"}
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-right whitespace-nowrap">
          {relativeTime(deal.lastActivityAt)}
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-muted/30 border-t">
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">People on file</div>
              <ul className="space-y-1">
                {deal.people.map((p) => (
                  <li key={p.roleSlot} className="truncate">
                    <span className="text-muted-foreground">
                      {p.roleSlot.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")}:
                    </span>{" "}
                    <ContactHoverCard contact={p.contact} deal={deal}>
                      {p.contact.fullName}
                    </ContactHoverCard>
                    {p.contact.org && <span className="text-muted-foreground"> · {p.contact.org}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Tasks ({deal.tasks.filter((t) => t.status === "open").length} open)
              </div>
              <ul className="space-y-1">
                {deal.tasks.slice(0, 5).map((t) => (
                  <li key={t.id} className={t.status === "done" ? "line-through text-muted-foreground" : ""}>
                    <span className={t.isNext ? "font-medium" : ""}>{t.title}</span>
                    <span className="text-muted-foreground"> → {t.owners.join(", ")}</span>
                    {t.dueAt && <span className="text-muted-foreground"> · {relativeTime(t.dueAt)}</span>}
                  </li>
                ))}
                {deal.tasks.length > 5 && (
                  <li className="text-xs text-muted-foreground">+ {deal.tasks.length - 5} more</li>
                )}
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Deal owners</div>
              <div className="mb-2">
                <PeoplePicker
                  value={deal.internalOwners as string[]}
                  onChange={onChangeOwners}
                  triggerLabel="Assign owners"
                  triggerActiveLabel={(sel) => sel.join(", ")}
                />
              </div>
              {deal.propertyAddress && (
                <>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Property</div>
                  <div className="text-sm mb-3">{deal.propertyAddress}</div>
                </>
              )}
              <Link
                href={`/deal/${deal.id}`}
                className="inline-block text-xs font-medium px-3 py-1.5 rounded border hover:bg-background transition-colors"
              >
                Open file →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
