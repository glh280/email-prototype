"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { OverviewTab } from "./overview-tab";
import { TasksTab } from "./tasks-tab";
import { NotesTab } from "./notes-tab";
import { AuditTab } from "./audit-tab";
import { PeopleTab } from "./people-tab";
import type { DealDetail } from "@/lib/deals-query";
import type { TaskListRow } from "@/lib/tasks-query";
import type { UserOption } from "@/lib/users-query";
import type { NoteListRow } from "@/lib/notes-query";
import type { AuditFilter, AuditRow } from "@/lib/audit-query";
import type { DealPersonRow } from "@/lib/deal-people-query";

/**
 * Phase 2 Plan 05/06 — Deal detail tabs shell (UI-SPEC lines 223-237).
 *
 * Six tabs in VIEW-05 order:
 *   1. Overview (default) — real edit form (Plan 05)
 *   2. File Contacts — placeholder, P3 ships content
 *   3. Tasks — real content (Plan 06 — is_next accent bar, undo toast)
 *   4. Emails — placeholder, P4 ships content
 *   5. Notes — real content (Plan 06 — composer + chronological log)
 *   6. Audit — real content (Plan 06 — reverse-chron + 5 filter chips)
 *
 * URL state: `?tab=<slug>&auditFilter=<key>` — changing tabs/filters calls
 * router.push with the new query string. Mirrors the list view's URL-state
 * convention (lib/filter-params). Server Component re-runs queryAuditForDeal
 * when auditFilter changes so the filter is authoritatively applied at DB
 * layer, not in-memory.
 */

const TAB_VALUES = [
  "overview",
  "contacts",
  "tasks",
  "emails",
  "notes",
  "audit",
] as const;

type TabValue = (typeof TAB_VALUES)[number];

export function DealTabs(props: {
  deal: DealDetail;
  activeTab: string;
  tasks: { open: TaskListRow[]; done: TaskListRow[] };
  users: UserOption[];
  notes: NoteListRow[];
  auditRows: AuditRow[];
  auditFilter: AuditFilter;
  dealPeople: DealPersonRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const active: TabValue = (TAB_VALUES as readonly string[]).includes(
    props.activeTab,
  )
    ? (props.activeTab as TabValue)
    : "overview";

  const onValueChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "?");
  };

  return (
    <div className="mt-6">
      <Tabs value={active} onValueChange={onValueChange}>
        <TabsList variant="line" className="border-b w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">File Contacts</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-6">
          <OverviewTab deal={props.deal} />
        </TabsContent>

        <TabsContent value="contacts" className="pt-6">
          <PeopleTab deal={props.deal} dealPeople={props.dealPeople} />
        </TabsContent>

        <TabsContent value="tasks" className="pt-6">
          <TasksTab
            deal={props.deal}
            initialTasks={props.tasks}
            users={props.users}
          />
        </TabsContent>

        <TabsContent value="emails" className="pt-6">
          <PlaceholderPanel
            icon={<Mail className="h-12 w-12 text-muted-foreground" />}
            heading="Emails arrive in Phase 4"
            body="Gmail threads linked to this file will appear here."
          />
        </TabsContent>

        <TabsContent value="notes" className="pt-6">
          <NotesTab deal={props.deal} notes={props.notes} />
        </TabsContent>

        <TabsContent value="audit" className="pt-6">
          <AuditTab
            rows={props.auditRows}
            currentFilter={props.auditFilter}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlaceholderPanel(props: {
  icon: React.ReactNode;
  heading: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      {props.icon}
      <h2 className="mt-6 text-[28px] font-semibold leading-[1.2]">
        {props.heading}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{props.body}</p>
    </div>
  );
}
