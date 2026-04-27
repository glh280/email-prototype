import Link from "next/link";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { ContactListRow } from "@/lib/contacts-query";
import { relativeTime } from "@/lib/format";

/**
 * Phase 3 Plan 05 Task 2 — /contacts table.
 *
 * Columns: Name, Email, Org, Role hint, Active deals, Added.
 *
 * Row click: the Name cell is a <Link> to `/contacts/[id]`. Full-row anchor
 * wrapping would nest <a> inside <tr> (invalid HTML); programmatic onClick
 * would force `"use client"` on the whole table. Name-only link is simplest
 * and still keeps cmd-click/middle-click working natively. If Carrie wants
 * full-row click later, flip to a client component with onClick on TableRow.
 *
 * activeDealsCount comes from the CTE in lib/contacts-query.ts
 * (MAX(audit_log.created_at) equivalent for per-contact active-deal joins).
 */
export function ContactsTable({ contacts }: { contacts: ContactListRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            Name
          </TableHead>
          <TableHead className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            Email
          </TableHead>
          <TableHead className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            Org
          </TableHead>
          <TableHead className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            Role hint
          </TableHead>
          <TableHead className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground text-right">
            Active deals
          </TableHead>
          <TableHead className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            Added
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map((c) => (
          <TableRow key={c.id}>
            <TableCell>
              <Link
                href={`/contacts/${c.id}`}
                className="font-medium hover:underline"
              >
                {c.fullName}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {c.email ?? "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {c.org ?? "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {c.roleHint ?? "—"}
            </TableCell>
            <TableCell className="text-right">
              {c.activeDealsCount === 0 ? (
                <span className="text-muted-foreground">0</span>
              ) : (
                <span className="font-medium">{c.activeDealsCount}</span>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {relativeTime(c.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
