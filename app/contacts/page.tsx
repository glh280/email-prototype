import Link from "next/link";
import { Users, Search } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { CONTACTS, type Contact } from "@/mock/contacts";

/**
 * SOURCE: NPR_Dashboard@a7a31d9b — app/(authenticated)/contacts/page.tsx
 * COPIED: 2026-04-28
 * STATUS: modified — DB-backed `queryContactsForList` swapped for the
 *   mock `CONTACTS` fixture (`mock/contacts.ts`). The standalone L1
 *   prototype has no Postgres, so the original Drizzle path 500'd.
 * REINTEGRATION: restore the original query path; delete `mock/contacts.ts`.
 *
 * URL-state: `?q=<query>` — case-insensitive substring across
 * fullName / email / org. Server-rendered list (no client filtering).
 */
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawQ = sp.q;
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ)?.trim().toLowerCase() ?? "";
  const filtered = q.length === 0 ? CONTACTS : filterContacts(CONTACTS, q);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Contacts</h1>
          <span className="text-xs text-muted-foreground">
            {CONTACTS.length} total · {countBySource(CONTACTS, "workspace")} workspace ·{" "}
            {countBySource(CONTACTS, "email")} from email ·{" "}
            {countBySource(CONTACTS, "base")} base
          </span>
        </div>

        <form className="mt-4">
          <div className="relative max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search name, email, or organization…"
              className="w-full h-9 pl-9 pr-3 rounded-md border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </form>

        <div className="mt-4 rounded-lg border bg-background overflow-hidden">
          {filtered.length === 0 ? (
            q ? (
              <EmptySearch q={q} />
            ) : (
              <EmptyAll />
            )
          ) : (
            <ContactsTable contacts={filtered} />
          )}
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          Showing {filtered.length} of {CONTACTS.length} contact
          {CONTACTS.length === 1 ? "" : "s"}.
        </div>
      </main>
    </>
  );
}

function filterContacts(list: Contact[], q: string): Contact[] {
  return list.filter(
    (c) =>
      c.fullName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.org?.toLowerCase() ?? "").includes(q) ||
      (c.roleHint?.toLowerCase() ?? "").includes(q),
  );
}

function countBySource(list: Contact[], source: Contact["source"]): number {
  return list.filter((c) => c.source === source).length;
}

const SOURCE_TINT: Record<Contact["source"], string> = {
  workspace: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  email: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  base: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
};

const SOURCE_LABEL: Record<Contact["source"], string> = {
  workspace: "Workspace",
  email: "Email",
  base: "Contact",
};

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="text-left font-medium px-4 py-2">Name</th>
          <th className="text-left font-medium px-4 py-2">Email</th>
          <th className="text-left font-medium px-4 py-2">Organization</th>
          <th className="text-left font-medium px-4 py-2">Role</th>
          <th className="text-left font-medium px-4 py-2">Source</th>
          <th className="text-right font-medium px-4 py-2">Email count</th>
        </tr>
      </thead>
      <tbody>
        {contacts.map((c) => (
          <tr key={c.id} className="border-b last:border-b-0 hover:bg-muted/20">
            <td className="px-4 py-2 font-medium text-foreground/90">{c.fullName}</td>
            <td className="px-4 py-2 text-muted-foreground font-mono text-xs">
              {c.email}
            </td>
            <td className="px-4 py-2 text-muted-foreground">{c.org ?? "—"}</td>
            <td className="px-4 py-2 text-muted-foreground">{c.roleHint ?? "—"}</td>
            <td className="px-4 py-2">
              <span
                className={
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                  SOURCE_TINT[c.source]
                }
              >
                {SOURCE_LABEL[c.source]}
              </span>
            </td>
            <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
              {c.emailCount > 0 ? c.emailCount : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptySearch({ q }: { q: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Search className="h-10 w-10 text-muted-foreground" aria-hidden />
      <h2 className="mt-4 text-lg font-semibold">
        No contacts match "{q}"
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Try a different name, email, or organization.
      </p>
      <Button
        render={<Link href="/contacts">Clear search</Link>}
        variant="outline"
        className="mt-4"
      />
    </div>
  );
}

function EmptyAll() {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Users className="h-10 w-10 text-muted-foreground" aria-hidden />
      <h2 className="mt-4 text-lg font-semibold">No contacts yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Workspace users and email participants populate this list automatically.
      </p>
    </div>
  );
}
